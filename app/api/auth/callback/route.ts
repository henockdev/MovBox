import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/auth/server";

/**
 * GET /api/auth/callback
 *
 * OAuth callback endpoint. Supabase Google OAuth redirects here with
 * a `code` query param after the user consents. We exchange the code
 * for a session cookie, then redirect to the home page.
 *
 * If the exchange fails (expired code, denied, etc.) we land on
 * /login with an `?error=...` param so the login form can show a
 * message.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/";
  const errorParam = url.searchParams.get("error_description");

  if (errorParam) {
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(errorParam)}`, req.url)
    );
  }

  if (!code) {
    return NextResponse.redirect(
      new URL("/login?error=missing_code", req.url)
    );
  }

  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(error.message)}`, req.url)
    );
  }
  return NextResponse.redirect(new URL(next, req.url));
}
