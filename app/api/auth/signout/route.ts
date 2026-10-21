import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/auth/server";

/** POST /api/auth/signout — clears the Supabase session and redirects to /. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const supabase = await createServerSupabase();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/", "http://placeholder"), 303);
}
