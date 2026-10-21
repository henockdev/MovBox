"use client";

import { useState } from "react";
import Image from "next/image";
import {
  ChevronDown,
  ChevronRight,
  Film,
  HardDrive,
  ListVideo,
  Loader2,
  Play,
  Radio,
  Tv,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { formatYear } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { BoxSource, MediaCard } from "@/lib/types";
import { SeasonPicker, type SeasonInfo } from "./SeasonPicker";

type Tab = "playlist" | "seasons" | "related";

interface SourceListProps {
  sources: BoxSource[];
  activeSourceIndex: number;
  onSelect: (index: number) => void;
  thumbnail?: string | null;
  mediaType?: "movie" | "tv";
  related?: MediaCard[];
  heading?: string;
  /** TV only — drives the Seasons & Episodes picker tab. */
  seasons?: SeasonInfo[];
  /** TV only — currently playing season. */
  currentSeason?: number;
  /** TV only — currently playing episode. */
  currentEpisode?: number;
  /** TV only — used as the season/episode picker thumbnail. */
  posterUrl?: string | null;
  detailPath?: string;
}

/**
 * Right sidebar on the watch page — Netflix-style.
 *
 *  ┌────────────────────────────┐
 *  │  Playlist  Seasons  Related│  (TV only — movie hides Seasons)
 *  ├────────────────────────────┤
 *  │  ▸ 1080p  2.0 GB  13 subs  │
 *  │  ▸ 720p   1.2 GB  13 subs  │
 *  │  ▸ 480p   556 MB  13 subs  │
 *  │  ▸ 360p   524 MB  13 subs  │
 *  └────────────────────────────┘
 */
export function SourceList({
  sources,
  activeSourceIndex,
  onSelect,
  thumbnail,
  mediaType = "movie",
  related = [],
  heading,
  seasons = [],
  currentSeason = 1,
  currentEpisode = 1,
  posterUrl = null,
  detailPath = "",
}: SourceListProps) {
  // TV shows open on the seasons tab by default — that's what users want
  // to navigate. Movies default to the playlist (sources).
  const [tab, setTab] = useState<Tab>(mediaType === "tv" ? "seasons" : "playlist");
  const isTv = mediaType === "tv";

  return (
    <aside className="flex h-full min-h-0 flex-col rounded-xl border border-border bg-surface/60 backdrop-blur-sm">
      <div className="flex shrink-0 border-b border-border px-2 pt-2">
        <TabButton
          active={tab === "playlist"}
          onClick={() => setTab("playlist")}
          icon={ListVideo}
        >
          Playlist
        </TabButton>
        {isTv && (
          <TabButton
            active={tab === "seasons"}
            onClick={() => setTab("seasons")}
            icon={Tv}
          >
            Seasons
          </TabButton>
        )}
        <TabButton
          active={tab === "related"}
          onClick={() => setTab("related")}
          icon={Film}
        >
          Related
        </TabButton>
      </div>

      {heading && tab === "playlist" && (
        <div className="shrink-0 border-b border-border/60 px-4 py-3">
          <p className="line-clamp-1 text-sm font-semibold text-cream">
            {heading}
          </p>
          <p className="mt-0.5 text-[11px] text-text-muted">
            {sources.length} source{sources.length === 1 ? "" : "s"}
            {sources[0]?.subtitles?.length
              ? ` • ${sources[0].subtitles.length} subtitle${
                  sources[0].subtitles.length === 1 ? "" : "s"
                }`
              : ""}
          </p>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto">
        {tab === "playlist" ? (
          <PlaylistTab
            sources={sources}
            activeSourceIndex={activeSourceIndex}
            onSelect={onSelect}
            thumbnail={thumbnail}
            mediaType={mediaType ?? "movie"}
          />
        ) : tab === "seasons" && isTv ? (
          <SeasonPicker
            detailPath={detailPath}
            seasons={seasons}
            currentSeason={currentSeason}
            currentEpisode={currentEpisode}
            posterUrl={posterUrl}
            backdropUrl={thumbnail}
          />
        ) : (
          <RelatedTab related={related} />
        )}
      </div>
    </aside>
  );
}

function PlaylistTab({
  sources,
  activeSourceIndex,
  onSelect,
  thumbnail,
  mediaType,
}: Pick<
  SourceListProps,
  "sources" | "activeSourceIndex" | "onSelect" | "thumbnail" | "mediaType"
>) {
  if (sources.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 p-8 text-center">
        <Loader2 className="h-6 w-6 animate-spin text-text-muted" />
        <p className="text-xs text-text-muted">Loading streams…</p>
      </div>
    );
  }
  return (
    <ul className="divide-y divide-border/40">
      {sources.map((src, i) => (
        <li key={`${src.url}-${i}`}>
          <SourceRow
            source={src}
            index={i}
            isActive={i === activeSourceIndex}
            onSelect={onSelect}
            thumbnail={thumbnail}
            mediaType={mediaType ?? "movie"}
          />
        </li>
      ))}
    </ul>
  );
}

function SourceRow({
  source,
  index,
  isActive,
  onSelect,
  thumbnail,
  mediaType,
}: {
  source: BoxSource;
  index: number;
  isActive: boolean;
  onSelect: (index: number) => void;
  thumbnail?: string | null;
  mediaType: "movie" | "tv";
}) {
  const subCount = source.subtitles?.length ?? 0;
  const sizeGb =
    source.sizeBytes && source.sizeBytes >= 1024 ** 3
      ? `${(source.sizeBytes / 1024 ** 3).toFixed(1)} GB`
      : source.sizeBytes
        ? `${Math.round(source.sizeBytes / 1024 ** 2)} MB`
        : "";
  return (
    <button
      type="button"
      onClick={() => onSelect(index)}
      className={cn(
        "group flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm transition-colors hover:bg-surface-hover",
        isActive && "bg-accent/15"
      )}
    >
      <div className="relative h-10 w-16 shrink-0 overflow-hidden rounded-md bg-bg-deepest">
        {thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumbnail}
            alt=""
            className={cn(
              "absolute inset-0 h-full w-full object-cover transition-opacity",
              isActive ? "opacity-60" : "opacity-70 group-hover:opacity-100"
            )}
            loading="lazy"
          />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center"
            style={{ background: "#53151e" }}
          >
            {mediaType === "tv" ? (
              <Tv className="h-3.5 w-3.5 text-cream/40" />
            ) : (
              <Film className="h-3.5 w-3.5 text-cream/40" />
            )}
          </div>
        )}
        {source.quality && (
          <span className="absolute bottom-0.5 right-0.5 rounded bg-bg-deepest/85 px-1 py-px text-[9px] font-bold text-cream">
            {source.quality}
          </span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "line-clamp-1 text-xs font-semibold",
            isActive ? "text-accent-bright" : "text-text-primary"
          )}
        >
          {source.quality} • MP4
          {source.codec ? ` • ${source.codec}` : ""}
        </p>
        <p className="mt-0.5 line-clamp-1 text-[10px] text-text-muted">
          {subCount > 0
            ? `${subCount} subtitle${subCount === 1 ? "" : "s"}`
            : "No subs"}
          {sizeGb ? ` • ${sizeGb}` : ""}
        </p>
      </div>

      {isActive ? (
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-cream shadow-glow">
          <Play className="h-3 w-3 fill-current" />
        </span>
      ) : null}
    </button>
  );
}

function RelatedTab({ related }: { related: MediaCard[] }) {
  if (related.length === 0) {
    return (
      <div className="p-6 text-center text-xs text-text-muted">
        No related titles.
      </div>
    );
  }
  return (
    <ul className="divide-y divide-border/40">
      {related.map((m) => {
        const href =
          m.type === "movie"
            ? `/watch/movie/${encodeURIComponent(m.id)}`
            : `/watch/tv/${encodeURIComponent(m.id)}`;
        return (
          <li key={`${m.type}-${m.id}`}>
            <Link
              href={href}
              className="group flex items-center gap-3 px-3 py-3 transition-colors hover:bg-surface-hover"
            >
              <div className="relative h-14 w-10 shrink-0 overflow-hidden rounded-md bg-bg-deepest">
                {m.posterPath ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={m.posterPath}
                    alt={m.title}
                    className="absolute inset-0 h-full w-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div
                    className="flex h-full w-full items-center justify-center"
                    style={{ background: "#53151e" }}
                  >
                    <Film className="h-4 w-4 text-cream/40" />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="line-clamp-1 text-sm font-semibold text-text-primary group-hover:text-cream">
                  {m.title}
                </p>
                <p className="mt-0.5 line-clamp-1 text-[11px] text-text-muted">
                  {formatYear(m.year)}
                  {m.rating > 0 && (
                    <span className="ml-1.5 text-yellow-400">★ {m.rating.toFixed(1)}</span>
                  )}
                </p>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function TabButton({
  active,
  onClick,
  children,
  icon: Icon,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative flex flex-1 items-center justify-center gap-1.5 px-3 py-2.5 text-sm font-semibold transition-colors",
        active ? "text-accent-bright" : "text-text-muted hover:text-text-primary"
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {children}
      {active && (
        <span className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-accent-bright" />
      )}
    </button>
  );
}
