<script setup lang="ts">
import type { AiChatResponse, AiConversationDto, AiMessageDto } from '@kosvia/shared';

definePageMeta({ middleware: 'auth' });

const STARTER_COUNT = 5;

const api = useApi();
const { displayName } = storeToRefs(useAuthStore());
const { hasConsent } = useAuthStore();
const hasAiConsent = computed(() => hasConsent('AI_PROCESSING'));
const message = useApiMessage();
const { t, locale } = useI18n();

const { data: conversations, refresh: refreshConversations } = await useApiFetch<
  AiConversationDto[]
>('/ai/conversations', { key: 'ai-conversations', default: () => [] });

const conversationId = ref<string | null>(null);
const messages = ref<AiMessageDto[]>([]);
const draft = ref('');
const thinking = ref(false);
const error = ref('');
const thread = ref<HTMLElement | null>(null);

const starters = computed(() =>
  Array.from({ length: STARTER_COUNT }, (_, index) => t(`AI.STARTER.ITEM_${index + 1}`)),
);

const scrollToEnd = async () => {
  await nextTick();
  thread.value?.scrollTo({ top: thread.value.scrollHeight, behavior: 'smooth' });
};

const openConversation = async (id: string) => {
  const conversation = await api<AiConversationDto>(`/ai/conversations/${id}`);
  conversationId.value = conversation.id;
  messages.value = conversation.messages;
  await scrollToEnd();
};

const startNew = () => {
  conversationId.value = null;
  messages.value = [];
  error.value = '';
};

const appendLocalUserMessage = (content: string) => {
  messages.value = [
    ...messages.value,
    {
      id: `local-${Date.now()}`,
      role: 'USER',
      content,
      suggestions: [],
      createdAt: new Date().toISOString(),
    },
  ];
};

const send = async (text?: string) => {
  const content = (text ?? draft.value).trim();
  if (!content || thinking.value) {
    return;
  }

  error.value = '';
  draft.value = '';
  appendLocalUserMessage(content);
  thinking.value = true;
  await scrollToEnd();

  try {
    const response = await api<AiChatResponse>('/ai/chat', {
      method: 'POST',
      body: {
        message: content,
        conversationId: conversationId.value ?? undefined,
        locale: locale.value,
      },
    });
    conversationId.value = response.conversationId;
    messages.value = [...messages.value, response.message];
    await refreshConversations();
  } catch (caught) {
    error.value = message(caught);
  } finally {
    thinking.value = false;
    await scrollToEnd();
  }
};

const handleComposerKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    void send();
  }
};

useSeo(() => ({
  title: t('SEO.AI.TITLE'),
  description: t('SEO.AI.DESCRIPTION'),
  noindex: true,
}));
</script>

<template>
  <div class="container-page py-6 sm:py-10">
    <div v-if="!hasAiConsent" class="py-8">
      <AccountConsentGate
        type="AI_PROCESSING"
        :title="$t('CONSENT.AI_TITLE')"
        :body="$t('CONSENT.AI_BODY')"
        :checkbox-label="$t('CONSENT.AI_LABEL')"
        :confirm-label="$t('CONSENT.AI_CONFIRM')"
      />
    </div>
    <div v-else class="grid gap-8 lg:grid-cols-[1fr_17rem]">
      <div class="flex min-h-[70dvh] min-w-0 flex-col">
        <header class="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 class="font-display text-2xl text-ink sm:text-3xl">{{ $t('AI.TITLE') }}</h1>
            <p class="mt-1 text-sm text-ink-muted">{{ $t('AI.SUBTITLE') }}</p>
          </div>
          <BaseButton v-if="messages.length" variant="ghost" size="sm" @click="startNew">
            {{ $t('AI.NEW_CONVERSATION') }}
          </BaseButton>
        </header>

        <div v-if="!messages.length" class="flex flex-1 flex-col justify-center py-8">
          <div class="mx-auto max-w-2xl text-center">
            <span
              class="mx-auto flex size-14 items-center justify-center rounded-2xl bg-blush-soft text-blush-deep"
            >
              <BaseIcon name="sparkles" :size="26" />
            </span>
            <h2 class="mt-5 font-display text-2xl text-ink">
              {{ $t('AI.EMPTY_TITLE', { name: displayName }) }}
            </h2>
            <p class="mt-2 text-sm text-ink-muted">{{ $t('AI.EMPTY_BODY') }}</p>

            <ul class="mt-7 flex flex-wrap justify-center gap-2">
              <li v-for="starter in starters" :key="starter">
                <button
                  type="button"
                  class="rounded-pill border border-line bg-surface px-3.5 py-2 text-sm text-ink-soft transition-colors hover:border-line-strong hover:text-ink"
                  @click="send(starter)"
                >
                  {{ starter }}
                </button>
              </li>
            </ul>
          </div>
        </div>

        <div v-else ref="thread" class="flex-1 space-y-5 overflow-y-auto pr-1 pb-4">
          <AiMessage v-for="entry in messages" :key="entry.id" :message="entry" />
          <AiThinking v-if="thinking" />
        </div>

        <p
          v-if="error"
          class="mb-3 flex items-start gap-2 rounded-lg bg-critical-soft px-3.5 py-2.5 text-sm text-critical"
          role="alert"
        >
          <BaseIcon name="alert" :size="15" class="mt-0.5 shrink-0" />
          {{ error }}
        </p>

        <form class="sticky bottom-20 lg:bottom-0" @submit.prevent="send()">
          <div class="flex items-end gap-2 rounded-2xl border border-line bg-surface p-2 shadow-sm">
            <label for="ai-input" class="sr-only">{{ $t('AI.INPUT_LABEL') }}</label>
            <textarea
              id="ai-input"
              v-model="draft"
              rows="1"
              :placeholder="$t('AI.PLACEHOLDER')"
              class="max-h-32 min-h-11 flex-1 resize-none bg-transparent px-2.5 py-2.5 text-sm text-ink placeholder:text-ink-faint focus:outline-none"
              @keydown="handleComposerKeydown"
            />
            <BaseButton
              type="submit"
              size="md"
              :disabled="!draft.trim()"
              :loading="thinking"
              :label="$t('AI.SEND')"
            >
              <template #icon><BaseIcon name="send" :size="16" /></template>
            </BaseButton>
          </div>
          <p class="mt-2 px-1 text-2xs text-ink-muted">
            {{ $t('AI.DISCLAIMER') }}
          </p>
        </form>
      </div>

      <aside class="hidden lg:block">
        <div class="sticky top-24 space-y-4">
          <BaseCard :padded="false" class="overflow-hidden">
            <p class="border-b border-line px-4 py-3 text-sm font-semibold text-ink">
              {{ $t('AI.RECENT_TITLE') }}
            </p>
            <ul v-if="conversations?.length" class="divide-y divide-line">
              <li v-for="conversation in conversations.slice(0, 8)" :key="conversation.id">
                <button
                  type="button"
                  class="w-full px-4 py-3 text-left transition-colors hover:bg-surface-muted"
                  :class="conversationId === conversation.id && 'bg-surface-muted'"
                  @click="openConversation(conversation.id)"
                >
                  <span class="line-clamp-2 text-sm text-ink-soft">
                    {{ conversation.title ?? $t('AI.UNTITLED') }}
                  </span>
                </button>
              </li>
            </ul>
            <p v-else class="px-4 py-6 text-center text-sm text-ink-muted">
              {{ $t('AI.RECENT_EMPTY') }}
            </p>
          </BaseCard>

          <div class="rounded-xl border border-dashed border-line-strong p-4">
            <p class="text-sm font-medium text-ink">{{ $t('AI.HOW_TITLE') }}</p>
            <ol class="mt-2 space-y-1.5 text-xs leading-relaxed text-ink-muted">
              <li>{{ $t('AI.HOW_1') }}</li>
              <li>{{ $t('AI.HOW_2') }}</li>
              <li>{{ $t('AI.HOW_3') }}</li>
            </ol>
          </div>
        </div>
      </aside>
    </div>
  </div>
</template>
