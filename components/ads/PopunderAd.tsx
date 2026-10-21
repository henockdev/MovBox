"use client";

import { useEffect } from "react";
import { EXOCLICK } from "@/lib/ads/exoclick";

/**
 * PopunderAd — ExoClick popunder, zone 6057172.
 *
 * THIS IS THE ONE UNIT THAT MONETISES A VISIT WITH NO ENGAGEMENT.
 *
 * Everything else in the ad stack is conditional on the visitor doing
 * something: the pre-roll needs a play click, the out-stream needs a pause,
 * the slider needs browse time, the sponsored grid needs scrolling past it.
 * A visitor who lands, reads for ten seconds and leaves generates nothing at
 * all. That population is most of a streaming site's top-of-funnel traffic,
 * so the popunder is the only unit here that earns from it.
 *
 * WHERE IT RUNS: everywhere, including /watch, with no exclusion.
 *
 * This is a deliberate reversal of the rule we apply to every other unit.
 * ExoclickVideoSlider excludes /watch because a floating video player
 * jammed into a full-bleed playback screen is hostile to the thing we
 * actually sell. The popunder is not the same thing: their
 * `trigger_method: 3` fires on user interaction, not on load, and their own
 * `frequency_period`/`frequency_count` (1 per 60 minutes) caps it per
 * visitor via cookie. So it cannot ambush a viewer at the moment they press
 * play — it earns from the clicks they make afterwards (next episode, back
 * to browse, search). Adding a second cap of our own on top of theirs would
 * mean neither cap is the one actually governing, so we add none.
 *
 * DELIVERY: the dashboard issued this as a raw inline <script>, not an <ins>
 * tag, because the popunder is a self-contained IIFE with its own adConfig
 * pointing at a.pemsrv.com / s.pemsrv.com — a completely different delivery
 * host from the a.magsrv.com ad-provider loader the other zones use.
 *
 * The ~16KB obfuscated blob is shipped verbatim as /popunder-6057172.js
 * rather than inlined into a JSX string body, because pasting that much
 * minified third-party code through React's children handling is an
 * escaping minefield and buys nothing. See the note on
 * EXOCLICK.popunderScriptSrc.
 */

/**
 * Exactly-once per document. Module scope survives re-renders and
 * client-side navigation, and resets on a real page load — which is the
 * lifetime a popunder zone wants.
 */
let injected = false;

export function PopunderAd() {
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (injected) return;

    // Belt and braces on top of the latch: a bfcache restore can replay the
    // effect without reloading the module scope.
    if (document.getElementById(EXOCLICK.popunderScriptSrc)) return;

    const el = document.createElement("script");
    // The id must be a valid DOM id, not a path — "/" is fine in HTML ids but
    // keep it readable and selector-safe anyway.
    el.id = `exoclick-popunder-${EXOCLICK.popunderZoneId}`;
    el.src = EXOCLICK.popunderScriptSrc;
    el.async = true;
    el.type = "application/javascript";
    document.body.appendChild(el);

    injected = true;
    console.log(`[movbox:popunder] loaded zone ${EXOCLICK.popunderZoneId}`);
  }, []);

  return null;
}