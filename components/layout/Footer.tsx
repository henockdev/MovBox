import Link from "next/link";
import { Logo } from "./Logo";
import { CATEGORIES } from "@/lib/categories";

const COLUMNS = [
  {
    title: "Browse",
    links: [
      { href: "/movies", label: "Movies" },
      { href: "/tv", label: "TV Shows" },
      { href: "/genres", label: "Genres" },
      { href: "/trending", label: "Trending" },
      { href: "/movbox-app", label: "Movbox App" },
    ],
  },
  {
    title: "Categories",
    links: CATEGORIES.map((c) => ({
      href: `/category/${c.slug}`,
      label: c.title,
    })),
  },
  {
    title: "Account",
    links: [
      { href: "/login", label: "Sign In" },
      { href: "/signup", label: "Create Account" },
      { href: "/watchlist", label: "My List" },
      { href: "/account", label: "Settings" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/about", label: "About" },
      { href: "/blog", label: "Blog" },
      { href: "/contact", label: "Contact" },
      { href: "/privacy", label: "Privacy" },
      { href: "/terms", label: "Terms" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="mt-16 border-t border-border bg-bg-primary">
      <div className="mx-auto max-w-7xl px-4 py-12 md:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          <div className="col-span-2 md:col-span-1">
            <Logo size="md" />
            <p className="mt-3 text-sm text-text-muted">
              Stream the latest movies and TV shows in 4K Ultra HD. Anywhere,
              anytime.
            </p>
          </div>
          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h3 className="font-display text-sm font-semibold text-cream">
                {col.title}
              </h3>
              <ul className="mt-3 space-y-2">
                {col.links.map((l) => (
                  <li key={l.href}>
                    <Link
                      href={l.href}
                      className="text-sm text-text-secondary transition-colors hover:text-accent-bright"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-12 flex flex-col items-start justify-between gap-2 border-t border-border pt-6 text-xs text-text-muted md:flex-row md:items-center">
          <p>© {new Date().getFullYear()} Movbox. All rights reserved.</p>
          <p>Built with care · Powered by TMDB</p>
        </div>
      </div>
    </footer>
  );
}
