import type { Metadata } from "next";
import Link from "next/link";
import { BreadcrumbJsonLd } from "@/components/seo/BreadcrumbJsonLd";
import { pageSeo } from "@/lib/seo";
import { SITE_NAME } from "@/lib/constants";

export const revalidate = 86400;

export const metadata: Metadata = pageSeo({
  path: "/terms",
  title: "Terms of Use — Watch Free on Movbox",
  description:
    "The Movbox terms of use: what the service is, who owns the content, what is allowed, how copyright complaints are handled and the limits of what we promise.",
  image: "/opengraph-image",
  imageWidth: 1200,
  imageHeight: 630,
  keywords: ["movbox terms of use", "movbox terms", "streaming terms"],
});

const UPDATED = "6 November 2026";

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 pb-16 pt-24 md:px-6 lg:px-8">
      <BreadcrumbJsonLd
        items={[
          { name: "Home", path: "/" },
          { name: "Terms of Use", path: "/terms" },
        ]}
      />

      <h1 className="font-display text-3xl font-bold text-cream md:text-4xl">
        Terms of Use
      </h1>
      <p className="mt-2 text-sm text-text-muted">Last updated: {UPDATED}</p>

      <p className="mt-5 text-sm leading-relaxed text-text-secondary md:text-base">
        By using {SITE_NAME} you agree to these terms. If you do not agree
        with them, please do not use the site.
      </p>

      <h2 className="mt-9 font-display text-xl font-bold text-cream">
        1. What Movbox is
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-text-secondary">
        {SITE_NAME} is a free index of movies, television series and short
        form video. We publish the catalogue, the rankings, the search and
        the player interface. <strong className="text-cream">We do not host
        any video files</strong> — the catalogue and the streams are supplied
        by third-party sources that we do not control.
      </p>

      <h2 className="mt-9 font-display text-xl font-bold text-cream">
        2. The content
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-text-secondary">
        Every film, series, soundtrack, poster image, subtitle and logo shown
        on the site belongs to its respective owner or rights holder. Nothing
        here transfers any ownership. The catalogue is assembled from
        third-party sources, and we cannot guarantee that every entry is
        correctly licensed in every territory.
      </p>

      <h2 className="mt-9 font-display text-xl font-bold text-cream">
        3. Copyright and takedown
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-text-secondary">
        If you hold the rights to a title that appears here and you want it
        removed, write to{" "}
        <a
          href="mailto:support@bacteriostaticagua.com"
          className="text-accent-bright hover:underline"
        >
          support@bacteriostaticagua.com
        </a>{" "}
        with the title, your company or legal entity, and the URL. Copyright
        and trademark requests are read first and acted on promptly. We
        operate a repeat-infringer policy and will terminate the access of
        anyone who repeatedly infringes.
      </p>

      <h2 className="mt-9 font-display text-xl font-bold text-cream">
        4. Acceptable use
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-text-secondary">
        You may watch, browse, search and share links to anything on the site
        for your own personal use. You may not:
      </p>
      <ul className="mt-3 space-y-2 text-sm leading-relaxed text-text-secondary">
        <li>• scrape, mirror or republish the catalogue at scale;</li>
        <li>• re-upload or re-encode any stream;</li>
        <li>• remove or hide the Movbox branding from the player;</li>
        <li>
          • interfere with the site, the catalogue or the ad-serving in any
          way;
        </li>
        <li>
          • use the site in a way that breaks the law where you are.
        </li>
      </ul>

      <h2 className="mt-9 font-display text-xl font-bold text-cream">
        5. Age
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-text-secondary">
        The site includes an after-hours shelf of mature titles. You must be of
        the legal age to view them in your jurisdiction, and you are
        responsible for that. The rest of the catalogue is suitable for a
        general audience, though individual titles carry their own
        certificates.
      </p>

      <h2 className="mt-9 font-display text-xl font-bold text-cream">
        6. No warranty
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-text-secondary">
        The site is provided &quot;as is&quot;, without warranty of any kind.
        Streams come from third-party sources and can break, change or
        disappear without notice. We do not promise uninterrupted playback,
        and we are not responsible for the availability, accuracy or
        legality of any third-party source.
      </p>

      <h2 className="mt-9 font-display text-xl font-bold text-cream">
        7. Limitation of liability
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-text-secondary">
        To the fullest extent the law allows, Movbox is not liable for any
        loss or damage arising from your use of the site, including lost
        data, lost watchlists or lost watch history.
      </p>

      <h2 className="mt-9 font-display text-xl font-bold text-cream">
        8. Advertising
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-text-secondary">
        The site is free because advertising pays for it. We may show
        adverts, and we may change them. We are not responsible for the
        content of third-party advertising, and an advert is not an
        endorsement by Movbox.
      </p>

      <h2 className="mt-9 font-display text-xl font-bold text-cream">
        9. Accounts
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-text-secondary">
        An account is optional. If you create one, you are responsible for
        keeping your credentials to yourself and for anything that happens
        under your account. You can delete your account at any time, which
        removes the watchlist and history stored with it.
      </p>

      <h2 className="mt-9 font-display text-xl font-bold text-cream">
        10. Changes
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-text-secondary">
        We may change these terms, or the site, at any time. The date at the
        top of this page says when they last changed, and continued use of
        the site after a change means you accept it.
      </p>

      <h2 className="mt-9 font-display text-xl font-bold text-cream">
        11. Contact
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-text-secondary">
        Questions about these terms go to{" "}
        <a
          href="mailto:support@bacteriostaticagua.com"
          className="text-accent-bright hover:underline"
        >
          support@bacteriostaticagua.com
        </a>
        . How we handle your data is covered separately in the{" "}
        <Link href="/privacy" className="text-accent-bright hover:underline">
          Privacy Policy
        </Link>
        .
      </p>
    </div>
  );
}
