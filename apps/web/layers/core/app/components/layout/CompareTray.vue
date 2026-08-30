<script setup lang="ts">
const { items, count, compareLink, canCompare } = storeToRefs(useCompareStore());
const { hydrate, remove, clear, MAX_ITEMS } = useCompareStore();
const route = useRoute();

const visible = computed(() => count.value > 0 && !route.path.startsWith('/compare'));

onMounted(hydrate);
</script>

<template>
  <ClientOnly>
    <Transition
      enter-active-class="transition-all duration-base ease-out-soft"
      leave-active-class="transition-all duration-fast"
      enter-from-class="translate-y-4 opacity-0"
      leave-to-class="translate-y-4 opacity-0"
    >
      <div v-if="visible" class="fixed inset-x-0 bottom-16 z-30 px-4 pb-3 lg:bottom-0 lg:pb-6">
        <div
          class="container-page flex items-center gap-3 rounded-xl border border-line bg-surface p-3 shadow-lg"
        >
          <ul class="hide-scrollbar flex min-w-0 flex-1 gap-2 overflow-x-auto">
            <li v-for="item in items" :key="item.id" class="relative shrink-0">
              <ProductImage
                :src="item.imageUrl"
                :alt="item.name"
                ratio="square"
                class="w-12 rounded-md"
              />
              <button
                type="button"
                class="absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full bg-ink text-ink-inverse shadow-xs"
                :aria-label="$t('COMPARE.TRAY.REMOVE', { name: item.name })"
                @click="remove(item.id)"
              >
                <BaseIcon name="close" :size="11" />
              </button>
            </li>
          </ul>

          <div class="flex shrink-0 items-center gap-2">
            <span class="hidden text-xs text-ink-muted sm:block">
              {{ $t('COMPARE.TRAY.COUNT', { current: count, max: MAX_ITEMS }) }}
            </span>
            <BaseButton size="sm" variant="ghost" @click="clear()">
              {{ $t('COMMON.CLEAR') }}
            </BaseButton>
            <BaseButton size="sm" :to="compareLink" :disabled="!canCompare">
              {{ $t('COMPARE.TRAY.COMPARE') }}
            </BaseButton>
          </div>
        </div>
      </div>
    </Transition>
  </ClientOnly>
</template>
