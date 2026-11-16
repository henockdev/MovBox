"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import {
  CLARITY_ADULT_ATTR,
  CLARITY_EXCLUDE_ATTR,
  CLARITY_SNIPPET_BODY,
  CLARITY_TAG_URL,
  isClarityExcludedPath,
} from "@/lib/analytics/clarity";

/**
 * Microsoft Clarity.
 *
 * The tag is the owner's own snippet, unmodified — see
 * CLARITY_SNIPPET_BODY in lib/analytics/clarity.ts.
 *
 * ## Why the tag is injected at runtime and not rendered into the HTML
 *
 * A blanket session recorder over an adult catalogue is a terms-of-service
 * risk, so the tag must not run on the 18+ pages. Whether a page is 18+
 * is not always known from its URL — `/tv/<slug>` serves ordinary series
 * and adult ones alike — so the decision cannot be made while the HTML is
 * being rendered. It is made here, in the browser, before the tag is
 * injected:
 *
 *   - an 18+ ROUTE (/category/midnight, the adult ranking shelves) is
 *     excluded by its path;
 *   - an 18+ PAGE marks its own root with `data-clarity-exclude="true"`,
 *     and its content with `data-clarity-mask="true"`;
 *
 * and in either case the tag is never injected, so the SDK never loads,
 * never sets a cookie and never records a thing.
 *
 * If a visitor arrives on an ordinary page and then navigates into an 18+
 * one, the session that is already running is stopped — before the
 * navigation, on the click — so the 18+ URL is not recorded either. A
 * card or a link to an 18+ title carries `data-clarity-adult="true"`,
 * which is what the click handler looks for.
 *
 * `stop` / `start` are the SDK's own lifecycle commands (verified in the
 * 0.8.77 bundle): `stop` tears the recorder down and drops anything it
 * had buffered, `start` brings up a fresh session.
 */

type ClarityApi = ((command: string, ...args: unknown[]) => void) & {
  q?: unknown[];
  /** Set by the SDK once it is initialised. */
  v?: string;
};

function clarityApi(): ClarityApi | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as unknown as { clarity?: ClarityApi }).clarity;
}

/**
 * The queue stub from the owner's snippet.
 *
 * `c[a] = c[a] || function(){(c[a].q=c[a].q||[]).push(arguments)}`
 *
 * It has to exist before the tag script runs, otherwise a command sent
 * while the tag is still downloading is lost.
 */
function ensureQueue(): void {
  const w = window as unknown as { clarity?: ClarityApi };
  if (typeof w.clarity !== "function") {
    w.clarity = function (this: ClarityApi) {
      (w.clarity!.q = w.clarity!.q || []).push(arguments);
    } as ClarityApi;
  }
}

/** True once the SDK has initialised (it stamps its version on itself). */
let sdkLoaded = false;

/** True while the session is stopped and owes a restart. */
let stopped = false;

function detectSdk(): boolean {
  const c = clarityApi();
  if (c && typeof c.v === "string") sdkLoaded = true;
  return sdkLoaded;
}

/** Stop the session. Nothing is buffered and nothing is uploaded after this. */
function stopClarity(): void {
  if (stopped) return;
  if (!detectSdk()) return; // nothing is recording yet — nothing to stop
  try {
    clarityApi()?.("stop");
    stopped = true;
  } catch {
    /* a stopped recorder is the safe state; never let it break the page */
  }
}

/** Bring a stopped session back up. */
function startClarity(): void {
  if (!stopped) return;
  if (!detectSdk()) return;
  try {
    clarityApi()?.("start");
    stopped = false;
  } catch {
    /* ignore */
  }
}

/**
 * Inject the owner's snippet.
 *
 * The snippet is executed as written — it is the same code the owner
 * pasted, and it is the code that loads the tag. It runs as a script
 * element with the snippet as its text, which is the only way to make an
 * inline script execute after the page has loaded.
 */
function ensureTag(): void {
  if (typeof document === "undefined") return;
  if (document.querySelector(`script[src="${CLARITY_TAG_URL}"]`)) return;
  ensureQueue();
  const script = document.createElement("script");
  script.type = "text/javascript";
  script.text = CLARITY_SNIPPET_BODY;
  document.head.appendChild(script);
}

export function Clarity() {
  const pathname = usePathname() ?? "";

  // Keep the session in step with the page. It re-runs on every
  // client-side navigation, which is when a visitor can move between an
  // ordinary page and an 18+ one without a page load.
  useEffect(() => {
    // The live URL is the authority — `usePathname()` can lag a frame
    // behind a client-side navigation.
    const current =
      typeof window !== "undefined" ? window.location.pathname : pathname;

    // An 18+ route: the tag never belongs here.
    if (isClarityExcludedPath(current)) {
      stopClarity();
      return;
    }

    // An 18+ page: it says so itself.
    if (document.querySelector(`[${CLARITY_EXCLUDE_ATTR}="true"]`)) {
      stopClarity();
      return;
    }

    ensureTag();
    startClarity();
  }, [pathname]);

  // Stop before the navigation happens, so an 18+ page is never recorded
  // as a page view.
  useEffect(() => {
    function onClick(event: MouseEvent) {
      const target = event.target as HTMLElement | null;
      if (!target || typeof target.closest !== "function") return;

      if (target.closest(`[${CLARITY_ADULT_ATTR}="true"]`)) {
        stopClarity();
        return;
      }

      const anchor = target.closest("a[href]") as HTMLAnchorElement | null;
      if (!anchor) return;
      const href = anchor.getAttribute("href") || "";
      if (!href.startsWith("/")) return;
      if (isClarityExcludedPath(href.split("?")[0])) stopClarity();
    }

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  return null;
}
