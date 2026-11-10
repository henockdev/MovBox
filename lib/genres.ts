/**
 * The genre pages.
 *
 * ## Why this file exists
 *
 * `/genres/<id>` used to be built on the TMDB integration. `TMDB_API_KEY` is
 * not set on this deployment, so `getMovieGenres()` returned nothing and
 * `discoverMovies()` returned nothing — and the pages answered **HTTP 200
 * with no content at all**: no `<h1>`, a 61-67 character description, no
 * `og:image`, and no titles. A soft 404.
 *
 * The Ahrefs site audit counted them: 27 "H1 tag missing or empty", 38
 * "Open Graph tags incomplete", and a large slice of the 244 "Meta
 * description too short".
 *
 * They are now built on the catalogue the site actually serves — the
 * boxmovies h5-api — using the upstream's own genre vocabulary. The TMDB id
 * is kept in the URL so every existing link keeps working, and so the
 * `/genres` index and the genre nav chips do not have to change.
 *
 * `upstreamGenre` is the string the h5-api's `/subject/filter` accepts.
 * It is the TMDB genre name except where the upstream spells it differently
 * ("Science Fiction" is "Sci-Fi" upstream).
 */

export interface GenrePageDef {
  /** The TMDB genre id — kept in the URL for backwards compatibility. */
  id: string;
  /** The display name. */
  title: string;
  /** The genre string the h5-api accepts in `/subject/filter`. */
  upstreamGenre: string;
  /** A real, hand-written description. Every page gets its own copy. */
  description: string;
}

export const GENRE_PAGES: GenrePageDef[] = [
  {
    id: "28",
    title: "Action",
    upstreamGenre: "Action",
    description:
      "Action movies and series on Movbox — car chases, gunfights, martial-arts fights and espionage thrillers. New blockbusters and cult classics, streamed free in HD with subtitles.",
  },
  {
    id: "12",
    title: "Adventure",
    upstreamGenre: "Adventure",
    description:
      "Adventure movies and series on Movbox — treasure hunts, jungle expeditions, space voyages and survival stories. The biggest quest films and adventure series, free to stream in HD.",
  },
  {
    id: "16",
    title: "Animation",
    upstreamGenre: "Animation",
    description:
      "Animated movies and anime series on Movbox — hand-drawn features, CGI blockbusters, cartoons and anime with English dubbing and subtitles. Watch every episode free in HD.",
  },
  {
    id: "35",
    title: "Comedy",
    upstreamGenre: "Comedy",
    description:
      "Comedy movies and sitcoms on Movbox — everything from throwaway farces to award-winning sitcoms and sharp dark comedy. Stream the funniest films and series free, in HD.",
  },
  {
    id: "80",
    title: "Crime",
    upstreamGenre: "Crime",
    description:
      "Crime movies and series on Movbox — mafia dramas, detective stories, heists and cold-case thrillers. Watch every case and every con free in HD with subtitles where available.",
  },
  {
    id: "99",
    title: "Documentary",
    upstreamGenre: "Documentary",
    description:
      "Documentaries on Movbox — true stories, nature, history, sport and investigative journalism, from the people who made them. Watch real documentaries free in HD.",
  },
  {
    id: "18",
    title: "Drama",
    upstreamGenre: "Drama",
    description:
      "Drama movies and series on Movbox — family sagas, courtroom stories, political drama and character-led films. The best of dramatic television and cinema, free to stream.",
  },
  {
    id: "10751",
    title: "Family",
    upstreamGenre: "Family",
    description:
      "Family movies and series on Movbox — warm comedies, animated adventures and stories made to watch together. Free to stream in HD for the whole family.",
  },
  {
    id: "14",
    title: "Fantasy",
    upstreamGenre: "Fantasy",
    description:
      "Fantasy movies and series on Movbox — magic kingdoms, dragons, prophecies and supernatural worlds, from big studio epics to mythic dark fantasy. Watch free in HD.",
  },
  {
    id: "36",
    title: "History",
    upstreamGenre: "History",
    description:
      "History movies and series on Movbox — wars, revolutions, biopics and period dramas that put real events on screen. Stream historical epics and documentaries free in HD.",
  },
  {
    id: "27",
    title: "Horror",
    upstreamGenre: "Horror",
    description:
      "Horror movies and series on Movbox — slashers, ghost stories, psychological dread and slow-burn terror. Every frightening title free to stream in HD.",
  },
  {
    id: "10402",
    title: "Music",
    upstreamGenre: "Music",
    description:
      "Music movies and series on Movbox — biopics of the artists who shaped popular music, concert films and the stories behind the songs. Watch free in HD.",
  },
  {
    id: "9648",
    title: "Mystery",
    upstreamGenre: "Mystery",
    description:
      "Mystery movies and series on Movbox — whodunits, locked-room puzzles and twist-filled thrillers where every clue matters. Watch every case solved free in HD.",
  },
  {
    id: "10749",
    title: "Romance",
    upstreamGenre: "Romance",
    description:
      "Romance movies and series on Movbox — love stories from every corner of the world, from sweeping epics to modern dramas. Stream them all free in HD.",
  },
  {
    id: "878",
    title: "Sci-Fi",
    upstreamGenre: "Sci-Fi",
    description:
      "Sci-fi movies and series on Movbox — space opera, time travel, robots, aliens and near-future dystopia. Stream the best science fiction free in HD.",
  },
  {
    id: "53",
    title: "Thriller",
    upstreamGenre: "Thriller",
    description:
      "Thriller movies and series on Movbox — suspense, conspiracies and the slow build to a twist you do not see coming. Watch every thriller free in HD.",
  },
  {
    id: "10752",
    title: "War",
    upstreamGenre: "War",
    description:
      "War movies and series on Movbox — the front lines of every conflict, from the trenches to the cockpit. Historical battle dramas and modern war films, free in HD.",
  },
  {
    id: "37",
    title: "Western",
    upstreamGenre: "Western",
    description:
      "Western movies and series on Movbox — outlaws, open ranges and dusty showdowns, from the classics to modern revisionist westerns. Stream every frontier story free in HD.",
  },
];

export const GENRE_PAGE_BY_ID = new Map(GENRE_PAGES.map((g) => [g.id, g]));
