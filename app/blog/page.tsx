import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { ARTICLES } from "@/lib/blog/articles";
import { BreadcrumbJsonLd } from "@/components/seo/BreadcrumbJsonLd";
import { SITE_NAME, SITE_URL } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Blog — Movbox",
  description:
    "News, guides, and editor's picks from the Movbox team. K-dramas, 4K streaming, the best of the catalog — all free.",
  alternates: { canonical: `${SITE_URL}/blog` },
  openGraph: {
    title: "Movbox Blog",
    description:
      "News, guides, and editor's picks from the Movbox team. K-dramas, 4K streaming, the best of the catalog — all free.",
    url: `${SITE_URL}/blog`,
    siteName: SITE_NAME,
    type: "website",
  },
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function BlogIndexPage() {
  // Newest first.
  const articles = [...ARTICLES].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );

  return (
    <div className="mx-auto max-w-5xl px-4 pb-16 pt-24 md:px-6 lg:px-8">
      <BreadcrumbJsonLd
        items={[
          { name: "Home", path: "/" },
          { name: "Blog", path: "/blog" },
        ]}
      />

      <header className="mb-10">
        <h1 className="font-display text-3xl font-bold text-cream md:text-4xl">
          Movbox Blog
        </h1>
        <p className="mt-2 text-sm text-text-secondary md:text-base">
          News, guides, and editor's picks. Fresh content signals to Google
          mean better rankings for the site, so we publish regularly.
        </p>
      </header>

      <ul className="grid gap-6 md:grid-cols-2">
        {articles.map((article) => (
          <li key={article.slug}>
            <Link
              href={`/blog/${article.slug}`}
              className="group block h-full overflow-hidden rounded-2xl border border-border bg-surface/40 transition-all hover:border-accent/50 hover:bg-surface/60"
            >
              {article.image && (
                <div className="relative aspect-video w-full overflow-hidden bg-bg-deepest">
                  <Image
                    src={article.image}
                    alt={article.title}
                    fill
                    sizes="(max-width: 768px) 100vw, 50vw"
                    className="object-cover transition-transform group-hover:scale-105"
                  />
                  <span className="absolute left-3 top-3 inline-flex items-center rounded-full bg-bg-deepest/85 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-accent-bright backdrop-blur">
                    {article.category}
                  </span>
                </div>
              )}
              <div className="p-5">
                <h2 className="font-display text-lg font-semibold text-cream transition-colors group-hover:text-accent-bright md:text-xl">
                  {article.title}
                </h2>
                <p className="mt-2 line-clamp-2 text-sm text-text-secondary">
                  {article.description}
                </p>
                <div className="mt-4 flex items-center gap-3 text-xs text-text-muted">
                  <span>{article.author}</span>
                  <span>·</span>
                  <time dateTime={article.date}>
                    {formatDate(article.date)}
                  </time>
                  <span>·</span>
                  <span>{article.readingTime} min read</span>
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
