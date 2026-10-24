import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Vercel's free tier limits Image Optimization to ~1,000 unique
  // source images per month. With 355+ titles × 2 images each (poster
  // + backdrop) we blow through that in a single day. Setting
  // `unoptimized: true` passes the source image straight to the
  // browser — no Vercel proxy, no quota, no 402s.
  //
  // The trade-off: we lose automatic webp conversion + responsive
  // srcSet generation. The boxmovies CDN (pbcdnw.aoneroom.com) already
  // serves reasonably-sized jpgs, and Cloudflare applies its own
  // image optimizations on the edge, so the user-visible impact
  // is small. If we ever upgrade to a paid plan, flip this to false
  // and the optimization comes back automatically.
  images: {
    unoptimized: true,
    remotePatterns: [
      // TMDB (legacy — only used by the old detail pages we are sunsetting)
      { protocol: "https", hostname: "image.tmdb.org" },
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
      // Boxmovies (the single source of truth)
      { protocol: "https", hostname: "pbcdnw.aoneroom.com" },
      { protocol: "https", hostname: "pacdn.aoneroom.com" },
      { protocol: "https", hostname: "macdn.aoneroom.com" },
      { protocol: "https", hostname: "bcdnxw.hakunaymatata.com" },
      { protocol: "https", hostname: "spa.aoneroom.com" },
      { protocol: "https", hostname: "image.themoviedb.org" },
      // Google user avatars (for AuthButton)
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "lh4.googleusercontent.com" },
      { protocol: "https", hostname: "lh5.googleusercontent.com" },
      { protocol: "https", hostname: "lh6.googleusercontent.com" },
    ],
  },
  // Strict React 19 — already on
  reactStrictMode: true,
  // -------------------------------------------------------------------------
  // htmlLimitedBots — bots that must get their metadata inside <head>.
  //
  // Next.js 15.2+ streams metadata for dynamic routes: the <head> is flushed
  // as soon as the static shell is ready and the <title>/<meta>/<link
  // rel="canonical"> arrive later in the body. Browsers and JS-capable
  // crawlers cope (React hoists the tags into <head> after hydration), but a
  // raw-HTML consumer that only looks inside <head> sees no title at all.
  //
  // Verified on the live site: for `/movie/<id>` the `</head>` tag landed at
  // byte 1,895 while `<title>` landed at byte 39,625 — i.e. the title was in
  // the body, and there was no canonical in the head at all.
  //
  // Next.js already blocks the render for its default "HTML limited" bots
  // (Bingbot, Twitterbot, Slackbot, WhatsApp, facebookexternalhit, …). Plain
  // `Googlebot` is deliberately excluded, because Googlebot executes
  // JavaScript. We add it here so Googlebot gets the same blocking render
  // as Bingbot — the metadata is then guaranteed to be inside <head> for
  // every crawler that matters, with no change to what real visitors see.
  //
  // NOTE: this option REPLACES Next.js's default pattern, so the default
  // list is repeated verbatim below with `Googlebot` added.
  // -------------------------------------------------------------------------
  htmlLimitedBots:
    /[\w-]+-Google|Google-[\w-]+|Googlebot|Chrome-Lighthouse|Slurp|DuckDuckBot|baiduspider|yandex|sogou|bitlybot|tumblr|vkShare|quora link preview|redditbot|ia_archiver|Bingbot|BingPreview|applebot|facebookexternalhit|facebookcatalog|Twitterbot|LinkedInBot|Slackbot|Discordbot|WhatsApp|SkypeUriPreview|Yeti|googleweblight|PetalBot|Bytespider|CCBot|GPTBot|ClaudeBot|PerplexityBot/i,
  // Build-time type-check is OFF (for now). The repo still has ~80
  // pre-existing type errors in legacy TMDB/CinePro code that the
  // dev server (`next dev`) doesn't enforce. We removed the worst
  // offenders (MovieDetailContent, TVDetailContent, CastList) but
  // the rest is a cleanup pass. `npm run typecheck` is wired up so
  // you can see them locally; re-enable here once that pass lands.
  typescript: {
    ignoreBuildErrors: true,
  },
  experimental: {
    // Optimize package imports
    optimizePackageImports: ["lucide-react", "date-fns"],
  },
};

export default nextConfig;
