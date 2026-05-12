"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

// ── Types ─────────────────────────────────────────────────────
type Call = {
  id: string;
  created_at: string;
  customer_name?: string | null;
  customer_phone?: string | null;
  tier?: string | null;
  duration_seconds?: number | null;
  priority?: string | null;
  status?: string | null;
  ivr_category?: string | null;
};

type Message = {
  id: string;
  call_id: string;
  role: string;
  content: string;
  created_at: string;
};

type Analysis = {
  id: string;
  call_id: string;
  emotion: "calm" | "confused" | "frustrated" | "angry";
  intent: string;
  priority: "low" | "medium" | "high";
  suggested_actions: string[];
  suggested_reply?: string | null;
  created_at: string;
};

type CustomerProfile = {
  name?: string | null;
  phone?: string | null;
  tier?: string | null;
  years_as_customer?: number | null;
};

type SentimentPoint = { minute: number; score: number; emotion: string };
type AgentAttributes = Record<string, boolean | null>;

type CallSummary = {
  topic: string;
  summary: string | null;
  key_points: string[];
  emotion: string;
  intent: string;
  priority: string;
  status: string;
  message_count: { customer: number; agent: number };
  customer_insights: string[];
  rep_insights: string[];
  pending_items: string[];
  overall_sentiment: string;
  sentiment_timeline: SentimentPoint[];
  agent_attributes: AgentAttributes | null;
};

type Recording = {
  id: string;
  call_id: string;
  recording_sid: string;
  conference_sid?: string | null;
  call_type: string;
  status: "pending" | "in-progress" | "completed" | "failed";
  recording_url?: string | null;
  duration_seconds?: number | null;
  started_at?: string | null;
  ended_at?: string | null;
  created_at: string;
};

type AgentProfile = {
  name: string;
  email: string;
  department: string;
  agent_id: string;
  is_verified: boolean;
  created_at: string;
};

type CallStatus = "idle" | "ringing" | "connected" | "error";
type KnowledgeEntry = Record<string, unknown> & { id: string };
type PanelId = "transcript" | "customer" | "suggestions";
type TabId = "dashboard" | "call-history" | "dialpad" | "knowledge-base" | "analytics" | "profile";

// ── SVG Icons ─────────────────────────────────────────────────
const IconGrid = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
    <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
  </svg>
);
const IconPhone = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 3.07 9.21 19.79 19.79 0 0 1 .01 2.18 2 2 0 0 1 2 0h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L6.09 7.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 20 16h2a2 2 0 0 1 2 1.92z"/>
  </svg>
);
const IconDialpad = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="5" cy="5" r="1.5" fill="currentColor" stroke="none"/>
    <circle cx="12" cy="5" r="1.5" fill="currentColor" stroke="none"/>
    <circle cx="19" cy="5" r="1.5" fill="currentColor" stroke="none"/>
    <circle cx="5" cy="12" r="1.5" fill="currentColor" stroke="none"/>
    <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/>
    <circle cx="19" cy="12" r="1.5" fill="currentColor" stroke="none"/>
    <circle cx="5" cy="19" r="1.5" fill="currentColor" stroke="none"/>
    <circle cx="12" cy="19" r="1.5" fill="currentColor" stroke="none"/>
  </svg>
);
const IconBook = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
  </svg>
);
const IconMic = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
    <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
    <line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>
  </svg>
);
const IconMicOff = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="1" y1="1" x2="23" y2="23"/>
    <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/>
    <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"/>
    <line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>
  </svg>
);
const IconChevronLeft = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6"/>
  </svg>
);
const IconChevronRight = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6"/>
  </svg>
);
const IconSun = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="5"/>
    <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
    <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
  </svg>
);
const IconMoon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
  </svg>
);
const IconUser = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
    <circle cx="12" cy="7" r="4"/>
  </svg>
);
const IconBarChart = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
    <line x1="2" y1="20" x2="22" y2="20"/>
  </svg>
);

// ── Helpers ───────────────────────────────────────────────────
const normalizeText = (v?: string | null) => v?.trim() || null;

const buildPhoneVariants = (phone?: string | null) => {
  const raw = normalizeText(phone);
  if (!raw) return [];
  const d = raw.replace(/\D/g, "");
  const s = new Set<string>([raw]);
  if (d) {
    s.add(d); s.add(`+${d}`);
    if (d.length === 10) { s.add(`1${d}`); s.add(`+1${d}`); }
    if (d.length > 10)   { const t = d.slice(-10); s.add(t); s.add(`+1${t}`); s.add(`1${t}`); }
  }
  return Array.from(s);
};

const inferProfileFromCalls = (calls: Call[]): CustomerProfile | null => {
  const nc = calls.map((c) => ({
    name:  normalizeText(c.customer_name),
    phone: normalizeText(c.customer_phone),
    tier:  normalizeText(c.tier),
  }));
  const phones = [...new Set(nc.map((c) => c.phone).filter(Boolean))] as string[];
  if (phones.length > 1) return null;
  const src = phones.length === 1 ? nc.filter((c) => c.phone === phones[0]) : nc;
  const name  = src.find((c) => c.name)?.name  || null;
  const phone = phones[0]                       || null;
  const tier  = src.find((c) => c.tier)?.tier  || null;
  if (!name && !phone && !tier) return null;
  return { name, phone, tier };
};

const formatDuration = (s?: number | null) => {
  if (s == null || isNaN(s)) return null;
  const total = Math.max(0, Math.floor(s));
  const m = Math.floor(total / 60), sec = total % 60;
  return m === 0 ? `${sec}s` : `${m}m ${String(sec).padStart(2, "0")}s`;
};

const formatIntent = (i: string) =>
  String(i || "").split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");

const EMOTION_CFG: Record<string, { label: string; cls: string }> = {
  calm:       { label: "Calm",       cls: "emotion-calm" },
  confused:   { label: "Confused",   cls: "emotion-confused" },
  frustrated: { label: "Frustrated", cls: "emotion-frustrated" },
  angry:      { label: "Angry",      cls: "emotion-angry" },
};

const PRIORITY_CFG: Record<string, { label: string; cls: string }> = {
  high:   { label: "High",   cls: "priority-high" },
  medium: { label: "Medium", cls: "priority-medium" },
  low:    { label: "Low",    cls: "priority-low" },
};

const IVR_CATEGORY_CFG: Record<string, { label: string; key: string }> = {
  billing:        { label: "Billing",         key: "Press 1" },
  service:        { label: "Service Support", key: "Press 2" },
  new_connection: { label: "New Connection",  key: "Press 3" },
  general:        { label: "General",         key: "Press 4" },
};

const NAV_TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: "dashboard",      label: "Dashboard",      icon: <IconGrid /> },
  { id: "call-history",   label: "Call History",   icon: <IconPhone /> },
  { id: "dialpad",        label: "Dialpad",        icon: <IconDialpad /> },
  { id: "knowledge-base", label: "Knowledge Base", icon: <IconBook /> },
  { id: "analytics",      label: "Analytics",      icon: <IconBarChart /> },
  { id: "profile",        label: "My Profile",     icon: <IconUser /> },
];

// ── Component ─────────────────────────────────────────────────
export default function Dashboard() {
  const [calls, setCalls]                   = useState<Call[]>([]);
  const [messages, setMessages]             = useState<Message[]>([]);
  const [selectedCall, setSelectedCall]     = useState<string | null>(null);
  const [customerProfile, setCustomerProfile] = useState<CustomerProfile | null>(null);
  const [suggestions, setSuggestions]       = useState<Analysis[]>([]);
  const [callSummary, setCallSummary]       = useState<CallSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [recordings, setRecordings]         = useState<Recording[]>([]);
  const [recordingsLoading, setRecordingsLoading] = useState(false);
  const [callQueryAddressed, setCallQueryAddressed] = useState<Record<string, boolean>>({});

  // Softphone
  const [callStatus, setCallStatus]         = useState<CallStatus>("idle");
  const [activeCall, setActiveCall]         = useState<any>(null);
  const [isMuted, setIsMuted]               = useState(false);
  const deviceRef                           = useRef<any>(null);
  const activeCallRef                       = useRef<any>(null);
  const kbFileInputRef                      = useRef<HTMLInputElement>(null);
  const selectedCallRef                     = useRef<string | null>(null);
  const fetchCallsRef                       = useRef<() => Promise<void>>(async () => {});
  const fetchMessagesRef                    = useRef<(id: string) => Promise<void>>(async () => {});
  const fetchSuggestionsRef                 = useRef<(id: string) => Promise<void>>(async () => {});
  const fetchCallSummaryRef                 = useRef<(id: string) => Promise<void>>(async () => {});
  const fetchRecordingsRef                  = useRef<(id: string) => Promise<void>>(async () => {});
  const latestCallIdRef                     = useRef<string | null>(null);
  const suggestionsListRef                  = useRef<HTMLDivElement>(null);

  // Agent session
  const router = useRouter();
  const [agentName, setAgentName]       = useState<string | null>(null);
  const [agentProfile, setAgentProfile] = useState<AgentProfile | null>(null);

  // UI
  const [activeTab, setActiveTab]           = useState<TabId>("dashboard");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [darkMode, setDarkMode]             = useState(false);
  const [customerPanelTab, setCustomerPanelTab] = useState<"summary" | "agent-analysis" | "recordings">("summary");

  // Knowledge base
  const [kbText, setKbText]                 = useState("");
  const [kbSource, setKbSource]             = useState("");
  const [kbStatus, setKbStatus]             = useState<"idle" | "saving" | "done" | "error">("idle");
  const [kbFile, setKbFile]                 = useState<File | null>(null);
  const [kbFileStatus, setKbFileStatus]     = useState<"idle" | "uploading" | "done" | "error">("idle");
  const [kbFileMsg, setKbFileMsg]           = useState("");
  const [kbEntries, setKbEntries]           = useState<KnowledgeEntry[]>([]);
  const [kbEntriesLoading, setKbEntriesLoading] = useState(false);
  const [kbEntriesError, setKbEntriesError] = useState<string | null>(null);

  // Dialpad
  const [dialpadNumber, setDialpadNumber]   = useState("");
  const [dialpadStatus, setDialpadStatus]   = useState<"idle" | "calling" | "connected">("idle");

  // 3-panel layout
  const [panelOrder, setPanelOrder]         = useState<PanelId[]>(["transcript", "customer", "suggestions"]);
  const [panelWidths, setPanelWidths]       = useState<number[]>([40, 30, 30]);
  const panelResizeRef = useRef<{ handleIdx: number; startX: number; startWidths: number[] } | null>(null);
  const dragPanelIdx   = useRef<number | null>(null);

  // ── Dark mode init ──────────────────────────────────────────
  useEffect(() => {
    const saved = localStorage.getItem("ivr-dark-mode");
    if (saved === "true") setDarkMode(true);
  }, []);

  const toggleDarkMode = () => {
    setDarkMode((prev) => {
      localStorage.setItem("ivr-dark-mode", String(!prev));
      return !prev;
    });
  };

  // ── Agent auth session ───────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) return;
      const displayName =
        session.user.user_metadata?.name ||
        session.user.user_metadata?.full_name ||
        session.user.email?.split("@")[0] ||
        "Agent";
      setAgentName(displayName);

      const { data, error } = await supabase
        .from("agents")
        .select("name, email, department, agent_id, is_verified, created_at")
        .eq("auth_user_id", session.user.id)
        .single();

      if (error) console.warn("[profile] agents table lookup:", error.message);

      if (data) {
        setAgentProfile(data as AgentProfile);
      } else {
        setAgentProfile({
          name:        displayName,
          email:       session.user.email || "",
          department:  session.user.user_metadata?.department || "General",
          agent_id:    session.user.id.slice(0, 8).toUpperCase(),
          is_verified: !!session.user.email_confirmed_at,
          created_at:  session.user.created_at || new Date().toISOString(),
        });
      }
    });
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  // ── Data fetchers ───────────────────────────────────────────
  const fetchCalls = async () => {
    const { data, error } = await supabase
      .from("calls").select("*").order("created_at", { ascending: false });
    if (error) console.error("fetchCalls:", error.message);
    const rows = data || [];
    setCalls(rows);
    const newestVisible = rows.find((r) => r.status === "connected" || r.status === "disconnected");
    const newestId = newestVisible?.id ?? null;
    if (newestId && newestId !== latestCallIdRef.current) {
      latestCallIdRef.current = newestId;
      setSelectedCall(newestId);
    }
  };

  const fetchMessages = async (callId: string) => {
    const { data } = await supabase
      .from("messages").select("*").eq("call_id", callId).order("created_at", { ascending: true });
    setMessages(data || []);
  };

  const fetchSuggestions = async (callId: string) => {
    const { data } = await supabase
      .from("analysis").select("*").eq("call_id", callId).order("created_at", { ascending: true });
    setSuggestions((data as Analysis[]) || []);
  };

  const fetchRecordings = async (callId: string) => {
    setRecordingsLoading(true);
    try {
      const r = await fetch(`/api/recordings?call_id=${callId}`);
      if (r.ok) {
        const { recordings: data } = await r.json();
        setRecordings(data || []);
      }
    } catch { /* non-critical */ } finally {
      setRecordingsLoading(false);
    }
  };

  const fetchCallSummary = async (callId: string, force = false) => {
    setSummaryLoading(true);
    try {
      const url = `/api/call-summary?call_id=${callId}${force ? "&force=true" : ""}`;
      const r = await fetch(url);
      if (r.ok) setCallSummary(await r.json());
    } catch { /* non-critical */ } finally {
      setSummaryLoading(false);
    }
  };

  const fetchKbEntries = async () => {
    setKbEntriesLoading(true);
    setKbEntriesError(null);
    const { data, error } = await supabase
      .from("knowledge_base").select("*").order("created_at", { ascending: false });
    if (error) { setKbEntriesError(error.message); }
    else { setKbEntries((data as KnowledgeEntry[]) || []); }
    setKbEntriesLoading(false);
  };

  // ── Effects ─────────────────────────────────────────────────
  useEffect(() => { fetchCalls(); }, []);

  useEffect(() => {
    const fetchQueryAddressedMap = async () => {
      const [{ data: userRows, error: userErr }, { data: agentRows, error: agentErr }] = await Promise.all([
        supabase.from("messages").select("call_id").eq("role", "user"),
        supabase.from("messages").select("call_id").eq("role", "agent"),
      ]);
      if (userErr || agentErr) {
        console.error("fetchQueryAddressedMap:", userErr?.message || agentErr?.message);
        return;
      }

      const userCallIds = new Set((userRows || []).map((r: any) => r.call_id));
      const agentCallIds = new Set((agentRows || []).map((r: any) => r.call_id));
      const next: Record<string, boolean> = {};
      userCallIds.forEach((callId) => { next[callId] = agentCallIds.has(callId); });
      setCallQueryAddressed(next);
    };

    fetchQueryAddressedMap();
  }, [calls]);

  useEffect(() => {
    if (!selectedCall) { setSuggestions([]); setMessages([]); setCallSummary(null); setRecordings([]); return; }
    fetchMessages(selectedCall);
    fetchSuggestions(selectedCall);
    fetchCallSummary(selectedCall);
    fetchRecordings(selectedCall);
  }, [selectedCall]);

  useEffect(() => {
    if (activeTab === "knowledge-base") fetchKbEntries();
  }, [activeTab]);

  // When this agent's visible call list changes, deselect any call that's no
  // longer in scope (e.g., a billing call was auto-selected for a general agent).
  useEffect(() => {
    if (!agentProfile?.department) return; // department not loaded yet
    if (!selectedCall) return;
    const isVisible = (c: { id: string; status?: string | null; ivr_category?: string | null }) =>
      (c.status === "connected" || c.status === "disconnected") &&
      (!agentDeptCategories || !c.ivr_category || agentDeptCategories.includes(c.ivr_category));
    if (!calls.some((c) => c.id === selectedCall && isVisible(c))) {
      setSelectedCall(calls.find(isVisible)?.id ?? null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calls, agentProfile?.department]);

  // Auto-scroll suggestions to bottom when new one arrives
  useEffect(() => {
    const el = suggestionsListRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [suggestions.length]);

  // 3-panel resize
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const r = panelResizeRef.current;
      if (!r) return;
      const container = document.querySelector<HTMLElement>(".three-panel-body");
      if (!container) return;
      const pct = ((e.clientX - r.startX) / container.offsetWidth) * 100;
      const next = [...r.startWidths];
      const left  = Math.max(12, r.startWidths[r.handleIdx]     + pct);
      const right = Math.max(12, r.startWidths[r.handleIdx + 1] - pct);
      if (left >= 12 && right >= 12) {
        next[r.handleIdx] = left; next[r.handleIdx + 1] = right;
        setPanelWidths(next);
      }
    };
    const onUp = () => { panelResizeRef.current = null; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup",  onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, []);

  // Customer profile
  useEffect(() => {
    const phone = normalizeText(calls.find((c) => c.id === selectedCall)?.customer_phone);
    let mounted = true;
    (async () => {
      let profile: CustomerProfile | null = null;
      if (phone) {
        for (const variant of buildPhoneVariants(phone)) {
          try {
            const r = await fetch(`/api/customer-details?phone=${encodeURIComponent(variant)}`, { cache: "no-store" });
            if (!mounted) return;
            if (r.status === 404) continue;
            if (!r.ok) continue;
            const { customer } = await r.json();
            if (customer) {
              profile = {
                name:              normalizeText(customer.name),
                phone:             normalizeText(customer.phone),
                tier:              normalizeText(customer.tier),
                years_as_customer: typeof customer.years_as_customer === "number" ? customer.years_as_customer : null,
              };
              break;
            }
          } catch { /* skip */ }
        }
      }
      if (!profile) profile = inferProfileFromCalls(calls);
      if (mounted) setCustomerProfile(profile);
    })();
    return () => { mounted = false; };
  }, [calls, selectedCall]);

  // Ref sync
  useEffect(() => { selectedCallRef.current = selectedCall; }, [selectedCall]);
  useEffect(() => { activeCallRef.current = activeCall; }, [activeCall]);
  useEffect(() => { fetchCallsRef.current = fetchCalls; });
  useEffect(() => { fetchMessagesRef.current = fetchMessages; });
  useEffect(() => { fetchSuggestionsRef.current = fetchSuggestions; });
  useEffect(() => { fetchCallSummaryRef.current = fetchCallSummary; });
  useEffect(() => { fetchRecordingsRef.current = fetchRecordings; });

  // Re-fetch summary whenever a new analysis row arrives (new customer turn processed)
  useEffect(() => {
    if (selectedCall && suggestions.length > 0) {
      fetchCallSummaryRef.current(selectedCall);
    }
  }, [suggestions.length]);

  // Polling fallbacks
  useEffect(() => {
    const id = setInterval(() => fetchCallsRef.current(), 5000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    const id = setInterval(() => {
      if (selectedCallRef.current) fetchMessagesRef.current(selectedCallRef.current);
    }, 3000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    const id = setInterval(() => {
      if (selectedCallRef.current) fetchSuggestionsRef.current(selectedCallRef.current);
    }, 3000);
    return () => clearInterval(id);
  }, []);

  // Realtime
  useEffect(() => {
    const ch = supabase.channel("agent-assist-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const msg = payload.new as Message;
          if (msg?.id && msg?.call_id === selectedCallRef.current) {
            setMessages((prev) => {
              if (prev.some((m) => m.id === msg.id)) return prev;
              return [...prev, msg].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
            });
          } else if (selectedCallRef.current) {
            fetchMessagesRef.current(selectedCallRef.current);
          }
        })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "analysis" },
        (payload) => {
          const row = payload.new as Analysis;
          if (row?.id && row?.call_id === selectedCallRef.current) {
            setSuggestions((prev) => {
              if (prev.some((s) => s.id === row.id)) return prev;
              return [...prev, row].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
            });
          } else if (selectedCallRef.current) {
            fetchSuggestionsRef.current(selectedCallRef.current);
          }
        })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "analysis" },
        (payload) => {
          const row = payload.new as Analysis;
          if (row?.id && row?.call_id === selectedCallRef.current) {
            setSuggestions((prev) => prev.map((s) => s.id === row.id ? row : s));
          } else if (selectedCallRef.current) {
            fetchSuggestionsRef.current(selectedCallRef.current);
          }
        })
      .on("postgres_changes", { event: "*", schema: "public", table: "calls" },
        (payload) => {
          if (payload.eventType === "DELETE" && payload.old) {
            const rid = (payload.old as Call).id;
            setCalls((prev) => prev.filter((c) => c.id !== rid));
            setSelectedCall((cur) => cur === rid ? null : cur);
            return;
          }
          fetchCallsRef.current();
        })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "recordings" },
        (payload) => {
          const rec = payload.new as Recording;
          if (rec?.call_id === selectedCallRef.current) {
            setRecordings((prev) => prev.some((r) => r.id === rec.id) ? prev : [...prev, rec]);
          } else if (selectedCallRef.current) {
            fetchRecordingsRef.current(selectedCallRef.current);
          }
        })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "recordings" },
        (payload) => {
          const rec = payload.new as Recording;
          if (rec?.call_id === selectedCallRef.current) {
            setRecordings((prev) => prev.map((r) => r.id === rec.id ? rec : r));
          } else if (selectedCallRef.current) {
            fetchRecordingsRef.current(selectedCallRef.current);
          }
        })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  // Softphone
  useEffect(() => {
    let device: any = null;
    const init = async () => {
      try {
        const { data: { session: authSession } } = await supabase.auth.getSession();
        const tokenHeaders: HeadersInit = {};
        if (authSession?.access_token) {
          tokenHeaders["Authorization"] = `Bearer ${authSession.access_token}`;
        }
        const r = await fetch("/api/token", { headers: tokenHeaders });
        if (!r.ok) { console.warn("Token fetch failed."); return; }
        const { token, error } = await r.json();
        if (error || !token) { console.warn("No token."); return; }
        const { Device } = await import("@twilio/voice-sdk");
        device = new Device(token, { logLevel: "error" });
        device.on("incoming", (call: any) => {
          if (activeCallRef.current) {
            call.reject();
            return;
          }
          activeCallRef.current = call;
          call.accept();
          setCallStatus("connected");
          setActiveCall(call);
          setIsMuted(false);
          setActiveTab("dashboard");
          fetchCallsRef.current();
          call.on("disconnect", () => { setCallStatus("idle"); setActiveCall(null); setIsMuted(false); });
          call.on("cancel",     () => { setCallStatus("idle"); setActiveCall(null); setIsMuted(false); });
        });
        device.on("error", (err: any) => { console.error("Device error:", err); setCallStatus("error"); });
        await device.register();
        deviceRef.current = device;
      } catch (err) { console.warn("Softphone init skipped:", err); }
    };
    init();
    return () => { if (deviceRef.current) { deviceRef.current.destroy(); deviceRef.current = null; } };
  }, []);

  // ── Handlers ────────────────────────────────────────────────
  const handleMuteToggle = async () => {
    if (!activeCall) return;
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    try { activeCall.mute(newMuted); } catch (e) { console.warn("SDK mute failed:", e); }
    try {
      await fetch("/api/call/mute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callId: selectedCall, muted: newMuted }),
      });
    } catch { /* non-critical */ }
  };

  const handleDialpadCall = async () => {
    if (!deviceRef.current || !dialpadNumber.trim()) return;
    setDialpadStatus("calling");
    try {
      const call = await deviceRef.current.connect({ params: { To: dialpadNumber.trim() } });
      setActiveCall(call);
      setDialpadStatus("connected");
      call.on("disconnect", () => { setDialpadStatus("idle"); setActiveCall(null); });
      call.on("cancel",     () => { setDialpadStatus("idle"); setActiveCall(null); });
    } catch (err: any) {
      console.error("Outbound call failed:", err);
      setDialpadStatus("idle");
    }
  };

  const handleDialpadHangup = () => {
    if (activeCall) activeCall.disconnect();
    setDialpadStatus("idle");
    setActiveCall(null);
  };

  const dialpadPress = (digit: string) => {
    if (dialpadStatus === "connected" && activeCall) activeCall.sendDigits(digit);
    else setDialpadNumber((prev) => prev + digit);
  };

  const handleKbSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!kbText.trim()) return;
    setKbStatus("saving");
    try {
      const r = await fetch("/api/knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: kbText.trim(), source: kbSource.trim() }),
      });
      setKbStatus(r.ok ? "done" : "error");
      if (r.ok) { setKbText(""); setKbSource(""); }
      setTimeout(() => setKbStatus("idle"), 3000);
    } catch { setKbStatus("error"); setTimeout(() => setKbStatus("idle"), 3000); }
  };

  const handleKbFileUpload = async () => {
    if (!kbFile) return;
    setKbFileStatus("uploading"); setKbFileMsg("");
    try {
      const formData = new FormData();
      formData.append("file", kbFile);
      const r = await fetch("/api/knowledge/upload", { method: "POST", body: formData });
      const data = await r.json();
      if (r.ok) {
        setKbFileStatus("done");
        setKbFileMsg(`✓ ${data.inserted_chunks} of ${data.total_chunks} chunks saved`);
        setKbFile(null);
        if (kbFileInputRef.current) kbFileInputRef.current.value = "";
      } else { setKbFileStatus("error"); setKbFileMsg(data.error || "Upload failed"); }
    } catch { setKbFileStatus("error"); setKbFileMsg("Upload failed"); }
    setTimeout(() => { setKbFileStatus("idle"); setKbFileMsg(""); }, 4000);
  };

  // ── Derived values ──────────────────────────────────────────

  // Map logged-in agent's department to the IVR categories they handle.
  // Mirrors the categoryToAgentIdentity mapping on the backend.
  const dept = agentProfile?.department ?? null;
  const agentDeptCategories: string[] | null =
    dept === "Billing"           ? ["billing"] :
    dept === "Technical Support" ? ["service", "new_connection"] :
    dept === "Sales"             ? ["service", "new_connection"] :
    dept === "Customer Success"  ? ["service", "new_connection"] :
    dept === "General"           ? ["general"] :
    null; // null = show all (admin or department not yet loaded)

  // Only show calls that have an agent connected or are completed.
  // Calls still in IVR, ringing, or waiting in queue are hidden until the agent joins.
  const visibleCalls = calls
    .filter((c) => c.status === "connected" || c.status === "disconnected")
    .filter((c) => !agentDeptCategories || !c.ivr_category || agentDeptCategories.includes(c.ivr_category));

  const selectedCallData  = calls.find((c) => c.id === selectedCall) || null;

  // Analytics — computed from visibleCalls so each agent only sees their own data
  const totalCalls        = visibleCalls.length;
  const droppedCalls      = visibleCalls.filter((c) => callQueryAddressed[c.id] === false).length;
  const ivrCalls          = visibleCalls.filter((c) => !!c.ivr_category).length;
  const directCalls       = totalCalls - ivrCalls;
  const droppedInIvr      = visibleCalls.filter((c) => c.status === "ivr").length;
  const ivrPct            = totalCalls > 0 ? Math.round((ivrCalls / totalCalls) * 100) : 0;
  const ivrCategoryCounts = visibleCalls.reduce<Record<string, number>>((acc, c) => {
    if (c.ivr_category) acc[c.ivr_category] = (acc[c.ivr_category] || 0) + 1;
    return acc;
  }, {});
  const maxCategoryCount  = Math.max(...Object.values(ivrCategoryCounts), 1);
  const customerMsgCount  = messages.filter((m) => m.role === "user").length;
  const agentMsgCount     = messages.filter((m) => m.role === "agent").length;
  const ivrQuery          = messages.find((m) => m.role === "user")?.content || null;
  const selectedTier      = normalizeText(selectedCallData?.tier);
  const selectedDuration  = formatDuration(selectedCallData?.duration_seconds);
  const inferred          = inferProfileFromCalls(calls);

  const resolvedName  = normalizeText(selectedCallData?.customer_name)  || normalizeText(customerProfile?.name)  || normalizeText(inferred?.name)  || "Customer";
  const resolvedPhone = normalizeText(selectedCallData?.customer_phone) || normalizeText(customerProfile?.phone) || normalizeText(inferred?.phone);
  const resolvedTier  = selectedTier || normalizeText(customerProfile?.tier) || normalizeText(inferred?.tier);
  const isPlatinum    = resolvedTier?.toLowerCase() === "platinum";
  const resolvedYears = customerProfile?.years_as_customer ?? null;

  const softphoneStatusLabel: Record<CallStatus, string> = {
    idle: "Agent Ready", ringing: "Connecting...", connected: "On Call", error: "Connection Error",
  };

  // ── Render ──────────────────────────────────────────────────
  return (
    <div className={`app-root${darkMode ? " dark" : ""}`}>

      {/* ── Sidebar ── */}
      <aside className={`sidebar${sidebarCollapsed ? " collapsed" : ""}`}>
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <span className="sidebar-logo-icon">🎧</span>
            {!sidebarCollapsed && <span className="sidebar-logo-text">Agent Assist</span>}
          </div>
          <button
            className="sidebar-collapse-btn"
            onClick={() => setSidebarCollapsed((p) => !p)}
            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {sidebarCollapsed ? <IconChevronRight /> : <IconChevronLeft />}
          </button>
        </div>

        <nav className="sidebar-nav">
          {NAV_TABS.map((tab) => (
            <button
              key={tab.id}
              className={`sidebar-item${activeTab === tab.id ? " active" : ""}`}
              onClick={() => setActiveTab(tab.id)}
              title={sidebarCollapsed ? tab.label : undefined}
            >
              <span className="sidebar-icon">{tab.icon}</span>
              {!sidebarCollapsed && <span className="sidebar-label">{tab.label}</span>}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className={`sidebar-status-pill ${callStatus}`}>
            <span className={`status-dot status-dot-${callStatus}`} />
            {!sidebarCollapsed && <span>{softphoneStatusLabel[callStatus]}</span>}
          </div>

          {/* Mute/Unmute — only when connected */}
          {callStatus === "connected" && (
            <button
              className={`mute-btn${isMuted ? " muted" : ""}`}
              onClick={handleMuteToggle}
              title={isMuted ? "Unmute microphone" : "Mute microphone"}
            >
              {isMuted ? <IconMicOff /> : <IconMic />}
              {!sidebarCollapsed && <span>{isMuted ? "Unmute" : "Mute"}</span>}
            </button>
          )}
        </div>
      </aside>

      {/* ── Main content ── */}
      <div className="main-content">

        {/* Top bar */}
        <header className="topbar">
          <div className="topbar-left">
            <span className="topbar-title">
              {NAV_TABS.find((t) => t.id === activeTab)?.label}
            </span>
          </div>
          <div className="topbar-right">
            <button className="dark-mode-btn" onClick={toggleDarkMode} title="Toggle dark mode">
              {darkMode ? <IconSun /> : <IconMoon />}
              <span>{darkMode ? "Light" : "Dark"}</span>
            </button>
          </div>
        </header>

        {/* ── Dashboard Tab ── */}
        <div className={`tab-view${activeTab === "dashboard" ? " active" : ""}`}>
          <div className="dashboard-header-strip">
            <div>
              <p className="eyebrow">Live Transcript</p>
              <h2 className="panel-title">
                {selectedCallData ? `Conversation ${selectedCallData.id.slice(0, 8)}` : "Conversation"}
              </h2>
              <p className="subtle-copy">
                {selectedCallData
                  ? `Started ${new Date(selectedCallData.created_at).toLocaleString()}`
                  : "Select a call from Call History."}
              </p>
            </div>
            <div className="message-stats">
              <span>Customer: {customerMsgCount}</span>
              <span>Agent: {agentMsgCount}</span>
            </div>
          </div>

          <div className="three-panel-body">
            {panelOrder.map((panelId, idx) => (
              <React.Fragment key={panelId}>
                <div
                  className="split-panel"
                  style={{ width: `${panelWidths[idx]}%` }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => {
                    const from = dragPanelIdx.current;
                    if (from === null || from === idx) return;
                    const newOrder = [...panelOrder];
                    [newOrder[from], newOrder[idx]] = [newOrder[idx], newOrder[from]];
                    setPanelOrder(newOrder);
                    dragPanelIdx.current = null;
                  }}
                >
                  <div className="split-panel-grab" draggable onDragStart={() => { dragPanelIdx.current = idx; }}>
                    <span className="split-panel-title">
                      {panelId === "transcript" ? "Conversation" : panelId === "customer" ? "Customer" : "AI Suggestions"}
                    </span>
                    <span className="grab-dots">⠿</span>
                  </div>

                  <div className="split-panel-content">

                    {/* ── Transcript panel ── */}
                    {panelId === "transcript" && (
                      <div className="messages-wrap">
                        {selectedCallData?.status === "waiting" && (
                          <div className="queue-waiting-notice">
                            <span className="queue-waiting-icon">⏳</span>
                            <p>Customer waiting for available agent.</p>
                          </div>
                        )}
                        {messages.length === 0 && selectedCallData?.status !== "waiting" && (
                          <div className="empty-chat">No transcript yet. Waiting for the call to start.</div>
                        )}
                        {messages.map((msg) => {
                          const isAgent    = msg.role === "agent";
                          const isCustomer = msg.role === "user";
                          return (
                            <article key={msg.id}
                              className={`message-row msg-animate ${isAgent ? "agent" : isCustomer ? "caller" : "assistant"}`}>
                              <div className="message-bubble">
                                <p className="message-role">{isAgent ? "Agent" : isCustomer ? "Customer" : msg.role}</p>
                                <p className="message-content">{msg.content}</p>
                                <p className="message-time">{new Date(msg.created_at).toLocaleTimeString()}</p>
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    )}

                    {/* ── Customer panel ── */}
                    {panelId === "customer" && (
                      <div className="split-panel-inner">
                        {selectedCallData ? (
                          <div className={`assist-customer-card${isPlatinum ? " priority" : ""}`}>
                            <div className="customer-summary-top">
                              <p className="eyebrow-dark">Customer</p>
                              {isPlatinum && <span className="tier-badge platinum">Platinum</span>}
                            </div>
                            <strong className="assist-customer-name">{resolvedName}</strong>
                            {resolvedPhone && <span className="assist-customer-detail">{resolvedPhone}</span>}
                            {resolvedTier  && <span className="assist-customer-detail">Tier: {resolvedTier}</span>}
                            {resolvedYears != null && (
                              <span className="assist-customer-detail">
                                Customer for {resolvedYears} {resolvedYears === 1 ? "year" : "years"}
                              </span>
                            )}
                            {selectedDuration && <span className="assist-customer-detail">Duration: {selectedDuration}</span>}

                            {/* IVR Journey */}
                            <div className="ivr-journey">
                              <p className="ivr-journey-title">IVR Journey</p>
                              <div className="ivr-journey-steps">
                                <div className="ivr-step ivr-step-done">
                                  <span className="ivr-step-icon">✓</span>
                                  <span className="ivr-step-text">
                                    {resolvedName !== "Customer" ? `Account found — ${resolvedName}` : "Account not found"}
                                  </span>
                                </div>
                                {selectedCallData?.ivr_category ? (
                                  <>
                                    <div className="ivr-step ivr-step-done">
                                      <span className="ivr-step-icon">✓</span>
                                      <span className="ivr-step-text">Verified — DOB: Jan 1, 2000</span>
                                    </div>
                                    <div className="ivr-step ivr-step-done">
                                      <span className="ivr-step-icon">✓</span>
                                      <span className="ivr-step-text">
                                        {IVR_CATEGORY_CFG[selectedCallData.ivr_category]?.label ?? formatIntent(selectedCallData.ivr_category)}
                                        <span className="ivr-step-key">{IVR_CATEGORY_CFG[selectedCallData.ivr_category]?.key}</span>
                                      </span>
                                    </div>
                                  </>
                                ) : (
                                  <div className="ivr-step ivr-step-pending">
                                    <span className="ivr-step-dot" />
                                    <span className="ivr-step-text">Verification — awaiting DOB</span>
                                  </div>
                                )}
                                {ivrQuery ? (
                                  <div className="ivr-step ivr-step-done">
                                    <span className="ivr-step-icon">✓</span>
                                    <span className="ivr-step-text">Query captured</span>
                                  </div>
                                ) : (
                                  <div className="ivr-step ivr-step-pending">
                                    <span className="ivr-step-dot" />
                                    <span className="ivr-step-text">Awaiting query</span>
                                  </div>
                                )}
                              </div>
                            </div>

                            {ivrQuery && (
                              <div className="ivr-query-block">
                                <span className="ivr-query-label">Issue Reported</span>
                                <p className="ivr-query-text">{ivrQuery}</p>
                              </div>
                            )}

                            {/* Customer panel sub-tabs */}
                            <div className="cust-panel-tabs">
                              {(["summary", "agent-analysis", "recordings"] as const).map((tab) => (
                                <button
                                  key={tab}
                                  className={`cust-panel-tab${customerPanelTab === tab ? " active" : ""}`}
                                  onClick={() => setCustomerPanelTab(tab)}
                                >
                                  {tab === "summary" ? "Call Summary" : tab === "agent-analysis" ? "Agent Analysis" : "Recordings"}
                                </button>
                              ))}
                              <button
                                className="summary-refresh-btn cust-tab-refresh"
                                onClick={() => {
                                  if (customerPanelTab === "recordings") fetchRecordings(selectedCall!);
                                  else fetchCallSummary(selectedCall!, true);
                                }}
                                disabled={customerPanelTab === "recordings" ? recordingsLoading : summaryLoading}
                                title="Refresh"
                              >
                                {(customerPanelTab === "recordings" ? recordingsLoading : summaryLoading) ? "…" : "↻"}
                              </button>
                            </div>

                            {/* ── Call Summary tab ── */}
                            {customerPanelTab === "summary" && (
                              <div className="cust-tab-body">
                                {summaryLoading && !callSummary ? (
                                  <div className="summary-loading">Generating summary...</div>
                                ) : !callSummary ? (
                                  <div className="summary-loading">No summary yet.</div>
                                ) : (
                                  <>
                                    <table className="summary-table">
                                      <tbody>
                                        <tr><td className="summary-key">Topic</td><td className="summary-val">{callSummary.topic}</td></tr>
                                        {selectedCallData?.ivr_category && (
                                          <tr>
                                            <td className="summary-key">Category</td>
                                            <td className="summary-val">{IVR_CATEGORY_CFG[selectedCallData.ivr_category]?.label ?? formatIntent(selectedCallData.ivr_category)}</td>
                                          </tr>
                                        )}
                                        <tr>
                                          <td className="summary-key">Emotion</td>
                                          <td className="summary-val">
                                            <span className={`analysis-badge ${EMOTION_CFG[callSummary.emotion]?.cls ?? ""}`} style={{ fontSize: "0.63rem", padding: "2px 8px" }}>
                                              {EMOTION_CFG[callSummary.emotion]?.label ?? callSummary.emotion}
                                            </span>
                                          </td>
                                        </tr>
                                        <tr><td className="summary-key">Intent</td><td className="summary-val">{formatIntent(callSummary.intent)}</td></tr>
                                        <tr>
                                          <td className="summary-key">Priority</td>
                                          <td className="summary-val">
                                            <span className={`analysis-badge ${PRIORITY_CFG[callSummary.priority]?.cls ?? ""}`} style={{ fontSize: "0.63rem", padding: "2px 8px" }}>
                                              {PRIORITY_CFG[callSummary.priority]?.label ?? callSummary.priority}
                                            </span>
                                          </td>
                                        </tr>
                                        <tr><td className="summary-key">Status</td><td className="summary-val">{formatIntent(callSummary.status)}</td></tr>
                                        <tr>
                                          <td className="summary-key">Sentiment</td>
                                          <td className="summary-val">
                                            <span className={`overall-sentiment-badge sentiment-${callSummary.overall_sentiment}`}>
                                              {callSummary.overall_sentiment.charAt(0).toUpperCase() + callSummary.overall_sentiment.slice(1)}
                                            </span>
                                          </td>
                                        </tr>
                                        <tr><td className="summary-key">Turns</td><td className="summary-val">{callSummary.message_count.customer}C / {callSummary.message_count.agent}A</td></tr>
                                      </tbody>
                                    </table>

                                    {callSummary.summary && <p className="summary-narrative">{callSummary.summary}</p>}

                                    {/* Sentiment timeline chart */}
                                    {callSummary.sentiment_timeline.length > 0 && (
                                      <div className="sentiment-chart-wrap">
                                        <p className="insight-section-title">Sentiment Timeline</p>
                                        <div className="sentiment-chart">
                                          {callSummary.sentiment_timeline.map((pt, i) => {
                                            const h = Math.max(4, Math.round(pt.score * 52));
                                            const color = pt.score > 0.65 ? "#22c55e" : pt.score > 0.4 ? "#f59e0b" : "#ef4444";
                                            return (
                                              <div key={i} className="sentiment-bar-col" title={`${pt.minute}m — ${pt.emotion} (${Math.round(pt.score * 100)}%)`}>
                                                <div className="sentiment-bar" style={{ height: h, background: color }} />
                                                <span className="sentiment-bar-label">{pt.minute}m</span>
                                              </div>
                                            );
                                          })}
                                        </div>
                                        <div className="sentiment-legend">
                                          <span className="legend-dot" style={{ background: "#22c55e" }} /> Positive
                                          <span className="legend-dot" style={{ background: "#f59e0b" }} /> Neutral
                                          <span className="legend-dot" style={{ background: "#ef4444" }} /> Negative
                                        </div>
                                      </div>
                                    )}

                                    {/* Customer insights */}
                                    {callSummary.customer_insights.length > 0 && (
                                      <div className="insight-section">
                                        <p className="insight-section-title">Customer Discussed</p>
                                        <ul className="insight-list">
                                          {callSummary.customer_insights.map((pt, i) => <li key={i} className="insight-item">{pt}</li>)}
                                        </ul>
                                      </div>
                                    )}

                                    {/* Rep insights */}
                                    {callSummary.rep_insights.length > 0 && (
                                      <div className="insight-section">
                                        <p className="insight-section-title">Agent Provided</p>
                                        <ul className="insight-list">
                                          {callSummary.rep_insights.map((pt, i) => <li key={i} className="insight-item">{pt}</li>)}
                                        </ul>
                                      </div>
                                    )}

                                    {/* Pending items */}
                                    {callSummary.pending_items.length > 0 && (
                                      <div className="insight-section insight-section-pending">
                                        <p className="insight-section-title">Not Yet Addressed</p>
                                        <ul className="insight-list">
                                          {callSummary.pending_items.map((pt, i) => <li key={i} className="insight-item pending-item">{pt}</li>)}
                                        </ul>
                                      </div>
                                    )}

                                    {callSummary.key_points.length > 0 && (
                                      <div className="summary-key-points">
                                        <p className="summary-kp-label">Key Points</p>
                                        <ul className="summary-kp-list">
                                          {callSummary.key_points.map((pt, i) => <li key={i} className="summary-kp-item">{pt}</li>)}
                                        </ul>
                                      </div>
                                    )}
                                  </>
                                )}
                              </div>
                            )}

                            {/* ── Agent Analysis tab ── */}
                            {customerPanelTab === "agent-analysis" && (
                              <div className="cust-tab-body">
                                {summaryLoading && !callSummary ? (
                                  <div className="summary-loading">Analysing agent performance...</div>
                                ) : !callSummary?.agent_attributes ? (
                                  <div className="summary-loading">No agent data yet — agent must join the call first.</div>
                                ) : (
                                  <div className="agent-analysis-section">
                                    <p className="insight-section-title" style={{ marginBottom: 10 }}>Agent Attributes Analysis</p>
                                    <table className="agent-attr-table">
                                      <thead>
                                        <tr>
                                          <th className="agent-attr-th">#</th>
                                          <th className="agent-attr-th">Attribute</th>
                                          <th className="agent-attr-th agent-attr-th-val">Value</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {Object.entries(callSummary.agent_attributes).map(([key, val], i) => {
                                          const label = key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
                                          const isNull = val === null || val === undefined;
                                          return (
                                            <tr key={key} className="agent-attr-row">
                                              <td className="agent-attr-idx">{i}</td>
                                              <td className="agent-attr-name">{label}</td>
                                              <td className="agent-attr-val">
                                                {isNull ? (
                                                  <span className="agent-attr-badge attr-null">N/A</span>
                                                ) : val ? (
                                                  <span className="agent-attr-badge attr-true">True</span>
                                                ) : (
                                                  <span className="agent-attr-badge attr-false">False</span>
                                                )}
                                              </td>
                                            </tr>
                                          );
                                        })}
                                      </tbody>
                                    </table>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* ── Recordings tab ── */}
                            {customerPanelTab === "recordings" && (
                              <div className="cust-tab-body">
                                {recordingsLoading && recordings.length === 0 ? (
                                  <div className="summary-loading">Checking for recordings...</div>
                                ) : recordings.length === 0 ? (
                                  <div className="recordings-empty">No recordings yet — starts when agent joins the call.</div>
                                ) : (
                                  <div className="recordings-list">
                                    {recordings.map((rec) => (
                                      <div key={rec.id} className={`recording-card recording-${rec.status}`}>
                                        <div className="recording-meta-row">
                                          <span className={`recording-status-badge rec-status-${rec.status}`}>
                                            {rec.status === "in-progress" ? "● Recording" : rec.status === "completed" ? "✓ Completed" : rec.status === "failed" ? "✗ Failed" : "Pending"}
                                          </span>
                                          <span className="recording-type-badge">{rec.call_type === "outbound" ? "Outbound" : "Inbound"}</span>
                                          {rec.duration_seconds != null && <span className="recording-duration">{formatDuration(rec.duration_seconds)}</span>}
                                        </div>
                                        <div className="recording-time-row">
                                          {rec.started_at && <span>Started: {new Date(rec.started_at).toLocaleTimeString()}</span>}
                                          {rec.ended_at   && <span>Ended: {new Date(rec.ended_at).toLocaleTimeString()}</span>}
                                        </div>
                                        {rec.status === "completed" && rec.recording_sid && (
                                          <audio className="recording-player" controls preload="none" src={`/api/recordings/${rec.recording_sid}/audio`} />
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="assist-empty">Select a call to see customer details.</div>
                        )}
                      </div>
                    )}

                    {/* ── AI Suggestions panel ── */}
                    {panelId === "suggestions" && (
                      <div className="split-panel-inner suggestions-panel">
                        {selectedCallData ? (
                          <>
                            <p className="eyebrow-dark">AI Suggestions <span className="suggestion-count">{suggestions.length}</span></p>
                            {suggestions.length === 0 ? (
                              <div className="analysis-empty">Waiting for customer to speak...</div>
                            ) : (
                              <div className="suggestions-list" ref={suggestionsListRef}>
                                {suggestions.map((s, i) => {
                                  const eCfg = EMOTION_CFG[s.emotion] ?? EMOTION_CFG.calm;
                                  const pCfg = PRIORITY_CFG[s.priority] ?? PRIORITY_CFG.low;
                                  const isGreeting = s.intent === "call_greeting";
                                  const isLatest   = i === suggestions.length - 1;
                                  return (
                                    <div key={s.id} className={`suggestion-card suggestion-animate${isGreeting ? " greeting-card" : ""}`}>
                                      {/* Header: index + time + emotion state */}
                                      <div className="suggestion-card-header">
                                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                          <span className="suggestion-num">#{i + 1}</span>
                                          <span className={`analysis-badge ${eCfg.cls}`} style={{ fontSize: "0.63rem", padding: "2px 8px" }}>{eCfg.label}</span>
                                          <span className={`analysis-badge ${pCfg.cls}`} style={{ fontSize: "0.63rem", padding: "2px 8px" }}>{pCfg.label}</span>
                                        </div>
                                        <span className="suggestion-time">{new Date(s.created_at).toLocaleTimeString()}</span>
                                      </div>

                                      {/* Suggested reply — shown for every card */}
                                      {s.suggested_reply ? (
                                        <div className="suggested-reply-card">
                                          <p className="reply-label">💬 {isGreeting ? "Opening Greeting" : "Suggested Reply"}</p>
                                          <p className="reply-text">{s.suggested_reply}</p>
                                        </div>
                                      ) : (Date.now() - new Date(s.created_at).getTime() > 30_000) ? (
                                        <div className="reply-pending reply-unavailable">Reply unavailable</div>
                                      ) : (
                                        <div className="reply-pending">Generating reply...</div>
                                      )}

                                      {/* Intent + actions — only for the most recent suggestion */}
                                      {isLatest && !isGreeting && (
                                        <>
                                          <div className="intent-row">
                                            <span className="intent-label">Intent</span>
                                            <span className="intent-value">{formatIntent(s.intent)}</span>
                                          </div>
                                          {s.suggested_actions.length > 0 && (
                                            <div className="suggested-actions">
                                              <p className="actions-label">Suggested Actions</p>
                                              <ul className="actions-list">
                                                {s.suggested_actions.map((a, j) => (
                                                  <li key={j} className="action-item">
                                                    <span className="action-num">{j + 1}</span>
                                                    <span>{a}</span>
                                                  </li>
                                                ))}
                                              </ul>
                                            </div>
                                          )}
                                        </>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="assist-empty">Select a call to see AI suggestions.</div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {idx < panelOrder.length - 1 && (
                  <div
                    className="resize-handle"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      panelResizeRef.current = { handleIdx: idx, startX: e.clientX, startWidths: [...panelWidths] };
                    }}
                  />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* ── Call History Tab ── */}
        <div className={`tab-view call-history-view${activeTab === "call-history" ? " active" : ""}`}>
          <div className="ch-header">
            <div>
              <p className="eyebrow">Agent Assist Platform</p>
              <h2 className="panel-title"><span className="live-dot" />Live Call Sessions</h2>
              <p className="subtle-copy">Real-time transcription, emotion, intent, and RAG suggestions.</p>
            </div>
            <div className={`softphone-bar-inline ${callStatus}`}>
              <span className={`status-dot status-dot-${callStatus}`} />
              <span>{softphoneStatusLabel[callStatus]}</span>
            </div>
          </div>

          <div className="call-metrics">
            <article className="metric-card">
              <span>Total Calls</span>
              <strong>{visibleCalls.length}</strong>
            </article>
            <article className="metric-card warm">
              <span>Turns</span>
              <strong>{messages.length}</strong>
            </article>
          </div>

          <div className="call-list">
            {visibleCalls.length === 0 && <div className="empty-state">No call records found yet.</div>}
            {visibleCalls.map((call) => {
              const name           = normalizeText(call.customer_name);
              const phone          = normalizeText(call.customer_phone);
              const tier           = normalizeText(call.tier);
              const dur            = formatDuration(call.duration_seconds);
              const plat           = tier?.toLowerCase() === "platinum";
              const high           = call.priority === "high";
              const isPrio         = plat || high;
              const isDisconnected = call.status === "disconnected";
              const isIvr          = call.status === "ivr";
              const category       = call.ivr_category;
              return (
                <button key={call.id}
                  onClick={() => { setSelectedCall(call.id); setActiveTab("dashboard"); }}
                  type="button"
                  className={`call-item${selectedCall === call.id ? " active" : ""}${isPrio ? " priority" : ""}${isDisconnected ? " disconnected" : ""}`}
                >
                  <div className="call-card-top">
                    <span className="call-id">Call {call.id.slice(0, 8)}</span>
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                      {plat && <span className="tier-badge platinum">Platinum</span>}
                      {high && <span className="tier-badge high-alert">High</span>}
                      {isIvr && <span className="tier-badge ivr-badge">In IVR</span>}
                    </div>
                  </div>
                  <div className="customer-block">
                    <strong className="customer-name">{name || `Call ${call.id.slice(0, 8)}`}</strong>
                    {phone && <span className="customer-phone">{phone}</span>}
                  </div>
                  <div className="call-card-meta">
                    <span className="call-time">{new Date(call.created_at).toLocaleString()}</span>
                    {tier     && <span className="call-tier">Tier: {tier}</span>}
                    {category && <span className="call-tier">{formatIntent(category)}</span>}
                    {dur      && <span className="call-duration">Duration: {dur}</span>}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Dialpad Tab ── */}
        <div className={`tab-view dialpad-view${activeTab === "dialpad" ? " active" : ""}`}>
          <div className="dialpad-wrap">
            <p className="eyebrow" style={{ textAlign: "center", marginBottom: 8 }}>Outbound Call</p>
            <div className="dialpad-display">
              <span className="dialpad-number">{dialpadNumber || <span className="dialpad-placeholder">Enter number</span>}</span>
              {dialpadNumber && dialpadStatus === "idle" && (
                <button className="dialpad-backspace" onClick={() => setDialpadNumber((p) => p.slice(0, -1))}>⌫</button>
              )}
            </div>
            {dialpadStatus !== "idle" && (
              <div className={`dialpad-status dialpad-status-${dialpadStatus}`}>
                {dialpadStatus === "calling" ? "Calling..." : `Connected · ${dialpadNumber}`}
              </div>
            )}
            <div className="dialpad-grid">
              {["1","2","3","4","5","6","7","8","9","*","0","#","+"].map((d) => (
                <button key={d} className="dialpad-key" onClick={() => dialpadPress(d)}>{d}</button>
              ))}
            </div>
            <div className="dialpad-actions">
              {dialpadStatus !== "connected" ? (
                <button className="dialpad-call-btn" onClick={handleDialpadCall}
                  disabled={!dialpadNumber.trim() || dialpadStatus === "calling"}>
                  {dialpadStatus === "calling" ? "Calling..." : "Call"}
                </button>
              ) : (
                <button className="dialpad-hangup-btn" onClick={handleDialpadHangup}>Hang Up</button>
              )}
            </div>
          </div>
        </div>

        {/* ── Knowledge Base Tab ── */}
        <div className={`tab-view kb-view${activeTab === "knowledge-base" ? " active" : ""}`}>
          <div className="kb-split">

            {/* Left: add entry */}
            <div className="kb-add-pane">
              <p className="eyebrow" style={{ color: "#87defe" }}>Add to Knowledge Base</p>
              <div className="kb-file-row">
                <label className="kb-file-label">
                  <span>📄 {kbFile ? kbFile.name : "Choose PDF, Word, or TXT"}</span>
                  <input ref={kbFileInputRef} type="file" accept=".pdf,.docx,.doc,.txt,.csv"
                    style={{ display: "none" }} onChange={(e) => setKbFile(e.target.files?.[0] || null)} />
                </label>
                <button type="button" className="kb-submit" onClick={handleKbFileUpload}
                  disabled={!kbFile || kbFileStatus === "uploading"}>
                  {kbFileStatus === "uploading" ? "Uploading..." : "Upload"}
                </button>
              </div>
              {kbFileMsg && <p className={`kb-file-msg ${kbFileStatus}`}>{kbFileMsg}</p>}
              <div className="kb-divider"><span>or paste text</span></div>
              <form onSubmit={handleKbSubmit} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <textarea className="kb-textarea" placeholder="Paste FAQs, policies, or product info..."
                  value={kbText} onChange={(e) => setKbText(e.target.value)} rows={5} />
                <input className="kb-source" placeholder="Source label (optional)"
                  value={kbSource} onChange={(e) => setKbSource(e.target.value)} />
                <button type="submit" className="kb-submit" disabled={kbStatus === "saving" || !kbText.trim()}>
                  {kbStatus === "saving" ? "Saving..." : kbStatus === "done" ? "Saved ✓" : kbStatus === "error" ? "Failed" : "Add Text"}
                </button>
              </form>
            </div>

            {/* Right: entries viewer */}
            <div className="kb-entries-pane">
              <div className="kb-view-header">
                <div>
                  <p className="eyebrow" style={{ color: "#87defe" }}>Stored Entries</p>
                  <h2 className="kb-view-title">{kbEntries.length} {kbEntries.length === 1 ? "entry" : "entries"}</h2>
                </div>
                <button type="button" className="kb-view-refresh" onClick={fetchKbEntries} disabled={kbEntriesLoading}>
                  {kbEntriesLoading ? "Loading..." : "Refresh"}
                </button>
              </div>
              <div className="kb-view-body">
                {kbEntriesLoading && kbEntries.length === 0 && <div className="kb-view-empty">Loading entries...</div>}
                {kbEntriesError && <div className="kb-view-empty" style={{ color: "#dc2626" }}>Error: {kbEntriesError}</div>}
                {!kbEntriesLoading && !kbEntriesError && kbEntries.length === 0 && (
                  <div className="kb-view-empty">No entries yet. Add some on the left.</div>
                )}
                {kbEntries.map((entry) => {
                  const skip = new Set(["id", "embedding"]);
                  const fields = Object.entries(entry).filter(([k, v]) => !skip.has(k) && !Array.isArray(v));
                  const createdAt = entry.created_at as string | undefined;
                  const source = (entry.source ?? entry.name ?? entry.filename ?? "") as string;
                  const textFields = fields.filter(([k]) => !["created_at", "source", "name", "filename"].includes(k));
                  const metaFields = fields.filter(([k]) => ["source", "name", "filename"].includes(k));
                  return (
                    <div key={entry.id} className="kb-entry-card">
                      <div className="kb-entry-top">
                        <span className="kb-entry-source">{source?.trim() || "No source"}</span>
                        {createdAt && <span className="kb-entry-date">{new Date(createdAt).toLocaleString()}</span>}
                      </div>
                      {textFields.map(([k, v]) => (
                        <div key={k} className="kb-entry-field">
                          <span className="kb-entry-field-key">{k}</span>
                          <p className="kb-entry-content">{String(v ?? "")}</p>
                        </div>
                      ))}
                      {metaFields.map(([k, v]) => (
                        <div key={k} className="kb-entry-field">
                          <span className="kb-entry-field-key">{k}</span>
                          <span className="kb-entry-date">{String(v ?? "")}</span>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* ── Analytics Tab ── */}
        <div className={`tab-view analytics-view${activeTab === "analytics" ? " active" : ""}`}>
          <div className="analytics-container">

            {/* Stat Cards */}
            <div className="analytics-stats-grid">
              <div className="analytics-stat-card">
                <span className="analytics-stat-label">Total Calls Handled</span>
                <strong className="analytics-stat-value">{totalCalls}</strong>
              </div>
              <div className="analytics-stat-card dropped">
                <span className="analytics-stat-label">Dropped Calls</span>
                <strong className="analytics-stat-value">{droppedCalls}</strong>
                {totalCalls > 0 && <span className="analytics-stat-pct">{Math.round(droppedCalls / totalCalls * 100)}% of total</span>}
              </div>
              <div className="analytics-stat-card ivr">
                <span className="analytics-stat-label">IVR Routed</span>
                <strong className="analytics-stat-value">{ivrCalls}</strong>
                {totalCalls > 0 && <span className="analytics-stat-pct">{ivrPct}% of total</span>}
              </div>
              <div className="analytics-stat-card warn">
                <span className="analytics-stat-label">Dropped in IVR</span>
                <strong className="analytics-stat-value">{droppedInIvr}</strong>
                {totalCalls > 0 && <span className="analytics-stat-pct">{Math.round(droppedInIvr / totalCalls * 100)}% of total</span>}
              </div>
              <div className="analytics-stat-card waiting">
                <span className="analytics-stat-label">Waiting in Queue</span>
                <strong className="analytics-stat-value">{visibleCalls.filter((c) => c.status === "waiting").length}</strong>
              </div>
            </div>

            {/* Charts Row */}
            <div className="analytics-charts-row">

              {/* IVR Category Bar Chart */}
              <div className="analytics-card">
                <h3 className="analytics-card-title">Calls by IVR Category</h3>
                {Object.keys(ivrCategoryCounts).length === 0 ? (
                  <div className="analytics-empty">No IVR category data yet.</div>
                ) : (
                  <div className="analytics-bars">
                    {Object.entries(ivrCategoryCounts).map(([cat, count]) => (
                      <div key={cat} className="analytics-bar-row">
                        <span className="analytics-bar-label">{IVR_CATEGORY_CFG[cat]?.label || cat}</span>
                        <div className="analytics-bar-track">
                          <div className="analytics-bar-fill" style={{ width: `${Math.round((count / maxCategoryCount) * 100)}%` }} />
                        </div>
                        <span className="analytics-bar-count">{count}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Call Status Breakdown */}
              <div className="analytics-card">
                <h3 className="analytics-card-title">Call Status Breakdown</h3>
                {totalCalls === 0 ? (
                  <div className="analytics-empty">No call data yet.</div>
                ) : (
                  <div className="analytics-bars">
                    {[
                      { label: "Active",       count: visibleCalls.filter((c) => c.status === "active").length,       cls: "active-bar"  },
                      { label: "Disconnected", count: visibleCalls.filter((c) => c.status === "disconnected").length, cls: "dropped-bar" },
                      { label: "In IVR",       count: visibleCalls.filter((c) => c.status === "ivr").length,          cls: "ivr-bar"     },
                      { label: "Waiting",      count: visibleCalls.filter((c) => c.status === "waiting").length,      cls: "waiting-bar"  },
                    ].map(({ label, count, cls }) => (
                      <div key={label} className="analytics-bar-row">
                        <span className="analytics-bar-label">{label}</span>
                        <div className="analytics-bar-track">
                          <div className={`analytics-bar-fill ${cls}`} style={{ width: `${Math.round((count / totalCalls) * 100)}%` }} />
                        </div>
                        <span className="analytics-bar-count">{count}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          </div>
        </div>

        {/* ── Profile Tab ── */}
        <div className={`tab-view profile-view${activeTab === "profile" ? " active" : ""}`}>
          <div className="profile-container">
            <div className="profile-card">

              <div className="profile-avatar">
                <span className="profile-avatar-initials">
                  {(agentProfile?.name || agentName || "A")
                    .split(" ").slice(0, 2).map((w) => w[0]?.toUpperCase()).join("")}
                </span>
              </div>

              <h2 className="profile-name">{agentProfile?.name || agentName || "Agent"}</h2>
              <p className="profile-email-sub">{agentProfile?.email || ""}</p>

              {agentProfile?.department && (
                <span className="profile-dept-badge">{agentProfile.department}</span>
              )}

              <div className="profile-divider" />

              <div className="profile-details">
                {([
                  { label: "Agent ID",       value: agentProfile?.agent_id    || "—" },
                  { label: "Email",          value: agentProfile?.email        || "—" },
                  { label: "Department",     value: agentProfile?.department   || "—" },
                  {
                    label: "Member Since",
                    value: agentProfile?.created_at
                      ? new Date(agentProfile.created_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
                      : "—",
                  },
                  {
                    label: "Account Status",
                    value: agentProfile?.is_verified ? "Verified" : "Pending Verification",
                    verified: agentProfile?.is_verified,
                  },
                ] as { label: string; value: string; verified?: boolean }[]).map(({ label, value, verified }) => (
                  <div key={label} className="profile-detail-row">
                    <span className="profile-detail-label">{label}</span>
                    <span className={`profile-detail-value${verified ? " profile-verified" : ""}`}>
                      {verified && <span className="profile-status-dot" />}
                      {value}
                    </span>
                  </div>
                ))}
              </div>

              <div className="profile-divider" />

              <button className="profile-signout-btn" onClick={handleLogout}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                  <polyline points="16 17 21 12 16 7"/>
                  <line x1="21" y1="12" x2="9" y2="12"/>
                </svg>
                Sign Out
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
