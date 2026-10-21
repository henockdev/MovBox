"use client";

import { useEffect, useState } from "react";
import { Plus, Check } from "lucide-react";
import {
  isInWatchlist,
  toggleWatchlist,
} from "@/lib/watchlist";
import { addUserWatchlist, removeUserWatchlist } from "@/lib/user-data";
import type { MediaCard } from "@/lib/types";
import { cn } from "@/lib/utils";

interface WatchlistButtonProps {
  media: MediaCard;
  size?: "sm" | "md" | "lg";
  className?: string;
  /** "icon" shows just a +/✓ icon, "label" shows text + icon */
  variant?: "icon" | "label";
}

export function WatchlistButton({
  media,
  size = "md",
  className,
  variant = "icon",
}: WatchlistButtonProps) {
  const [inList, setInList] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setInList(isInWatchlist(media.id, media.type));
    const handler = () => setInList(isInWatchlist(media.id, media.type));
    window.addEventListener("movbox:watchlist-change", handler);
    window.addEventListener("hmovies:watchlist-change", handler); // legacy
    return () => {
      window.removeEventListener("movbox:watchlist-change", handler);
      window.removeEventListener("hmovies:watchlist-change", handler);
    };
  }, [media.id, media.type]);

  function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    // Always update the local cache for instant UI feedback, then
    // sync to supabase (if signed in) in the background.
    toggleWatchlist(media);
    if (inList) {
      removeUserWatchlist(media);
    } else {
      addUserWatchlist(media);
    }
  }

  const sizes = {
    sm: "h-8 w-8",
    md: "h-9 w-9",
    lg: "h-10 w-10",
  } as const;

  const iconSizes = { sm: "h-4 w-4", md: "h-5 w-5", lg: "h-5 w-5" } as const;

  if (variant === "icon") {
    return (
      <button
        type="button"
        aria-label={inList ? "Remove from My List" : "Add to My List"}
        onClick={handleClick}
        className={cn(
          "flex items-center justify-center rounded-full border border-border bg-surface-elevated/90 text-text-primary backdrop-blur transition-all hover:border-accent",
          sizes[size],
          inList && "border-accent bg-accent text-cream hover:bg-accent-bright",
          className
        )}
      >
        {inList ? (
          <Check className={iconSizes[size]} />
        ) : (
          <Plus className={iconSizes[size]} />
        )}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-md border border-border bg-surface-elevated/80 px-4 py-2 text-sm font-medium text-text-primary backdrop-blur transition-all hover:border-accent",
        inList &&
          "border-accent bg-accent text-cream hover:bg-accent-bright hover:text-cream",
        className
      )}
    >
      {inList ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
      {inList ? "In My List" : "My List"}
    </button>
  );
}
