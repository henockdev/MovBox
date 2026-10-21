/**
 * CinePro (OMSS) backend client.
 *
 * Wraps the streaming source resolution API we deployed to Oracle.
 * Returns base64-encoded proxy URLs that the player then feeds to hls.js.
 *
 * Set CINEPRO_BASE in .env (e.g. http://localhost:3000 in dev,
 * https://api.movbox.xyz in prod).
 *
 * NOTE: dead code — we use boxmovies-api now (lib/boxmovies.ts). Kept for
 * reference; safe to delete if not needed.
 */

import type { CineProResponse } from "./types";

const CINEPRO_BASE =
  process.env.CINEPRO_BASE ?? process.env.NEXT_PUBLIC_CINEPRO_BASE ?? "";

if (!CINEPRO_BASE) {
  console.warn(
    "[cinepro] CINEPRO_BASE is not set — source resolution will fail at request time"
  );
}

class CineProError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "CineProError";
    this.status = status;
  }
}

async function cineproFetch<T>(path: string): Promise<T> {
  if (!CINEPRO_BASE) {
    throw new CineProError("CINEPRO_BASE is not configured", 500);
  }
  const res = await fetch(`${CINEPRO_BASE}${path}`, {
    // The backend caches per-tmdb-id for 1h. Mirror that.
    next: { revalidate: 3600 },
    headers: { Accept: "application/json" },
  });

  if (!res.ok) {
    throw new CineProError(
      `CinePro ${path} -> ${res.status} ${res.statusText}`,
      res.status
    );
  }
  return res.json() as Promise<T>;
}

/** Resolve streaming sources for a movie by TMDB id */
export function getMovieSources(tmdbId: number | string) {
  return cineproFetch<CineProResponse>(`/v1/movies/${tmdbId}`);
}

/** Resolve streaming sources for a TV episode by TMDB id + season + episode */
export function getTVSources(
  tmdbId: number | string,
  season: number,
  episode: number
) {
  return cineproFetch<CineProResponse>(
    `/v1/tv/${tmdbId}/seasons/${season}/episodes/${episode}`
  );
}

/** Force-refresh a cached source mapping */
export function refreshSource(responseId: string) {
  return cineproFetch<CineProResponse>(`/v1/refresh/${responseId}`);
}
