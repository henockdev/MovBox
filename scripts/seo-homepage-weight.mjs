// What makes the homepage 1.5 MB?
// Usage: node scripts/seo-homepage-weight.mjs [baseUrl]

const BASE = (process.argv[2] || "https://movbox.xyz").replace(/\/+$/, "");
const html = await (await fetch(`${BASE}/`, { headers: { "User-Agent": "Mozilla/5.0" } })).text();
const count = (re) => (html.match(re) || []).length;

console.log("total bytes       ", html.length);
console.log("img tags          ", count(/<img/g));
console.log("movie links       ", count(/href="\/movie\//g));
console.log("tv links          ", count(/href="\/tv\//g));
console.log("category links    ", count(/href="\/category\//g));
console.log("script tags       ", count(/<script/g));
console.log("rsc push calls    ", count(/self\.__next_f\.push/g));
console.log("poster urls       ", count(/pbcdnw\.aoneroom\.com/g));
console.log("blurHash strings  ", count(/blurHash/g));
console.log("json script bytes ", count(/self\.__next_f\.push/));

const first = html.indexOf("self.__next_f.push");
if (first > 0) {
  console.log("bytes before the RSC payload:", first);
  console.log("bytes of the RSC payload    :", html.length - first);
}
