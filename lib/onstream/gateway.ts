/**
 * OnStream (aoneroom) mobile gateway — signing primitives.
 *
 * SERVER ONLY. This module imports `node:crypto`, so it must never be
 * reachable from a client component. It is imported by `lib/onstream/client.ts`
 * and by nothing else.
 *
 * ---------------------------------------------------------------------------
 * Where this contract comes from
 * ---------------------------------------------------------------------------
 * The OnStream APK signs its gateway requests with a HMAC-MD5 signature over
 * a canonical request. The same contract is carried by the resolver script
 * the original app ships (`assets/resolvers/moviebox.js`) and was recovered
 * verbatim from it:
 *
 *   signature      = base64( HMAC-MD5( secretBytes, canonicalRequest ) )
 *   canonicalRequest = "GET\n<accept>\n\n\n<timestampMillis>\n\n<signedPath>"
 *   signedPath     = "<path>[?<canonicalQuery>]"
 *   canonicalQuery = every query parameter decoded exactly once, sorted by
 *                    name, joined as "name=value" with "&"
 *
 * and the header is `x-tr-signature: <timestampMillis>|2|<signature>`.
 *
 * ---------------------------------------------------------------------------
 * What the live backend actually requires (measured 2026-10-24)
 * ---------------------------------------------------------------------------
 * Every endpoint on `wefeed-mobile-bff` is behind the gateway, and the
 * gateway's requirements are not negotiable:
 *
 *   | headers sent                          | result                     |
 *   |---------------------------------------|----------------------------|
 *   | nothing                                | connection reset by nginx |
 *   | Accept only                             | connection reset          |
 *   | Accept + X-Client-Token                 | connection reset          |
 *   | Accept + x-tr-signature                 | HTTP 401 (no identity)    |
 *   | Accept + x-tr-signature + X-Client-Info | HTTP 401 (no session)     |
 *   | Accept + x-tr-signature + X-Client-Info + X-Client-Token | HTTP 200 |
 *   | Accept + Bearer + x-tr-signature       | HTTP 200                  |
 *
 * `Accept: application/json` is mandatory on every call: sending a different
 * Accept than the one that was signed — or omitting it — makes the gateway
 * reset the connection instead of answering. The signed accept value and the
 * transmitted accept value are therefore always the same string, and this
 * module only ever signs with the exact value it is about to send.
 *
 * ---------------------------------------------------------------------------
 * Key material
 * ---------------------------------------------------------------------------
 * The gateway secret is a CLIENT-side key: the original application ships it
 * inside its own resolver asset. It is read here from
 * `ONSTREAM_GATEWAY_SECRET_B64` and is never written to source control or
 * exposed to the browser. The client-build certificate digest and salt are
 * public constants of the shipped resolver; they have inline defaults and
 * can be overridden by env var.
 *
 * With no key material the OnStream path is simply unavailable and callers
 * fall back to the thin relay. That is a supported mode, not an error.
 */

import { createHash, createHmac, randomBytes } from "node:crypto";

/** The gateway origin. */
export const ONSTREAM_BASE_HOST = "api6.aoneroom.com";
export const ONSTREAM_BASE_URL = `https://${ONSTREAM_BASE_HOST}`;

/** The mobile BFF prefix. Every endpoint below hangs off it. */
export const ONSTREAM_MOBILE_BFF = "/wefeed-mobile-bff";

/** The gateway expects the okhttp user agent the original app sends. */
export const ONSTREAM_USER_AGENT = "okhttp/4.12.0";

/** The client identity the gateway binds the session to. */
export const GATEWAY_PACKAGE_NAME = "com.community.oneroom";
export const GATEWAY_VERSION_NAME = "4.0.02.0831.02";
export const GATEWAY_VERSION_CODE = 90020126;
export const GATEWAY_INSTALL_CHANNEL = "ps";
export const GATEWAY_INSTALL_STORE = "ps";

/**
 * Client-build certificate digest and salt.
 *
 * Public constants taken from the resolver script the original app ships —
 * a certificate digest and a fixed salt, neither of which is a secret. They
 * are overridable so the site can be pointed at a reissued client build
 * without a code change.
 */
const DEFAULT_CERT_SHA256 =
  "03d4b741632d136bc23e2de4c6adcdb7712f1980b619c183221801730bbd0410";
const DEFAULT_SALT = "oneroom";

export interface GatewayKeyMaterial {
  /** The gateway secret, already base64-decoded. */
  secretBytes: Buffer;
  /** SHA-256 of the client signing certificate. */
  certSha256: string;
  /** The salt mixed into the client-build digest. */
  salt: string;
}

let cachedMaterial: GatewayKeyMaterial | null = null;

/**
 * The signing material, or null when it is not configured.
 *
 * Null means "the OnStream path is off". Callers treat that as a normal
 * outcome and fall back to the relay — they must not throw.
 */
export function gatewayKeyMaterial(): GatewayKeyMaterial | null {
  if (cachedMaterial) return cachedMaterial;

  const secretB64 = process.env.ONSTREAM_GATEWAY_SECRET_B64?.trim();
  if (!secretB64) return null;

  let secretBytes: Buffer;
  try {
    secretBytes = Buffer.from(secretB64, "base64");
  } catch {
    return null;
  }
  if (!secretBytes.length) return null;

  cachedMaterial = {
    secretBytes,
    certSha256:
      process.env.ONSTREAM_CLIENT_BUILD_CERT_SHA256?.trim() ||
      DEFAULT_CERT_SHA256,
    salt: process.env.ONSTREAM_CLIENT_BUILD_SALT?.trim() || DEFAULT_SALT,
  };
  return cachedMaterial;
}

/** True when the OnStream path can be used at all. */
export function onStreamConfigured(): boolean {
  return gatewayKeyMaterial() !== null;
}

/**
 * Decode one query component exactly once.
 *
 * Mirrors `java.net.URLDecoder.decode`: `+` is a space and a malformed
 * percent escape is an error. A component that cannot be decoded is skipped
 * rather than aborting the whole signature.
 */
function decodeComponent(value: string): string | null {
  try {
    return decodeURIComponent(value.replace(/\+/g, " "));
  } catch {
    return null;
  }
}

/**
 * The canonical query string: every parameter decoded once, sorted by name.
 *
 * @param rawQuery the *encoded* query string, exactly as it goes on the wire.
 */
export function canonicalQuery(rawQuery: string): string {
  if (!rawQuery) return "";
  const decoded = new Map<string, string>();
  for (const component of rawQuery.split("&")) {
    const separator = component.indexOf("=");
    if (separator < 0) continue;
    const name = decodeComponent(component.slice(0, separator));
    const value = decodeComponent(component.slice(separator + 1));
    if (name === null || value === null || !name) continue;
    decoded.set(name, value);
  }
  return [...decoded.entries()]
    .sort(([a], [b]) => (a === b ? 0 : a < b ? -1 : 1))
    .map(([n, v]) => `${n}=${v}`)
    .join("&");
}

/** Lower-case hex MD5. */
export function md5Hex(input: string | Buffer): string {
  return createHash("md5").update(input).digest("hex");
}

/**
 * The gateway signature for one request.
 *
 * @param accept the exact `Accept` header value that will be transmitted.
 *   It is part of the canonical request, so the signed value and the
 *   transmitted value MUST be identical.
 */
export function signRequest(
  material: GatewayKeyMaterial,
  method: string,
  path: string,
  rawQuery: string,
  accept: string,
  timestampMillis: number,
): string {
  const cq = canonicalQuery(rawQuery);
  const signedPath = cq ? `${path}?${cq}` : path;
  const canonicalRequest = [
    method,
    accept ?? "",
    "",
    "",
    String(timestampMillis),
    "",
    signedPath,
  ].join("\n");
  return createHmac("md5", material.secretBytes)
    .update(Buffer.from(canonicalRequest, "utf8"))
    .digest("base64");
}

/** The `x-tr-signature` header value. */
export function signatureHeader(
  timestampMillis: number,
  signature: string,
): string {
  return `${timestampMillis}|2|${signature}`;
}

/**
 * The `X-Client-Token` used before a bearer token exists.
 *
 * `"<timestampMillis>,<md5Hex(reverse(timestampMillis))>"`.
 */
export function clientToken(timestampMillis: number): string {
  const timestamp = String(timestampMillis);
  const reversed = timestamp.split("").reverse().join("");
  return `${timestamp},${md5Hex(Buffer.from(reversed, "utf8"))}`;
}

/** A fresh client-build nonce: epoch microseconds plus a random suffix. */
export function buildNonce(): string {
  const micros = Date.now() * 1000 + Math.floor(Math.random() * 1000);
  const suffix = Math.floor(Math.random() * 1000);
  return `${micros}${suffix}`;
}

/**
 * The `X-Client-Build` value.
 *
 * `"<nonce>.<md5Hex(certificateSha256 + salt + nonce)>-"`.
 */
export function clientBuild(
  material: GatewayKeyMaterial,
  nonce: string,
): string {
  return `${nonce}.${md5Hex(Buffer.from(material.certSha256 + material.salt + nonce, "utf8"))}-`;
}

export interface ClientIdentity {
  deviceId: string;
  advertisingId: string;
  osVersion: string;
  model: string;
  language: string;
  region: string;
  networkType: string;
  timeZone: string;
}

function randomUuid(): string {
  const bytes = randomBytes(16);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join("-");
}

/**
 * The `X-Client-Info` value: the JSON client-information blob the gateway
 * requires. The pipe-delimited form the original's native signer used is a
 * different regime and is rejected with HTTP 401 — this blob is the one the
 * gateway accepts.
 */
export function clientInformation(
  clientBuildValue: string,
  identity: ClientIdentity,
): string {
  return JSON.stringify({
    package_name: GATEWAY_PACKAGE_NAME,
    version_name: GATEWAY_VERSION_NAME,
    version_code: GATEWAY_VERSION_CODE,
    "X-Client-Build": clientBuildValue,
    os: "android",
    os_version: identity.osVersion,
    install_ch: GATEWAY_INSTALL_CHANNEL,
    device_id: identity.deviceId,
    install_store: GATEWAY_INSTALL_STORE,
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

/** A stable-per-process client identity. */
export function defaultIdentity(): ClientIdentity {
  return {
    deviceId: randomUuid(),
    advertisingId: randomUuid(),
    osVersion: "14",
    model: "Android",
    language: "en",
    region: "US",
    networkType: "NETWORK_WIFI",
    timeZone: "UTC",
  };
}
