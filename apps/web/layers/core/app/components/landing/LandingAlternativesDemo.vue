<script setup lang="ts">
const options = [
  { label: 'You are viewing', name: 'Noctura Ceramide Barrier Cream', price: '135,99 PLN', match: 84, tone: 'neutral' as const },
  { label: 'Cheaper', name: 'Terravera Ceramide Barrier Cream', price: '40,99 PLN', match: 90, tone: 'sage' as const },
  { label: 'Better value', name: 'Junipair Oil-Free Gel Cream', price: '26,99 PLN', match: 88, tone: 'lavender' as const },
];
</script>

<template>
  <div class="space-y-3">
    <div
      v-for="option in options"
      :key="option.name"
      class="flex items-center gap-4 rounded-xl border bg-surface p-4 shadow-xs"
      :class="option.tone === 'neutral' ? 'border-line' : 'border-line-strong'"
    >
      <span
        class="flex size-11 shrink-0 items-center justify-center rounded-lg text-sm font-semibold tabular-nums"
        :class="{
          'bg-surface-muted text-ink-muted': option.tone === 'neutral',
          'bg-sage-soft text-sage': option.tone === 'sage',
          'bg-lavender-soft text-lavender': option.tone === 'lavender',
        }"
      >{{ option.match }}</span>
      <div class="min-w-0 flex-1">
        <p class="text-2xs font-semibold tracking-wide text-ink-faint uppercase">{{ option.label }}</p>
        <p class="truncate text-sm font-medium text-ink">{{ option.name }}</p>
      </div>
      <p class="shrink-0 text-sm font-semibold tabular-nums text-ink">{{ option.price }}</p>
    </div>
  </div>
</template>
