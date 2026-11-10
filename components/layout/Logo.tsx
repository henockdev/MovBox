import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * The Movbox brand mark.
 *
 * ## Why the mark alone
 *
 * The header used to carry a baked-in wordmark PNG — actually a JPEG with no
 * alpha channel and about 70 % empty padding around the artwork. On a
 * near-black header it read as a black box with a tiny logo stuck on it: the
 * file was scaled to 42 px tall, but the logo inside it only occupied the
 * middle 30 %, so the mark actually rendered about 12 px tall.
 *
 * Now the header carries the mark itself, at full size:
 *
 *   - the artwork is the real transparent PNG
 *     (`assets/brand/movbox-mark.png`, built by
 *     `scripts/make-brand-assets.py`), trimmed to its alpha bounding box, so
 *     every pixel of the file is the logo;
 *   - there is no black plate behind it and no second copy of the wordmark
 *     next to it — the mark is the brand.
 *
 * The image is 256×229, so the width is derived from the height.
 */
export function Logo({
  className,
  href = "/",
  size = "md",
}: {
  className?: string;
  href?: string;
  size?: "sm" | "md" | "lg";
}) {
  const heights = { sm: 32, md: 48, lg: 64 } as const;
  const h = heights[size];

  return (
    <Link
      href={href}
      className={cn("inline-flex shrink-0 items-center", className)}
      aria-label="Movbox — Home"
    >
      <Image
        src="/movbox_logo_nav.png"
        alt="Movbox"
        width={Math.round(h * 1.118)}
        height={h}
        priority
        className="h-auto w-auto"
        style={{ height: h }}
      />
    </Link>
  );
}
