/**
 * FAQPage JSON-LD. Renders as a "People also ask" rich result in
 * Google for queries that match. Pushes a FAQ block to the top of
 * the SERP for the question phrases we target.
 *
 * Usage:
 *   <FaqJsonLd items={[
 *     { q: "What is X?", a: "X is ..." },
 *     { q: "How do I Y?", a: "First ..." },
 *   ]} />
 *
 * The visual FAQ on the page should match the schema — Google
 * flags schemas that don't match visible content.
 */
export interface FaqItem {
  q: string;
  a: string;
}

export function FaqJsonLd({ items }: { items: FaqItem[] }) {
  const json = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((it) => ({
      "@type": "Question",
      name: it.q,
      acceptedAnswer: {
        "@type": "Answer",
        text: it.a,
      },
    })),
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(json) }}
    />
  );
}
