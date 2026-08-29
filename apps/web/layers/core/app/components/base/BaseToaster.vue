<script setup lang="ts">
const { toasts, dismiss } = useToast();

const tones = {
  neutral: 'border-line bg-ink text-ink-inverse',
  positive: 'border-positive/30 bg-positive text-white',
  critical: 'border-critical/30 bg-critical text-white',
};
</script>

<template>
  <ClientOnly>
    <Teleport to="body">
      <div
        class="safe-bottom pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex flex-col items-center gap-2 px-4 sm:bottom-6"
        role="status"
        aria-live="polite"
      >
        <TransitionGroup
          enter-active-class="transition-all duration-[--duration-base] ease-[--ease-out-soft]"
          leave-active-class="transition-all duration-[--duration-fast]"
          enter-from-class="translate-y-2 opacity-0"
          leave-to-class="translate-y-1 opacity-0"
        >
          <div
            v-for="toast in toasts"
            :key="toast.id"
            class="pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-xl border px-4 py-3 text-sm shadow-lg"
            :class="tones[toast.tone]"
          >
            <span class="min-w-0 flex-1">{{ toast.message }}</span>
            <NuxtLinkLocale
              v-if="toast.action"
              :to="toast.action.to"
              class="shrink-0 font-medium underline underline-offset-2"
              @click="dismiss(toast.id)"
            >
              {{ toast.action.label }}
            </NuxtLinkLocale>
            <button
              type="button"
              class="-mr-1 shrink-0 rounded p-1 opacity-70 transition-opacity hover:opacity-100"
              :aria-label="$t('COMMON.CLOSE')"
              @click="dismiss(toast.id)"
            >
              <BaseIcon name="close" :size="14" />
            </button>
          </div>
        </TransitionGroup>
      </div>
    </Teleport>
  </ClientOnly>
</template>
