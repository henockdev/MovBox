import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * POST /api/waitlist
 *
 * Adds an email to the launch-notification waitlist. Body: form-urlencoded
 * `email=foo@bar.com&source=movbox-app` (so the static <form> on
 * /movbox-app can post to it without JS).
 *
 * Best-effort: if Supabase isn't configured, we still return 200 so
 * the user sees a success message — the email just isn't persisted
 * anywhere. (For dev without env vars, fine. For production, set
 * the env vars.)
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function POST(req: NextRequest) {
  const contentType = req.headers.get("content-type") || "";

  let email = "";
  let source = "unknown";
  if (contentType.includes("application/x-www-form-urlencoded")) {
    const form = await req.formData();
    email = String(form.get("email") ?? "").trim().toLowerCase();
    source = String(form.get("source") ?? "unknown").slice(0, 32);
  } else if (contentType.includes("application/json")) {
    try {
      const body = await req.json();
      email = String(body.email ?? "").trim().toLowerCase();
      source = String(body.source ?? "unknown").slice(0, 32);
    } catch {
      /* ignore */
    }
  }

  // Always return 200 to the user — even if their email is bad, we don't
  // expose backend state. Use the JSON response so the client can show
  // the right message.
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json(
      { ok: false, error: "Please enter a valid email." },
      { status: 200, headers: { "content-type": "application/json" } }
    );
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    // No Supabase configured — pretend success so the UI flow still works.
    return NextResponse.json({ ok: true, saved: false });
  }

  try {
    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const userAgent = req.headers.get("user-agent")?.slice(0, 200) ?? null;
    const { error } = await supabase
      .from("email_subscribers")
      .insert({ email, source, user_agent: userAgent });
    if (error) {
      // unique violation = email already on the list, that's fine
      if (error.code === "23505") {
        return NextResponse.json({ ok: true, already: true });
      }
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 200, headers: { "content-type": "application/json" } }
      );
    }
    return NextResponse.json({ ok: true, saved: true });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Unknown error" },
      { status: 200, headers: { "content-type": "application/json" } }
    );
  }
}
