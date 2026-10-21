"use client";

/**
 * FilterChips — vertical block: section label on top, chip cloud below.
 * The "All" option clears the filter (sends `null`). Designed to look
 * like the boxmovies.org /movies sidebar — slim chips, accent on active.
 */

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { clsx } from "clsx";

export interface FilterChipsProps {
  label: string;
  options: string[];
  value: string | null | undefined;
  onChange: (next: string | null) => void;
  /**
   * If true, "All" is rendered as the first chip and selecting it
   * clears the filter (sends `null`). Defaults to true.
   */
  showAll?: boolean;
  /**
   * Sticky chip accent. Defaults to the brand burgundy.
   */
  accent?: "burgundy" | "neutral";
  /**
   * Use slightly smaller padding for tight filter lists (e.g. country).
   */
  size?: "sm" | "md";
  /**
   * Whether the section starts collapsed. Defaults to false.
   */
  defaultCollapsed?: boolean;
}

export function FilterChips({
  label,
  options,
  value,
  onChange,
  showAll = true,
  accent = "burgundy",
  size = "md",
  defaultCollapsed = false,
}: FilterChipsProps) {
  const isAll = !value || /^all$/i.test(String(value).trim());
  const list = showAll ? ["All", ...options.filter((o) => o !== "All")] : options;
  const [open, setOpen] = useState(!defaultCollapsed);

  return (
    <div className="border-b border-zinc-800/60 py-3 last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 text-left"
      >
        <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-400">
          {label}
          {!isAll && value && (
            <span className="ml-1.5 rounded-full bg-burgundy-500/20 px-1.5 py-0.5 text-[9px] font-bold text-burgundy-200">
              {value}
            </span>
          )}
        </span>
        <ChevronDown
          className={clsx(
            "h-3.5 w-3.5 text-zinc-500 transition-transform",
            open && "rotate-180"
          )}
        />
      </button>

      {open && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {list.map((opt) => {
            const isActive = isAll ? opt === "All" : opt === value;
            return (
              <button
                key={opt}
                type="button"
                onClick={() => onChange(opt === "All" ? null : opt)}
                className={clsx(
                  "rounded-full border transition-all duration-150",
                  size === "sm" ? "px-2.5 py-0.5 text-[11px]" : "px-3 py-1 text-xs",
                  "font-medium leading-tight",
                  isActive
                    ? accent === "burgundy"
                      ? "border-burgundy-500 bg-burgundy-500 text-cream shadow-sm"
                      : "border-zinc-300 bg-zinc-100 text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                    : "border-zinc-700/60 bg-zinc-900/40 text-zinc-300 hover:border-zinc-500 hover:bg-zinc-800/60 hover:text-zinc-100"
                )}
              >
                {opt}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
