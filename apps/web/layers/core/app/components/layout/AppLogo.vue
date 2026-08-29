<script setup lang="ts">
withDefaults(defineProps<{ size?: number }>(), { size: 26 });
</script>

<template>
  <div class="flex items-center">
    <img class="w-28" src="/images/logo.png" alt="Kosvia" />
  </div>
</template>
