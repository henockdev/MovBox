/**
 * Check the live site for the markers of the new build.
 *
 * Usage: node scripts/check-live-build.mjs [baseUrl]
 */

const BASE = (process.argv[2] || "https://movbox.xyz").replace(/\/+$/, "");

const CHECKS = [
  {
    name: "Ahrefs <script> in the head",
    path: "/movies",
    test: (html) =>
      /<script[^>]*src="https:\/\/analytics\.ahrefs\.com\/analytics\.js"[^>]*>/.test(
        html.slice(0, html.indexOf("</head>"))
      ),
  },
  {
    name: "Header search is a trigger",
    path: "/",
    test: (html) =>
      html.includes('aria-label="Search Movbox"') &&
      html.includes('aria-haspopup="dialog"'),
  },
  {
    name: "Watch page has one <h1>",
    path: "/watch/movie/night-shift-OrzxiVFi4A4",
    test: (html) => !html.includes(">LOADING</h1>"),
  },
  {
    name: "/genres/28 is a real page",
    path: "/genres/28",
    test: (html) =>
      html.includes("Action Movies &amp; TV Shows") &&
      html.includes('property="og:image"'),
  },
  {
    name: "Search overlay markup",
    path: "/search",
    test: (html) =>
      html.includes("Everyone is searching") || html.includes("Top rankings"),
  },
];

for (const c of CHECKS) {
  try {
    const res = await fetch(`${BASE}${c.path}`, {
      headers: { "Cache-Control": "no-cache" },
    });
    const html = await res.text();
    console.log(
      `${c.test(html) ? "OK  " : "--  "} ${c.name}  (${c.path} -> ${res.status}, ${html.length} bytes)`
    );
  } catch (e) {
    console.log(`ERR  ${c.name}  ${e.message}`);
  }
}
