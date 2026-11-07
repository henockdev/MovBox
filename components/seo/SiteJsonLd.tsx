import { SITE_NAME, SITE_URL } from "@/lib/constants";

/**
 * Site identity markup — `WebSite` + `Organization`.
 *
 * This is the one piece of structured data that belongs on **every** page,
 * and the site had none. Two things come out of it:
 *
 *   - `WebSite` + `potentialAction`/`SearchAction` tells a search engine that
 *     the site has its own search endpoint at /search?q=, which is what makes
 *     a sitelinks search box eligible.
 *   - `Organization` ties the site to its logo, its URL and its contact point,
 *     which is what a knowledge panel reads.
 *
 * For a generative engine it is the cheapest, most direct statement of what
 * Movbox is and how to use it — the same facts `public/llms.txt` states in
 * prose, expressed as markup.
 */
export function SiteJsonLd() {
  const json = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        url: `${SITE_URL}/`,
        name: SITE_NAME,
        inLanguage: "en",
        publisher: { "@id": `${SITE_URL}/#organization` },
        potentialAction: {
          "@type": "SearchAction",
          target: {
            "@type": "EntryPoint",
            urlTemplate: `${SITE_URL}/search?q={search_term_string}`,
          },
          "query-input": "required name=search_term_string",
        },
      },
      {
        "@type": "Organization",
        "@id": `${SITE_URL}/#organization`,
        name: SITE_NAME,
        url: `${SITE_URL}/`,
        logo: {
          "@type": "ImageObject",
          url: `${SITE_URL}/icon-512.png`,
          width: 512,
          height: 512,
        },
        contactPoint: {
          "@type": "ContactPoint",
          contactType: "customer support",
          email: "support@bacteriostaticagua.com",
          availableLanguage: ["English"],
        },
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(json) }}
    />
  );
}
