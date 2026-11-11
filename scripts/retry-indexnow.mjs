/**
 * Retry the IndexNow submission until Bing completes site verification.
 *
 * A freshly uploaded key file needs a moment: Bing fetches
 * `keyLocation`, confirms the key matches, and only then accepts
 * submissions. Until that happens the endpoint answers 403 with
 * "SiteVerificationNotCompleted". That is not a bad key — it is the
 * verification still in flight.
 *
 * Usage: node scripts/retry-indexnow.mjs [baseUrl] [maxMinutes]
 */

const BASE = (process.argv[2] || "https://movbox.xyz").replace(/\/+$/, "");
const MAX_MINUTES = Number(process.argv[3] || 60);

const { spawn } = await import("node:child_process");

const deadline = Date.now() + MAX_MINUTES * 60_000;
let attempt = 0;

while (Date.now() < deadline) {
  attempt++;
  console.log(`\n===== attempt ${attempt} at ${new Date().toISOString()} =====`);

  const code = await new Promise((resolve) => {
    const child = spawn(
      process.execPath,
      ["scripts/submit-indexnow.mjs", BASE, ...process.argv.slice(4)],
      { stdio: "inherit" }
    );
    child.on("exit", (c) => resolve(c ?? 1));
  });

  if (code === 0) {
    console.log("\nSUBMITTED SUCCESSFULLY.");
    process.exit(0);
  }

  const wait = Math.min(5 * 60_000, 60_000 * attempt);
  console.log(`\nnot accepted yet — retrying in ${wait / 1000}s`);
  await new Promise((r) => setTimeout(r, wait));
}

console.log(`\nTIMED OUT after ${MAX_MINUTES} minutes.`);
process.exit(1);
