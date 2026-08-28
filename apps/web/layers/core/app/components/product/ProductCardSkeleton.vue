<template>
  <div class="overflow-hidden rounded-xl border border-line bg-surface" aria-hidden="true">
    <div class="skeleton aspect-square rounded-none" />
    <div class="space-y-2.5 p-3.5">
      <BaseSkeleton width="45%" height="0.625rem" />
      <BaseSkeleton height="0.875rem" :lines="2" />
      <div class="flex items-center justify-between pt-1">
        <BaseSkeleton width="4.5rem" height="1.125rem" />
        <BaseSkeleton width="1.75rem" height="1.75rem" rounded="var(--radius-sm)" />
      </div>
    </div>
  </div>
</template>
