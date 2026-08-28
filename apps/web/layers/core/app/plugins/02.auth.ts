export default defineNuxtPlugin(async () => {
  const { init } = useAuthStore();
  await init();
});
