/**
 * Movbox data layer.
 *
 * Two upstream sources:
 *   1. h5-api.aoneroom.com/wefeed-h5api-bff  — for everything except the
 *      stream bytes (home, trending, browse, search, suggest, detail,
 *      anime). Bearer auth is minted and cached in this Next.js process
 *      so no separate auth server is needed.
 *   2. Thin relay (DO App Platform, ~50MB) — for /stream, /mp4, /subtitle
 *      so the upstream CDN can be reached + captions proxied. The
 *      Android app uses the same relay.
 *
 * No more Puppeteer, no more boxmovies-api (200MB+). Just the h5-api and
 * the thin relay. The Next.js server itself handles Bearer auth.
 *
 * Env:
 *   H5_API_BASE       default: https://h5-api.aoneroom.com/wefeed-h5api-bff
 *   STREAM_RELAY_URL  default: https://p01--movbox-api--d6kx854d4rvy.code.run
 */

import type {
  BoxCaption,
  BoxDetail,
  BoxMediaCard,
  BoxSource,
  BoxSourceGroup,
} from "./types";

const H5_API_BASE =
  process.env.H5_API_BASE ||
  "https://h5-api.aoneroom.com/wefeed-h5api-bff";
const STREAM_RELAY_URL =
  process.env.STREAM_RELAY_URL ||
  "https://p01--movbox-api--d6kx854d4rvy.code.run";
const SITE_HOST = "https://boxmovies.org";
const USER_AGENT =
  "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Mobile Safari/537.36";
const TOKEN_TTL_MS = 23 * 60 * 60 * 1000; // 23h — refresh a bit before the 24h upstream expiry

// ---------------------------------------------------------------------------
// Bearer auth (one shared token for the whole Next.js process)
// ---------------------------------------------------------------------------
//
// h5-api requires an `Authorization: Bearer <token>` header. The token comes
// from the `token` cookie set by boxmovies.org's /get-latest-app-pkgs endpoint.
// We mint it once on first use and cache for 23h. The Next.js server runs
// as a single process (or per-instance on Vercel), so one token is enough.

let cachedToken: string | null = null;
let tokenObtainedAt = 0;

async function mintToken(): Promise<string> {
  const url = `${H5_API_BASE}/app/get-latest-app-pkgs?app_name=moviebox`;
  const r = await fetch(url, {
    headers: {
      Origin: SITE_HOST,
      Referer: `${SITE_HOST}/`,
      "User-Agent": USER_AGENT,
      Accept: "application/json, text/plain, */*",
    },
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`token mint failed: HTTP ${r.status}`);
  const setCookie = r.headers.get("set-cookie") || "";
  const m = setCookie.match(/(?:^|,\s*)token=([^;]+)/i);
  if (!m) throw new Error("token mint: no token cookie in response");
  return m[1];
}

async function getToken(forceRefresh = false): Promise<string> {
  if (
    !forceRefresh &&
    cachedToken &&
    Date.now() - tokenObtainedAt < TOKEN_TTL_MS
  ) {
    return cachedToken;
  }
  cachedToken = await mintToken();
  tokenObtainedAt = Date.now();
  return cachedToken;
}

// ---------------------------------------------------------------------------
// h5Fetch — every h5-api call goes through here. Adds Bearer + browser
// headers so the upstream treats the request as if it's coming from the
// real website. Auto-retries once on 401 by refreshing the token.
// ---------------------------------------------------------------------------

class H5Error extends Error {
  status: number;
  constructor(message: string, status = 0) {
    super(message);
    this.name = "H5Error";
    this.status = status;
  }
}

async function h5Fetch(
  path: string,
  {
    method = "POST",
    body = null,
    retried401 = false,
    timeoutMs = 12_000,
  }: {
    method?: "GET" | "POST";
    body?: unknown;
    retried401?: boolean;
    timeoutMs?: number;
  } = {}
): Promise<any> {
  const token = await getToken();
  const url = `${H5_API_BASE}${path}`;
  const headers: Record<string, string> = {
    Accept: "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
    Authorization: `Bearer ${token}`,
    Origin: SITE_HOST,
    Referer: `${SITE_HOST}/`,
    "User-Agent": USER_AGENT,
  };
  const init: RequestInit = { method, headers };
  if (body && method !== "GET") {
    headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(body);
  }
  // AbortController for timeout
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  init.signal = ctrl.signal;
  try {
    const res = await fetch(url, init);
    if (res.status === 401 && !retried401) {
      cachedToken = null;
      return h5Fetch(path, { method, body, retried401: true, timeoutMs });
    }
    const text = await res.text();
    let data: any = null;
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
    if (!res.ok) {
      throw new H5Error(
        `h5-api ${path} -> HTTP ${res.status}: ${text.slice(0, 200)}`,
        res.status
      );
    }
    if (!data || data.code !== 0) {
      throw new H5Error(
        `h5-api ${path} returned code=${data?.code}: ${text.slice(0, 200)}`,
        res.status
      );
    }
    return data;
  } catch (e: any) {
    if (e instanceof H5Error) throw e;
    if (e?.name === "AbortError") {
      throw new H5Error(`h5-api ${path} timed out after ${timeoutMs}ms`);
    }
    throw new H5Error(`h5-api ${path} fetch error: ${e?.message || e}`);
  } finally {
    clearTimeout(t);
  }
}

// ---------------------------------------------------------------------------
// Response transformers (h5-api item → BoxMediaCard etc.)
// ---------------------------------------------------------------------------

function cleanDetailPath(p: string): string {
  return String(p)
    .replace(/^https?:\/\/[^/]+/, "")
    .replace(/^(\/)?detail\//, "")
    .replace(/^(\/)?movies\//, "")
    .split("?")[0]
    .replace(/^\/+/, "");
}

function mapH5ItemToCard(it: any): BoxMediaCard | null {
  if (!it || typeof it !== "object") return null;
  const detailPath = it.detailPath || null;
  if (!detailPath) return null;
  const cover = it.cover && it.cover.url ? it.cover.url : null;
  const stills = it.stills && it.stills.url ? it.stills.url : null;
  let rating: number | null = null;
  if (it.imdbRatingValue != null && it.imdbRatingValue !== "") {
    const n = Number(it.imdbRatingValue);
    if (Number.isFinite(n)) rating = n;
  }
  let year: number | null = null;
  if (it.releaseDate) {
    const y = Number(String(it.releaseDate).slice(0, 4));
    if (Number.isFinite(y) && y > 1900) year = y;
  }
  const type: "movie" | "tv" =
    it.subjectType === 2 ? "tv" : "movie";
  return {
    detailPath,
    type,
    title: it.title || detailPath,
    year,
    rating,
    posterUrl: cover || stills,
    backdropUrl: stills || cover,
    overview: it.description || "",
  };
}

// ---------------------------------------------------------------------------
// Home — boxmovies.org's themed home sections + hero pool
// ---------------------------------------------------------------------------

const SKIP_TITLES = new Set([
  "Everyone Search",
  "Continue Watching",
  "Recently Watched",
  "Banner_Africa",
  "Categories",
  "Get the VIP!",
  "🔥Fight Zone Shorts",
  "Movies in Minutes",
  "Comedy Skit",
  "Trending Music Videos",
  "Early Learning Songs",
  "Kids Movies and Cartoons",
  "Learn and Grow",
  "Songs, Stories and Learning",
  "Fan Favorites",
  "Fighters on Screen",
  "Trending Club & Competition Picks",
]);

export interface BoxHomeSection {
  title: string;
  count: number;
  items: BoxMediaCard[];
}

export interface BoxHomeEnvelope {
  sections: BoxHomeSection[];
  hero: BoxMediaCard[];
  count: number;
}

export async function getBoxmoviesHome(): Promise<BoxHomeEnvelope> {
  const r = await h5Fetch("/home?host=boxmovies.org", { method: "GET" });
  const operating: any[] =
    r.data && Array.isArray(r.data.operatingList) ? r.data.operatingList : [];
  const cleaned = operating
    .filter(
      (o) =>
        o &&
        (o.type === "SUBJECTS_MOVIE" || o.type === "APPOINTMENT_LIST")
    )
    .filter((o) => Array.isArray(o.subjects) && o.subjects.length > 0)
    .filter((o) => !SKIP_TITLES.has(o.title))
    .map((o) => ({
      title: o.title,
      count: o.subjects.length,
      items: o.subjects.map(mapH5ItemToCard).filter(Boolean) as BoxMediaCard[],
    }))
    .filter((s) => s.items.length > 0);

  // Hero pool: first few items from "Popular Series" and "Popular Movie".
  const heroPool: BoxMediaCard[] = [];
  const popularSeries = cleaned.find((s) => s.title === "Popular Series");
  if (popularSeries) heroPool.push(...popularSeries.items.slice(0, 3));
  const popularMovie = cleaned.find((s) => s.title === "Popular Movie");
  if (popularMovie) heroPool.push(...popularMovie.items.slice(0, 3));
  const seen = new Set<string>();
  const hero: BoxMediaCard[] = [];
  for (const it of heroPool) {
    if (!it?.detailPath || seen.has(it.detailPath)) continue;
    seen.add(it.detailPath);
    hero.push(it);
    if (hero.length >= 5) break;
  }
  if (hero.length === 0 && cleaned.length > 0) {
    hero.push(...cleaned[0].items.slice(0, 5));
  }

  return {
    sections: cleaned,
    hero,
    count: cleaned.length,
  };
}

// ---------------------------------------------------------------------------
// Trending
// ---------------------------------------------------------------------------

export async function getBoxmoviesTrending(perPage = 18): Promise<{
  ok: boolean;
  count: number;
  results: BoxMediaCard[];
}> {
  const r = await h5Fetch(`/subject/trending?page=0&perPage=${perPage}`, {
    method: "GET",
  });
  const items: any[] =
    r.data && Array.isArray(r.data.items) ? r.data.items : [];
  return {
    ok: true,
    count: items.length,
    results: items.map(mapH5ItemToCard).filter(Boolean) as BoxMediaCard[],
  };
}

// ---------------------------------------------------------------------------
// Browse (filterable list pages: /movies, /tv, /animations)
// ---------------------------------------------------------------------------

export type ChannelId = 1 | 2 | 7;

export interface BrowseFilters {
  genre?: string | null;
  country?: string | null;
  year?: string | null;
  language?: string | null;
  sort?: string;
  page?: number;
  perPage?: number;
}

export interface BrowseResult {
  items: BoxMediaCard[];
  hasMore: boolean;
  nextPage: number | null;
  totalCount: number | null;
  page: number;
  perPage: number;
  channelId: number;
  filters: Required<BrowseFilters>;
}

export async function getBoxmoviesBrowse(
  channelId: ChannelId,
  filters: BrowseFilters = {}
): Promise<BrowseResult> {
  // channelId=7 in boxmovies.org's URL → channelId=1006 in h5-api
  const upstreamChannelId = channelId === 7 ? 1006 : channelId;
  const isAll = (v?: string | null) =>
    !v || /^all$/i.test(String(v).trim());
  const sort = filters.sort || "ForYou";
  const page = Math.max(1, filters.page ?? 1);
  const perPage = Math.min(50, filters.perPage ?? 28);

  const r = await h5Fetch("/subject/filter", {
    method: "POST",
    body: {
      page,
      perPage,
      channelId: upstreamChannelId,
      genre: isAll(filters.genre) ? "" : filters.genre,
      country: isAll(filters.country) ? "" : filters.country,
      year: isAll(filters.year) ? "" : filters.year,
      language: isAll(filters.language) ? "" : filters.language,
      sort,
    },
  });
  const items: any[] =
    r.data && Array.isArray(r.data.items) ? r.data.items : [];
  return {
    items: items.map(mapH5ItemToCard).filter(Boolean) as BoxMediaCard[],
    hasMore: !!(r.data && r.data.hasMore),
    nextPage:
      r.data && r.data.nextPage != null
        ? Number(r.data.nextPage) || null
        : null,
    totalCount: r.data && r.data.totalCount != null ? r.data.totalCount : null,
    page,
    perPage,
    channelId,
    filters: {
      genre: isAll(filters.genre) ? null : filters.genre ?? null,
      country: isAll(filters.country) ? null : filters.country ?? null,
      year: isAll(filters.year) ? null : filters.year ?? null,
      language: isAll(filters.language) ? null : filters.language ?? null,
      sort,
      page,
      perPage,
    },
  };
}

// ---------------------------------------------------------------------------
// Filter options (hardcoded — h5-api doesn't expose them)
// ---------------------------------------------------------------------------

export interface FilterOptions {
  genre: string[];
  country: string[];
  year: string[];
  language: string[];
  sort: string[];
}

const HARDCODED_FILTERS_MOVIE: FilterOptions = {
  genre: [
    "Action",
    "Adventure",
    "Animation",
    "Biography",
    "Comedy",
    "Crime",
    "Documentary",
    "Drama",
    "Family",
    "Fantasy",
    "Game-Show",
    "History",
    "Horror",
    "Music",
    "Musical",
    "Mystery",
    "News",
    "Reality-TV",
    "Romance",
    "Sci-Fi",
    "Short",
    "Sport",
    "Talk-Show",
    "Thriller",
    "War",
    "Western",
  ],
  country: [
    "United States",
    "United Kingdom",
    "India",
    "Canada",
    "France",
    "Germany",
    "Japan",
    "South Korea",
    "Spain",
    "Italy",
    "Australia",
    "Brazil",
    "China",
    "Russia",
    "Hong Kong",
    "Taiwan",
    "Thailand",
    "Indonesia",
    "Philippines",
    "Vietnam",
    "Turkey",
    "Egypt",
    "Nigeria",
    "South Africa",
    "Argentina",
    "Colombia",
    "New Zealand",
  ],
  year: [
    "2026",
    "2025",
    "2024",
    "2023",
    "2022",
    "2021",
    "2020",
    "2019",
    "2018",
    "2017",
    "2016",
    "2015",
    "2010",
  ],
  language: [
    "English",
    "Spanish",
    "French",
    "German",
    "Italian",
    "Portuguese",
    "Japanese",
    "Korean",
    "Mandarin",
    "Cantonese",
    "Hindi",
    "Tamil",
    "Telugu",
    "Arabic",
    "Turkish",
    "Russian",
    "Polish",
    "Dutch",
    "Swedish",
    "Norwegian",
    "Danish",
    "Finnish",
  ],
  sort: ["ForYou", "Hottest", "Latest", "Rating"],
};

export async function getBoxmoviesFilterOptions(
  channelId: ChannelId
): Promise<FilterOptions> {
  if (channelId === 7) {
    return {
      ...HARDCODED_FILTERS_MOVIE,
      genre: [],
      language: [],
    };
  }
  return HARDCODED_FILTERS_MOVIE;
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

export interface SearchOptions {
  subjectType?: 0 | 1 | 2 | 3;
  page?: number;
  perPage?: number;
}

export interface SearchEnvelope {
  results: BoxMediaCard[];
  totalCount: number | null;
  hasMore: boolean;
  nextPage: number | null;
  page: number;
  perPage: number;
  subjectType: number;
}

export async function searchBoxmovies(
  query: string,
  options: SearchOptions | number = {}
): Promise<SearchEnvelope> {
  const opts: SearchOptions =
    typeof options === "number" ? { page: options } : options;
  const subjectType = opts.subjectType ?? 0;
  const page = opts.page ?? 1;
  const perPage = opts.perPage ?? 28;

  const r = await h5Fetch("/subject/search", {
    method: "POST",
    body: {
      keyword: String(query),
      // h5-api wants page as STRING
      page: String(page),
      perPage,
      subjectType,
    },
  });
  const items: any[] =
    r.data && Array.isArray(r.data.items) ? r.data.items : [];
  const pager = r.data && r.data.pager ? r.data.pager : {};
  return {
    results: items.map(mapH5ItemToCard).filter(Boolean) as BoxMediaCard[],
    totalCount:
      typeof pager.totalCount === "number"
        ? pager.totalCount
        : pager.totalCount != null
        ? Number(pager.totalCount) || null
        : null,
    hasMore: !!pager.hasMore,
    nextPage: pager.nextPage != null ? Number(pager.nextPage) || null : null,
    page,
    perPage,
    subjectType,
  };
}

export async function suggestBoxmovies(query: string): Promise<string[]> {
  const trimmed = String(query || "").trim();
  if (!trimmed) return [];
  try {
    const r = await h5Fetch("/subject/search-suggest", {
      method: "POST",
      body: { keyword: trimmed, perPage: 10 },
    });
    const items: any[] =
      r.data && Array.isArray(r.data.items) ? r.data.items : [];
    return items
      .map((it) => (it && it.word ? String(it.word) : null))
      .filter((w): w is string => !!w);
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Detail
// ---------------------------------------------------------------------------

/**
 * Decide whether a subject is a movie or a TV series.
 *
 * The upstream `subjectType` is NOT a clean movie/tv flag:
 *
 *   1 = movie
 *   2 = tv series
 *   7 = animation — which covers BOTH one-off animated features
 *       ("Elemental", "Kung Fu Panda 4") AND episodic anime series
 *       ("The Divorced Billionaire Heiress", 75 episodes)
 *
 * A series is only playable through the TV route: the player resolves
 * streams by (season, episode), and an episodic title has no episode 0.
 * Treating an anime series as a movie therefore yields a watch page that
 * resolves zero sources — verified live against
 * `/api/sources?detailPath=the-divorced-billionaire-heiress-…&season=0&episode=0`
 * (count = 0) versus `season=1&episode=1` (count = 1).
 *
 * So for the ambiguous types we fall back to the season data: a subject
 * whose seasons actually contain episodes is a series, everything else is
 * a one-off feature.
 */
function inferSubjectKind(
  subjectType: unknown,
  seasons: Array<{
    episodeCount: number;
    resolutions: Array<{ epNum?: number }>;
  }>
): "movie" | "tv" | "unknown" {
  if (subjectType === 1) return "movie";
  if (subjectType === 2) return "tv";

  const episodic = seasons.some(
    (s) =>
      s.episodeCount > 1 ||
      (Array.isArray(s.resolutions) &&
        s.resolutions.some((r) => Number(r.epNum) > 1))
  );
  if (episodic) return "tv";

  // A single season with exactly one episode is a one-off feature.
  if (seasons.length > 0) return "movie";

  return "unknown";
}

/**
 * Short-lived in-process cache. A single page view can ask for the same
 * detail up to three times (generateMetadata + the page component +
 * the JSON-LD builder), and the watch routes are dynamic, so without a
 * cache every player open would hammer /detail. 60s is long enough to
 * collapse those calls and short enough that new episodes appear
 * quickly. Failures are never cached — a transient upstream blip must
 * not keep a title broken for a minute.
 */

const DETAIL_TTL_MS = 60_000;
const DETAIL_CACHE_MAX = 500;
const detailCache = new Map<string, { at: number; value: BoxDetail }>();

export async function getBoxmoviesDetail(
  detailPath: string
): Promise<BoxDetail | null> {
  const clean = cleanDetailPath(detailPath);
  const cached = detailCache.get(clean);
  if (cached && Date.now() - cached.at < DETAIL_TTL_MS) {
    return cached.value;
  }

  const detail = await fetchBoxmoviesDetail(clean);
  if (detail) {
    if (detailCache.size >= DETAIL_CACHE_MAX) {
      const oldest = detailCache.keys().next();
      if (!oldest.done) detailCache.delete(oldest.value);
    }
    detailCache.set(clean, { at: Date.now(), value: detail });
  }
  return detail;
}

async function fetchBoxmoviesDetail(
  clean: string
): Promise<BoxDetail | null> {
  try {
    const r = await h5Fetch(`/detail?detailPath=${encodeURIComponent(clean)}`, {
      method: "GET",
    });
    const d = r.data || {};
    const subj = d.subject || {};
    const resource = d.resource || {};
    const stars: any[] = Array.isArray(d.stars) ? d.stars : [];
    const postList = d.postList || {};
    const reviewList: any[] = Array.isArray(postList.posts)
      ? postList.posts
      : Array.isArray(postList)
      ? postList
      : [];

    const genreStr = String(subj.genre || "");
    const genres = genreStr
      .split(",")
      .map((g) => g.trim())
      .filter(Boolean);
    const subtitleRaw = String(subj.subtitles || "");
    const availableSubtitleLanguages = subtitleRaw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .filter((s) => !/^[a-z]+\./i.test(s));

    const dur = Number(subj.duration) || 0;
    const durationSeconds = Number.isFinite(dur) && dur > 0 ? dur : null;
    const durationLabel = durationSeconds
      ? `${Math.floor(durationSeconds / 3600)}h ${Math.floor(
          (durationSeconds % 3600) / 60
        )}m`
      : null;

    let rating: number | null = null;
    if (subj.imdbRatingValue != null && subj.imdbRatingValue !== "") {
      const n = Number(subj.imdbRatingValue);
      if (Number.isFinite(n)) rating = n;
    }
    let trailerUrl: string | null = null;
    if (subj.trailer && subj.trailer.videoAddress && subj.trailer.videoAddress.url) {
      trailerUrl = subj.trailer.videoAddress.url;
    }
    const seasons = Array.isArray(resource.seasons)
      ? resource.seasons.map((s: any) => {
          const epList = s.allEp
            ? String(s.allEp)
                .split(",")
                .map((e: string) => Number(String(e).trim()))
                .filter((n: number) => Number.isFinite(n))
            : null;
          return {
            season: Number(s.se) || 0,
            episodeCount: Number(s.maxEp) || 0,
            episodes: epList && epList.length > 0 ? epList : null,
            resolutions: Array.isArray(s.resolutions) ? s.resolutions : [],
          };
        })
      : [];
    const cast = stars
      .map((s) => {
        if (!s || typeof s !== "object") return null;
        const name = s.name || s.staffName || s.realName || null;
        if (!name) return null;
        return {
          name: String(name),
          character: s.character || s.role || null,
          avatar: s.avatarUrl || (s.avatar && s.avatar.url) || null,
          detailPath: s.detailPath || null,
        };
      })
      .filter(Boolean);
    const reviews = reviewList
      .map((rv) => {
        if (!rv || typeof rv !== "object") return null;
        const content = rv.content;
        if (typeof content !== "string" || content.trim().length === 0) return null;
        const user = rv.user || rv.author || null;
        return {
          postId: String(rv.postId || rv.id || Math.random().toString(36).slice(2)),
          userId: String((user && (user.id || user.userId)) || rv.userId || "0"),
          content,
          user: user
            ? {
                nickname:
                  user.nickname || user.username || user.name || "Anonymous",
                avatar: (user.avatar && user.avatar.url) || user.avatar || null,
              }
            : { nickname: "Anonymous", avatar: null },
          createdAt: rv.createdAt ? Number(rv.createdAt) : null,
          rating:
            typeof rv.subjectRate === "number"
              ? rv.subjectRate
              : typeof rv.rating === "number"
              ? rv.rating
              : null,
        };
      })
      .filter(Boolean);
    const kind: "movie" | "tv" | "unknown" = inferSubjectKind(
      subj.subjectType,
      seasons
    );

    return {
      detailPath: subj.detailPath || clean,
      // The h5-api subjectId is what the thin relay's /stream endpoint
      // needs. The web's card→detail navigation doesn't pass it through,
      // so /api/sources has to look it up here.
      subjectId: subj.subjectId || null,
      id: subj.subjectId || null,
      kind,
      title: subj.title,
      synopsis: subj.description || "",
      releaseDate: subj.releaseDate || "",
      releaseYear: subj.releaseDate
        ? Number(String(subj.releaseDate).slice(0, 4)) || null
        : null,
      durationSeconds,
      durationLabel,
      genres,
      availableSubtitleLanguages,
      country: subj.countryName || null,
      posterUrl: (subj.cover && subj.cover.url) || null,
      backdropUrl:
        (subj.stills && subj.stills.url) || (subj.cover && subj.cover.url) || null,
      rating,
      ratingCount: subj.imdbRatingCount ? Number(subj.imdbRatingCount) || null : null,
      hasResource: !!subj.hasResource,
      source: resource.source || null,
      uploadBy: resource.uploadBy || null,
      trailer: trailerUrl ? { url: trailerUrl, source: "boxmovies" } : null,
      seasons,
      cast: cast.filter(Boolean) as BoxDetail["cast"],
      reviews: reviews.filter(Boolean) as BoxDetail["reviews"],
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Anime (alias for /browse with channelId=7 → h5-api 1006)
// ---------------------------------------------------------------------------

export interface BoxAnimeEnvelope {
  ok: boolean;
  count: number;
  items: BoxMediaCard[];
  sections: BoxHomeSection[];
}

export async function getBoxmoviesAnime(): Promise<BoxAnimeEnvelope> {
  const r = await getBoxmoviesBrowse(7, { perPage: 50 });
  // Wrap so the UI can treat it as both a flat list and a single section.
  return {
    ok: true,
    count: r.items.length,
    items: r.items,
    sections: [
      {
        title: "Animation",
        count: r.items.length,
        items: r.items,
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Related / "More Like This" — derived from /home sections
// ---------------------------------------------------------------------------

const TV_KEYWORDS = [
  "tv",
  "series",
  "show",
  "anime",
  "animation",
  "novel",
  "kdrama",
  "korean",
];
const MOVIE_KEYWORDS = [
  "movie",
  "film",
  "cinema",
  "trending now",
  "punjabi",
  "hollywood",
  "bollywood",
];

function isTvSection(title: string): boolean {
  const t = title.toLowerCase();
  return TV_KEYWORDS.some((k) => t.includes(k));
}

function isMovieSection(title: string): boolean {
  const t = title.toLowerCase();
  return MOVIE_KEYWORDS.some((k) => t.includes(k));
}

/**
 * Stable shuffle.
 *
 * "More Like This" used to be shuffled with Math.random(), which made the
 * related block change on every single render. That is bad for two reasons:
 * a crawler sees a different set of internal links on every visit, and a
 * visitor who clicks back to the page finds the tiles moved. Seeding the
 * shuffle with the title's own detailPath keeps the ordering stable for a
 * given title (and different between titles) without any randomness at
 * render time.
 */
function shuffleDeterministic<T>(items: T[], seed: string): void {
  // FNV-1a over the seed string.
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  // mulberry32 — small, fast, deterministic.
  let a = h >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
}

export async function getBoxmoviesRelated(
  detailPath: string,
  kind: "movie" | "tv" = "movie",
  limit = 12
): Promise<BoxMediaCard[]> {
  try {
    const home = await getBoxmoviesHome();
    const sections = home.sections ?? [];
    const explicit = sections.filter((s) =>
      /trending|popular|top|hot|now/i.test(s.title)
    );
    const matching = sections.filter(
      (s) =>
        (kind === "tv" ? isTvSection(s.title) : isMovieSection(s.title)) &&
        !explicit.includes(s)
    );
    const others = sections.filter(
      (s) => !explicit.includes(s) && !matching.includes(s)
    );
    const pool: BoxMediaCard[] = [];
    const seen = new Set<string>();
    seen.add(detailPath);
    function take(list: typeof sections, per: number) {
      for (const sec of list) {
        for (const it of sec.items ?? []) {
          if (!it?.detailPath) continue;
          if (seen.has(it.detailPath)) continue;
          seen.add(it.detailPath);
          pool.push(it);
          if (pool.length >= limit * 3) return;
        }
        if (pool.length >= per) return;
      }
    }
    take(explicit, 6);
    take(matching, 6);
    take(others, 4);
    shuffleDeterministic(pool, detailPath);
    return pool.slice(0, limit);
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Stream — goes through the thin relay
//
// The thin relay handles Bearer auth, source extraction, and the /mp4
// proxy. The Next.js app just calls /stream and gets back the same
// shape the Android app gets.
// ---------------------------------------------------------------------------

export interface BoxStreamEnvelope {
  sources: BoxSource[];
  captions: BoxCaption[];
  detailPath: string;
  season: number;
  episode: number;
  subjectId?: string;
  hasResource?: boolean;
  isLimited?: boolean;
  vipLocked?: boolean;
  freeStreamsRemaining?: number;
  count: number;
}

class RelayError extends Error {
  status: number;
  constructor(message: string, status = 0) {
    super(message);
    this.name = "RelayError";
    this.status = status;
  }
}

export async function getBoxmoviesStream(
  detailPath: string,
  season = 0,
  episode = 0,
  subjectId = ""
): Promise<BoxStreamEnvelope> {
  // The thin relay requires a subjectId for /stream. Web cards don't
  // carry it (we'd have to do N detail calls to populate every card on
  // home), so resolve it once here if the caller didn't pass it.
  if (!subjectId) {
    const detail = await getBoxmoviesDetail(detailPath);
    if (detail) {
      const sid = detail.subjectId || (detail as any).id;
      if (sid) subjectId = String(sid);
    }
  }

  const params = new URLSearchParams({
    detailPath: String(detailPath),
    season: String(season),
    episode: String(episode),
  });
  if (subjectId) params.set("subjectId", subjectId);
  const url = `${STREAM_RELAY_URL}/stream?${params.toString()}`;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 20_000);
  let r: Response;
  try {
    r = await fetch(url, {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: ctrl.signal,
    });
  } catch (e: any) {
    if (e?.name === "AbortError") {
      throw new RelayError(`relay /stream timed out for ${detailPath}`);
    }
    throw new RelayError(`relay /stream fetch error: ${e?.message || e}`);
  } finally {
    clearTimeout(t);
  }
  if (!r.ok) {
    const text = await r.text().catch(() => "");
    throw new RelayError(
      `relay /stream -> HTTP ${r.status}: ${text.slice(0, 200)}`,
      r.status
    );
  }
  // The thin relay's response shape:
  //   { ok, source, code, message, data: { streams, captions, hasResource, ... } }
  // Streams and captions are already proxied (URLs go through the
  // relay's own /mp4 and /subtitle endpoints) so we just pass them
  // through with field renames.
  const j = await r.json();
  if (!j || !j.ok) {
    return {
      sources: [],
      captions: [],
      detailPath,
      season,
      episode,
      count: 0,
    };
  }
  const d = j.data || {};
  const rawStreams: any[] = Array.isArray(d.streams) ? d.streams : [];
  const rawCaptions: any[] = Array.isArray(d.captions) ? d.captions : [];
  // Map the relay's stream fields → BoxSource. The relay's "resolution"
  // is a single number; the web app's BoxSource has both `quality` (string
  // like "720p") and `resolution` (number). Synthesize the quality label
  // from the resolution when the relay didn't set one.
  const sources: BoxSource[] = rawStreams.map((s: any) => {
    const res = Number(s.resolution) || Number(s.resolutions) || 0;
    const quality =
      typeof s.quality === "string" && s.quality
        ? s.quality
        : res > 0
        ? `${res}p`
        : "Auto";
    return {
      id: s.id ? String(s.id) : undefined,
      url: s.url,
      type: "mp4",
      quality,
      resolution: res,
      sizeBytes: Number(s.size) || Number(s.sizeBytes) || 0,
      durationSeconds: Number(s.duration) || 0,
      format: s.format || "mp4",
      codec: s.codecName || s.codec || undefined,
      vipLocked: !!s.vipLocked,
      subtitles: rawCaptions.map((c: any) => ({
        id: c.id,
        url: c.url,
        languageCode: c.languageCode || "en",
        language: c.language || c.languageCode || "Unknown",
        delay: c.delay || 0,
        sizeBytes: 0,
      })),
      provider: { id: "boxmovies" as const, name: "BoxMovies" },
    };
  });

  // The ladder is sorted DESCENDING: best rung first, so index 0 is the
  // best quality available. The player's default is index 0 (the parent
  // hard-codes activeSourceIndex={0}), which is why an ascending ladder
  // made the site auto-play 360p even though the upstream was serving
  // 1080p all along. Sorting here instead of trusting the upstream order
  // means the app's contract holds no matter which backend answered.
  sources.sort((a, b) => (b.resolution || 0) - (a.resolution || 0));

  const captions: BoxCaption[] = rawCaptions.map((c: any) => ({
    id: c.id,
    url: c.url,
    languageCode: c.languageCode || "en",
    language: c.language || c.languageCode || "Unknown",
    delay: c.delay || 0,
    sizeBytes: 0,
  }));
  return {
    sources,
    captions,
    detailPath,
    season,
    episode,
    subjectId: j.subjectId || d.subjectId || undefined,
    hasResource: !!d.hasResource,
    isLimited: !!d.limited,
    vipLocked: !!d.vipLocked,
    freeStreamsRemaining: j.playsRemaining,
    count: sources.length,
  };
}

// ---------------------------------------------------------------------------
// Best-match utility (search → exact subject)
// ---------------------------------------------------------------------------

export function pickBestMatch(
  results: BoxMediaCard[],
  queryTitle: string
): BoxMediaCard | null {
  if (results.length === 0) return null;
  const norm = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const needle = norm(queryTitle);
  for (const r of results) {
    if (norm(r.title) === needle) return r;
  }
  for (const r of results) {
    const hay = norm(r.title);
    if (hay.startsWith(needle) || needle.startsWith(hay)) return r;
  }
  return results[0];
}
