"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { CATEGORIES } from "@/lib/categories";
import { cn } from "@/lib/utils";

/**
 * Desktop dropdown for the category shelves.
 *
 * The app carries more shelves than the site's top navigation can hold, so
 * they live behind one menu item instead of stretching the bar. The footer
 * lists the same links for crawlers and for anyone who scrolls.
 */
export function CategoriesMenu() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const isActive = pathname.startsWith("/category/");

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex items-center gap-1 rounded-md px-2.5 py-1.5 text-[13px] font-medium transition-colors",
          isActive
            ? "text-accent-bright"
            : "text-text-secondary hover:text-text-primary"
        )}
      >
        Categories
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 transition-transform",
            open && "rotate-180"
          )}
        />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-2 w-[520px] rounded-xl border border-border bg-surface-elevated p-3 shadow-elevated">
          <ul className="grid grid-cols-2 gap-1">
            {CATEGORIES.map((cat) => (
              <li key={cat.slug}>
                <Link
                  href={`/category/${cat.slug}`}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "block rounded-lg px-3 py-2 transition-colors",
                    pathname === `/category/${cat.slug}`
                      ? "bg-surface text-accent-bright"
                      : "text-text-secondary hover:bg-surface hover:text-cream"
                  )}
                >
                  <span className="block text-[13px] font-medium">{cat.title}</span>
                  <span className="mt-0.5 block text-[11px] text-text-muted">
                    {cat.tagline}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
