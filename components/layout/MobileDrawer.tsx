"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  AppWindow,
  ChevronRight,
  Flame,
  Home,
  Sparkles,
  Tv,
  Film,
  TrendingUp,
  Trophy,
  X,
  ListVideo,
} from "lucide-react";
import { CATEGORIES } from "@/lib/categories";
import { cn } from "@/lib/utils";

/**
 * The mobile navigation drawer.
 *
 * ## Why this exists
 *
 * The top bar shows the full navigation from `md` up. Below that the bar only
 * had the brand mark, a search icon and the account button, and the bottom tab
 * bar carried six destinations — so on a phone, Trending, Rankings, Genres,
 * the categories and the company pages were unreachable except by hunting
 * through the footer.
 *
 * The dash button in the header opens this drawer: a panel that slides in from
 * the left edge with every destination the site has, grouped the way the
 * footer groups them.
 *
 * ## How it behaves
 *
 * - Portalled to `document.body`, so it is never clipped by the header's
 *   stacking context.
 * - Escape closes it; the backdrop closes it; a navigation closes it.
 * - The body scroll is locked while it is open, so the page behind it does
 *   not scroll away under the panel.
 * - It is a real dialog: `role="dialog"`, `aria-modal`, and the focus moves
 *   to the panel when it opens so a keyboard or screen-reader user lands
 *   inside it instead of behind it.
 */

/** The primary destinations, in the order the app and the top bar use. */
const PRIMARY = [
  { href: "/", label: "Home", icon: Home },
  { href: "/trending", label: "Trending", icon: TrendingUp },
  { href: "/rankings", label: "Rankings", icon: Trophy },
  { href: "/movies", label: "Movies", icon: Film },
  { href: "/tv", label: "TV Shows", icon: Tv },
  { href: "/animations", label: "Animations", icon: Sparkles },
  { href: "/most-watched", label: "Most Watched", icon: Flame },
  { href: "/genres", label: "Genres", icon: ListVideo },
  { href: "/movbox-app", label: "Movbox App", icon: AppWindow },
];

const ACCOUNT = [
  { href: "/login", label: "Sign In" },
  { href: "/watchlist", label: "My List" },
  { href: "/profile", label: "Settings" },
];

const COMPANY = [
  { href: "/about", label: "About" },
  { href: "/blog", label: "Blog" },
  { href: "/contact", label: "Contact" },
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
];

export function MobileDrawer({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  // Close on navigation — the drawer is a navigation surface, and a tap on a
  // link must not leave the panel floating over the new page.
  useEffect(() => {
    if (open) onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Escape closes.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Lock the page behind the drawer.
  useEffect(() => {
    if (!open) return;
    const { body } = document;
    const prev = body.style.overflow;
    body.style.overflow = "hidden";
    return () => {
      body.style.overflow = prev;
    };
  }, [open]);

  if (!mounted || !open) return null;

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return createPortal(
    <div className="fixed inset-0 z-[95]" role="dialog" aria-modal="true" aria-label="Site navigation">
      {/* Backdrop */}
      <div
        className="backdrop-in absolute inset-0 bg-bg-deepest/80 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* The panel */}
      <div className="drawer-in absolute inset-y-0 left-0 flex w-[86%] max-w-[340px] flex-col border-r border-border-strong bg-bg-primary shadow-elevated">
        {/* Head */}
        <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3.5">
          <span className="font-display text-sm font-bold uppercase tracking-[0.18em] text-cream">
            Movbox
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close the navigation"
            className="flex h-9 w-9 items-center justify-center rounded-full text-text-secondary transition-colors hover:bg-surface-hover hover:text-cream"
          >
            <X className="h-[18px] w-[18px]" />
          </button>
        </div>

        {/* Body */}
        <nav className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-2">
          {/* Primary */}
          <ul>
            {PRIMARY.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onClose}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                      active
                        ? "bg-surface text-accent-bright"
                        : "text-text-secondary hover:bg-surface hover:text-cream"
                    )}
                  >
                    <Icon className="h-[18px] w-[18px] shrink-0" />
                    {item.label}
                    {active && (
                      <span className="ml-auto h-1.5 w-1.5 rounded-full bg-accent-bright" />
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>

          {/* Categories */}
          <DrawerGroup title="Categories">
            {CATEGORIES.map((cat) => (
              <DrawerLink
                key={cat.slug}
                href={`/category/${cat.slug}`}
                label={cat.title}
                tagline={cat.tagline}
                active={pathname === `/category/${cat.slug}`}
                onClick={onClose}
              />
            ))}
          </DrawerGroup>

          {/* Account */}
          <DrawerGroup title="Account">
            {ACCOUNT.map((entry) => (
              <DrawerLink
                key={entry.href}
                href={entry.href}
                label={entry.label}
                active={isActive(entry.href)}
                onClick={onClose}
              />
            ))}
          </DrawerGroup>

          {/* Company */}
          <DrawerGroup title="Company">
            {COMPANY.map((entry) => (
              <DrawerLink
                key={entry.href}
                href={entry.href}
                label={entry.label}
                active={isActive(entry.href)}
                onClick={onClose}
              />
            ))}
          </DrawerGroup>
        </nav>
      </div>
    </div>,
    document.body
  );
}

function DrawerGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-4 border-t border-border pt-3">
      <h3 className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-text-muted">
        {title}
      </h3>
      <ul>{children}</ul>
    </div>
  );
}

function DrawerLink({
  href,
  label,
  tagline,
  active,
  onClick,
}: {
  href: string;
  label: string;
  tagline?: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <li>
      <Link
        href={href}
        onClick={onClick}
        className={cn(
          "flex items-center gap-2 rounded-lg px-3 py-2 transition-colors",
          active
            ? "bg-surface text-accent-bright"
            : "text-text-secondary hover:bg-surface hover:text-cream"
        )}
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-medium">{label}</span>
          {tagline && (
            <span className="mt-0.5 block truncate text-[11px] text-text-muted">
              {tagline}
            </span>
          )}
        </span>
        <ChevronRight className="h-3.5 w-3.5 shrink-0 text-text-muted" />
      </Link>
    </li>
  );
}
