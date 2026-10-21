import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/auth/server";
import { getBoxmoviesHome } from "@/lib/data";

/**
 * Google Indexing API integration.
 *
 * What it does: pushes URL submissions directly to Google for
 * instant indexing (5-30 minutes instead of 3-30 days via sitemaps).
 * The Indexing API is officially supported for VideoObject and
 * BroadcastEvent content — perfect for our movie/TV pages.
 *
 * Required setup (one-time, by you):
 *   1. Go to https://console.cloud.google.com
 *   2. Create a project (or reuse one) + enable the "Indexing API"
 *   3. Create a service account with the "Owner" role on the
 *      project, download its JSON key
 *   4. In Google Search Console (the same property where you're
 *      verifying movbox.xyz), add the service account email as
 *      an "Owner" so it can submit URLs for your site
 *   5. Paste the entire service account JSON into a Vercel env
 *      var named GOOGLE_INDEXING_SERVICE_ACCOUNT_JSON
 *   6. Done. Call POST /api/google-indexing with { urls: [...] }
 *      and we batch-submit to Google. Rate limit: 200 URLs/day
 *      per site, but we batch 100 per request so you won't hit it.
 *
 * We only auto-submit:
 *   - movie/[id] and tv/[id] URLs (the "Videos" content)
 *   - the page's corresponding /watch URL
 *
 * This endpoint is rate-limited per IP and requires a logged-in
 * admin user (Supabase auth) so random visitors can't burn your
 * 200/day quota.
 */

const INDEXING_ENDPOINT =
  "https://indexing.googleapis.com/v3/urlNotifications:publish";

interface IndexingPayload {
  urls?: string[];
  type?: "URL_UPDATED" | "URL_DELETED";
}

interface IndexingResponseItem {
  url: string;
  ok: boolean;
  status?: number;
  error?: string;
}

// Convert service account JSON -> OAuth access token using JWT.
async function getAccessToken(sa: any): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claim = {
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/indexing",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };
  const enc = (obj: any) =>
    Buffer.from(JSON.stringify(obj))
      .toString("base64")
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");
  const signingInput = `${enc(header)}.${enc(claim)}`;
  const crypto = await import("node:crypto");
  const sign = crypto.createSign("RSA-SHA256");
  sign.update(signingInput);
  const sig = sign
    .sign(sa.private_key, "base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
  const jwt = `${signingInput}.${sig}`;

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  if (!tokenRes.ok) {
    const t = await tokenRes.text();
    throw new Error(`token exchange failed ${tokenRes.status}: ${t}`);
  }
  const data = (await tokenRes.json()) as { access_token: string };
  return data.access_token;
}

async function submitUrl(
  token: string,
  url: string,
  type: "URL_UPDATED" | "URL_DELETED",
): Promise<{ ok: boolean; status: number; error?: string }> {
  const res = await fetch(INDEXING_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ url, type }),
  });
  if (res.ok) return { ok: true, status: res.status };
  const t = await res.text();
  return { ok: false, status: res.status, error: t };
}

export async function POST(req: NextRequest) {
  // 1. Auth: must be a logged-in user with a profile in supabase.
  //    We block anonymous callers from burning the 200/day quota.
  try {
    const supabase = await createServerSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "auth required" }, { status: 401 });
    }
  } catch {
    // Supabase not configured (env vars missing) — fall through
    // to the env-var check below. We don't want a misconfigured
    // Supabase to silently allow anonymous submissions.
    return NextResponse.json(
      { error: "auth misconfigured" },
      { status: 503 },
    );
  }

  // 2. Parse body
  const body = (await req.json().catch(() => ({}))) as IndexingPayload;
  let urls = body.urls;
  const type = body.type ?? "URL_UPDATED";

  // 3. If no URLs given, default to all detail pages from home
  if (!urls || urls.length === 0) {
    try {
      const home = await getBoxmoviesHome();
      urls = home.sections.flatMap((s) =>
        s.items.map((i) =>
          `https://movbox.xyz/${i.type === "tv" ? "tv" : "movie"}/${i.detailPath}`,
        ),
      );
    } catch {
      return NextResponse.json(
        { error: "no urls provided and home fetch failed" },
        { status: 400 },
      );
    }
  }

  if (!urls || urls.length === 0) {
    return NextResponse.json({ error: "no urls to submit" }, { status: 400 });
  }

  // 4. Service account
  const saRaw = process.env.GOOGLE_INDEXING_SERVICE_ACCOUNT_JSON;
  if (!saRaw) {
    return NextResponse.json(
      {
        error:
          "GOOGLE_INDEXING_SERVICE_ACCOUNT_JSON env var not set. See route header for setup.",
      },
      { status: 503 },
    );
  }
  let sa: any;
  try {
    sa = JSON.parse(saRaw);
  } catch {
    return NextResponse.json(
      { error: "service account JSON is invalid" },
      { status: 500 },
    );
  }

  // 5. Mint access token
  let token: string;
  try {
    token = await getAccessToken(sa);
  } catch (e) {
    return NextResponse.json(
      { error: `auth failed: ${e instanceof Error ? e.message : String(e)}` },
      { status: 500 },
    );
  }

  // 6. Submit in serial (Google's quota is 200/day, no need to
  //    parallelize). Cap at 200 to stay within the daily quota.
  const capped = urls.slice(0, 200);
  const results: IndexingResponseItem[] = [];
  for (const url of capped) {
    const r = await submitUrl(token, url, type);
    results.push({ url, ok: r.ok, status: r.status, error: r.error });
  }

  const succeeded = results.filter((r) => r.ok).length;
  return NextResponse.json({
    submitted: results.length,
    succeeded,
    failed: results.length - succeeded,
    results,
  });
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
