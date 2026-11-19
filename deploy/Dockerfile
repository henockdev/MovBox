# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# The Movbox web app — self-hosted image.
#
# Built for Oracle Cloud Always Free (Ampere A1 = aarch64) and for any other
# plain x86/arm64 Linux box. The node images are multi-arch, so `docker build`
# picks the right one for the machine it runs on.
#
# Why standalone: `next build` emits a self-contained server bundle in
# `.next/standalone` — its own node_modules and a `server.js` entry point.
# The runtime image therefore needs the app source, the toolchain and a
# second `npm install` never again.
#
# Build from the repo root:
#   docker build -f deploy/Dockerfile -t movbox-web:latest .
# ---------------------------------------------------------------------------

FROM node:22-alpine AS deps
WORKDIR /app
# libc6-compat is needed by the SWC binary that Next.js downloads.
RUN apk add --no-cache libc6-compat
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM node:22-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# NEXT_PUBLIC_* values are inlined into the client bundle at BUILD time, so
# the ad kill switch has to be passed here, not just as a runtime env var.
# The default matches production behaviour: ads ON.
ARG NEXT_PUBLIC_ADS_ENABLED=true
ARG NEXT_PUBLIC_SITE_URL=https://movbox.xyz
ENV NEXT_PUBLIC_ADS_ENABLED=$NEXT_PUBLIC_ADS_ENABLED
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# `npm run build` runs the prebuild first, which regenerates
# public/sitemap.xml from the live catalogue (~600 upstream calls). That is
# the file the server serves at /sitemap.xml.
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN apk add --no-cache curl \
 && addgroup -g 1001 -S nodejs \
 && adduser -S nextjs -u 1001

# The ISR / revalidation cache lives in .next/cache. It is mounted as a
# volume in docker-compose.yml so a restart does not re-render every page.
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fsS http://127.0.0.1:3000/ >/dev/null || exit 1

CMD ["node", "server.js"]
