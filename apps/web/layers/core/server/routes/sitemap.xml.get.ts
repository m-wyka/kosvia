interface SitemapEntry {
  /** Locale-independent path, e.g. `/products/some-slug`. */
  path: string;
  changefreq: string;
  priority: string;
}

/** `en` lives on the bare path; every other locale is prefixed. */
const LOCALES = ['en', 'pl'] as const;
const DEFAULT_LOCALE = 'en';

function localise(path: string, locale: string): string {
  if (locale === DEFAULT_LOCALE) return path;
  return path === '/' ? `/${locale}` : `/${locale}${path}`;
}

/**
 * Sitemap built from the live catalogue.
 *
 * It walks the products endpoint page by page rather than guessing at URLs, so
 * it stays correct as the catalogue grows. If the API is unreachable we still
 * return a valid sitemap of the static pages instead of a 500.
 */
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event);
  const site = config.public.siteUrl.replace(/\/$/, '');
  setHeader(event, 'content-type', 'application/xml; charset=utf-8');
  setHeader(event, 'cache-control', 'public, max-age=3600');

  const entries: SitemapEntry[] = [
    { path: '/', changefreq: 'weekly', priority: '1.0' },
    { path: '/discover', changefreq: 'daily', priority: '0.9' },
    { path: '/products', changefreq: 'daily', priority: '0.9' },
    { path: '/ingredients', changefreq: 'weekly', priority: '0.6' },
    { path: '/compare', changefreq: 'monthly', priority: '0.5' },
  ];

  try {
    const [categories, brands] = await Promise.all([
      $fetch<Array<{ slug: string; children?: Array<{ slug: string }> }>>('/categories', {
        baseURL: config.apiInternalUrl,
      }),
      $fetch<Array<{ slug: string }>>('/brands', { baseURL: config.apiInternalUrl }),
    ]);

    const flatten = (nodes: Array<{ slug: string; children?: Array<{ slug: string }> }>): string[] =>
      nodes.flatMap((node) => [node.slug, ...flatten((node.children ?? []) as never)]);

    for (const slug of flatten(categories)) {
      entries.push({ path: `/products?category=${slug}`, changefreq: 'weekly', priority: '0.7' });
    }
    for (const brand of brands) {
      entries.push({ path: `/products?brand=${brand.slug}`, changefreq: 'weekly', priority: '0.6' });
    }

    let page = 1;
    let pageCount = 1;
    do {
      const result = await $fetch<{
        items: Array<{ slug: string }>;
        pageCount: number;
      }>('/products', { baseURL: config.apiInternalUrl, query: { page, pageSize: 60 } });

      for (const product of result.items) {
        entries.push({ path: `/products/${product.slug}`, changefreq: 'weekly', priority: '0.8' });
      }
      pageCount = result.pageCount;
      page += 1;
      // Bound the walk so a very large catalogue cannot stall the response.
    } while (page <= pageCount && page <= 50);
  } catch {
    // Static pages only — a partial sitemap beats a broken one.
  }

  // One <url> per locale, each carrying xhtml:link alternates for the others —
  // that is what tells a crawler the two are translations, not duplicates.
  const urls = entries
    .flatMap((entry) =>
      LOCALES.map((locale) => {
        const alternates = LOCALES.map(
          (other) =>
            `    <xhtml:link rel="alternate" hreflang="${other}" href="${escapeXml(`${site}${localise(entry.path, other)}`)}"/>`,
        ).join('\n');

        return [
          '  <url>',
          `    <loc>${escapeXml(`${site}${localise(entry.path, locale)}`)}</loc>`,
          alternates,
          `    <xhtml:link rel="alternate" hreflang="x-default" href="${escapeXml(`${site}${localise(entry.path, DEFAULT_LOCALE)}`)}"/>`,
          `    <changefreq>${entry.changefreq}</changefreq>`,
          `    <priority>${entry.priority}</priority>`,
          '  </url>',
        ].join('\n');
      }),
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls}\n</urlset>\n`;
});

function escapeXml(value: string): string {
  return value.replace(/[<>&'"]/g, (char) =>
    ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[char] as string,
  );
}
