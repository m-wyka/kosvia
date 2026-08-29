# Kosvia — reguły dla Claude

Monorepo: `apps/web` (Nuxt 4, SSR, warstwy), `apps/api` (NestJS + Prisma), `packages/shared` (typy DTO).
Ten dokument opisuje przede wszystkim frontend (`apps/web`) — Vue 3 `<script setup lang="ts">`, Pinia, `@nuxtjs/i18n`, Tailwind v4.

Cały frontend jest już doprowadzony do tego standardu. Część reguł pilnuje narzędzi: Prettier (`.prettierrc`, format-on-save w `.vscode/settings.json`) oraz ESLint (`curly`, `func-style: expression`, `prefer-arrow-callback`, `vue/html-self-closing`). Resztę — Pinia, komentarze, nazewnictwo — pilnujemy ręcznie.

---

## Pinia

Store zawsze w stylu setup (`defineStore('name', () => { ... })`), pliki w `layers/core/app/stores/`.

Konsumpcja: stan i gettery przez `storeToRefs`, akcje przez zwykłą destrukturyzację. Akcję wywołujemy po nazwie — nigdy przez instancję store'a.

```ts
const { categories, isAuthenticated } = storeToRefs(useAuthStore());
const { fetchCategories, logout } = useAuthStore();

await fetchCategories();
```

Źle:

```ts
const authStore = useAuthStore();
await authStore.fetchCategories(); // nie
const categories = authStore.categories; // traci reaktywność
```

`storeToRefs` tylko dla `ref`/`computed` — akcje z niego nie wychodzą reaktywne i destrukturyzujemy je osobno.

## Funkcje

W komponentach i composables używamy funkcji strzałkowych przypisanych do `const`:

```ts
const updateEdges = () => {
  const element = track.value;
  if (!element) {
    return;
  }
  atStart.value = element.scrollLeft <= EDGE_THRESHOLD;
};
```

## Klamry

Każdy `if`, `else`, `for`, `while` ma klamry — także jednolinijkowy. `return` z warunku też idzie w klamry.

```ts
if (!isAuthenticated.value) {
  return null;
}

if (section.key === 'best-value') {
  return t('DISCOVER.SECTION.BEST_VALUE');
}
```

Źle: `if (!element) return;`, `if (raw) items.value = JSON.parse(raw);`

Wyjątek: skrócone wyrażenia w `computed` / `.filter()` / ternary w template zostają jednolinijkowe — to wyrażenia, nie instrukcje sterujące.

## Komentarze

Komentarzy nie piszemy. Kod ma się tłumaczyć sam: nazwy zmiennych i funkcji konkretne i opisowe, magiczne liczby wyciągnięte do nazwanych stałych, długie warunki do nazwanych `computed`.

```ts
const SCROLL_STEP_RATIO = 0.8;
const isTagShortEnoughForChip = (label: string) => label.length <= MAX_CHIP_LENGTH;
```

Zamiast komentarza opisującego blok — wydziel funkcję o nazwie, która mówi to samo.

Jedyne dopuszczalne wyjątki: JSDoc na publicznym API `packages/shared` oraz komentarz wyjaśniający obejście cudzego buga (biblioteka, przeglądarka) razem z linkiem — czyli informacja, której z kodu nie da się odczytać.

## Nazewnictwo

- `ref`/`computed`: rzeczownik opisujący wartość — `visibleCategories`, `lowestPriceOffer`.
- boolean: `is` / `has` / `can` / `should` — `isFavorite`, `hasBeautyProfile`, `canCompare`.
- handlery: `handleFavoriteClick`, `handleScroll`; akcje domenowe czasownikiem — `fetchCategories`, `toggleFavorite`.
- bez skrótów (`el`, `res`, `idx`, `cat`) — pełne słowa: `element`, `response`, `index`, `category`.

## Formatowanie template

Treść elementu — zwłaszcza tłumaczenie — stoi w osobnej linii. Nie zostawiamy `>` doklejonego do tekstu ani wiszącego przed tagiem zamykającym.

Źle:

```vue
<NuxtLinkLocale
  v-if="seeAllTo"
  :to="seeAllTo"
  class="text-sm font-medium text-ink-soft"
>{{ $t('COMMON.SEE_ALL') }}</NuxtLinkLocale>
```

Dobrze:

```vue
<NuxtLinkLocale v-if="seeAllTo" :to="seeAllTo" class="text-sm font-medium text-ink-soft">
  {{ $t('COMMON.SEE_ALL') }}
</NuxtLinkLocale>
```

Pozostałe zasady:

- Jeden atrybut w linii, gdy element ma więcej niż dwa atrybuty albo nie mieści się w linii.
- Kolejność atrybutów: `ref` / `id` → `v-if` / `v-for` → `:to` / `:href` → pozostałe propsy → `class` → `aria-*` → `@event`.
- Apostrofy pojedyncze w skryptach i w wyrażeniach template (`$t('COMMON.SEE_ALL')`), podwójne tylko jako cudzysłów atrybutu HTML.
- Długie listy klas Tailwind zostawiamy w jednym atrybucie; warunkowe klasy przez `:class` z tablicą lub obiektem, nie przez sklejanie stringów.

## Komponenty

Kolejność w pliku: `<script setup lang="ts">`, potem `<template>`. Wewnątrz skryptu: importy typów → `defineProps` / `defineModel` / `defineEmits` → store'y i composables → stan lokalny → `computed` → funkcje → hooki cyklu życia i `watch`.

- Propsy typowane generykiem: `defineProps<{ product: ProductSummaryDto }>()`, wartości domyślne przez `withDefaults`.
- `v-model` przez `defineModel<T>()`.
- Emity typowane: `defineEmits<{ favorite: [ProductSummaryDto] }>()`.
- Auto-import jest włączony — nie importujemy ręcznie `ref`, `computed`, `useI18n`, store'ów ani komponentów `Base*` / `Product*`.
- Komponenty bazowe (`layers/core/app/components/base/`) są jedynym źródłem przycisków, inputów, modali — nie duplikujemy ich markupu w widokach.
- Warstwa `admin` ma prefiks `Admin*`; komponenty współdzielone trafiają do `core`.

## Dane i API

- Fetch w komponentach przez `useApiFetch<T>(url, { key })` — nie przez surowe `useFetch` ani `$fetch`.
- Imperatywne wywołania (mutacje) przez `useApi()`, błędy do treści przez `useApiMessage()`.
- Typy odpowiedzi biorą się z `@kosvia/shared` — nie definiujemy lokalnych kopii DTO.
- Stan serwerowy (półka, koszyk porównań z API) trzymamy w composable, nie w Pinii; Pinia jest dla stanu klienta (sesja, tray porównań w localStorage).

## i18n

- Każdy tekst widoczny dla użytkownika przechodzi przez `$t()` / `t()`. Zero literałów w template.
- Klucze `UPPER_SNAKE` z namespace'em: `PRODUCT.ADD_FAVORITE`, `DISCOVER.SECTION.BEST_VALUE`.
- Nowy klucz dodajemy do `i18n/locales/en.json` **i** `pl.json` jednocześnie.
- Linki wewnętrzne przez `NuxtLinkLocale` (strategia `prefix_except_default`), nie `NuxtLink`.
- Po zmianach: `npm run i18n:check -w @kosvia/web` — wykrywa brakujące, osierocone i nieużywane klucze.

## Weryfikacja zmian

```bash
npm run format                     # prettier --write . (root)
npm run lint -w @kosvia/web        # eslint --max-warnings 0
npm run typecheck -w @kosvia/web   # vue-tsc, strict
npm run test -w @kosvia/web        # i18n check + vitest
```

## Specyfikacja

Kontekst projektu: `docs/spec/`. Kolejność czytania: **`STATUS.md`** (co jest zrobione,
decyzje, co otwarte) → `AUDIT.md` (stan faktyczny i korekty do 00–07, sekcja 5) → pliki
numerowane. Sekcje 3 i 6 audytu są wykonane — nie planuj ich ponownie.

Zmiana we frontendzie jest skończona dopiero, gdy lint, typecheck i testy przechodzą, a `npm run format:check` nie zgłasza plików.
