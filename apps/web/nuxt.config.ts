import tailwindcss from '@tailwindcss/vite';

/**
 * Root Nuxt configuration.
 *
 * The application is split into two layers (see `layers/`):
 *   core  — the public product: landing, discovery, product pages, shelf, AI
 *   admin — the operator back office, with its own layout and access control
 *
 * Shared base components live in `core` and are auto-imported by both, so
 * BaseButton, ProductCard and friends are never duplicated.
 */
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  future: { compatibilityVersion: 4 },

  extends: ['./layers/core', './layers/admin'],

  modules: ['@pinia/nuxt', '@vueuse/nuxt', '@nuxt/eslint', '@nuxtjs/i18n'],

  /**
   * Two locales, each with its own URL space.
   *
   * `prefix_except_default` keeps English on the clean paths and puts Polish
   * under /pl — so both languages are separately indexable, which matters for a
   * catalogue this content-heavy. A single shared URL would mean Google only
   * ever sees one of them.
   *
   * Browser detection redirects only from the site root: deep links must keep
   * pointing at the language they were shared in, and redirecting everywhere
   * makes locale switching fight the detector.
   */
  i18n: {
    locales: [
      { code: 'en', language: 'en-GB', name: 'English', file: 'en.json' },
      { code: 'pl', language: 'pl-PL', name: 'Polski', file: 'pl.json' },
    ],
    defaultLocale: 'en',
    vueI18n: './i18n.config.ts',
    strategy: 'prefix_except_default',
    detectBrowserLanguage: {
      useCookie: true,
      cookieKey: 'kosvia_locale',
      cookieCrossOrigin: false,
      redirectOn: 'root',
      alwaysRedirect: false,
      fallbackLocale: 'en',
    },
  },

  ssr: true,

  // Nuxt 4 defaults buildDir to node_modules/.cache/nuxt/.nuxt, where the
  // generated tsconfigs exclude their own directory — which silently breaks
  // `nuxt typecheck`. Keeping the build output alongside the app avoids that.
  buildDir: '.nuxt',

  css: ['~~/layers/core/app/assets/css/main.css'],

  vite: {
    plugins: [tailwindcss()],
  },

  runtimeConfig: {
    // Server-only: used for SSR fetches, so it can point at an internal host.
    apiInternalUrl: process.env.API_INTERNAL_URL || process.env.API_URL || 'http://localhost:3001',
    public: {
      apiBase: process.env.API_URL || 'http://localhost:3001',
      siteUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
      siteName: 'Kosvia',
    },
  },

  app: {
    head: {
      htmlAttrs: { lang: 'en' },
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
        { name: 'theme-color', content: '#FAF7F4' },
      ],
      link: [{ rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }],
    },
    pageTransition: { name: 'page', mode: 'out-in' },
  },

  nitro: {
    compressPublicAssets: true,
  },

  typescript: {
    strict: true,
  },

  devtools: { enabled: true },
});
