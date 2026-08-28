<script setup lang="ts">
const faqs = [
  {
    q: 'Is Kosvia just another ingredient scanner?',
    a: 'No. Scanners tell you what is in a product. Kosvia answers a harder question — whether that product suits you specifically, given your skin, your goals, your budget and what you already own.',
  },
  {
    q: 'Where does the Personal Match number come from?',
    a: 'A deterministic scoring service on our backend. It weighs your skin type, concerns, goals, preferences, budget and shelf against the product’s ingredient list. The AI can explain the score in plain language, but it never produces it.',
  },
  {
    q: 'Can the AI invent a product or a price?',
    a: 'It cannot. The backend retrieves real rows from the database first and the model is only allowed to talk about those. Prices, ingredients and availability are passed to it as facts, never asked of it.',
  },
  {
    q: 'Do you label ingredients as toxic?',
    a: 'Never. We describe what an ingredient does and note where something is worth knowing — fragrance being a common trigger for reactive skin, for example. That is information, not a verdict.',
  },
  {
    q: 'Is this medical advice?',
    a: 'No. Kosvia is a shopping assistant. It does not diagnose skin conditions and does not claim any product will treat one. For a persistent skin concern, see a dermatologist.',
  },
  {
    q: 'Are the products and prices real?',
    a: 'Not in this build. The catalogue is demo data — invented brands, generated prices and illustrated packaging — so the product can be evaluated before any retailer integration exists.',
  },
];

const open = ref<number | null>(0);
</script>

<template>
  <section class="container-page py-16 sm:py-20">
    <SectionHeading eyebrow="FAQ" title="Questions worth asking" align="center" />

    <dl class="mx-auto mt-10 max-w-2xl divide-y divide-line rounded-xl border border-line bg-surface">
      <div v-for="(faq, index) in faqs" :key="faq.q">
        <dt>
          <button
            type="button"
            class="flex w-full items-start justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-surface-muted"
            :aria-expanded="open === index"
            @click="open = open === index ? null : index"
          >
            <span class="text-sm font-medium text-ink">{{ faq.q }}</span>
            <BaseIcon
              name="chevron-down"
              :size="17"
              class="mt-0.5 shrink-0 text-ink-faint transition-transform duration-[--duration-fast]"
              :class="open === index && 'rotate-180'"
            />
          </button>
        </dt>
        <dd v-if="open === index" class="animate-fade-up px-5 pb-4 text-sm leading-relaxed text-ink-muted">
          {{ faq.a }}
        </dd>
      </div>
    </dl>
  </section>
</template>
