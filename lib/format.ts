/**
 * Lightweight formatters used across the UI.
 * Keep these pure + side-effect free so they're safe in Server Components.
 */

/** Format minutes as "1h 46m" / "46m" / "2h" */
export function formatRuntime(minutes?: number | null): string {
  if (!minutes || minutes <= 0) return "";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/** Format a date string (ISO) as a year only: "2024" */
export function formatYear(date?: string | null): string {
  if (!date) return "";
  return new Date(date).getFullYear().toString();
}

/** Format rating 8.7 -> "8.7", 8 -> "8.0" */
export function formatRating(vote?: number | null): string {
  if (vote == null) return "—";
  return vote.toFixed(1);
}

/** Format large numbers: 1500000 -> "1.5M", 23000 -> "23K" */
export function formatCount(n?: number | null): string {
  if (!n) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toString();
}

/** Truncate text with ellipsis */
export function truncate(text: string | null | undefined, max: number): string {
  if (!text) return "";
  if (text.length <= max) return text;
  return text.slice(0, max - 1).trimEnd() + "…";
}
