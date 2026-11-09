// Dump the homepage's own image URLs so the hero banner can be verified.
//
// Usage: node scripts/probe-hero-render.mjs [baseUrl]

const BASE = (process.argv[2] || "http://localhost:3210").replace(/\/+$/, "");

const text = await (await fetch(`${BASE}/`)).text();

const srcs = [...text.matchAll(/src="(https:\/\/[^"]+)"/g)].map((m) => m[1]);
const pbcdn = srcs.filter((u) => u.includes("pbcdn"));
const bannerish = srcs.filter((u) => /\/image\/\d{4}\/\d{2}\//.test(u));

console.log(`total absolute <img src>: ${srcs.length}`);
console.log(`pbcdn images            : ${pbcdn.length}`);
console.log(`banner-shaped images    : ${bannerish.length}`);
console.log("");
console.log("banner-shaped samples:");
for (const u of bannerish.slice(0, 8)) console.log(`  ${u}`);
console.log("");
console.log("other pbcdn samples:");
for (const u of pbcdn.slice(0, 4)) console.log(`  ${u}`);

// The hero component's own markers.
console.log("");
console.log("HeroBanner markers:");
console.log(`  'Featured titles'       : ${text.includes('aria-label="Featured titles"')}`);
console.log(`  dots ('Show ')          : ${text.includes('aria-label="Show ')}`);
console.log(`  strip ('Featured titles' nav): ${text.includes('aria-label="Featured titles"')}`);
console.log(`  'Exclusive Premiere'    : ${text.includes('Exclusive Premiere')}`);
console.log(`  h1 count                : ${(text.match(/<h1[\s>]/g) || []).length}`);
const h1 = text.match(/<h1[^>]*>([\s\S]{0,120}?)<\/h1>/);
console.log(`  h1 text                 : ${h1 ? JSON.stringify(h1[1].replace(/<[^>]+>/g, "").trim()) : "-"}`);
