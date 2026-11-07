import type { Metadata } from "next";
import Link from "next/link";
import { BreadcrumbJsonLd } from "@/components/seo/BreadcrumbJsonLd";
import { pageSeo } from "@/lib/seo";
import { SITE_NAME } from "@/lib/constants";

export const revalidate = 86400;

export const metadata: Metadata = pageSeo({
  path: "/privacy",
  title: "Privacy Policy — What Movbox Collects and Why",
  description:
    "The Movbox privacy policy in plain English: what the site collects, what stays in your browser, what a free account stores and how to have your data deleted.",
  image: "/opengraph-image",
  imageWidth: 1200,
  imageHeight: 630,
  keywords: ["movbox privacy policy", "movbox data", "privacy"],
});

const UPDATED = "6 November 2026";

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 pb-16 pt-24 md:px-6 lg:px-8">
      <BreadcrumbJsonLd
        items={[
          { name: "Home", path: "/" },
          { name: "Privacy Policy", path: "/privacy" },
        ]}
      />

      <h1 className="font-display text-3xl font-bold text-cream md:text-4xl">
        Privacy Policy
      </h1>
      <p className="mt-2 text-sm text-text-muted">Last updated: {UPDATED}</p>

      <p className="mt-5 text-sm leading-relaxed text-text-secondary md:text-base">
        This policy covers {SITE_NAME} (movbox.xyz) and the Android app when
        it launches. It is written in plain English on purpose. If anything
        here is unclear, write to us and we will explain it.
      </p>

      <h2 className="mt-9 font-display text-xl font-bold text-cream">
        The short version
      </h2>
      <ul className="mt-3 space-y-2 text-sm leading-relaxed text-text-secondary">
        <li>
          • You can watch everything without an account and without telling us
          who you are.
        </li>
        <li>
          • Your watchlist and your viewing history live in your own browser
          unless you sign in, in which case they sync to your account.
        </li>
        <li>• We never sell your data, and we never share it for money.</li>
        <li>
          • We do not ask for, and cannot accept, payment card details — there
          is nothing to buy.
        </li>
        <li>
          • You can ask us to delete everything we hold about you, and we will
          do it.
        </li>
      </ul>

      <h2 className="mt-9 font-display text-xl font-bold text-cream">
        What we collect
      </h2>
      <h3 className="mt-5 font-semibold text-cream">
        Without an account
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-text-secondary">
        Nothing that identifies you. Your watchlist, your continue-watching
        row and your playback preferences are kept in your browser&rsquo;s
        local storage, on your device. They never reach us. Clearing your
        browser data clears them.
      </p>

      <h3 className="mt-5 font-semibold text-cream">With a free account</h3>
      <p className="mt-2 text-sm leading-relaxed text-text-secondary">
        If you create an account we store the email address you sign up with
        and a securely hashed password, so you can sign in again and so your
        watchlist and history follow you to another device. We store what you
        have watched and what you have saved. We do not store payment
        information, because there is nothing to pay for.
      </p>

      <h3 className="mt-5 font-semibold text-cream">
        If you join the app waitlist
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-text-secondary">
        We store the email address you give us and the fact that you asked to
        be told when the Android app launches. That address is used for that
        one notification. It is not added to a marketing list.
      </p>

      <h3 className="mt-5 font-semibold text-cream">
        Ordinary web logs
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-text-secondary">
        Like every website, our host records the usual request information —
        IP address, browser, the page requested and the time — so we can keep
        the site running and find out what is broken. These logs are short
        lived and are used for operations, not for profiling you.
      </p>

      <h2 className="mt-9 font-display text-xl font-bold text-cream">
        Advertising
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-text-secondary">
        {SITE_NAME} is free, and advertising is what pays for it. The site and
        its partners may set cookies or similar identifiers to measure how
        many people see an advert and which ones they click. That is
        advertising measurement, not a list of what you watch — we do not
        build a profile of your viewing habits for advertisers.
      </p>

      <h2 className="mt-9 font-display text-xl font-bold text-cream">
        Who we share it with
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-text-secondary">
        We use a small number of providers, and only the ones we need:
      </p>
      <ul className="mt-3 space-y-2 text-sm leading-relaxed text-text-secondary">
        <li>
          • <strong className="text-cream">Our hosting provider</strong> —
          serves the pages and keeps the site online.
        </li>
        <li>
          • <strong className="text-cream">Our database provider</strong> —
          stores accounts, watchlists and the app waitlist.
        </li>
        <li>
          • <strong className="text-cream">The catalogue and its servers</strong>{" "}
          — supply the titles, the artwork and the video streams. They receive
          the request we forward, exactly as any video site does.
        </li>
        <li>
          • <strong className="text-cream">Our advertising partners</strong> —
          measure adverts, as described above.
        </li>
      </ul>
      <p className="mt-3 text-sm leading-relaxed text-text-secondary">
        We do not sell your personal information, we do not rent it, and we do
        not share it with anyone for money.
      </p>

      <h2 className="mt-9 font-display text-xl font-bold text-cream">
        Children
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-text-secondary">
        The catalogue includes titles aimed at younger viewers. We do not
        knowingly collect personal information from children under 13, and if
        you believe a child has given us personal information, write to us and
        we will delete it.
      </p>

      <h2 className="mt-9 font-display text-xl font-bold text-cream">
        Your rights
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-text-secondary">
        You can ask to see the data we hold about you, ask us to correct it, or
        ask us to delete it. If you have an account, deleting it removes the
        account, the watchlist and the history stored with it. Write to{" "}
        <a
          href="mailto:support@bacteriostaticagua.com"
          className="text-accent-bright hover:underline"
        >
          support@bacteriostaticagua.com
        </a>{" "}
        and we will deal with it.
      </p>

      <h2 className="mt-9 font-display text-xl font-bold text-cream">
        Cookies
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-text-secondary">
        The site uses cookies and similar technologies for three things: to
        keep you signed in, to remember your watchlist and playback settings,
        and to count advert impressions. You can block or delete cookies in
        your browser, though signing in and the watchlist will stop working
        if you do.
      </p>

      <h2 className="mt-9 font-display text-xl font-bold text-cream">
        Changes and contact
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-text-secondary">
        If this policy changes we will update the date at the top of the page.
        Questions, requests and complaints all go to the same place:{" "}
        <a
          href="mailto:support@bacteriostaticagua.com"
          className="text-accent-bright hover:underline"
        >
          support@bacteriostaticagua.com
        </a>
        . For the full terms of use, see the{" "}
        <Link href="/terms" className="text-accent-bright hover:underline">
          Terms of Use
        </Link>
        .
      </p>
    </div>
  );
}
