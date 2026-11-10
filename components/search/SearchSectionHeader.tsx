import { cn } from "@/lib/utils";

/**
 * A section heading.
 *
 * The app's signature: a short brand-coloured bar and a wide-tracked capital
 * line. The same quiet mark is used across the whole app, so the search
 * screen reads like the rest of the product rather than like a web form.
 */
export function SearchSectionHeader({
  title,
  count,
  action,
  className,
}: {
  title: string;
  count?: number | string | null;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-3 mt-8 flex items-center gap-2.5", className)}>
      <span aria-hidden className="h-[13px] w-[3px] rounded-[2px] bg-brand" />
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-secondary">
        {title}
      </h2>
      {count != null && count !== "" ? (
        <span className="rounded-full bg-surface-elevated px-2 py-0.5 text-[10px] font-medium text-text-muted">
          {count}
        </span>
      ) : null}
      {action ? <div className="ml-auto">{action}</div> : null}
    </div>
  );
}
