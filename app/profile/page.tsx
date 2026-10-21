import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/auth/server";
import { ProfileClient } from "./ProfileClient";

export const revalidate = 0; // always fresh

export const metadata: Metadata = {
  title: "Profile — Movbox",
  description: "Your Movbox account and watch history.",
};

export default async function ProfilePage() {
  let user: {
    id: string;
    email?: string | null;
    user_metadata?: Record<string, unknown> | null;
    created_at: string;
  } | null = null;
  try {
    const supabase = await createServerSupabase();
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch (err) {
    // If Supabase is misconfigured (missing env, project paused, etc.)
    // we don't want the whole page to crash with a 500. Treat it as
    // an unauthenticated state and bounce to /login.
    if (process.env.NODE_ENV !== "production") {
      console.error("[profile] Supabase getUser() failed:", err);
    }
  }

  if (!user) {
    // Not signed in (or Supabase unavailable) → bounce to /login?next=/profile
    redirect("/login?next=/profile");
  }

  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const email = user.email ?? "";

  return (
    <ProfileClient
      user={{
        id: user.id,
        email,
        name:
          (typeof meta.full_name === "string" ? meta.full_name : null) ??
          email.split("@")[0] ??
          "Movbox user",
        avatarUrl: typeof meta.avatar_url === "string" ? meta.avatar_url : null,
        createdAt: user.created_at,
      }}
    />
  );
}
