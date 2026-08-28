import { fileURLToPath } from 'node:url';
import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vitest/config';

/**
 * Component tests run against the real single-file components with
 * @vue/test-utils. Nuxt's auto-imported composables are provided as globals in
 * `tests/setup.ts` — see the note there for why this is preferred over running
 * a full Nuxt environment for what are, in the end, unit tests.
 */
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '~': fileURLToPath(new URL('./layers/core/app', import.meta.url)),
      '@kosvia/shared': fileURLToPath(new URL('../../packages/shared/src/index.ts', import.meta.url)),
    },
  },
  test: {
    include: ['tests/**/*.spec.ts'],
    environment: 'happy-dom',
    setupFiles: ['./tests/setup.ts'],
    restoreMocks: true,
  },
});
