import { Monitor, Shield, Download, Smartphone } from "lucide-react";

const FEATURES = [
  {
    icon: Monitor,
    title: "4K Ultra HD",
    desc: "Stunning quality for the best viewing experience.",
  },
  {
    icon: Shield,
    title: "No Ads",
    desc: "Enjoy uninterrupted entertainment.",
  },
  {
    icon: Download,
    title: "Download & Watch",
    desc: "Watch offline anytime, anywhere.",
  },
  {
    icon: Smartphone,
    title: "Multiple Devices",
    desc: "Stream on your phone, tablet, or TV.",
  },
];

/**
 * Compact 4-card feature strip. Sits under the promo banner on the home page.
 * Sized small — these are quick value props, not the main content.
 */
export function FeatureFooter() {
  return (
    <section className="mx-3 mt-3 sm:mx-5 md:mx-6 lg:mx-8">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3">
        {FEATURES.map((f) => {
          const Icon = f.icon;
          return (
            <div
              key={f.title}
              className="group flex items-center gap-2.5 rounded-lg border border-border bg-surface/60 px-2.5 py-2 transition-colors hover:border-accent md:gap-3 md:px-3 md:py-2.5"
            >
              <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border bg-surface-elevated text-accent-bright transition-all group-hover:border-accent group-hover:bg-brand group-hover:text-cream md:h-8 md:w-8">
                <Icon className="h-3.5 w-3.5 md:h-4 md:w-4" />
              </span>
              <div className="min-w-0">
                <h4 className="font-display text-[11px] font-semibold leading-tight text-cream md:text-xs">
                  {f.title}
                </h4>
                <p className="mt-0.5 hidden text-[10px] leading-tight text-text-muted sm:block md:text-[11px]">
                  {f.desc}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
