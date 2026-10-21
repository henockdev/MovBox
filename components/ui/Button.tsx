import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-bright focus-visible:ring-offset-2 focus-visible:ring-offset-bg-deepest disabled:pointer-events-none disabled:opacity-50 cursor-pointer",
  {
    variants: {
      variant: {
        // Primary burgundy — Watch Now, etc.
        primary:
          "bg-brand text-cream hover:bg-accent shadow-card hover:shadow-glow rounded-md",
        // Secondary outline — + My List
        secondary:
          "bg-surface-elevated/80 backdrop-blur text-text-primary border border-border hover:border-accent hover:bg-surface-hover rounded-md",
        // Ghost — nav items
        ghost:
          "text-text-secondary hover:text-text-primary hover:bg-surface-hover rounded-md",
        // Cream accent — Start Free Trial, premium CTAs
        accent:
          "bg-cream text-bg-primary hover:bg-vanilla rounded-md font-semibold",
      },
      size: {
        sm: "h-8 px-3 text-sm",
        md: "h-10 px-4 text-sm",
        lg: "h-12 px-6 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { buttonVariants };
