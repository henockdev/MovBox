import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * POST /api/ads/impression
 *
 * Logs an ad impression. Used to enforce the per-user cap across
 * devices. Best-effort: if Supabase isn't configured (env not set,
 * key missing, etc.), we just return 200 and silently no-op — the
 * client-side localStorage cap still works.
 *
 * Callers: any ad placement component that needs a cross-device cap.
 * Network-agnostic — it records a slot name, not a provider.
 *
 * Body: { slot: string, sessionId?: string }
 * Returns: { ok, count, capped } where count = this user's
 * impressions in the last 30 min, capped = whether we should show
 * more ads to this user.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WINDOW_MS = 30 * 60 * 1000;
const HARD_CAP = 3;

export async function POST(req: NextRequest) {
  let body: { slot?: string; sessionId?: string } = {};
  try {
    body = await req.json();
  } catch {
    // ignore — body is optional
  }
  const slot = (body.slot ?? "unknown").toString().slice(0, 32);
  const sessionId =
    body.sessionId?.toString().slice(0, 64) ??
    req.headers.get("x-session-id") ??
    "anon";

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    // Supabase not configured — pretend success so the client-side
    // cap takes over.
    return NextResponse.json({ ok: true, count: 0, capped: false, serverless: true });
  }

  try {
    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    // Best-effort user id from the request's auth cookie (if any).
    // The /api/auth routes set the Supabase session cookie; we
    // read it but don't require it — anon users are tracked by
    // session id.
    const authHeader = req.headers.get("authorization") || "";
    let userId: string | null = null;
    if (authHeader.startsWith("Bearer ")) {
      const { data: userData } = await supabase.auth.getUser(
        authHeader.slice(7)
      );
      userId = userData?.user?.id ?? null;
    }
    const cutoff = new Date(Date.now() - WINDOW_MS).toISOString();
    // Insert new impression.
    const insert = supabase.from("ad_impressions").insert({
      user_id: userId,
      session_id: sessionId,
      slot,
    });
    // Count impressions in the window.
    const countQ = supabase
      .from("ad_impressions")
      .select("id", { count: "exact", head: true })
      .gt("created_at", cutoff)
      .eq("session_id", sessionId);
    const [, countRes] = await Promise.all([insert, countQ]);
    const count = (countRes.count as number | null) ?? 0;
    return NextResponse.json({
      ok: true,
      count,
      capped: count >= HARD_CAP,
    });
  } catch (e) {
    // Server error — don't block the user, just succeed.
    return NextResponse.json({
      ok: true,
      count: 0,
      capped: false,
      error: e instanceof Error ? e.message : "unknown",
    });
  }
}
