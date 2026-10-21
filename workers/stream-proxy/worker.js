/**
 * Cloudflare Worker — `stream.movbox.xyz` proxy.
 *
 * Why this exists: the thin server lives at
 * `p01--movbox-api--d6kx854d4rvy.code.run` (DigitalOcean) and serves
 * a cert for `*.code.run`. The browser hitting `stream.movbox.xyz`
 * would see a cert-mismatch warning.
 *
 * This Worker sits at the Cloudflare edge, terminates SSL with a
 * Cloudflare-issued cert (which is valid for stream.movbox.xyz), and
 * forwards the request to the thin server. The thin server returns
 * the proxied MP4 / subtitle bytes. End result: green lock in the
 * browser, no `code.run` URL in DevTools.
 *
 * Free tier: 100k requests/day. Same code works on Cloudflare Pages
 * Functions if you want, but Worker is cheaper at scale.
 *
 * Deploy: Cloudflare dashboard → Workers & Pages → Create → paste
 * this file → Settings → Triggers → Custom Domain: stream.movbox.xyz.
 * Cloudflare will create the DNS record automatically. No other
 * changes needed.
 *
 * If you want to deploy via API, scope needed: Workers Scripts:Edit
 * on your account.
 */

export default {
  /**
   * @param {Request} request — incoming from the user
   * @param {Record<string, string>} env — env vars / secrets
   *   (set THIN_ORIGIN in the Worker settings if you don't want
   *    the hard-coded default)
   * @returns {Promise<Response>}
   */
  async fetch(request, env) {
    // Default = the current thin server on DigitalOcean. Override
    // with a Worker env var if you ever move the backend.
    const ORIGIN =
      (env && env.THIN_ORIGIN) ||
      "https://p01--movbox-api--d6kx854d4rvy.code.run";

    const url = new URL(request.url);

    // Build the target URL. Forward path + query so /stream?detailPath=...
    // /mp4?url=... /subtitle?url=... all work identically.
    const target = `${ORIGIN}${url.pathname}${url.search}`;

    // Clone the request headers but rewrite two things the upstream
    // cares about: drop Host (so the origin server doesn't see
    // stream.movbox.xyz and try to cert-match it), and add the
    // boxmovies.org Referer/Origin that the upstream CDN needs
    // to accept the request.
    const headers = new Headers(request.headers);
    headers.delete("host");
    headers.set("Referer", "https://boxmovies.org/");
    headers.set("Origin", "https://boxmovies.org");
    // Pass through the client's IP so the thin server's per-IP rate
    // limits work correctly. CF will already set CF-Connecting-IP,
    // but we keep the original X-Forwarded-For as a belt-and-suspenders
    // fallback for the thin server.
    const cfIp = request.headers.get("cf-connecting-ip");
    if (cfIp && !headers.has("x-forwarded-for")) {
      headers.set("x-forwarded-for", cfIp);
    }

    const init = {
      method: request.method,
      headers,
      redirect: "follow",
    };
    // The body can only be sent on GET/HEAD/PUT/POST/etc. — and only
    // if the request has one. Pass it through for byte-perfect proxying.
    if (request.method !== "GET" && request.method !== "HEAD") {
      init.body = request.body;
    }

    let upstream;
    try {
      upstream = await fetch(target, init);
    } catch (err) {
      // Origin unreachable. Return a 502 with a tiny HTML body so the
      // user gets a readable error in the browser instead of a
      // confusing "Failed to fetch" in DevTools.
      return new Response(
        `<!doctype html><html><head><meta charset="utf-8"><title>Stream offline</title>
         <style>body{background:#0a0807;color:#f3ede4;font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;padding:20px;text-align:center}h1{font-size:18px;font-weight:600;margin-bottom:8px}p{color:#a89a87;font-size:14px}</style>
         </head><body><div><h1>Stream relay is briefly offline</h1>
         <p>${(err && err.message) || "Unknown error"}. Please try again in a moment.</p>
         </div></body></html>`,
        {
          status: 502,
          headers: { "content-type": "text/html; charset=utf-8" },
        }
      );
    }

    // Copy upstream headers, but make sure the browser sees the
    // proxied content as same-origin (CORS *) so the <video> and
    // <track> elements can load the bytes without complaint. The
    // thin server already sets this, but we re-set defensively in
    // case a future backend forgets.
    const responseHeaders = new Headers(upstream.headers);
    responseHeaders.set("access-control-allow-origin", "*");
    responseHeaders.set("access-control-expose-headers", "Content-Range, Accept-Ranges, Content-Length");
    // Help Cloudflare cache Range requests efficiently.
    responseHeaders.set("vary", "Origin");

    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders,
    });
  },
};
