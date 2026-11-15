"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Icon } from "@/components/ui/Icon";
import { imageUrl } from "@/lib/image";
import { formatRating, formatYear } from "@/lib/format";
import { WatchlistButton } from "@/components/watchlist/WatchlistButton";
import {
  HoverPreview,
  useHoverPreview,
} from "@/components/media/HoverPreview";
import { TrailerSheet } from "@/components/media/TrailerSheet";
import type { MediaCard } from "@/lib/types";
import { cn } from "@/lib/utils";

interface MovieCardProps {
  media: MediaCard;
  className?: string;
  /** Show "+ My List" overlay on hover (default true) */
  withAddButton?: boolean;
  priority?: boolean;
  /** Pop the trailer preview on hover (default true). */
  withPreview?: boolean;
}

/**
 * Compact premium poster card. Sized tightly for mobile so a row
 * shows 3+ cards at once without horizontal scroll fatigue.
 * Golden star rating sits in the top-right with a soft drop-shadow.
 *
 * On a pointer device, hovering the card pops the title's own trailer in a
 * small player above it — the app's card popup, on the web.
 *
 * A phone has no hover, so the card grows a small trailer button instead
 * (coarse pointers only) and tapping it slides the trailer sheet up from
 * the bottom. Tapping the poster still opens the title's page.
 *
 * ## Why the trailer button is a SIBLING of the link
 *
 * The button used to sit inside the `<a>`. That is invalid HTML — an
 * anchor may not contain interactive content — and browsers disagree about
 * what a click on it means: some swallow the click entirely, so the sheet
 * never opened. The button now lives beside the link, on top of the poster,
 * so the two are separate hit targets with separate behaviour.
 */
export function MovieCard({
  media,
  className,
  withAddButton = true,
  priority = false,
  withPreview = true,
}: MovieCardProps) {
  const href =
    media.type === "movie"
      ? `/movie/${encodeURIComponent(media.id)}`
      : `/tv/${encodeURIComponent(media.id)}`;

  const poster = imageUrl(media.posterPath, "w500");
  const hasRating = media.rating > 0;
  const preview = useHoverPreview<HTMLAnchorElement>();
  const [sheetOpen, setSheetOpen] = useState(false);
  const hasTrailer = !!media.trailerUrl;

  return (
    <>
      <div
        className={cn(
          "group w-[100px] shrink-0 sm:w-[128px] md:w-[148px] lg:w-[168px]",
          className
        )}
        data-trailer-open={sheetOpen ? "1" : "0"}
      >
        {/* ---- the poster ---- */}
        <div className="mv-card-poster">
          <Link
            href={href}
            ref={preview.anchorRef}
            onMouseEnter={preview.openNow}
            onMouseLeave={preview.closeSoon}
            className="mv-card-link"
          >
            {poster ? (
              <Image
                src={poster ?? undefined}
                alt={media.title}
                fill
                priority={priority}
                sizes="(max-width: 640px) 100px, (max-width: 768px) 128px, (max-width: 1024px) 148px, 168px"
                className="mv-card-img"
              />
            ) : (
              <div
                className="flex h-full w-full items-center justify-center"
                style={{ background: "#53151e" }}
              >
                <span className="font-display text-[10px] tracking-wide text-cream/40">
                  Movbox
                </span>
              </div>
            )}

            {/* Golden star rating — top-right corner, always visible */}
            {hasRating && (
              <div className="mv-card-rating">
                <Icon name="star" className="mv-card-star" />
                <span>{formatRating(media.rating)}</span>
              </div>
            )}

            {/* Bottom gradient for legibility on hover */}
            <div className="mv-card-gradient" />

            {/* Play + add buttons on hover */}
            <div className="mv-card-hover">
              <span className="mv-card-play">
                <Icon name="play" className="mv-card-play-ico" />
              </span>
              {withAddButton && <WatchlistButton media={media} size="sm" />}
            </div>
          </Link>

          {/* The trailer button — coarse pointers only.
              A phone has no hover, so this is the mobile trigger for the
              same trailer: tapping it slides the trailer sheet up from the
              bottom instead of navigating.

              It sits OUTSIDE the link so it is its own hit target — a
              button inside an anchor is invalid HTML and browsers are
              free to swallow the click. */}
          {hasTrailer && (
            <button
              type="button"
              aria-label={`Play the trailer for ${media.title}`}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                // The hover panel and the sheet are two previews of the same
                // thing; only one of them should be open at a time.
                preview.closeSoon();
                setSheetOpen(true);
              }}
              className="mv-card-trailer"
            >
              <Icon name="clapperboard" className="mv-card-trailer-ico" />
            </button>
          )}
        </div>

        {/* ---- the title ---- */}
        <Link href={href} className="mv-card-caption">
          <h3 className="mv-card-title">
            {media.title}
          </h3>
          <p className="mv-card-year">
            {formatYear(media.year)}
            {media.runtime
              ? ` · ${Math.floor(media.runtime / 60)}h ${media.runtime % 60}m`
              : ""}
          </p>
        </Link>
      </div>

      {/* The trailer preview — portaled to <body>, so the scroll rows and
          the grids never clip it. */}
      {withPreview && (
        <HoverPreview
          media={media}
          anchorRef={preview.anchorRef}
          open={preview.open}
          onPanelEnter={preview.cancelClose}
          onPanelLeave={preview.closeSoon}
        />
      )}

      {/* The mobile trailer sheet. It is only mounted once it is opened —
          a grid holds dozens of cards and none of them should carry a
          sheet until the visitor asks for one. */}
      {sheetOpen && (
        <TrailerSheet
          media={media}
          open
          onClose={() => setSheetOpen(false)}
        />
      )}
    </>
  );
}
