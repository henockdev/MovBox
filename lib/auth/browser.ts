/**
 * Browser-only Supabase client. Safe to import from any client
 * component, hook, or browser script — does NOT pull in
 * `next/headers` (which is server-only).
 *
 * Use this in:
 *   - client components (any "use client" file)
 *   - event handlers / effects
 *   - the browser console
 *
 * For server-side rendering / route handlers, import
 * `createServerSupabase` from `@/lib/auth/server` instead.
 */
import { createBrowserClient } from "@supabase/ssr";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export function createBrowserSupabase() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error("Supabase env vars missing at build time");
  }
  return createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}
