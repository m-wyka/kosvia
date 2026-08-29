export default defineNuxtConfig({
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
