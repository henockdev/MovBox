import { cn } from "@/lib/utils";

/**
 * The pill chip the app uses for every term it offers — a recent search, a
 * trending term, a suggestion, a genre, a year.
 */
export function SearchChip({
  text,
  onClick,
  active = false,
  title,
  className,
}: {
  text: string;
  onClick: () => void;
  /** Selected state — used by the genre / year / country filters. */
  active?: boolean;
  title?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title ?? text}
      aria-pressed={active}
      className={cn(
        "inline-flex h-8 max-w-[240px] shrink-0 items-center gap-1.5 truncate rounded-full border px-3.5 text-[13px] font-medium transition-all duration-200",
        active
          ? "border-accent bg-brand/25 text-cream shadow-glow"
          : "border-border bg-surface-elevated text-accent-soft hover:border-accent hover:bg-surface-hover hover:text-cream",
        className
      )}
    >
      {text}
    </button>
  );
}
