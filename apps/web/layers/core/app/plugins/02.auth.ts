/**
 * Resolves the session before the first render, so SSR output matches what the
 * user should actually see instead of flashing a signed-out header.
 */
export default defineNuxtPlugin(async () => {
  await useAuthStore().init();
});
