# KOSVIA — MASTER / SPIS DECYZJI

> **Kontekst dla Claude Code:** repozytorium Kosvia już istnieje i zostało zbudowane
> na podstawie wcześniejszego promptu (sekcje 1–74). Ten zestaw plików to **poprawki
> i uzupełnienia do istniejącego kodu**, a nie specyfikacja od zera.
>
> **Zawsze zacznij od inspekcji repozytorium.** Nie przepisuj tego, co działa.
> Jeżeli coś w tych plikach jest już zaimplementowane — zweryfikuj i pomiń.

---

## 0. Jak używać tego zestawu

| Plik | Zakres | Priorytet |
|---|---|---|
| `00_MASTER.md` | decyzje architektoniczne, kolejność prac | przeczytaj pierwszy |
| `01_DANE_ZRODLA.md` | skąd biorą się produkty, INCI, zdjęcia, ceny | **krytyczny** |
| `02_RODO.md` | zgody, art. 9, usuwanie konta, eksport, LLM | **krytyczny** |
| `03_MODEL_DANYCH.md` | poprawki schema.prisma + migracje | **krytyczny** |
| `04_PERSONAL_MATCH.md` | algorytm dopasowania, wydajność, wyjaśnialność | wysoki |
| `05_WYSZUKIWARKA.md` | Postgres FTS, fasety, podobieństwo składów | wysoki |
| `06_AUTH_SSR_CACHE.md` | ciasteczka Nuxt↔Nest, cache SSR vs personalizacja | wysoki |
| `07_INCI_PIPELINE.md` | parsowanie i normalizacja list składników | wysoki |

Kolejność wdrażania: `03` → `07` → `01` → `04` → `05` → `06` → `02`.
Uzasadnienie: model danych jest fundamentem, pipeline INCI musi istnieć zanim
zaimportujesz cokolwiek, a scoring bez znormalizowanych składników nie ma sensu.
RODO na końcu, bo dotyka wielu miejsc naraz — łatwiej to dopiąć, gdy encje są stabilne.

---

## 1. Decyzje architektoniczne — rozstrzygnięcia

### 1.1 NestJS vs Nitro — **zostajemy przy NestJS**

Aplikacja jest już zbudowana z NestJS jako głównym API. Migracja do Nitro to kilka
tygodni pracy bez korzyści dla użytkownika. NestJS zresztą zarobi na siebie, gdy dojdą
importy feedów, cron i workery (patrz `01_DANE_ZRODLA.md` — to nie jest odległa przyszłość,
tylko druga faza).

**Ale trzeba domknąć trzy rzeczy, które przy dwóch procesach zawsze bolą:**

1. **Typy współdzielone.** Jedno miejsce prawdy: `packages/shared` eksportuje typy DTO
   i enumy, importowane po obu stronach. Zero ręcznego duplikowania interfejsów w Nuxcie.
   Jeżeli obecnie typy są duplikowane — scal je.
2. **Ciasteczka i CORS.** Rozstrzygnięte w `06_AUTH_SSR_CACHE.md` (proxy przez Nitro).
3. **Jedno polecenie startu.** `pnpm dev` musi podnosić web + api + Postgres.
   Jeżeli teraz trzeba trzech terminali — napraw to.

### 1.2 Monorepo — zostaje

`apps/web`, `apps/api`, `packages/shared`. Menedżer pakietów: **pnpm** z workspaces.
Jeżeli repo używa npm — migracja jest tania i warta zachodu (linkowanie workspace'ów).

### 1.3 Nuxt Layers — **odkładamy**

Layer dla admina to rozwiązanie problemu, którego jeszcze nie masz. Na tym etapie
wystarczy:

```
app/pages/admin/**        + definePageMeta({ layout: 'admin', middleware: 'admin' })
app/layouts/admin.vue
app/middleware/admin.ts
```

Do layers wracamy, gdy admin urośnie ponad ~15 stron albo gdy pojawi się druga aplikacja
publiczna. Wtedy migracja jest mechaniczna. **Jeżeli layers są już zaimplementowane i działają —
zostaw je, nie cofaj.**

### 1.4 vue-multiselect — zostaje

Decyzja użytkownika, poparta doświadczeniem. Warunek pozostaje jeden: cała aplikacja
używa wyłącznie `BaseSelect.vue`, nigdzie indziej nie importujemy `vue-multiselect`
bezpośrednio. To już jest w sekcji 56 pierwotnego promptu — wyegzekwuj to
(sprawdź `grep -r "vue-multiselect" apps/web --include="*.vue"`; wynik powinien mieć
dokładnie jeden plik).

### 1.5 Swiper — ograniczamy

Zostaje tam, gdzie jest już użyty i działa. Nowych karuzeli nie robimy na Swiperze —
`overflow-x: auto` + `scroll-snap-type: x mandatory` daje ten sam efekt bez ~40 kB.
Docelowo, jeśli po audycie bundla Swiper okaże się jedyną ciężką zależnością na stronie
głównej — wymieniamy.

### 1.6 i18n — **decyzja teraz, nie później**

Aplikacja jest polska: ceny w PLN, sklepy polskie, użytkownik polski.
Ale INCI, kategorie i część danych źródłowych są angielskie.

Decyzja: **`@nuxtjs/i18n`, domyślny locale `pl`, na start tylko `pl`.**
Wszystkie teksty UI przez `$t()` od pierwszego dnia. Slugi produktów po polsku.
Encje wymagające tłumaczeń (`Category.name`, `Ingredient.commonName`,
`Ingredient.description`) dostają kolumny `*_pl` / `*_en` albo tabelę tłumaczeń —
patrz `03_MODEL_DANYCH.md`.

Powód: dokładanie i18n do gotowej aplikacji to tydzień nudnej pracy i pewne regresje.
Dokładanie go teraz to jeden dzień.

---

## 2. Zakres — przycięcie pierwszej iteracji

Lista 18 punktów z sekcji 3 pierwotnego promptu to zakres v1.0, nie MVP.
Do momentu, w którym Personal Match daje sensowne wyniki na prawdziwych danych,
**wszystko inne jest ozdobą.**

**Iteracja 1 (dowieźć do końca, w tej kolejności):**

1. Model danych + pipeline INCI (`03`, `07`)
2. Import realnych produktów (`01`)
3. Wyszukiwarka (`05`)
4. Karta produktu + analiza składu
5. Profil urodowy + Personal Match (`04`)
6. Admin: CRUD produktów, składników, aliasów + kolejka nierozpoznanych składników
7. RODO (`02`)

**Iteracja 2:** AI Beauty Shopper, Moja Półka, porównywarka.

**Iteracja 3:** oferty i ceny ze źródeł afiliacyjnych, alerty cenowe, historia cen.

Argument: porównywarka i półka nie mają wartości, dopóki baza ma 100 produktów z seeda.
AI chat bez dobrego scoringu to opakowany ChatGPT. Admin z kolejką nierozpoznanych
składników jest natomiast potrzebny od razu, bo import bez ręcznej korekty nie zadziała.

---

## 3. Definition of Done (obowiązuje dla każdego zadania)

Zanim uznasz funkcję za skończoną:

1. `pnpm typecheck` — zero błędów (oba pakiety).
2. `pnpm lint` — zero błędów.
3. `pnpm test` — testy przechodzą; logika biznesowa ma testy **napisane razem z kodem**,
   nie w osobnej fazie na końcu.
4. Zero warningów Vue/Nuxt w konsoli przy przejściu przez ekran.
5. Ekran sprawdzony przy 375 px i przy 1440 px.
6. Stany: loading (skeleton), empty, error z retry — wszystkie trzy istnieją.
7. Zapytania do bazy: brak N+1 (sprawdź `DEBUG=prisma:query`), listingi mają `LIMIT`.
8. Żaden endpoint zwracający dane użytkownika nie trafia do cache SSR (patrz `06`).
9. Nowe pola wrażliwe → sprawdź `02_RODO.md` zanim je dodasz.

---

## 4. Obserwowalność i deploy — brakuje w oryginale

Dołóż, jeśli nie ma:

- `GET /health` (liveness) i `GET /health/ready` (sprawdza połączenie z Postgres).
- Structured logging (pino) z `requestId`; **logi nigdy nie zawierają e-maila, tokenów
  ani zawartości profilu urodowego** — tylko `userId`.
- Sentry (albo odpowiednik) po obu stronach, z `beforeSend` filtrującym PII.
- CI: GitHub Actions — typecheck + lint + test + `prisma migrate diff` na każdym PR.
- Migracje na deployu: `prisma migrate deploy` jako osobny krok przed startem API,
  nigdy `db push` na produkcji.
- `docker-compose.yml` z Postgresem 16 + rozszerzeniami (`unaccent`, `pg_trgm`, `vector`).

---

## 5. Czego nadal NIE robimy

Bez zmian względem sekcji 38/39 pierwotnego promptu: brak mikroserwisów, Kafki,
Kubernetesa, GraphQL, wielu baz. Dodatkowo, do odwołania:

- brak własnego skanera kodów kreskowych (wystarczy `BarcodeDetector` API + fallback),
- brak rozpoznawania obrazu przez AI,
- brak Stripe'a,
- brak aplikacji natywnej,
- **brak scrapingu czegokolwiek** — patrz `01_DANE_ZRODLA.md`.
