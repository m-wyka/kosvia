/** Keeps signed-in users off the login and register pages. */
export default defineNuxtRouteMiddleware(async () => {
  const auth = useAuthStore();
  await auth.init();
  if (auth.isAuthenticated) return navigateTo(useLocalePath()('/dashboard'));
});
