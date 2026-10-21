import { Star } from "lucide-react";
import { formatRating } from "@/lib/format";
import { truncate } from "@/lib/format";

interface Review {
  id: string;
  author: string;
  author_details: { name: string; username: string; avatar_path: string | null; rating: number | null };
  content: string;
  created_at: string;
}

export function ReviewList({ reviews }: { reviews: Review[] }) {
  if (!reviews.length) {
    return (
      <p className="text-sm text-text-muted">No reviews yet. Be the first.</p>
    );
  }
  return (
    <div className="space-y-3">
      {reviews.slice(0, 5).map((r) => (
        <article
          key={r.id}
          className="rounded-xl border border-border bg-surface/40 p-4"
        >
          <header className="mb-2 flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/20 text-sm font-semibold text-accent-bright">
              {(r.author_details.name || r.author).charAt(0)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-cream">
                {r.author_details.name || r.author}
              </p>
              <p className="text-xs text-text-muted">
                {new Date(r.created_at).toLocaleDateString()}
              </p>
            </div>
            {r.author_details.rating != null && (
              <span className="flex items-center gap-1 text-sm font-semibold text-yellow-400">
                <Star className="h-3.5 w-3.5 fill-current" />
                {formatRating(r.author_details.rating)}
              </span>
            )}
          </header>
          <p className="text-sm leading-relaxed text-text-primary">
            {truncate(r.content, 600)}
          </p>
        </article>
      ))}
    </div>
  );
}

interface RatingBreakdownProps {
  voteAverage: number;
  voteCount: number;
  ratings?: Record<string, number>;
}

export function RatingBreakdown({
  voteAverage,
  voteCount,
  ratings,
}: RatingBreakdownProps) {
  // Synthesize a simple breakdown from vote average if no explicit ratings
  const buckets = ratings ?? synthesizeBreakdown(voteAverage, voteCount);
  return (
    <div className="flex items-center gap-6">
      <div className="text-center">
        <div className="font-display text-5xl font-bold text-cream">
          {formatRating(voteAverage)}
        </div>
        <div className="mt-1 flex items-center justify-center gap-0.5 text-yellow-400">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star
              key={i}
              className="h-4 w-4 fill-current"
            />
          ))}
        </div>
        <p className="mt-1 text-xs text-text-muted">{voteCount.toLocaleString()} votes</p>
      </div>
      <div className="flex-1 space-y-1">
        {[10, 9, 8, 7, 6].map((rating) => {
          const pct = buckets[String(rating)] ?? 0;
          return (
            <div key={rating} className="flex items-center gap-2 text-xs">
              <span className="w-6 text-right text-text-muted">{rating}</span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-elevated">
                <div
                  className="h-full rounded-full bg-accent"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="w-10 text-right text-text-muted">{pct}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function synthesizeBreakdown(
  avg: number,
  total: number
): Record<string, number> {
  // Distribute weights around the average
  const base = Math.round(avg);
  const result: Record<string, number> = {};
  for (let r = 6; r <= 10; r++) {
    const dist = Math.abs(base - r);
    result[String(r)] = Math.max(0, 30 - dist * 6);
  }
  // Normalize so top bucket = ~60% if avg is high
  if (avg >= 8) result["10"] = 60;
  if (avg < 6) result["6"] = 50;
  return result;
}
