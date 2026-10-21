import type { Metadata, Viewport } from "next";
import { Cinzel, Inter } from "next/font/google";
import { Header } from "@/components/layout/Header";
import { MobileNav } from "@/components/layout/MobileNav";
import { Footer } from "@/components/layout/Footer";
import { ExoclickVideoSlider } from "@/components/ads/ExoclickVideoSlider";
import { ExoclickOutStream } from "@/components/ads/ExoclickOutStream";
import { PopunderAd } from "@/components/ads/PopunderAd";
import { SITE_URL } from "@/lib/constants";
import { cn } from "@/lib/utils";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const cinzel = Cinzel({
  variable: "--font-cinzel",
  subsets: ["latin"],
  display: "swap",
  weight: ["500", "600", "700", "800"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Movbox — Watch Movies, TV Shows & More",
    template: "%s | Movbox",
  },
  description:
    "Stream the latest movies and TV shows in 4K Ultra HD. Browse trending, top rated, and exclusive premieres — anywhere, anytime.",
  keywords: [
    "movies",
    "tv shows",
    "streaming",
    "4K",
    "watch online",
    "Movbox",
    "cinema",
  ],
  authors: [{ name: "Movbox" }],
  creator: "Movbox",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "/",
    siteName: "Movbox",
    title: "Movbox — Watch Movies, TV Shows & More",
    description:
      "Stream the latest movies and TV shows in 4K Ultra HD. Browse trending, top rated, and exclusive premieres.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Movbox",
    description: "Watch Movies, TV Shows & More in 4K Ultra HD.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: [
      { url: "/favicon-32x32.png", type: "image/png", sizes: "32x32" },
      { url: "/favicon-16x16.png", type: "image/png", sizes: "16x16" },
      { url: "/favicon.ico", type: "image/x-icon" },
    ],
    apple: [{ url: "/apple-touch-icon.png", type: "image/png", sizes: "180x180" }],
  },
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#080606",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={cn(inter.variable, cinzel.variable, "h-full antialiased")}
    >
      <head>
        {/*
          Client Hints delegation for ExoClick (s.magsrv.com).

          Chromium's UA-CH is allowlisted per origin. Ad platforms need
          accurate Sec-CH-UA-* values for device/bot detection and fraud
          filtering, and the standard mechanism is to opt an origin in via
          this meta tag. Required by their in-stream and display zones;
          without it the ad tag falls back to the coarse User-Agent header.

          Syntax is a whitespace-separated list of "Hint-Name Origin"
          pairs. Note this is a one-way delegation: we hand hints to
          s.magsrv.com only, and it has no effect on our own origin's
          hint delivery to anyone else.
        */}
        <meta
          httpEquiv="Delegate-CH"
          content={
            "Sec-CH-UA https://s.magsrv.com; " +
            "Sec-CH-UA-Mobile https://s.magsrv.com; " +
            "Sec-CH-UA-Arch https://s.magsrv.com; " +
            "Sec-CH-UA-Model https://s.magsrv.com; " +
            "Sec-CH-UA-Platform https://s.magsrv.com; " +
            "Sec-CH-UA-Platform-Version https://s.magsrv.com; " +
            "Sec-CH-UA-Bitness https://s.magsrv.com; " +
            "Sec-CH-UA-Full-Version-List https://s.magsrv.com; " +
            "Sec-CH-UA-Full-Version https://s.magsrv.com;"
          }
        />
      </head>
      <body className="flex min-h-dvh flex-col bg-bg-deepest text-text-primary">
        <Header />
        <main className="flex-1 pb-16 md:pb-0">{children}</main>
        <Footer />
        <MobileNav />
        {/* ExoClick floating video slider (zone 6049852). One instance per
            document — the library has no dedupe of its own. Self-suppresses
            on /watch, where the in-stream pre-roll already runs. */}
        <ExoclickVideoSlider />
        {/* ExoClick out-stream unit (zone 6054510). Mounted everywhere but
            only ever served from /watch when the viewer pauses — see
            requestOutStreamAd() in components/ads/ExoclickOutStream.tsx. */}
        <ExoclickOutStream />
        {/* ExoClick popunder (zone 6057172). Mounted on EVERY route,
            /watch included — this is the one unit that earns from a visitor
            who never plays anything, so excluding pages would defeat it.
            Their own trigger_method (interaction, not load) and
            1-per-60-min cap are what keep it in bounds; we add no second cap.
            See components/ads/PopunderAd.tsx. */}
        <PopunderAd />
      </body>
    </html>
  );
}
