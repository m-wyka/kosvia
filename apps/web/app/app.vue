<script setup lang="ts">
const config = useRuntimeConfig();

const withSiteName = (pageTitle?: string | null): string => {
  const siteName = config.public.siteName;
  if (!pageTitle) {
    return siteName;
  }
  return pageTitle.includes(siteName) ? pageTitle : `${pageTitle} · ${siteName}`;
};

useHead({ titleTemplate: withSiteName });
</script>

<template>
  <div>
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
    <BaseToaster />
  </div>
</template>
