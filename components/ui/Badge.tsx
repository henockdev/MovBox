import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold",
  {
    variants: {
      variant: {
        // Rating badge — yellow on dark
        rating:
          "bg-surface-elevated/90 text-yellow-400 border border-border backdrop-blur",
        // Quality badge — 4K / HD
        quality:
          "bg-yellow-400/90 text-bg-primary font-bold uppercase tracking-wide",
        // "Premium" pill
        premium:
          "bg-gradient-to-r from-accent to-accent-bright text-cream border border-accent-bright/30",
        // "EXCLUSIVE PREMIERE" tag
        premiere:
          "bg-brand text-cream border border-accent/40 uppercase tracking-wider",
        // "New" tag
        new: "bg-accent text-cream",
        // Default
        default:
          "bg-surface text-text-secondary border border-border",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}
