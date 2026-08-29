# 04 — PERSONAL MATCH

> Najważniejsza rzecz w produkcie, a w pierwotnym prompcie opisana najkrócej.
> Ten plik rozwiązuje trzy problemy naraz: **wydajność** (jak policzyć wynik dla
> 100 tys. produktów), **wiarygodność** (jak nie pokazywać 87% dla wszystkiego)
> i **wyjaśnialność** (jak uzasadnić wynik, co jest jednocześnie wymogiem RODO).

---

## 1. Zasada nadrzędna

```
Wynik liczy deterministyczny kod. AI go wyłącznie opisuje słowami.
AI nigdy nie zwraca liczby.
```

To już było w sekcji 13 i jest słuszne. Poniżej — jak to zrobić, żeby działało.

---

## 2. Architektura dwuprzebiegowa

Naiwne podejście („policz wynik dla każdego produktu w TypeScripcie") przy 100 tys.
produktów jest nie do uratowania. Rozwiązanie: **dwa przebiegi z gwarancją poprawności.**

```
Zapytanie użytkownika
        │
        ├── PRZEBIEG A (SQL, cały katalog)
        │     • twarde filtry w WHERE
        │     • zgrubny wynik jako wyrażenie SQL na ProductTraits
        │     • ORDER BY coarse_score DESC LIMIT 200
        │
        └── PRZEBIEG B (TypeScript, 200 kandydatów)
              • pełny scoring z karami i konfliktami
              • rozbicie na czynniki + uzasadnienia
              • sortowanie końcowe → LIMIT 20
```

**Warunek poprawności (to jest sedno):** wynik z przebiegu A musi być
**górnym ograniczeniem** wyniku z przebiegu B — jak heurystyka dopuszczalna w A*.
Osiąga się to prosto: przebieg A liczy tylko składniki dodatnie i pomija wszystkie kary.
Kara może wynik wyłącznie obniżyć, więc `coarse >= exact` zawsze.

Wniosek: top 200 z przebiegu A **na pewno zawiera** prawdziwe top 20.
Nie tracisz żadnego produktu, a liczysz drogi scoring dla 200 rekordów zamiast 100 tys.

To trzeba pokryć testem property-based: losuj profil i produkt, sprawdź
`coarse(p, u) >= exact(p, u)`. Test w CI. Jeśli kiedykolwiek padnie — ktoś dodał karę
do przebiegu A albo bonus do B.

### Wyrażenie SQL przebiegu A

Ponieważ `ProductTraits` ma wyłącznie kolumny numeryczne, cały zgrubny wynik
to jedno wyrażenie arytmetyczne, które Postgres policzy przy sortowaniu:

```sql
SELECT p.id,
  ( $w_hydration * t.humectant_score
  + $w_soothing  * t.soothing_score
  + $w_bright    * t.brightening_score
  + $w_antiaging * t.anti_aging_score
  + $w_sebum     * t.sebum_regulation_score
  + $w_spf       * (CASE WHEN t.has_spf THEN 1 ELSE 0 END)
  + $w_vegan     * (CASE WHEN t.is_vegan THEN 1 ELSE 0 END)
  ) AS coarse_score
FROM products p
JOIN product_traits t ON t.product_id = p.id
WHERE p.is_active
  AND p.category_id = ANY($categories)
  AND NOT (t.active_ingredient_ids && $allergyIds)   -- twarda blokada, GIN
  AND p.brand_id <> ALL($excludedBrands)
ORDER BY coarse_score DESC
LIMIT 200;
```

Wagi `$w_*` są parametrami wyliczonymi z profilu użytkownika po stronie aplikacji —
nie ma tu żadnej logiki w SQL-u poza arytmetyką.

---

## 3. Siedem osi wyniku

Każda oś zwraca wartość 0..1. To ułatwia testowanie, debugowanie i tłumaczenie
użytkownikowi.

| Oś | Co mierzy | Waga startowa |
|---|---|---|
| `concernCoverage` | pokrycie zgłoszonych problemów przez składniki aktywne | 0.25 |
| `goalAlignment` | zgodność z celami pielęgnacyjnymi | 0.20 |
| `skinTypeFit` | dopasowanie formuły do typu cery | 0.15 |
| `formulaSafety` | brak czynników ryzyka dla tego profilu | 0.15 |
| `preferenceFit` | wegańskość, cruelty-free, bezzapachowość, marki | 0.10 |
| `valueFit` | budżet i cena za 100 ml względem kategorii | 0.10 |
| `shelfFit` | komplementarność i konflikty z Moją Półką | 0.05 |

Wagi trzymamy w `MatchWeightSet.weights` (patrz `03`), nie w kodzie. Będziesz je
tuningować co tydzień przez pierwsze pół roku i nie chcesz do tego deployu.

### 3.1 Ważenie pozycją składnika

Kolejność INCI odpowiada malejącemu stężeniu (do progu 1%). Składnik na pozycji 2
znaczy dużo więcej niż na pozycji 27. Użyj wagi logarytmicznej, jak w DCG:

```ts
const positionWeight = (position: number) => 1 / Math.log2(position + 1);
// poz. 1 → 1.00   poz. 3 → 0.50   poz. 10 → 0.29   poz. 30 → 0.20
```

Składniki po `may contain` / `+/-` dostają wagę 0.1 — mogą, ale nie muszą być obecne.

To jest realna różnica jakościowa wobec konkurencji, która zwykle traktuje listę
składników jako zbiór bez kolejności.

### 3.2 formulaSafety — kary, nie bonusy

```ts
let penalty = 0;
if (profile.sensitivityLevel >= 2 && traits.hasFragranceAllergen) penalty += 0.35;
if (profile.fragrancePreference === 'FREE' && traits.hasFragrance)  penalty += 0.50;
if (profile.skinType === 'DRY' && traits.alcoholDenatPosition
    && traits.alcoholDenatPosition <= 5)                            penalty += 0.30;
if (profile.concerns.has('ACNE') && traits.comedogenicRisk > 0.6)    penalty += 0.25;
if (profile.sensitivityLevel === 3 && traits.hasEssentialOils)       penalty += 0.20;
const formulaSafety = Math.max(0, 1 - penalty);
```

Kary nigdy nie pojawiają się w przebiegu A — to gwarantuje warunek dopuszczalności.

### 3.3 shelfFit — jedyna oś, której nikt inny nie ma

Wykorzystuje `UserShelfItem` do dwóch rzeczy:

- **Konflikty:** silny retinoid + kwas AHA/BHA + witamina C w wysokim stężeniu
  używane jednocześnie. Nie „to szkodliwe" — tylko „te produkty zwykle stosuje się
  naprzemiennie" (patrz `02_RODO.md`, sekcja 9).
- **Luki:** profil z celem `SUN_PROTECTION`, a na półce nie ma SPF → produkty z SPF
  dostają bonus.
- **Redundancja:** trzecie serum nawilżające dostaje karę. To buduje zaufanie —
  aplikacja, która czasem mówi „tego nie potrzebujesz", jest wiarygodniejsza niż taka,
  która zawsze poleca zakup.

---

## 4. Kalibracja — jak nie pokazywać 87% dla wszystkiego

**To jest problem, na którym wykłada się większość takich systemów.** Naiwna suma ważona
daje rozkład skupiony w przedziale 60–80%. Wszystko wygląda na „dobre dopasowanie",
liczba przestaje cokolwiek znaczyć, użytkownik przestaje jej ufać.

Rozwiązanie: **kalibracja percentylowa w obrębie kategorii, policzona offline.**

1. Raz na dobę (albo po dużym imporcie) worker liczy surowe wyniki dla ~30 profili
   referencyjnych × wszystkie produkty w każdej kategorii.
2. Dla każdej kategorii zapisuje 20 punktów rozkładu (percentyle 5, 10, …, 100)
   do `MatchCalibration(categoryId, percentiles Float[])`.
3. Wynik wyświetlany = interpolacja percentyla surowego wyniku, przemapowana na 40–99.

Efekt: „92%" znaczy „lepszy niż 92% kremów nawilżających dla Twojego profilu".
To jest zdanie, które da się napisać w UI i które jest prawdziwe.

Deterministyczne, tanie w runtime (interpolacja po tablicy), wersjonowane razem z wagami.

### Pasma zamiast gołych liczb

```ts
score >= 90  → "Doskonałe dopasowanie"
score >= 78  → "Bardzo dobre dopasowanie"
score >= 65  → "Dobre dopasowanie"
score >= 50  → "Przeciętne dopasowanie"
score <  50  → NIE pokazuj procentu — pokaż "Słabe dopasowanie" + główny powód
```

Pokazywanie „23% dopasowania" jest zniechęcające i bezużyteczne. Pokaż powód:
„Zawiera kompozycję zapachową, a wybrałaś produkty bezzapachowe".

---

## 5. matchConfidence — funkcja, której nie ma konkurencja

Osobna liczba obok wyniku: **na ile kompletne są dane, na których wynik powstał.**

```ts
confidence =
    0.40 * (traits.recognizedRatio)          // ile składników rozpoznaliśmy
  + 0.25 * (traits.ingredientCount > 0 ? 1 : 0)
  + 0.20 * (variant.ean ? 1 : 0)
  + 0.15 * (profileCompleteness);
```

W UI:

```
92%  Doskonałe dopasowanie
     ✓ Pełne dane o składzie

74%  Dobre dopasowanie
     ⚠ Niepełny skład — wynik orientacyjny
```

Dlaczego to jest ważne:

1. **Uczciwość buduje zaufanie.** Aplikacja, która przyznaje się do niepewności,
   jest wiarygodniejsza niż taka, która zawsze podaje pewną liczbę.
2. **Rozwiązuje problem operacyjny.** Przy imporcie z OBF część produktów będzie miała
   dziurawe dane. Zamiast je ukrywać albo udawać, że są kompletne — oznaczasz je
   i pokazujesz.
3. **Napędza pętlę danych.** Niska pewność → CTA „Masz ten produkt? Zrób zdjęcie składu"
   → dane rosną.
4. Nikt tego nie robi. To jest różnica, którą widać na pierwszym ekranie.

Produkty z `confidence < 0.4` nie pojawiają się w rekomendacjach — tylko w wyszukiwaniu
bezpośrednim, z wyraźnym oznaczeniem.

---

## 6. Wyjaśnialność

Serwis zwraca strukturę, nie liczbę:

```ts
interface MatchResult {
  score: number;              // 0-100, po kalibracji
  rawScore: number;           // 0-1, przed kalibracją — do debugowania
  band: MatchBand;
  confidence: number;
  weightSetVersion: number;
  axes: Array<{
    axis: MatchAxis;
    raw: number;              // 0-1
    weight: number;
    contribution: number;     // raw * weight
    drivers: Array<{
      type: 'INGREDIENT' | 'TRAIT' | 'PREFERENCE' | 'PRICE' | 'SHELF';
      label: string;          // "Niacynamid (poz. 4)"
      effect: number;         // dodatni lub ujemny
    }>;
  }>;
  warnings: Array<{ code: string; label: string; severity: 'INFO' | 'WARNING' }>;
  hardBlocks: string[];       // powody wykluczenia, jeśli produkt był filtrowany
}
```

Zastosowania tej samej struktury:

- **UI „Dlaczego 92%?"** — poziomy wykres wkładów, dodatnie w prawo, ujemne w lewo.
  To jest ekran, który sprzedaje produkt.
- **Wejście dla AI** — model dostaje ten JSON i pisze zdanie po polsku. Nie liczy,
  nie interpretuje, nie dodaje faktów. Prompt: „opisz poniższe czynniki naturalnym
  językiem, nie dodawaj informacji spoza JSON-a".
- **Obowiązek informacyjny RODO** (art. 13 ust. 2 lit. f) — spełniony przy okazji.
- **Debugowanie** — gdy ktoś napisze „dlaczego polecacie mi produkt z zapachem",
  masz pełne rozbicie.

---

## 7. Wydajność — konkretne decyzje

**Na MVP nie cachujemy.** Przebieg A to jedno zapytanie po indeksie, przebieg B to
200 obiektów w pamięci. To zmieści się w ~50 ms. Dodawanie cache'a teraz to
optymalizacja bez pomiaru.

**Kiedy cachować:** gdy p95 endpointu rekomendacji przekroczy 200 ms. Wtedy:

```prisma
model MatchScoreCache {
  profileHash      String
  productId        String
  score            Float
  weightSetVersion Int
  computedAt       DateTime @default(now())

  @@id([profileHash, productId])
  @@index([profileHash, score])
}
```

`profileHash` = SHA-256 znormalizowanego profilu. Zmiana profilu → nowy hash →
stare wpisy stają się nieosiągalne i są sprzątane po TTL. Zmiana `weightSetVersion`
albo `traitsVersion` → unieważnienie całości. Żadnej ręcznej inwalidacji.

**Obowiązkowe niezależnie od cache'a:**
- paginacja kluczowa (keyset), nie `OFFSET` — `OFFSET 5000` skanuje 5000 wierszy,
- `LIMIT` na każdym listingu, bez wyjątków,
- `EXPLAIN ANALYZE` na zapytaniu przebiegu A przy 100 tys. produktów, zanim uznasz,
  że działa.

---

## 8. Struktura kodu

```
apps/api/src/match/
├── match.module.ts
├── personal-match.service.ts      // orkiestracja obu przebiegów
├── coarse-query.builder.ts        // buduje SQL przebiegu A
├── axes/
│   ├── concern-coverage.axis.ts
│   ├── goal-alignment.axis.ts
│   ├── skin-type-fit.axis.ts
│   ├── formula-safety.axis.ts
│   ├── preference-fit.axis.ts
│   ├── value-fit.axis.ts
│   └── shelf-fit.axis.ts
├── calibration.service.ts
├── weights.service.ts             // ładuje aktywny MatchWeightSet, cache w pamięci
└── __tests__/
    ├── axes/*.spec.ts             // każda oś osobno, tabela przypadków
    ├── admissibility.spec.ts      // property-based: coarse >= exact
    └── fixtures/                  // 20 profili × 50 produktów, wyniki zamrożone
```

Każda oś to czysta funkcja `(profile, traits, product) => AxisResult`. Bez zależności
od bazy, bez I/O. Dzięki temu testuje się je tabelą przypadków i wykonują się w mikrosekundach.

---

## 9. Testy — pisane razem z kodem, nie po

1. **Test na oś** — tabela: profil, cechy produktu, oczekiwany zakres wyniku.
2. **Test dopuszczalności** — property-based, `coarse >= exact` dla losowych par.
3. **Testy regresyjne (fixtures)** — 20 reprezentatywnych profili × 50 produktów,
   zamrożone wyniki w pliku. Każda zmiana wag pokazuje w diffie, co dokładnie się
   przesunęło. **To jest najważniejszy test w projekcie** — bez niego strojenie wag
   jest strzelaniem w ciemno.
4. **Test sanity** — bezzapachowy krem nigdy nie wygrywa u kogoś, kto zaznaczył
   „bez zapachu", jeśli zawiera `Parfum`. Kilka takich twardych reguł jako siatka
   bezpieczeństwa.

---

## 10. Panel admina — strojenie wag

Ekran `/admin/match`:

- podgląd aktywnego `MatchWeightSet`,
- edycja wag suwakami,
- **przycisk „Symuluj"** — przelicza fixtures z nowymi wagami i pokazuje diff:
  które produkty awansowały, które spadły, dla których profili,
- publikacja jako nowa wersja (stara zostaje, można wrócić),
- wykres rozkładu wyników po kalibracji — sprawdzenie, czy nie zrobił się garb.

Bez tego ekranu tuning algorytmu polega na zmianie liczby, deployu i zgadywaniu.
Z nim — na obejrzeniu skutków przed publikacją. To jedno z lepiej zainwestowanych
dwóch dni w całym projekcie.
