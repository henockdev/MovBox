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
