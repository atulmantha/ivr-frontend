const express = require('express');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

const NOTES_ENCRYPTION_KEY = process.env.NOTES_ENCRYPTION_KEY || '';
const ENCRYPTION_KEY = NOTES_ENCRYPTION_KEY
  ? crypto.createHash('sha256').update(NOTES_ENCRYPTION_KEY, 'utf8').digest()
  : null;
const ENCRYPTION_PREFIX = 'ENC:';
const ENCRYPTION_ALGORITHM = 'aes-256-gcm';

function encryptText(value) {
  if (value == null || value === '') return value;
  if (!ENCRYPTION_KEY) {
    console.warn('[frontend encryption] NOTES_ENCRYPTION_KEY not set; storing plaintext fallback.');
    return value;
  }

  try {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, ENCRYPTION_KEY, iv);
    const encrypted = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${ENCRYPTION_PREFIX}${iv.toString('base64')}::${tag.toString('base64')}::${encrypted.toString('base64')}`;
  } catch (err) {
    console.error('[frontend encryption] encryptText failed:', err.message);
    return value;
  }
}

const app = express();
const port = process.env.PORT || 3000;
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl || '', supabaseKey || '');

app.use(express.urlencoded({ extended: false }));
app.use(express.json());

function normalizePhone(phone) {
  return String(phone || '').trim();
}

function buildPhoneVariants(phone) {
  const raw = normalizePhone(phone);
  if (!raw) return [];

  const digitsOnly = raw.replace(/\D/g, '');
  const variants = new Set([raw]);

  if (digitsOnly) {
    variants.add(digitsOnly);
    variants.add(`+${digitsOnly}`);

    if (digitsOnly.length === 10) {
      variants.add(`1${digitsOnly}`);
      variants.add(`+1${digitsOnly}`);
    }

    if (digitsOnly.length > 10) {
      const lastTen = digitsOnly.slice(-10);
      variants.add(lastTen);
      variants.add(`1${lastTen}`);
      variants.add(`+1${lastTen}`);
    }
  }

  return Array.from(variants);
}

async function getCustomerByPhone(phone) {
  const phoneVariants = buildPhoneVariants(phone);
  if (phoneVariants.length === 0) return null;

  const lastTen = phoneVariants
    .map((value) => value.replace(/\D/g, ''))
    .find((digits) => digits.length >= 10)
    ?.slice(-10);

  const escapedVariants = phoneVariants.map((value) => value.replace(/,/g, '\\,'));
  const exactFilters = escapedVariants.map((value) => `phone.eq.${value}`);
  const fuzzyFilters = lastTen ? [`phone.ilike.%${lastTen}%`] : [];
  const orFilter = [...exactFilters, ...fuzzyFilters].join(',');

  const { data, error } = await supabase
    .from('customers')
    .select('id, phone, name, years_as_customer, tier, total_calls, created_at')
    .or(orFilter)
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) {
    throw new Error(`Failed to fetch customer: ${error.message}`);
  }

  return data?.[0] || null;
}

async function getCustomerById(customerId) {
  const id = normalizePhone(customerId);
  if (!id) return null;

  const { data, error } = await supabase
    .from('customers')
    .select('id, phone, name, years_as_customer, tier, total_calls, created_at')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch customer by id: ${error.message}`);
  }

  return data || null;
}

async function getCustomerByEmail(email) {
  const normalizedEmail = normalizePhone(email);
  if (!normalizedEmail) return null;

  const { data, error } = await supabase
    .from('customers')
    .select('id, phone, name, years_as_customer, tier, total_calls, created_at')
    .eq('email', normalizedEmail)
    .maybeSingle();

  if (error && error.code === '42703') {
    return null;
  }

  if (error) {
    throw new Error(`Failed to fetch customer by email: ${error.message}`);
  }

  return data || null;
}

function getPersonalization(customer, fallbackPhone) {
  if (customer) {
    const customerName = customer.name || 'Customer';
    const tier = customer.tier || 'Regular';

    return {
      customerName,
      customerPhone: customer.phone || normalizePhone(fallbackPhone),
      tier,
    };
  }

  return {
    customerName: 'New Customer',
    customerPhone: normalizePhone(fallbackPhone),
    tier: 'Regular',
  };
}

async function incrementCustomerCalls(customerId, currentTotalCalls) {
  if (!customerId) return;
  const nextTotalCalls = Number(currentTotalCalls || 0) + 1;
  const { error } = await supabase
    .from('customers')
    .update({ total_calls: nextTotalCalls })
    .eq('id', customerId);

  if (error) {
    throw new Error(`Failed to increment customer calls: ${error.message}`);
  }
}

async function insertCallRecord({
  existingCallData = {},
  customerName,
  customerPhone,
  tier,
}) {
  const { error } = await supabase.from('calls').insert({
    ...existingCallData,
    customer_name: customerName,
    customer_phone: customerPhone,
    tier,
  });

  if (error) {
    throw new Error(`Failed to insert call record: ${error.message}`);
  }
}

function escapeXml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

const { randomUUID } = require('crypto');

function getProcessUrl(req, callId) {
  const base = process.env.APP_BASE_URL
    ? process.env.APP_BASE_URL.replace(/\/+$/, '')
    : `${req.protocol}://${req.get('host')}`;
  const url = new URL(`${base}/process`);
  if (callId) url.searchParams.set('call_id', callId);
  return url.toString();
}

function buildGatherTwiml(actionUrl) {
  const escaped = escapeXml(actionUrl);
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather input="speech" action="${escaped}" method="POST" timeout="3" speechTimeout="1" bargeIn="true">
    <Pause length="1"/>
  </Gather>
  <Redirect method="POST">${escaped}</Redirect>
</Response>`;
}

// Initial call — generate UUID, enrich call record, return gather (no AI voice)
async function handleVoiceWebhook(req, res) {
  const fromPhone = req.body?.From || '';
  const callId = randomUUID();

  try {
    const customer = await getCustomerByPhone(fromPhone);
    const personalization = getPersonalization(customer, fromPhone);
    const actionUrl = getProcessUrl(req, callId);

    res.type('text/xml').status(200).send(buildGatherTwiml(actionUrl));

    // Bookkeeping after response
    Promise.allSettled([
      customer?.id
        ? incrementCustomerCalls(customer.id, customer.total_calls)
        : Promise.resolve(),
      insertCallRecord({
        existingCallData: { id: callId, priority: 'low' },
        customerName: personalization.customerName,
        customerPhone: personalization.customerPhone,
        tier: personalization.tier,
      }),
    ]).then((results) => {
      results.forEach((result, i) => {
        if (result.status === 'rejected') {
          const label = i === 0 ? 'Customer call count update' : 'Call insert';
          console.error(`${label} error:`, result.reason?.message || result.reason);
        }
      });
    });
  } catch (error) {
    console.error('Voice webhook error:', error.message);
    res.type('text/xml').status(200).send(buildGatherTwiml(getProcessUrl(req, randomUUID())));
  }
}

// Subsequent turns — store transcript only, no AI voice response
async function handleProcessWebhook(req, res) {
  const callId = String(req.query?.call_id || '').trim();
  const userInput = String(req.body?.SpeechResult || '').trim();
  const actionUrl = getProcessUrl(req, callId);

  // Respond immediately
  res.type('text/xml').status(200).send(buildGatherTwiml(actionUrl));

  // Store transcript in background (analysis is handled by ivr-backend)
  if (userInput && callId) {
    supabase
      .from('messages')
      .insert({
        call_id:           callId,
        role:              'user',
        content:           userInput,
        content_encrypted: encryptText(userInput),
      })
      .then(({ error }) => {
        if (error) console.error('Message insert error:', error.message);
      });
  }
}

app.post('/api/twilio/voice', handleVoiceWebhook);
app.post('/process', handleProcessWebhook);

app.get('/api/customer-details', async (req, res) => {
  const phone = String(req.query?.phone || '').trim();
  const id = String(req.query?.id || '').trim();
  const email = String(req.query?.email || '').trim();

  if (!phone && !id && !email) {
    return res
      .status(400)
      .json({ error: 'Provide at least one query parameter: id, email, or phone.' });
  }

  try {
    let customer = null;
    if (phone) customer = await getCustomerByPhone(phone);
    else if (id) customer = await getCustomerById(id);
    else if (email) customer = await getCustomerByEmail(email);

    if (!customer) return res.status(404).json({ error: 'Customer not found.' });

    return res.status(200).json({ customer });
  } catch (error) {
    console.error('Customer details route error:', error.message);
    return res.status(500).json({ error: 'Failed to fetch customer details.' });
  }
});

app.get('/health', (_req, res) => res.status(200).json({ ok: true }));

app.listen(port, () => {
  console.log(`Agent-assist frontend server listening on port ${port}`);
});
