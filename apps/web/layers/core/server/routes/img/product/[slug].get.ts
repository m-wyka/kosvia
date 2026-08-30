import { productImageSvg } from '@@/layers/core/server/utils/placeholder';

// Nitro cannot bind a route param that is only part of a path segment (`[slug].svg.get.ts`),
// so the extension is stripped from the parameter instead.
export default defineEventHandler((event) => {
  const slug = (getRouterParam(event, 'slug') ?? 'product').replace(/\.svg$/, '');
  setHeader(event, 'content-type', 'image/svg+xml; charset=utf-8');
  setHeader(event, 'cache-control', 'public, max-age=31536000, immutable');
  return productImageSvg(slug);
});
