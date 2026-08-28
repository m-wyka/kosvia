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

  // Private areas exist under every locale prefix, so each rule is emitted once
  // per locale — /shelf and /pl/shelf are different URLs to a crawler.
  const localePrefixes = ['', '/pl'];
  const privatePaths = [
    '/admin',
    '/dashboard',
    '/shelf',
    '/profile',
    '/onboarding',
    '/ai',
    '/price-alerts',
    '/login',
    '/register',
  ];

  return [
    'User-agent: *',
    'Allow: /',
    ...localePrefixes.flatMap((prefix) =>
      privatePaths.map((path) => `Disallow: ${prefix}${path}`),
    ),
    '',
    `Sitemap: ${config.siteUrl}/sitemap.xml`,
    '',
  ].join('\n');
});
