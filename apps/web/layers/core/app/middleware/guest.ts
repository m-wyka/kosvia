export default defineNuxtRouteMiddleware(async () => {
  const { isAuthenticated } = storeToRefs(useAuthStore());
  const { init } = useAuthStore();
  await init();

  if (isAuthenticated.value) {
    const localePath = useLocalePath();
    return navigateTo(localePath('/dashboard'));
  }
});
