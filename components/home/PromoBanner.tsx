import Image from "next/image";
import { Button } from "@/components/ui/Button";

/**
 * Compact promotional banner — a single short row that sits between
 * the hero and the first content row. Sized so it doesn't dominate
 * the page: shorter vertically, smaller popcorn art, tighter padding.
 */
export function PromoBanner() {
  return (
    <section className="mx-3 sm:mx-5 md:mx-6 lg:px-8">
      <div
        className="relative overflow-hidden rounded-xl border border-border px-3 py-2 sm:px-4 sm:py-2.5 md:rounded-2xl md:px-6 md:py-3"
        style={{
          background:
            "radial-gradient(ellipse at 30% 50%, #5a1a26 0%, #3a1117 55%, #2a0c12 100%)",
        }}
      >
        <div className="relative flex items-center justify-between gap-3 md:gap-5">
          <div className="flex min-w-0 items-center gap-2.5 md:gap-4">
            <span className="relative hidden h-10 w-12 shrink-0 sm:block sm:h-12 sm:w-14 md:h-14 md:w-16">
              <Image
                src="/illustrations/popcorn-promo.png"
                alt="Popcorn and film reel"
                fill
                sizes="(max-width: 768px) 48px, 64px"
                className="object-contain"
                priority={false}
              />
            </span>
            <div className="min-w-0">
              <h3 className="truncate font-display text-sm font-bold text-white sm:text-base md:text-xl">
                Unlimited Movies, TV &amp; More.
              </h3>
              <p className="hidden text-[11px] text-text-secondary sm:block md:text-xs">
                Watch anywhere. Cancel anytime.
              </p>
            </div>
          </div>
          <Button variant="accent" size="sm" className="shrink-0">
            Start Free Trial
          </Button>
        </div>
      </div>
    </section>
  );
}
