import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/layout/Logo";
import { Film, Tv, Heart, Star } from "lucide-react";

interface AuthLayoutProps {
  children: React.ReactNode;
  side: "login" | "signup";
}

const COPY = {
  login: {
    title: "Welcome back",
    subtitle: "Sign in to continue watching.",
    quote: "Your next favorite movie is one click away.",
  },
  signup: {
    title: "Join Movbox",
    subtitle: "Create your free account to get started.",
    quote: "Unlimited movies, TV shows, and more.",
  },
} as const;

export function AuthLayout({ children, side }: AuthLayoutProps) {
  const copy = COPY[side];
  return (
    <div className="min-h-dvh bg-bg-deepest">
      <div className="grid min-h-dvh grid-cols-1 lg:grid-cols-2">
        {/* Form column */}
        <div className="flex items-center justify-center px-6 py-12 md:px-12">
          <div className="w-full max-w-md">
            <Link href="/" className="mb-8 inline-block">
              <Logo />
            </Link>
            <h1 className="font-display text-3xl font-bold text-cream">
              {copy.title}
            </h1>
            <p className="mt-2 text-sm text-text-secondary">{copy.subtitle}</p>
            <div className="mt-8">{children}</div>
          </div>
        </div>

        {/* Decorative column (desktop only) */}
        <div className="relative hidden overflow-hidden bg-bg-primary lg:block">
          {/* Layered radial + cinematic overlay */}
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse at 30% 20%, rgba(128, 0, 32, 0.5) 0%, transparent 60%), radial-gradient(ellipse at 70% 80%, rgba(164, 46, 74, 0.4) 0%, transparent 60%), linear-gradient(135deg, #0d0909 0%, #140d0e 100%)",
            }}
          />
          <div className="absolute inset-0 gradient-radial-glow opacity-50" />

          {/* Floating tag pills */}
          <div className="absolute right-12 top-12 flex flex-col items-end gap-2">
            <span className="flex items-center gap-2 rounded-full border border-accent/30 bg-surface/60 px-3 py-1.5 text-xs font-medium text-cream backdrop-blur">
              <Film className="h-3.5 w-3.5 text-accent-bright" />
              10,000+ movies
            </span>
            <span className="flex items-center gap-2 rounded-full border border-accent/30 bg-surface/60 px-3 py-1.5 text-xs font-medium text-cream backdrop-blur">
              <Tv className="h-3.5 w-3.5 text-accent-bright" />
              5,000+ TV shows
            </span>
            <span className="flex items-center gap-2 rounded-full border border-accent/30 bg-surface/60 px-3 py-1.5 text-xs font-medium text-cream backdrop-blur">
              <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
              4K Ultra HD
            </span>
            <span className="flex items-center gap-2 rounded-full border border-accent/30 bg-surface/60 px-3 py-1.5 text-xs font-medium text-cream backdrop-blur">
              <Heart className="h-3.5 w-3.5 text-accent-bright" />
              Save your list
            </span>
          </div>

          {/* Quote */}
          <div className="absolute inset-x-12 bottom-12">
            <p className="font-display text-2xl font-medium leading-snug text-cream md:text-3xl">
              &ldquo;{copy.quote}&rdquo;
            </p>
            <p className="mt-3 text-xs text-text-muted">— Movbox</p>
          </div>
        </div>
      </div>
    </div>
  );
}
