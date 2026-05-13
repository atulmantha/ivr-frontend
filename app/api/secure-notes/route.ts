import { NextRequest, NextResponse } from "next/server";

const resolveBackendBaseUrl = () => {
  const explicitBase =
    process.env.BACKEND_BASE_URL || process.env.NEXT_PUBLIC_BACKEND_BASE_URL;
  if (explicitBase) return explicitBase.replace(/\/+$/, "");
  const uploadUrl = process.env.BACKEND_UPLOAD_URL;
  if (uploadUrl) {
    try { return new URL(uploadUrl).origin; } catch { return null; }
  }
  return null;
};

export async function GET(request: NextRequest) {
  const callId = request.nextUrl.searchParams.get("call_id")?.trim();
  if (!callId) {
    return NextResponse.json({ error: "call_id is required." }, { status: 400 });
  }

  const backendBase = resolveBackendBaseUrl();
  if (!backendBase) {
    return NextResponse.json({ error: "Backend URL is not configured." }, { status: 500 });
  }

  const targetUrl = new URL(`${backendBase}/api/secure-notes`);
  targetUrl.searchParams.set("call_id", callId);

  try {
    const authHeader = request.headers.get("authorization");
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (authHeader) headers["Authorization"] = authHeader;

    const response = await fetch(targetUrl.toString(), { cache: "no-store", headers });
    let payload: unknown = {};
    try { payload = await response.json(); } catch { payload = {}; }
    return NextResponse.json(payload, { status: response.status });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to reach backend.";
    console.error("[secure-notes GET] Backend unreachable:", message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

export async function POST(request: NextRequest) {
  const backendBase = resolveBackendBaseUrl();
  if (!backendBase) {
    return NextResponse.json({ error: "Backend URL is not configured." }, { status: 500 });
  }

  let body: unknown = {};
  try { body = await request.json(); } catch { body = {}; }

  const { call_id, raw_note } = body as Record<string, unknown>;
  if (!call_id) {
    return NextResponse.json({ error: "call_id is required." }, { status: 400 });
  }
  if (!raw_note || String(raw_note).trim() === "") {
    return NextResponse.json({ error: "Note text cannot be empty." }, { status: 400 });
  }

  try {
    const authHeader = request.headers.get("authorization");
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (authHeader) headers["Authorization"] = authHeader;

    const response = await fetch(`${backendBase}/api/secure-notes`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    let payload: unknown = {};
    try { payload = await response.json(); } catch { payload = {}; }

    if (!response.ok) {
      console.error(`[secure-notes POST] Backend returned ${response.status}:`, payload);
    }

    return NextResponse.json(payload, { status: response.status });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to reach backend.";
    console.error("[secure-notes POST] Backend unreachable:", message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
