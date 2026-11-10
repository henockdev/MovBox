/**
 * Probe: do the upstream's suggestions ever carry the title they point at?
 *
 * `POST /subject/search-suggest` answers `{ type, word, subject }`. The first
 * look showed `subject: null` for every word suggestion, which would make a
 * rich suggestion screen impossible. This checks every item of several
 * queries — including ones where the upstream might answer with a real
 * subject instead of a word — and prints exactly what is there.
 *
 * Usage: node scripts/probe-suggest-shape.mjs
 */

const H5 = process.env.H5_API_BASE || "https://h5-api.aoneroom.com/wefeed-h5api-bff";
const UA =
  "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Mobile Safari/537.36";

async function suggest(keyword, perPage = 20) {
  const r = await fetch(`${H5}/subject/search-suggest`, {
    method: "POST",
    headers: {
      Accept: "application/json, text/plain, */*",
      Origin: "https://boxmovies.org",
      Referer: "https://boxmovies.org/",
      "User-Agent": UA,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ keyword, perPage }),
  });
  const j = await r.json();
  return { status: r.status, items: Array.isArray(j?.data?.items) ? j.data.items : [], raw: j };
}

async function main() {
  let withSubject = 0;
  let total = 0;
  const types = new Map();

  for (const keyword of ["dra", "love", "bat", "the", "a", "harry potter"]) {
    const { status, items, raw } = await suggest(keyword);
    console.log(`\n=== "${keyword}" — status ${status}, ${items.length} items ===`);
    if (!items.length) {
      console.log("  raw:", JSON.stringify(raw).slice(0, 400));
      continue;
    }
    for (const it of items) {
      total++;
      types.set(it.type, (types.get(it.type) ?? 0) + 1);
      const hasSubject = it.subject && typeof it.subject === "object";
      if (hasSubject) {
        withSubject++;
        console.log(
          `  type=${it.type} word="${it.word}" subject keys: ${Object.keys(it.subject).join(", ")}`
        );
        console.log("    ", JSON.stringify(it.subject).slice(0, 700));
      } else {
        console.log(`  type=${it.type} word="${it.word}" subject=${it.subject}`);
      }
    }
  }

  console.log(`\n--- summary: ${withSubject}/${total} items carry a subject`);
  console.log("--- item type histogram:", JSON.stringify([...types.entries()]));

  // Does a bigger perPage bring real subjects?
  const big = await suggest("love", 50);
  const rich = big.items.filter((i) => i.subject && typeof i.subject === "object");
  console.log(
    `--- perPage=50 on "love": ${big.items.length} items, ${rich.length} with a subject`
  );
  if (rich.length) console.log(JSON.stringify(rich[0]).slice(0, 900));
}

main().catch((e) => {
  console.error("FATAL", e);
  process.exit(1);
});
