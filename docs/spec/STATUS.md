# STATUS — co jest zrobione z AUDIT.md (stan na 2026-08-29)

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

## Decyzje podjęte po drodze (odstępstwa od 00–07)

- **05 §2** — bez denormalizacji `brand_name`/`category_name`: marka i kategoria w rankingu przez trigram + JOIN. Denormalizacja wróci naturalnie z `ProductTraits`, gdy profil zapytań tego zażąda.
- **05 §7** — fingerprint: wymiary 0–19 = 20 tagów słownika, 20–63 = hash id składników `isActiveIngredient` (44 koszyki) zamiast ręcznej listy aktywów.
- **04 §2** — przebieg A dostaje listę id z Prismy (`select id` po filtrach), a nie filtry w SQL. Przy ~100 tys. produktów bez filtrów trzeba przenieść filtry do SQL przebiegu A.
- **02 §4** — konto w karencji **nie jest** zablokowane: logowanie działa, profil pokazuje baner z anulowaniem (brak mailera na link „zmieniłam zdanie").
- **02 §5** — eksport synchroniczny (JSON w odpowiedzi), nie link 24 h.
- **07** — rematch po zmianie aliasu filtruje w pamięci wiersze `ingredientId IS NULL`; przy milionach wierszy dodać `normalizedText` na `ProductIngredient`.
- Nierozpoznane składniki nie są widoczne w publicznym `ProductDto` (filtr `hasMatchedIngredient`) — decyzja UX odłożona.

## Otwarte (osobne zadania, w tej kolejności)

1. **CosIng** (`01` etap 1) — słownik ma 139 składników; wszystkie produkty z OBF są ukryte (rozpoznanie 0.4–0.6). Największa dźwignia jakości.
2. **`ProductVariant`** (`03` §4) — 3-krokowa migracja `ean`/`volume`/`imageUrl`; zrobić **przed** feedami afiliacyjnymi.
3. Feedy afiliacyjne (`01` etap 4) — po publicznym uruchomieniu.
4. Keyset (`05` §5), autocomplete w nagłówku (`05` §6) — gdy będzie nieskończony scroll.
5. Retencja 24 mies. i maile (karencja usunięcia) — wymagają mailera; `User.lastActiveAt` już jest.
6. Poza kodem: prawnik (`/privacy` to draft inżynierski, DPA z dostawcą LLM, DPIA); `User-Agent` klienta OBF ma placeholder `kontakt@kosvia.pl`.

## Środowisko

- Baza dev: kontener `kosvia-postgres` (`pgvector/pgvector:pg16`, port **5433**); `.env` i `apps/api/.env` wskazują 5433. Homebrew Postgres na 5432 nie jest już używany.
- 15 migracji; `prisma migrate diff` pokazuje fałszywy drift (GIN, kolumna generowana, `vector`) — źródłem prawdy jest `migrate status` + `migrate deploy`.
- `@kosvia/shared` jest czytane przez API z `dist` — po zmianie wartości runtime: `npm run build -w @kosvia/shared`.
- Prettier tylko z roota (`.prettierignore` obejmuje `phrases.generated.ts`, `docs/spec`, migracje); po edycji locale: `npm run sync:phrases -w @kosvia/api`.
- Skrypty: `import:obf`, `traits:recompute`, `account:purge` (`-w @kosvia/api`).
- Konta demo: `demo@kosvia.app / Password123!` (wszystkie zgody), `admin@kosvia.app / Admin123!`.
