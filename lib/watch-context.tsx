"use client";

import { createContext, useContext } from "react";
import type { BoxDetail, MediaCard } from "@/lib/types";
import type { WatchSession } from "@/components/watch/WatchSession";

export interface TVWatchContextValue {
  details: BoxDetail;
  related: MediaCard[];
  watchlistMedia: Parameters<typeof WatchSession>[0]["watchlistMedia"];
}

const TVWatchContext = createContext<TVWatchContextValue | null>(null);

export function TVWatchProvider({
  details,
  related,
  watchlistMedia,
  children,
}: TVWatchContextValue & { children: React.ReactNode }) {
  return (
    <TVWatchContext.Provider value={{ details, related, watchlistMedia }}>
      {children}
    </TVWatchContext.Provider>
  );
}

export function useTVWatch(): TVWatchContextValue {
  const ctx = useContext(TVWatchContext);
  if (!ctx) {
    throw new Error("useTVWatch must be used within a TVWatchProvider");
  }
  return ctx;
}
