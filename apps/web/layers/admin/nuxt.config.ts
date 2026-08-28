/**
 * Admin layer — the operator back office.
 * Its components are prefixed `Admin*` so they never collide with the public UI.
 */
export default defineNuxtConfig({
  components: [{ path: './components', prefix: 'Admin' }],
});
