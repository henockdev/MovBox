"use client";

import Script from "next/script";

/**
 * AdScript — the single way a third-party ad tag enters this application.
 *
 * Every ad <script> on the site goes through here. That is deliberate: the
 * three properties below are the ones that keep a third-party tag from
 * becoming a site incident, and centralising them is the only way to
 * guarantee they actually hold.
 *
 *   1. EXACTLY ONCE. Ad tags that execute twice bill twice and fire
 *      duplicate impression/click events. `next/script` dedupes by `id`
 *      within a document; the module latch covers the case where a
 *      client-side navigation remounts the component and React hands us a
 *      fresh element tree. Belt and braces, because this is the single
 *      highest-cost bug in an ad stack.
 *
 *   2. NEVER BLOCKS RENDER. `afterInteractive` only. A blocking script in
 *      <head> is a direct LCP/INP regression and a Core Web Vitals
 *      failure. If a network's tag must load before paint, that is a
 *      conversation to have with the network, not something to fix by
 *      making the whole site slower.
 *
 *   3. FAILURE IS INVISIBLE. If the network is blocked, down, slow, or the
 *      browser refuses it, this component renders nothing and the error is
 *      swallowed. An ad script must never be able to throw into the React
 *      tree and blank a page.
 *
 * We deliberately do NOT inject via createElement + appendChild. The
 * previous provider's popunder did that, which is how you end up with a
 * tag that survives remounts in ways nobody can reason about. next/script
 * owns the lifecycle; this component only decides *whether* to load.
 */

/**
 * Module-scope set of tag ids already requested this session.
 *
 * Module scope survives re-renders and client-side navigation, which is
 * exactly the lifetime we want: a popunder that re-fires on every route
 * change is the thing that gets a site banned. A real page load resets it,
 * which is the lifetime an ad zone actually wants.
 */
const requested = new Set<string>();

export interface AdScriptProps {
  /** Stable, unique, network-prefixed id. Doubles as the dedupe key. */
  id: string;
  /** Publisher tag URL. Must be a full https:// URL. */
  src: string;
  /** Referrer policy. Publisher tags normally want no-referrer-on-downgrade. */
  referrerPolicy?: React.HTMLAttributeReferrerPolicy;
  /** Skip rendering entirely — used when a placement is route-excluded. */
  enabled?: boolean;
}

export function AdScript({
  id,
  src,
  referrerPolicy = "no-referrer-when-downgrade",
  enabled = true,
}: AdScriptProps) {
  if (!enabled || !src) return null;
  if (requested.has(id)) return null;
  requested.add(id);

  return (
    <Script
      id={id}
      src={src}
      strategy="afterInteractive"
      type="text/javascript"
      referrerPolicy={referrerPolicy}
      // next/script supports onError for src-based scripts. We swallow it on
      // purpose: an ad blocker, a DNS failure, or a 4xx from the network must
      // be completely invisible to the user and must not surface as an
      // unhandled error.
      onError={() => {
        /* ad blocked, blocked domain, or network error — not our problem */
      }}
    />
  );
}

/**
 * Test seam: forget which tags have been requested.
 *
 * Only used by manual verification scripts. Never call from app code — if
 * you find yourself wanting to, the placement is probably mounted in the
 * wrong place and the right fix is there, not here.
 */
export function resetAdScriptLatchForTesting(): void {
  requested.clear();
}