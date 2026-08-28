export default defineNuxtRouteMiddleware(async (to) => {
  const { isAuthenticated } = storeToRefs(useAuthStore());
  const { init } = useAuthStore();
  await init();

  if (!isAuthenticated.value) {
    const localePath = useLocalePath();
    return navigateTo({ path: localePath('/login'), query: { redirect: to.fullPath } });
  }
});
