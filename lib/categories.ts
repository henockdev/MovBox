import type { BrowseFilters, UpstreamChannelId } from "@/lib/data";

/**
 * A page section, resolved from the upstream catalogue.
 *
 * `operating` pulls a whole upstream tab - the app's category tabs are stacks
 * of curated sections, not flat grids, and `/tab-operating` returns exactly
 * that. `filter` pulls one filtered slice of a channel.
 */
export type CategorySource =
  | { kind: "operating"; tabId: number }
  | {
      kind: "filter";
      title: string;
      channelId: UpstreamChannelId;
      filters?: BrowseFilters;
    };

export interface CategoryDef {
  /** URL segment: /category/<slug> */
  slug: string;
  title: string;
  /** Short line under the title. */
  tagline: string;
  /** Meta description. Written for a human and for a search result. */
  description: string;
  keywords: string[];
  sources: CategorySource[];
  /**
   * External hub, for the app's H5Tab categories. The app's "Live" tab is
   * not a catalogue - it is a separate TV-channel SPA - so the page links
   * out instead of showing an unrelated grid.
   */
  externalHub?: { label: string; url: string; note: string };
  /** Show in the main navigation. */
  inNav: boolean;
}

/**
 * The categories the original app exposes that the website did not have.
 *
 * Every source below was verified against the live h5-api before it was put
 * here - each one returns real, on-topic titles. The upstream app reaches
 * its category tabs through the mobile BFF (api6.aoneroom.com), which this
 * deployment cannot call, so the sections are reproduced from the web BFF's
 * own channel + filter vocabulary instead. Same subjects, same catalogue.
 */
export const CATEGORIES: CategoryDef[] = [
  {
    slug: "kids",
    title: "Kids & Family",
    tagline: "Animation, cartoons and family favourites for the little ones.",
    description:
      "Stream kids movies, animated series, cartoons and family films free on Movbox. CoComelon, Doraemon, folktales, anime for younger viewers and more, updated daily.",
    keywords: [
      "kids movies",
      "cartoon",
      "animation for kids",
      "family films",
      "cocomelon",
      "nursery rhymes",
    ],
    inNav: true,
    sources: [
      { kind: "filter", title: "Animated Movies", channelId: 1, filters: { genre: "Animation" } },
      { kind: "filter", title: "Family Movies", channelId: 1, filters: { genre: "Family" } },
      { kind: "filter", title: "Nursery Rhymes & Learning", channelId: 1, filters: { genre: "kids" } },
      { kind: "filter", title: "Animated Series", channelId: 2, filters: { genre: "Animation" } },
      { kind: "filter", title: "Family Series", channelId: 2, filters: { genre: "Family" } },
      { kind: "filter", title: "Folktales & Fairy Tales", channelId: 2, filters: { genre: "Cartoon" } },
      { kind: "filter", title: "Shorts & Sing-alongs", channelId: 5, filters: { genre: "Cartoon" } },
    ],
  },
  {
    slug: "asian",
    title: "Asian Cinema",
    tagline: "K-Drama, Japanese anime, C-Drama and Bollywood — all in one place.",
    description:
      "Watch K-Drama, Japanese anime, C-Drama, Bollywood and Indonesian drama free on Movbox. Thousands of Asian movies and series, new titles added every day.",
    keywords: [
      "k-drama",
      "korean drama",
      "anime",
      "c-drama",
      "chinese drama",
      "bollywood",
      "asian movies",
    ],
    inNav: true,
    sources: [
      { kind: "filter", title: "K-Drama Series", channelId: 2, filters: { country: "Korea" } },
      { kind: "filter", title: "Korean Movies", channelId: 1, filters: { country: "Korea" } },
      { kind: "filter", title: "Japanese Anime & Series", channelId: 2, filters: { country: "Japan" } },
      { kind: "filter", title: "C-Drama & Chinese Movies", channelId: 1, filters: { country: "China" } },
      { kind: "filter", title: "Chinese Series", channelId: 2, filters: { country: "China" } },
      { kind: "filter", title: "Bollywood", channelId: 1, filters: { country: "India" } },
      { kind: "filter", title: "Indian Series", channelId: 2, filters: { country: "India" } },
      { kind: "filter", title: "Indonesian Drama", channelId: 1, filters: { country: "Indonesia" } },
    ],
  },
  {
    slug: "western",
    title: "Western",
    tagline: "Cowboys, outlaws and the open frontier.",
    description:
      "Stream classic and modern Westerns free on Movbox — Dances with Wolves, Cast a Long Shadow, Wild Boys, Gold Diggers and more. Full-length feature films and series.",
    keywords: [
      "western movies",
      "cowboy films",
      "western series",
      "outlaw westerns",
      "classic western",
    ],
    inNav: true,
    sources: [
      { kind: "filter", title: "Western Movies", channelId: 1, filters: { genre: "Western" } },
      { kind: "filter", title: "Hollywood Westerns", channelId: 1, filters: { genre: "Western", country: "United States" } },
      { kind: "filter", title: "Western Series", channelId: 2, filters: { genre: "Western" } },
    ],
  },
  {
    slug: "nollywood",
    title: "Nollywood",
    tagline: "Nigerian cinema — the biggest film industry in Africa.",
    description:
      "Watch the best of Nollywood free on Movbox. Nigerian movies and series, latest releases first, from Lagos to Nollywood's new generation of filmmakers.",
    keywords: [
      "nollywood",
      "nigerian movies",
      "african movies",
      "nigerian series",
      "yoruba movies",
    ],
    inNav: true,
    sources: [
      { kind: "filter", title: "Nollywood Movies", channelId: 1, filters: { genre: "Nollywood" } },
      { kind: "filter", title: "Latest from Nigeria", channelId: 1, filters: { country: "Nigeria" } },
    ],
  },
  {
    slug: "midnight",
    title: "Midnight",
    tagline: "After-hours shelves for adults only.",
    description:
      "The Movbox after-hours collection: adult features, late-night shorts and mature series, streamed free. 18+ only - viewers must be of legal age.",
    keywords: ["adult movies", "midnight", "18+", "late night", "mature"],
    inNav: false,
    sources: [{ kind: "operating", tabId: 9 }],
  },
  {
    slug: "shorttv",
    title: "Short TV",
    tagline: "Vertical, bite-sized and endlessly scrollable.",
    description:
      "Short TV on Movbox — skits, cartoons, music clips and mini series you can watch in a couple of minutes. New shorts added every day.",
    keywords: ["short tv", "shorts", "mini series", "skits", "vertical video"],
    inNav: false,
    sources: [
      { kind: "filter", title: "Short TV", channelId: 5 },
      { kind: "filter", title: "Cartoons", channelId: 5, filters: { genre: "Cartoon" } },
      { kind: "filter", title: "Songs & Music", channelId: 5, filters: { genre: "Song" } },
    ],
  },
  {
    slug: "music",
    title: "Music",
    tagline: "Afrobeats, Bongo Flava, gospel and the playlists behind them.",
    description:
      "Music videos and playlists on Movbox — Afrobeats, Bongo Flava, Amapiano, gospel, R&B and more. Nigerian, Kenyan and international hits, updated weekly.",
    keywords: ["music videos", "afrobeats", "bongo flava", "amapiano", "gospel music", "playlists"],
    inNav: false,
    sources: [
      { kind: "filter", title: "Music Videos", channelId: 6 },
      { kind: "filter", title: "Afropop Hits", channelId: 1007 },
      { kind: "filter", title: "Trips, Commuting & Workout", channelId: 1008 },
      { kind: "filter", title: "Mood & Chill", channelId: 1009 },
    ],
  },
  {
    slug: "live",
    title: "Live TV",
    tagline: "The app's live channel hub.",
    description:
      "Watch live TV channels on Movbox. The Movbox app opens a dedicated live-channel hub; use it here for the full live experience.",
    keywords: ["live tv", "live channels", "tv channels", "watch live"],
    inNav: false,
    externalHub: {
      label: "Open the live channel hub",
      url: "https://spa.sportslivetoday.com/",
      note:
        "Live channels are served by the upstream live hub, the same one the Movbox app opens. It runs outside movbox.xyz.",
    },
    sources: [],
  },
];

export const CATEGORY_BY_SLUG = new Map(CATEGORIES.map((c) => [c.slug, c]));

export const NAV_CATEGORIES = CATEGORIES.filter((c) => c.inNav);
