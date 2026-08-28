const LOCALE_PREFIXES = ['', '/pl'];
const PRIVATE_PATHS = [
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

export default defineEventHandler((event) => {
  const { public: config } = useRuntimeConfig(event);
  setHeader(event, 'content-type', 'text/plain; charset=utf-8');

  return [
    'User-agent: *',
    'Allow: /',
    ...LOCALE_PREFIXES.flatMap((prefix) => PRIVATE_PATHS.map((path) => `Disallow: ${prefix}${path}`)),
    '',
    `Sitemap: ${config.siteUrl}/sitemap.xml`,
    '',
  ].join('\n');
});
