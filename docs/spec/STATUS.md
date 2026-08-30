# STATUS — co jest zrobione z AUDIT.md (stan na 2026-08-30)

Ten plik jest nowszy niż `AUDIT.md`. Sekcje 3 i 6 audytu są **wykonane w całości**;
czytaj to zamiast nich. Reszta audytu (stan faktyczny, korekty do plików 00–07) nadal aktualna.

## Zamknięte (commit → zakres)

| Krok | Commit | Efekt |
|---|---|---|
| R3 | `1010bf2` | `ProductIngredient.ingredientId?`, `rawText`, `isAfterMayContain`, `matchConfidence`, `@@unique([productId, position])`; `IngredientAlias` |
| 07 | `b55513e` | `apps/api/src/modules/inci/` — parser (czysty, fixture'y), matcher L1–3, `UnmatchedToken`, `ProductSubmission`, kolejka `/admin/inci-queue`, import składu z etykiety w adminie |
| R1 | `354bfaa` | `pg_trgm` + `unaccent` + `tsvector` (kolumna generowana, `f_unaccent`, `f_join_text`), `SearchProvider`/`PostgresSearchProvider` (EAN → FTS → trigram), `GET /products/suggest`, `SearchLog`, matcher L4 (propozycje w kolejce) |
| 01 | `1fb7e2e` | `DataSource`, `ImportRun`, `isManuallyEdited`; `npm run import:obf` (idempotentny, `--dry-run`, `--resume`); atrybucja ODbL na stronie produktu, `/about-data`, `/admin/imports` |
| R2 | `a929d9c` | `ProductTraits` (+ `fingerprint vector(64)`, HNSW), `ProductTraitsService` = jedyne miejsce przeliczania `ingredientScore`; `CoarseMatchService` (przebieg A w SQL) + test właściwościowy `coarse ≥ exact`; `best-match`/`recommended` dwuprzebiegowe; alternatywy po fingerprincie; fasety boolean z licznikami, filtr `spf` |
| R6 | `bcfbc23` | `defaultLocale: 'pl'`, `/pl/**` → 301, AI domyślnie po polsku |
| R4 | `4c963e2` | Proxy `/api/**` w Nitro (`server/routes/api/[...path].ts`), `SameSite=Lax`, brak `Domain`, wykrywanie replaya refresh tokena (odwołuje wszystkie sesje) |
| R5 | `6736182` | `UserConsent` (wersjonowane zdarzenia), `@RequiresConsent` + `ConsentGuard` (403 `CONSENT_REQUIRED`), rejestracja z datą urodzenia (16+) i zgodami, `DELETE /account` z 7-dniową karencją + worker/`npm run account:purge`, `GET /account/export`, `SanitizedAIProvider` (klasa bazowa, test z e-mailem w każdym polu), walidator języka medycznego, `/privacy` |
| 9 | `735a715` | GitHub Actions (`checks` + `database` na `pgvector/pgvector:pg16`), `/health` + `/health/ready`, `AuditLog` + `/admin/audit` |
| 9 | `00149ff` | `MatchWeightSet` (`/admin/match-weights`), wagi wstrzykiwane do obu przebiegów; procent < 50 ukryty (pasma) |
| 9 | `6fc6bf1` | `ProfileExcludedIngredient` z `reason: ALLERGY \| PREFERENCE` — alergia = twardy filtr, preferencja = kara |
| 01 et. 1 | _(bieżący)_ | **CosIng**: `npm run import:cosing` (glosariusz 33 654 wpisów przez EU Search API + Aneksy II–VI z CSV; idempotentny, `--dry-run`, `--resume`, `--max-pages`); po pierwszym przebiegu słownik ma **32 860** składników (65 alergenów zapachowych, 281 z Aneksu III, 236 z Aneksu II, 83 funkcje CosIng); `Ingredient.{cosIngRef,casNumber,ecNumber,innName,chemicalDescription,isFragranceAllergen,isRestricted,isProhibited,cosIngAnnex,restrictionNote,isManuallyEdited}`; tabele `IngredientFunction` + `IngredientFunctionOnIngredient`; po imporcie automatyczny rematch kolejki (`UnmatchedTokenService.rematchPending`) i odkrycie ukrytych produktów (`republishHidden`); `npm run ingredients:describe` — opisy AI (`AIProvider.describeIngredient`, structured output) tylko dla składników występujących w produktach; status regulacyjny na stronie składnika i badge na liście produktu; atrybucja CC BY 4.0 na `/about-data` |

## Decyzje podjęte po drodze (odstępstwa od 00–07)

- **05 §2** — bez denormalizacji `brand_name`/`category_name`: marka i kategoria w rankingu przez trigram + JOIN. Denormalizacja wróci naturalnie z `ProductTraits`, gdy profil zapytań tego zażąda.
- **05 §7** — fingerprint: wymiary 0–19 = 20 tagów słownika, 20–63 = hash id składników `isActiveIngredient` (44 koszyki) zamiast ręcznej listy aktywów.
- **04 §2** — przebieg A dostaje listę id z Prismy (`select id` po filtrach), a nie filtry w SQL. Przy ~100 tys. produktów bez filtrów trzeba przenieść filtry do SQL przebiegu A.
- **02 §4** — konto w karencji **nie jest** zablokowane: logowanie działa, profil pokazuje baner z anulowaniem (brak mailera na link „zmieniłam zdanie").
- **02 §5** — eksport synchroniczny (JSON w odpowiedzi), nie link 24 h.
- **07** — rematch po zmianie aliasu filtruje w pamięci wiersze `ingredientId IS NULL`; przy milionach wierszy dodać `normalizedText` na `ProductIngredient`.
- **01 et. 1** — funkcje CosIng są tabelą (`IngredientFunction`), ale `Ingredient.tags` zostaje tablicą stringów: tagi to wejście scoringu i mapują się z funkcji CosIng deterministycznie (`FUNCTION_TAGS` w `cosing-mapper.ts`); szerokie funkcje (SKIN CONDITIONING) nie dają tagu. Import nie dotyka `tags`, `sensitivityImpact`, `isActiveIngredient` na wpisach ręcznych (`isManuallyEdited`) ani na wpisach, które już mają tagi.
- **01 et. 1** — nazwy CosIng, które po `normalizeToken` zlewają się w jeden token (nawiasy są usuwane — ok. 3%, egzotyczne polimery/peptydy), są pomijane jako `duplicate-name`; `normalizedName` musi być jednoznaczne dla matchera.
- **01 et. 1** — opisy składników mają wersję EN (`description`, `functions`, `commonName`, `concerns`) i PL (kolumny `…Pl`); API wybiera po `Accept-Language` (`@RequestLocale()`, front wysyła aktywne locale w `01.api.ts`), fallback EN. Describer generuje obie naraz wyłącznie z faktów CosIng i tłumaczy 139 wpisów z seeda; provider offline zwraca `null`.
- **01 et. 1** — EU Search API ucina paginację na 10 000 trafień (`max_result_window`), więc glosariusz jest czytany w zakresach `substanceId` po pierwszej cyfrze (`planIngredientRanges`); zakres od `"0"` API odpowiada całym zbiorem, dlatego pierwsza cyfra zaczyna się od 1.
- **01 et. 1** — klucz do EU Search API pochodzi z publicznego configu aplikacji CosIng (`assets/env-json-config.json`); jeśli KE go zmieni, trzeba podmienić `SEARCH_API_KEY` w `cosing-client.ts`.
- Nierozpoznane składniki nie są widoczne w publicznym `ProductDto` (filtr `hasMatchedIngredient`) — decyzja UX odłożona.

## Otwarte (osobne zadania, w tej kolejności)

1. **Pierwsze prawdziwe produkty — w toku (2026-08-30).** `import:obf` (kremy do twarzy, bez filtra kraju): 137 produktów, 107 widocznych (78%), skład rozpoznany w 92% wierszy; po poprawkach parsera/matchera **117 widocznych (85%), 96% wierszy dopasowanych, 184 tokeny w kolejce** (pozostałość to teksty marketingowe w obcych językach — do ręcznego Ignore w adminie). Poprawki: całość tokenu z ukośnikiem dopasowywana przed fragmentami („Caprylic/Capric Triglyceride”), separatory „•/⚫/(and)/&/kropka”, prefiksy etykiet w 9 językach, `ingredient-aliases.json` + `npm run aliases:apply` (także po `db:reset`), `import:obf --refresh` do ponownego parsowania bez zmiany źródła. Opisy EN+PL: 139 z seeda (`prisma/seed/data/ingredients.pl.json`) + 260 najczęstszych z etykiet (`prisma/seed/data/ingredient-prose/obf-batch-1.json`, `obf-batch-2.json`; pokrycie 91% wierszy składu, 154 produkty opisane w całości, zostaje ogon 383 składników o 1–4 wystąpieniach); oba pliki wgrywa `ingredients:describe --from=…` i **po `db:reset` trzeba je wgrać ponownie po `import:cosing`**. Kategorie OBF (2026-08-30, po ~200): kremy, sera, oczyszczanie, SPF, toniki, nawilżanie → **240 produktów, 199 widocznych (83%)**. Opisy: partie 1–3 (`obf-batch-{1,2,3}.json`, razem 380 składników) → **92% wierszy składu po polsku**, 187 produktów w całości; ogon 514 rzadkich. Duplikaty seed↔CosIng scalone (12 par): seed używa teraz kanonicznych INCI (`formulas.ts`/`ingredients.ts` przemianowane), stare nazwy zostały aliasami; na dev zmigrowane jednorazowym skryptem (usunięty). Uwaga: `Paraffinum Liquidum` i `Mineral Oil` to dwa osobne wpisy CosIng — zostają rozdzielone.
2. **`ProductVariant`** (`03` §3) — **zrobione w całości** (2026-08-30, 3 migracje: `add_product_variant` → `variants:backfill` (skrypt usunięty po użyciu) → `drop_product_pack_columns`). `products` nie ma już `ean/volume/volumeUnit/imageUrl`; oferty i historia cen należą do wariantu. Otwarte w tym obszarze: akcja „scal jako wariant" w adminie (dwa produkty tej samej formuły w różnych pojemnościach nadal są dwoma produktami, dopóki nie przyjdą z tym samym `sourceRef`/EAN-em); `PriceAlert` i półka pozostają na produkcie (decyzja).
3. Feedy afiliacyjne (`01` etap 4) — po publicznym uruchomieniu.
4. Keyset (`05` §5), autocomplete w nagłówku (`05` §6) — gdy będzie nieskończony scroll.
5. Retencja 24 mies. i maile (karencja usunięcia) — wymagają mailera; `User.lastActiveAt` już jest.
6. Przygotowanie pod publiczny start (2026-08-30): `HIDE_DEMO_DATA=true` chowa katalog demo (źródło `manual` lub brak źródła) na wszystkich publicznych ścieżkach (`publicProductWhere()` / `isProductVisible()` w `products/product-visibility.ts`; admin widzi wszystko); UI radzi sobie bez cen — karta ofert i przycisk alertu cenowego znikają, gdy produkt nie ma ofert. Smoke na dev: flaga on → 199 produktów (sam OBF), off → 331.
7. Poza kodem: prawnik (`/privacy` to draft inżynierski, DPA z dostawcą LLM, DPIA); `User-Agent` klienta OBF ma placeholder `kontakt@kosvia.pl`.

## Środowisko

- Baza dev: kontener `kosvia-postgres` (`pgvector/pgvector:pg16`, port **5433**); `.env` i `apps/api/.env` wskazują 5433. Homebrew Postgres na 5432 nie jest już używany.
- 16 migracji; `prisma migrate diff` pokazuje fałszywy drift (GIN, kolumna generowana, `vector`) — źródłem prawdy jest `migrate status` + `migrate deploy`.
- `@kosvia/shared` jest czytane przez API z `dist` — po zmianie wartości runtime: `npm run build -w @kosvia/shared`.
- Prettier tylko z roota (`.prettierignore` obejmuje `phrases.generated.ts`, `docs/spec`, migracje); po edycji locale: `npm run sync:phrases -w @kosvia/api`.
- Skrypty: `import:obf`, `import:cosing`, `ingredients:describe`, `traits:recompute`, `account:purge` (`-w @kosvia/api`).
- Konta demo: `demo@kosvia.app / Password123!` (wszystkie zgody), `admin@kosvia.app / Admin123!`.
