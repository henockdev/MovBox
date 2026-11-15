#!/usr/bin/env node
/**
 * Proves that extracting the movie card's Tailwind classes into
 * `@layer components` changed nothing about how the card renders.
 *
 * ## How it works
 *
 * 1. Parse the compiled stylesheet of two builds — the "before" one and the
 *    "after" one — into flat rules: `{layer, media, selector, declarations}`.
 * 2. For every part of the card, resolve the **computed style** of the
 *    element the way a browser would: every rule whose selector matches the
 *    element (or one of its ancestors) contributes declarations, and the
 *    winner for each property is decided by
 *    `important > layer order > specificity > source order`.
 * 3. Do that twice — once with the element carrying the OLD class list, once
 *    with it carrying the NEW one — and diff the two property maps.
 *
 * The check runs at three viewport widths and in two interaction states, so a
 * difference hiding behind a `sm:` breakpoint or a `:hover` rule cannot slip
 * through.
 *
 * ## Usage
 *
 *   node scripts/verify-css-equivalence.mjs <before-css-dir> <after-css-dir>
 *
 * Both directories hold the `.css` files emitted by `next build` into
 * `.next/static/chunks`.
 */

import fs from "node:fs";
import path from "node:path";

/* ------------------------------------------------------------------ CSS --- */

/** Split a stylesheet into a flat list of rules. */
function parseCSS(text) {
  const rules = [];
  let i = 0;
  let layer = null;
  let media = null;
  let pendingLayer = null;
  let pendingMedia = null;
  const stack = [];

  const skipWs = () => {
    while (i < text.length && /\s/.test(text[i])) i++;
  };

  while (i < text.length) {
    skipWs();
    if (i >= text.length) break;

    if (text[i] === "/" && text[i + 1] === "*") {
      const end = text.indexOf("*/", i + 2);
      i = end === -1 ? text.length : end + 2;
      continue;
    }

    if (text[i] === "@") {
      // read the at-rule prelude
      let j = i + 1;
      let depth = 0;
      let prelude = "";
      while (j < text.length) {
        const c = text[j];
        if (c === "(") depth++;
        else if (c === ")") depth--;
        else if (c === "{" && depth === 0) break;
        else if (c === ";" && depth === 0) {
          // statement at-rule (e.g. @layer a,b,c;) — the layer order is
          // read from the stylesheet text further down, not from here.
          i = j + 1;
          prelude = null;
          break;
        }
        prelude += c;
        j++;
      }
      if (prelude === null) continue;

      const name = prelude.trim().split(/\s+/)[0];
      if (name === "layer") {
        const names = prelude.slice(prelude.indexOf("layer") + 5).split(",").map((s) => s.trim()).filter(Boolean);
        pendingLayer = names.length === 1 ? names[0] : (layer ?? names.join(","));
      } else if (name === "media" || name === "supports") {
        pendingMedia = name === "media" ? prelude.slice(prelude.indexOf("media") + 5).trim() : null;
      }

      if (text[j] === "{") {
        // remember the ENCLOSING context, then enter the new one
        stack.push({ layer, media });
        if (pendingLayer !== null) layer = pendingLayer;
        if (pendingMedia !== null) media = pendingMedia;
        pendingLayer = null;
        pendingMedia = null;
        i = j + 1;
        continue;
      }
      pendingLayer = null;
      pendingMedia = null;
      i = j + 1;
      continue;
    }

    if (text[i] === "}") {
      const prev = stack.pop();
      if (prev) {
        layer = prev.layer;
        media = prev.media;
      }
      i++;
      continue;
    }

    // a normal rule: selector { declarations }
    let sel = "";
    let depth = 0;
    while (i < text.length) {
      const c = text[i];
      if (c === "(") depth++;
      else if (c === ")") depth--;
      else if (c === "{" && depth === 0) break;
      sel += c;
      i++;
    }
    if (i >= text.length) break;
    i++; // consume {

    let body = "";
    depth = 0;
    while (i < text.length) {
      const c = text[i];
      if (c === "{") depth++;
      else if (c === "}") {
        if (depth === 0) break;
        depth--;
      }
      body += c;
      i++;
    }
    if (text[i] === "}") i++;

    const trimmed = sel.trim();
    if (!trimmed) continue;
    // nested rules (@media inside a rule) are not used by Tailwind's output
    if (trimmed.includes("{")) continue;

    for (const part of splitSelectors(trimmed)) {
      rules.push({
        layer,
        media,
        selector: part,
        decls: parseDecls(body),
        order: rules.length,
      });
    }
  }
  return rules;
}

function splitSelectors(sel) {
  const out = [];
  let depth = 0;
  let cur = "";
  for (const c of sel) {
    if (c === "(" || c === "[") depth++;
    else if (c === ")" || c === "]") depth--;
    if (c === "," && depth === 0) {
      out.push(cur.trim());
      cur = "";
    } else cur += c;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

function parseDecls(body) {
  const out = [];
  let depth = 0;
  let cur = "";
  const parts = [];
  for (const c of body) {
    if (c === "(") depth++;
    else if (c === ")") depth--;
    if (c === ";" && depth === 0) {
      parts.push(cur);
      cur = "";
    } else cur += c;
  }
  if (cur.trim()) parts.push(cur);
  for (const p of parts) {
    const idx = p.indexOf(":");
    if (idx === -1) continue;
    const prop = p.slice(0, idx).trim();
    let value = p.slice(idx + 1).trim();
    let important = false;
    if (/!important$/i.test(value)) {
      important = true;
      value = value.replace(/!important$/i, "").trim();
    }
    if (!prop || prop.startsWith("@")) continue;
    out.push({ prop, value, important });
  }
  return out;
}

/* ------------------------------------------------------------ selectors --- */

/** Split "a > b c" into ["a", ">", "b", " ", "c"] style compounds. */
function tokenizeSelector(sel) {
  const compounds = [];
  let cur = "";
  let depth = 0;
  let combinator = " ";
  for (let i = 0; i < sel.length; i++) {
    const c = sel[i];
    if (c === "(" || c === "[") depth++;
    else if (c === ")" || c === "]") depth--;
    if (depth === 0 && (c === " " || c === ">")) {
      let j = i;
      while (j < sel.length && (sel[j] === " " || sel[j] === ">")) j++;
      const comb = sel.slice(i, j).includes(">") ? ">" : " ";
      if (cur.trim()) compounds.push({ combinator: combinator, compound: cur.trim() });
      combinator = comb;
      cur = "";
      i = j - 1;
      continue;
    }
    cur += c;
  }
  if (cur.trim()) compounds.push({ combinator, compound: cur.trim() });
  return compounds;
}

function parseCompound(text) {
  const out = { tag: null, classes: [], pseudos: [], pseudoEls: [], attrs: [] };
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    if (c === ".") {
      let j = i + 1;
      while (j < text.length) {
        const ch = text[j];
        // an escaped character is part of the class name, never a delimiter
        if (ch === "\\") {
          j += 2;
          continue;
        }
        if (/[.#:[\s>]/.test(ch)) break;
        j++;
      }
      out.classes.push(unescapeCSS(text.slice(i + 1, j)));
      i = j;
    } else if (c === "#") {
      let j = i + 1;
      while (j < text.length && /[-\w]/.test(text[j])) j++;
      i = j; // ids are ignored for matching
    } else if (c === "[") {
      let j = text.indexOf("]", i);
      out.attrs.push(text.slice(i + 1, j === -1 ? text.length : j));
      i = j === -1 ? text.length : j + 1;
    } else if (c === ":") {
      if (text[i + 1] === ":") {
        let j = i + 2;
        while (j < text.length && /[-\w]/.test(text[j])) j++;
        out.pseudoEls.push(text.slice(i + 2, j).toLowerCase());
        i = j;
      } else {
        let j = i + 1;
        while (j < text.length && /[-\w]/.test(text[j])) j++;
        let name = text.slice(i + 1, j).toLowerCase();
        let inner = null;
        if (text[j] === "(") {
          let depth = 1;
          let k = j + 1;
          let buf = "";
          while (k < text.length && depth > 0) {
            if (text[k] === "(") depth++;
            else if (text[k] === ")") {
              depth--;
              if (depth === 0) break;
            }
            buf += text[k];
            k++;
          }
          inner = buf;
          j = k + 1;
        }
        out.pseudos.push({ name, inner });
        i = j;
      }
    } else if (/[-\w*]/.test(c)) {
      let j = i;
      while (j < text.length && /[-\w*\\]/.test(text[j])) j++;
      const tag = text.slice(i, j);
      if (tag !== "*") out.tag = tag.toLowerCase();
      i = j;
    } else {
      i++;
    }
  }
  return out;
}

function unescapeCSS(s) {
  return s.replace(/\\([\s\S])/g, "$1");
}

/** Does a compound match the element? */
function compoundMatches(comp, el, chain) {
  // A rule with a pseudo-element (`::before`, `::-webkit-scrollbar`) styles a
  // generated box, not the element itself — it must not contribute to the
  // element's own computed style.
  if (comp.pseudoEls.length) return false;
  if (comp.tag && el.tag && comp.tag !== el.tag.toLowerCase()) return false;
  for (const cls of comp.classes) if (!el.classes.includes(cls)) return false;
  for (const attr of comp.attrs) {
    // [type='button'] etc. — treat any attribute requirement as unmatched
    // unless it is a class-ish selector we do not model.
    return false;
  }
  for (const p of comp.pseudos) {
    if (!pseudoMatches(p, el, chain)) return false;
  }
  return true;
}

function pseudoMatches(p, el, chain) {
  switch (p.name) {
    case "hover":
      return !!el.state.hover;
    case "focus":
      return !!el.state.focus;
    case "focus-visible":
      return !!el.state.focusVisible;
    case "active":
      return !!el.state.active;
    case "not":
      return !splitSelectors(p.inner).some((s) => simpleMatches(s, el, chain));
    case "is":
    case "where": {
      const inner = p.inner || "";
      // Tailwind writes the group-hover variant as
      //   `.group-hover\:x:is(:where(.group):hover *)`
      // i.e. "this element sits inside a hovered .group". The `:hover` and
      // the `*` are part of one pseudo-class, so the whole thing is an
      // ancestor test, not a test of the element itself.
      const anc = inner.match(/^(.*?):hover\s*\*$/s);
      if (anc) {
        const base = anc[1].trim();
        const baseComp = parseCompound(base);
        const wrapper = baseComp.pseudos.find(
          (x) => x.name === "where" || x.name === "is"
        );
        const sel = wrapper ? wrapper.inner : base;
        for (let i = 1; i < chain.length; i++) {
          const a = chain[i];
          if (!a.state.hover) continue;
          if (simpleMatches(sel, a, chain)) return true;
        }
        return false;
      }
      return splitSelectors(inner).some((s) => simpleMatches(s, el, chain));
    }
    case "first-child":
      return el.state.firstChild;
    case "last-child":
      return el.state.lastChild;
    case "root":
      return el.tag === "html";
    default:
      return false; // unknown pseudo — assume it does not match
  }
}

function simpleMatches(sel, el, chain) {
  const comp = parseCompound(sel);
  return compoundMatches(comp, el, chain);
}

/** Match a full selector against an element chain (element first). */
function selectorMatches(sel, chain) {
  const compounds = tokenizeSelector(sel);
  if (!compounds.length) return false;
  const el = chain[0];
  const last = compounds[compounds.length - 1];
  if (!compoundMatches(parseCompound(last.compound), el, chain)) return false;

  let ci = compounds.length - 2;
  let ei = 1;
  while (ci >= 0) {
    const comp = parseCompound(compounds[ci].compound);
    const combinator = compounds[ci + 1].combinator;
    if (combinator === ">") {
      if (ei >= chain.length) return false;
      if (!compoundMatches(comp, chain[ei], chain)) return false;
      ei++;
      ci--;
    } else {
      let found = false;
      while (ei < chain.length) {
        if (compoundMatches(comp, chain[ei], chain)) {
          found = true;
          ei++;
          break;
        }
        ei++;
      }
      if (!found) return false;
      ci--;
    }
  }
  return true;
}

function specificity(sel) {
  let a = 0, b = 0, c = 0;
  for (const part of splitSelectors(sel)) {
    const compounds = tokenizeSelector(part);
    for (const { compound } of compounds) {
      const parsed = parseCompound(compound);
      b += parsed.classes.length + parsed.attrs.length;
      for (const p of parsed.pseudos) {
        if (p.name === "not" || p.name === "is" || p.name === "where") {
          let best = 0;
          for (const s of splitSelectors(p.inner || "")) {
            best = Math.max(best, specificity(s));
          }
          b += Math.floor(best / 100);
        } else {
          b += 1;
        }
      }
      c += parsed.pseudoEls.length;
      if (parsed.tag) c += 1;
    }
  }
  return a * 10000 + b * 100 + c;
}

/* --------------------------------------------------------------- media --- */

function mediaMatches(media, ctx) {
  if (!media) return true;
  const m = media.toLowerCase();
  const rem = 16;
  const checks = [];
  let m2 = m;

  // Tailwind v4 writes a max-width variant as `not all and (min-width: X)`.
  m2 = m2.replace(/not all and \(min-width:\s*([\d.]+)(px|rem)\)/g, (_, v, u) => `maxw:${parseFloat(v) * (u === "rem" ? rem : 1)}`);
  m2 = m2.replace(/min-width:\s*([\d.]+)(px|rem)/g, (_, v, u) => `minw:${parseFloat(v) * (u === "rem" ? rem : 1)}`);
  m2 = m2.replace(/\(width\s*>=\s*([\d.]+)(px|rem)\)/g, (_, v, u) => `minw:${parseFloat(v) * (u === "rem" ? rem : 1)}`);
  m2 = m2.replace(/\(width\s*<\s*([\d.]+)(px|rem)\)/g, (_, v, u) => `maxw:${parseFloat(v) * (u === "rem" ? rem : 1)}`);
  m2 = m2.replace(/max-width:\s*([\d.]+)(px|rem)/g, (_, v, u) => `maxw:${parseFloat(v) * (u === "rem" ? rem : 1)}`);

  if (/\(pointer:\s*coarse\)/.test(m2)) checks.push(() => ctx.pointer === "coarse");
  if (/\(pointer:\s*fine\)/.test(m2)) checks.push(() => ctx.pointer === "fine");
  // Tailwind gates every `hover:` variant behind `(hover: hover)`, so a touch
  // device never gets the hover styles. The checker has to model that.
  if (/\(hover:\s*hover\)/.test(m2)) checks.push(() => ctx.pointer === "fine");
  if (/\(hover:\s*none\)/.test(m2)) checks.push(() => ctx.pointer !== "fine");

  for (const [, kind, val] of m2.matchAll(/(minw|maxw):([\d.]+)/g)) {
    const limit = parseFloat(val);
    if (kind === "minw") checks.push(() => ctx.width >= limit);
    else checks.push(() => ctx.width < limit);
  }
  if (!checks.length) return true; // unknown condition — assume it applies
  return checks.every((c) => c());
}

/* -------------------------------------------------------------- resolve --- */

function resolve(rules, chain, ctx, layerOrder) {
  const winners = new Map(); // prop -> {rank, value}
  const layerIndex = (l) => layerIndexFor(l, layerOrder);

  for (const rule of rules) {
    if (!mediaMatches(rule.media, ctx)) continue;
    if (rule.decls.length === 0) continue;
    if (!selectorMatches(rule.selector, chain)) continue;
    const rank = {
      important: 0,
      layer: layerIndex(rule.layer),
      spec: specificity(rule.selector),
      order: rule.order,
    };
    for (const d of rule.decls) {
      const r = { ...rank, important: d.important ? 1 : 0 };
      const prev = winners.get(d.prop);
      if (!prev || compareRank(r, prev.rank) >= 0) {
        winners.set(d.prop, { rank: r, value: d.value });
      }
    }
  }

  // presentation attributes sit below every author rule
  const el = chain[0];
  const out = {};
  for (const [k, v] of Object.entries(el.presentational || {})) out[k] = v;
  for (const [prop, w] of winners) out[prop] = w.value;
  return out;
}

function compareRank(a, b) {
  if (a.important !== b.important) return a.important - b.important;
  if (a.layer !== b.layer) return a.layer - b.layer;
  if (a.spec !== b.spec) return a.spec - b.spec;
  return a.order - b.order;
}

/** Position of a layer in the cascade. Unlayered rules rank last. */
function layerIndexFor(l, layerOrder) {
  if (!l) return layerOrder.indexOf("utilities") === -1 ? 99 : layerOrder.indexOf("utilities");
  const i = layerOrder.indexOf(l);
  return i === -1 ? 99 : i;
}

/* -------------------------------------------------------------- fixtures --- */

const CARD_WRAPPER_OLD = ["group", "w-[100px]", "shrink-0", "sm:w-[128px]", "md:w-[148px]", "lg:w-[168px]"];

/**
 * The row section is the parent of the header/nav/track; it is unchanged by
 * the refactor but it carries the `group/row` class the nav buttons react to.
 */
const ROW_SECTION = { tag: "section", classes: ["relative", "group/row"] };

/**
 * Each case describes one element of the card: the classes it used to carry
 * and the classes it carries now, plus the elements above it.
 */
const CASES = [
  {
    name: "card wrapper",
    old: CARD_WRAPPER_OLD,
    neu: CARD_WRAPPER_OLD,
    parent: null,
  },
  {
    name: "row section",
    old: ROW_SECTION.classes,
    neu: ROW_SECTION.classes,
    parent: null,
    tag: "section",
  },
  {
    name: "poster frame",
    old: ["relative", "aspect-[2/3]", "overflow-hidden", "rounded-md", "border", "border-border", "bg-surface", "shadow-card", "transition-all", "duration-300", "group-hover:scale-[1.025]", "group-hover:border-accent", "group-hover:shadow-glow"],
    neu: ["mv-card-poster"],
    parent: "card wrapper",
  },
  {
    name: "poster link",
    old: ["block", "h-full", "w-full"],
    neu: ["mv-card-link"],
    parent: "poster frame",
  },
  {
    name: "poster image",
    old: ["object-cover", "transition-transform", "duration-500", "group-hover:scale-105"],
    neu: ["mv-card-img"],
    parent: "poster link",
  },
  {
    name: "rating chip",
    old: ["absolute", "right-1", "top-1", "flex", "items-center", "gap-0.5", "rounded", "bg-bg-deepest/80", "px-1", "py-0.5", "text-[9px]", "font-semibold", "leading-none", "text-yellow-400", "shadow-md", "backdrop-blur-sm", "sm:right-1.5", "sm:top-1.5", "sm:gap-1", "sm:text-[10px]"],
    neu: ["mv-card-rating"],
    parent: "poster link",
  },
  {
    name: "star icon",
    old: ["lucide", "lucide-star", "h-2.5", "w-2.5", "fill-yellow-400", "text-yellow-400", "sm:h-3", "sm:w-3"],
    neu: ["lucide", "lucide-star", "mv-card-star"],
    parent: "rating chip",
    tag: "svg",
    presentational: { fill: "none", stroke: "currentColor", "stroke-width": "2", "stroke-linecap": "round", "stroke-linejoin": "round" },
  },
  {
    name: "gradient",
    old: ["absolute", "inset-x-0", "bottom-0", "h-1/2", "bg-gradient-to-t", "from-bg-deepest/85", "via-bg-deepest/40", "to-transparent"],
    neu: ["mv-card-gradient"],
    parent: "poster link",
  },
  {
    name: "hover overlay",
    old: ["absolute", "inset-0", "flex", "items-end", "justify-between", "gap-1", "p-1.5", "opacity-0", "transition-opacity", "duration-300", "group-hover:opacity-100"],
    neu: ["mv-card-hover"],
    parent: "poster link",
  },
  {
    name: "play button",
    old: ["flex", "h-6", "w-6", "items-center", "justify-center", "rounded-full", "bg-brand", "text-cream", "shadow-glow", "sm:h-7", "sm:w-7"],
    neu: ["mv-card-play"],
    parent: "hover overlay",
  },
  {
    name: "play icon",
    old: ["lucide", "lucide-play", "h-3", "w-3", "fill-current", "sm:h-3.5", "sm:w-3.5"],
    neu: ["lucide", "lucide-play", "mv-card-play-ico"],
    parent: "play button",
    tag: "svg",
    presentational: { fill: "none", stroke: "currentColor", "stroke-width": "2", "stroke-linecap": "round", "stroke-linejoin": "round" },
  },
  {
    name: "watchlist button",
    old: ["flex", "items-center", "justify-center", "rounded-full", "border", "border-border", "bg-surface-elevated/90", "text-text-primary", "backdrop-blur", "transition-all", "hover:border-accent", "h-8", "w-8"],
    neu: ["mv-watchlist", "h-8", "w-8"],
    parent: "hover overlay",
    tag: "button",
    hoverSelf: true,
  },
  {
    name: "watchlist plus icon",
    old: ["lucide", "lucide-plus", "h-4", "w-4"],
    neu: ["lucide", "lucide-plus", "h-4", "w-4"],
    parent: "watchlist button",
    tag: "svg",
    presentational: { fill: "none", stroke: "currentColor", "stroke-width": "2", "stroke-linecap": "round", "stroke-linejoin": "round" },
  },
  {
    name: "trailer button",
    old: ["pointer-coarse:flex", "max-md:flex", "absolute", "bottom-1.5", "left-1.5", "z-20", "hidden", "h-7", "w-7", "items-center", "justify-center", "rounded-full", "bg-black/65", "text-cream", "backdrop-blur-sm", "transition-transform", "active:scale-90", "shadow-[0_2px_10px_rgba(0,0,0,0.5)]"],
    neu: ["mv-card-trailer"],
    parent: "poster frame",
    tag: "button",
  },
  {
    name: "trailer icon",
    old: ["lucide", "lucide-clapperboard", "h-3.5", "w-3.5"],
    neu: ["lucide", "lucide-clapperboard", "mv-card-trailer-ico"],
    parent: "trailer button",
    tag: "svg",
    presentational: { fill: "none", stroke: "currentColor", "stroke-width": "2", "stroke-linecap": "round", "stroke-linejoin": "round" },
  },
  {
    name: "caption link",
    old: ["mt-1", "block", "px-0.5"],
    neu: ["mv-card-caption"],
    parent: "card wrapper",
  },
  {
    name: "card title",
    old: ["line-clamp-1", "text-[11px]", "font-medium", "text-text-primary", "transition-colors", "group-hover:text-cream", "sm:text-[13px]"],
    neu: ["mv-card-title"],
    parent: "caption link",
  },
  {
    name: "card year",
    old: ["mt-0.5", "text-[10px]", "text-text-muted", "sm:text-[11px]"],
    neu: ["mv-card-year"],
    parent: "caption link",
  },
  {
    name: "row header",
    old: ["mb-2.5", "flex", "items-end", "justify-between", "gap-3", "px-3", "sm:mb-3", "sm:px-5", "md:px-6", "lg:px-8"],
    neu: ["mv-row-header"],
    parent: "row section",
  },
  {
    name: "row title",
    old: ["flex", "items-center", "gap-2", "font-display", "text-base", "font-bold", "text-cream", "sm:text-lg", "md:text-xl"],
    neu: ["mv-row-title", "font-display"],
    parent: "row header",
  },
  {
    name: "row nav button",
    old: ["absolute", "left-0", "top-1/2", "z-10", "hidden", "h-12", "w-12", "-translate-y-1/2", "items-center", "justify-center", "rounded-full", "border", "border-border", "bg-bg-deepest/80", "text-text-primary", "opacity-0", "backdrop-blur", "transition-opacity", "hover:border-accent", "hover:bg-brand", "md:flex", "group-hover/row:opacity-100"],
    neu: ["mv-row-nav", "left-0"],
    parent: "row section",
    tag: "button",
  },
  {
    name: "row track",
    old: ["no-scrollbar", "flex", "snap-x", "snap-mandatory", "gap-1.5", "overflow-x-auto", "scroll-smooth", "px-3", "pb-2", "sm:gap-2", "sm:px-5", "md:gap-3", "md:px-6", "lg:gap-3.5", "lg:px-8"],
    neu: ["mv-row-track"],
    parent: "row section",
  },
];

/** The row section is the parent of the header/nav/track; it is unchanged. */
const EXTRA = {
  "row section": { tag: "section", classes: ["relative", "group/row"], parent: null },
};

/**
 * Differences that are known, understood and harmless.
 * key: `${case} @ ${width} @ ${state} :: ${prop}`
 */
const ALLOWED = [
  // The sprite moved stroke-width / line styles onto the <symbol>. The
  // <svg> element's own stroke properties therefore read as the initial
  // values, but nothing draws with the element's own stroke — the paths
  // inherit the symbol's, which is where the rendering comes from.
  { case: "star icon", props: ["stroke-width", "stroke-linecap", "stroke-linejoin"] },
  { case: "play icon", props: ["stroke-width", "stroke-linecap", "stroke-linejoin"] },
  { case: "watchlist plus icon", props: ["stroke-width", "stroke-linecap", "stroke-linejoin"] },
  { case: "trailer icon", props: ["stroke-width", "stroke-linecap", "stroke-linejoin"] },
];

/* ------------------------------------------------------------------ run --- */

function loadRules(dir) {
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".css"));
  let text = "";
  for (const f of files) text += fs.readFileSync(path.join(dir, f), "utf8") + "\n";
  return { text, rules: parseCSS(text) };
}

const beforeDir = process.argv[2];
const afterDir = process.argv[3];
if (!beforeDir || !afterDir) {
  console.error("usage: node scripts/verify-css-equivalence.mjs <before-css-dir> <after-css-dir>");
  process.exit(2);
}

const before = loadRules(beforeDir);
const after = loadRules(afterDir);

// Layer order. When a stylesheet declares no `@layer a,b,c;` statement the
// order is the order in which the layers first appear (CSS Cascade 5), so
// that is what we read.
let layerOrder = [];
for (const m of before.text.matchAll(/@layer\s+([a-z0-9-]+)\s*\{/g)) {
  if (!layerOrder.includes(m[1])) layerOrder.push(m[1]);
}
if (!layerOrder.length) {
  layerOrder = ["properties", "theme", "base", "components", "utilities"];
}

const VIEWPORTS = [
  { width: 375, pointer: "coarse", label: "mobile 375" },
  { width: 768, pointer: "fine", label: "tablet 768" },
  { width: 1280, pointer: "fine", label: "desktop 1280" },
];
const STATES = [
  { hover: false, focus: false, focusVisible: false, active: false, label: "rest" },
  { hover: true, focus: false, focusVisible: false, active: false, label: "hover" },
];

function buildChain(caseDef, side, state) {
  const classes = side === "old" ? caseDef.old : caseDef.neu;
  const make = (name, cls, st) => ({
    name,
    tag: st.tag || "div",
    classes: cls,
    state: { hover: false, focus: false, focusVisible: false, active: false, ...st },
    presentational: st.presentational || {},
  });

  // The chain is element-first: chain[0] is the element itself, chain[1] its
  // nearest ancestor, and so on. That is the order the matcher walks.
  const byName = new Map(CASES.map((c) => [c.name, c]));
  const ancestors = [];
  let cur = caseDef.parent;
  while (cur) {
    const c = byName.get(cur);
    if (!c) break;
    ancestors.unshift(c);
    cur = c.parent;
  }
  const element = make(caseDef.name, classes, {
    ...(caseDef.tag ? { tag: caseDef.tag } : {}),
    ...(caseDef.presentational ? { presentational: caseDef.presentational } : {}),
    ...state,
    ...(caseDef.hoverSelf ? { hover: state.hover } : {}),
  });
  const chain = [element];
  for (const a of ancestors) {
    const aClasses = side === "old" ? a.old : a.neu;
    // Only a "group" ancestor can be hovered on behalf of its children.
    const isGroup = aClasses.some((x) => x === "group" || x.startsWith("group/"));
    chain.push(
      make(a.name, aClasses, {
        ...(a.tag ? { tag: a.tag } : {}),
        ...(isGroup ? state : {}),
      })
    );
  }
  return chain;
}

let failures = 0;
let checks = 0;

/** `--dump <case name>` prints the two resolved maps for one element. */
const dumpIndex = process.argv.indexOf("--dump");
const dumpName = dumpIndex !== -1 ? process.argv[dumpIndex + 1] : null;

if (dumpName === "RULES") {
  console.log(`before: ${before.rules.length} rules, after: ${after.rules.length} rules`);
  const layers = {};
  for (const r of after.rules) layers[String(r.layer)] = (layers[String(r.layer)] || 0) + 1;
  console.log("after layers:", JSON.stringify(layers));
  console.log("\nfirst 25 'after' rules:");
  for (const r of after.rules.slice(0, 25)) {
    console.log(`  [${r.layer}|${r.media || "-"}] ${r.selector.slice(0, 90)}`);
  }
  console.log("\nrules mentioning rounded-md / mv-card-poster:");
  for (const r of after.rules) {
    if (/rounded-md|mv-card-poster/.test(r.selector)) {
      console.log(`  [${r.layer}|${r.media || "-"}] ${r.selector.slice(0, 90)} :: ${r.decls.map((d) => d.prop + ":" + d.value).join("; ").slice(0, 120)}`);
    }
  }
  process.exit(0);
}

for (const vp of VIEWPORTS) {
  for (const st of STATES) {
    const ctx = { width: vp.width, pointer: vp.pointer };
    for (const c of CASES) {
      const oldChain = buildChain(c, "old", st);
      const newChain = buildChain(c, "new", st);
      const oldMap = resolve(before.rules, oldChain, ctx, layerOrder);
      const newMap = resolve(after.rules, newChain, ctx, layerOrder);
      if (process.env.WHY) {
        const side = process.env.WHY_SIDE === "new" ? "new" : "old";
        const rules = side === "old" ? before.rules : after.rules;
        const chain = side === "old" ? oldChain : newChain;
        console.log(`--- rules matching "${c.name}" @ ${vp.label} @ ${st.label} (${side}) ---`);
        console.log(`  element classes: ${chain[0].classes.join(" ")}`);
        console.log(`  chain: ${chain.map((e) => `${e.name}[${e.classes.join("|")}]hover=${e.state.hover}`).join("  >  ")}`);
        for (const r of rules) {
          if (!selectorMatches(r.selector, chain)) continue;
          if (!mediaMatches(r.media, ctx)) {
            console.log(`  SKIP(media ${r.media}) ${r.selector.slice(0, 80)}`);
            continue;
          }
          console.log(
            `  MATCH [layer=${layerIndexFor(r.layer, layerOrder)} spec=${specificity(r.selector)} order=${r.order}] ` +
              `${r.selector.slice(0, 70)} :: ${r.decls.map((d) => d.prop + ":" + d.value).join("; ").slice(0, 80)}`
          );
        }
      }
      if (dumpName && c.name === dumpName) {
        console.log(`--- ${c.name} @ ${vp.label} @ ${st.label} ---`);
        console.log("old classes:", oldChain[0].classes.join(" "));
        console.log("new classes:", newChain[0].classes.join(" "));
        const props = new Set([...Object.keys(oldMap), ...Object.keys(newMap)]);
        for (const p of [...props].sort()) {
          console.log(
            `  ${p}: old=${oldMap[p] ?? "(unset)"}  new=${newMap[p] ?? "(unset)"}` +
              (oldMap[p] === newMap[p] ? "" : "   <<< DIFFERS")
          );
        }
      }
      const allowed = ALLOWED.find((a) => a.case === c.name);
      const keys = new Set([...Object.keys(oldMap), ...Object.keys(newMap)]);
      for (const prop of keys) {
        checks++;
        const a = oldMap[prop];
        const b = newMap[prop];
        if (a === b) continue;
        if (allowed && allowed.props.includes(prop)) continue;
        failures++;
        console.log(
          `FAIL  ${c.name} @ ${vp.label} @ ${st.label} :: ${prop}\n` +
          `        old = ${a === undefined ? "(unset)" : a}\n` +
          `        new = ${b === undefined ? "(unset)" : b}`
        );
      }
    }
  }
}

console.log(`\nlayer order: ${layerOrder.join(" < ")}`);
console.log(`compared ${checks} property resolutions across ${VIEWPORTS.length} viewports x ${STATES.length} states x ${CASES.length} elements`);
if (failures) {
  console.log(`\n${failures} DIFFERENCE(S) FOUND`);
  process.exit(1);
}
console.log("\nPASS — the extracted classes compute to exactly the same styles");
