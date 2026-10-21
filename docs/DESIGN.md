# Hmovies — Design System

> Single source of truth for the Hmovies visual language. Mirrored in `app/globals.css` `@theme {}` block. If you change a value here, change it there too.

## Brand

- **Name:** Hmovies
- **H** = user's initial, rendered in display serif (Cinzel) in burgundy
- **"movies"** = Inter Regular in cream/white
- **Tagline:** _Watch Movies, TV Shows & More_

## Color tokens

All values are CSS variables in `app/globals.css` and exposed as Tailwind v4 utilities via `@theme {}`.

### Surfaces (darkest → lightest)

| Token | Hex | Use |
|---|---|---|
| `bg-deepest` | `#080606` | Main page background |
| `bg-primary` | `#0D0909` | Header on scroll, footer |
| `surface` | `#140D0E` | Cards, raised surfaces |
| `surface-elevated` | `#1B1113` | Modals, dropdowns, popovers |
| `surface-hover` | `#261820` | Hover state for surfaces |

### Brand burgundy palette

| Token | Hex | Use |
|---|---|---|
| `brand` | `#800020` | Primary brand (burgundy) |
| `accent` | `#A42E4A` | Primary buttons, active states |
| `accent-bright` | `#D7707C` | Hover, highlights |
| `accent-soft` | `#E6A0A8` | Secondary highlights |

### Premium highlights

| Token | Hex | Use |
|---|---|---|
| `cream` | `#FFFDD0` | Main headings, premium text |
| `vanilla` | `#F7EDB9` | "Premium" pills, accent text |

### Text

| Token | Hex | Use |
|---|---|---|
| `text-primary` | `#F8F0E8` | Normal body text |
| `text-secondary` | `#B9A9A5` | Metadata, captions |
| `text-muted` | `#766A68` | Low-priority text, placeholders |

### Borders + glow

| Token | Hex | Use |
|---|---|---|
| `border` | `#302022` | Card borders, dividers |
| `border-strong` | `#4A3538` | Hover border, focus ring |
| `glow` | `rgba(164, 46, 74, 0.4)` | Subtle ambient shadow |

## Typography

| Role | Family | Weights | Use |
|---|---|---|---|
| Display | Cinzel (Google Font) | 500–800 | Hero titles, page H1s, "DUNE PART TWO" headlines |
| Body | Inter (Google Font) | 400–700 | All UI text, body, captions, buttons |

Both loaded via `next/font/google` with `display: swap`.

### Scale (Tailwind defaults)

- `text-xs` 12px — captions, badges
- `text-sm` 14px — body, buttons
- `text-base` 16px — large body
- `text-lg` 18px — small headings
- `text-xl` 20px — section titles
- `text-2xl` 24px — page subtitles
- `text-3xl` 30px — page titles
- `text-4xl` 36px — hero title (mobile)
- `text-6xl` 60px — hero title (desktop)
- `text-7xl` 72px — hero title (large desktop)

## Spacing

Use Tailwind's default scale. Page padding: `px-4 md:px-6 lg:px-8`. Section spacing: `space-y-12 md:space-y-16`.

## Radii

| Token | Value | Use |
|---|---|---|
| `rounded-md` | 6px | Buttons, inputs |
| `rounded-lg` | 8px | Cards, badges |
| `rounded-xl` | 12px | Larger cards, panels |
| `rounded-2xl` | 16px | Banners, modals |
| `rounded-full` | 9999px | Pills, avatars |

## Shadows

| Name | Use |
|---|---|
| `shadow-card` | Default card lift |
| `shadow-glow` | Hover state (burgundy tint) |
| `shadow-elevated` | Modals, popovers |

## Buttons

| Variant | Use |
|---|---|
| `primary` | Watch Now, primary CTAs (burgundy bg) |
| `secondary` | + My List, outline (surface bg + border) |
| `ghost` | Nav items, low-emphasis |
| `accent` | "Start Free Trial", cream bg, dark text |

Sizes: `sm`, `md`, `lg`, `icon`.

## Badges

| Variant | Use |
|---|---|
| `rating` | Star rating on cards (yellow on dark) |
| `quality` | 4K, HD, etc. (yellow on dark, bold) |
| `premium` | "Premium" 4K pill (gradient burgundy → bright) |
| `premiere` | "EXCLUSIVE PREMIERE" tag (burgundy) |
| `new` | "New" release tag (accent) |
| `default` | Generic chip |

## Animations

| Class | Effect |
|---|---|
| `animate-fade-in-up` | Hero content slides up + fades in (0.6s ease-out) |
| `animate-pulse-glow` | Pulsing burgundy glow (2.4s infinite) — for primary CTAs |
| `skeleton` | Shimmer loading state |

## Layout patterns

### Header
- Sticky, `inset-x-0 top-0 z-50`
- Transparent on top, glass-frosted after `scrollY > 24`
- Height: `h-16`

### Hero
- Full-bleed, `h-[88vh] min-h-[560px] md:h-[92vh]`
- Backdrop image, dark gradient overlay (`gradient-left` + `gradient-bottom`)
- Title bottom-left, max-w-2xl
- Side chevrons (md+), bottom dots (always)
- Auto-advances every 7s, pauses on hover

### Section / Row
- Title row (h2 + View All link)
- Horizontal scroll with chevron controls (hover)
- `snap-x snap-mandatory`
- Hide scrollbar via `.no-scrollbar`

### Card
- 150–220px wide, `aspect-[2/3]`
- Hover: scale 1.03 + glow shadow
- Reveal play + add buttons on hover

### Mobile bottom nav
- Fixed, `inset-x-0 bottom-0`, `h-16`
- 5 items, icon + label
- Active item: `text-accent-bright`
- Hidden on `md+`

## Motion + transitions

- Default transition: `duration-200`
- Hero slides: `duration-1000 ease-in-out`
- Card hover: `duration-300`
- All easings: `ease-out` (UI), `ease-in-out` (loops)

## Accessibility

- Focus ring: `2px solid accent-bright` with `2px offset`
- `prefers-reduced-motion`: hero auto-advance disabled (TODO)
- All interactive elements have `aria-label` where icon-only
- Color contrast: text-primary on bg-deepest = ~14:1 ✅ (WCAG AAA)

## Files

- `app/globals.css` — all tokens (CSS-based Tailwind v4)
- `app/layout.tsx` — font loading, root metadata
- `components/ui/Button.tsx` — button variants
- `components/ui/Badge.tsx` — badge variants
- `components/home/HeroCarousel.tsx` — reference hero impl
- `components/home/MovieCard.tsx` — reference card impl
