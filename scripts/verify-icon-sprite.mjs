// Every `<use href="#i-x">` in the document must have a matching
// `<symbol id="i-x">`, or the icon silently renders as nothing.
const base = process.argv[2] || "http://localhost:3210/";
const res = await fetch(base, { headers: { "User-Agent": "Mozilla/5.0 Chrome/140.0" } });
const html = await res.text();

const symbols = new Set([...html.matchAll(/<symbol[^>]*id="([^"]+)"/g)].map((m) => m[1]));
const uses = [...html.matchAll(/<use[^>]*href="#([^"]+)"/g)].map((m) => m[1]);

const missing = uses.filter((u) => !symbols.has(u));
const counts = {};
for (const u of uses) counts[u] = (counts[u] || 0) + 1;

console.log(`symbols defined : ${symbols.size}  [${[...symbols].join(", ")}]`);
console.log(`use references  : ${uses.length}`);
console.log("per icon        : " + Object.entries(counts).map(([k, v]) => `${k}=${v}`).join(", "));
console.log(`unresolved refs : ${missing.length}${missing.length ? "  -> " + [...new Set(missing)].join(", ") : ""}`);

// The old inline path-data cost, for comparison.
const paths = (html.match(/<path\b/g) || []).length;
const svgBytes = [...html.matchAll(/<svg\b[\s\S]*?<\/svg>/g)].reduce((a, m) => a + Buffer.byteLength(m[0]), 0);
console.log(`\nremaining <path> elements in the page: ${paths}`);
console.log(`total inline <svg> bytes: ${svgBytes.toLocaleString()}`);

// Set the code rather than calling process.exit(): on Windows, exiting while
// the HTTP agent still holds its socket trips a libuv assertion.
process.exitCode = missing.length ? 1 : 0;
