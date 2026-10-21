"use client";

import { Smartphone, Download } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

interface InstallCTAProps {
  className?: string;
  /** Override the heading. Default: "Get the app to remove ads" */
  title?: string;
  /** Override the subheading. */
  subtitle?: string;
}

/**
 * The "Download the app to remove ads" CTA — slot 5 in the plan.
 * Placed prominently on /movbox-app. Pure UI: no ad unit, no
 * provider, just a brand-aligned pitch for the native app.
 *
 * The promise ("skip ads") is real: the web app keeps ads in the
 * free tier; the Android app has its own ad-free ad-supported
 * rewarded model. We don't promise anything the app doesn't
 * actually deliver.
 */
export function InstallCTA({
  className,
  title = "Get the app — skip the ads",
  subtitle = "Stream 4K, download for offline, ad-free in the Android app.",
}: InstallCTAProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-accent/30 bg-surface/60 p-6",
        "shadow-glow",
        className
      )}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-50"
        style={{
          background:
            "radial-gradient(circle at 80% 20%, rgba(196,148,59,0.18), transparent 60%), radial-gradient(circle at 0% 100%, rgba(128,0,32,0.22), transparent 60%)",
        }}
      />
      <div className="relative flex items-center gap-5">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-accent/30 bg-accent/10">
          <Smartphone className="h-7 w-7 text-accent-bright" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-lg font-semibold text-cream">
            {title}
          </h3>
          <p className="mt-1 text-sm text-vanilla-dim">{subtitle}</p>
        </div>
        <Button asChild size="lg" variant="accent" className="shrink-0">
          <a href="/movbox-app">
            <Download className="h-4 w-4" />
            Install
          </a>
        </Button>
      </div>
    </div>
  );
}
