import type { ProductDto } from '@kosvia/shared';

interface SeoOptions {
  title: string;
  description: string;
  /** Path only, e.g. `/products/some-slug`. */
  path?: string;
  image?: string;
  type?: 'website' | 'article' | 'product';
  noindex?: boolean;
}

/**
 * One place that owns page metadata: title, description, canonical URL, Open
 * Graph and Twitter cards. Every page calls this rather than hand-rolling
 * useHead, so no page can quietly ship without a canonical or a description.
 */
export function useSeo(options: SeoOptions | (() => SeoOptions)) {
  const config = useRuntimeConfig();
  const route = useRoute();
  const { locale, locales, defaultLocale } = useI18n();
  const localePath = useLocalePath();
  const site = config.public.siteUrl.replace(/\/$/, '');

  const resolved = computed(() => (typeof options === 'function' ? options() : options));

  /**
   * The canonical points at the *current locale's* URL, not the English one:
   * /pl/products and /products are separate pages, each canonical to itself.
   * `path` is given unprefixed by callers, so it is localised here.
   */
  const canonical = computed(() => {
    const path = resolved.value.path ? localePath(resolved.value.path) : route.path;
    return `${site}${path}`;
  });

  /**
   * hreflang alternates, so search engines pair the two languages instead of
   * treating them as duplicates. `x-default` points at the default locale.
   */
  const alternates = computed<Array<{ rel: 'alternate'; hreflang: string; href: string }>>(() => {
    if (resolved.value.noindex) return [];
    const basePath = resolved.value.path ?? route.path;

    return locales.value.flatMap((entry) => {
      const href = `${site}${localePath(basePath, entry.code)}`;
      const links: Array<{ rel: 'alternate'; hreflang: string; href: string }> = [
        { rel: 'alternate', hreflang: String(entry.code), href },
      ];
      if (entry.code === defaultLocale) {
        links.push({ rel: 'alternate', hreflang: 'x-default', href });
      }
      return links;
    });
  });
  const image = computed(() => {
    const raw = resolved.value.image ?? '/og-default.svg';
    return raw.startsWith('http') ? raw : `${site}${raw}`;
  });
  const fullTitle = computed(() =>
    resolved.value.title === config.public.siteName
      ? resolved.value.title
      : `${resolved.value.title} · ${config.public.siteName}`,
  );

  useHead(() => ({
    title: resolved.value.title,
    htmlAttrs: { lang: String(locale.value) },
    // Canonical plus one alternate per locale, built above.
    link: [{ rel: 'canonical' as const, href: canonical.value }, ...alternates.value],
  }));

  // The title template lives in app.vue — setting it here too would apply it twice.
  useSeoMeta({
    description: () => resolved.value.description,
    robots: () => (resolved.value.noindex ? 'noindex, nofollow' : 'index, follow'),

    ogType: () => (resolved.value.type ?? 'website') as 'website',
    ogTitle: () => fullTitle.value,
    ogDescription: () => resolved.value.description,
    ogUrl: () => canonical.value,
    ogImage: () => image.value,
    ogSiteName: config.public.siteName,
    ogLocale: () => (locale.value === 'pl' ? 'pl_PL' : 'en_GB'),

    twitterCard: 'summary_large_image',
    twitterTitle: () => fullTitle.value,
    twitterDescription: () => resolved.value.description,
    twitterImage: () => image.value,
  });
}

/** Product structured data, so search results can show price and brand. */
export function useProductJsonLd(product: Ref<ProductDto | null | undefined>) {
  const config = useRuntimeConfig();
  const site = config.public.siteUrl.replace(/\/$/, '');

  useHead(() => {
    const value = product.value;
    if (!value) return {};

    const offers = value.offers
      .filter((offer) => offer.availability !== 'OUT_OF_STOCK')
      .map((offer) => ({
        '@type': 'Offer',
        price: offer.price.toFixed(2),
        priceCurrency: offer.currency,
        availability: 'https://schema.org/InStock',
        url: offer.url ?? `${site}/products/${value.slug}`,
        seller: { '@type': 'Organization', name: offer.store.name },
      }));

    return {
      script: [
        {
          type: 'application/ld+json',
          innerHTML: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Product',
            name: `${value.brand.name} ${value.name}`,
            description: value.description ?? undefined,
            sku: value.id,
            gtin13: value.ean ?? undefined,
            image: value.imageUrl ? `${site}${value.imageUrl}` : undefined,
            brand: { '@type': 'Brand', name: value.brand.name },
            category: value.category.name,
            ...(offers.length ? { offers } : {}),
          }),
        },
      ],
    };
  });
}

/** Breadcrumb structured data for category and product pages. */
export function useBreadcrumbJsonLd(items: Ref<Array<{ name: string; path: string }>>) {
  const config = useRuntimeConfig();
  const site = config.public.siteUrl.replace(/\/$/, '');

  useHead(() => ({
    script: [
      {
        type: 'application/ld+json',
        innerHTML: JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: items.value.map((item, index) => ({
            '@type': 'ListItem',
            position: index + 1,
            name: item.name,
            item: `${site}${item.path}`,
          })),
        }),
      },
    ],
  }));
}
