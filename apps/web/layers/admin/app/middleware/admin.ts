export default defineNuxtRouteMiddleware(async (to) => {
  const { isAuthenticated, isAdmin } = storeToRefs(useAuthStore());
  const { init } = useAuthStore();
  await init();

  const localePath = useLocalePath();

  if (!isAuthenticated.value) {
    return navigateTo({ path: localePath('/login'), query: { redirect: to.fullPath } });
  }
  if (!isAdmin.value) {
    return navigateTo(localePath('/dashboard'));
  }
});
