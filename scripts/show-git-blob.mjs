/**
 * Write a git blob to a file, so an image that has been replaced in the
 * working tree can still be looked at.
 *
 * Usage: node scripts/show-git-blob.mjs <git-path> <out-file>
 */

import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const [, , gitPath, outFile] = process.argv;
if (!gitPath || !outFile) {
  console.error("usage: node scripts/show-git-blob.mjs <git-path> <out-file>");
  process.exit(1);
}

const repo = resolve(dirname(new URL(import.meta.url).pathname.replace(/^\//, "")), "..");
const buf = execFileSync("git", ["show", `HEAD:${gitPath}`], {
  cwd: repo,
  maxBuffer: 64 * 1024 * 1024,
});
writeFileSync(outFile, buf);
console.log(`${gitPath} -> ${outFile} (${buf.length} bytes)`);
