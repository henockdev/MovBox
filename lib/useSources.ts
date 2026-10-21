"use client";

import { useEffect, useRef, useState } from "react";
import type { BoxSource, BoxSourceGroup, BoxCaption } from "./types";

interface UseSourcesArgs {
  /** boxmovies detailPath (acts as the unique ID). */
  detailPath: string;
  /** TV only. 0 for movies. */
  season?: number;
  /** TV only. 0 for movies. */
  episode?: number;
  /** Skip the fetch entirely (e.g. parent already has sources). */
  skip?: boolean;
}

interface UseSourcesResult {
  data: BoxSourceGroup | null;
  loading: boolean;
  error: string | null;
  /** Force a fresh fetch. */
  refresh: () => void;
}

interface CacheEntry {
  data: BoxSourceGroup;
  ts: number;
}

const CACHE = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 5 * 60 * 1000;

type Subscriber = (data: BoxSourceGroup) => void;
const SUBSCRIBERS = new Map<string, Set<Subscriber>>();

function buildKey(detailPath: string, season: number, episode: number) {
  if (season > 0 || episode > 0) return `${detailPath}:s${season}:e${episode}`;
  return detailPath;
}

function buildUrl(detailPath: string, season: number, episode: number) {
  const params = new URLSearchParams({ detailPath });
  if (season > 0) params.set("season", String(season));
  if (episode > 0) params.set("episode", String(episode));
  return `/api/sources?${params.toString()}`;
}

/**
 * Client-side hook that fetches boxmovies sources for a detailPath.
 *
 *  - In-memory cache (5 min TTL) so second navigations are instant.
 *  - One in-flight fetch per key across the whole tab.
 *  - No AbortController (Next.js dev mode surfaces aborted fetches as
 *    unhandled rejections).
 */
export function useSources({
  detailPath,
  season = 0,
  episode = 0,
  skip,
}: UseSourcesArgs): UseSourcesResult {
  const key = buildKey(detailPath, season, episode);
  const url = buildUrl(detailPath, season, episode);

  const cached = CACHE.get(key);
  const [data, setData] = useState<BoxSourceGroup | null>(
    cached && Date.now() - cached.ts < CACHE_TTL_MS ? cached.data : null
  );
  const [loading, setLoading] = useState(!cached && !skip);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (skip) return;

    const cached = CACHE.get(key);
    if (cached && Date.now() - cached.ts < CACHE_TTL_MS && nonce === 0) {
      setData(cached.data);
      setLoading(false);
      return;
    }

    let subs = SUBSCRIBERS.get(key);
    if (!subs) {
      subs = new Set<Subscriber>();
      SUBSCRIBERS.set(key, subs);
    }
    const subscriber: Subscriber = (incoming) => {
      if (!mountedRef.current) return;
      setData(incoming);
      setError(null);
      setLoading(false);
    };
    subs.add(subscriber);

    if (subs.size === 1) {
      setLoading(true);
      setError(null);
      (async () => {
        try {
          const res = await fetch(url);
          if (!res.ok) {
            const errBody = await res.json().catch(() => ({}));
            throw new Error(errBody.error || `HTTP ${res.status}`);
          }
          const json = (await res.json()) as BoxSourceGroup & {
            ok: boolean;
            error?: string;
          };
          if (!json.ok) {
            throw new Error(json.error || "boxmovies returned ok:false");
          }
          // Strip the ok:boolean before caching.
          const { ok: _ok, ...clean } = json;
          const group = clean as BoxSourceGroup;
          CACHE.set(key, { data: group, ts: Date.now() });
          const current = SUBSCRIBERS.get(key);
          if (current) {
            current.forEach((fn) => {
              try {
                fn(group);
              } catch {
                /* ignore */
              }
            });
            SUBSCRIBERS.delete(key);
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Failed to load sources";
          const empty = {
            detailPath,
            season,
            episode,
            sources: [],
            captions: [],
            count: 0,
          } as unknown as BoxSourceGroup;
          const current = SUBSCRIBERS.get(key);
          if (current) {
            current.forEach((fn) => {
              try {
                fn(empty);
              } catch {
                /* ignore */
              }
            });
            SUBSCRIBERS.delete(key);
          }
          if (mountedRef.current) {
            setError(msg);
            setLoading(false);
          }
        }
      })();
    }

    return () => {
      subs?.delete(subscriber);
    };
  }, [key, url, skip, nonce, detailPath, season, episode]);

  return {
    data,
    loading,
    error,
    refresh: () => setNonce((n) => n + 1),
  };
}
