<script setup lang="ts">
/** Search + pagination bar shared by every admin list. */
const search = defineModel<string>('search', { default: '' });

defineProps<{ page: number; pageCount: number; total?: number; placeholder?: string }>();
defineEmits<{ 'update:page': [value: number] }>();
</script>

<template>
  <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
    <div class="relative w-full max-w-xs">
      <BaseIcon
        name="search"
        :size="16"
        class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-faint"
      />
      <input
        v-model="search"
        type="search"
        :placeholder="placeholder ?? 'Search…'"
        class="h-10 w-full rounded-lg border border-line bg-surface pr-3 pl-9 text-sm
               placeholder:text-ink-faint transition-colors hover:border-line-strong"
      >
    </div>

    <div v-if="pageCount > 1" class="flex items-center gap-2">
      <span class="text-xs tabular-nums text-ink-muted">
        Page {{ page }} of {{ pageCount }}<template v-if="total"> · {{ total }} total</template>
      </span>
      <BaseButton variant="secondary" size="sm" :disabled="page <= 1" @click="$emit('update:page', page - 1)">
        <BaseIcon name="chevron-left" :size="15" />
      </BaseButton>
      <BaseButton variant="secondary" size="sm" :disabled="page >= pageCount" @click="$emit('update:page', page + 1)">
        <BaseIcon name="chevron-right" :size="15" />
      </BaseButton>
    </div>
  </div>
</template>
