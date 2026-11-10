import type { Metadata, Viewport } from "next";
import { Cinzel, Inter } from "next/font/google";
import { Header } from "@/components/layout/Header";
import { MobileNav } from "@/components/layout/MobileNav";
import { Footer } from "@/components/layout/Footer";
import { SiteAds } from "@/components/ads/SiteAds";
import { SiteJsonLd } from "@/components/seo/SiteJsonLd";
import { SearchProvider } from "@/components/search/SearchProvider";
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
      <body className="flex min-h-dvh flex-col bg-bg-deepest text-text-primary">
        {/* Ahrefs Web Analytics.

            This is a plain <script> tag on purpose, NOT `next/script`.
            VERIFIED on the built HTML on 2026-11-09: `next/script` with
            `strategy="beforeInteractive"` emits only
              <link rel="preload" href="…/analytics.js" as="script"/>
            plus a `self.__next_s.push(…)` runtime call — no literal
            <script src="https://analytics.ahrefs.com/analytics.js"> ever
            appears in the server-rendered HTML. Ahrefs' "Recheck installation"
            bot reads the raw page, so it would report the site as not
            installed even though the script does run in a real browser.

            React 19 hoists an <script async src=…> into <head> during
            server rendering, so the tag lands in the head of every route's
            HTML exactly where the vendor asked for it.

            The script is async and third-party: it never blocks rendering and
            never touches the static/ISR cache of any route. */}
        <script
          async
          src="https://analytics.ahrefs.com/analytics.js"
          data-key="7gdtpRLUCl7EE8j5ve6BzA"
        />
        {/* llms.txt discovery. There is no standard robots.txt directive for
            it, so the link tag in the document head is what tells an
            assistant where the plain-text site summary lives.
            https://llmstxt.org */}
        <link rel="llms-txt" href="/llms.txt" />
        {/* WebSite + Organization — the site-wide identity markup. */}
        <SiteJsonLd />
        {/* The search screen, hosted once for the whole site: touching the
            header's search field pops the app's search screen over the page. */}
        <SearchProvider>
          <Header />
          {/* movbox-has-socialbar-space keeps the last row of content clear of
              the fixed mobile nav AND the Adsterra social bar. Inert while
              --movbox-socialbar-h is 0. See app/globals.css. */}
          <main className="movbox-has-socialbar-space flex-1 pb-16 md:pb-0">
            {children}
          </main>
          <Footer />
          <MobileNav />
          {/* Site-wide ad units. Mounted once, here, so no route can
              accidentally double-load a tag. Placement matrix and the reasons
              behind each exclusion live in components/ads/SiteAds.tsx. */}
          <SiteAds />
        </SearchProvider>
      </body>
    </html>
  );
}
