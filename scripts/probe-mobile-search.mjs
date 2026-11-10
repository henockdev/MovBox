/**
 * Probe 3: can the signed mobile BFF serve the app's own search?
 *
 * The app's search transport is `POST /wefeed-mobile-bff/subject-api/search/v2`
 * on the gateway-signed origin. That endpoint is the only one known to carry
 * the app's real filter block (yearMin / yearMax / genres / country /
 * language). The web BFF's `/subject/search` ignores every filter key
 * (measured — see probe-search-filters.mjs).
 *
 * So: if the gateway signature works for a POST from here, the website can
 * have the app's real filters. If it does not, the filter panel has to be
 * built over the web BFF's result set instead.
 *
 * Usage: node scripts/probe-mobile-search.mjs
 */

import { readFileSync } from "node:fs";
import { createHash, createHmac, randomBytes } from "node:crypto";

const REPO = new URL("..", import.meta.url).pathname.replace(/^\//, "").replace(/\/$/, "");
const ENV_PATH = `${REPO}/.env.local`;

function readEnv() {
  const out = {};
  try {
    const raw = readFileSync(ENV_PATH, "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      let v = m[2].trim();
      if (
        (v.startsWith('"') && v.endsWith('"')) ||
        (v.startsWith("'") && v.endsWith("'"))
      ) {
        v = v.slice(1, -1);
      }
      out[m[1]] = v;
    }
  } catch (e) {
    console.log("no .env.local:", e.message);
  }
  return out;
}

const env = readEnv();
const secretB64 = env.ONSTREAM_GATEWAY_SECRET_B64;
console.log("secret present:", !!secretB64);
if (!secretB64) process.exit(1);

const secretBytes = Buffer.from(secretB64, "base64");
const certSha256 =
  env.ONSTREAM_CLIENT_BUILD_CERT_SHA256 ||
  "03d4b741632d136bc23e2de4c6adcdb7712f1980b619c183221801730bbd0410";
const salt = env.ONSTREAM_CLIENT_BUILD_SALT || "oneroom";

const BASE = "https://api6.aoneroom.com";
const BFF = "/wefeed-mobile-bff";
const UA = "okhttp/4.12.0";

const md5Hex = (b) => createHash("md5").update(b).digest("hex");
const uuid = () => {
  const b = randomBytes(16);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = b.toString("hex");
  return [h.slice(0, 8), h.slice(8, 12), h.slice(12, 16), h.slice(16, 20), h.slice(20)].join("-");
};

const identity = {
  deviceId: uuid(),
  advertisingId: uuid(),
  osVersion: "14",
  model: "Android",
  language: "en",
  region: "US",
  networkType: "NETWORK_WIFI",
  timeZone: "UTC",
};

const buildNonce = () =>
  `${Date.now() * 1000 + Math.floor(Math.random() * 1000)}${Math.floor(Math.random() * 1000)}`;

function clientBuild(nonce) {
  return `${nonce}.${md5Hex(Buffer.from(certSha256 + salt + nonce, "utf8"))}-`;
}

function clientToken(ts) {
  return `${ts},${md5Hex(Buffer.from(String(ts).split("").reverse().join(""), "utf8"))}`;
}

function clientInformation(build) {
  return JSON.stringify({
    package_name: "com.community.oneroom",
    version_name: "4.0.02.0831.02",
    version_code: 90020126,
    "X-Client-Build": build,
    os: "android",
    os_version: identity.osVersion,
    install_ch: "ps",
    device_id: identity.deviceId,
    install_store: "ps",
    gaid: identity.advertisingId,
    brand: "",
    model: identity.model,
    system_language: identity.language,
    net: identity.networkType,
    region: identity.region,
    timezone: identity.timeZone,
    sp_code: "",
    "X-Child-UID": "",
    "X-Content-Mode": "0",
    "X-Family-Mode": "1",
    "X-Idle-Data": "0",
    "X-PM-Active": "true",
    "X-PM-Level": "2",
    "X-Play-Mode": "2",
  });
}

function canonicalQuery(rawQuery) {
  if (!rawQuery) return "";
  const m = new Map();
  for (const comp of rawQuery.split("&")) {
    const i = comp.indexOf("=");
    if (i < 0) continue;
    const name = decodeURIComponent(comp.slice(0, i).replace(/\+/g, " "));
    const value = decodeURIComponent(comp.slice(i + 1).replace(/\+/g, " "));
    if (!name) continue;
    m.set(name, value);
  }
  return [...m.entries()]
    .sort(([a], [b]) => (a === b ? 0 : a < b ? -1 : 1))
    .map(([n, v]) => `${n}=${v}`)
    .join("&");
}

function sign(method, path, rawQuery, accept, ts) {
  const cq = canonicalQuery(rawQuery);
  const signedPath = cq ? `${path}?${cq}` : path;
  const canonical = [method, accept, "", "", String(ts), "", signedPath].join("\n");
  return createHmac("md5", secretBytes).update(Buffer.from(canonical, "utf8")).digest("base64");
}

async function signedRequest(method, path, params, body, token) {
  const fullPath = `${BFF}${path}`;
  const rawQuery = params.map(([n, v]) => `${encodeURIComponent(n)}=${encodeURIComponent(v)}`).join("&");
  const url = `${BASE}${fullPath}${rawQuery ? `?${rawQuery}` : ""}`;
  const ts = Date.now();
  const build = clientBuild(buildNonce());
  const accept = "application/json";
  const headers = {
    "User-Agent": UA,
    Accept: accept,
    "X-Client-Info": clientInformation(build),
    "X-Client-Build": build,
    "X-Client-Status": "0",
    "X-Play-Mode": "2",
    "X-Family-Mode": "0",
    "X-Idle-Data": "1",
    "x-tr-signature": `${ts}|2|${sign(method, fullPath, rawQuery, accept, ts)}`,
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  else headers["X-Client-Token"] = clientToken(Date.now());
  if (body) headers["Content-Type"] = "application/json";
  const r = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const t = await r.text();
  return { status: r.status, text: t, xUser: r.headers.get("x-user") };
}

async function main() {
  console.log("\n--- 1. bootstrap session (GET /subject-api/bottom-tab) ---");
  let token = null;
  try {
    const boot = await signedRequest("GET", "/subject-api/bottom-tab", [["host", "moviebox.ph"]], null, null);
    console.log("status:", boot.status, "x-user present:", !!boot.xUser);
    if (boot.xUser) {
      try {
        token = JSON.parse(boot.xUser).token || null;
      } catch {
        token = null;
      }
      console.log("token:", token ? `${token.slice(0, 12)}…` : null);
    }
    if (!token) console.log("body:", boot.text.slice(0, 250));
  } catch (e) {
    console.log("bootstrap ERROR:", e.message);
  }

  console.log("\n--- 2. POST /subject-api/search/v2 ---");
  const searchBody = {
    keyword: "love",
    page: 1,
    perPage: 30,
    subjectType: 0,
    version: "def99f2",
  };
  for (const [label, tok] of [
    ["anonymous", null],
    ["with bearer", token],
  ]) {
    try {
      const res = await signedRequest("POST", "/subject-api/search/v2", [], searchBody, tok);
      console.log(`${label.padEnd(14)} status=${res.status} body=${res.text.slice(0, 260)}`);
    } catch (e) {
      console.log(`${label.padEnd(14)} ERROR ${e.message}`);
    }
  }

  console.log("\n--- 3. POST /subject-api/search/v2 WITH the app's filter block ---");
  try {
    const filtered = await signedRequest(
      "POST",
      "/subject-api/search/v2",
      [],
      { ...searchBody, filters: { yearMin: 2020 }, genres: ["Action"], country: "United States", language: "English", yearMax: 2026 },
      token
    );
    console.log(`filtered      status=${filtered.status} body=${filtered.text.slice(0, 260)}`);
  } catch (e) {
    console.log("filtered ERROR", e.message);
  }

  console.log("\n--- 4. GET /subject-api/search/suggest ---");
  try {
    const s = await signedRequest("GET", "/subject-api/search/suggest", [["keyword", "dra"]], null, token);
    console.log(`suggest      status=${s.status} body=${s.text.slice(0, 260)}`);
  } catch (e) {
    console.log("suggest ERROR", e.message);
  }
}

main().catch((e) => {
  console.error("FATAL", e);
  process.exit(1);
});
