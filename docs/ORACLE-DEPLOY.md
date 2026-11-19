# Moving Movbox off Vercel — Oracle Cloud Always Free

**Why:** Vercel paused the account on 2026-11-18 for exceeding the Hobby
plan's fair-use CPU limit. A pause is not "deploys are blocked" — it takes
the whole account down. Every URL answered `402 DEPLOYMENT_DISABLED`,
including `movbox.xyz` and the sibling domain. The pause message says it
ends on 2026-12-18; that is a month of downtime, which is not an option.

**What this document is:** the exact steps to run the site on an Oracle Cloud
Always Free instance, with the domain repointed in Cloudflare (where the
DNS already lives), plus the cache rules that stop the same CPU problem from
happening again.

**What you do:** steps 1, 2 and 5. Everything else I run over SSH.

---

## 0. What is already in place

| Thing | Where |
|---|---|
| Docker image + compose + Caddy | `deploy/` in the repo |
| One-command deploy | `deploy/deploy.sh` (pull → build → run) |
| Environment template | `deploy/env.example` → `.env` on the server |
| Verification | `scripts/verify-host.mjs` — checks the live site end to end |
| The deploy SSH key | already generated; its public key is below |

The app is a plain Next.js app. It does not use a Vercel-only feature:
`images.unoptimized` is already on, so there is no image-optimizer quota,
and the ISR/revalidation cache lives on disk (mounted as a volume so a
restart does not re-render the whole site).

---

## 1. Create the Oracle instance (you)

Sign in at **cloud.oracle.com**.

1. **Compute → Instances → Create instance**
2. **Name:** `movbox`
3. **Image:** Canonical **Ubuntu 22.04** (aarch64, "Ampere" shape)
4. **Shape:** `VM.Standard.A1.Flex` — **2 OCPU, 12 GB RAM**
   - A1 is the Always Free ARM shape. Change shape → Ampere → A1.Flex.
   - **If A1 shows "Out of capacity"**: try another region —
     Frankfurt (`eu-frankfurt-1`), Amsterdam (`eu-amsterdam-1`),
     Stockholm (`eu-stockholm-1`), Milan (`eu-milan-1`).
   - Do **not** use `VM.Standard.E2.1.Micro` (1/8 OCPU, 1 GB RAM) — it cannot
     build the app. It is only viable with a pre-built image.
5. **Networking:** a VCN with a **public subnet**, and
   **assign a public IPv4 address** (do not skip this — without it there is
   no SSH).
6. **Boot volume:** 50 GB (the build needs ~10 GB free).
7. **SSH keys:** "Paste public keys" and paste this one:

   ```
   ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIPpnSpYsDqU44fZ3iaxMnoDjPGcTvATRdEODkHi74g4d movbox-deploy
   ```

8. **Create instance.**

> **Oracle's idle-reclaim trap:** Always Free instances can be reclaimed if
> they are stopped or idle. **Never `stop` the instance** — use `reboot`.
> If the site ever goes dark, check the console first: the instance itself
> may have been reclaimed and needs recreating.

## 2. Open the ports (you)

Still in the instance's page → **Subnet → Security List → Add Ingress Rules**:

| Source | Destination Port | Protocol |
|---|---|---|
| `0.0.0.0/0` | `22` | TCP |
| `0.0.0.0/0` | `80` | TCP |
| `0.0.0.0/0` | `443` | TCP |

Egress: leave the default (allow all) — the app calls the upstream API and
the CDN.

## 3. Build and run (me)

Send me the instance's **public IP address** and I will SSH in, install
Docker, clone the repo, write the `.env` (including the OnStream secret,
which never goes into git), run the build and start the containers.

## 4. Repoint the domain (you — Cloudflare)

Cloudflare dashboard → **movbox.xyz → DNS → Records**:

| Type | Name | Content | Proxy |
|---|---|---|---|
| A | `@` | **the Oracle public IP** (delete the two Vercel IPs `64.29.17.65` / `216.198.79.65`) | Proxied (orange) |
| CNAME | `www` | `movbox.xyz` (was `cname.vercel-dns.com`) | Proxied (orange) |

Then **SSL/TLS → Overview → Full (strict)**. Caddy obtains a Let's Encrypt
certificate for both names on its own and renews it through Cloudflare.

> If the certificate never appears in the Caddy log, switch SSL mode to
> **Full** and re-run the deploy — Cloudflare will then accept the
> self-signed origin cert.

## 5. Add the cache rules (you — this is the CPU fix)

**Rules → Cache Rules → Create rule.** Three rules, in this order:

**a) `/watch/` — the episode pages (this is 20,000+ URLs and the whole
reason the CPU bill exploded)**

- Expression: `starts_with(http.request.uri.path, "/watch/")`
- Cache eligibility: **Eligible for cache** → **Cache everything**
- Edge TTL: **Ignore cache-control header and use this TTL** → 15 minutes
- Browser TTL: **Respect origin**

**b) `/movie/` and `/tv/` — the title pages**

- Expression: `(starts_with(http.request.uri.path, "/movie/") or starts_with(http.request.uri.path, "/tv/"))`
- Cache eligibility: **Cache everything**
- Edge TTL: 1 hour

**c) `/api/` — never cache**

- Expression: `starts_with(http.request.uri.path, "/api/")`
- Cache eligibility: **Bypass cache**

> Why this matters: `/watch/tv/<id>?s=1&e=1` carries its episode in the query
> string, so Next.js renders it dynamically — one server render per request.
> A crawler walking the episode URLs turned into tens of thousands of
> renders, and that is what tripped the Vercel fair-use limit. With the
> edge caching them, the origin sees a few hundred requests an hour
> instead of tens of thousands. The cache key includes the query string, so
> each episode stays its own entry.
>
> `next.config.ts` also sends `s-maxage` on those paths, so this works on
> any host, not only behind Cloudflare.

## 6. Verify (me)

Once DNS has propagated I run:

```
node scripts/verify-host.mjs https://movbox.xyz
```

It checks the pages answer 200, the titles and descriptions are in band,
the canonicals are self-referential, the sitemap is served, `/api/sources`
resolves a real source, Clarity is installed and still excluded from the
18+ pages, the IndexNow key file is reachable, and a dead URL still answers
404.

## 7. After it is live

1. **Re-submit the sitemap to IndexNow** — the URLs were submitted from the
   Vercel deployment; the same paths now point at the new host, and Bing
   will re-crawl them because the domain's content changed.
2. **Bing URL Inspection** — request a crawl for `https://movbox.xyz/` so
   the domain's new deployment is picked up quickly.
3. **Watch the 404 rate.** The upstream drops titles from the catalogue
   every day; the sitemap is rebuilt on every deploy from the live
   catalogue, so dead URLs fall out of it on their own.
4. **Do not delete the Vercel project.** It is paused and serving 402s, but
   the domain no longer points at it. If the Vercel account is ever
   upgraded to Pro, that deployment comes back to life on its old URLs —
   which is harmless as long as DNS stays on the Oracle IP.

---

## Operating the box afterwards

```bash
ssh -i <key> opc@<ORACLE_IP>

cd /opt/movbox

./deploy/deploy.sh                              # pull + rebuild + restart
docker compose -f deploy/docker-compose.yml logs -f web
docker compose -f deploy/docker-compose.yml ps
docker compose -f deploy/docker-compose.yml restart web
```

The build runs the sitemap prebuild, which makes ~600 upstream calls and
takes a few minutes. That is the reason a deploy is not instant.

## What is deliberately NOT in this setup

- **No Cloudflare Tunnel.** An A record plus Caddy is one DNS change; a
  tunnel would need a second Cloudflare object and a second failure mode.
- **No image optimiser.** `images.unoptimized` is already on — it was
  needed to stay under Vercel's 1,000-images-a-month quota and it also
  means the Oracle box never spends CPU on image transforms.
- **No ads changes.** `NEXT_PUBLIC_ADS_ENABLED` is baked in at build time
  and defaults to on, exactly as it was in production.
