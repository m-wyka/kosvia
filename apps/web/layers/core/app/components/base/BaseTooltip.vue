<script setup lang="ts">
defineProps<{ text: string }>();
const open = ref(false);
</script>

<template>
  <span
    class="relative inline-flex"
    @mouseenter="open = true"
    @mouseleave="open = false"
    @focusin="open = true"
    @focusout="open = false"
  >
    <slot />
    <Transition
      enter-active-class="transition-opacity duration-fast"
      leave-active-class="transition-opacity duration-fast"
      enter-from-class="opacity-0"
      leave-to-class="opacity-0"
    >
      <span
        v-if="open"
        role="tooltip"
        class="pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 w-max max-w-56 -translate-x-1/2 rounded-md bg-ink px-2.5 py-1.5 text-xs leading-snug text-ink-inverse shadow-md"
      >
        {{ text }}
      </span>
    </Transition>
  </span>
</template>
