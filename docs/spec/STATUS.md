# STATUS — co jest zrobione z AUDIT.md (stan na 2026-09-01)

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
| 03 §3 | `a16f31d`→`2fc5f11` | **`ProductVariant`** w 3 migracjach (dodaj → backfill → drop): EAN/pojemność/zdjęcie/oferty/historia cen na wariancie, `products` bez kolumn opakowania; DTO ma `variants[]` + pola wariantu domyślnego; przełącznik pojemności na karcie produktu; admin edytuje wariant domyślny, oferta wskazuje wariant |
| 01 et. 2 | `e87b896`→`eaa1db0` | **Katalog OBF**: 18 tagów kategorii (twarz, SPF, oczy, maski, peelingi, demakijaż, dłonie, ciało, włosy) → **1263 produkty, 1076 widocznych (85%)**, 92% wierszy składu dopasowane. Parser: całość tokenu z ukośnikiem przed fragmentami, separatory •/(and)/&/kropka, prefiksy etykiet w 9 językach, sekcje OTC „Active/Inactive ingredients” z dawkami, segmentacja skanów o słownik (tylko pełne pokrycie słów); `ingredient-aliases.json` + `aliases:apply`; `import:obf --refresh`. Opisy EN+PL: seed (`ingredients.pl.json`) + partie `ingredient-prose/obf-batch-{1,2,3}.json` → **90% wierszy składu po polsku**, 419 produktów w całości. Duplikaty seed↔CosIng scalone aliasami (`4fced4a`); `HIDE_DEMO_DATA=true` chowa katalog demo, UI działa bez cen (`5709acf`) |
| 01 et. 1 | `94d418c` | **CosIng**: `npm run import:cosing` (glosariusz 33 654 wpisów przez EU Search API + Aneksy II–VI z CSV; idempotentny, `--dry-run`, `--resume`, `--max-pages`); po pierwszym przebiegu słownik ma **32 860** składników (65 alergenów zapachowych, 281 z Aneksu III, 236 z Aneksu II, 83 funkcje CosIng); `Ingredient.{cosIngRef,casNumber,ecNumber,innName,chemicalDescription,isFragranceAllergen,isRestricted,isProhibited,cosIngAnnex,restrictionNote,isManuallyEdited}`; tabele `IngredientFunction` + `IngredientFunctionOnIngredient`; po imporcie automatyczny rematch kolejki (`UnmatchedTokenService.rematchPending`) i odkrycie ukrytych produktów (`republishHidden`); `npm run ingredients:describe` — opisy AI (`AIProvider.describeIngredient`, structured output) tylko dla składników występujących w produktach; status regulacyjny na stronie składnika i badge na liście produktu; atrybucja CC BY 4.0 na `/about-data` |

## Sesja 2026-09-01 (niecommitowane — do commitu po akceptacji właściciela)

- **Opinie o portalu** (`AppReview`, migracja `20260831100000`): `/reviews` z formularzem (1 opinia na konto, bez edycji, delete+nowa), lista z sortowaniem i sumarycznym rozkładem gwiazdek, marquee `LandingReviews` na dole strony głównej, link w stopce, moderacja w `/admin/reviews` (ukryj/pokaż/usuń), gwiazdki w `BaseIcon` + komponenty `Review*`.
- **8 nowych funkcji** (fazy 1–8, wszystkie z bramkami i smoke testami):
  1. Cena za 100 ml na kartach + sort `price-per-100` (denormalizacja `Product.pricePerHundred`, migracja `20260901100000`, utrzymywana w admin/seed/`prices:demo`).
  2. PAO: `Category.paoMonths` (backfill wg kroku rutyny) + `Product.paoMonths` (override w adminie), półka pokazuje „otwarty/zużyj do/po terminie" + akcje otwarcia/zużycia (migracja `20260901110000`).
  3. Dupe finder: `GET /products/:id/dupes` (fingerprint pgvector + overlap), publiczna strona `/dupes`, przycisk na stronie produktu, link w stopce.
  4. Diff składów w porównywarce (`CompareIngredientsDiff` — wspólne/tylko-w + % zbieżności dla pary; czysty frontend).
  5. Alerty regulacyjne: `RegulatoryChange` (migracja `20260901120000`), diff Aneksów II/III w `applyAnnexes` (bezpiecznik >5% słownika), `GET/POST /shelf/regulatory-alerts(/seen)`, baner na dashboardzie, badge na półce, badge „Aneks II" w składzie.
  6. Zmiana formuły: `ProductFormulaRevision` (migracja `20260901130000`), hash składu przy `applyLabel` tylko z importów źródłowych, `ProductDto.recentFormulaChange` (<90 dni) + rozwijany diff na stronie produktu, lista w `/admin/formula-changes`.
  7. Planer AM/PM: `GET /shelf/routine-plan` — czysty `buildWeekPlan` (SPF rano; retinoid wieczorami naprzemiennie; złuszczanie limitowane wrażliwością, nigdy z retinoidem; maska raz w tygodniu), siatka tygodnia w zakładce rutyny.
  8. Dziennik skóry: `SkinDiaryEntry` na `BeautyProfile` (kasacja ze zgodą; migracja `20260901140000`), moduł `/diary` za `BEAUTY_PROFILE_HEALTH`, strona `/diary` (kalendarz+wpis+statystyki mies./mies.), w eksporcie RODO. **Wersja zgody podbita do `health-2026-09-01`** (hint wspomina dziennik) — istniejący użytkownicy (w tym demo) muszą ją ponowić w profilu/onboardingu.
- Ceny demo: patrz sekcja Środowisko. Baza po restarcie Dockera działa; serwery dev uruchomione w tle.
- Testy: API 216, web 40, i18n:check czysty, format czysty. Nowe klucze i18n z formami mnogimi (`|`).

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

1. **Testy lokalne i poprawki UI (faza bieżąca, 2026-08-31).** Właściciel klika po aplikacji (`npm run dev`, opcjonalnie `HIDE_DEMO_DATA=true`) i zgłasza poprawki wyglądu/drobiazgi — obsługiwać na bieżąco. W kolejce INCI zostało ~184 tokenów-śmieci (marketing w obcych językach) do ręcznego `Ignore` w `/admin/inci-queue`; 29 ukrytych produktów OBF ma zepsute etykiety źródłowe.
2. Akcja „scal jako wariant" w adminie — dwa produkty tej samej formuły w różnych pojemnościach są dziś dwoma produktami, dopóki nie przyjdą z tym samym EAN-em. (`PriceAlert` i półka zostają na produkcie — decyzja.)
3. **Deployment — odłożony decyzją właściciela (2026-08-31)**: najpierw testy lokalne i poprawki; brak domeny (kosvia.pl niekupiona) i decyzji o hostingu. Gdy wróci: zacząć od planu do akceptacji (VPS vs platforma zarządzana, backupy, migracje przy starcie); w repo jest CI, nie ma nic do wystawiania aplikacji.
4. Kolejne rundy katalogu: `import:obf` jest idempotentny — ponowne przebiegi dociągają nowości; po każdym większym imporcie partia opisów (`SELECT` z liczbą wystąpień → plik prose → `ingredients:describe --from=…`).
5. Feedy afiliacyjne (`01` etap 4) — po publicznym uruchomieniu (rejestracja wydawcy wymaga działającej strony).
6. Keyset (`05` §5), autocomplete w nagłówku (`05` §6) — gdy będzie nieskończony scroll.
7. Retencja 24 mies. i maile (karencja usunięcia) — wymagają mailera; `User.lastActiveAt` już jest.
8. Poza kodem: prawnik (`/privacy` to draft inżynierski, DPA z dostawcą LLM, DPIA); `User-Agent` klienta OBF ma placeholder `kontakt@kosvia.pl` — podmienić po zakupie domeny.

**Po `db:reset` (kolejność odtworzenia danych):** `db:seed` → `import:cosing` → `aliases:apply` → `ingredients:describe --from=` dla `ingredients.pl.json` i `ingredient-prose/obf-batch-{1,2,3}.json` → `import:obf` per kategoria.

## Środowisko

- Baza dev: kontener `kosvia-postgres` (`pgvector/pgvector:pg16`, port **5433**); `.env` i `apps/api/.env` wskazują 5433. Homebrew Postgres na 5432 nie jest już używany.
- 16 migracji; `prisma migrate diff` pokazuje fałszywy drift (GIN, kolumna generowana, `vector`) — źródłem prawdy jest `migrate status` + `migrate deploy`.
- `@kosvia/shared` jest czytane przez API z `dist` — po zmianie wartości runtime: `npm run build -w @kosvia/shared`.
- Prettier tylko z roota (`.prettierignore` obejmuje `phrases.generated.ts`, `docs/spec`, migracje); po edycji locale: `npm run sync:phrases -w @kosvia/api`.
- Skrypty: `import:obf`, `import:cosing`, `ingredients:describe`, `aliases:apply`, `traits:recompute`, `account:purge`, `prices:demo` (`-w @kosvia/api`).
- **Ceny demo (2026-09-01)**: katalog OBF nie ma prawdziwych ofert, więc `prices:demo` generuje deterministyczne ceny (widełki per krok rutyny, 3 fejkowe drogerie `drogeria-demo-*`, `DataSource` `demo-prices`, 6 tyg. historii) i przelicza `lowestPrice`. `--dry-run` raportuje, `--remove` cofa wszystko do zera — **wykonać przed podpięciem feedów afiliacyjnych**. Po `db:reset` odpalić ponownie po `import:obf`.
- Konta demo: `demo@kosvia.app / Password123!` (wszystkie zgody), `admin@kosvia.app / Admin123!`.
