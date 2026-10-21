/**
 * Server-side Supabase client. Reads/writes the user's session
 * cookies via Next.js `cookies()`. Use only from:
 *   - server components
 *   - route handlers
 *   - server actions
 *
 * NEVER import this from a "use client" file. For the browser,
 * import `createBrowserSupabase` from `@/lib/auth/browser`.
 */
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export async function createServerSupabase() {
  const cookieStore = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(toSet) {
        try {
          toSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options as CookieOptions)
          );
        } catch {
          // setAll is called from Server Components where cookies()
          // is read-only. Ignore — middleware will refresh.
        }
      },
    },
  });
}
