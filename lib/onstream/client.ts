/**
 * OnStream (aoneroom) mobile BFF client.
 *
 * SERVER ONLY — this module reaches `node:crypto` through `./gateway`.
 *
 * ---------------------------------------------------------------------------
 * What this does
 * ---------------------------------------------------------------------------
 * Resolves a real, signed, playable media URL for an episode, straight from
 * the OnStream backend — the same chain the OnStream app runs:
 *
 *   1. subject-api/bottom-tab      → session bootstrap, returns the `x-user`
 *                                    bearer token
 *   2. subject-api/resource         → resolution sweep (360/480/720/1080) for
 *                                    the requested episode; each row carries a
 *                                    third-party `sourceUrl` (the source page)
 *   3. sniff/config                 → resolves that `sourceUrl` into the real
 *                                    signed media file on bcdn.hakunaymatata.com
 *   4. subject-api/get-ext-captions → the subtitle tracks for the episode
 *   5. subject-api/season-info      → the season/episode map (used by the
 *                                    sitemap generator)
 *
 * The media URL that comes out of step 3 is a plain upstream URL. The site's
 * own `/api/video-proxy` picks it up and streams the bytes, so nothing here
 * has to care about how the media is delivered.
 *
 * ---------------------------------------------------------------------------
 * What this deliberately does NOT do
 * ---------------------------------------------------------------------------
 * `subject-api/play-info` is NOT the episode resolver. It answers with a
 * 23-second advertisement placeholder on macdn.aoneroom.com, not the
 * episode. The real file only appears after `sniff/config`, which is why
 * the sweep below is two steps and not one.
 *
 * `subject-api/get` exposes `resourceDetectors`, but for real titles its
 * `resolutionList` comes back EMPTY, so the detectors path is unusable and
 * the resolution sweep is the only route that works.
 */

import {
  type GatewayKeyMaterial,
  ONSTREAM_BASE_URL,
  ONSTREAM_MOBILE_BFF,
  ONSTREAM_USER_AGENT,
  buildNonce,
  clientBuild,
  clientInformation,
  clientToken,
  defaultIdentity,
  gatewayKeyMaterial,
  signRequest,
  signatureHeader,
} from "./gateway";

export type OnStreamParam = [string, string];

/** One rung of the quality ladder. */
export interface OnStreamRung {
  /** 360 / 480 / 720 / 1080. */
  resolution: number;
  /** "1080p" */
  quality: string;
  /** The real signed media URL. */
  url: string;
  /** Real byte size of the file, from the sniff response. */
  sizeBytes: number;
  /** Real duration in seconds. */
  durationSeconds: number;
  /** "h264" / "hevc" */
  codec: string;
  /** Container, when the upstream reports one. */
  format: string;
  /** The episode's resource id — needed to fetch captions. */
  resourceId: string;
}

export interface OnStreamCaption {
  id: string;
  url: string;
  languageCode: string;
  language: string;
  delay: number;
  sizeBytes: number;
}

export interface OnStreamEpisode {
  subjectId: string;
  season: number;
  episode: number;
  durationSeconds: number;
  totalEpisodes: number;
  /** Best first. */
  rungs: OnStreamRung[];
  captions: OnStreamCaption[];
}

export interface OnStreamSeason {
  se: number;
  maxEp: number;
  allEp: number;
  /** [{ resolution, epNum }] */
  resolutions: { resolution: number; epNum: number }[];
}

export class OnStreamError extends Error {
  status: number;
  constructor(message: string, status = 0) {
    super(message);
    this.name = "OnStreamError";
    this.status = status;
  }
}

/** A parsed JSON object. The upstream's shape is not typed, so we narrow. */
type Json = Record<string, unknown>;

function asRecord(value: unknown): Json | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Json)
    : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

const REQUEST_TIMEOUT_MS = 12_000;

/** The resolutions we sweep, best first. */
export const ONSTREAM_RESOLUTIONS = [1080, 720, 480, 360] as const;

const identity = defaultIdentity();

// ---------------------------------------------------------------------------
// Session
// ---------------------------------------------------------------------------

let session: { token: string; at: number } | null = null;
const SESSION_TTL_MS = 30 * 60 * 1000;

/**
 * The signed GET.
 *
 * `accept` is part of the signature, so the exact same string is signed and
 * transmitted. Sending a different Accept than the one that was signed makes
 * the gateway reset the connection.
 */
async function signedFetch(
  material: GatewayKeyMaterial,
  path: string,
  params: OnStreamParam[],
  accept: string,
  token: string | null,
): Promise<Response> {
  const fullPath = `${ONSTREAM_MOBILE_BFF}${path}`;
  const rawQuery = params
    .map(([n, v]) => `${encodeURIComponent(n)}=${encodeURIComponent(v)}`)
    .join("&");
  const url = `${ONSTREAM_BASE_URL}${fullPath}${rawQuery ? `?${rawQuery}` : ""}`;

  const timestamp = Date.now();
  const build = clientBuild(material, buildNonce());
  const headers: Record<string, string> = {
    "User-Agent": ONSTREAM_USER_AGENT,
    Accept: accept,
    "X-Client-Info": clientInformation(build, identity),
    "X-Client-Build": build,
    "X-Client-Status": "0",
    "X-Play-Mode": "2",
    "X-Family-Mode": "0",
    "X-Idle-Data": "1",
    "x-tr-signature": signatureHeader(
      timestamp,
      signRequest(
        material,
        "GET",
        fullPath,
        rawQuery,
        accept,
        timestamp,
      ),
    ),
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  } else {
    headers["X-Client-Token"] = clientToken(Date.now());
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, {
      method: "GET",
      headers,
      cache: "no-store",
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

/** A signed GET that returns parsed JSON, or throws. */
async function signedJson(
  material: GatewayKeyMaterial,
  path: string,
  params: OnStreamParam[],
  token: string | null,
): Promise<Json> {
  const res = await signedFetch(material, path, params, "application/json", token);
  const text = await res.text();
  if (!res.ok) {
    throw new OnStreamError(
      `onstream ${path} -> HTTP ${res.status}: ${text.slice(0, 200)}`,
      res.status,
    );
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new OnStreamError(`onstream ${path} returned non-JSON`);
  }
  const envelope = asRecord(parsed);
  if (!envelope) throw new OnStreamError(`onstream ${path} returned non-object`);
  const code = envelope.code;
  if (typeof code === "number" && code !== 0) {
    throw new OnStreamError(
      `onstream ${path} returned code=${code}: ${text.slice(0, 160)}`,
      res.status,
    );
  }
  return envelope;
}

/**
 * The session bearer token.
 *
 * The bootstrap needs the full signed identity (signature + client info +
 * client token). Everything afterwards only needs the signature plus the
 * bearer, which is what the live backend accepts.
 */
export async function bootstrapSession(): Promise<string | null> {
  if (session && Date.now() - session.at < SESSION_TTL_MS) return session.token;

  const material = gatewayKeyMaterial();
  if (!material) return null;

  const res = await signedFetch(
    material,
    "/subject-api/bottom-tab",
    [["host", "moviebox.ph"]],
    "application/json",
    null,
  );
  if (!res.ok) {
    throw new OnStreamError(`onstream bootstrap -> HTTP ${res.status}`, res.status);
  }
  const xUser = res.headers.get("x-user");
  if (!xUser) throw new OnStreamError("onstream bootstrap: no x-user header");

  let token = "";
  try {
    token = JSON.parse(xUser).token || "";
  } catch {
    token = "";
  }
  if (!token) throw new OnStreamError("onstream bootstrap: empty token");

  session = { token, at: Date.now() };
  return token;
}

// ---------------------------------------------------------------------------
// Resolution
// ---------------------------------------------------------------------------

interface SweepRow {
  se?: number;
  ep?: number;
  episode?: number;
  title?: string;
  resourceLink?: string;
  sourceUrl?: string;
  resourceId?: string;
  size?: number;
  duration?: number;
  codecName?: string;
  format?: string;
  resolution?: number;
  extCaptions?: unknown[];
}

/** The placeholder media the upstream serves before the real file is known. */
function isPlaceholder(link: string | undefined): boolean {
  if (!link) return true;
  return /macdn\.aoneroom\.com/.test(link);
}

/**
 * Resolve one episode into a full quality ladder.
 *
 * Returns null when the OnStream path is not configured or the subject has
 * no resource for that episode. Never throws for an expected condition — the
 * caller falls back to the relay.
 */
export async function resolveEpisode(
  subjectId: string,
  season: number,
  episode: number,
  resolutions: readonly number[] = ONSTREAM_RESOLUTIONS,
): Promise<OnStreamEpisode | null> {
  const material = gatewayKeyMaterial();
  if (!material) return null;

  const token = await bootstrapSession();
  if (!token) return null;

  // ---- 1. resolution sweep (parallel, like the app) ----------------------
  //
  // `resolution` on subject-api/resource is a FILTER, not a selector: the
  // endpoint answers with every episode of the subject that exists at that
  // rung, paginated. The `se` / `epFrom` / `epTo` parameters are accepted
  // but IGNORED upstream — measured live: asking for se=1 epFrom=1 epTo=1
  // still returns rows for seasons 1, 2 and 4. So the episode is selected
  // client side, by the row's own `se` and `ep`.
  //
  // `perPage` is capped at 20 upstream (perPage=50 answers
  // {"code":400,"reason":"PARAMS_ERROR"}), so 20 is the most we can ask
  // for and the sweep stays a single request per rung.
  const swept = await Promise.all(
    resolutions.map(async (resolution) => {
      try {
        const json = await signedJson(
          material,
          "/subject-api/resource",
          [
            ["subjectId", subjectId],
            ["page", "1"],
            ["perPage", "20"],
            ["all", "0"],
            ["startPosition", "1"],
            ["endPosition", "1"],
            ["pagerMode", "0"],
            ["resolution", String(resolution)],
            ["se", String(season)],
            ["epFrom", String(episode)],
            ["epTo", String(episode)],
          ],
          token,
        );
        const data = asRecord(json.data);
        const rows = asArray(data?.list) as SweepRow[];

        // Prefer the requested episode. Fall back to the first row of the
        // rung, which is what a movie (a single episode) returns.
        const row =
          rows.find(
            (r) => asNumber(r.se) === season && asNumber(r.ep) === episode,
          ) ?? rows[0] ?? null;

        return {
          resolution,
          row,
          totalEpisode: asNumber(data?.totalEpisode),
          duration: asNumber(data?.durationSeconds),
        };
      } catch {
        return { resolution, row: null, totalEpisode: 0, duration: 0 };
      }
    }),
  );

  // ---- 2. one source per rung, resolved through sniff/config --------------
  const candidates: {
    resolution: number;
    sourceUrl: string;
    resourceId: string;
  }[] = [];
  const seen = new Set<string>();

  for (const bucket of swept) {
    const row = bucket.row;
    if (!row) continue;
    const sourceUrl =
      row.sourceUrl ||
      (row.resourceLink && !isPlaceholder(row.resourceLink)
        ? row.resourceLink
        : "");
    if (!sourceUrl || seen.has(sourceUrl)) continue;
    seen.add(sourceUrl);
    candidates.push({
      resolution: asNumber(row.resolution) || bucket.resolution,
      sourceUrl,
      resourceId: asString(row.resourceId),
    });
  }

  if (!candidates.length) return null;

  const sniffed = await Promise.all(
    candidates.map(async (candidate) => {
      try {
        const json = await signedJson(
          material,
          "/sniff/config",
          [
            ["linkUrl", candidate.sourceUrl],
            ["subjectId", subjectId],
          ],
          token,
        );
        const data = asRecord(json.data);
        const resource = asRecord(data?.resource) ?? {};
        const url: string =
          asString(resource.resourceLink) || asString(data?.downloadUrl);
        if (!url || isPlaceholder(url)) return null;
        return {
          resolution: candidate.resolution,
          quality: `${candidate.resolution}p`,
          url,
          sizeBytes: asNumber(resource.size),
          durationSeconds: asNumber(resource.duration),
          codec: asString(resource.codecName) || asString(resource.codec),
          format: asString(resource.format) || "mp4",
          resourceId:
            asString(resource.resourceId) || candidate.resourceId || "",
        } as OnStreamRung;
      } catch {
        return null;
      }
    }),
  );

  const rungs = sniffed.filter((r): r is OnStreamRung => r !== null);
  if (!rungs.length) return null;

  // Best first. The player auto-plays index 0, so this ordering IS the
  // "best available quality" behaviour.
  rungs.sort((a, b) => b.resolution - a.resolution);

  // ---- 3. captions --------------------------------------------------------
  const captions = await fetchCaptions(material, token, rungs);

  const first = swept.find((b) => b.row);
  return {
    subjectId,
    season,
    episode,
    durationSeconds:
      rungs.find((r) => r.durationSeconds > 0)?.durationSeconds ??
      first?.duration ??
      0,
    totalEpisodes: first?.totalEpisode ?? 0,
    rungs,
    captions,
  };
}

/** The subtitle tracks for an episode, from the first resource id that works. */
async function fetchCaptions(
  material: GatewayKeyMaterial,
  token: string,
  rungs: OnStreamRung[],
): Promise<OnStreamCaption[]> {
  const resourceIds = [
    ...new Set(rungs.map((r) => r.resourceId).filter(Boolean)),
  ];

  for (const resourceId of resourceIds) {
    try {
      const json = await signedJson(
        material,
        "/subject-api/get-ext-captions",
        [["resourceId", resourceId]],
        token,
      );
      const raw = asArray(asRecord(json.data)?.extCaptions);
      if (!raw.length) continue;
      return raw.map((entry, i) => {
        const c = asRecord(entry) ?? {};
        return {
          id: asString(c.id) || `${resourceId}-${i}`,
          url: asString(c.url),
          languageCode: asString(c.lan) || "en",
          language: asString(c.lanName) || asString(c.lan) || "Unknown",
          delay: asNumber(c.delay),
          sizeBytes: asNumber(c.size),
        };
      });
    } catch {
      /* try the next resource id */
    }
  }
  return [];
}

/** The season/episode map for a subject. */
export async function getSeasonInfo(
  subjectId: string,
): Promise<OnStreamSeason[]> {
  const material = gatewayKeyMaterial();
  if (!material) return [];
  const token = await bootstrapSession();
  if (!token) return [];

  try {
    const json = await signedJson(
      material,
      "/subject-api/season-info",
      [["subjectId", subjectId]],
      token,
    );
    const raw = asArray(asRecord(json.data)?.seasons);
    return raw.map((entry) => {
      const s = asRecord(entry) ?? {};
      return {
        se: asNumber(s.se),
        maxEp: asNumber(s.maxEp),
        allEp: asNumber(s.allEp),
        resolutions: asArray(s.resolutions).map((r) => {
          const rec = asRecord(r) ?? {};
          return {
            resolution: asNumber(rec.resolution),
            epNum: asNumber(rec.epNum),
          };
        }),
      };
    });
  } catch {
    return [];
  }
}

/** The subject's own metadata (title, seasons, episode count, …). */
export async function getSubject(subjectId: string): Promise<Json | null> {
  const material = gatewayKeyMaterial();
  if (!material) return null;
  const token = await bootstrapSession();
  if (!token) return null;

  try {
    const json = await signedJson(
      material,
      "/subject-api/get",
      [
        ["subjectId", subjectId],
        ["version", "def99f2"],
      ],
      token,
    );
    return asRecord(json.data);
  } catch {
    return null;
  }
}
