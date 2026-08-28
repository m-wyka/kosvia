/**
 * Guards pages that need a session. Remembers where the user was heading so
 * signing in returns them there instead of dumping them on the home page.
 */
export default defineNuxtRouteMiddleware(async (to) => {
  const auth = useAuthStore();
  await auth.init();

  if (!auth.isAuthenticated) {
    return navigateTo({ path: '/login', query: { redirect: to.fullPath } });
  }
});
