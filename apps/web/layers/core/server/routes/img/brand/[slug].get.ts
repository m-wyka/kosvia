import { monogramSvg } from '../../../utils/placeholder';

/**
 * The filename is `[slug].get.ts`, not `[slug].svg.get.ts`: Nitro cannot bind a
 * route parameter that is only part of a path segment, so the `.svg` variant
 * silently yielded an undefined slug and every product rendered the same
 * fallback illustration. The extension is stripped from the parameter instead.
 */
export default defineEventHandler((event) => {
  const slug = (getRouterParam(event, 'slug') ?? 'brand').replace(/\.svg$/, '');
  setHeader(event, 'content-type', 'image/svg+xml; charset=utf-8');
  setHeader(event, 'cache-control', 'public, max-age=31536000, immutable');
  return monogramSvg(slug.replace(/-/g, ' '), slug);
});
