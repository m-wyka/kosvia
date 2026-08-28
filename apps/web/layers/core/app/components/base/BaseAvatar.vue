<script setup lang="ts">
const props = withDefaults(defineProps<{ name?: string | null; size?: number }>(), { size: 36 });

const initials = computed(() => {
  const source = props.name?.trim();
  if (!source) {return '?';}
  const parts = source.split(/\s+/).filter(Boolean);
  const initialsFromWords = parts.length > 1 ? `${parts[0]?.[0] ?? ''}${parts[1]?.[0] ?? ''}` : '';
  return (initialsFromWords || source.slice(0, 2)).toUpperCase();
});
</script>

<template>
  <span
    class="inline-flex shrink-0 items-center justify-center rounded-full bg-blush-soft
           font-medium text-blush-deep select-none"
    :style="{ width: `${size}px`, height: `${size}px`, fontSize: `${size * 0.36}px` }"
    aria-hidden="true"
  >
    {{ initials }}
  </span>
</template>
