"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ChevronRight,
  Download,
  Play,
  Plus,
  Share2,
  Star,
  X,
  Copy,
  Calendar,
  Clock,
  Globe2,
  Film,
  Tag,
  Building2,
  Languages,
  Pencil,
  Tv2,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { MovieCard } from "@/components/home/MovieCard";
import { DisplayAd } from "@/components/ads/DisplayAd";
import { imageUrl } from "@/lib/image";
import { toMediaCard } from "@/lib/adapters";
import { cn } from "@/lib/utils";
import type { BoxDetail, BoxMediaCard } from "@/lib/types";

interface TVDetailViewProps {
  details: BoxDetail;
  /** Curated "More Like This" cards from boxmovies /home. */
  related?: BoxMediaCard[];
}

type Tab = "overview" | "cast" | "reviews" | "trailer" | "more";

export function TVDetailView({ details, related = [] }: TVDetailViewProps) {
  const [tab, setTab] = useState<Tab>("overview");
  const [shareOpen, setShareOpen] = useState(false);
  const [reviewText, setReviewText] = useState("");
  const [reviewsExpanded, setReviewsExpanded] = useState(false);
  const [castExpanded, setCastExpanded] = useState(false);

  const poster = details.posterUrl;
  const backdrop = details.backdropUrl || details.posterUrl;
  const year = details.releaseYear ?? (details.releaseDate ? Number(details.releaseDate.slice(0, 4)) : null);
  // Watch goes straight to our player page. We use the new
  // `?s=1&e=1` search-param form so the single stable page at
  // /watch/tv/<id> never remounts when the user picks a different
  // episode from the player. boxmovies doesn't expose real
  // season/episode metadata on the detail screen, so we default to
  // S1E1 and let the player handle the picker.
  const watchHref = `/watch/tv/${encodeURIComponent(details.detailPath)}?s=1&e=1`;

  // Cast split (boxmovies uses "Director", "Writer", character names)
  const directors = details.cast.filter((c) => /director|creator/i.test(c.character || ""));
  const writers = details.cast.filter((c) => /writer|story|screenplay|executive producer/i.test(c.character || ""));
  const actors = details.cast.filter(
    (c) => !/director|creator|writer|story|screenplay|executive producer/i.test(c.character || "")
  );
  const topCast = actors.slice(0, castExpanded ? actors.length : 5);
  const topReviews = details.reviews.slice(0, reviewsExpanded ? details.reviews.length : 1);

  const ratingNum = details.rating ?? 0;
  const distribution = synthesizeDistribution(ratingNum, details.ratingCount ?? 0);

  return (
    <div className="min-h-screen bg-bg-deepest text-text-primary">
      {/* ─── HERO ─── */}
      <section className="relative isolate overflow-hidden">
        {/* Always render a banner — backdrop or warm gradient. */}
        <div className="absolute inset-0 -z-10">
          {backdrop ? (
            <img
              src={imageUrl(backdrop) ?? undefined}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <div
              className="h-full w-full"
              style={{
                background:
                  "radial-gradient(circle at 30% 30%, rgba(220, 38, 38, 0.35) 0%, rgba(15, 5, 6, 1) 70%)",
              }}
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-r from-bg-deepest via-bg-deepest/85 to-bg-deepest/40" />
          <div className="absolute inset-0 bg-gradient-to-t from-bg-deepest via-bg-deepest/30 to-transparent" />
        </div>

        <div className="mx-auto max-w-7xl px-3 pb-10 pt-16 sm:px-5 md:px-6 md:pt-20">
          {/* Breadcrumb — hidden on small mobile, visible md+ */}
          <nav className="mb-4 hidden items-center gap-1.5 text-sm text-text-secondary md:flex md:mb-6">
            <Link href="/" className="hover:text-cream">Home</Link>
            <ChevronRight className="h-3.5 w-3.5 text-text-muted" />
            <Link href="/tv" className="hover:text-cream">TV Shows</Link>
            <ChevronRight className="h-3.5 w-3.5 text-text-muted" />
            <span className="line-clamp-1 text-cream">{details.title}</span>
          </nav>
          {/* Compact mobile breadcrumb */}
          <nav className="mb-3 flex items-center gap-1 text-xs text-text-muted md:hidden">
            <Link href="/tv" className="hover:text-cream">← TV Shows</Link>
            <span className="line-clamp-1">· {details.title}</span>
          </nav>

          <div className="grid grid-cols-[120px_1fr] items-start gap-4 sm:grid-cols-[150px_1fr] sm:gap-5 md:grid-cols-[200px_1fr] md:gap-6 lg:grid-cols-[260px_1fr]">
            {/* Poster — small thumbnail on mobile, full size on lg */}
            <div className="relative aspect-[2/3] w-full overflow-hidden rounded-lg border border-border bg-surface shadow-elevated md:rounded-xl">
              {poster ? (
                <img
                  src={imageUrl(poster) ?? undefined}
                  alt={details.title}
                  className="absolute inset-0 h-full w-full object-cover"
                />
              ) : (
                <div
                  className="flex h-full flex-col items-center justify-center gap-2 p-2 text-center md:gap-3 md:p-4"
                  style={{
                    background:
                      "linear-gradient(160deg, rgba(220, 38, 38, 0.4), rgba(15, 5, 6, 1))",
                  }}
                >
                  <Film className="h-8 w-8 text-cream/40 md:h-14 md:w-14" />
                  <p className="line-clamp-3 text-xs font-display font-semibold text-cream/80 md:text-sm">
                    {details.title}
                  </p>
                </div>
              )}
              <Link
                href={watchHref}
                className="absolute inset-0 flex items-center justify-center bg-bg-deepest/30 opacity-0 transition-opacity hover:opacity-100"
                aria-label="Play"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand text-cream shadow-glow-strong md:h-16 md:w-16">
                  <Play className="h-6 w-6 fill-current md:h-8 md:w-8" />
                </span>
              </Link>
            </div>

            <div className="min-w-0">
              <h1 className="font-display text-xl font-bold text-cream drop-shadow-md sm:text-2xl md:text-4xl lg:text-5xl">
                {details.title}
              </h1>

              {/* Meta line — TV series badge + meta */}
              <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-xs text-text-secondary sm:mt-3 sm:gap-x-3 sm:text-sm">
                <span className="inline-flex items-center gap-1 rounded-md border border-border bg-surface-elevated/60 px-1.5 py-0.5 text-[10px] text-cream sm:px-2 sm:text-xs">
                  <Tv2 className="h-3 w-3 sm:h-3.5 sm:w-3.5" /> TV Series
                </span>
                {year && <span>{year}</span>}
                {details.country && <span className="hidden sm:inline">{details.country}</span>}
                {details.genres.slice(0, 3).map((g, i) => (
                  <span key={g}>
                    {i > 0 && <span className="text-text-muted">· </span>}
                    {g}
                  </span>
                ))}
              </div>

              {details.rating != null && (
                <div className="mt-3 flex flex-wrap items-center gap-3 sm:mt-4 sm:gap-4">
                  <div className="flex items-center gap-2 rounded-md bg-yellow-400/10 px-2.5 py-1 sm:px-3 sm:py-1.5">
                    <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400 sm:h-4 sm:w-4" />
                    <span className="text-sm font-bold text-yellow-400 sm:text-base">
                      {details.rating.toFixed(1)}<span className="text-xs text-yellow-400/60 sm:text-sm">/10</span>
                    </span>
                    {details.ratingCount != null && details.ratingCount > 0 && (
                      <span className="text-[10px] text-text-muted sm:text-xs">
                        {formatCount(details.ratingCount)} votes
                      </span>
                    )}
                  </div>
                </div>
              )}

              {details.synopsis && (
                <p className="mt-3 hidden max-w-3xl text-sm leading-relaxed text-text-primary sm:block md:mt-4 md:text-base">
                  {details.synopsis}
                </p>
              )}

              <div className="mt-3 flex flex-wrap items-center gap-2 sm:mt-5 sm:gap-3">
                <Button asChild variant="primary" size="lg" className="flex-1 sm:flex-none">
                  <Link href={watchHref}>
                    <Play className="h-4 w-4 fill-current" />
                    Watch Now
                  </Link>
                </Button>
                <Button asChild variant="accent" size="lg" className="flex-1 shadow-glow sm:flex-none">
                  <Link href="/movbox-app">
                    <Download className="h-4 w-4" />
                    Download
                  </Link>
                </Button>
                <Button variant="secondary" size="lg" className="flex-1 sm:flex-none">
                  <Plus className="h-4 w-4" />
                  My List
                </Button>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShareOpen((o) => !o)}
                    className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-surface-elevated text-cream transition-colors hover:border-accent"
                    aria-label="Share"
                  >
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" /></svg>
                  </button>
                  {shareOpen && <ShareMenu onClose={() => setShareOpen(false)} />}
                </div>
              </div>

              <div className="mt-3 hidden flex-wrap items-center gap-2 text-xs text-text-muted sm:mt-4 sm:flex">
                <span>Available in:</span>
                {details.availableSubtitleLanguages.length > 0 && (
                  <Chip icon={<Languages className="h-3 w-3" />}>
                    {details.availableSubtitleLanguages.length}+ subtitles
                  </Chip>
                )}
                {details.genres.slice(0, 2).map((g) => (
                  <Chip key={g} icon={<Tag className="h-3 w-3" />}>{g}</Chip>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── TABS ─── */}
      {/* HilltopAds multi-tag banner (zones 7538401-7538405). Sits in the
          band between the hero and the tabs — in-flow, labelled, and inside
          a fixed-height reserved slot so a creative that lands after paint
          cannot shift the page (CLS). Takes the position of the
          instant-message unit removed with the old ad provider. */}
      <DisplayAd className="mx-auto max-w-7xl px-3 sm:px-5 md:px-6" />

      <nav className="border-b border-border">
        <div className="mx-auto max-w-7xl px-4 md:px-6">
          <ul className="flex items-center gap-6 overflow-x-auto text-sm">
            {[
              { id: "overview" as Tab, label: "Overview" },
              { id: "trailer" as Tab, label: "Trailer" },
              { id: "cast" as Tab, label: "Cast & Crew" },
              {
                id: "reviews" as Tab,
                label: details.reviews.length > 0
                  ? `Reviews (${formatCount(details.reviews.length)})`
                  : "Reviews",
              },
              { id: "more" as Tab, label: "More Like This" },
            ].map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={cn(
                    "relative py-4 font-medium transition-colors",
                    tab === t.id ? "text-accent-bright" : "text-text-muted hover:text-cream"
                  )}
                >
                  {t.label}
                  {tab === t.id && (
                    <span className="absolute inset-x-0 -bottom-px h-0.5 bg-accent-bright" />
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </nav>

      {/* ─── MAIN ─── */}
      <div className="mx-auto max-w-7xl px-4 py-8 md:px-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
          <div className="min-w-0 space-y-6">
            {tab === "overview" && (
              <>
                <Panel title="Details">
                  <DetailGrid
                    rows={[
                      ...(directors.length > 0
                        ? [[<Tv2 key="d-icon" className="h-4 w-4" />, "Creator", directors.map((d) => d.name).join(", ")]]
                        : []),
                      ...(writers.length > 0
                        ? [[<Pencil key="w-icon" className="h-4 w-4" />, "Writers", writers.map((w) => w.name).join(", ")] as [React.ReactNode, string, string]]
                        : []),
                      ...(details.source
                        ? [[<Tv2 key="s-icon" className="h-4 w-4" />, "Network", details.source]]
                        : []),
                      ...(details.uploadBy
                        ? [[<Building2 key="u-icon" className="h-4 w-4" />, "Studio", details.uploadBy]]
                        : []),
                      [<Calendar key="rd-icon" className="h-4 w-4" />, "Release", details.releaseDate || "—"],
                      [<Tv2 key="ty-icon" className="h-4 w-4" />, "Type", "TV Series"],
                      ...(details.durationLabel
                        ? [[<Clock key="du-icon" className="h-4 w-4" />, "Runtime", details.durationLabel]]
                        : []),
                      ...(details.country
                        ? [[<Globe2 key="co-icon" className="h-4 w-4" />, "Country", details.country]]
                        : []),
                      [<Tag key="ge-icon" className="h-4 w-4" />, "Genres", details.genres.join(", ") || "—"],
                    ]}
                  />
                </Panel>

                {/* Trailer — embedded HTML5 player using the boxmovies trailer URL.
                    Falls back to a clickable thumbnail that opens the player
                    if boxmovies didn't provide a trailer. */}
                <Panel title="Watch Trailer">
                  {details.trailer?.url ? (
                    <div className="relative aspect-video w-full overflow-hidden rounded-lg border border-border bg-black">
                      <video
                        src={`/api/video-proxy?url=${encodeURIComponent(details.trailer.url)}`}
                        poster={imageUrl(backdrop || poster || "")}
                        controls
                        playsInline
                        preload="metadata"
                        className="absolute inset-0 h-full w-full object-contain"
                      />
                    </div>
                  ) : (
                    <Link
                      href={watchHref}
                      className="group relative block aspect-video w-full overflow-hidden rounded-lg border border-border bg-black"
                      aria-label="Watch now"
                    >
                      <img
                        src={imageUrl(backdrop || poster || "") ?? undefined}
                        alt="Watch trailer"
                        className="absolute inset-0 h-full w-full object-cover opacity-70 transition-opacity group-hover:opacity-50"
                      />
                      <span className="absolute inset-0 flex items-center justify-center">
                        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-brand text-cream shadow-glow-strong transition-transform group-hover:scale-110">
                          <Play className="h-8 w-8 fill-current" />
                        </span>
                      </span>
                      <span className="absolute bottom-3 left-3 text-xs font-medium text-cream drop-shadow">
                        Watch Now
                      </span>
                    </Link>
                  )}
                </Panel>

                <Panel
                  title="Ratings & Reviews"
                  action={details.reviews.length > 1 ? (
                    <button
                      type="button"
                      onClick={() => setReviewsExpanded((e) => !e)}
                      className="text-xs text-text-muted hover:text-cream"
                    >
                      {reviewsExpanded ? "Collapse" : "View All"}
                    </button>
                  ) : null}
                >
                  <div className="grid grid-cols-1 gap-6 sm:grid-cols-[180px_1fr]">
                    <div>
                      <div className="flex items-end gap-1.5">
                        <span className="font-display text-5xl font-bold text-cream">
                          {details.rating != null ? details.rating.toFixed(1) : "—"}
                        </span>
                        <span className="mb-1.5 text-base text-text-muted">/10</span>
                      </div>
                      <div className="mt-1 flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((i) => (
                          <Star
                            key={i}
                            className={cn(
                              "h-4 w-4",
                              i <= Math.round((details.rating ?? 0) / 2)
                                ? "fill-yellow-400 text-yellow-400"
                                : "text-text-muted"
                            )}
                          />
                        ))}
                      </div>
                      {details.ratingCount != null && details.ratingCount > 0 && (
                        <p className="mt-1 text-xs text-text-muted">
                          Based on {formatCount(details.ratingCount)} votes
                        </p>
                      )}
                      <div className="mt-4 space-y-1.5 text-xs">
                        {[5, 4, 3, 2, 1].map((star) => (
                          <div key={star} className="flex items-center gap-2">
                            <span className="w-3 text-right text-text-muted">{star}</span>
                            <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-border/60">
                              <div
                                className="h-full bg-accent-bright"
                                style={{ width: `${distribution[star]}%` }}
                              />
                            </div>
                            <span className="w-9 text-right text-text-muted">{distribution[star]}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    {topReviews.length > 0 ? (
                      <ReviewCard review={topReviews[0]} featured />
                    ) : (
                      <p className="text-sm text-text-muted">No reviews yet.</p>
                    )}
                  </div>

                  {reviewsExpanded && topReviews.length > 1 && (
                    <ul className="mt-6 space-y-4 border-t border-border pt-6">
                      {topReviews.slice(1).map((r) => (
                        <li key={r.postId}><ReviewCard review={r} /></li>
                      ))}
                    </ul>
                  )}
                </Panel>

                {/* More Like This — replaces the old fake "Episodes" row */}
                {related.length > 0 && (
                  <Panel title="More Like This" flush>
                    <div className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-2">
                      {related.map((m) => (
                        <div key={m.detailPath} className="w-44 shrink-0 snap-start">
                          <MovieCard media={toMediaCard(m)} className="w-full" />
                        </div>
                      ))}
                    </div>
                  </Panel>
                )}
              </>
            )}

            {tab === "trailer" && (
              <Panel title="Watch Trailer">
                {details.trailer?.url ? (
                  <div className="relative aspect-video w-full overflow-hidden rounded-lg border border-border bg-black">
                    <video
                      src={`/api/video-proxy?url=${encodeURIComponent(details.trailer.url)}`}
                      poster={imageUrl(backdrop || poster || "")}
                      controls
                      playsInline
                      preload="metadata"
                      className="absolute inset-0 h-full w-full object-contain"
                    />
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-sm text-text-muted">No trailer available for this title.</p>
                    <Button asChild variant="primary">
                      <Link href={watchHref}>
                        <Play className="h-4 w-4 fill-current" /> Watch Now
                      </Link>
                    </Button>
                  </div>
                )}
              </Panel>
            )}

            {tab === "cast" && (
              <Panel
                title="Cast & Crew"
                action={actors.length > 12 ? (
                  <button
                    type="button"
                    onClick={() => setCastExpanded((e) => !e)}
                    className="text-xs text-text-muted hover:text-cream"
                  >
                    {castExpanded ? "Collapse" : "View All"}
                  </button>
                ) : null}
              >
                {directors.length > 0 && <CastGroup title="Creators" members={directors} />}
                {writers.length > 0 && <CastGroup title="Writers" members={writers} />}
                {actors.length > 0 && (
                  <CastGroup title="Cast" members={castExpanded ? actors : actors.slice(0, 12)} />
                )}
                {details.cast.length === 0 && (
                  <p className="text-sm text-text-muted">No cast information available.</p>
                )}
              </Panel>
            )}

            {tab === "reviews" && (
              <Panel title="All Reviews">
                <div className="mb-6 rounded-lg border border-border bg-surface-elevated/30 p-4">
                  <textarea
                    value={reviewText}
                    onChange={(e) => setReviewText(e.target.value)}
                    placeholder="Share your thoughts on this show…"
                    className="w-full resize-none bg-transparent text-sm text-cream placeholder:text-text-muted focus:outline-none"
                    rows={3}
                  />
                  <div className="mt-3 flex items-center justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setReviewText("")}>Cancel</Button>
                    <Button variant="primary" size="sm" disabled={!reviewText.trim()}>Post Review</Button>
                  </div>
                </div>
                {details.reviews.length > 0 ? (
                  <ul className="space-y-4">
                    {details.reviews.map((r) => (
                      <li key={r.postId}><ReviewCard review={r} /></li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-text-muted">No reviews yet.</p>
                )}
              </Panel>
            )}

            {tab === "more" && (
              <Panel title="More Like This" flush>
                {related.length > 0 ? (
                  <div className="grid grid-cols-2 gap-3 p-5 sm:grid-cols-3 md:grid-cols-4">
                    {related.map((m) => <MovieCard key={m.detailPath} media={toMediaCard(m)} />)}
                  </div>
                ) : (
                  <p className="p-5 text-sm text-text-muted">No recommendations yet — check out what's trending on the home page!</p>
                )}
              </Panel>
            )}
          </div>

          {/* ─── RIGHT ─── */}
          <aside className="space-y-6">
            {actors.length > 0 && (
              <div className="rounded-xl border border-border bg-surface/40 p-5">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="font-display text-lg font-semibold text-cream">Top Cast</h3>
                  {actors.length > 5 && (
                    <button
                      type="button"
                      onClick={() => setTab("cast")}
                      className="text-xs text-text-muted hover:text-cream"
                    >
                      View Full Cast & Crew
                    </button>
                  )}
                </div>
                <ul className="space-y-3">
                  {topCast.map((c, i) => (
                    <li key={`${c.name}-${i}`} className="flex items-center gap-3">
                      <Avatar src={c.avatar} name={c.name} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-1 text-sm font-medium text-cream">{c.name}</p>
                        {c.character && (
                          <p className="line-clamp-1 text-xs text-text-muted">{c.character}</p>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Similar Shows sidebar — replaces the old "Seasons" sidebar */}
            {related.length > 0 && (
              <div className="rounded-xl border border-border bg-surface/40 p-5">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="font-display text-lg font-semibold text-cream">Similar Shows</h3>
                  <button
                    type="button"
                    onClick={() => setTab("more")}
                    className="text-xs text-text-muted hover:text-cream"
                  >
                    View All
                  </button>
                </div>
                <ul className="space-y-3">
                  {related.slice(0, 5).map((m) => (
                    <li key={m.detailPath}>
                      <Link
                        href={m.type === "tv" ? `/tv/${encodeURIComponent(m.detailPath)}` : `/movie/${encodeURIComponent(m.detailPath)}`}
                        className="flex items-center gap-3 rounded-md p-1 transition-colors hover:bg-surface-hover"
                      >
                        <div className="relative h-14 w-10 shrink-0 overflow-hidden rounded border border-border bg-surface-elevated">
                          {m.posterUrl && (
                            <img
                              src={imageUrl(m.posterUrl) ?? undefined}
                              alt={m.title}
                              className="absolute inset-0 h-full w-full object-cover"
                            />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="line-clamp-1 text-sm font-medium text-cream">{m.title}</p>
                          <p className="text-xs text-text-muted">
                            {m.year ?? "—"}
                            {m.rating ? ` · ${m.rating.toFixed(1)}` : ""}
                          </p>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="rounded-xl border border-border bg-surface/40 p-5 text-sm">
              <h3 className="mb-3 font-display text-base font-semibold text-cream">Quick Info</h3>
              <ul className="space-y-2 text-text-secondary">
                <li className="flex justify-between"><span>Type</span><span className="text-cream">TV Series</span></li>
                {details.country && <li className="flex justify-between"><span>Country</span><span className="text-cream">{details.country}</span></li>}
                {details.releaseDate && <li className="flex justify-between"><span>Released</span><span className="text-cream">{details.releaseDate}</span></li>}
                {details.availableSubtitleLanguages.length > 0 && (
                  <li className="flex justify-between">
                    <span>Subtitles</span>
                    <span className="text-cream">{details.availableSubtitleLanguages.length} languages</span>
                  </li>
                )}
                {details.source && <li className="flex justify-between"><span>Network</span><span className="text-cream">{details.source}</span></li>}
              </ul>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

// ─── Helpers ───

function Panel({ title, action, flush, children }: { title: string; action?: React.ReactNode; flush?: boolean; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-surface/40">
      <header className="flex items-center justify-between border-b border-border/40 px-5 py-4">
        <h2 className="font-display text-lg font-semibold text-cream">{title}</h2>
        {action}
      </header>
      <div className={cn(flush ? "" : "p-5")}>{children}</div>
    </section>
  );
}

function Chip({ icon, children }: { icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface-elevated/60 px-2 py-1 text-[11px] text-cream">
      {icon}
      {children}
    </span>
  );
}

function DetailGrid({ rows }: { rows: any[] }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
      {rows.map(([icon, label, value], i) => (
        <div key={i} className="flex items-start gap-3">
          <div className="mt-0.5 text-text-muted">{icon}</div>
          <div className="min-w-0 flex-1">
            <dt className="text-xs uppercase tracking-wider text-text-muted">{label}</dt>
            <dd className="mt-0.5 text-sm text-cream">{value}</dd>
          </div>
        </div>
      ))}
    </dl>
  );
}

function Avatar({ src, name, size = "md" }: { src: string | null; name: string; size?: "sm" | "md" | "lg" }) {
  const dim = size === "sm" ? "h-9 w-9" : size === "lg" ? "h-28 w-28" : "h-12 w-12";
  const initialSize = size === "sm" ? "text-xs" : size === "lg" ? "text-2xl" : "text-sm";
  return (
    <div className={cn("relative shrink-0 overflow-hidden rounded-full border border-border bg-surface-elevated", dim)}>
      {src ? (
        <img src={imageUrl(src) ?? undefined} alt={name} className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-accent to-accent-bright font-display font-bold text-cream">
          <span className={initialSize}>{name.split(/\s+/).map((p) => p[0]).slice(0, 2).join("")}</span>
        </div>
      )}
    </div>
  );
}

function CastGroup({ title, members }: { title: string; members: BoxDetail["cast"] }) {
  return (
    <div className="mb-6 last:mb-0">
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-text-muted">{title}</h3>
      <div className="grid grid-cols-2 gap-x-3 gap-y-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {members.map((c, i) => (
          <div key={`${title}-${c.name}-${i}`} className="flex flex-col items-center text-center">
            <Avatar src={c.avatar} name={c.name} size="md" />
            <p className="mt-2 line-clamp-2 text-xs font-semibold text-cream">{c.name}</p>
            {c.character && (
              <p className="line-clamp-1 text-[11px] text-text-muted">{c.character}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function ReviewCard({ review, featured = false }: { review: BoxDetail["reviews"][number]; featured?: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-surface-elevated/30 p-4">
      <div className="flex items-start gap-3">
        <Avatar src={review.user.avatar} name={review.user.nickname} size="sm" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-cream">{review.user.nickname}</p>
            {review.createdAt && (
              <p className="text-xs text-text-muted">{formatReviewDate(review.createdAt)}</p>
            )}
            {review.rating != null && review.rating > 0 && (
              <span className="ml-auto inline-flex items-center gap-0.5 rounded bg-yellow-400/10 px-1.5 py-0.5 text-xs font-medium text-yellow-400">
                {review.rating.toFixed(1)}
              </span>
            )}
          </div>
          {featured && (
            <div className="mt-1 flex items-center gap-0.5">
              {[1, 2, 3, 4, 5].map((i) => (
                <Star
                  key={i}
                  className={cn(
                    "h-3.5 w-3.5",
                    i <= Math.round((review.rating ?? 0) / 2)
                      ? "fill-yellow-400 text-yellow-400"
                      : "text-text-muted/40"
                  )}
                />
              ))}
            </div>
          )}
          <p className="mt-1.5 line-clamp-4 text-sm leading-relaxed text-text-primary">{review.content}</p>
        </div>
      </div>
    </div>
  );
}

function ShareMenu({ onClose }: { onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  if (typeof window === "undefined") return null;
  const url = window.location.href;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* ignore */ }
  };
  return (
    <div className="absolute right-0 top-12 z-30 w-56 overflow-hidden rounded-lg border border-border bg-bg-deepest/95 shadow-elevated backdrop-blur-md" onMouseLeave={onClose}>
      <div className="flex items-center justify-between border-b border-border/40 px-3 py-2">
        <p className="text-xs font-semibold text-cream">Share</p>
        <button type="button" onClick={onClose} className="text-text-muted hover:text-cream"><X className="h-3.5 w-3.5" /></button>
      </div>
      <div className="grid grid-cols-4 gap-1 p-2">
        <ShareBtn icon={<Copy className="h-4 w-4" />} label={copied ? "Copied" : "Copy"} onClick={copy} active={copied} />
        <ShareBtn icon={<Share2 className="h-4 w-4" />} label="FB" onClick={() => window.open(`https://www.facebook.com/sharer/sharer.php?u=${url}`, "_blank")} />
        <ShareBtn icon={<Share2 className="h-4 w-4" />} label="X" onClick={() => window.open(`https://twitter.com/intent/tweet?url=${url}`, "_blank")} />
        <ShareBtn icon={<Share2 className="h-4 w-4" />} label="In" onClick={() => window.open(`https://www.linkedin.com/sharing/share-site/?url=${url}`, "_blank")} />
      </div>
    </div>
  );
}

function ShareBtn({ icon, label, onClick, active }: { icon: React.ReactNode; label: string; onClick: () => void; active?: boolean }) {
  return (
    <button type="button" onClick={onClick} className={cn("flex flex-col items-center gap-1 rounded-md py-2 text-[10px] text-text-secondary transition-colors hover:bg-surface-hover hover:text-cream", active && "bg-accent text-cream")}>
      {icon}
      <span>{label}</span>
    </button>
  );
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

function formatReviewDate(ms: number): string {
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return "";
  const now = Date.now();
  const diff = (now - ms) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function synthesizeDistribution(rating: number, count: number): Record<1 | 2 | 3 | 4 | 5, number> {
  if (!rating || !count) return { 1: 1, 2: 2, 3: 5, 4: 25, 5: 67 };
  const starsToRating: Record<number, number> = { 1: 2, 2: 4, 3: 6, 4: 8, 5: 10 };
  const weights: Record<1 | 2 | 3 | 4 | 5, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const s of [1, 2, 3, 4, 5] as const) {
    weights[s] = Math.max(0.01, 1 - Math.abs(starsToRating[s] - rating) / 8);
  }
  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  return {
    1: Math.round((weights[1] / total) * 100),
    2: Math.round((weights[2] / total) * 100),
    3: Math.round((weights[3] / total) * 100),
    4: Math.round((weights[4] / total) * 100),
    5: Math.round((weights[5] / total) * 100),
  };
}
