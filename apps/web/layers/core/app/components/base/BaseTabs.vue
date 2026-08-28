<script setup lang="ts">
const model = defineModel<string>({ required: true });

defineProps<{ tabs: Array<{ value: string; label: string; count?: number }> }>();
</script>

<template>
  <div
    class="hide-scrollbar -mx-1 flex gap-1 overflow-x-auto rounded-pill bg-surface-muted p-1"
    role="tablist"
  >
    <button
      v-for="tab in tabs"
      :key="tab.value"
      type="button"
      role="tab"
      :aria-selected="model === tab.value"
      class="flex shrink-0 items-center gap-1.5 rounded-pill px-4 py-2 text-sm font-medium
             transition-all duration-[--duration-fast]"
      :class="
        model === tab.value
          ? 'bg-surface text-ink shadow-xs'
          : 'text-ink-muted hover:text-ink-soft'
      "
      @click="model = tab.value"
    >
      {{ tab.label }}
      <span v-if="tab.count !== undefined" class="text-xs text-ink-faint">{{ tab.count }}</span>
    </button>
  </div>
</template>
