import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Movbox brand mark. The full wordmark ("M" + "ovbox" in lowercase
 * Cinzel + Inter) ships as `/movbox_logo_nav.png` and is loaded via
 * next/image so it's optimized + lazy-loaded. The icon-only mark
 * lives at `/movbox_icon.png` for compact spots (favicon, app icon).
 */
export function Logo({
  className,
  href = "/",
  size = "md",
  variant = "wordmark",
}: {
  className?: string;
  href?: string;
  size?: "sm" | "md" | "lg";
  /** "wordmark" = full logo with text. "icon" = icon only. */
  variant?: "wordmark" | "icon";
}) {
  const heights = {
    sm: 30,
    md: 42,
    lg: 56,
  } as const;

  return (
    <Link
      href={href}
      className={cn("inline-flex shrink-0 items-center", className)}
      aria-label="Movbox — Home"
    >
      <Image
        src={variant === "icon" ? "/movbox_icon.png" : "/movbox_logo_nav.png"}
        alt="Movbox"
        width={variant === "icon" ? heights[size] : heights[size] * 4}
        height={heights[size]}
        priority
        className="h-auto w-auto"
        style={{ height: heights[size] }}
      />
    </Link>
  );
}
