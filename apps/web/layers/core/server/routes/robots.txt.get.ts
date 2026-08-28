/**
 * robots.txt.
 *
 * Product and discovery pages are the SEO surface; anything behind auth or in
 * the admin panel is excluded — those pages have no value in an index and
 * would only leak the shape of the back office.
 */
export default defineEventHandler((event) => {
  const { public: config } = useRuntimeConfig(event);
  setHeader(event, 'content-type', 'text/plain; charset=utf-8');

  return [
    'User-agent: *',
    'Allow: /',
    'Disallow: /admin',
    'Disallow: /dashboard',
    'Disallow: /shelf',
    'Disallow: /profile',
    'Disallow: /onboarding',
    'Disallow: /ai',
    'Disallow: /price-alerts',
    'Disallow: /login',
    'Disallow: /register',
    '',
    `Sitemap: ${config.siteUrl}/sitemap.xml`,
    '',
  ].join('\n');
});
