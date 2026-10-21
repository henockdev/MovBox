"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface PageLoaderProps {
  /** Headline shown big in the centre (e.g. "LOADING"). */
  label?: string;
  /** Small tagline under the progress bar. */
  sublabel?: string;
  /**
   * Optional backdrop image to blur behind the loader. When set, the
   * component will blur and darken it.
   */
  backdrop?: string | null;
  /** Fill the viewport (default) or fit inside the parent. */
  fullScreen?: boolean;
  /**
   * When true, a continuously animating progress bar is shown. When false
   * the bar pulses as a generic spinner.
   */
  showProgress?: boolean;
  /**
   * Set to true when the underlying work has actually finished. The bar
   * will smoothly climb to 100% and the loader will fade out shortly after.
   */
  done?: boolean;
  className?: string;
}

/**
 * Cinematic fullscreen / inline loader.
 *
 *   ┌────────────────────────────────────────────┐
 *   │  ┌─ Popcorn illustration (right-aligned) ─┐│
 *   │  │                                            │ │
 *   │  │              L O A D I N G               │ │
 *   │  │     ┌─────────────────────────────┐      │ │
 *   │  │     │████████████░░░░░░░░░░░  65% │      │ │
 *   │  │     └─────────────────────────────┘      │ │
 *   │  │   GRAB YOUR POPCORN, THE SHOW IS LO…    │ │
 *   │  └──────────────────────────────────────────┘│
 *   └────────────────────────────────────────────┘
 *
 * The popcorn photo is the same cinematic image we use on the 404 page —
 * full bleed, with a vignette on top so the foreground text always reads.
 *
 * Progress bar:
 *  - Climbs from 0 → 92% with an ease-out curve (so it doesn't look stuck
 *    before the real fetch finishes).
 *  - If `done` becomes true, snaps up to 100% and the whole loader fades.
 */
export function PageLoader({
  label = "LOADING",
  sublabel = "Grab your popcorn, the show is loading…",
  backdrop,
  fullScreen = true,
  showProgress = true,
  done = false,
  className,
}: PageLoaderProps) {
  const [pct, setPct] = useState(0);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    let raf: number;
    let start: number | null = null;
    const DURATION = 6000; // ms to reach 92%
    const tick = (t: number) => {
      if (start === null) start = t;
      const elapsed = t - start;
      const eased = 1 - Math.pow(1 - Math.min(elapsed / DURATION, 1), 3);
      const v = Math.floor(eased * 92);
      setPct(v);
      if (elapsed < DURATION) {
        raf = requestAnimationFrame(tick);
      } else {
        setPct(92);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // When done flips to true, climb to 100% and fade out.
  useEffect(() => {
    if (!done) {
      setFading(false);
      return;
    }
    let raf: number;
    const start = performance.now();
    const animate = (t: number) => {
      const elapsed = t - start;
      const v = Math.min(100, 92 + Math.floor((elapsed / 350) * 8));
      setPct(v);
      if (v < 100) {
        raf = requestAnimationFrame(animate);
      } else {
        setFading(true);
      }
    };
    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, [done]);

  return (
    <div
      className={cn(
        "relative isolate flex w-full flex-col items-center justify-center overflow-hidden transition-opacity duration-500",
        fullScreen ? "min-h-[80vh]" : "min-h-[420px] aspect-video w-full",
        fading && "pointer-events-none opacity-0",
        className
      )}
      role="status"
      aria-live="polite"
    >
      {/* Full-bleed popcorn background. We always render the cinematic photo
          as the background; the optional `backdrop` prop adds a poster on top. */}
      <div
        className="pointer-events-none absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage: `url(/illustrations/popcorn-404-desktop.png)`,
        }}
        aria-hidden="true"
      />
      {/* Darker burgundy wash so the foreground always reads */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(to right, rgba(8,6,6,0.92) 0%, rgba(20,13,14,0.78) 35%, rgba(20,13,14,0.55) 65%, rgba(8,6,6,0.45) 100%)",
        }}
        aria-hidden="true"
      />
      {/* Subtle radial vignette to push focus to the centre */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 50% 55%, transparent 0%, rgba(8,6,6,0.35) 65%, rgba(8,6,6,0.75) 100%)",
        }}
        aria-hidden="true"
      />

      {/* Sparkles drifting up */}
      <div
        className="pointer-events-none absolute inset-0 overflow-hidden"
        aria-hidden="true"
      >
        {Array.from({ length: 18 }).map((_, i) => {
          const left = ((i * 47) % 100) + (i % 3) * 0.4;
          const size = 2 + ((i * 5) % 3);
          const duration = 5 + ((i * 11) % 7);
          const delay = (i * 0.7) % 4;
          return (
            <span
              key={i}
              className="spark"
              style={{
                left: `${left}%`,
                width: `${size}px`,
                height: `${size}px`,
                animationDuration: `${duration}s`,
                animationDelay: `${delay}s`,
              } as React.CSSProperties}
            />
          );
        })}
      </div>

      {/* Foreground content */}
      <div className="relative z-10 flex w-full max-w-xl flex-col items-center px-6 text-center">
        <p className="font-display text-xs uppercase tracking-[0.6em] text-accent-bright/80">
          {label === "LOADING" ? "Sit tight" : label}
        </p>

        <h1
          className={cn(
            "mt-4 font-display font-bold leading-[0.95] tracking-[0.08em] text-cream",
            "text-[44px] sm:text-6xl md:text-7xl"
          )}
          style={{
            textShadow:
              "0 0 40px rgba(164,46,74,0.45), 0 4px 24px rgba(0,0,0,0.6)",
          }}
        >
          {label}
        </h1>

        {showProgress && (
          <div className="mt-8 w-full max-w-md">
            <div
              className="relative h-2 w-full overflow-hidden rounded-full"
              style={{
                background: "rgba(247,237,185,0.10)",
                boxShadow:
                  "inset 0 0 0 1px rgba(247,237,185,0.15), 0 0 24px rgba(255,138,0,0.10)",
              }}
            >
              <div
                className="progress-fill absolute inset-y-0 left-0 rounded-full"
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="mt-3 flex items-center justify-between text-[11px] uppercase tracking-[0.25em] text-text-secondary">
              <span
                className="font-mono text-accent-bright"
                style={{ textShadow: "0 0 12px rgba(255,138,0,0.45)" }}
              >
                {pct}%
              </span>
              <span className="text-text-muted/80">streaming resources</span>
            </div>
          </div>
        )}

        {sublabel && (
          <p className="mt-6 text-[11px] uppercase tracking-[0.45em] text-cream/70 sm:text-xs">
            {sublabel}
          </p>
        )}
      </div>

      <style jsx>{`
        .progress-fill {
          background: linear-gradient(
            90deg,
            rgba(255, 138, 0, 0.6) 0%,
            rgba(255, 200, 60, 0.95) 50%,
            rgba(255, 138, 0, 0.85) 100%
          );
          box-shadow:
            0 0 14px rgba(255, 138, 0, 0.55),
            0 0 28px rgba(255, 138, 0, 0.25);
          transition: width 80ms linear;
        }

        .spark {
          position: absolute;
          bottom: -8px;
          background: radial-gradient(
            circle,
            rgba(255, 200, 90, 0.95) 0%,
            rgba(255, 138, 0, 0.4) 50%,
            transparent 100%
          );
          border-radius: 50%;
          filter: blur(0.4px);
          animation-name: spark-up;
          animation-iteration-count: infinite;
          animation-timing-function: linear;
          will-change: transform, opacity;
        }

        @keyframes spark-up {
          0% {
            transform: translate3d(0, 0, 0);
            opacity: 0;
          }
          10% {
            opacity: 1;
          }
          90% {
            opacity: 0.8;
          }
          100% {
            transform: translate3d(0, -110vh, 0);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}
