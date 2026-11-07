// What is actually inside the homepage's 1.46 MB RSC payload?
// Usage: node scripts/seo-rsc-weight.mjs [baseUrl]

const BASE = (process.argv[2] || "https://movbox.xyz").replace(/\/+$/, "");
const html = await (await fetch(`${BASE}/`, { headers: { "User-Agent": "Mozilla/5.0" } })).text();
const first = html.indexOf("self.__next_f.push");
const payload = html.slice(first);
console.log("payload bytes:", payload.length);

// Every string literal the flight data carries.
const strings = [...payload.matchAll(/"((?:[^"\\]|\\.){20,})"/g)].map((m) => m[1]);
console.log("strings >= 20 chars:", strings.length);
console.log("total chars in them:", strings.reduce((n, s) => n + s.length, 0));

// Group them by shape so the big contributors are visible.
const buckets = new Map();
for (const s of strings) {
  let key = "other";
  if (s.startsWith("http")) key = "url";
  else if (s.includes("pbcdn")) key = "cdn-url";
  else if (/^[A-Za-z]/.test(s) && s.includes(" ")) key = "prose";
  else key = "token";
  const b = buckets.get(key) || { count: 0, chars: 0 };
  b.count += 1;
  b.chars += s.length;
  buckets.set(key, b);
}
console.log("\nbucket        count      chars");
for (const [k, v] of [...buckets].sort((a, b) => b[1].chars - a[1].chars)) {
  console.log(k.padEnd(14), String(v.count).padEnd(8), v.chars);
}

// The longest strings — who owns them?
const longest = [...strings].sort((a, b) => b.length - a.length).slice(0, 8);
console.log("\nlongest strings:");
for (const s of longest) {
  console.log(`  [${String(s.length).padStart(5)}] ${s.slice(0, 110).replace(/\s+/g, " ")}`);
}

// How much do the repeated poster URLs alone cost?
const urlChars = strings.filter((s) => s.startsWith("http")).reduce((n, s) => n + s.length, 0);
console.log("\nurl chars:", urlChars);
