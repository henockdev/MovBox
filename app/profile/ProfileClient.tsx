"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, Mail, Calendar, Settings, Bell } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface ProfileUser {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  createdAt: string;
}

interface ProfileClientProps {
  user: ProfileUser;
}

export function ProfileClient({ user }: ProfileClientProps) {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  async function signOut() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      const r = await fetch("/api/auth/signout", { method: "POST" });
      if (r.redirected) {
        window.location.href = r.url;
        return;
      }
      // Some paths don't 303-redirect on the client fetch — fall back
      // to a hard reload of the home page.
      window.location.href = "/";
    } catch {
      setSigningOut(false);
    }
  }

  const initials = (user.name || user.email)
    .split(/[\s@.]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <div className="mx-auto max-w-4xl px-4 pb-16 pt-24 md:px-6 lg:px-8">
      {/* Header card */}
      <div className="overflow-hidden rounded-2xl border border-border bg-surface/60 p-6 md:p-8">
        <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center">
          {user.avatarUrl ? (
            <Image
              src={user.avatarUrl}
              alt={user.name}
              width={96}
              height={96}
              className="h-20 w-20 rounded-full object-cover md:h-24 md:w-24"
            />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-accent text-3xl font-bold text-bg-deepest md:h-24 md:w-24">
              {initials || "M"}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-2xl font-bold text-cream md:text-3xl">
              {user.name}
            </h1>
            <p className="mt-1 flex items-center gap-2 text-sm text-text-secondary">
              <Mail className="h-3.5 w-3.5" />
              {user.email}
            </p>
            <p className="mt-1 flex items-center gap-2 text-xs text-text-muted">
              <Calendar className="h-3.5 w-3.5" />
              Member since {new Date(user.createdAt).toLocaleDateString()}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={signOut}
            disabled={signingOut}
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </Button>
        </div>
      </div>

      {/* Account settings — intentionally minimal in v1 */}
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <Link
          href="/movbox-app"
          className="group flex items-center gap-3 rounded-2xl border border-border bg-surface/40 p-4 transition-colors hover:border-accent"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10">
            <Bell className="h-5 w-5 text-accent-bright" />
          </div>
          <div>
            <p className="font-medium text-cream">Get the Movbox app</p>
            <p className="text-xs text-text-muted">
              Stream 4K + download offline on Android.
            </p>
          </div>
        </Link>
        <button
          type="button"
          className="group flex items-center gap-3 rounded-2xl border border-border bg-surface/40 p-4 text-left transition-colors hover:border-accent"
          onClick={() => router.push("/watchlist")}
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10">
            <Settings className="h-5 w-5 text-accent-bright" />
          </div>
          <div>
            <p className="font-medium text-cream">My list</p>
            <p className="text-xs text-text-muted">
              Movies and shows you've saved to watch later.
            </p>
          </div>
        </button>
      </div>

      {/* Sign-out button at the bottom too — for accessibility */}
      <div className="mt-10 flex justify-center">
        <Button
          variant="ghost"
          size="sm"
          onClick={signOut}
          disabled={signingOut}
          className="text-text-muted hover:text-red-400"
        >
          <LogOut className="h-4 w-4" />
          {signingOut ? "Signing out…" : "Sign out of Movbox"}
        </Button>
      </div>
    </div>
  );
}
