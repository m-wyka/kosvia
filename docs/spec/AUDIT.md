# AUDYT KOSVIA — branch `staging`

Audyt na podstawie klonu `m-wyka/kosvia@staging`. Czytanie kodu, bez uruchamiania
(brak `node_modules` i bazy w środowisku audytu — `typecheck`, `lint`, `test`
i `migrate status` zostają do sprawdzenia lokalnie).

**Ten plik koryguje pliki 00–07.** Kilka zaleceń tamtych plików powstało przy błędnym
założeniu, że pewnych rzeczy nie ma. Sekcja 5 mówi, co z nich wykreślić.

---

## 1. Podsumowanie

Repozytorium jest w wyraźnie lepszym stanie, niż zakładała specyfikacja 00–07.
Monorepo działa, layers są wdrożone, i18n jest, testy jednostkowe scoringu
i rekomendacji istnieją, ciasteczka są przekazywane w SSR poprawnie, a warstwa AI
nie wysyła danych osobowych do modelu. Seed to uczciwe dane demonstracyjne — brak
skopiowanych zdjęć, opisów i składów. Ryzyko prawne w obecnym stanie: zerowe.

`PersonalMatchService` jest dobrze napisany: ważenie pozycją składnika, kompresja
tanh zamiast surowej sumy, rozbicie na `reasons`/`warnings`, którego wkłady sumują się
do pokazywanej liczby. To rozwiązuje wyjaśnialność i kalibrację lepiej, niż zakładałem.

Trzy rzeczy są jednak realnymi blokerami dalszego rozwoju: wyszukiwanie po `ILIKE '%…%'`
nie skaluje się i nie da się zaindeksować, sortowanie „best-match" jest przy większym
katalogu po cichu nieprawidłowe, a model danych fizycznie nie potrafi zapisać
nierozpoznanego składnika — co blokuje jakikolwiek import z zewnętrznych źródeł.
Do tego dochodzi całkowity brak warstwy RODO.

---

## 2. Stan faktyczny vs specyfikacja 00–07

| Wymaganie | Plik | Stan | Uwaga |
|---|---|---|---|
| Monorepo + `packages/shared` | 00 | **ZROBIONE** | npm workspaces, `@kosvia/shared` realnie importowany po obu stronach |
| Jedno polecenie startu | 00 | **ZROBIONE** | `npm run setup`, `npm run dev` przez `run-p` |
| Nuxt Layers (core/admin) | 00 | **ZROBIONE INACZEJ** | są i działają; moja rada „odłóż layers" jest nieaktualna |
| i18n | 00 | **CZĘŚCIOWO** | `@nuxtjs/i18n` z pl+en, ale `defaultLocale: 'en'` — patrz R6 |
| `BaseSelect` jako jedyny import multiselecta | 00 | do sprawdzenia lokalnie | `grep -rn "vue-multiselect" apps/web` |
| Ceny jako `Decimal(10,2)` | 03 | **ZROBIONE** | wszystkie pola, zero `Float` |
| `PriceHistory` | 03 | **ZROBIONE** | model istnieje, append-only |
| `excludedIngredients` w profilu | 03 | **ZROBIONE** | relacja m2m; brak rozróżnienia alergia/preferencja |
| `onDelete` na relacjach do `User` | 03 | **ZROBIONE** | wszystkie jawne, Cascade/SetNull |
| `ProductVariant` | 03 | **BRAK** | `ean`/`volume` siedzą na `Product` |
| `IngredientAlias` | 03 | **BRAK** | blokuje normalizację INCI |
| `ProductTraits` | 03 | **CZĘŚCIOWO** | `ingredientScore`, `lowestPrice`, `isFragranceFree`, `targetSkinTypes` już zdenormalizowane na `Product` |
| `DataSource` (pochodzenie) | 03 | **BRAK** | wymagane przed importem z Open Beauty Facts |
| `UserConsent` | 02 | **BRAK** | — |
| Usunięcie konta | 02 | **BRAK** | `DELETE /profile` czyści profil urodowy, nie konto |
| Eksport danych | 02 | **BRAK** | — |
| AI bez danych osobowych | 02 | **ZROBIONE** | `describeProfile()` zwraca anonimowy opis, w prompcie nie ma maila ani `userId` |
| Rate limiting | 02 | **ZROBIONE** | globalny `ThrottlerGuard` + `@Throttle` na `/auth/*` i `/ai/*` |
| Ważenie pozycją składnika | 04 | **ZROBIONE** | `positionWeight()` |
| Wyjaśnialność wyniku | 04 | **ZROBIONE** | `reasons`/`warnings` z wkładami skalowanymi do wyniku |
| Kalibracja wyniku | 04 | **ZROBIONE INACZEJ** | kompresja tanh; patrz sekcja 5 |
| Wagi poza kodem (`MatchWeightSet`) | 04 | **BRAK** | `const WEIGHTS` w pliku |
| Dwuprzebiegowy scoring | 04 | **BRAK** | patrz R2 — to jest bug, nie tylko wydajność |
| `matchConfidence` | 04 | **BRAK** | — |
| FTS / `pg_trgm` / rozszerzenia | 05 | **BRAK** | patrz R1 |
| Paginacja kluczowa | 05 | **BRAK** | offset |
| Fasety | 05 | **CZĘŚCIOWO** | tylko marki, kategorie, zakres cen; brak liczników filtrów boolean |
| Ciasteczka SSR | 06 | **ZROBIONE** | plugin przekazuje `cookie`, deduplikuje odświeżanie tokenu |
| Rotacja refresh tokenów | 06 | **CZĘŚCIOWO** | `RefreshToken` z hashem i `revokedAt`; brak detekcji ponownego użycia |
| `routeRules` / cache SSR | 06 | **BRAK** | brak cache'u; brak też wycieku — patrz R5 |
| Brak scrapowanych zdjęć | 01 | **ZROBIONE** | placeholdery SVG generowane w Nitro, zero odwołań do domen sklepów |
| Testy logiki biznesowej | 00 | **ZROBIONE** | scoring, rekomendacje, porównanie, kontroler auth |

---

## 3. Ryzyka — w kolejności naprawy

### R1 — Wyszukiwanie nie da się zaindeksować (KRYTYCZNE dla skali)

`apps/api/src/modules/products/products.service.ts`, `buildWhere()`:

```ts
{ name: { contains: term, mode: 'insensitive' } }
{ brand: { name: { contains: term, mode: 'insensitive' } } }
{ ingredients: { some: { ingredient: { inciName: { contains: term } } } } }
```

`contains` generuje `ILIKE '%term%'`. Wiodący `%` uniemożliwia użycie indeksu B-tree —
przy każdym zapytaniu to sekwencyjny skan `products`. Trzeci warunek dodatkowo robi
podzapytanie po tabeli łączącej.

Na 100 produktach niewidoczne. Na 50 tysiącach — sekundy.

Naprawa: plik `05_WYSZUKIWARKA.md` w całości. Minimum: `pg_trgm` + indeks GIN
na `name` i `brand.name`, docelowo `tsvector`.

### R2 — Sortowanie „best-match" jest nieprawidłowe (KRYTYCZNE dla produktu)

Ten sam plik, `search()`:

```ts
const needsClientSort = query.sort === 'best-match' || query.sort === 'recommended';
...take: Math.min(240, page * pageSize + pageSize * 4)
```

Przy sortowaniu po dopasowaniu pobierane jest **maksymalnie 240 produktów uszeregowanych
przez bazę według `ingredientScore`**, dopiero one są punktowane i przesortowane
w pamięci.

Konsekwencja: produkt idealnie dopasowany do użytkownika, ale zajmujący 300. miejsce
według jakości formuły, **nigdy nie pojawi się w wynikach** — niezależnie od tego,
jak wysoki byłby jego Personal Match. Przy 100 produktach limit nigdy nie działa,
więc bug jest niewidoczny. Przy 5 tysiącach główna funkcja produktu zaczyna cicho kłamać.

To jest dokładnie problem, który rozwiązuje dwuprzebiegowa architektura
z `04_PERSONAL_MATCH.md`, sekcja 2 — z gwarancją, że zgrubny przebieg jest górnym
ograniczeniem dokładnego, więc żaden produkt nie ginie.

Naprawa wymaga tabeli `ProductTraits` (kolumny numeryczne, po których da się liczyć
wynik w SQL). Dopóki jej nie ma, jedyne uczciwe rozwiązanie tymczasowe to **usunąć
opcję „best match" z listingu** i zostawić ją tylko tam, gdzie zbiór kandydatów jest
z natury mały (alternatywy, rekomendacje na stronie głównej, wyniki AI).

### R3 — Model nie potrafi zapisać nierozpoznanego składnika (BLOKER importu)

`schema.prisma`, `ProductIngredient`:

```prisma
ingredientId String                     // NOT NULL
ingredient   Ingredient @relation(...)  // wymagana
// brak rawText
// brak isAfterMayContain
// brak matchConfidence
```

Każdy składnik musi istnieć w słowniku, zanim zapiszesz produkt. Przy seedzie
to działa (seed sam pilnuje spójności). Przy imporcie z Open Beauty Facts, gdzie
30% tokenów nie dopasuje się za pierwszym razem, oznacza to, że **albo odrzucasz
produkt w całości, albo gubisz część składu bez śladu**.

Naprawa: `07_INCI_PIPELINE.md` + zmiany w `ProductIngredient` z `03_MODEL_DANYCH.md`.
`ingredientId` opcjonalny, `rawText` obowiązkowy. To musi być zrobione **przed**
pierwszym importem, bo potem migracja dotyka tabeli z milionami wierszy.

Uwaga dodatkowa: `@@unique([productId, ingredientId])` uniemożliwia zapisanie
składnika występującego na liście dwa razy (rzadkie, ale się zdarza — np. różne
frakcje tego samego surowca). Właściwym kluczem jest `@@unique([productId, position])`.

### R4 — Ciasteczka: `SameSite=None` na produkcji (WYSOKIE)

`apps/api/src/modules/auth/auth.cookies.ts`:

```ts
sameSite: settings.secure ? 'none' : 'lax',
```

W dev ciasteczko jest `Lax` (localhost:3000 → localhost:3001 to ten sam site),
na produkcji `None`. Czyli **dev i produkcja zachowują się inaczej w warstwie,
która decyduje o logowaniu**. `SameSite=None` wymaga ciasteczek trzeciej strony,
które Safari blokuje domyślnie, a Chrome ogranicza.

Do tego frontend uderza bezpośrednio w `config.public.apiBase` (czyli `API_URL`),
więc przeglądarka faktycznie robi żądania cross-origin z `credentials: 'include'`.

Dwa poprawne wyjścia, oba lepsze od obecnego:
- **proxy przez Nitro** (`06_AUTH_SSR_CACHE.md`, sekcja 1) — `SameSite=Lax`, zero CORS,
  identyczne zachowanie w dev i prod;
- **`api.kosvia.pl` + `Domain=.kosvia.pl`** — wtedy to jest ten sam site
  i `SameSite=Lax` wystarczy; `None` nie jest potrzebne.

Czego nie robić: zostawić `None`. To działa dziś i przestanie działać po kolejnej
zmianie polityki przeglądarek.

Brakuje też detekcji ponownego użycia refresh tokenu — `RefreshToken` ma `revokedAt`,
ale użycie odwołanego tokenu nie unieważnia całej rodziny sesji.

### R5 — RODO: brak całej warstwy (WYSOKIE, przed premierą)

Konkretnie brakuje: modelu zgód, wyraźnej zgody na dane z art. 9 (typ cery,
trądzik, zaczerwienienia, alergie), usunięcia konta, eksportu danych, weryfikacji
wieku, informacji o dostawcy modelu AI jako podmiocie przetwarzającym.

`DELETE /profile` resetuje profil urodowy — to dobra podstawa pod odwołanie zgody,
ale nie jest usunięciem konta.

Dobra wiadomość: warstwa AI jest już czysta (brak PII w prompcie), a wyjaśnialność
wyniku, którą trzeba by dopisać ze względu na art. 13 ust. 2 lit. f, już istnieje.
Zostaje głównie mechanika zgód i usuwania. Plik `02_RODO.md` w całości nadal aktualny.

### R6 — `defaultLocale: 'en'` w aplikacji na rynek polski (ŚREDNIE)

`nuxt.config.ts`:

```ts
defaultLocale: 'en',
strategy: 'prefix_except_default',
```

Angielski jest pod `/`, polski pod `/pl/...`. Dla produktu z cenami w PLN i polskimi
drogeriami to odwrotnie, niż powinno być: cała wartość SEO — a to jest kanał, na
którym ten produkt stoi lub upada — idzie na wersję językową, której nie szuka
Twój rynek.

Zmiana teraz to jedna linijka plus przekierowania. Po zaindeksowaniu — utrata pozycji.

### R7 — Brak cache'u SSR (NISKIE dziś, ale uwaga na przyszłość)

`routeRules` nie ma wcale, więc każde wejście na stronę produktu renderuje się od zera.
Dobra strona: nie ma ryzyka wycieku danych między użytkownikami.

Gdy będziesz dokładał `swr` dla SEO — obowiązuje reguła z `06_AUTH_SSR_CACHE.md`,
sekcja 2: trasa z `swr`/`isr` nie może renderować Personal Match po stronie serwera.
Obecna architektura na to pozwala (`personalised: false` dla anonima), ale trzeba
świadomie rozdzielić warstwę publiczną od osobistej, zanim włączysz cache.

---

## 4. Drobiazgi warte zapisania

- `docker-compose.yml` używa `postgres:16-alpine` bez `pg_trgm`/`vector`.
  Zmiana na `pgvector/pgvector:pg16` przy okazji R1.
- Brak CI (`.github/workflows`). `typecheck`, `lint`, `test` są w skryptach, ale nikt
  ich nie egzekwuje na PR.
- Brak `/health` i `/health/ready`.
- `categoryWithDescendants()` robi zapytanie na każdy poziom drzewa w pętli. Drzewo ma
  trzy poziomy, więc to trzy zapytania na każde wyszukiwanie z filtrem kategorii —
  kandydat do rekursywnego CTE albo cache'u w pamięci.
- `facets()` odpala pięć zapytań agregujących na każde wyszukiwanie.
- Brak liczników przy filtrach boolean (bezzapachowe, wegańskie) — jest tylko
  marka, kategoria i zakres cen.
- Brak `AuditLog` w panelu admina.
- Seed: ~34 archetypy formuł × marki. Deklarowane jako dane demo, INCI wiarygodne
  i nieskopiowane. Dobra robota, ale to nie zastąpi importu.

---

## 5. Korekty do plików 00–07

Wykreśl lub zmień następujące fragmenty:

| Plik | Co jest nieaktualne | Zamiast tego |
|---|---|---|
| `00`, 1.3 | „Nuxt Layers — odkładamy" | layers są wdrożone i działają; zostawić |
| `00`, 1.6 | „i18n — decyzja teraz" | i18n jest; zostaje **tylko** zmiana `defaultLocale` na `pl` (R6) |
| `00`, 1.2 | sugestia migracji na pnpm | npm workspaces działa; migracja to koszt bez korzyści |
| `02` | — | bez zmian, cały aktualny |
| `03`, §2 | „ceny — nigdy Float" | zrobione, pominąć |
| `03`, §6 | „`ExcludedIngredient` — brakowało" | relacja jest; zostaje **tylko** dodanie rozróżnienia `ALLERGY`/`PREFERENCE` |
| `03`, §7 | „`PriceHistory` — brak" | jest, pominąć |
| `03`, §10 | „przejrzyj `onDelete`" | zrobione, pominąć |
| `04`, §4 | kalibracja percentylowa | kompresja tanh już rozwiązuje ten problem i jest prostsza; **nie zastępuj jej** — dołóż tylko pasma tekstowe i ukrycie procentu poniżej 50 |
| `04`, §3.1 | ważenie pozycją | zrobione, pominąć |
| `04`, §6 | struktura wyjaśnień | zrobione w innym kształcie (`reasons`/`warnings`); dostosuj plik do istniejącego `PersonalMatchDto`, nie odwrotnie |
| `04`, §2 | dwa przebiegi | **nadal krytyczne** — to R2, nie tylko wydajność |
| `06`, §1 | „wybierz proxy" | decyzja bez zmian, ale powód jest teraz konkretny: naprawa `SameSite=None` (R4) |
| `06`, §1 „przekazywanie ciasteczek w SSR" | — | zrobione poprawnie, pominąć |
| `07` | — | bez zmian, cały aktualny, priorytet podniesiony przez R3 |

---

## 6. Proponowana kolejność

1. **R3** — `ProductIngredient` przyjmuje nierozpoznane składniki + `IngredientAlias`.
   Musi być przed importem czegokolwiek.
2. **`07_INCI_PIPELINE.md`** — parser, dopasowanie, kolejka w adminie.
3. **R1** — rozszerzenia Postgres, `pg_trgm`, `tsvector`, indeksy.
4. **Import z Open Beauty Facts** (`01`) — dopiero teraz ma sens, bo jest gdzie
   wylądować i czym szukać.
5. **`ProductTraits` + R2** — dwuprzebiegowy scoring. Konieczne, gdy katalog
   przekroczy kilka tysięcy pozycji, czyli zaraz po kroku 4.
6. **R4** — ciasteczka i proxy.
7. **R6** — `defaultLocale`, zanim cokolwiek się zaindeksuje.
8. **R5** — RODO, przed publicznym uruchomieniem.
9. `ProductVariant`, `DataSource`, `MatchWeightSet`, `AuditLog`, CI, health.

Kroki 1–4 są zależne sekwencyjnie. Reszta jest w dużej mierze równoległa.

---

## 7. Czego nie ustaliłem

- Czy `typecheck`, `lint` i `test` przechodzą — nie uruchamiałem (brak zależności
  i bazy w środowisku audytu). Sprawdź lokalnie.
- Czy `prisma migrate status` jest czysty — jest jedna migracja `20260828102955_init`.
- Stan warstwy UI: nie oceniałem jakości wizualnej ani spójności komponentów
  bazowych, poza obecnością katalogu `components/base`.
- Czy w `.env` lokalnie nie ma sekretów, które trafiły do historii commitów —
  `.env.example` jest czysty, historii nie przeglądałem.
