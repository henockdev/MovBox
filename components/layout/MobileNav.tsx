"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Film, Tv, Sparkles, Flame, AppWindow } from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/", label: "Home", icon: Home },
  { href: "/movies", label: "Movies", icon: Film },
  { href: "/tv", label: "TV", icon: Tv },
  { href: "/animations", label: "Anime", icon: Sparkles },
  { href: "/most-watched", label: "Top", icon: Flame },
  { href: "/movbox-app", label: "App", icon: AppWindow },
];

/**
 * Bottom mobile nav. Hidden on md+ where the top nav takes over.
 * Compact 56px tall, with a subtle active indicator above the icon.
 */
export function MobileNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Primary"
      className="movbox-mobile-nav fixed inset-x-0 bottom-0 z-50 border-t border-zinc-800/80 bg-bg-deepest/95 shadow-elevated backdrop-blur-md md:hidden"
    >
      <ul className="flex items-stretch justify-around">
        {ITEMS.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                className={cn(
                  "relative flex h-14 flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors",
                  active
                    ? "text-accent-bright"
                    : "text-text-muted hover:text-text-primary"
                )}
              >
                {active && (
                  <span className="absolute inset-x-3 top-0 h-0.5 rounded-b-full bg-accent-bright" />
                )}
                <Icon className="h-[18px] w-[18px]" />
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
