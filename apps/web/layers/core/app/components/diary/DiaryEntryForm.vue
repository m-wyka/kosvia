<script setup lang="ts">
import {
  SKIN_DIARY_FLAGS,
  SKIN_DIARY_NOTE_MAX_LENGTH,
  SKIN_DIARY_OVERALL_MAX,
  type SkinDiaryEntryDto,
  type SkinDiaryFlag,
} from '@kosvia/shared';

const props = defineProps<{ date: string; entry: SkinDiaryEntryDto | null }>();
const emit = defineEmits<{ saved: []; deleted: [] }>();

const api = useApi();
const toast = useToast();
const message = useApiMessage();
const { t } = useI18n();
const format = useFormat();

const overall = ref<number | null>(props.entry?.overall ?? null);
const flags = ref<SkinDiaryFlag[]>([...(props.entry?.flags ?? [])]);
const note = ref<string | null>(props.entry?.note ?? null);
const saving = ref(false);
const removing = ref(false);

const overallOptions = Array.from({ length: SKIN_DIARY_OVERALL_MAX }, (unused, index) => index + 1);

const canSave = computed(() => overall.value !== null);

const flagLabel = (flag: SkinDiaryFlag): string => {
  if (flag === 'breakouts') {
    return t('DIARY.FLAG.BREAKOUTS');
  }
  if (flag === 'dryness') {
    return t('DIARY.FLAG.DRYNESS');
  }
  if (flag === 'irritation') {
    return t('DIARY.FLAG.IRRITATION');
  }
  return t('DIARY.FLAG.REDNESS');
};

const isFlagOn = (flag: SkinDiaryFlag): boolean => flags.value.includes(flag);

const toggleFlag = (flag: SkinDiaryFlag) => {
  flags.value = isFlagOn(flag)
    ? flags.value.filter((entry) => entry !== flag)
    : [...flags.value, flag];
};

const save = async () => {
  if (overall.value === null) {
    return;
  }
  saving.value = true;
  try {
    await api(`/diary/${props.date}`, {
      method: 'PUT',
      body: { overall: overall.value, flags: flags.value, note: note.value },
    });
    toast.notify(t('DIARY.SAVED'));
    emit('saved');
  } catch (caught) {
    toast.error(message(caught));
  } finally {
    saving.value = false;
  }
};

const removeEntry = async () => {
  removing.value = true;
  try {
    await api(`/diary/${props.date}`, { method: 'DELETE' });
    toast.notify(t('DIARY.DELETED'));
    emit('deleted');
  } catch (caught) {
    toast.error(message(caught));
  } finally {
    removing.value = false;
  }
};

watch(
  () => [props.date, props.entry] as const,
  () => {
    overall.value = props.entry?.overall ?? null;
    flags.value = [...(props.entry?.flags ?? [])];
    note.value = props.entry?.note ?? null;
  },
);
</script>

<template>
  <BaseCard>
    <h2 class="font-display text-xl text-ink">
      {{ format.date(date) }}
    </h2>

    <fieldset class="mt-4">
      <legend class="text-sm font-medium text-ink">
        {{ $t('DIARY.OVERALL_LABEL') }}
      </legend>
      <div class="mt-2 flex gap-2" role="radiogroup" :aria-label="$t('DIARY.OVERALL_LABEL')">
        <button
          v-for="option in overallOptions"
          :key="option"
          type="button"
          role="radio"
          class="flex size-10 items-center justify-center rounded-full border text-sm font-semibold tabular-nums transition-colors"
          :class="
            overall === option
              ? 'border-ink bg-ink text-ink-inverse'
              : 'border-line bg-surface text-ink-soft hover:border-line-strong'
          "
          :aria-checked="overall === option"
          @click="overall = option"
        >
          {{ option }}
        </button>
      </div>
    </fieldset>

    <div class="mt-5 grid gap-2 sm:grid-cols-2">
      <BaseCheckbox
        v-for="flag in SKIN_DIARY_FLAGS"
        :key="flag"
        :model-value="isFlagOn(flag)"
        :label="flagLabel(flag)"
        @update:model-value="toggleFlag(flag)"
      />
    </div>

    <BaseTextarea
      v-model="note"
      :label="$t('DIARY.NOTE_LABEL')"
      :placeholder="$t('DIARY.NOTE_PLACEHOLDER')"
      :maxlength="SKIN_DIARY_NOTE_MAX_LENGTH"
      :rows="3"
      class="mt-4"
    />

    <div class="mt-5 flex items-center justify-between gap-3">
      <button
        v-if="entry"
        type="button"
        class="text-xs font-medium text-ink-faint underline-offset-4 hover:text-critical hover:underline"
        :disabled="removing"
        @click="removeEntry"
      >
        {{ $t('DIARY.DELETE_ENTRY') }}
      </button>
      <span v-else />
      <BaseButton :disabled="!canSave" :loading="saving" @click="save">
        {{ $t('DIARY.SAVE') }}
      </BaseButton>
    </div>
  </BaseCard>
</template>
