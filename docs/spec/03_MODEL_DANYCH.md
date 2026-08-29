# 03 — POPRAWKI MODELU DANYCH

> Poprawki do istniejącego `schema.prisma`. **Nie przepisuj schematu od zera.**
> Przejdź punkt po punkcie, sprawdź, co już jest, i dołóż brakujące jako migracje.
> Każda zmiana = osobna, nazwana migracja (`prisma migrate dev --name add_product_variant`),
> nigdy `db push`.

---

## 1. Rozszerzenia Postgres

```sql
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS vector;   -- pgvector, dla podobieństwa składów
```

W `schema.prisma`:

```prisma
generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["postgresqlExtensions", "fullTextSearchPostgres"]
}

datasource db {
  provider   = "postgresql"
  url        = env("DATABASE_URL")
  extensions = [unaccent, pg_trgm, vector]
}
```

Dopisz je też do obrazu w `docker-compose.yml` (`pgvector/pgvector:pg16` zawiera wszystkie trzy).

---

## 2. Pieniądze — nigdy Float

Sprawdź wszystkie pola cenowe. Jeżeli gdziekolwiek jest `Float` lub `Decimal` bez
precyzji — popraw.

```prisma
price     Decimal @db.Decimal(10, 2)
currency  String  @default("PLN") @db.Char(3)
```

Zaokrąglenia zmiennoprzecinkowe przy cenach to klasa błędów, której nie chcesz szukać
w porównywarce cen za 100 ml.

---

## 3. ProductVariant — brakująca encja (ważne)

Krem 50 ml i 100 ml to dwa EAN-y i dwie ceny, ale **jeden produkt z jednym składem**.
Bez tego rozdzielenia nie da się policzyć ceny za 100 ml (wymóg sekcji 14) ani sensownie
porównać produktów.

```prisma
model Product {
  id           String    @id @default(cuid())
  slug         String    @unique
  name         String
  brandId      String
  categoryId   String
  description  String?
  isActive     Boolean   @default(true)
  // usuń stąd: ean, volume, volumeUnit, imageUrl → przenoszą się do wariantu
  variants     ProductVariant[]
  ingredients  ProductIngredient[]
  traits       ProductTraits?
  sourceId     String?
  source       DataSource? @relation(fields: [sourceId], references: [id])
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt

  @@index([brandId])
  @@index([categoryId])
  @@index([isActive])
}

model ProductVariant {
  id           String  @id @default(cuid())
  productId    String
  product      Product @relation(fields: [productId], references: [id], onDelete: Cascade)
  ean          String? @unique
  volume       Decimal? @db.Decimal(10, 2)
  volumeUnit   VolumeUnit?
  imageUrl     String?
  isDefault    Boolean @default(false)
  isActive     Boolean @default(true)
  offers       ProductOffer[]

  @@index([productId])
  @@index([ean])
}

enum VolumeUnit {
  ML
  G
  PIECE
}
```

Reguły:
- dokładnie jeden wariant per produkt ma `isDefault = true` (walidacja w serwisie),
- listing i karta produktu domyślnie pokazują wariant domyślny + najniższą cenę
  ze wszystkich wariantów,
- cena za 100 ml liczona per wariant, nie per produkt.

Migracja z istniejących danych: dla każdego `Product` utwórz jeden `ProductVariant`
przepisując `ean`, `volume`, `volumeUnit`, `imageUrl`, ustaw `isDefault = true`,
przepnij `ProductOffer.productId` → `variantId`, dopiero potem usuń stare kolumny.
Zrób to w **trzech osobnych migracjach** (dodaj → przepisz dane skryptem → usuń),
nie w jednej.

---

## 4. Składniki — słownik, aliasy, funkcje

```prisma
model Ingredient {
  id                  String  @id @default(cuid())
  inciName            String  @unique          // kanoniczna nazwa z CosIng
  slug                String  @unique
  commonNamePl        String?
  commonNameEn        String?
  descriptionPl       String?
  casNumber           String?
  ecNumber            String?

  isFragranceAllergen Boolean @default(false)  // rozp. 2023/1545
  isRestricted        Boolean @default(false)  // Aneks III
  isProhibited        Boolean @default(false)  // Aneks II
  restrictionNote     String?
  cosIngAnnex         String?

  functions           IngredientFunctionOnIngredient[]
  aliases             IngredientAlias[]
  productLinks        ProductIngredient[]
  sourceId            String?
  source              DataSource? @relation(fields: [sourceId], references: [id])

  @@index([isFragranceAllergen])
}

model IngredientAlias {
  id           String     @id @default(cuid())
  ingredientId String
  ingredient   Ingredient @relation(fields: [ingredientId], references: [id], onDelete: Cascade)
  alias        String                    // znormalizowana forma
  aliasRaw     String                    // oryginał, jak wystąpił
  kind         AliasKind
  confidence   Float      @default(1.0)

  @@unique([alias])
  @@index([ingredientId])
}

enum AliasKind {
  SYNONYM      // Aqua / Water / Eau
  TRANSLATION
  TYPO         // dodane ręcznie po napotkaniu w feedzie
  TRADE_NAME   // nazwa handlowa surowca
  CI_NUMBER
}

model IngredientFunction {
  id           String @id @default(cuid())
  code         String @unique   // humectant, emollient, occlusive, preservative...
  namePl       String
  ingredients  IngredientFunctionOnIngredient[]
}

model IngredientFunctionOnIngredient {
  ingredientId String
  functionId   String
  ingredient   Ingredient         @relation(fields: [ingredientId], references: [id], onDelete: Cascade)
  function     IngredientFunction @relation(fields: [functionId], references: [id], onDelete: Cascade)

  @@id([ingredientId, functionId])
}
```

Kluczowa uwaga: **funkcje i tagi to tabele, nie tablice stringów.** Filtrujesz po nich
i scorujesz — muszą być indeksowalne i mieć stabilne identyfikatory. Sekcja 6
pierwotnego promptu mówiła „nie trzymaj wszystkiego w JSON", ale `Ingredient.functions`
i `tags` zostały bez doprecyzowania.

```prisma
model ProductIngredient {
  id                 String     @id @default(cuid())
  productId          String
  product            Product    @relation(fields: [productId], references: [id], onDelete: Cascade)
  ingredientId       String?                        // null = nierozpoznany
  ingredient         Ingredient? @relation(fields: [ingredientId], references: [id])
  rawText            String                         // dokładnie jak na etykiecie
  position           Int                            // 1 = pierwszy na liście
  isAfterMayContain  Boolean    @default(false)     // sekcja "may contain / +/-"
  matchConfidence    Float      @default(1.0)

  @@unique([productId, position])
  @@index([ingredientId])
}
```

`position` ma znaczenie merytoryczne (kolejność INCI = malejące stężenie do 1%)
i jest używany w scoringu — patrz `04`.

---

## 5. ProductTraits — zdenormalizowane cechy (fundament wydajności)

To jest tabela, dzięki której Personal Match da się policzyć w SQL zamiast w pętli
po produktach. Wypełniana automatycznie przy każdej zmianie składu produktu.

```prisma
model ProductTraits {
  productId            String   @id
  product              Product  @relation(fields: [productId], references: [id], onDelete: Cascade)

  // flagi formuły
  hasFragrance         Boolean  @default(false)
  hasFragranceAllergen Boolean  @default(false)
  hasAlcoholDenat      Boolean  @default(false)
  alcoholDenatPosition Int?
  hasEssentialOils     Boolean  @default(false)
  hasSilicones         Boolean  @default(false)
  hasSpf               Boolean  @default(false)
  spfValue             Int?

  // profil funkcjonalny 0..1, ważony pozycją składnika
  humectantScore       Float    @default(0)
  emollientScore       Float    @default(0)
  occlusiveScore       Float    @default(0)
  antioxidantScore     Float    @default(0)
  exfoliantScore       Float    @default(0)
  soothingScore        Float    @default(0)
  brighteningScore     Float    @default(0)
  antiAgingScore       Float    @default(0)
  sebumRegulationScore Float    @default(0)

  // aktywne składniki obecne w produkcie (do szybkiego filtrowania)
  activeIngredientIds  String[]                   // GIN
  fingerprint          Unsupported("vector(64)")? // pgvector, do "podobny skład"

  // deklaracje
  isVegan              Boolean?
  isCrueltyFree        Boolean?

  // kompletność danych — napędza matchConfidence
  ingredientCount      Int      @default(0)
  recognizedRatio      Float    @default(0)
  dataCompleteness     Float    @default(0)

  computedAt           DateTime @updatedAt
  traitsVersion        Int      @default(1)

  @@index([activeIngredientIds], type: Gin)
  @@index([hasFragrance, hasSpf])
}
```

Przeliczanie: serwis `ProductTraitsService.recompute(productId)` wywoływany po imporcie,
po edycji składu w adminie i po zmianie słownika składników (wtedy wsadowo).
`traitsVersion` pozwala wykryć produkty policzone starą wersją logiki i przeliczyć
tylko je.

---

## 6. Profil urodowy — braki

Sekcja 13 pierwotnego promptu opierała scoring na „excluded ingredients",
ale tego pola nie było w modelu.

```prisma
model BeautyProfile {
  id                    String   @id @default(cuid())
  userId                String   @unique
  user                  User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  skinType              SkinType?
  sensitivityLevel      Int?     @default(0)      // 0..3
  budgetMax             Decimal? @db.Decimal(10, 2)
  fragrancePreference   FragrancePreference @default(NO_PREFERENCE)
  wantsVegan            Boolean  @default(false)
  wantsCrueltyFree      Boolean  @default(false)

  concerns              BeautyConcernOnProfile[]
  goals                 BeautyGoalOnProfile[]
  excludedIngredients   ExcludedIngredient[]      // ← brakowało
  preferredBrands       BrandPreference[]
  profileHash           String?                   // do cache scoringu, patrz 04
  completedAt           DateTime?

  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt
}

model ExcludedIngredient {
  id           String        @id @default(cuid())
  profileId    String
  profile      BeautyProfile @relation(fields: [profileId], references: [id], onDelete: Cascade)
  ingredientId String
  ingredient   Ingredient    @relation(fields: [ingredientId], references: [id])
  reason       ExclusionReason @default(PREFERENCE)

  @@unique([profileId, ingredientId])
}

enum ExclusionReason {
  ALLERGY       // twarda blokada — produkt nie pojawia się w ogóle
  INTOLERANCE   // twarda blokada
  PREFERENCE    // kara punktowa, produkt widoczny z ostrzeżeniem
}
```

Rozróżnienie `ALLERGY` vs `PREFERENCE` jest istotne: alergia to filtr (`WHERE NOT`),
niechęć to punkty. Mieszanie tych dwóch to albo pokazywanie alergenu, albo ukrywanie
połowy katalogu z powodu awersji do silikonów.

**Uwaga RODO:** cała ta encja to dane z art. 9. Guard zgody na wszystkich endpointach,
`onDelete: Cascade`, brak w logach. Patrz `02_RODO.md`.

---

## 7. Ceny i historia

```prisma
model ProductOffer {
  id             String         @id @default(cuid())
  variantId      String
  variant        ProductVariant @relation(fields: [variantId], references: [id], onDelete: Cascade)
  storeId        String
  store          Store          @relation(fields: [storeId], references: [id])
  price          Decimal        @db.Decimal(10, 2)
  regularPrice   Decimal?       @db.Decimal(10, 2)
  currency       String         @default("PLN") @db.Char(3)
  url            String
  affiliateUrl   String?
  availability   Availability   @default(UNKNOWN)
  lastCheckedAt  DateTime
  sourceId       String?
  source         DataSource?    @relation(fields: [sourceId], references: [id])

  @@unique([variantId, storeId])
  @@index([variantId, price])
}

model PriceHistory {
  id        String   @id @default(cuid())
  offerId   String
  offer     ProductOffer @relation(fields: [offerId], references: [id], onDelete: Cascade)
  price     Decimal  @db.Decimal(10, 2)
  recordedAt DateTime @default(now())

  @@index([offerId, recordedAt])
}
```

`PriceHistory` był wspomniany w sekcji 21, ale nie było go wśród modeli.
Zapisuj wpis **tylko przy zmianie ceny**, nie przy każdym sprawdzeniu — inaczej tabela
urośnie o milion wierszy tygodniowo bez wartości informacyjnej.

---

## 8. Pochodzenie danych (wymóg licencyjny)

```prisma
model DataSource {
  id          String   @id @default(cuid())
  code        String   @unique      // "cosing", "openbeautyfacts", "awin-hebe", "manual"
  name        String
  license     String                // "CC BY 4.0", "ODbL", "commercial-feed", "own"
  attribution String?               // tekst do wyświetlenia
  url         String?

  products    Product[]
  ingredients Ingredient[]
  offers      ProductOffer[]
}
```

Bez tego nie da się spełnić obowiązków atrybucyjnych z `01_DANE_ZRODLA.md` ani —
gdyby zaszła potrzeba — odseparować danych na ODbL od reszty. Dodaj też
`isManuallyEdited Boolean @default(false)` na `Product` i `ProductIngredient`,
żeby import nie nadpisywał ręcznych poprawek.

---

## 9. Wersjonowanie algorytmu i audyt

```prisma
model MatchWeightSet {
  id          String   @id @default(cuid())
  version     Int      @unique
  isActive    Boolean  @default(false)
  weights     Json                    // jedyne uzasadnione użycie Json w schemacie
  note        String?
  createdAt   DateTime @default(now())
}

model AuditLog {
  id         String   @id @default(cuid())
  actorId    String?
  action     String              // "product.update", "ingredient.merge"
  entity     String
  entityId   String
  diff       Json?
  createdAt  DateTime @default(now())

  @@index([entity, entityId])
  @@index([actorId, createdAt])
}
```

Audyt jest potrzebny od pierwszego dnia panelu admina — bez niego nie odtworzysz,
kto i kiedy zepsuł dane w bazie liczącej 50 tys. produktów.

---

## 10. Checklista do wykonania

- [ ] Rozszerzenia Postgres + aktualizacja obrazu w docker-compose
- [ ] Wszystkie ceny na `Decimal(10,2)`
- [ ] `ProductVariant` + migracja danych w trzech krokach
- [ ] `IngredientAlias`, `IngredientFunction` jako tabele
- [ ] `ProductIngredient.rawText`, `isAfterMayContain`, `matchConfidence`
- [ ] `ProductTraits` + `ProductTraitsService.recompute()`
- [ ] `ExcludedIngredient` z rozróżnieniem alergia/preferencja
- [ ] `PriceHistory`
- [ ] `DataSource` + `sourceId` na Product/Ingredient/Offer
- [ ] `isManuallyEdited` na Product i ProductIngredient
- [ ] `isActive` na Product i ProductVariant
- [ ] `MatchWeightSet`, `AuditLog`
- [ ] `UserConsent` (z `02_RODO.md`)
- [ ] **Przejrzyj każdą relację do `User` i ustaw jawnie `onDelete`**
- [ ] Pola tłumaczone: `*Pl` / `*En` na `Category.name`, `Ingredient.commonName`,
      `Ingredient.description`
