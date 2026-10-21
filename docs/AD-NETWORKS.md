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

Publisher account host: `profitableratecpmnetwork.com`.

| Zone name | Zone ID | State | Format |
| --- | --- | --- | --- |
| `SocialBar_1` | `31080288` | Active | Social bar |
| `Popunder_1` | `31080286` | Active | Popunder |
| `Smartlink_1` | `31080287` | Active | Smartlink |

### 1. Social bar — zone `31080288`

```html
<script src="https://pl31180787.profitableratecpmnetwork.com/4d/8e/8e/4d8e8e8c319c3cfa4ed4d9338662515f.js"></script>
```

### 2. Popunder — zone `31080286`

```html
<script src="https://pl31180785.profitableratecpmnetwork.com/c8/63/1f/c8631f19a926b1ce86bd661e287e1538.js"></script>
```

### 3. Smartlink — zone `31080287`

A redirect destination, not a tag. Use as the click-through target for a
sponsored card / the `/ad` landing flow:

```
https://www.profitableratecpmnetwork.com/yze0wqd6?key=f4fe1371dae7e93cde4f80cf5953c03f
```

### Owner intent for these three

Popunder and smartlink are expected to be the higher-earning formats, and the
owner accepts them because they monetise visitors who never play a title.
Owner also asked that the social bar be styled to look good and invite clicks
rather than being visually hidden.

**Constraint that still applies:** the platform rules forbid accidental-click
design — fake close buttons, ad-styled player controls, forced clicks, overlays
that obstruct navigation, and downloads/plays disguised as buttons. "Inviting
clicks" has to mean a clearly-labelled ad that looks well-made, not a
misleading one. That boundary is non-negotiable and is a release requirement,
not a preference.

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