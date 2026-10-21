/**
 * ExoClick globals.
 *
 * The display zone uses ExoClick's generic ad-provider loader, which
 * parks its work queue on `window.AdProvider` before its own script has
 * finished loading. We push a `{ serve: {} }` command into that queue.
 *
 * The in-stream pre-roll (components/ads/PrerollAd.tsx) does NOT use
 * any global — we parse its VAST ourselves.
 */
export {};

declare global {
  interface Window {
    AdProvider?: unknown[];
  }
}