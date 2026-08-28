import { escapeXmlText } from '../utils/placeholder';

interface SitemapEntry {
  path: string;
  changefreq: string;
  priority: string;
}

interface CategoryNode {
  slug: string;
  children?: CategoryNode[];
}

const LOCALES = ['en', 'pl'] as const;
const DEFAULT_LOCALE = 'en';
const PRODUCTS_PAGE_SIZE = 60;
const MAX_PRODUCT_PAGES = 50;
const CACHE_MAX_AGE_SECONDS = 3600;

const STATIC_ENTRIES: SitemapEntry[] = [
  { path: '/', changefreq: 'weekly', priority: '1.0' },
  { path: '/discover', changefreq: 'daily', priority: '0.9' },
  { path: '/products', changefreq: 'daily', priority: '0.9' },
  { path: '/ingredients', changefreq: 'weekly', priority: '0.6' },
  { path: '/compare', changefreq: 'monthly', priority: '0.5' },
];

const localise = (path: string, locale: string): string => {
  if (locale === DEFAULT_LOCALE) {
    return path;
  }
  return path === '/' ? `/${locale}` : `/${locale}${path}`;
};

const flattenSlugs = (nodes: CategoryNode[]): string[] => {
  return nodes.flatMap((node) => [node.slug, ...flattenSlugs(node.children ?? [])]);
};

const fetchCatalogueEntries = async (apiBaseUrl: string): Promise<SitemapEntry[]> => {
  const entries: SitemapEntry[] = [];
  const [categories, brands] = await Promise.all([
    $fetch<CategoryNode[]>('/categories', { baseURL: apiBaseUrl }),
    $fetch<Array<{ slug: string }>>('/brands', { baseURL: apiBaseUrl }),
  ]);

  for (const slug of flattenSlugs(categories)) {
    entries.push({ path: `/products?category=${slug}`, changefreq: 'weekly', priority: '0.7' });
  }
  for (const brand of brands) {
    entries.push({ path: `/products?brand=${brand.slug}`, changefreq: 'weekly', priority: '0.6' });
  }

  let page = 1;
  let pageCount = 1;
  do {
    const result = await $fetch<{ items: Array<{ slug: string }>; pageCount: number }>(
      '/products',
      { baseURL: apiBaseUrl, query: { page, pageSize: PRODUCTS_PAGE_SIZE } },
    );
    for (const product of result.items) {
      entries.push({ path: `/products/${product.slug}`, changefreq: 'weekly', priority: '0.8' });
    }
    pageCount = result.pageCount;
    page += 1;
  } while (page <= pageCount && page <= MAX_PRODUCT_PAGES);

  return entries;
};

const renderUrl = (siteOrigin: string, entry: SitemapEntry, locale: string): string => {
  const alternates = LOCALES.map(
    (other) =>
      `    <xhtml:link rel="alternate" hreflang="${other}" href="${escapeXmlText(`${siteOrigin}${localise(entry.path, other)}`)}"/>`,
  ).join('\n');

  return [
    '  <url>',
    `    <loc>${escapeXmlText(`${siteOrigin}${localise(entry.path, locale)}`)}</loc>`,
    alternates,
    `    <xhtml:link rel="alternate" hreflang="x-default" href="${escapeXmlText(`${siteOrigin}${localise(entry.path, DEFAULT_LOCALE)}`)}"/>`,
    `    <changefreq>${entry.changefreq}</changefreq>`,
    `    <priority>${entry.priority}</priority>`,
    '  </url>',
  ].join('\n');
};

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event);
  const siteOrigin = config.public.siteUrl.replace(/\/$/, '');
  setHeader(event, 'content-type', 'application/xml; charset=utf-8');
  setHeader(event, 'cache-control', `public, max-age=${CACHE_MAX_AGE_SECONDS}`);

  const entries = [...STATIC_ENTRIES];
  try {
    entries.push(...(await fetchCatalogueEntries(config.apiInternalUrl)));
  } catch {
    entries.splice(STATIC_ENTRIES.length);
  }

  const urls = entries
    .flatMap((entry) => LOCALES.map((locale) => renderUrl(siteOrigin, entry, locale)))
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls}\n</urlset>\n`;
});
