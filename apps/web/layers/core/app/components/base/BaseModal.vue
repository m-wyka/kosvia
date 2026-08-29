<script setup lang="ts">
const open = defineModel<boolean>('open', { required: true });

withDefaults(defineProps<{ title?: string; description?: string; size?: 'sm' | 'md' | 'lg' }>(), {
  size: 'md',
});

const titleId = useId();
const widths = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl' };

const lockPageScroll = (locked: boolean) => {
  if (import.meta.client) {
    document.documentElement.style.overflow = locked ? 'hidden' : '';
  }
};

onKeyStroke('Escape', () => {
  if (open.value) {
    open.value = false;
  }
});

watchEffect(() => lockPageScroll(open.value));
onUnmounted(() => lockPageScroll(false));
</script>

<template>
  <ClientOnly>
    <Teleport to="body">
      <Transition
        enter-active-class="transition-opacity duration-[--duration-base]"
        leave-active-class="transition-opacity duration-[--duration-fast]"
        enter-from-class="opacity-0"
        leave-to-class="opacity-0"
      >
        <div
          v-if="open"
          class="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto p-0 sm:items-center sm:p-6"
          role="dialog"
          aria-modal="true"
          :aria-labelledby="title ? titleId : undefined"
        >
          <div class="fixed inset-0 bg-overlay backdrop-blur-[2px]" @click="open = false" />

          <div
            class="animate-fade-up relative w-full rounded-t-2xl border border-line bg-surface shadow-lg sm:rounded-2xl"
            :class="widths[size]"
          >
            <header
              v-if="title"
              class="flex items-start justify-between gap-4 border-b border-line p-5 sm:p-6"
            >
              <div class="min-w-0">
                <h2 :id="titleId" class="font-display text-xl text-ink">{{ title }}</h2>
                <p v-if="description" class="mt-1 text-sm text-ink-muted">{{ description }}</p>
              </div>
              <button
                type="button"
                class="-m-1.5 rounded-md p-1.5 text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink"
                :aria-label="$t('COMMON.CLOSE')"
                @click="open = false"
              >
                <BaseIcon name="close" :size="18" />
              </button>
            </header>

            <div class="p-5 sm:p-6"><slot /></div>

            <footer
              v-if="$slots.footer"
              class="flex flex-wrap justify-end gap-2 border-t border-line p-5 sm:p-6"
            >
              <slot name="footer" />
            </footer>
          </div>
        </div>
      </Transition>
    </Teleport>
  </ClientOnly>
</template>
