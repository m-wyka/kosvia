<script setup lang="ts">
const open = defineModel<boolean>('open', { required: true });

const { t } = useI18n();

const INCLUDED_ROW_KEYS = ['PROFILE', 'SEARCH', 'INCI'] as const;
const LIMITED_ROW_KEYS = [
  'PERSONAL_MATCH',
  'WHY',
  'COMPARE',
  'ALTERNATIVES',
  'SHELF',
  'SHELF_ANALYSIS',
  'AI',
  'PRICE_ALERTS',
  'ROUTINE',
  'DIARY',
] as const;

const rows = computed(() => [
  ...INCLUDED_ROW_KEYS.map((key) => ({
    key,
    label: t(`PRICING.COMPARE.ROW.${key}`),
    included: true,
    free: '',
    premium: '',
  })),
  ...LIMITED_ROW_KEYS.map((key) => ({
    key,
    label: t(`PRICING.COMPARE.ROW.${key}`),
    included: false,
    free: t(`PRICING.COMPARE.ROW.${key}_FREE`),
    premium: t(`PRICING.COMPARE.ROW.${key}_PREMIUM`),
  })),
]);
</script>

<template>
  <BaseModal v-model:open="open" :title="$t('PRICING.COMPARE.TITLE')" size="lg">
    <div class="overflow-x-auto">
      <table class="w-full min-w-md text-sm">
        <thead>
          <tr class="border-b border-line text-left">
            <th class="py-2.5 pr-4 font-medium text-ink-muted">
              {{ $t('PRICING.COMPARE.FEATURE') }}
            </th>
            <th class="w-32 py-2.5 pr-4 font-medium text-ink-muted">
              {{ $t('PRICING.FREE.NAME') }}
            </th>
            <th class="w-32 py-2.5 font-medium text-ink">
              {{ $t('PRICING.PREMIUM.NAME') }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="row.key" class="border-b border-line last:border-b-0">
            <td class="py-2.5 pr-4 text-ink">
              {{ row.label }}
            </td>
            <td class="py-2.5 pr-4 text-ink-soft">
              <BaseIcon v-if="row.included" name="check" :size="16" class="text-sage" />
              <template v-else>
                {{ row.free }}
              </template>
            </td>
            <td class="py-2.5 font-medium text-ink">
              <BaseIcon v-if="row.included" name="check" :size="16" class="text-sage" />
              <template v-else>
                {{ row.premium }}
              </template>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </BaseModal>
</template>
