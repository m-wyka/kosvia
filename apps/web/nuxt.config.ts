import tailwindcss from '@tailwindcss/vite';

const DEFAULT_API_URL = 'http://localhost:3001';
const DEFAULT_SITE_URL = 'http://localhost:3000';

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  future: { compatibilityVersion: 4 },

  extends: ['./layers/core', './layers/admin'],

  modules: ['@pinia/nuxt', '@vueuse/nuxt', '@nuxt/eslint', '@nuxtjs/i18n'],

  i18n: {
    locales: [
      { code: 'en', language: 'en-GB', name: 'English', file: 'en.json' },
      { code: 'pl', language: 'pl-PL', name: 'Polski', file: 'pl.json' },
    ],
    defaultLocale: 'pl',
    vueI18n: './i18n.config.ts',
    strategy: 'prefix_except_default',
    detectBrowserLanguage: {
      useCookie: true,
      cookieKey: 'kosvia_locale',
      cookieCrossOrigin: false,
      redirectOn: 'root',
      alwaysRedirect: false,
      fallbackLocale: 'pl',
    },
  },

  // Polish moved from /pl/* to the root; keep old links and any indexed URLs alive.
  routeRules: {
    '/pl': { redirect: { to: '/', statusCode: 301 } },
    '/pl/**': { redirect: { to: '/**', statusCode: 301 } },
  },

  ssr: true,

  // Nuxt 4 defaults buildDir to node_modules/.cache/nuxt/.nuxt, where the generated
  // tsconfigs exclude their own directory and silently break `nuxt typecheck`.
  buildDir: '.nuxt',

  css: ['~~/layers/core/app/assets/css/main.css'],

  vite: {
    plugins: [tailwindcss()],
  },

  runtimeConfig: {
    apiInternalUrl: process.env.API_INTERNAL_URL || process.env.API_URL || DEFAULT_API_URL,
    public: {
      apiBase: process.env.API_URL || DEFAULT_API_URL,
      siteUrl: process.env.FRONTEND_URL || DEFAULT_SITE_URL,
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
