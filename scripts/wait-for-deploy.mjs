// Poll the live site until the deploy lands.
//
// The signals we wait for:
//   - /rankings returns 200          (the new route)
//   - /about returns 200             (the new route)
//   - Cache-Control is no longer no-store on /   (the actual fix)
//
// Usage: node scripts/wait-for-deploy.mjs [baseUrl] [maxMinutes]

const BASE = (process.argv[2] || "https://movbox.xyz").replace(/\/+$/, "");
const MAX_MINUTES = Number(process.argv[3] || 12);
const deadline = Date.now() + MAX_MINUTES * 60 * 1000;

async function probe(path) {
  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: { "User-Agent": "Mozilla/5.0 (deploy poll)" },
      redirect: "manual",
    });
    await res.arrayBuffer();
    return { status: res.status, cc: res.headers.get("cache-control") || "" };
  } catch (e) {
    return { status: `ERR ${e.message}`, cc: "" };
  }
}

let attempt = 0;
while (Date.now() < deadline) {
  attempt += 1;
  const [home, rankings, about] = await Promise.all([
    probe("/"),
    probe("/rankings"),
    probe("/about"),
  ]);

  const cacheOk = !/no-store/.test(home.cc) && home.status === 200;
  const routesOk = rankings.status === 200 && about.status === 200;
  const done = cacheOk && routesOk;

  console.log(
    `[${new Date().toISOString().slice(11, 19)}] try ${String(attempt).padStart(2)}  ` +
      `/=${home.status} cc='${home.cc}'  /rankings=${rankings.status}  /about=${about.status}` +
      (done ? "   <-- DEPLOYED" : "")
  );

  if (done) {
    console.log("\nDEPLOY IS LIVE.");
    process.exit(0);
  }
  await new Promise((r) => setTimeout(r, 30000));
}

console.log(`\nTimed out after ${MAX_MINUTES} minutes. The deploy has not landed yet.`);
process.exit(1);
