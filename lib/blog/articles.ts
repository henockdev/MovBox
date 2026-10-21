/**
 * Blog articles for the /blog section. Each article becomes an
 * indexable page with Article + BreadcrumbList JSON-LD. The
 * freshness signal from regular new posts is one of the strongest
 * levers for sustained SEO growth.
 *
 * In production this would be a CMS or markdown loader; for now
 * it's a hardcoded array that the build picks up. To add a new
 * article: append an object, push to git, and Vercel auto-deploys.
 */

export interface BlogArticle {
  slug: string;
  title: string;
  description: string;
  /** ISO 8601 date string. */
  date: string;
  /** Author display name. */
  author: string;
  /** Reading time in minutes (rounded). */
  readingTime: number;
  /** Category — drives the article's "articleSection" field. */
  category: "News" | "Guides" | "Reviews" | "Lists";
  /** Short tag array for display + schema. */
  tags: string[];
  /** Hero image URL (we reuse poster art from the catalog). */
  image?: string;
  /** Article body as an array of paragraphs (no HTML — sanitized). */
  body: string[];
}

export const ARTICLES: BlogArticle[] = [
  {
    slug: "top-10-movies-this-week",
    title: "Top 10 Movies to Stream This Week on Movbox",
    description:
      "Our editors' pick of the most-watched new movies on Movbox right now — from action to drama to comedy, all available in 4K.",
    date: "2026-09-05T10:00:00.000Z",
    author: "Movbox Editorial",
    readingTime: 5,
    category: "Lists",
    tags: ["Top 10", "Movies", "New Releases"],
    image: "https://pbcdnw.aoneroom.com/image/2026/09/04/03e6d276f4b48a48e478959af0aa839f.jpeg",
    body: [
      "Looking for something new to watch? We've crunched the view counts, sorted the catalog, and picked the ten films that Movbox viewers are binging hardest this week.",
      "If you want action, look no further than the latest Jason Statham vehicle — it's pure kinetic fun from open to credits, and the 4K HDR transfer on the Movbox stream is one of the best we've seen this year. For a slower burn, the new A24 drama starring a quietly devastating Florence Pugh performance is the kind of movie that stays with you for days.",
      "Comedy fans should check out the third entry in the surprise-hit franchise that nobody expected to still be good in 2026. The Rotten Tomatoes score is a modest 78% but our users rate it 4.3 stars — the difference is that critics want the old movies back and audiences are happy to laugh.",
      "Family night? The new animated feature from the studio behind Spider-Verse is finally streaming. It's the rare kids' movie that doesn't insult the adults in the room. Streaming in 4K with Atmos sound, the action sequences are best watched on a real TV rather than a phone or laptop.",
      "Drama picks: a quiet two-hander about a marriage falling apart, set entirely in a single kitchen over the course of one evening. It's the opposite of comfort viewing but the performances are extraordinary. Pair with the new courtroom thriller for a night of intense cinema.",
      "All ten titles are streaming right now on Movbox in 4K. Just sign in (free), pick a row from the home page, and press play.",
    ],
  },
  {
    slug: "how-to-find-best-4k-content",
    title: "How to Find the Best 4K Content on Movbox",
    description:
      "A short guide to filtering by quality, building a 4K watchlist, and using the player settings to get the most out of your stream.",
    date: "2026-09-01T10:00:00.000Z",
    author: "Movbox Team",
    readingTime: 4,
    category: "Guides",
    tags: ["4K", "Settings", "Player", "Tutorial"],
    body: [
      "Most new TVs ship with 4K panels but a lot of people never actually watch 4K content because they don't know how to find it. This guide fixes that in three minutes.",
      "First, the basics. When you open a movie or show on Movbox, the player auto-selects the highest-quality source by default. If the stream looks soft, click the gear icon in the player controls, choose Quality, and look for 2160p or 1080p. Anything 1080p and up is genuinely HD on a 4K screen.",
      "Second, the right network. 4K streaming needs about 25 Mbps of stable bandwidth. If you're on Wi-Fi and a family member is on a video call, you may be silently dropping down to 1080p. Hardwire with an Ethernet cable if you can, or sit near the router.",
      "Third, the right settings. On the same Quality menu, switch on Hardware Acceleration if your browser supports it (Chrome and Edge do). This offloads decoding to your GPU and reduces buffering. Also turn off any browser extensions that might be injecting ads or modifying video.",
      "Fourth, the right time. 4K streams are heavier on the network, so peak hours (7-11pm local) can feel slower. If a 4K stream keeps buffering, try again in an hour or pick a 1080p source — both are valid choices and the difference on a 50-inch TV from 8 feet away is honestly hard to see.",
      "That's it. You don't need a special subscription tier or a new device — just pick 4K when it's available, hardwire if you can, and let the player do its job.",
    ],
  },
  {
    slug: "why-we-built-movbox",
    title: "Why We Built Movbox (And Why It's Free)",
    description:
      "The story behind the streaming site. No paywall, no signup required to watch, and a thin ad-supported model that respects your time.",
    date: "2026-08-28T10:00:00.000Z",
    author: "Movbox Founders",
    readingTime: 3,
    category: "News",
    tags: ["Company", "Mission", "About"],
    body: [
      "We started Movbox because we were tired of paying for four streaming subscriptions and still not finding the movie we wanted to watch. So we built a site that just works: search, press play, watch.",
      "There's no paywall. You don't need an account to watch. Ads are minimal and clearly marked. We make money from a small number of high-quality, non-intrusive ads and an optional account for sync features — not from selling your data or hiding shows behind a checkout.",
      "The site is built on top of a thin proxy that fetches streams from a community-maintained catalog. We don't host the content ourselves, we just make it easy to find and watch in 4K. The catalog is huge and grows every week.",
      "We're a small team. There's an Android app coming later this year. There's a watchlist, continue-watching, and a profile system if you sign in (still free). There's no roadmap for a paid tier — the ad-supported model funds everything and we want to keep it that way.",
      "If you have feedback, hit us up at support@bacteriostaticagua.com. We read every message.",
    ],
  },
  {
    slug: "best-k-drama-2026",
    title: "The Best K-Drama to Watch Right Now (2026 Edition)",
    description:
      "From romance to thriller to historical epic — our pick of the K-dramas lighting up Movbox in 2026.",
    date: "2026-08-22T10:00:00.000Z",
    author: "Movbox Editorial",
    readingTime: 6,
    category: "Lists",
    tags: ["K-Drama", "Korean", "Lists"],
    body: [
      "Korean drama has quietly become one of the most-watched categories on Movbox, and 2026 has been a banner year. Here are the five shows our K-drama viewers keep coming back to.",
      "The historical sageuk that took Netflix by storm is finally streaming here. Twenty episodes, set during the Joseon dynasty, with a romance that builds so slowly you'll be screaming at your screen by episode six. The cinematography is gorgeous — every frame looks like a painting.",
      "For something modern, the new romance about two people in their thirties who reconnect after a school reunion is doing numbers. No love triangles, no chaebol heiresses, just two adults navigating real-life messiness. The leads have ridiculous chemistry and the supporting cast is uniformly excellent.",
      "On the thriller side, the new crime drama about a forensic pathologist who moonlights as a vigilante is the kind of show that makes you cancel plans. Twelve tightly-written episodes with a twist in the finale that nobody sees coming.",
      "For a comfort-watch, the new season of the long-running hospital drama is streaming. It's the kind of show you can put on in the background and feel better about the world. The 2026 season focuses on the new batch of residents, with familiar faces returning as attendings.",
      "All five are on Movbox right now. Search for them by name on the home page or browse the TV row.",
    ],
  },
  {
    slug: "movbox-vs-other-streaming-sites",
    title: "How Movbox Compares to Paid Streaming Services",
    description:
      "An honest comparison of what you get from a free ad-supported streaming site vs a paid subscription.",
    date: "2026-08-18T10:00:00.000Z",
    author: "Movbox Editorial",
    readingTime: 5,
    category: "Reviews",
    tags: ["Comparison", "Industry", "Streaming"],
    body: [
      "People ask us all the time: how does a free site like Movbox compare to Netflix, Disney+, or HBO Max? Here's an honest answer.",
      "First, the content. The catalog on Movbox is huge but different from any single paid service. We pull from a community-maintained index that includes lots of older films, international titles, and indie releases that the major platforms cycle out. We don't have Marvel or HBO originals. We have almost everything else, including a lot of films that are hard to find anywhere else.",
      "Second, the price. Free, with ads. We make sure ads are clearly labeled and never interrupt playback. We never autoplay ads. The biggest ad we run is a small banner at the top of the home page and a social bar you can dismiss.",
      "Third, the experience. No login required to watch, no payment details, no upsells. Pick a movie, press play, watch. Sign in only if you want watchlist sync across devices.",
      "Where we lose: latest theatrical releases (we get them a few months after premium VOD), original series (we have plenty but not HBO-tier prestige), and 4K HDR quality on every title (most are 4K but a small percentage are still 1080p).",
      "Where we win: everything else. Especially if you watch a lot of international content, anime, or older films that have left the major platforms.",
      "Use Movbox alongside your paid subscriptions. Cancel them when you want, come back when the new season drops. That's how we use it ourselves.",
    ],
  },
];

export function getArticleBySlug(slug: string): BlogArticle | null {
  return ARTICLES.find((a) => a.slug === slug) ?? null;
}

export function getAllArticles(): BlogArticle[] {
  // Newest first.
  return [...ARTICLES].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );
}
