/**
 * Core layer — everything the public product is made of.
 * Components, composables and stores declared here are available to the admin
 * layer too, which is the point: one design system, one API client.
 */
export default defineNuxtConfig({
  // Nuxt auto-imports `composables/` and `utils/` per layer, but not `stores/`.
  // Declaring it here (relative to this layer's srcDir) makes useAuthStore and
  // useCompareStore available everywhere, including the admin layer.
  imports: {
    dirs: ['./stores'],
  },

  components: [
    { path: './components/base', pathPrefix: false },
    { path: './components/product', pathPrefix: false },
    { path: './components/layout', pathPrefix: false },
    { path: './components/ai', pathPrefix: false },
    { path: './components', pathPrefix: false },
  ],
});
