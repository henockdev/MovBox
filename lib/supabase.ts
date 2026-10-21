/**
 * Supabase clients (server + browser).
 *
 * Server: uses service-role key (NEVER expose to client) for admin operations.
 * Browser: uses anon key, restricted by RLS policies we'll define later.
 *
 * Set SUPABASE_URL + SUPABASE_ANON_KEY (and SUPABASE_SERVICE_ROLE_KEY for
 * server-side admin) in .env.local.
 *
 * NOTE: Auth is intentionally minimal in this initial scaffold — the
 * "Login / Sign Up / Pricing" pages are visual placeholders per the
 * design. We wire real auth in the next phase (see docs/PLAN.md).
 */

import { createBrowserClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

/** Browser client (uses anon key, RLS-enforced) */
export function getSupabaseBrowser() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error(
      "Supabase env vars missing. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY."
    );
  }
  return createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

/** Server admin client (uses service role key, bypasses RLS) */
export function getSupabaseAdmin() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "Supabase admin env vars missing. Set SUPABASE_SERVICE_ROLE_KEY."
    );
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
