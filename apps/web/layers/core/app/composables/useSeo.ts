import type { ProductDto } from '@kosvia/shared';

interface SeoOptions {
  title: string;
  description: string;
  path?: string;
  image?: string;
  type?: 'website' | 'article' | 'product';
  noindex?: boolean;
}

interface AlternateLink {
  rel: 'alternate';
  hreflang: string;
  href: string;
}

const DEFAULT_OG_IMAGE = '/og-default.svg';

const useSiteOrigin = (): string => {
  return useRuntimeConfig().public.siteUrl.replace(/\/$/, '');
};

export const useSeo = (options: SeoOptions | (() => SeoOptions)) => {
  const config = useRuntimeConfig();
  const route = useRoute();
  const { locale, locales, defaultLocale } = useI18n();
  const localePath = useLocalePath();
  const siteOrigin = useSiteOrigin();

  const resolved = computed(() => (typeof options === 'function' ? options() : options));

  const canonical = computed(() => {
    const path = resolved.value.path ? localePath(resolved.value.path) : route.path;
    return `${siteOrigin}${path}`;
  });

  const alternates = computed<AlternateLink[]>(() => {
    if (resolved.value.noindex) {
      return [];
    }
    const basePath = resolved.value.path ?? route.path;

    return locales.value.flatMap((entry) => {
      const href = `${siteOrigin}${localePath(basePath, entry.code)}`;
      const links: AlternateLink[] = [{ rel: 'alternate', hreflang: String(entry.code), href }];
      if (entry.code === defaultLocale) {
        links.push({ rel: 'alternate', hreflang: 'x-default', href });
      }
      return links;
    });
  });

  const image = computed(() => {
    const source = resolved.value.image ?? DEFAULT_OG_IMAGE;
    return source.startsWith('http') ? source : `${siteOrigin}${source}`;
  });

  const fullTitle = computed(() =>
    resolved.value.title === config.public.siteName
      ? resolved.value.title
      : `${resolved.value.title} · ${config.public.siteName}`,
  );

  useHead(() => ({
    title: resolved.value.title,
    htmlAttrs: { lang: String(locale.value) },
    link: [{ rel: 'canonical' as const, href: canonical.value }, ...alternates.value],
  }));

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
};

export const useProductJsonLd = (product: Ref<ProductDto | null | undefined>) => {
  const siteOrigin = useSiteOrigin();

  useHead(() => {
    const value = product.value;
    if (!value) {
      return {};
    }

    const offers = value.offers
      .filter((offer) => offer.availability !== 'OUT_OF_STOCK')
      .map((offer) => ({
        '@type': 'Offer',
        price: offer.price.toFixed(2),
        priceCurrency: offer.currency,
        availability: 'https://schema.org/InStock',
        url: offer.url ?? `${siteOrigin}/products/${value.slug}`,
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
            image: value.imageUrl ? `${siteOrigin}${value.imageUrl}` : undefined,
            brand: { '@type': 'Brand', name: value.brand.name },
            category: value.category.name,
            ...(offers.length ? { offers } : {}),
          }),
        },
      ],
    };
  });
};

export const useBreadcrumbJsonLd = (items: Ref<Array<{ name: string; path: string }>>) => {
  const siteOrigin = useSiteOrigin();

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
            item: `${siteOrigin}${item.path}`,
          })),
        }),
      },
    ],
  }));
};
