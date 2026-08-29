# 06 — AUTH, SSR I CACHE

> Dwa problemy, które pierwotny prompt pominął, a które są klasycznym źródłem
> błędów typu „działa lokalnie, nie działa na produkcji":
> ciasteczka między Nuxtem a NestJS oraz konflikt cache'u SSR z personalizacją.

---

## 1. Ciasteczka — rozstrzygnięcie

Rozważane opcje:

**A. `api.kosvia.pl` + ciasteczko z `Domain=.kosvia.pl`**
Działa (to samo site, `SameSite=Lax` wystarczy), o jeden hop szybciej.
Koszty: konfiguracja CORS z `credentials`, inna konfiguracja w dev niż na produkcji,
domena ciasteczka jako zmienna środowiskowa, trzy miejsca do pomylenia.

**B. Proxy przez Nitro — `kosvia.pl/api/**` → NestJS**
Przeglądarka widzi wyłącznie jedno pochodzenie. Zero CORS. Zero konfiguracji domeny
ciasteczka. Identyczne zachowanie w dev i na produkcji.
Koszt: jeden dodatkowy hop wewnątrz sieci (~1–3 ms) i Nitro musi się skalować z ruchem.

### Wybór: **B — proxy przez Nitro**

Uzasadnienie: przy jednoosobowym zespole liczy się liczba rzeczy, które mogą się
rozjechać między środowiskami. Opcja B eliminuje CORS i konfigurację ciasteczek
całkowicie, a jej jedyny koszt jest mierzalny i mały. Opcja A jest szybsza, ale
oszczędza milisekundy kosztem klasy błędów, które objawiają się dopiero na produkcji
i tylko w niektórych przeglądarkach.

Migracja na A później jest prosta (zmiana bazowego URL-a + konfiguracja CORS),
więc to nie jest decyzja nieodwracalna.

### Implementacja

```ts
// apps/web/nuxt.config.ts
export default defineNuxtConfig({
  routeRules: {
    '/api/**': { proxy: `${process.env.NUXT_API_INTERNAL_URL}/**` },
  },
  runtimeConfig: {
    apiInternalUrl: process.env.NUXT_API_INTERNAL_URL, // tylko serwer
    public: {
      apiBase: '/api',                                  // klient zawsze względnie
    },
  },
});
```

Ciasteczka ustawia NestJS:

```ts
res.cookie('access_token', token, {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/',
  maxAge: 15 * 60 * 1000,
});
res.cookie('refresh_token', refresh, {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  path: '/api/auth/refresh',   // ograniczony zasięg
  maxAge: 30 * 24 * 60 * 60 * 1000,
});
```

Bez `domain` — ciasteczko jest host-only dla `kosvia.pl`, bo NestJS jest za proxy.

### Przekazywanie ciasteczek w SSR

To jest drugi klasyczny błąd: podczas renderowania po stronie serwera `$fetch`
nie ma ciasteczek przeglądarki, więc żądanie leci jako anonimowe i użytkownik widzi
się jako wylogowany przez ułamek sekundy.

**Zawsze `useRequestFetch()`, nigdy gołe `$fetch` w kodzie wykonywanym na serwerze:**

```ts
// composables/useApi.ts
export const useApi = () => {
  const requestFetch = useRequestFetch();  // przekazuje nagłówki żądania, w tym cookie
  return requestFetch.create({ baseURL: '/api' });
};
```

Dodaj regułę do ESLinta albo do `CLAUDE.md`: `$fetch` do własnego API jest zakazane
poza kontekstem czysto klienckim.

### Rotacja tokenów odświeżających

- refresh token jednorazowy, przy użyciu wydawany nowy,
- stary trafia na listę użytych (`RefreshTokenUsage`, TTL 30 dni),
- **ponowne użycie zużytego tokenu = unieważnienie całej rodziny tokenów użytkownika
  i wymuszenie ponownego logowania**. To standardowa detekcja kradzieży tokenu i kosztuje
  jedną tabelę.
- Wyścig przy równoległych żądaniach: interceptor w Nuxcie kolejkuje żądania na czas
  odświeżania, wykonuje jedno `POST /auth/refresh` i ponawia resztę. Bez tego pięć
  równoległych zapytań zrobi pięć rotacji i wyloguje użytkownika.

### CSRF

Ciasteczka + `SameSite=Lax` chronią przed większością wektorów, ale dla żądań
mutujących dołóż nagłówek `X-Requested-With: XMLHttpRequest` wymagany po stronie
NestJS, albo klasyczny token double-submit. Tanio, a zamyka temat.

---

## 2. SSR vs personalizacja — konflikt do rozwiązania

Sekcja 23 chciała stron produktu indeksowalnych i cache'owalnych.
Sekcja 11 chciała na tej samej stronie Personal Match zależny od zalogowanego użytkownika.

**To się wyklucza, jeśli renderować obie rzeczy razem.** Zbuforowany HTML z wynikiem
dopasowania jednego użytkownika trafi do wszystkich pozostałych. To jest wyciek danych
z art. 9 RODO — czyli najgorszy możliwy rodzaj buga w tym projekcie.

### Zasada

```
Warstwa publiczna  → SSR, cache'owalna, identyczna dla wszystkich, indeksowalna
Warstwa osobista   → pobierana po stronie klienta po hydracji, nigdy nie cache'owana
```

Strona produktu:

| Element | Warstwa |
|---|---|
| nazwa, marka, zdjęcie, opis, skład, analiza składu, ceny, dane strukturalne | publiczna, SSR |
| Personal Match, „Dlaczego?", ostrzeżenia dla profilu, „masz to na półce" | osobista, klient |

```vue
<script setup lang="ts">
const { data: product } = await useFetch(`/api/products/${slug}`)  // SSR, cache

const { user } = useAuth()
const { data: match } = useLazyFetch(`/api/products/${product.value.id}/match`, {
  server: false,                       // nigdy na serwerze
  immediate: !!user.value,
})
</script>

<template>
  <ProductHero :product="product" />
  <MatchScoreSkeleton v-if="user && !match" />
  <MatchScore v-else-if="match" :result="match" />
  <MatchScoreCta v-else />   <!-- niezalogowany: "Poznaj swoje dopasowanie" -->
</template>
```

Efekt uboczny jest korzystny: niezalogowany użytkownik i crawler widzą w tym miejscu
CTA do rejestracji. Miejsce, gdzie zalogowany widzi wynik, dla gościa jest zaproszeniem.

### Konfiguracja cache'u

```ts
// nuxt.config.ts
routeRules: {
  '/':               { swr: 3600 },
  '/produkty/**':    { swr: 3600 },
  '/skladniki/**':   { swr: 86400 },
  '/profil/**':      { ssr: true, headers: { 'cache-control': 'private, no-store' } },
  '/polka/**':       { ssr: true, headers: { 'cache-control': 'private, no-store' } },
  '/admin/**':       { ssr: false, robots: false },
}
```

### Reguła twarda — do `CLAUDE.md` i do przeglądu każdego PR-a

> **Żadna trasa z `swr` ani `isr` nie może czytać ciasteczka uwierzytelniającego
> podczas renderowania po stronie serwera.**

Egzekwowanie: test integracyjny, który uderza w `/produkty/{slug}` z ciasteczkiem
zalogowanego użytkownika i sprawdza, że w zwróconym HTML nie ma ani `matchScore`,
ani niczego z profilu. Ten test ma być w CI od pierwszego dnia.

---

## 3. Nagłówki i SEO

- Wszystkie odpowiedzi API z danymi użytkownika: `Cache-Control: private, no-store`.
  Ustaw to globalnym interceptorem w NestJS dla tras chronionych guardem, nie ręcznie.
- `Vary: Cookie` na wszystkim, co nie jest jawnie publiczne.
- `robots.txt`: `Disallow: /admin`, `/profil`, `/polka`, `/api`.
- Dane strukturalne `Product` + `Offer` (schema.org) renderowane w SSR — bez
  `aggregateRating`, dopóki nie ma prawdziwych recenzji. Wymyślone oceny w danych
  strukturalnych to kara od Google.
- `canonical` na stronie produktu wskazuje wersję bez parametrów zapytania;
  strony filtrów (`/produkty?category=…`) dostają `canonical` na kategorię i `noindex`
  przy więcej niż jednym aktywnym filtrze. Inaczej wygenerujesz dziesiątki tysięcy
  cienkich stron.
