import type { Metadata } from "next";
import Link from "next/link";
import { Mail, ShieldAlert, Bug, Scale } from "lucide-react";
import { BreadcrumbJsonLd } from "@/components/seo/BreadcrumbJsonLd";
import { FaqJsonLd } from "@/components/seo/FaqJsonLd";
import { pageSeo } from "@/lib/seo";
import { SITE_NAME } from "@/lib/constants";

export const revalidate = 86400;

/**
 * The address the site publishes. It is the same one the blog article
 * "Why We Built Movbox" gives, so there is exactly one address to remember
 * and one inbox to watch.
 */
const CONTACT_EMAIL = "support@bacteriostaticagua.com";

export const metadata: Metadata = pageSeo({
  path: "/contact",
  title: "Contact Movbox — Support, Copyright & Bug Reports",
  description:
    "Get in touch with the Movbox team: report a broken stream, flag a wrong title or a copyright concern, or ask about the Android app. We read every message.",
  image: "/opengraph-image",
  imageWidth: 1200,
  imageHeight: 630,
  keywords: [
    "contact movbox",
    "movbox support",
    "report broken stream",
    "copyright takedown",
    "movbox help",
  ],
});

const FAQ_ITEMS = [
  {
    q: "A stream will not play — what should I do?",
    a: "Tell us the title, which episode if it is a series, which device or browser you are on, and what you see instead of the video. The fastest route is the email address on this page: support@bacteriostaticagua.com.",
  },
  {
    q: "A title has the wrong name, poster or description. How do I report it?",
    a: "Send us the title and what is wrong with it. The catalogue comes from an upstream source and we can pass the correction straight through to the people who maintain it.",
  },
  {
    q: "I own the rights to a film or series and I want it removed. How do I claim it?",
    a: "Write to support@bacteriostaticagua.com with the title, your company or legal entity, and the URL on Movbox. Copyright and trademark requests are read first and acted on promptly.",
  },
  {
    q: "Do you answer every email?",
    a: "We read every message that arrives. Broken-stream and copyright reports are treated as the priority; everything else usually gets an answer within a couple of working days.",
  },
  {
    q: "How can I be told when the Android app launches?",
    a: "Join the waitlist on the Movbox App page. We send a single notification when the app goes live — no marketing list, no spam.",
  },
];

const CHANNELS = [
  {
    icon: Bug,
    title: "A stream or a title is broken",
    body: "Tell us the title, the episode, the browser or device, and what happened. Screenshots help a lot.",
    accent: true,
  },
  {
    icon: Scale,
    title: "Copyright or trademark",
    body: "Send the title, who you represent, and the Movbox URL. These are read first and acted on promptly.",
    accent: false,
  },
  {
    icon: Mail,
    title: "Anything else",
    body: "A question, a suggestion, a missing feature — it all lands in the same inbox, and a real person reads it.",
    accent: false,
  },
];

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 pb-16 pt-24 md:px-6 lg:px-8">
      <BreadcrumbJsonLd
        items={[
          { name: "Home", path: "/" },
          { name: "Contact", path: "/contact" },
        ]}
      />
      <FaqJsonLd items={FAQ_ITEMS} />

      <h1 className="font-display text-3xl font-bold text-cream md:text-4xl">
        Contact {SITE_NAME}
      </h1>
      <p className="mt-4 text-sm leading-relaxed text-text-secondary md:text-base">
        One inbox, one team, no ticket queue. Write to us and a person reads
        it.
      </p>

      <a
        href={`mailto:${CONTACT_EMAIL}`}
        className="mt-6 flex items-center gap-3 rounded-xl border border-accent/40 bg-brand/10 p-4 transition-colors hover:border-accent hover:bg-brand/20"
      >
        <Mail className="h-5 w-5 shrink-0 text-accent-bright" />
        <span className="min-w-0">
          <span className="block text-xs uppercase tracking-wider text-text-secondary">
            Email us
          </span>
          <span className="mt-0.5 block truncate font-display text-base font-bold text-cream md:text-lg">
            {CONTACT_EMAIL}
          </span>
        </span>
      </a>

      <h2 className="mt-10 font-display text-xl font-bold text-cream md:text-2xl">
        What to write about
      </h2>
      <ul className="mt-4 space-y-4">
        {CHANNELS.map((c) => {
          const Icon = c.icon;
          return (
            <li
              key={c.title}
              className="flex gap-4 rounded-xl border border-border bg-surface/50 p-4"
            >
              <div
                className={
                  c.accent
                    ? "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-accent/30 bg-brand/10"
                    : "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border bg-surface"
                }
              >
                <Icon className="h-5 w-5 text-accent-bright" />
              </div>
              <div>
                <h3 className="font-display text-base font-bold text-cream">
                  {c.title}
                </h3>
                <p className="mt-1 text-sm leading-relaxed text-text-secondary">
                  {c.body}
                </p>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="mt-8 flex gap-4 rounded-xl border border-border bg-surface/50 p-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border bg-surface">
          <ShieldAlert className="h-5 w-5 text-accent-bright" />
        </div>
        <div>
          <h3 className="font-display text-base font-bold text-cream">
            Please include the details
          </h3>
          <p className="mt-1 text-sm leading-relaxed text-text-secondary">
            The title, the episode number if it is a series, the browser or
            device, and the exact error message or what you see instead of the
            video. A screenshot of a broken player is worth a paragraph of
            description.
          </p>
        </div>
      </div>

      <h2 className="mt-10 font-display text-xl font-bold text-cream md:text-2xl">
        Common questions
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

      <p className="mt-10 text-sm leading-relaxed text-text-secondary">
        Looking for something to watch instead? The{" "}
        <Link href="/trending" className="text-accent-bright hover:underline">
          trending page
        </Link>{" "}
        and the{" "}
        <Link href="/rankings" className="text-accent-bright hover:underline">
          rankings
        </Link>{" "}
        are the fastest way in. Everything on Movbox is free.
      </p>
    </div>
  );
}
