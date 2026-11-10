/**
 * Strip UTF-8 BOMs from source files.
 *
 * PowerShell's `Set-Content -Encoding UTF8` (Windows PowerShell 5.1) writes a
 * BOM, and a BOM at the start of a source file is a silent trap: it parses
 * in most bundlers but breaks anything that reads the file as raw text
 * (linters, some loaders, satori, and any future copy-into-a-plugin step).
 *
 * Usage: node scripts/strip-boms.mjs [--check]
 */

import { readdir, readFile, writeFile } from "node:fs/promises";
import { extname, join, relative } from "node:path";

const ROOT = process.cwd();
const SKIP_DIRS = new Set([
  "node_modules",
  ".next",
  ".git",
  ".vercel",
  "out",
  "public",
  "assets",
]);

const EXTS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".css",
  ".json",
  ".md",
  ".txt",
  ".py",
]);

const checkOnly = process.argv.includes("--check");

async function walk(dir) {
  const out = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    if (e.name.startsWith(".") && e.name !== ".env.example") continue;
    const full = join(dir, e.name);
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name)) continue;
      out.push(...(await walk(full)));
    } else if (EXTS.has(extname(e.name))) {
      out.push(full);
    }
  }
  return out;
}

const files = await walk(ROOT);
let fixed = 0;
let checked = 0;

for (const file of files) {
  const buf = await readFile(file);
  checked += 1;
  if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
    const rel = relative(ROOT, file);
    if (checkOnly) {
      console.log(`BOM  ${rel}`);
    } else {
      await writeFile(file, buf.subarray(3));
      console.log(`fixed ${rel}`);
    }
    fixed += 1;
  }
}

console.log(
  `${checkOnly ? "checked" : "fixed"} ${fixed} BOM(s) across ${checked} files`
);
