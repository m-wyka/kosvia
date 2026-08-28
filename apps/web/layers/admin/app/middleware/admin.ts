/**
 * Admin access control.
 *
 * The API enforces this too — the guard here exists so a non-admin gets a
 * useful redirect instead of a screen full of 403s.
 */
export default defineNuxtRouteMiddleware(async (to) => {
  const auth = useAuthStore();
  await auth.init();

  if (!auth.isAuthenticated) {
    return navigateTo({ path: '/login', query: { redirect: to.fullPath } });
  }
  if (!auth.isAdmin) {
    return navigateTo('/dashboard');
  }
});
