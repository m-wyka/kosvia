<script setup lang="ts">
const config = useRuntimeConfig();

// Pages set a plain title; the site name is appended here, once, and skipped
// when the page has already named the brand itself.
useHead({
  titleTemplate: (chunk) => {
    const site = config.public.siteName;
    if (!chunk) return site;
    return chunk.includes(site) ? chunk : `${chunk} · ${site}`;
  },
});
</script>

<template>
  <div>
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
    <BaseToaster />
  </div>
</template>
