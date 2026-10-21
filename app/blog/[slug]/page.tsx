import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ARTICLES,
  getAllArticles,
  getArticleBySlug,
} from "@/lib/blog/articles";
import { ArticleJsonLd } from "@/components/seo/ArticleJsonLd";
import { BreadcrumbJsonLd } from "@/components/seo/BreadcrumbJsonLd";
import { SITE_URL } from "@/lib/constants";

// Pre-render all known slugs at build time so individual posts are
// static HTML, not dynamic SSR (better for SEO + load speed).
export async function generateStaticParams() {
  return ARTICLES.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = getArticleBySlug(slug);
  if (!article) return { title: "Article not found" };
  return {
    title: article.title,
    description: article.description,
    alternates: { canonical: `${SITE_URL}/blog/${article.slug}` },
    openGraph: {
      type: "article",
      title: article.title,
      description: article.description,
      url: `${SITE_URL}/blog/${article.slug}`,
      publishedTime: article.date,
      modifiedTime: article.date,
      authors: [article.author],
      tags: article.tags,
      images: article.image ? [article.image] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: article.title,
      description: article.description,
      images: article.image ? [article.image] : undefined,
    },
  };
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const article = getArticleBySlug(slug);
  if (!article) notFound();

  // "Related" = newest 2 other articles in the same category,
  // excluding the current one.
  const related = getAllArticles()
    .filter((a) => a.category === article.category && a.slug !== article.slug)
    .slice(0, 2);

  return (
    <div className="mx-auto max-w-3xl px-4 pb-16 pt-24 md:px-6 lg:px-8">
      <BreadcrumbJsonLd
        items={[
          { name: "Home", path: "/" },
          { name: "Blog", path: "/blog" },
          { name: article.title, path: `/blog/${article.slug}` },
        ]}
      />
      <ArticleJsonLd article={article} />

      <Link
        href="/blog"
        className="text-xs uppercase tracking-wider text-accent-bright hover:underline"
      >
        ← Back to blog
      </Link>

      <header className="mt-4">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-text-muted">
          <span className="rounded-full bg-accent/10 px-2 py-0.5 font-semibold text-accent-bright">
            {article.category}
          </span>
          {article.tags.slice(0, 3).map((t) => (
            <span key={t} className="text-text-muted">
              #{t}
            </span>
          ))}
        </div>
        <h1 className="mt-3 font-display text-3xl font-bold text-cream md:text-4xl">
          {article.title}
        </h1>
        <p className="mt-3 text-base text-text-secondary md:text-lg">
          {article.description}
        </p>
        <div className="mt-4 flex items-center gap-3 text-xs text-text-muted">
          <span>{article.author}</span>
          <span>·</span>
          <time dateTime={article.date}>{formatDate(article.date)}</time>
          <span>·</span>
          <span>{article.readingTime} min read</span>
        </div>
      </header>

      {article.image && (
        <div className="relative mt-8 aspect-video w-full overflow-hidden rounded-2xl border border-border">
          <Image
            src={article.image}
            alt={article.title}
            fill
            sizes="(max-width: 768px) 100vw, 768px"
            className="object-cover"
            priority
          />
        </div>
      )}

      <article className="prose prose-invert mt-10 max-w-none text-base leading-relaxed text-cream">
        {article.body.map((para, i) => (
          <p key={i} className="mb-5 text-text-secondary">
            {para}
          </p>
        ))}
      </article>

      {related.length > 0 && (
        <section className="mt-16 border-t border-border pt-8">
          <h2 className="font-display text-lg font-semibold text-cream">
            More from {article.category}
          </h2>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {related.map((r) => (
              <li key={r.slug}>
                <Link
                  href={`/blog/${r.slug}`}
                  className="block rounded-xl border border-border bg-surface/40 p-4 transition-colors hover:border-accent/50"
                >
                  <h3 className="text-sm font-semibold text-cream">
                    {r.title}
                  </h3>
                  <p className="mt-1 line-clamp-2 text-xs text-text-secondary">
                    {r.description}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
