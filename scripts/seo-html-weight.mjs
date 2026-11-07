// What is actually inside the homepage's rendered HTML?
// Usage: node scripts/seo-html-weight.mjs [baseUrl]

const BASE = (process.argv[2] || "https://movbox.xyz").replace(/\/+$/, "");
const html = await (
  await fetch(`${BASE}/`, { headers: { "User-Agent": "Mozilla/5.0" } })
).text();

const rscAt = html.indexOf("self.__next_f.push");
const shell = rscAt > 0 ? html.slice(0, rscAt) : html;

console.log("total bytes        ", html.length);
console.log("shell bytes        ", shell.length);
console.log("rsc bytes          ", html.length - shell.length);

// How many of each element?
const count = (re) => (html.match(re) || []).length;
console.log("\n-- element counts --");
console.log("  <img            ", count(/<img/g));
console.log("  <svg            ", count(/<svg/g));
console.log("  <a              ", count(/<a /g));
console.log("  <div            ", count(/<div/g));
console.log("  <span           ", count(/<span/g));
console.log("  <p              ", count(/<p/g));
console.log("  <li             ", count(/<li/g));
console.log("  <script         ", count(/<script/g));

// Byte cost per tag type.
console.log("\n-- byte cost by tag --");
for (const [name, re] of [
  ["img", /<img[\s\S]*?>/g],
  ["svg", /<svg[\s\S]*?<\/svg>/g],
  ["a", /<a\s[\s\S]*?<\/a>/g],
  ["li", /<li[\s\S]*?<\/li>/g],
]) {
  const ms = [...html.matchAll(re)];
  const bytes = ms.reduce((n, m) => n + m[0].length, 0);
  console.log(
    `  ${name.padEnd(5)} count=${String(ms.length).padStart(5)}  bytes=${String(bytes).padStart(8)}  avg=${ms.length ? Math.round(bytes / ms.length) : 0}`
  );
}

// The largest single chunks of the document.
console.log("\n-- longest single lines in the shell --");
const lines = shell.split("\n").sort((a, b) => b.length - a.length);
for (const l of lines.slice(0, 5)) {
  console.log(`  ${l.length} chars : ${l.slice(0, 110)}…`);
}

// How much of the shell is the <head>?
const headEnd = shell.indexOf("</head>");
console.log("\n  head bytes       ", headEnd > 0 ? headEnd : "n/a");
console.log("  body bytes       ", shell.length - (headEnd > 0 ? headEnd : 0));
