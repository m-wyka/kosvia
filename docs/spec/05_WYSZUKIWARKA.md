# 05 — WYSZUKIWARKA

> Sekcja 10 pierwotnego promptu wymagała „powerful search", a sekcja 6 —
> przygotowania na setki tysięcy produktów. Nie było natomiast żadnej decyzji
> technicznej. Ten plik ją podejmuje.

**Decyzja: Postgres, bez zewnętrznego silnika.** Uzasadnienie i próg migracji na końcu.

---

## 1. Warstwy wyszukiwania

Trzy różne mechanizmy, nie jeden:

| Warstwa | Mechanizm | Kiedy |
|---|---|---|
| **Skrót EAN** | równość na `ProductVariant.ean` | zapytanie to 8–14 cyfr |
| **Pełnotekstowa** | `tsvector` + GIN | zapytanie tekstowe |
| **Rozmyta** | `pg_trgm` similarity | FTS zwróciło <5 wyników (literówki) |

Kolejność ma znaczenie: skan kodu kreskowego musi trafiać natychmiast i dokładnie,
a nie przez ranking pełnotekstowy.

---

## 2. Pełnotekstowa — konfiguracja

### Problem polskiego stemmingu

Postgres nie ma wbudowanej konfiguracji dla polskiego. Opcje:

**A. Słownik ispell polski** — najlepsza jakość, ale wymaga plików słownika w obrazie
Postgresa i utrudnia deploy na usługach zarządzanych.

**B. `simple` + `unaccent` + trigramy** — brak stemmingu, ale nadrabiane przez
trigramy i przez to, że zapytania w tej domenie to głównie **nazwy własne**:
marki, nazwy produktów, nazwy INCI. „CeraVe", „Niacinamide 10%", „krem nawilżający".
Stemming ma tu mniejsze znaczenie niż przy wyszukiwaniu w treściach.

**Rekomendacja: B na start.** Prostszy deploy, wystarczająca jakość dla nazw własnych.
Do ispella wracamy, jeśli analityka zapytań pokaże, że użytkownicy piszą pełnymi
zdaniami — a od tego jest raczej AI chat niż wyszukiwarka.

### Kolumna generowana

```sql
ALTER TABLE products ADD COLUMN search_vector tsvector
  GENERATED ALWAYS AS (
      setweight(to_tsvector('simple', unaccent(coalesce(name, ''))),        'A')
   || setweight(to_tsvector('simple', unaccent(coalesce(brand_name, ''))),  'A')
   || setweight(to_tsvector('simple', unaccent(coalesce(category_name,''))),'B')
   || setweight(to_tsvector('simple', unaccent(coalesce(description, ''))), 'C')
  ) STORED;

CREATE INDEX products_search_idx ON products USING GIN (search_vector);
CREATE INDEX products_name_trgm_idx ON products USING GIN (name gin_trgm_ops);
```

Uwaga: `unaccent` nie jest domyślnie `IMMUTABLE`, a kolumny generowane tego wymagają.
Utwórz owijkę:

```sql
CREATE OR REPLACE FUNCTION f_unaccent(text) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT AS
$$ SELECT public.unaccent('public.unaccent', $1) $$;
```

i użyj `f_unaccent` w definicji kolumny. To jest ten szczegół, na którym utknie
każda implementacja, jeśli nie jest zapisany wprost.

`brand_name` i `category_name` denormalizujemy do `products` (aktualizowane triggerem
albo w serwisie przy zapisie). Powód: kolumna generowana nie może odwoływać się do
innych tabel, a JOIN przy sortowaniu po rankingu kosztuje.

---

## 3. Ranking

```sql
SELECT p.id,
       ts_rank_cd(p.search_vector, q) * 1.0
     + similarity(f_unaccent(p.name), f_unaccent($query)) * 0.6
     + (t.data_completeness) * 0.3
     + (CASE WHEN o.min_price IS NOT NULL THEN 0.2 ELSE 0 END)
       AS rank
FROM products p
JOIN product_traits t ON t.product_id = p.id
LEFT JOIN LATERAL (
    SELECT MIN(price) AS min_price
    FROM product_offers po
    JOIN product_variants v ON v.id = po.variant_id
    WHERE v.product_id = p.id
) o ON TRUE,
plainto_tsquery('simple', f_unaccent($query)) q
WHERE p.is_active AND p.search_vector @@ q
ORDER BY rank DESC
LIMIT 20;
```

Składniki rankingu i uzasadnienie:

- `ts_rank_cd` — trafność tekstowa,
- `similarity` — odporność na literówki i częściowe nazwy,
- `data_completeness` — produkty z pełnym składem wyżej, bo są użyteczniejsze,
- bonus za posiadanie oferty — produkt, którego nie da się kupić, jest mniej wart.

**Personal Match celowo NIE wchodzi do rankingu wyszukiwarki.** Gdy użytkownik szuka
konkretnego produktu, ma go dostać, a nie coś lepiej dopasowanego. Match wchodzi
do rankingu tylko przy sortowaniu „Polecane" i w rekomendacjach.

---

## 4. Fasety i filtry

Filtry z sekcji 10 mapują się na kolumny `ProductTraits` (patrz `03`), więc są
prostymi warunkami `WHERE` bez JOIN-ów:

```sql
AND t.has_fragrance = false          -- bezzapachowe
AND t.is_vegan = true
AND t.has_spf = true
AND t.active_ingredient_ids @> ARRAY[$niacinamideId]   -- GIN, szybkie
AND NOT (t.active_ingredient_ids && $excludedIds)
```

Filtrowanie po składnikach przez `ProductIngredient` z JOIN-em i `GROUP BY HAVING`
byłoby o rząd wielkości wolniejsze. Tablica `activeIngredientIds` w `ProductTraits`
z indeksem GIN załatwia to jednym operatorem.

### Liczniki przy fasetach

Pokazywanie „Bezzapachowe (312)" wymaga policzenia wyników dla każdej wartości filtru.
Nie rób osobnego zapytania na fasetę.

```sql
SELECT
  count(*) FILTER (WHERE NOT t.has_fragrance) AS fragrance_free,
  count(*) FILTER (WHERE t.is_vegan)          AS vegan,
  count(*) FILTER (WHERE t.has_spf)           AS with_spf
FROM ...  -- ten sam WHERE co główne zapytanie, minus filtrowana oś
```

Jedno zapytanie, wszystkie liczniki. Wykonywane równolegle z głównym
(`Promise.all` w serwisie).

Jeżeli okaże się wolne — pierwszy krok to **nie** cache, tylko pokazanie liczników
tylko dla filtrów aktualnie rozwiniętych w UI.

---

## 5. Paginacja

Keyset, nie offset:

```sql
WHERE (rank, id) < ($lastRank, $lastId)
ORDER BY rank DESC, id DESC
LIMIT 20
```

`OFFSET 5000` każe Postgresowi przeskanować i odrzucić 5000 wierszy. Przy nieskończonym
scrollu na mobile to jest różnica między 30 ms a 800 ms na dziesiątej stronie.

Kursor kodujemy base64 i zwracamy jako `nextCursor`. URL-e dla SEO zachowują
`?page=N` z klasycznym offsetem (crawler nie scrolluje, a strony 1–10 są tanie) —
dwa tryby, jeden endpoint.

---

## 6. Podpowiedzi (autocomplete)

Osobny, lekki endpoint. Nie używaj głównego zapytania.

```
GET /search/suggest?q=cera
```

```sql
SELECT name, slug, brand_name, image_url
FROM products
WHERE f_unaccent(name) % f_unaccent($q)      -- operator podobieństwa trgm
   OR f_unaccent(brand_name) % f_unaccent($q)
ORDER BY similarity(f_unaccent(name), f_unaccent($q)) DESC
LIMIT 8;
```

Wymagania: debounce 200 ms po stronie klienta, `AbortController` na poprzednim
żądaniu, cache w pamięci na czas sesji. Cel: p95 poniżej 50 ms.

---

## 7. „Podobny skład" — pgvector

Sekcja 15 wymagała alternatyw o podobnym składzie i wprost zabraniała opierania się
na podobieństwie tekstowym. Rozwiązanie:

**Odcisk składu** — wektor 64-wymiarowy w `ProductTraits.fingerprint`:

- wymiary 0–31: udział funkcji składników (humektanty, emolienty, okluzje,
  konserwanty, filtry…), ważony pozycją na liście,
- wymiary 32–63: obecność konkretnych aktywnych składników o dużym znaczeniu
  (retinol, niacynamid, kwas hialuronowy, witamina C, AHA, BHA, ceramidy…),
  ważona pozycją.

Wektor liczony deterministycznie z `ProductIngredient` przy przeliczaniu cech
(`ProductTraitsService`). Zero uczenia maszynowego, zero modeli, zero kosztów API.

```sql
CREATE INDEX ON product_traits USING hnsw (fingerprint vector_cosine_ops);
```

```sql
SELECT p.id, 1 - (t.fingerprint <=> $sourceFingerprint) AS similarity
FROM product_traits t JOIN products p ON p.id = t.product_id
WHERE p.id <> $sourceId AND p.category_id = $categoryId
ORDER BY t.fingerprint <=> $sourceFingerprint
LIMIT 10;
```

To samo zapytanie z dodatkowym warunkiem `min_price < $sourcePrice` daje
„tańszy zamiennik o podobnym składzie" — czyli funkcję, która sprzedaje produkt.

Wariant „lepsze dopasowanie" to to samo zapytanie posortowane po Personal Match
zamiast po odległości.

---

## 8. Kiedy migrować na Meilisearch / Typesense

Nie teraz. Progi, przy których warto:

- ponad ~300 tys. produktów, **i**
- p95 wyszukiwania powyżej 300 ms po dostrojeniu indeksów, **albo**
- potrzeba typo-tolerance i wielojęzyczności na poziomie, którego trigramy nie dają.

Dopóki żaden z tych warunków nie zachodzi, dodatkowy silnik to kolejny proces do
utrzymania, kolejna synchronizacja i kolejne źródło niespójności — a Postgres
z GIN-em na 100 tys. rekordów jest naprawdę szybki.

Przygotowanie na migrację polega wyłącznie na tym, żeby wyszukiwanie było za interfejsem:

```ts
interface SearchProvider {
  search(query: SearchQuery): Promise<SearchResult>;
  suggest(q: string): Promise<Suggestion[]>;
}
```

`PostgresSearchProvider` teraz, ewentualny `MeiliSearchProvider` później.
Reszta aplikacji nie zauważy.

---

## 9. Obserwowalność wyszukiwania

Zaloguj każde zapytanie (bez `userId`, bez PII):

```prisma
model SearchLog {
  id          String   @id @default(cuid())
  query       String
  resultCount Int
  durationMs  Int
  clickedRank Int?     // która pozycja została kliknięta
  createdAt   DateTime @default(now())

  @@index([createdAt])
}
```

Po dwóch tygodniach będziesz wiedział:
- jakie zapytania zwracają zero wyników (→ brakujące produkty albo brakujące aliasy),
- czy użytkownicy klikają w pierwszą pozycję (→ ranking działa) czy w siódmą (→ nie działa),
- które marki są szukane, a których nie ma w bazie (→ priorytet importu).

To jest tanie do zbudowania i bezcenne przy decydowaniu, co importować dalej.
