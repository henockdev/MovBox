import type { Metadata, Viewport } from "next";
import { Cinzel, Inter } from "next/font/google";
import { Header } from "@/components/layout/Header";
import { MobileNav } from "@/components/layout/MobileNav";
import { Footer } from "@/components/layout/Footer";
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
        <Header />
        <main className="flex-1 pb-16 md:pb-0">{children}</main>
        <Footer />
        <MobileNav />
      </body>
    </html>
  );
}
