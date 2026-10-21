# Ad network materials — reference record

**Status: STORED, NOT INTEGRATED. No script below is loaded by the application.**

This file records the exact publisher-supplied materials verbatim so they are
reviewable and diffable before any of them is wired in. Nothing in this file is
a live integration. Phase-two integration is still gated on explicit approval.

Owner supplied these on 2026-10-21.

---

## Network A — HilltopAds

Delivery hosts observed in the supplied code: `conventionalresponse.com` (loader
tags) and `butterygrandmother.com` (VAST tag endpoint).

### 1. Video / VAST — zones `7538417`–`7538421` (Approved)

Not a `<script>` tag. A VAST tag URL to be fetched and parsed, same delivery
shape as the previous provider's in-stream unit:

```
https://butterygrandmother.com/dlm.FazMd/GSNnvKZoGBUb/ueImh9/uAZPU_l/kvPOTdct1wMvzLgu0HMKTuc/tlN/zKUaz/OBD/Q/yGM/Qp
```

Zone-specific URL for `7538417`. The other zones in the range were **not**
supplied as separate URLs — confirm with the network whether the range shares
one endpoint with a different zone parameter before building.

### 2. Multi tag banner — zones `7538401`–`7538405` (Approved)

```html
<script>
(function(fdqeb){
var d = document,
    s = d.createElement('script'),
    l = d.currentScript || d.scripts[d.scripts.length - 1];
s.settings = fdqeb || {};
s.src = "\/\/conventionalresponse.com\/bvXEV\/s.d\/Gel-0qY\/W\/cb\/pe\/mI9DuCZeUrlwkTPTTMc\/1SM-z\/gE0AM\/DYEhtCNmzqUkz\/OwDOQkwnNEQN";
s.async = true;
s.referrerPolicy = 'no-referrer-when-downgrade';
l.parentNode.insertBefore(s, l);
})({})
</script>
```

`fdqeb` is the per-zone settings object. The snippet supplied covers zone
`7538401`; the remaining zones in the range were not supplied separately.

### 3. Video slider — zones `7538385`–`7538389` (Approved)

```html
<script>
(function(likw){
var d = document,
    s = d.createElement('script'),
    l = d.currentScript || d.scripts[d.scripts.length - 1];
s.settings = likw || {};
s.src = "\/\/conventionalresponse.com\/baX_V.sndSGrlc0\/YHWncX\/Oenme9CuaZ\/UFlUkLP\/T\/cE1mMNzng-zlOdDHUwt\/NQzQUJznO\/DCMZ4MO\/Qz";
s.async = true;
s.referrerPolicy = 'no-referrer-when-downgrade';
l.parentNode.insertBefore(s, l);
})({})
</script>
```

`likw` is the per-zone settings object. Snippet supplied covers zone `7538385`.

### 4. Domain verification

Served at the site root so the network can confirm ownership:

- Path: `https://movbox.xyz/0455afc6243297c4e6c9.txt`
- Body: `da6c2d502f32f6bf44df`

Implemented as `public/0455afc6243297c4e6c9.txt`.

---

## Network B — Adsterra

**Not yet supplied.** Materials pending.

---

## Open questions for phase two

1. The three zone ranges each cover 5 zones, but only one snippet/URL per
   range was supplied. Confirm whether the remaining zones use a different
   zone parameter in the same endpoint or need their own snippet.
2. Confirm whether `conventionalresponse.com` requires a client-hints or CSP
   exception. The previous provider needed an explicit `Delegate-CH` allowlist
   for its delivery host; that delegation was removed with it and must not be
   reinstated for the wrong origin.
3. Confirm the approved VAST creative duration and skip offset before any
   player-surface pre-roll is designed. Do not reuse the previous provider's
   values by assumption.