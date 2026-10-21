import type { Metadata } from "next";
import Link from "next/link";
import { Home, Search, Compass } from "lucide-react";
import { Button } from "@/components/ui/Button";

export const metadata: Metadata = {
  title: "404 — Page Not Found",
  description: "The page you're looking for doesn't exist.",
};

export default function NotFound() {
  return (
    <div className="relative isolate -mt-16 flex min-h-[calc(100vh-0px)] flex-col items-center justify-center overflow-hidden">
      {/* Full-bleed popcorn / film-reel background */}
      <div
        className="pointer-events-none absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage: "url(/illustrations/popcorn-404-desktop.png)",
        }}
        aria-hidden="true"
      />
      {/* Burgundy wash so the foreground reads */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(to right, rgba(8,6,6,0.92) 0%, rgba(20,13,14,0.78) 35%, rgba(20,13,14,0.55) 65%, rgba(8,6,6,0.45) 100%), radial-gradient(ellipse at 50% 55%, transparent 0%, rgba(8,6,6,0.4) 70%, rgba(8,6,6,0.85) 100%)",
        }}
        aria-hidden="true"
      />

      <div className="relative z-10 flex w-full max-w-xl flex-col items-center px-6 text-center">
        <p className="font-display text-xs uppercase tracking-[0.6em] text-accent-bright/80">
          Scene not found
        </p>
        <h1
          className="mt-3 font-display text-6xl font-bold leading-none tracking-[0.08em] text-cream sm:text-7xl md:text-8xl"
          style={{
            textShadow:
              "0 0 40px rgba(164,46,74,0.45), 0 4px 24px rgba(0,0,0,0.6)",
          }}
        >
          404
        </h1>
        <p className="mt-3 max-w-md text-sm text-text-secondary sm:text-base">
          Looks like this scene got cut from the final reel. Let&apos;s roll the
          cameras somewhere else.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button asChild>
            <Link href="/">
              <Home className="h-4 w-4" /> Back Home
            </Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href="/movies">
              <Compass className="h-4 w-4" /> Browse Movies
            </Link>
          </Button>
          <Button asChild variant="ghost">
            <Link href="/search">
              <Search className="h-4 w-4" /> Search
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
