<script setup lang="ts">
import type { ConsentType } from '@kosvia/shared';

const props = defineProps<{
  type: ConsentType;
  title: string;
  body: string;
  checkboxLabel: string;
  confirmLabel: string;
}>();

const { setConsent } = useAuthStore();
const toast = useToast();
const message = useApiMessage();

const accepted = ref(false);
const saving = ref(false);

const confirm = async () => {
  if (!accepted.value) {
    return;
  }
  saving.value = true;
  try {
    await setConsent(props.type, true);
  } catch (caught) {
    toast.error(message(caught));
  } finally {
    saving.value = false;
  }
};
</script>

<template>
  <BaseCard class="mx-auto max-w-lg">
    <h2 class="font-display text-2xl text-ink">
      {{ title }}
    </h2>
    <p class="mt-3 text-sm leading-relaxed text-ink-soft">
      {{ body }}
    </p>
    <div class="mt-5">
      <BaseCheckbox v-model="accepted" :label="checkboxLabel" />
    </div>
    <p class="mt-4 text-xs leading-relaxed text-ink-muted">
      {{ $t('CONSENT.WITHDRAW_NOTE') }}
      <NuxtLinkLocale to="/privacy" class="underline-offset-4 hover:underline">
        {{ $t('CONSENT.PRIVACY_LINK') }}
      </NuxtLinkLocale>
    </p>
    <div class="mt-6 flex justify-end">
      <BaseButton :disabled="!accepted" :loading="saving" @click="confirm">
        {{ confirmLabel }}
      </BaseButton>
    </div>
  </BaseCard>
</template>
