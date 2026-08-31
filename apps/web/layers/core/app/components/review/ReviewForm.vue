<script setup lang="ts">
import { APP_REVIEW_BODY_MAX_LENGTH, APP_REVIEW_BODY_MIN_LENGTH } from '@kosvia/shared';
import type { AppReviewDto } from '@kosvia/shared';

const emit = defineEmits<{ saved: [AppReviewDto] }>();

const api = useApi();
const toast = useToast();
const message = useApiMessage();
const { t } = useI18n();

const rating = ref<number | null>(null);
const body = ref<string | null>('');
const ratingError = ref('');
const bodyError = ref('');
const submitError = ref('');
const pending = ref(false);

const trimmedBody = computed(() => (body.value ?? '').trim());

const validate = (): boolean => {
  ratingError.value = rating.value === null ? t('REVIEWS.RATING_REQUIRED') : '';
  bodyError.value =
    trimmedBody.value.length < APP_REVIEW_BODY_MIN_LENGTH
      ? t('REVIEWS.BODY_TOO_SHORT', { min: APP_REVIEW_BODY_MIN_LENGTH })
      : '';
  return !ratingError.value && !bodyError.value;
};

const submit = async () => {
  submitError.value = '';
  if (!validate()) {
    return;
  }
  pending.value = true;
  try {
    const review = await api<AppReviewDto>('/app-reviews', {
      method: 'POST',
      body: { rating: rating.value, body: trimmedBody.value },
    });
    toast.notify(t('REVIEWS.FORM_SAVED'));
    emit('saved', review);
  } catch (caught) {
    submitError.value = message(caught);
  } finally {
    pending.value = false;
  }
};
</script>

<template>
  <form class="space-y-4" novalidate @submit.prevent="submit">
    <ReviewStarInput
      v-model="rating"
      :label="t('REVIEWS.FORM_RATING_LABEL')"
      :error="ratingError"
    />
    <BaseTextarea
      v-model="body"
      :label="t('REVIEWS.FORM_BODY_LABEL')"
      :hint="t('REVIEWS.FORM_BODY_HINT', { min: APP_REVIEW_BODY_MIN_LENGTH })"
      :error="bodyError"
      :rows="4"
      :maxlength="APP_REVIEW_BODY_MAX_LENGTH"
    />
    <p
      v-if="submitError"
      class="flex items-start gap-2 rounded-lg bg-critical-soft px-3.5 py-2.5 text-sm text-critical"
      role="alert"
    >
      <BaseIcon name="alert" :size="15" class="mt-0.5 shrink-0" />
      {{ submitError }}
    </p>
    <BaseButton type="submit" :loading="pending">
      {{ t('REVIEWS.FORM_SUBMIT') }}
    </BaseButton>
  </form>
</template>
