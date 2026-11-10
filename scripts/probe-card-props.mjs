/**
 * Does the served HTML carry the card's trailer prop?
 *
 * Usage: node scripts/probe-card-props.mjs [url]
 */

const url = process.argv[2] || "http://localhost:3210/";
const res = await fetch(url);
const html = await res.text();

console.log(`${url} -> ${res.status}, ${html.length} bytes`);
console.log(`"trailerUrl" occurrences : ${(html.match(/trailerUrl/g) || []).length}`);
console.log(`macdn trailer urls       : ${(html.match(/macdn\.aoneroom\.com\/media/g) || []).length}`);
console.log(`"posterPath" occurrences : ${(html.match(/posterPath/g) || []).length}`);

// The first card's whole prop object.
const m = html.match(/\{\\"id\\":\\"[a-z0-9\-]+\\",\\"type\\":\\"(movie|tv)\\"[\s\S]{0,900}?\}/);
if (m) console.log("\nfirst card props:\n" + m[0].slice(0, 900));
else {
  const m2 = html.match(/\{"id":"[a-z0-9\-]+","type":"(movie|tv)"[\s\S]{0,900}?\}/);
  console.log("\nfirst card props:\n" + (m2 ? m2[0].slice(0, 900) : "(not found)"));
}
