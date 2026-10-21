import type { Metadata } from "next";
import { Smartphone, Bell, Star, Shield } from "lucide-react";
import { InstallCTA } from "@/components/ads/InstallCTA";
import { WaitlistForm } from "@/components/ads/WaitlistForm";
import { FaqJsonLd } from "@/components/seo/FaqJsonLd";
import { BreadcrumbJsonLd } from "@/components/seo/BreadcrumbJsonLd";

export const metadata: Metadata = {
  title: "Movbox App — Coming Soon",
  description:
    "The Movbox Android app is in development. Get notified when it launches.",
};

const FAQ_ITEMS = [
  {
    q: "When will the Movbox app be available?",
    a: "The Movbox Android app is currently in private beta. We're aiming for a public release in the coming months. Join the waitlist above to get notified the moment it goes live.",
  },
  {
    q: "Will the Movbox app be free to download?",
    a: "Yes. The app is free to install. The free version is ad-supported; a paid ad-free tier is planned for after launch.",
  },
  {
    q: "What features will the Movbox Android app have?",
    a: "4K Ultra HD streaming, offline downloads, continue-watching across devices, push notifications for new episodes, and zero buffering thanks to a dedicated relay.",
  },
  {
    q: "Is there an iOS or webOS version of the Movbox app?",
    a: "Android is first. iOS and Apple TV are on the roadmap. The web app at movbox.xyz already works on every browser including iOS Safari and Apple TV's web view.",
  },
  {
    q: "Do I need a Movbox account to use the app?",
    a: "Browsing and watching doesn't require an account. Signing in (free) unlocks watchlist sync, continue-watching across devices, and personalized recommendations.",
  },
  {
    q: "How do I get notified when the app launches?",
    a: "Drop your email in the waitlist box on this page. We'll send a one-time notification with the download link — no spam, no marketing list.",
  },
  {
    q: "Will my watchlist and history sync with the website?",
    a: "Yes. Sign in with the same account on the web and in the app, and your watchlist, ratings, and continue-watching are shared.",
  },
];

export default function MovboxAppPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 pb-16 pt-24 md:px-6 lg:px-8">
      <BreadcrumbJsonLd
        items={[
          { name: "Home", path: "/" },
          { name: "Movbox App", path: "/movbox-app" },
        ]}
      />
      <FaqJsonLd items={FAQ_ITEMS} />

      <div className="text-center">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl border border-accent/30 bg-brand/10">
          <Smartphone className="h-10 w-10 text-accent-bright" />
        </div>
        <h1 className="font-display text-4xl font-bold text-cream md:text-5xl">
          Movbox App
        </h1>
        <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-xs font-semibold text-accent-bright">
          <span className="h-2 w-2 rounded-full bg-accent-bright animate-pulse" />
          COMING SOON
        </div>
        <p className="mt-6 text-base text-text-secondary md:text-lg">
          We're building the most advanced movie and TV streaming Android app.
          Stream in 4K, download for offline viewing, and pick up where you
          left off across all your devices.
        </p>
      </div>

      <div className="mt-12 grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-surface/60 p-5">
          <Star className="mb-3 h-6 w-6 text-accent-bright" />
          <h3 className="font-display text-sm font-semibold text-cream">4K Ultra HD</h3>
          <p className="mt-1 text-xs text-text-muted">
            Crystal-clear streaming on any device, anywhere.
          </p>
        </div>
        <div className="rounded-xl border border-border bg-surface/60 p-5">
          <Shield className="mb-3 h-6 w-6 text-accent-bright" />
          <h3 className="font-display text-sm font-semibold text-cream">Ad-Free</h3>
          <p className="mt-1 text-xs text-text-muted">
            Uninterrupted entertainment, no ads ever.
          </p>
        </div>
        <div className="rounded-xl border border-border bg-surface/60 p-5">
          <Bell className="mb-3 h-6 w-6 text-accent-bright" />
          <h3 className="font-display text-sm font-semibold text-cream">Stay Notified</h3>
          <p className="mt-1 text-xs text-text-muted">
            Get a notification the moment it goes live.
          </p>
        </div>
      </div>

      <div className="mt-12 grid gap-6">
        <InstallCTA />
        <div className="rounded-2xl border border-accent/20 bg-gradient-to-br from-brand/10 via-surface/60 to-accent/5 p-8 text-center">
          <Bell className="mx-auto mb-3 h-8 w-8 text-accent-bright" />
          <h2 className="font-display text-xl font-semibold text-cream md:text-2xl">
            The app is in development
          </h2>
          <p className="mt-2 text-sm text-text-secondary">
            Want to be the first to know when it launches? Drop your email and
            we'll ping you the moment it goes live.
          </p>
          <WaitlistForm source="movbox-app" />
          <a
            href="/"
            className="mt-6 inline-flex items-center justify-center rounded-full bg-brand px-6 py-3 text-sm font-semibold text-cream shadow-glow transition-all hover:bg-brand/90"
          >
            Back to Movbox
          </a>
        </div>
      </div>

      {/* FAQ section — both for users and for SEO. The FAQ schema
          unlocks a position-0 rich snippet in Google for queries like
          "movbox app", "movbox download", "movbox review". */}
      <section className="mt-16" aria-labelledby="faq-heading">
        <h2
          id="faq-heading"
          className="font-display text-2xl font-bold text-cream md:text-3xl"
        >
          Frequently asked questions
        </h2>
        <div className="mt-6 space-y-3">
          {FAQ_ITEMS.map((item) => (
            <details
              key={item.q}
              className="group rounded-xl border border-border bg-surface/40 open:bg-surface/60"
            >
              <summary className="cursor-pointer list-none px-5 py-4 text-sm font-semibold text-cream transition-colors hover:text-accent-bright md:text-base">
                {item.q}
              </summary>
              <p className="px-5 pb-4 text-sm leading-relaxed text-text-secondary">
                {item.a}
              </p>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}
