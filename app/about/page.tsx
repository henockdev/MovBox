import type { Metadata } from "next";
import Link from "next/link";
import { Clapperboard, Search, Trophy, Smartphone } from "lucide-react";
import { BreadcrumbJsonLd } from "@/components/seo/BreadcrumbJsonLd";
import { FaqJsonLd } from "@/components/seo/FaqJsonLd";
import { pageSeo } from "@/lib/seo";

export const revalidate = 86400;

export const metadata: Metadata = pageSeo({
  path: "/about",
  title: "About Movbox — Free Movies & TV Shows, Ranked Daily",
  description:
    "Movbox is a free streaming index: we find the movies and TV shows worth your evening, rank them by what people are watching, and make them playable anywhere.",
  image: "/opengraph-image",
  imageWidth: 1200,
  imageHeight: 630,
  keywords: [
    "about movbox",
    "movbox streaming",
    "free streaming site",
    "movbox team",
  ],
});

const FAQ_ITEMS = [
  {
    q: "What is Movbox?",
    a: "Movbox is a free streaming index. We pull together the movies, TV shows and short-form series that are being watched right now, rank them, and give you a clean, fast way to watch them on a phone, a tablet, a laptop or a TV.",
  },
  {
    q: "Does Movbox host the movies and shows?",
    a: "No. Movbox does not host any video files. The catalogue and the streams come from a community-maintained source, and Movbox is the layer that makes them easy to find, rank and play. Every title belongs to its respective owner.",
  },
  {
    q: "Is Movbox really free?",
    a: "Yes. Watching is free and does not need an account. The site is supported by advertising, the same way free television has always been. Creating an account is optional and only unlocks your watchlist and continue-watching across devices.",
  },
  {
    q: "How do the rankings work?",
    a: "Each ranking comes straight from the catalogue's own ordering — it is the list the upstream maintains, not a list Movbox edits by hand. The numbers update daily, so the number one title really is the one everybody is watching.",
  },
  {
    q: "Is there an app?",
    a: "An Android app is in development and shares the same catalogue, the same rankings and the same search as the website. You can join the waitlist on the Movbox App page to be told the moment it launches.",
  },
];

const PILLARS = [
  {
    icon: Search,
    title: "Search that actually finds it",
    body: "One search box across every catalogue — movies, series, short TV — filtered by genre, country, year and language, with the suggestions the catalogue itself returns.",
  },
  {
    icon: Trophy,
    title: "Rankings, not noise",
    body: "Twenty-odd rankings the app carries, on the web as well: K-Drama, Anime, Action, Horror, Romance, Nollywood and more. Every list is the catalogue's own order, refreshed daily.",
  },
  {
    icon: Clapperboard,
    title: "The whole catalogue",
    body: "Thousands of titles with their synopsis, rating, cast, genre and country, and every episode of every series — organised so that finding the next thing to watch takes seconds.",
  },
  {
    icon: Smartphone,
    title: "Made for a phone first",
    body: "A fast, light interface that works on a 6-inch screen and a 27-inch one, and an Android app on the way for the same experience away from the desk.",
  },
];

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 pb-16 pt-24 md:px-6 lg:px-8">
      <BreadcrumbJsonLd
        items={[
          { name: "Home", path: "/" },
          { name: "About", path: "/about" },
        ]}
      />
      <FaqJsonLd items={FAQ_ITEMS} />

      <h1 className="font-display text-3xl font-bold text-cream md:text-4xl">
        About Movbox
      </h1>
      <p className="mt-4 text-sm leading-relaxed text-text-secondary md:text-base">
        Movbox exists for one reason: finding something good to watch should
        take seconds, not twenty minutes of scrolling through a catalogue that
        has no opinion.
      </p>

      <h2 className="mt-10 font-display text-xl font-bold text-cream md:text-2xl">
        What Movbox is
      </h2>
      <p className="mt-3 text-sm leading-relaxed text-text-secondary md:text-base">
        Movbox is a free streaming index. We take the catalogue that the
        community maintains, work out what is actually worth watching, and
        put it behind an interface that is fast on a phone and just as good on
        a television. There is no subscription, no paywall halfway through an
        episode and no account required to press play.
      </p>
      <p className="mt-3 text-sm leading-relaxed text-text-secondary md:text-base">
        We do not host any video files ourselves. The catalogue and the
        streams come from elsewhere; Movbox is the layer that makes them
        discoverable, ranked and playable. Every film and every series belongs
        to its respective owner, and Movbox exists to point you at it.
      </p>

      <h2 className="mt-10 font-display text-xl font-bold text-cream md:text-2xl">
        How it works
      </h2>
      <ul className="mt-4 space-y-4">
        {PILLARS.map((p) => {
          const Icon = p.icon;
          return (
            <li key={p.title} className="flex gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-accent/30 bg-brand/10">
                <Icon className="h-5 w-5 text-accent-bright" />
              </div>
              <div>
                <h3 className="font-display text-base font-bold text-cream">
                  {p.title}
                </h3>
                <p className="mt-1 text-sm leading-relaxed text-text-secondary">
                  {p.body}
                </p>
              </div>
            </li>
          );
        })}
      </ul>

      <h2 className="mt-10 font-display text-xl font-bold text-cream md:text-2xl">
        The people behind it
      </h2>
      <p className="mt-3 text-sm leading-relaxed text-text-secondary md:text-base">
        We are a small team. The site is free because advertising pays for it,
        and there is no roadmap for a paid tier — that is a decision, not an
        accident. There is a watchlist, continue-watching, a profile system if
        you sign in, and an{" "}
        <Link href="/movbox-app" className="text-accent-bright hover:underline">
          Android app
        </Link>{" "}
        on the way.
      </p>
      <p className="mt-3 text-sm leading-relaxed text-text-secondary md:text-base">
        If something is wrong with a title, a stream or the catalogue itself,
        we want to hear about it. The{" "}
        <Link href="/contact" className="text-accent-bright hover:underline">
          contact page
        </Link>{" "}
        has the address, and we read every message that comes to it.
      </p>

      <h2 className="mt-10 font-display text-xl font-bold text-cream md:text-2xl">
        Questions people ask
      </h2>
      <dl className="mt-4 space-y-5">
        {FAQ_ITEMS.map((f) => (
          <div key={f.q}>
            <dt className="font-semibold text-cream">{f.q}</dt>
            <dd className="mt-1.5 text-sm leading-relaxed text-text-secondary">
              {f.a}
            </dd>
          </div>
        ))}
      </dl>

      <h2 className="mt-10 font-display text-xl font-bold text-cream md:text-2xl">
        Start watching
      </h2>
      <p className="mt-3 text-sm leading-relaxed text-text-secondary md:text-base">
        The{" "}
        <Link href="/trending" className="text-accent-bright hover:underline">
          trending page
        </Link>{" "}
        shows what is hot today, the{" "}
        <Link href="/rankings" className="text-accent-bright hover:underline">
          rankings
        </Link>{" "}
        list every category the app carries, and the{" "}
        <Link href="/movies" className="text-accent-bright hover:underline">
          movies
        </Link>{" "}
        and{" "}
        <Link href="/tv" className="text-accent-bright hover:underline">
          TV
        </Link>{" "}
        pages browse the whole catalogue. Everything is free.
      </p>
    </div>
  );
}
