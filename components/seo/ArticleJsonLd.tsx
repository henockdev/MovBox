import { SITE_NAME, SITE_URL } from "@/lib/constants";
import type { BlogArticle } from "@/lib/blog/articles";

/**
 * Article JSON-LD. Critical for blog/news posts to surface in
 * Google's "Top stories" carousel and the "Articles" rich result.
 * Combined with the visible page, this unlocks the News / Articles
 * index for the site.
 */
export function ArticleJsonLd({ article }: { article: BlogArticle }) {
  const pageUrl = `${SITE_URL}/blog/${article.slug}`;
  const json = {
    "@context": "https://schema.org",
    "@type": "Article",
    "@id": `${pageUrl}#article`,
    headline: article.title,
    description: article.description,
    image: article.image ? [article.image] : undefined,
    datePublished: article.date,
    dateModified: article.date,
    author: {
      "@type": "Organization",
      name: article.author,
      url: SITE_URL,
    },
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      url: SITE_URL,
      logo: {
        "@type": "ImageObject",
        url: `${SITE_URL}/movbox_icon.png`,
      },
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": pageUrl,
    },
    articleSection: article.category,
    keywords: article.tags.join(", "),
    wordCount: article.body.reduce(
      (sum, p) => sum + p.split(/\s+/).length,
      0,
    ),
    inLanguage: "en",
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(json) }}
    />
  );
}
