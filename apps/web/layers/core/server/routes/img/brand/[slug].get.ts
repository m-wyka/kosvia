import { monogramSvg } from '../../../utils/placeholder';

// Nitro cannot bind a route param that is only part of a segment (`[slug].svg`),
// so the extension is stripped here instead: https://github.com/nitrojs/nitro/issues/1200
export default defineEventHandler((event) => {
  const slug = (getRouterParam(event, 'slug') ?? 'brand').replace(/\.svg$/, '');
  setHeader(event, 'content-type', 'image/svg+xml; charset=utf-8');
  setHeader(event, 'cache-control', 'public, max-age=31536000, immutable');
  return monogramSvg(slug.replace(/-/g, ' '), slug);
});
