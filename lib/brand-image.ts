import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The brand mark as a data URI.
 *
 * The social cards (`app/opengraph-image.tsx`, `app/twitter-image.tsx`) are
 * rendered by satori, which cannot load a file from disk on its own — it
 * needs an `<img src>` it can fetch. Inlining the real mark as a data URI
 * means the cards show the actual brand logo instead of a hand-drawn
 * approximation of it.
 *
 * The file is read once per process and kept in memory.
 */

let cached: string | null = null;

export function brandMarkDataUri(): string {
  if (cached) return cached;
  const file = join(process.cwd(), "public", "movbox_logo_nav.png");
  const buf = readFileSync(file);
  cached = `data:image/png;base64,${buf.toString("base64")}`;
  return cached;
}

/** The mark's natural proportions (the PNG is 256×229). */
export const BRAND_MARK_RATIO = 256 / 229;
