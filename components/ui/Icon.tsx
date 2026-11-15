import { cn } from "@/lib/utils";

/**
 * The icons that appear once per card — and there are ~480 cards on the
 * homepage alone.
 *
 * ## Why this file exists
 *
 * `lucide-react` inlines the full path data into every single icon it
 * renders. On the homepage that happened 1,409 times, and the four icons on
 * a movie card (star, play, plus, clapperboard) accounted for 1,341 of them.
 * The path data alone was **254 KB**, and the repeated `<svg>` wrapper
 * attributes (`xmlns`, `width`, `height`, `viewBox`, `fill`, `stroke`,
 * `stroke-width`, `stroke-linecap`, `stroke-linejoin`) added another
 * **372 KB** — 627 KB of the homepage's 1.75 MB, or 36% of the page, spent
 * repeating the same fourteen path commands.
 *
 * A sprite fixes that: the path data is emitted ONCE per page inside a
 * `<symbol>`, and each icon becomes a `<use>` reference — about 90 bytes
 * instead of 400. Same rendered pixels, ~500 KB less HTML.
 *
 * ## Fidelity
 *
 * The symbol carries `viewBox` plus `stroke-width="2" stroke-linecap="round"
 * stroke-linejoin="round"`, and the `<svg>` wrapper carries `fill="none"
 * stroke="currentColor"` — exactly the attributes lucide puts on its own
 * `<svg>`. The symbol pins no `fill`, so `fill` is inherited, which matters
 * for two of these icons:
 *
 * - **star** is styled `fill-yellow-400`, so it must be a *filled* shape.
 *   `fill` is inherited, so the wrapper's `fill="none"` is overridden by the
 *   Tailwind class on the same element (CSS beats a presentation attribute)
 *   and the path inherits the yellow. The symbol must therefore NOT pin
 *   `fill="none"` itself, or it would beat that inheritance.
 * - **play** is styled `fill-current`, same story.
 *
 * The remaining icons (plus, check, clapperboard, chevrons) inherit
 * `fill="none"` from the wrapper, which is what lucide gives them too.
 *
 * One trade-off: the stroke *width* and line styles live on the symbol, so
 * the `<svg>` element's own computed `stroke-width` reads 1 instead of 2.
 * Nothing draws with the element's own stroke — the paths inherit the
 * symbol's — so this changes no pixels. It is the one difference
 * `scripts/verify-css-equivalence.mjs` is allowed to report.
 */

export type IconName =
  | "star"
  | "play"
  | "plus"
  | "check"
  | "clapperboard"
  | "chevron-left"
  | "chevron-right";

/** The path data, lifted verbatim from the installed lucide-react package. */
const PATHS: Record<IconName, string[]> = {
  star: [
    "M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.123 2.123 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z",
  ],
  play: ["M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z"],
  plus: ["M5 12h14", "M12 5v14"],
  check: ["M20 6 9 17l-5-5"],
  clapperboard: [
    "m12.296 3.464 3.02 3.956",
    "M20.2 6 3 11l-.9-2.4c-.3-1.1.3-2.2 1.3-2.5l13.5-4c1.1-.3 2.2.3 2.5 1.3z",
    "M3 11h18v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z",
    "m6.18 5.276 3.1 3.899",
  ],
  "chevron-left": ["m15 18-6-6 6-6"],
  "chevron-right": ["m9 18 6-6-6-6"],
};

interface IconProps extends React.SVGProps<SVGSVGElement> {
  name: IconName;
  className?: string;
}

/**
 * A lucide icon drawn from the page-wide sprite.
 *
 * Drop-in for the lucide component it replaces: it takes the same `className`
 * and renders the same `lucide lucide-<name>` classes, so every Tailwind
 * size/colour utility still applies unchanged.
 */
export function Icon({ name, className, ...rest }: IconProps) {
  return (
    <svg
      className={cn("lucide", `lucide-${name}`, className)}
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      aria-hidden="true"
      {...rest}
    >
      <use href={`#i-${name}`} />
    </svg>
  );
}

/**
 * The sprite itself — one instance per document, mounted in the root layout.
 *
 * It is zero-sized rather than `display:none`: a hidden sprite is still
 * referenceable by `<use>`, but a zero-size box is the form every browser
 * and every SVG renderer is known to handle.
 */
export function IconSprite() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }}
    >
      {(Object.keys(PATHS) as IconName[]).map((name) => (
        <symbol
          key={name}
          id={`i-${name}`}
          viewBox="0 0 24 24"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {PATHS[name].map((d, i) => (
            <path key={i} d={d} />
          ))}
        </symbol>
      ))}
    </svg>
  );
}
