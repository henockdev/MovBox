"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Play, X } from "lucide-react";
import {
  buildWatchUrl,
  type WatchHistoryItem,
} from "@/lib/history";
import {
  getUserHistory,
  removeUserHistoryItem,
  migrateLocalHistoryToSupabase,
} from "@/lib/user-data";

/**
 * Continue Watching row. Mounts client-side, reads watch history
 * from localStorage, and renders one card per unwatched item.
 *
 * Self-hides when the user has no history. The Player dispatches
 * a `movbox:history:updated` event on every progress write so
 * the row re-renders without a page refresh.
 */
export function ContinueWatchingRow() {
  const [items, setItems] = useState<WatchHistoryItem[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Initial load. Empty until the effect runs (avoids SSR/CSR
    // mismatch since localStorage is browser-only).
    setReady(true);
    let cancelled = false;

    async function refresh() {
      const list = await getUserHistory();
      if (cancelled) return;
      setItems(list);
      // One-time migration: if the user just signed in, push their
      // localStorage history to supabase.
      migrateLocalHistoryToSupabase().then((r) => {
        if (r.pushed > 0) {
          console.log(`[history] migrated ${r.pushed} items to supabase`);
        }
      });
    }
    refresh();
    // Re-render on local changes within the same tab (when the
    // Player writes a new progress point).
    const onLocal = () => refresh();
    window.addEventListener("movbox:history:updated", onLocal);
    // Also refresh on storage events from other tabs.
    window.addEventListener("storage", onLocal);
    return () => {
      cancelled = true;
      window.removeEventListener("movbox:history:updated", onLocal);
      window.removeEventListener("storage", onLocal);
    };
  }, []);

  if (!ready || items.length === 0) return null;

  return (
    <section className="mx-auto max-w-7xl px-4 pt-8 md:px-6 md:pt-10 lg:px-8">
      <header className="mb-3 flex items-end justify-between gap-3 px-3 sm:mb-5 sm:px-5 md:px-6 lg:px-8">
        <h2 className="flex items-center gap-2 font-display text-base font-bold text-cream sm:text-lg md:text-xl">
          <span>Continue Watching</span>
        </h2>
      </header>
      <div className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 md:gap-4">
        {items.map((item) => (
          <ContinueCard
            key={`${item.detailPath}-${item.season ?? ""}-${item.episode ?? ""}`}
            item={item}
            onRemove={() => {
              removeUserHistoryItem(item.detailPath, item.season, item.episode);
              getUserHistory().then(setItems);
            }}
          />
        ))}
      </div>
    </section>
  );
}

function ContinueCard({
  item,
  onRemove,
}: {
  item: WatchHistoryItem;
  onRemove: () => void;
}) {
  const percent =
    item.duration > 0
      ? Math.min(100, Math.max(0, (item.currentTime / item.duration) * 100))
      : 0;
  const watchUrl = buildWatchUrl(item);

  // "23m of 1h 45m" — more informative than just "23m left"
  const elapsed = formatDuration(item.currentTime);
  const total = formatDuration(item.duration);
  const left = item.duration - item.currentTime;
  const leftStr = left > 0 ? formatDuration(left) : null;
  const progressText =
    elapsed && total ? `${elapsed} of ${total}` : null;

  // Progress bar color: red-ish near the start, fading to gold/accent
  // near the end. This is a subtle Netflix-style cue that you're
  // "warming up" vs "almost done".
  const barClass =
    percent < 25
      ? "from-rose-500 to-rose-400"
      : percent < 60
      ? "from-amber-500 to-amber-400"
      : "from-emerald-500 to-emerald-400";

  return (
    <div className="group/row relative w-[260px] shrink-0 snap-start sm:w-[300px] md:w-[340px]">
      <Link
        href={watchUrl}
        className="block overflow-hidden rounded-xl border border-border bg-surface transition-colors hover:border-accent/50"
      >
        {/* Backdrop with gradient overlay + play icon */}
        <div className="relative aspect-video w-full overflow-hidden bg-bg-deepest">
          {item.backdropUrl || item.posterUrl ? (
            <Image
              src={item.backdropUrl || item.posterUrl}
              alt={item.title}
              fill
              sizes="340px"
              className="object-cover transition-transform group-hover/row:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-text-muted">
              No image
            </div>
          )}
          {/* Two-stop gradient for legible text + spotlight for the play button */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-transparent via-transparent to-black/20" />

          {/* Percent-watched badge — always visible so the user
              knows at a glance how much of the show is left. */}
          <div className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-bg-deepest/85 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-cream shadow-card backdrop-blur">
            <span>{Math.round(percent)}%</span>
          </div>

          {/* Play button — visible on hover, slightly bigger + glow. */}
          <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-all duration-200 group-hover/row:opacity-100">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent text-bg-deepest shadow-glow ring-2 ring-cream/20 transition-transform group-hover/row:scale-110">
              <Play className="h-6 w-6 fill-current" />
            </div>
          </div>

          {/* Bottom overlay: title + episode + progress text */}
          <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-white drop-shadow">
                {item.title}
              </p>
              <p className="text-[10px] uppercase tracking-wider text-white/80 drop-shadow">
                {item.season != null && item.episode != null
                  ? `S${item.season} · E${item.episode}`
                  : "Movie"}
                {leftStr ? ` · ${leftStr} left` : ""}
              </p>
            </div>
            {/* "Resume" CTA — appears on hover, replaces the static
                percentage badge. Looks like a Netflix/Prime "▶ Resume"
                pill. */}
            <span className="hidden shrink-0 items-center gap-1 rounded-full bg-accent/95 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-bg-deepest shadow-glow group-hover/row:inline-flex">
              <Play className="h-3 w-3 fill-current" />
              Resume
            </span>
          </div>
        </div>

        {/* Bottom strip — progress bar + "X of Y" text.
            Bigger, brighter, gradient — the main upgrade. */}
        <div className="flex items-center gap-2.5 bg-bg-deepest/95 px-3 py-2">
          <div
            className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-surface-elevated/80"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(percent)}
            aria-label={`${Math.round(percent)}% watched`}
          >
            <div
              className={`absolute inset-y-0 left-0 rounded-full bg-gradient-to-r ${barClass} shadow-[0_0_8px_rgba(255,255,255,0.15)] transition-[width] duration-300 ease-out`}
              style={{ width: `${percent}%` }}
            />
            {/* Subtle "playhead" dot at the leading edge. */}
            {percent > 0 && percent < 100 ? (
              <div
                className="absolute top-1/2 h-2.5 w-2.5 -translate-y-1/2 -translate-x-1/2 rounded-full bg-white shadow-md ring-2 ring-black/30 transition-[left] duration-300 ease-out"
                style={{ left: `${percent}%` }}
              />
            ) : null}
          </div>
          {progressText ? (
            <span className="shrink-0 text-[10px] tabular-nums text-text-secondary">
              {progressText}
            </span>
          ) : null}
        </div>
      </Link>

      {/* Remove from history button — top-right, visible on hover.
          Larger hit area than before (h-8 w-8 instead of h-7 w-7). */}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${item.title} from history`}
        className="absolute -right-1 -top-1 flex h-8 w-8 items-center justify-center rounded-full border border-border bg-bg-deepest/90 text-text-muted opacity-0 backdrop-blur transition-opacity hover:border-red-500/50 hover:text-red-300 group-hover/row:opacity-100"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

/**
 * "1h 45m" / "23m" / "47s" — a friendly human duration.
 * Returns null for 0 / NaN / negative values.
 */
function formatDuration(seconds: number): string | null {
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`;
  if (m > 0) return `${m}m`;
  return `${s}s`;
}
