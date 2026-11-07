// Measure candidate meta descriptions before they go into the code.
// Usage: node scripts/measure-desc.mjs
//
// The band that matters: 120-160 characters.
//   - below ~120 and Google rewrites it anyway (the complaint that started
//     this work was 36-character descriptions);
//   - above ~160 and Google truncates mid-word with its own ellipsis.

const CANDIDATES = {
  "/movies":
    "Browse thousands of free movies online in HD. Filter by genre, country, year and language — action, romance, horror, K-drama and Nollywood. New titles daily.",
  "/tv":
    "Stream full episodes of your favourite TV series free in HD. Filter by genre, country, year and language — K-dramas, C-dramas, anime, sitcoms and thrillers.",
  "/animations":
    "Stream anime, cartoons and animated movies and series free on Movbox. Dubbed and subtitled in English, from big blockbusters and classics to the newest series.",
  "/trending":
    "See what is trending on Movbox right now — the most-watched movies, the hottest new series and the latest releases. Updated every day, free in HD.",
  "/most-watched":
    "The most-watched movies and TV shows on Movbox, counted from real viewing across the catalogue. See what everybody is watching and stream it free in HD.",
  "/genres":
    "Find your next watch by genre. Browse action, adventure, animation, comedy, crime, drama, horror, romance, sci-fi and thriller movies and series, free in HD.",
  "/blog":
    "News, guides and editor's picks from the Movbox team: what to watch this week, how to find the best 4K content and the best K-dramas of 2026.",
  "/movbox-app":
    "The Movbox Android app is in development — the whole catalogue in your pocket, with the same free streaming, rankings and search you get on the web.",
  "/about":
    "Movbox is a free streaming index: we find the movies and TV shows worth your evening, rank them by what people are watching, and make them playable anywhere.",
  "/contact":
    "Get in touch with the Movbox team: report a broken stream, flag a wrong title or a copyright concern, or ask about the Android app. We read every message.",
  "/privacy":
    "The Movbox privacy policy in plain English: what the site collects, what stays in your browser, what a free account stores and how to have your data deleted.",
  "/terms":
    "The Movbox terms of use: what the service is, who owns the content, what is allowed, how copyright complaints are handled and the limits of what we promise.",
  "/category/kids":
    "Stream kids movies, animated series, cartoons and family films free on Movbox. CoComelon, Doraemon, folktales and anime for younger viewers, updated daily.",
  "/category/western":
    "Stream classic and modern Westerns free on Movbox — Dances with Wolves, Cast a Long Shadow, Wild Boys and more. Full-length feature films and series.",
  "/rankings index":
    "Every Movbox ranking in one place: top K-Drama, Anime, Action, Horror, Romance, Nollywood and more. Ranked by what people are watching and updated daily.",
};

// The ranking group pages are generated — check the worst case.
const GROUP_LABELS = [
  "Popular Series",
  "Popular Movie",
  "Adult Animation",
  "Epic Fantasy",
  "Comedy",
  "Teen Romance",
  "Superhero Series",
  "BL Story",
  "Bet+",
  "Action & Thriller",
  "Gangster",
  "Teen Fantasy",
  "K-Drama",
  "Nollywood",
  "C-Drama",
  "Anime (English Dubbed)",
  "Action Movies",
  "Horror Movies",
  "Anime",
  "Romantic Movie",
  "Action Movie",
  "Hot Short TV",
  "Trending Short Drama",
  "Must-watch Black Shows",
  "Romance",
];

let bad = 0;
console.log("--- static descriptions ---");
for (const [k, v] of Object.entries(CANDIDATES)) {
  const len = v.length;
  const ok = len >= 120 && len <= 160;
  if (!ok) bad += 1;
  console.log(`${ok ? "OK  " : "FIX "} ${String(len).padStart(4)}  ${k}`);
}

console.log("\n--- generated ranking group pages ---");
for (const label of GROUP_LABELS) {
  const title = `${label} Rankings — Top 20 on Movbox`;
  const desc = `The top 20 ${label.toLowerCase()} titles on Movbox, ranked by what people are watching and updated daily. Watch every one free in HD on any screen.`;
  const titleLen = title.length + " | Movbox".length;
  const ok = titleLen <= 65 && desc.length >= 120 && desc.length <= 160;
  if (!ok) bad += 1;
  console.log(
    `${ok ? "OK  " : "FIX "} t=${String(titleLen).padStart(3)} d=${String(desc.length).padStart(4)}  ${label}`
  );
}

console.log(`\n${bad} outside the band`);
