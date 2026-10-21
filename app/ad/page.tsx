import type { Metadata } from "next";
import { SITE_NAME, SITE_URL } from "@/lib/constants";

/**
 * /ad — landing page for in-app ad click-throughs.
 *
 * The Android app opens this URL in a Chrome Custom Tab when the user
 * taps the in-app sponsored card. Chrome is a real browser context (full
 * DOM, full JS), so impressions and clicks count as real traffic. No
 * WebView, no chromium sandbox crashes — just a normal page shown in the
 * user's existing Chrome session.
 *
 * Layout is minimal, no nav. The page is the click-through destination for
 * in-app sponsored cards; the sponsor's creative is served by whichever
 * network the card belongs to.
 */

export const metadata: Metadata = {
  title: `Sponsored · ${SITE_NAME}`,
  description: "Sponsored picks, hand-curated.",
  robots: { index: false, follow: false }, // never indexed
  alternates: { canonical: `${SITE_URL}/ad` },
};

export default function AdLandingPage() {
  return (
    <div className="min-h-screen bg-bg-deepest text-cream">
      <main className="mx-auto flex max-w-3xl flex-col items-center gap-8 px-4 py-12 md:px-6 md:py-16">
        <header className="text-center">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.24em] text-accent-bright">
            Sponsored
          </p>
          <h1 className="font-display text-2xl font-bold md:text-3xl">
            Today&rsquo;s picks, hand-curated for Movbox viewers
          </h1>
          <p className="mt-3 text-sm text-vanilla-dim md:text-base">
            We&rsquo;ve partnered with brands our community actually
            likes. Tap any banner below &mdash; it opens in your browser
            and the partner pays us a small fee, which keeps Movbox
            free for you.
          </p>
        </header>

        <footer className="mt-12 text-center text-xs text-vanilla-dim">
          <p>
            You were taken here from the Movbox app. Return to the
            app to keep watching &mdash; this page will close
            automatically when you&rsquo;re done.
          </p>
        </footer>
      </main>
    </div>
  );
}