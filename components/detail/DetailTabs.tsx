"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

export interface Tab {
  id: string;
  label: string;
  count?: number;
}

interface DetailTabsProps {
  tabs: Tab[];
  defaultTab?: string;
  children: (activeTab: string) => React.ReactNode;
}

export function DetailTabs({ tabs, defaultTab, children }: DetailTabsProps) {
  const [active, setActive] = useState(defaultTab ?? tabs[0]?.id ?? "");

  return (
    <div>
      <div className="no-scrollbar -mx-4 mb-6 flex gap-1 overflow-x-auto border-b border-border px-4 md:mx-0 md:px-0">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setActive(t.id)}
            className={cn(
              "relative whitespace-nowrap px-4 py-3 text-sm font-medium transition-colors",
              active === t.id
                ? "text-accent-bright"
                : "text-text-secondary hover:text-text-primary"
            )}
          >
            {t.label}
            {t.count != null && (
              <span className="ml-1 text-xs text-text-muted">({t.count})</span>
            )}
            {active === t.id && (
              <span className="absolute inset-x-0 -bottom-px h-0.5 bg-accent-bright" />
            )}
          </button>
        ))}
      </div>
      {children(active)}
    </div>
  );
}
