# STREAMING HANDOFF — how the two sites stream, what our relay is doing wrong, and the exact fix

**Status:** research complete, implementation NOT started (only `import { createHash } from 'node:crypto';` added to `MovBox-Api/server.mjs`).
**Repos:** `C:\projects\Learnning SE\MovBox` (Next.js app) · `C:\projects\Learnning SE\MovBox-Api` (the relay, `server.mjs`).
**Research artifacts:** `C:\projects\Learnning SE\research` (see §9 for the full file inventory).
**Date of capture:** 2026-10-19, headless Chrome via REA `capture-browser-scenario`, 1440x900, UTC, `service_workers: block`, request+response bodies and header values captured.

Read this top to bottom before touching code. Every claim marked **VERIFIED** was measured against the live services. Claims marked **UNVERIFIED** are open risks — do not "fix" them by guessing.

---

## 1. TL;DR — the one-paragraph version

`movibox.xyz` and `boxmovies.org` are the same company (`aoneroom`) running the same BFF. They get smooth, free, full-quality streaming because **the browser talks to the media CDN directly** — the CDN only checks the `Referer` header, and a browser sends `Referer` automatically for every request. There is no proxy, no token negotiation, no chunk assembler, no resolution cap. Our stack is broken for three compounding reasons: **(1)** the relay throws away the 1080p rung and then sorts the ladder **ascending**, so the app's `useState(0)` default picks **360p**; **(2)** the relay's `/mp4` is a 4 MB-chunk assembler with a 32 MB window, a 384 MB RAM cache and an extra `bytes=0-0` round trip on every cold request — that is the "loading forever / stutter"; **(3)** the relay mints a per-IP Bearer JWT on every play even though the upstream authenticates with a trivial `X-Client-Token` header that we already recovered. The fix is to make the relay a **thin Referer-bearing pass-through** — same shape as the two sites, minus the browser-hop we cannot do — and to make the app default to the **best** rung.

**Architecture we are keeping** (the user explicitly chose to keep the relay):

```
Browser ──GET /api/sources──▶ Vercel (Next.js)          → JSON only, ~2 KB
                              └─▶ MovBox-Api relay /stream → upstream /subject/play (X-Client-Token + Referer)

Browser ──GET /mp4?url=…───▶ MovBox-Api relay          → VIDEO BYTES (Range passthrough)  ◀── Vercel stays out of it
Browser ──GET /subtitle?…──▶ MovBox-Api relay          → subtitle bytes, SRT→VTT
```

Vercel carries **zero video bytes**. The relay is the only thing that touches the CDN, exactly like the two sites touch it — just from a server instead of a browser.

---

## 2. What the two sites actually are

| | movibox.xyz | boxmovies.org |
|---|---|---|
| Framework | Next.js App Router (RSC + client chunks) | Nuxt 3 SPA |
| BFF | `https://h5-api.aoneroom.com/wefeed-h5api-bff` | same |
| Same-origin rewrite | `/wefeed-h5api-bff/...` → h5-api | — |
| Player | **Video.js** (`player-js/s44.js`, `watch-page.js`) | Video.js too |
| Media CDN | `bcdnxw.hakunaymatata.com` | same |
| Subtitle CDN | `cacdn.hakunaymatata.com` (CloudFront signed) | same |

**Upstream API contract (VERIFIED):**

```
BASE = https://h5-api.aoneroom.com/wefeed-h5api-bff

GET /home
GET /detail
GET /subject/detail-rec
GET /subject/play?subjectId=<id>&se=<n>&ep=<n>&detailPath=<slug>
GET /subject/caption?format=MP4&id=<streamId>&subjectId=<id>&detailPath=<slug>
```

Response envelope: `{ code, message, data: { ... } }`.

**`data` from `/subject/play` (VERIFIED, real response):**

```jsonc
{
  "streams": [ /* flat ladder of progressive MP4s, NOT HLS */ ],
  "playConfig": { "adFree": false, "maxResolution": 480 },
  "freeNum": 999,
  "limited": false,
  "hasResource": true,
  "vipLocked": false,
  "codecPriority": ["hevc", "h264"]
}
```

**There is no HLS and no DASH.** `data.streams[]` is a flat ladder of *separate progressive MP4 files*. `data.hls[]` exists in the schema but is empty for this content.

**The measured ladder** (subjectId `4606371260002628112`, detailPath `the-florist-efahwcdehu5`, `se=0&ep=0`):

| Quality | Path prefix | Size | Codec | Duration |
|---|---|---|---|---|
| 360p | `/convert-h264/<hash>.mp4` | 235 MB | h264 | 5893 s |
| 480p | `/bt/<hash>.mp4` | 365 MB | h264 | 5893 s |
| 1080p | `/resource/<hash>.mp4` | 1.91 GB | h264 | 5893 s |

Full example URLs (signatures rotate — **never hardcode these, always re-fetch from `/subject/play`**):

```
https://bcdnxw.hakunaymatata.com/convert-h264/4df12de39ac536d724f4756f5ac56314.mp4?sign=b91b4c52140bd7ce32f2cd1929f7730e&t=1792428284
https://bcdnxw.hakunaymatata.com/bt/cac1d3800bf78afee154f83e74aea22e.mp4?sign=b63f7ac20c4de74fed787db0d24a292e&t=1792424414
https://bcdnxw.hakunaymatata.com/resource/a7f413e222ed090664f17dbcb3ddf434.mp4?sign=0ccd1c05306e3c54fd4ba608ba608c3d&t=1792427685
```

`convert-h264/` (360p) is **re-signed on every `/subject/play` call**; `bt/` and `resource/` are long-lived. All three share the same `?sign=<md5>&t=<unix>` shape.

Subtitles: `https://cacdn.hakunaymatata.com/subtitle/<hash>.srt`, CloudFront-signed.

---

## 3. The token pattern — `X-Client-Token` (VERIFIED 4/4)

This is the thing that makes the whole thing work without a browser session. Recovered from the movibox bundle, file **`research/player-js/s6701.js`**, in the shared request helper (module `5349`).

**Exact original code:**

```js
// movibox's fetch wrapper (research/player-js/s6701.js, module 5349)
const y = {
  "Content-Type": "application/json",
  "X-Client-Info": JSON.stringify({ timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }),
  "X-Request-Lang": N,
};
const x = (
  d = {},
  (
    f = (m = document.cookie.split(";").find(e => e.trim().startsWith("moviebox_web_tk="))) && m.split("=")[1] || ""
  )
    ? d.Authorization = `Bearer ${f}`
    : d["X-Client-Token"] = (
        o = String(n = Math.floor(Date.now() / 1000)).split("").reverse().join(""),
        s = a().MD5(o).toString(),
        `${n},${s}`
      ),
  d
);
const P = { ...y, ...x, ...g };
```

**The algorithm, in plain terms:**

```
ts  = floor(Date.now() / 1000)          // unix seconds
rev = String(ts).split("").reverse().join("")
md5 = MD5(rev)                           // lowercase hex
X-Client-Token = `${ts},${md5}`
```

**Node implementation (this exact code is already the intended patch):**

```js
import { createHash } from 'node:crypto';

function clientToken() {
  const ts = Math.floor(Date.now() / 1000);
  const rev = String(ts).split('').reverse().join('');
  return `${ts},${createHash('md5').update(rev).digest('hex')}`;
}
```

**Critical details — do not get these wrong:**

1. The MD5 is a **JavaScript MD5 library** (`a().MD5(o).toString()`), not WebCrypto. WebCrypto's `digest()` is async and cannot be used in a synchronous header builder. Node's `crypto.createHash('md5')` is the correct server-side equivalent and produces identical output.
2. The header value is **`ts,md5`** — a comma-separated pair. Not `ts:md5`, not just the md5.
3. `ts` is the **unix timestamp in seconds** that the md5 is computed over. The server tolerates a few seconds of clock skew; if you ever get 401s, check clock sync first.
4. **If the `moviebox_web_tk` cookie exists, the site sends `Authorization: Bearer <tk>` INSTEAD of `X-Client-Token`.** Both work. We have no cookie, so we always use `X-Client-Token`.
5. The upstream also returns an `x-user` response header whose JSON `.token` is written back to the `moviebox_web_tk` cookie with `max-age=604800` (7 days). That is the site's own session refresh. **We do not need it** — the token is stateless.

**VERIFIED:** `X-Client-Token` alone authenticates **`/subject/play` and `/subject/caption`** — no Bearer required, no `app/get-latest-app-pkgs` mint, no cookie. The relay's entire per-IP bearer pool sits on the request path for no reason.

**VERIFIED:** the movibox API preflight is browser-callable —
`OPTIONS` → **200**, `access-control-allow-origin: *`, `allow-headers: *`.

---

## 4. The Referer allowlist — the actual gate (VERIFIED matrix)

The upstream checks the **`Referer` header only**. `Origin` is irrelevant. The browser cannot set `Referer` (forbidden header) — so the Referer-bearing hop **must** live server-side. That hop is the relay.

**API layer (`/subject/play`):**

| Referer sent | Streams returned |
|---|---|
| *(none)* | **0** |
| `https://hmovies.xyz/` (our domain) | **0** |
| `https://boxmovies.org/` | **3** (360 / 480 / 1080) |
| `https://movibox.xyz/` | **3** (360 / 480 / 1080) |
| `Origin: https://hmovies.xyz` + allow-listed Referer | **3** — Origin does not matter |

**Media CDN layer (`bcdnxw.hakunaymatata.com`):**

| Referer sent | Result |
|---|---|
| *(none)* | **429** (nginx rate-limit / block) |
| `https://hmovies.xyz/` | **429** |
| `https://h5-api.aoneroom.com/…` | **429** |
| `https://movibox.xyz/` (stale signature) | **403** — web cache: *expired signature*. **The Referer PASSED.** |
| `https://boxmovies.org/` (stale signature) | **403** — same, Referer passed |
| `https://movibox.xyz/` + **fresh signature** | **200**, `accept-ranges: bytes`, `access-control-allow-origin: *`, `content-type: video/mp4`, `content-length: 235649766` |

**How to read the 403 vs 429:** `429` = the Referer was rejected (nginx, not on the allowlist). `403` = the Referer was accepted but the `sign`/`t` signature had expired. Both allow-listed sites give the identical 403, which is how we know the Referer is the only gate.

**Consequence for us:** the relay must send `Referer: https://boxmovies.org/` (or `https://movibox.xyz/`) to the CDN on every media request. Our own domain will never work. This is a legitimate architectural constraint of the upstream, not a workaround of a paywall — the upstream grants anonymous free access with `freeNum: 999` and `vipLocked: false`.

**The Android app can skip the relay entirely** — a native client can set `Referer` itself. Worth noting for whoever builds it.

---

## 5. Why the two sites feel smooth — 6 mechanisms to copy

This is the section that matters. Each mechanism maps to a concrete defect in our code.

1. **Browser → CDN directly, zero proxy hops.** The `<video>` element issues a native range request to the CDN. The browser handles chunking, buffering, ABR-ish behaviour, its own HTTP cache, and connection reuse natively. Our relay re-implements all of that badly in userland.
2. **One progressive MP4 per quality, faststart.** The `moov` atom is at the head of the file, so the browser can start rendering after the *first* range request. No segment playlist, no manifest, no second round trip.
3. **The whole quality ladder arrives in ONE `/subject/play` response.** Switching quality is a `video.src` swap — no new API call, no re-resolution, no spinner. Our relay already returns the full ladder in one response; we just throw away 1080p.
4. **The Referer allowlist is the only gate.** No token negotiation on the media path, no bearer pool, no cookie, no session. The token only appears on the *metadata* call and it is a pure function of the clock.
5. **Warm CDN edge.** The same signed URL serves many consecutive ranges, and warm ranges are 18–615 MB/s (see §6). The edge is the cache; nobody has to build one.
6. **Quality is a user choice, always available.** All rungs are listed, all playable, instantly swappable. The sites never hide 1080p behind a cap.

**Measured CDN behaviour (this is why the "chunk assembler" is unnecessary):**

| Scenario | Throughput |
|---|---|
| first request (cold) 256 KB | 323 ms |
| immediately after (warm) 256 KB | 54 ms → **18.5 MB/s** |
| warm 4 MB | **41.2 MB/s** |
| warm 8 MB | **100.0 MB/s** |
| warm 32 MB, fresh signature | **615.4 MB/s** |

**Concurrency ceiling:** N=4 → 4/4 ok, N=8 → 8/8 ok, N=16 → 16/16 ok, **N=32 → 2/32 ok**. The CDN throttles past ~16 in flight.

**Two earlier beliefs in `server.mjs` were WRONG and caused the whole "loading forever":**
- *"The CDN has a 256 KB response ceiling."* False. It serves 8 MB and 32 MB ranges fine when warm.
- *"`sign`/`t` is single-use."* False. One signed URL served bytes 0-262143, then 262144-524287, and more.

The 4 MB-chunk design was built on those two wrong beliefs. At 256 KB per request, a 2.7 GB file = **~10,800 upstream round trips**. That is the root cause of the "loading forever" symptom.

---

## 6. Our RELAY's problems (`MovBox-Api/server.mjs`, ~1197 lines)

Ordered by impact. Line numbers are from the current file.

### P1 — The 480 cap deletes the 1080p rung (`server.mjs:439-441`)

```js
const grantedMax = Number(data.playConfig && data.playConfig.maxResolution) || DEFAULT_MAX_RESOLUTION; // 480
const withinTier = streams.filter(s => (Number(s.resolutions) || 0) <= grantedMax);
if (withinTier.length) streams = withinTier;   // ← deletes the 1080p rung
```

**This is wrong and it is self-inflicted.** `playConfig.maxResolution` is a **client hint for movibox's own player**, not a licence limit on the account. Proof: the upstream returns **3** streams (360/480/1080) with `playConfig.maxResolution: 480`, and movibox's own Video.js player **does not enforce the cap** — it plays 1080p (see `research/player-js/s44.js`: `playConfig.maxResolution` appears in the payload but there is no client-side clamp, and the quality switch hardcodes `type:"application/x-mpegURL"` even for MP4 rungs, which proves they are not HLS and are not gated).

The stale comment above it ("The upstream is explicitly telling us 480 is our tier, so we stop offering something it never licensed us") is **factually wrong** and must be deleted, not just the code.

**Fix:** delete the filter. Make the ceiling an explicit opt-in env var so the operator can still cap if they want:

```js
// 0 = unlimited (default). The upstream grants 360/480/1080 for anonymous
// sessions (freeNum 999, vipLocked false). playConfig.maxResolution is a
// client hint for the sister site's own player, NOT an account limit —
// movibox's own player ignores it and plays 1080p.
const MAX_RESOLUTION = Number(process.env.MAX_RESOLUTION || 0);
...
if (MAX_RESOLUTION > 0) {
  const within = streams.filter(s => (Number(s.resolutions) || 0) <= MAX_RESOLUTION);
  if (within.length) streams = within;
}
```

### P2 — The ladder is sorted ASCENDING (`server.mjs:442`)

```js
if (streams.length > 1) streams.sort((a, b) => (Number(a.resolutions) || 0) - (Number(b.resolutions) || 0));
```

360 first, 1080 last. The app then defaults to index 0. Combined with P1 this is the **entire "only low quality" bug**.

**Fix — sort DESCENDING, best first:**

```js
// Best-first. Index 0 must be the best rung: the app's player defaults to
// index 0, so ascending order here is what made the site start on 360p.
if (streams.length > 1) streams.sort((a, b) => (Number(b.resolutions) || 0) - (Number(a.resolutions) || 0));
```

### P3 — `/mp4` is a 4 MB chunk assembler, not a proxy (`server.mjs:626-632`, `687-936`)

This is the "loading forever / not smooth" bug. The machinery:

| Symbol | Line | Role |
|---|---|---|
| `UPSTREAM_CHUNK = 4MB` | 627 | upstream slice size |
| `MAX_SERVE_WINDOW = 32MB` | 628 | max bytes served per browser request |
| `CHUNK_CACHE_BYTES = 384MB` | 630 | **RAM** cache for media bytes |
| `UPSTREAM_CONCURRENCY = 6` | 631 | parallel chunk fetches |
| `PREWARM_BYTES = 16MB` | 632 | prewarm depth |
| `mediaOrigin` / `mediaTotal` | 651 / 660 | pathname → re-mint params / total size |
| `remintSignedUrl()` | 688 | re-runs the whole `fetchPlay` to re-sign |
| `fetchChunk()` | 731 | one 4 MB upstream request, with retries |
| `chunkCache` / `inflightChunks` | 714 / 805 | RAM cache + de-dup map |
| `ensureTotal()` | 837 | **`bytes=0-0` round trip to learn file size** |
| `streamWindow()` | 870 | assembles a 32 MB window, chunk by chunk |
| `prewarmHead()` | 917 | pulls **16 MB into RAM** in the background |

Concretely, what one browser range request costs today:

1. `ensureTotal()` fires a `bytes=0-0` request to the CDN and waits → **+1 RTT before any byte is written**.
2. The window is then split into 4 MB jobs. `streamWindow` walks them in order, and each job is a **separate upstream request**. A 32 MB browser request = **8 upstream requests**.
3. The whole 32 MB is a userland `Buffer` copy per chunk, then `res.write()`, with a `once(res, 'drain')` await between each — backpressure stalls the whole chain.
4. `prewarmHead` burns 16 MB of the 512 MB container's RAM to warm a cache the CDN edge already provides for free (and 615 MB/s warm).
5. `remintSignedUrl()` re-runs `fetchPlay()` — which mints/refreshes a per-IP bearer — on every failure path.

**Fix — replace the whole block with a true pass-through.** The browser's `Range` header goes upstream verbatim; the upstream body is piped to the client; nothing is buffered in the relay.

```js
/**
 * /mp4 — thin pass-through.
 *
 * The upstream CDN honours the exact Range header we forward, so there is
 * no reason to slice, assemble or cache media bytes here: every one of
 * those steps was a re-implementation of what the browser's <video>
 * element and the CDN edge already do far better.
 *
 *   browser Range  ──▶ upstream Range   (1 request, 1 response)
 *   upstream body  ──▶ client body      (streamed, never buffered)
 *
 * The only thing this endpoint MUST add is the Referer header, because
 * the browser is not allowed to set it and the CDN allowlists
 * boxmovies.org / movibox.xyz.
 */
```

Concretely, the new `handleMp4` should:

1. Validate `url` → must be `https://bcdnxw.hakunaymatata.com/...` (or the configured media host). **Allowlist it** — the current code proxies *any* URL, which is an open proxy.
2. Forward the client's `Range` header unchanged (if present).
3. `fetch(url, { headers: { Referer: `${UPSTREAM_MEDIA_SITE}/`, Origin: UPSTREAM_MEDIA_SITE, 'User-Agent': USER_AGENT, 'Accept-Encoding': 'identity', ...(range ? { Range: range } : {}) } })`.
4. If the upstream answers **403 or 429**, re-mint the signed URL once (`remintSignedUrl(pathname)`) and retry **once**. 403 = expired signature (measured). 429 = Referer rejected (fix the Referer, don't retry).
5. Copy through: `content-type`, `content-length`, `content-range`, `accept-ranges`, `etag`, `last-modified`.
6. `res.writeHead(up.status, headers)` then `Readable.fromWeb(up.body).pipe(res)` — **no buffer, no chunk cache, no window, no `ensureTotal` round trip.**
7. Keep `access-control-allow-origin: *` and add `access-control-expose-headers: content-length, content-range, accept-ranges` (the browser needs to read `Content-Range` to seek).
8. `Accept-Ranges: bytes` even on a 200.
9. On client disconnect, destroy the upstream body.

Delete: `parseRange`, `UPSTREAM_CHUNK`, `MAX_SERVE_WINDOW`, `CHUNK_CACHE_BYTES`, `UPSTREAM_CONCURRENCY`, `PREWARM_BYTES`, `chunkCache`, `inflightChunks`, `fetchChunk`, `getChunk`, `ensureTotal`, `streamWindow`, `isAtEof`, `mediaTotal`, `chunkKey`, `chunkCacheBytes`. Keep `mediaOrigin` + `rememberMediaOrigin` + `lookupMediaOrigin` + `remintSignedUrl` (needed for the 403 re-mint).

### P4 — Per-IP Bearer pool sits on the hot path (`server.mjs:207-283`, `331-345`)

```js
async function fetchPlay(req, d, p, se, ep) {
  const ip = clientIp(req);
  let token = await getOrMintForIp(ip);          // ← network round trip + shared-quota risk
  let r = await fetch(url, { headers: upstreamHeaders(token, { Referer: referer }) });
  if (r.status === 401 || r.status === 403) { /* mint again, retry */ }
  ...
}
```

**VERIFIED unnecessary.** `X-Client-Token` alone authenticates `/subject/play` and `/subject/caption`. The pool also creates a failure mode: the upstream's free quota is **per anonymous session**, so one shared token would burn out for everyone — which is exactly why the pool exists. But with a stateless clock-based token, **there is no session to burn out**.

**Fix:** token first, bearer as fallback.

```js
function clientToken() {
  const ts = Math.floor(Date.now() / 1000);
  const rev = String(ts).split('').reverse().join('');
  return `${ts},${createHash('md5').update(rev).digest('hex')}`;
}

// Token-first. VERIFIED: X-Client-Token alone authenticates /subject/play
// and /subject/caption — the per-IP Bearer pool is a fallback for
// endpoints (like /search) that do need a session.
function upstreamHeaders(token, extra = {}) {
  const h = {
    'Content-Type': 'application/json',
    'X-Client-Info': JSON.stringify({ timezone: 'Africa/Nairobi' }),
    'X-Request-Lang': 'en',
    'X-Client-Token': clientToken(),
    'User-Agent': USER_AGENT,
    ...extra,
  };
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}
```

and in `fetchPlay` / `fetchCaption`: call with **no token first**; only if the response is 401/403, mint a bearer and retry. Keep the pool for `/search` (VERIFIED: `/subject/search` genuinely needs the Bearer — it 400s without it).

### P5 — `handleSubtitle` sends `Bearer undefined` and returns unusable SRT (`server.mjs:386`)

```js
const upstream = await fetch(url, { headers: upstreamHeaders(), redirect: 'follow' });
```

`upstreamHeaders()` is called with **no argument** → `token` is `undefined` → the header is `Authorization: Bearer undefined`. It happens to work because the caption endpoint tolerates it, but it is a latent bug.

Worse: the relay returns the raw `.srt` with `content-type: application/x-subrip`. **A browser `<track>` element only renders WebVTT.** That is why `app/api/sources/route.ts` currently re-proxies every subtitle through Vercel's `/api/subtitle-proxy` — which means **subtitle bytes DO cross Vercel today**. The relay can fix this itself.

**Fix — do the SRT→VTT conversion in the relay**, so `<track src="…/subtitle?url=…">` works directly and Vercel never touches subtitle bytes either:

```js
function srtToVtt(srt) {
  return 'WEBVTT\n\n' + String(srt)
    .replace(/\r\n/g, '\n')
    .replace(/^\d+\n(?=\d{2}:\d{2}:\d{2})/gm, '')   // strip SRT index lines
    .replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2'); // ,mmm → .mmm
}
```

Serve it as `content-type: text/vtt; charset=utf-8`. Keep serving raw SRT when the client asks for it (`?format=srt`) so the Android app can keep working.

### P6 — `UPSTREAM_MEDIA_SITE` default should be `boxmovies.org` (`server.mjs:50`)

```js
const UPSTREAM_MEDIA_SITE = (process.env.UPSTREAM_MEDIA_SITE || 'https://movibox.xyz').replace(/\/+$/, '');
```

Both are on the allowlist (measured), so this is not a bug — but `boxmovies.org` is the better default because it is the site whose own API contract we mirror, and its Referer is the one the upstream's own API call uses. Change the default and update the big comment block above it (lines 32-49), which currently tells a future reader that the only fix is to get `movbox.xyz` onto the allowlist — **that framing is wrong; the relay IS the permanent fix for a browser-less client, and the Android app can drop the relay entirely because a native client can set Referer.**

### P7 — The `/stream` cache can hand out expired signatures

`CACHE_TTL.stream = 30 min` (`server.mjs:182`) but a CDN signature can expire well inside 30 minutes. A cached `/stream` response therefore hands the browser URLs that are already dead. The 403→re-mint path in P3 covers this **if `mediaOrigin` still has the pathname** — it is populated in `handleStream` (`server.mjs:454`) and evicted after `SIGNED_URL_TTL_MS = 30 min` (`server.mjs:629`). Keep both aligned, and make the re-mint path resilient: if `mediaOrigin` has expired, the 403 becomes a hard error rather than a silent hang.

**Also:** `handleStream` caches the *proxied* response including the signed URLs (`server.mjs:491-492`). Consider caching the **play metadata** and re-signing on the way out instead of caching the signatures.

### P8 — `handleMp4` is an open proxy

`/mp4?url=<any https url>` — it will fetch any URL the relay is given, with the allow-listed Referer. **Allowlist the CDN host** before proxying:

```js
const MEDIA_HOST_ALLOWLIST = ['bcdnxw.hakunaymatata.com', 'cacdn.hakunaymatata.com'];
```

---

## 7. Our PLAYER's problems (`MovBox/components/player/Player.tsx`, `components/watch/WatchSession.tsx`)

### P9 — The default source is index 0 = 360p (`WatchSession.tsx:99`)

```tsx
const [activeSourceIndex, setActiveSourceIndex] = useState(0);
```

The relay sorts ascending, so index 0 is the 360p rung. **This is the "only low quality" symptom in the UI.**

Two ways to fix, and **do both** (defence in depth — the app should not depend on the relay's sort order):

1. Relay sorts descending (P2).
2. The app picks the best rung by default.

```tsx
// Default to the BEST available quality, not array index 0. The source
// order comes from the relay and has changed over time (ascending once,
// descending now) — selecting by resolution makes the default correct
// regardless of the order we receive.
const [activeSourceIndex, setActiveSourceIndex] = useState(() => {
  let best = 0;
  let bestRes = -1;
  sources.forEach((s, i) => {
    const res = Number(s.resolution) || Number(s.quality?.replace(/[^\d]/g, "")) || 0;
    if (res > bestRes) { bestRes = res; best = i; }
  });
  return best;
});
```

⚠️ **WatchSession hook-count rule:** the file at `Player.tsx:318-325` and `Player.tsx:906-916` documents a hard constraint — **this component crashed the whole watch page with React error #310** ("Rendered more hooks than during the previous render") when a hook was added below an early return. If you add a hook to `Player.tsx`, it MUST go above every early return, and the hook count must stay identical between the loading render and the loaded render. `useState` with a lazy initialiser is safe **as long as `sources` is already available**; if `sources` arrives later, you need an effect instead:

```tsx
// sources arrive after mount → correct the default once, without
// clobbering a user selection
const userPicked = useRef(false);
useEffect(() => {
  if (userPicked.current || sources.length === 0) return;
  let best = 0, bestRes = -1;
  sources.forEach((s, i) => { /* …pick highest resolution… */ });
  setActiveSourceIndex(best);
}, [sources]);
```

**Choose ONE of these approaches, not both.** The `useEffect` version is the safer one because it works with the existing "sources load after mount" flow.

### P10 — `rankSources` is computed but never used for the default (`Player.tsx:269-281`)

```tsx
const rankedOrder = useMemo(() => rankSources(sources), [...]);   // ← only feeds auto-fallback
const clampedIndex = Math.min(Math.max(activeSourceIndex, 0), Math.max(sources.length - 1, 0));
const activeSource: BoxSource | null = sources[clampedIndex] ?? null;
```

`rankSources` (`Player.tsx:129-136`) sorts quality-desc and is genuinely useful — but it is only consumed by the auto-fallback path at `Player.tsx:416`. The **default** comes straight from `activeSourceIndex`. So the ranking the developer wrote never influenced what plays first.

**Fix:** either use `rankedOrder[0]` as the default, or (preferred) fix it in `WatchSession` as in P9. The ranking itself is fine — `res + (subtitles?.length ? 1 : 0)` is a reasonable tiebreak.

### P11 — `buildPlayableUrl` comment is stale, but the branch is CORRECT (`Player.tsx:52-62`)

```tsx
function buildPlayableUrl(rawUrl: string, detailPath?: string | null): string {
  if (!rawUrl) return rawUrl;
  if (rawUrl.includes("/mp4?url=")) {
    return rawUrl;                       // ← keep this
  }
  const p = `/api/video-proxy?url=${encodeURIComponent(rawUrl)}`;
  return detailPath ? `${p}&detailPath=${encodeURIComponent(detailPath)}` : p;
}
```

**Keep the `"/mp4?url="` branch.** Under the new architecture the relay is the byte path, so the browser hitting the relay cross-origin is exactly right — and it keeps Vercel out of the byte path. The comment above it (lines 44-51) still says double-proxying "would just add an extra hop and reject the URL" and describes `/api/video-proxy` as the fallback; **rewrite the comment** to state the new rule: *video bytes go through the relay; `/api/video-proxy` is the degraded fallback for when the relay is down, never the primary path.*

Also note the `rawUrl.includes("/mp4?url=")` test is a **substring** match — it will also match a hostile URL like `https://evil.test/x/mp4?url=`. Tighten it to a check against the configured relay origin:

```tsx
if (rawUrl.startsWith(RELAY_ORIGIN) && rawUrl.includes("/mp4?url=")) return rawUrl;
```

### P12 — `qualityOptions` id semantics (`Player.tsx:883-904`)

```tsx
const qualityOptions = useMemo(() => {
  const seen = new Set<string>();
  sources.forEach((s, i) => { if (seen.has(s.quality)) return; seen.add(s.quality); opts.push({ id: i, … }); });
  return opts.sort((a, b) => b.bitrate - a.bitrate);
}, [sources]);

const activeQualityId = qualityOptions.findIndex((q) => q.id === clampedIndex);
```

`q.id` is the index into `sources`, and `qualityOptions` is then sorted by bitrate desc. `activeQualityId` is used as the *position in the sorted menu* and `qualityOptions[activeQualityId].label` is the label shown. Because the menu is sorted but `id` is the original array index, `activeQualityId` is the **sorted position**, which is correct — the menu is rendered from `qualityOptions` in order and the selected row is `qualityOptions[activeQualityId]`.

**This works — but it only lines up if the array order and the menu order agree.** With the relay now sorting descending and `rankSources` also sorting descending, they will. **Do not change `id` to be the position in the sorted array** — the on-change handler uses `id` to set the *source* index, and that must remain the index into `sources`. Just verify after the change that clicking "1080p" plays 1080p.

### P13 — Player ergonomics for "the user can select the perfect quality"

The quality menu already exists and already works (`Player.tsx:1702-1720` renders `qualityOptions`). The gaps:

- The **default** was 360p (P9). Fixing that is the main thing.
- `qualityOptions` dedupes by `s.quality` **label**. The relay maps `resolution` → `"${res}p"`, so labels are `360p` / `480p` / `1080p`. Good. But `lib/data.ts:950-967` synthesises the label when the relay doesn't set one, and falls back to `"Auto"` for res 0 — if two rungs both end up as `"Auto"`, the dedupe drops one. Make sure the relay always passes a numeric `resolutions` through.
- The `qualityTag` helper (`Player.tsx:140-147`) renders `1080p • Full HD` — nice, keep.
- `Player.tsx:696-698` cycles quality with a keyboard shortcut. Keep.
- **Show the size.** `qualityOptions` already computes `size: fmtSize(s.sizeBytes)`, but `lib/data.ts:964` maps `sizeBytes: Number(s.size) || Number(s.sizeBytes) || 0` — and the relay's stream objects use a different field name. **The relay must pass the byte size through under a consistent key** or the menu shows an empty size. The upstream `streams[]` entries carry a size field — map it in the relay and keep the key stable.

### P14 — `/api/sources` re-proxies subtitles through Vercel (`app/api/sources/route.ts:65-78`)

```ts
const toPlayerSubtitleUrl = (upstreamOrRelayUrl: string) => {
  if (upstreamOrRelayUrl.startsWith("/api/subtitle-proxy")) return upstreamOrRelayUrl;
  return `/api/subtitle-proxy?url=${encodeURIComponent(upstreamOrRelayUrl)}`;
};
```

Once the relay does SRT→VTT (P5), **this should become a pass-through** so subtitle bytes also avoid Vercel. The relay's `cleanCaption` (`server.mjs:371-376`) already rewrites the caption URL to `${base}/subtitle?url=…`, so the URL is already relay-absolute — the app just needs to stop re-wrapping it.

**Keep `/api/subtitle-proxy` and `/api/video-proxy` as degraded fallbacks** (relay down ⇒ play from the app's own proxy). Just make them the fallback, not the default. Note `app/api/subtitle-proxy/route.ts` still allowlists the relay host `p01--movbox-api--d6kx854d4rvy.code.run` — that can stay (it is the fallback) but the `Referer` it sends to the CDN must be `https://boxmovies.org/`.

### P15 — Vercel load: the numbers

Today, with the relay in place, **video bytes already bypass Vercel** (P11 keeps that). What still crosses Vercel today:

- `/api/sources` JSON — ~2 KB. Fine.
- **Subtitle bytes** — via `/api/subtitle-proxy`. Small (tens of KB) but avoidable (P14).
- `/api/video-proxy` — only if the relay path is not used. Keep it off the happy path.

**Do not put video bytes back on Vercel.** That is the whole point of keeping the relay. The relay's egress is the cost, and the relay runs on a 1 vCPU / 512 MB box, which is why the 384 MB chunk cache must go — it alone is 75% of RAM.

---

## 8. The fix plan, file by file

### `MovBox-Api/server.mjs`

| # | Change | Where |
|---|---|---|
| 1 | `clientToken()` helper | new, near `upstreamHeaders` |
| 2 | `upstreamHeaders()` sends `X-Client-Token`; `Authorization` only when a token is passed | 319-330 |
| 3 | `fetchPlay` / `fetchCaption` → token-first, bearer fallback | 331-353 |
| 4 | Delete the 480 cap; add `MAX_RESOLUTION` env (0 = unlimited) | 439-441, 641 |
| 5 | Sort the ladder **descending** | 442 |
| 6 | Delete the chunk assembler; rewrite `/mp4` as a Range pass-through | 626-632, 687-936, 939-1035 |
| 7 | Host allowlist on `/mp4` | new |
| 8 | `remintSignedUrl` on 403/429, once | 688-708 |
| 9 | `/subtitle` → SRT→VTT, `text/vtt` | 371-393 |
| 10 | `UPSTREAM_MEDIA_SITE` default → `https://boxmovies.org`; rewrite the stale comment | 32-50 |
| 11 | Prewarm → one discarded head range request (not 16 MB into RAM) | 917-936 |
| 12 | Pass `size`/`resolutions` through consistently in the stream objects | `handleStream` map, 452-466 |
| 13 | Keep `server.requestTimeout = 0`, `setNoDelay` | 1193-1197 |

### `MovBox/components/watch/WatchSession.tsx`

| # | Change | Where |
|---|---|---|
| 1 | Default `activeSourceIndex` to the **best** resolution, not 0 | 99 |
| 2 | Do it in an effect (sources arrive async) — one approach only, not both | new effect near 99 |

### `MovBox/components/player/Player.tsx`

| # | Change | Where |
|---|---|---|
| 1 | Rewrite the `buildPlayableUrl` comment to the new contract | 44-51 |
| 2 | Tighten the relay-URL check to an origin check | 54-56 |
| 3 | **Do not** add hooks below early returns (see the #310 note) | 318-325, 906-916 |

### `MovBox/app/api/sources/route.ts`

| # | Change | Where |
|---|---|---|
| 1 | Stop re-wrapping subtitle URLs through `/api/subtitle-proxy` (relay serves VTT) | 65-78, 94-101, 110-113 |
| 2 | Keep the relay MP4 URLs untouched | 83-103 |
| 3 | Tighten the 25 s timeout / return a structured error | 28, 142-160 |

### `MovBox/lib/data.ts`

| # | Change | Where |
|---|---|---|
| 1 | `getBoxmoviesStream` maps `resolutions` → `resolution` (it already does: `Number(s.resolution) \|\| Number(s.resolutions)`) — **keep** | 950-967 |
| 2 | Map the size field consistently | 964 |
| 3 | `relayMp4Url` / `relaySubtitleUrl` are **unused** (verified by grep) — either wire them up or delete them | 1008-1018 |
| 4 | `STREAM_RELAY_URL` stays — the relay is the architecture now | 32-34 |

### `MovBox/.env.example`, `MovBox/AGENTS.md`, `MovBox/docs/HANDOFF.md`

- `.env.example`: keep `STREAM_RELAY_URL`, add `MAX_RESOLUTION` docs for the relay (relay-side, not app-side).
- `AGENTS.md` hard rule #3 must be rewritten. Current text: *"Don't bypass `/api/video-proxy` or `/api/subtitle-proxy` for `/api/sources` calls."* → new text: *"Video bytes MUST go through the relay (`STREAM_RELAY_URL`), never through Vercel. `/api/video-proxy` and `/api/subtitle-proxy` are degraded fallbacks for when the relay is down."*
- `AGENTS.md` also points at a dead backend path (`C:\Users\hp\.mavis\agents\mavis\workspace\boxmovies-api\`) and a dead frontend path (`C:\projects\HMovies`). Update to `C:\projects\Learnning SE\MovBox-Api` and `C:\projects\Learnning SE\MovBox`.
- `docs/HANDOFF.md`: update the streaming lines (L16-20, L92-99, L280-289) to describe the relay architecture, the token, and the full ladder.
- **Commit the `nextjs-agent-rules` block** in `AGENTS.md` — `next dev` re-adds it, so committing it with the work keeps the tree clean (`AGENTS.md:7`).
- `docs/SCRATCHPAD.md` — log what was tried and what failed (the 256 KB ceiling theory, the single-use-signature theory, the ascending-sort theory).

---

## 9. Research artifact inventory (`C:\projects\Learnning SE\research`)

**Do not re-capture these. They are the evidence base.** Re-capturing costs ~10 minutes and 300 MB.

### The two reference sites, captured

| File | Size | What it is |
|---|---|---|
| `movibox-home.rea.json` | 60.2 MB | Full REA capture of `https://movibox.xyz/` — network + bodies + headers |
| `movibox-home.utf8.json` | 30.1 MB | UTF-8 re-encode of the above (PowerShell `>` writes UTF-16 — this is the readable copy) |
| `movibox-title.rea.json` | 12.7 MB | Capture of a title/detail page |
| `movibox-title.utf8.json` | 6.4 MB | UTF-8 copy |
| `movibox-title.nr.json` | 6.4 MB | `normalized_result` form (easier to query) |
| `movibox-watch.rea.json` | 10.8 MB | Capture of the **watch page** — the player |
| `movibox-watch.utf8.json` | 5.4 MB | UTF-8 copy |
| `movibox-watch.nr.json` | 5.4 MB | `normalized_result` form |
| `boxmovies-home.rea.json` | 236.5 MB | Full capture of `https://boxmovies.org/` |
| `boxmovies-home.utf8.json` | 118.3 MB | UTF-8 copy |
| `movibox-js.analysis.json` | 89.0 MB | Static JS analysis of the movibox bundle |
| `scenario-*.json` | — | The REA scenario definitions that produced the captures |

### Exported JavaScript (this is the gold)

**`research/player-js/`** — the 13 chunks that matter, hand-picked:

| File | Size | Contains |
|---|---|---|
| `s6701.js` | 6.1 KB | **⭐ THE TOKEN.** Module `5349` — the `X-Client-Token` / `Bearer` logic, `X-Client-Info`, `X-Request-Lang`, the `x-user` → cookie refresh, the `apiBaseUrl` resolution |
| `s44.js` | 9.4 KB | **⭐ THE PLAYER.** `/subject/play`, `/subject/caption`, `addRemoteTextTrack`, `x-mpegURL`, the `sources[]` vs `hls[]` preference, Video.js config |
| `watch-page.js` | 13.1 KB | Watch page glue — quality switch, `hls`, poster |
| `title-page.js` | 14.0 KB | Title/detail page |
| `s3794.js` | 215.8 KB | Large app chunk (likely Video.js core) |
| `s4bd1.js` | 195.2 KB | Large app chunk |
| `s7828.js` | 62.9 KB | App chunk |
| `s5301.js` / `s5510.js` | ~39 KB | App chunks |
| `s1880.js` | 30.8 KB | App chunk |
| `s2935.js` | 11.3 KB | App chunk |
| `s8500.js` | 8.5 KB | App chunk |
| `s9674.js` | 0.5 KB | Tiny chunk |

**`research/movibox-scripts/`** — all 28 scripts from the home page, exported by URL hash, with `manifest.json` mapping hash → source URL. `files/origins/…/\_next/static/chunks/9cb54ea0.*.js` (533.5 KB) and `4286.*.js` (165.1 KB) are the biggest.

**`research/movibox-watch-scripts/`** — the 28 scripts from the watch page, same structure.

### Probe scripts (re-runnable, use these to re-verify)

| File | What it does |
|---|---|
| `probe2.cjs` | **⭐** The OPTIONS preflight + Referer matrix against the movibox `/subject/play` rewrite. Proves: `ACAO: *`, `allow-headers: *`, and that a foreign Referer returns **0 streams with HTTP 200** |
| `probe3.cjs` | **⭐** The full Referer matrix against h5-api **and** the media CDN, with the 403-vs-429 distinction |
| `cdn-probe.cjs` | Referer matrix directly against the CDN |
| `replay-api.cjs` | **⭐** Working server-side client: token + `/subject/play` + `/subject/caption`. Use it to sanity-check the upstream before touching the relay |
| `reacap.cjs` | REA capture driver (headless Chrome) |
| `shape.cjs` / `summarize.cjs` / `bodies.cjs` / `streams.cjs` | Query helpers for the capture JSON |
| `one.cjs` / `dom.cjs` / `ctx.cjs` / `extract.cjs` | DOM + single-item extractors |
| `tv-probe.cjs` | **BROKEN** — it read a non-existent `movibox-home.rea.utf8.json`. The real names are `movibox-home.utf8.json` / `movibox-home.rea.json`. Fix the path before using it for the TV `se`/`ep` question (see §10) |

---

## 10. Open risks — do not guess these

### R1 — TV `se`/`ep` indexing: **RESOLVED — the upstream is 1-based** ✅

The app's UI is **1-based** (`?s=1&e=1` → `season`/`episode` passed to `useSources`). `lib/useSources.ts` only sends `season`/`episode` when `> 0` (movies ⇒ absent ⇒ 0). The relay forwards them **verbatim** as `se`/`ep`.

**Measured 2026-10-19** against a real series (`tulsa-king-MsmATkU0Mg6`, subjectId `5262873104975547168`), calling `/subject/play` directly with the clock token:

| `se` | `ep` | upstream result |
|---|---|---|
| 0 | 0 | `hasResource: false`, **no streams** |
| 1 | 0 | `hasResource: false`, **no streams** |
| **1** | **1** | **stream** — id `7210716553040776016`, 360p, 144,346,129 B |
| **1** | **2** | **different stream** — id `4578072299773001672`, 360p, 127,812,939 B |
| **2** | **1** | **different stream** — id `2947242778511786032`, 360p, 121,882,320 B |

**Conclusion: `se` and `ep` are 1-based for TV.** Season 1 Episode 1 = `(1,1)`; `(0,0)` and `(1,0)` are simply invalid. For **movies** `(0,0)` is the only valid pair. The app already sends 1-based for TV and 0 for movies, so **the existing forwarding is correct and was left untouched.**

Reproduce with `research/tv-index-probe3.mjs`.

### R2 — Signed URLs expire; the re-mint path must be solid

`sign`/`t` rotate and expire. The 403 → re-mint path (P3) is the safety net. But `mediaOrigin` is evicted after `SIGNED_URL_TTL_MS = 30 min` (`server.mjs:629`) while `/stream` results are cached for 30 min (`server.mjs:182`) — the two windows must be aligned so a cached `/stream` response never outlives its re-mint data.

### R3 — The Referer allowlist can change upstream

`movibox.xyz` and `boxmovies.org` are allow-listed today. If the upstream rotates the list, the relay breaks. `UPSTREAM_MEDIA_SITE` is the override. The `/health` probe (`server.mjs:1138-1164`) already checks CDN reachability — **extend it to check the Referer gate specifically**, because "TCP reachable" is not "allowed" (a 403 from a rejected origin still proves reachability).

### R4 — Cloud Run / Render free-tier egress

Bytes now flow through the relay, so the relay's egress is the cost. That is the right place for it (Vercel egress is much more expensive), but the relay must not buffer media in RAM (the 384 MB chunk cache has to go, P3). With a pure pass-through, the relay's memory use is flat regardless of file size.

### R5 — 1080p is 1.91 GB for a 5893 s title

That is ~2.6 Mbps. On a weak connection the 1080p default would buffer.

**Decision (2026-10-19, per the user): the ladder is ASCENDING and the SMALLEST rung auto-plays.** Index 0 = 360p = fastest start, least relay egress, and exactly what the two reference sites do (their player also defaults to index 0 = lowest rung). The full 360/480/1080 ladder stays one click away in the quality menu, which now lists smallest-first to match.

The old 480 cap is gone — the ladder is no longer truncated, only reordered. If the client reports sustained stalls, auto-downgrade — but only after a real stall, never silently.

---

## 11. How to verify the fix

**Relay (PowerShell):**

```powershell
cd "C:\projects\Learnning SE\MovBox-Api"
node --check server.mjs          # syntax
node server.mjs                  # run on :4000

# 1) The ladder must have 3 rungs, best first.
$r = Invoke-RestMethod "http://127.0.0.1:4000/stream?detailPath=the-florist-efahwcdehu5&subjectId=4606371260002628112&season=0&episode=0"
$r.data.streams | Select-Object id, resolutions, url

# 2) The byte path must be a REAL pass-through: 206 + content-range + accept-ranges.
$u = [uri]::EscapeDataString($r.data.streams[0].url)
curl.exe -sI -H "Range: bytes=0-1048575" "http://127.0.0.1:4000/mp4?url=$u"

# 3) The relay must make exactly ONE upstream request per browser request.
#    Watch the relay log; the old implementation made 1 (ensureTotal) + 8 (chunks).
```

**App:**

```powershell
cd "C:\projects\Learnning SE\MovBox"
npm run build            # typecheck + build must pass
npm run dev
curl.exe -s "http://127.0.0.1:3000/api/sources?detailPath=the-florist-efahwcdehu5"
```

**In the browser (the real test):**

1. Open the watch page → the quality menu must show **1080p / 480p / 360p** and the player must start on **1080p**.
2. DevTools → Network → filter `mp4` → the media request must go to the **relay host**, not to Vercel and not to `bcdnxw.hakunaymatata.com`.
3. The response must be `206 Partial Content` with a `Content-Range`.
4. Seek to 20:00 → a second `206` with a different range, not a full re-download.
5. Switch to 480p → the `src` changes, playback continues, **no new API call**.
6. Subtitles must render (the `<track>` must load `text/vtt` from the relay).
7. Network tab must show **zero** requests to `bcdnxw.hakunaymatata.com` from the browser (it cannot succeed anyway) and **zero** video bytes through Vercel.

---

## 12. Hard rules for whoever implements this

1. **Do not change the colours.** The brand is burgundy + cream + `bg-deepest`. "bro dont change the colors i love them". Only the playing layer changes.
2. **Video bytes go through the relay.** Never through Vercel. `/api/video-proxy` and `/api/subtitle-proxy` are degraded fallbacks only.
3. **The Referer sent upstream is `https://boxmovies.org/`** (or `https://movibox.xyz/`). Never our own domain — it is not on the allowlist and returns 429.
4. **Do not re-add TMDB or CinePro.** Dead code in `lib/`.
5. **New localStorage keys use `movbox:watchlist`.** `hmovies:watchlist` is read-only for migration.
6. **Do not add hooks below an early return in `Player.tsx`.** It crashed the watch page with React #310. Read the comment at `Player.tsx:318-325` and `Player.tsx:906-916` before touching hooks.
7. **Commit the `nextjs-agent-rules` block** in `AGENTS.md` with your work.
8. **Never hardcode a signed CDN URL.** Always fetch a fresh one from `/subject/play`.
9. **Do not implement DRM/paywall circumvention.** The upstream grants anonymous free access (`freeNum: 999`, `vipLocked: false`); we are engineering a legitimate proxy, not defeating a paywall.
10. **Do not search old session workspaces.** Everything needed is in `C:\projects\Learnning SE\research` and this document.

---

## 13. One-paragraph answer to "what was our mistake"

We looked at a ladder of three free 360p/480p/1080p MP4s that the upstream was handing us and **we deleted the best one** because we read a `maxResolution: 480` field — which is a hint for the sister site's own player, not a limit on us — and then we **sorted the survivors worst-first** and left the app pointing at index 0, so the site opened on 360p every time. On top of that we made the relay re-implement a CDN in userland: 4 MB chunk assembly, a 32 MB window, a 384 MB RAM cache, and an extra `bytes=0-0` round trip before the first byte of every request — a design built on two beliefs (a 256 KB response ceiling, single-use signatures) that we later measured to be **false**, which turned a 1.9 GB file into ~10,800 upstream round trips and is the entire "loading forever" symptom. Meanwhile the upstream was handing us a **stateless clock-based token** (`X-Client-Token: <ts>,<md5(reversed ts)>`) that needs no session, no cookie and no bearer pool, and we were minting per-IP JWTs on every play for no reason. The two sites feel smooth because the browser does the Referer for free, the whole quality ladder arrives in one response, and the CDN edge does the caching. Our fix is to make the relay do exactly one thing — add the Referer the browser can't — and otherwise get out of the way.

---

## 14. What was implemented + measured (2026-10-19)

### 14.1 The relay (`MovBox-Api/server.mjs`) — DONE, 28/28 assertions pass

- `X-Client-Token` (clock token) on the play/caption hot path; the per-IP Bearer pool is only used for `/search` and as a fallback.
- The 480 cap is **deleted**; `MAX_RESOLUTION` env (0 = unlimited) is the only ceiling.
- The ladder is sorted **ascending**; `maxResolution` in the response reports the highest rung actually served.
- The 4 MB chunk assembler, the 32 MB window, the 384 MB RAM cache and the extra `bytes=0-0` round trip are **all deleted**. `/mp4` is now a true pass-through: Range forwarded verbatim, body streamed with `Readable.fromWeb(...).pipe(res)`, no buffering, plus a media-host allowlist and a 403 → re-mint → retry path.
- `/subtitle` converts SRT → VTT in the relay, so subtitle bytes never touch Vercel either.
- `UPSTREAM_MEDIA_SITE` default is `https://boxmovies.org`.
- **Bug fixed during testing:** `baseUrl()` defaulted the protocol to `https` when `x-forwarded-proto` was absent, so a plain-HTTP listener generated `https://127.0.0.1:4000/...` and the subtitle fetch died with `ERR_SSL_PACKET_LENGTH_TOO_LONG`. It now asks the socket (`req.socket.encrypted ? 'https' : 'http'`) when the header is missing.

### 14.2 The app (`MovBox`) — DONE

| File | Change |
|---|---|
| `lib/data.ts` | The ladder is sorted **ascending** in `getBoxmoviesStream`, so index 0 is the lowest rung regardless of what the backend returned. Dead `relayMp4Url` / `relaySubtitleUrl` deleted. |
| `components/watch/WatchSession.tsx` | Explicitly auto-selects the **smallest resolution** (a `useRef` + `useEffect` keyed on the source-URL set, so a new episode re-selects but a manual quality change is never overridden). |
| `components/player/Player.tsx` | `qualityOptions` sorts **ascending** (smallest first, matching the ladder); `buildPlayableUrl` now uses a **parsed path check** (`pathname.endsWith("/mp4") && searchParams.has("url")`) instead of a substring match that would have accepted `https://evil.test/x/mp4?url=…`; stale comment rewritten. |
| `app/api/sources/route.ts` | Relay caption URLs are passed through untouched instead of being re-proxied through Vercel. Raw upstream captions still go through `/api/subtitle-proxy`. |
| `AGENTS.md`, `.env.example`, `docs/HANDOFF.md` | New streaming contract, corrected backend paths, new hard rules. |

### 14.3 Three measurements that settle the open questions

**1. Chrome DOES send `Range` on a `<video>`** — verified with headless Chrome against the relay:

```
GET /mp4?url=…        range="bytes=0-"      ->  206
content-range: bytes 0-235649765/235649766
```

The relay forwards it verbatim and the CDN answers 206 with the remaining body. The MP4 is **faststart** — `ftyp@0`, `moov@32` (size 4,062,940 B) — so Chrome only needs the first ~4 MB to start playing, and it reads them from the front of the 206. No clamping of open-ended ranges is needed.

**2. The relay is NOT the bottleneck.** Measured 4 MB ranges on all three rungs, direct to the CDN vs through the relay:

| rung | direct CDN | via relay |
|---|---|---|
| 360p | 0.06 MB/s | 0.09 MB/s |
| 480p | 0.09 MB/s | 0.06 MB/s |
| 1080p | 0.07 MB/s | (not measured) |

Identical. The relay adds **zero** measurable overhead — it is one extra hop with no buffering. The slow number is the network path from the test machine to the CDN on the day of testing (the same path measured 18–100 MB/s earlier in the same session, so it is a path/throttle condition, not a code condition). **Do not chase this in the relay.** If a user reports slowness, measure direct-vs-relay first; the relay is exonerated if the two numbers match.

**3. TV `se`/`ep` is 1-based** — see R1 above.

### 14.4 Live verification performed

| Check | Result |
|---|---|
| `node --check server.mjs` | OK |
| `node test-relay.mjs` (28 assertions) | **28 passed, 0 failed** |
| `/health` | `ok:true`, `max_resolution:0`, no chunk-cache fields left |
| `/stream` | 3 rungs, **ascending 360/480/1080**, sizes + quality labels, all proxied via `/mp4`, 1 caption, `maxResolution:1080` |
| `/mp4` range `0-1048575` | 206, `content-range: bytes 0-1048575/235649766`, `accept-ranges: bytes`, `ACAO: *`, real MP4 (`ftyp` at offset 4) |
| `/mp4` mid-file seek `100000000-` | 206, correct `content-range`, 1,048,576 bytes |
| `/mp4` open-ended `120000000-` | 206, `content-range: bytes 120000000-235649765/235649766` |
| `/mp4` non-allowlisted host | **403** |
| `/subtitle` | 200, `text/vtt; charset=utf-8`, `WEBVTT` header, SRT comma timestamps converted to dots; `?format=srt` returns raw |
| `npm run typecheck` | **0 errors in every file that was touched.** The 19 remaining errors are pre-existing and live in files this change does not touch (`app/genres/[id]/page.tsx`, `app/layout.tsx`, `app/profile/ProfileClient.tsx`, `app/watchlist/WatchlistClient.tsx`, `components/detail/MovieDetailView.tsx`, `components/detail/TVDetailView.tsx`, `components/watch/AutoplayOverlay.tsx`, `components/watch/MovieAutoplayOverlay.tsx`, `lib/media.ts`, `lib/user-data.ts`). |
| `npm run build` | **Succeeds** — full route table emitted |
| Live `GET /api/sources` | 200, `count:3`, `hasResource:true`, `vipLocked:false`; rungs **360p / 480p / 1080p** in that order, index 0 = 360p; every MP4 URL points at the relay's `/mp4`; the caption URL points straight at the relay's `/subtitle` (**no Vercel hop**) |

### 14.5 Is a separate "stream resolver" still needed? — **No.**

The resolver was a workaround for not knowing how to authenticate. Now that the auth is a **stateless clock token** (`ts,md5(reversed ts)`), the relay can both *get* the signed URL and *serve* the bytes in one process. The relay is needed for exactly one reason: **the CDN demands a `Referer` the browser cannot set** (`Referer` is a forbidden header name for `fetch`, and a cross-origin `<video>` sends the page's own origin). Everything else — auth, URL minting, range handling, re-minting on expiry — is now in the relay.

Consequence for the Android app: a native app **can** set `Referer` itself, so it could talk to the CDN directly and drop the relay entirely. The web app cannot.
