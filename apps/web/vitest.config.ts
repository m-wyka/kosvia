import { fileURLToPath } from 'node:url';
import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '~': fileURLToPath(new URL('./layers/core/app', import.meta.url)),
      '@kosvia/shared': fileURLToPath(
        new URL('../../packages/shared/src/index.ts', import.meta.url),
      ),
    },
  },
  test: {
    include: ['tests/**/*.spec.ts'],
    environment: 'happy-dom',
    setupFiles: ['./tests/setup.ts'],
    restoreMocks: true,
  },
});
