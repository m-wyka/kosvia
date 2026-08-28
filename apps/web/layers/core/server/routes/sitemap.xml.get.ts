interface SitemapEntry {
  loc: string;
  changefreq: string;
  priority: string;
  lastmod?: string;
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
    { loc: `${site}/`, changefreq: 'weekly', priority: '1.0' },
    { loc: `${site}/discover`, changefreq: 'daily', priority: '0.9' },
    { loc: `${site}/products`, changefreq: 'daily', priority: '0.9' },
    { loc: `${site}/ingredients`, changefreq: 'weekly', priority: '0.6' },
    { loc: `${site}/compare`, changefreq: 'monthly', priority: '0.5' },
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
      entries.push({ loc: `${site}/products?category=${slug}`, changefreq: 'weekly', priority: '0.7' });
    }
    for (const brand of brands) {
      entries.push({ loc: `${site}/products?brand=${brand.slug}`, changefreq: 'weekly', priority: '0.6' });
    }

    let page = 1;
    let pageCount = 1;
    do {
      const result = await $fetch<{
        items: Array<{ slug: string }>;
        pageCount: number;
      }>('/products', { baseURL: config.apiInternalUrl, query: { page, pageSize: 60 } });

      for (const product of result.items) {
        entries.push({ loc: `${site}/products/${product.slug}`, changefreq: 'weekly', priority: '0.8' });
      }
      pageCount = result.pageCount;
      page += 1;
      // Bound the walk so a very large catalogue cannot stall the response.
    } while (page <= pageCount && page <= 50);
  } catch {
    // Static pages only — a partial sitemap beats a broken one.
  }

  const urls = entries
    .map(
      (entry) =>
        `  <url><loc>${escapeXml(entry.loc)}</loc><changefreq>${entry.changefreq}</changefreq><priority>${entry.priority}</priority></url>`,
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
});

function escapeXml(value: string): string {
  return value.replace(/[<>&'"]/g, (char) =>
    ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[char] as string,
  );
}
