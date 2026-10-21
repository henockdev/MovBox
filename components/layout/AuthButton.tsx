"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/Button";
import { createBrowserSupabase } from "@/lib/auth/browser";

/**
 * Top-right auth control. Shows the user's avatar + name when
 * signed in (linking to /profile), or a "Sign In" button when
 * not. Listens to supabase auth state changes so the UI updates
 * instantly on signin / signout without a page refresh.
 */
export function AuthButton() {
  const [user, setUser] = useState<{
    email: string;
    name: string;
    avatarUrl: string | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let subscription: { unsubscribe: () => void } | null = null;

    async function load() {
      try {
        const supabase = createBrowserSupabase();
        const {
          data: { user: u },
        } = await supabase.auth.getUser();
        if (cancelled) return;
        if (!u) {
          setUser(null);
          return;
        }
        const meta = (u.user_metadata ?? {}) as Record<string, unknown>;
        const email = u.email ?? "";
        const name =
          (typeof meta.full_name === "string" && meta.full_name) ||
          (typeof meta.name === "string" && meta.name) ||
          email.split("@")[0] ||
          "Movbox user";
        const avatarUrl =
          typeof meta.avatar_url === "string"
            ? meta.avatar_url
            : typeof meta.picture === "string"
            ? meta.picture
            : null;
        setUser({ email, name, avatarUrl });
      } catch {
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    // Subscribe to auth changes so the header updates the
    // instant the user signs in or out (no refresh needed).
    try {
      const supabase = createBrowserSupabase();
      const { data } = supabase.auth.onAuthStateChange((_event, session) => {
        if (session?.user) {
          const meta = (session.user.user_metadata ?? {}) as Record<
            string,
            unknown
          >;
          const email = session.user.email ?? "";
          const name =
            (typeof meta.full_name === "string" && meta.full_name) ||
            (typeof meta.name === "string" && meta.name) ||
            email.split("@")[0] ||
            "Movbox user";
          const avatarUrl =
            typeof meta.avatar_url === "string"
              ? meta.avatar_url
              : typeof meta.picture === "string"
              ? meta.picture
              : null;
          setUser({ email, name, avatarUrl });
        } else {
          setUser(null);
        }
      });
      subscription = data.subscription;
    } catch {
      /* not signed in */
    }

    return () => {
      cancelled = true;
      subscription?.unsubscribe();
    };
  }, []);

  // While loading, render nothing (avoid flashing the Sign In
  // button for users who are actually signed in).
  if (loading) {
    return <div className="hidden h-9 w-9 md:inline-block md:h-10 md:w-10" />;
  }

  if (user) {
    // Signed in: show the avatar (or initials) linking to /profile.
    const initials = user.name
      .split(/[\s@.]/)
      .filter(Boolean)
      .slice(0, 2)
      .map((s) => s[0]?.toUpperCase() ?? "")
      .join("");
    return (
      <Link
        href="/profile"
        aria-label={`Account: ${user.name}`}
        title={user.name}
        className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-border bg-surface-elevated/80 text-text-secondary transition-colors hover:border-accent hover:text-accent-bright md:h-10 md:w-10"
      >
        {user.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.avatarUrl}
            alt={user.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="text-xs font-bold text-accent-bright md:text-sm">
            {initials || "M"}
          </span>
        )}
      </Link>
    );
  }

  // Anonymous: show the Sign In button.
  return (
    <Link
      href="/login"
      aria-label="Sign in"
      className="hidden md:inline-flex"
    >
      <Button variant="primary" size="sm">
        Sign In
      </Button>
    </Link>
  );
}
