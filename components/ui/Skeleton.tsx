import { cn } from "@/lib/utils";

/**
 * Animated skeleton placeholder for loading states.
 * Uses the global `.skeleton` class for the shimmer animation.
 */
export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("skeleton rounded-md", className)}
      aria-hidden="true"
      {...props}
    />
  );
}
