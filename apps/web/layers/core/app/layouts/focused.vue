<script setup lang="ts">
/** Distraction-free shell for auth and onboarding — no nav, no footer. */
</script>

<template>
  <div class="flex min-h-dvh flex-col bg-canvas">
    <header class="container-page flex h-16 shrink-0 items-center justify-between">
      <NuxtLink to="/" aria-label="Kosvia home"><AppLogo /></NuxtLink>
      <slot name="header-action" />
    </header>
    <main class="container-page flex flex-1 items-center justify-center py-8">
      <slot />
    </main>
  </div>
</template>
