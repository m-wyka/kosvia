# 07 — PIPELINE PARSOWANIA INCI

> Pierwotny prompt zakładał, że składniki „są w bazie", ale nie opisywał, jak
> tekst z etykiety zamienia się w rekordy. W praktyce to najbardziej pracochłonna
> i najbardziej wpływająca na jakość część całego projektu. Zły parser =
> zły Personal Match, niezależnie od tego, jak dobry jest algorytm scoringu.

---

## 1. Jak wygląda wejście

Prawdziwe listy INCI, z którymi trzeba sobie poradzić:

```
Aqua, Glycerin, Cetearyl Alcohol, Ceramide NP, Niacinamide, Parfum (Fragrance),
Sodium Hyaluronate, Phenoxyethanol, CI 77891, [+/- May Contain: Mica, CI 19140]
```

```
INGREDIENTS: WATER\AQUA\EAU, GLYCERIN, DIMETHICONE, LINALOOL*, LIMONENE*
* naturally occurring in essential oils
```

```
Aqua (Water), Butyrospermum Parkii (Shea) Butter, Tocopheryl Acetate (Vitamin E)
```

Problemy widoczne w tych trzech przykładach: różne separatory, ukośniki,
wielojęzyczne synonimy, nazwy zwyczajowe w nawiasach, numery CI, sekcja „may contain",
gwiazdki z przypisami, wielkie litery, prefiks „INGREDIENTS:". Do tego dochodzą
literówki, podwójne spacje, przełamania wierszy z OCR i znaki niedrukowalne.

---

## 2. Etapy przetwarzania

```
raw string
   │
   ├─ 1. Oczyszczenie
   ├─ 2. Wykrycie sekcji "may contain"
   ├─ 3. Podział na tokeny
   ├─ 4. Normalizacja tokenu
   ├─ 5. Dopasowanie do słownika (4 poziomy)
   ├─ 6. Klasyfikacja pewności
   └─ 7. Zapis + kolejka weryfikacji
```

### Etap 1 — oczyszczenie

```ts
const clean = (raw: string) => raw
  .replace(/^\s*(ingredients|składniki|inci|skład)\s*[:.]?\s*/i, '')
  .replace(/\u00A0/g, ' ')            // twarda spacja
  .replace(/[\r\n]+/g, ' ')
  .replace(/\*+\s*[^,]*$/g, '')        // przypisy z gwiazdką na końcu
  .replace(/\s{2,}/g, ' ')
  .trim()
  .replace(/[.;]\s*$/, '');
```

### Etap 2 — sekcja „may contain"

```ts
const MAY_CONTAIN = /(\[?\s*(\+\/-|±)\s*)?(may\s+contain|peut\s+contenir|może\s+zawierać)\s*[:.]?/i;
```

Wszystko po tym znaczniku dostaje `isAfterMayContain = true` i wagę 0.1 w scoringu.
To są barwniki, których w konkretnej sztuce może nie być — traktowanie ich na równi
z resztą zafałszuje wynik.

### Etap 3 — podział na tokeny

Separatory: przecinek, średnik, ukośnik **poza nawiasem**. Nawiasy trzeba śledzić,
bo `Aqua (Water)` to jeden token, a `Water\Aqua\Eau` to trzy synonimy tego samego.

```ts
function tokenize(s: string): string[] {
  const out: string[] = [];
  let buf = '', depth = 0;
  for (const ch of s) {
    if (ch === '(' || ch === '[') depth++;
    else if (ch === ')' || ch === ']') depth--;
    if ((ch === ',' || ch === ';') && depth === 0) { out.push(buf); buf = ''; }
    else buf += ch;
  }
  if (buf.trim()) out.push(buf);
  return out.map(t => t.trim()).filter(Boolean);
}
```

Ukośniki: jeżeli token po podziale zawiera `\` lub `/` i **każdy** fragment osobno
dopasowuje się do tego samego składnika w słowniku — to synonimy jednego składnika,
nie trzy pozycje. Jeżeli dopasowują się do różnych — to była lista.

### Etap 4 — normalizacja

```ts
const normalize = (t: string) => t
  .toLowerCase()
  .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')   // diakrytyki
  .replace(/\([^)]*\)/g, '')      // nazwy zwyczajowe w nawiasach — odłóż osobno
  .replace(/[^a-z0-9\s-]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();
```

Zawartość nawiasów **nie jest wyrzucana** — trafia do `IngredientAlias` jako
kandydat na alias typu `TRANSLATION` (`Butyrospermum Parkii (Shea) Butter`
→ alias „shea butter"). Z czasem słownik aliasów rośnie sam.

### Etap 5 — dopasowanie, cztery poziomy

| Poziom | Metoda | Pewność |
|---|---|---|
| 1 | dokładna zgodność z `Ingredient.inciName` (znormalizowaną) | 1.00 |
| 2 | dokładna zgodność z `IngredientAlias.alias` | 0.95 |
| 3 | numer CI (`CI 77891` → wyszukanie po numerze) | 0.95 |
| 4 | trigram `similarity > 0.85` | 0.60–0.85 |

```sql
SELECT id, inci_name, similarity(normalized_name, $token) AS sim
FROM ingredients
WHERE normalized_name % $token
ORDER BY sim DESC
LIMIT 1;
```

Poziom 4 obsługuje literówki (`Nicotinamide` vs `Niacinamide`, `Glicerin` vs `Glycerin`).
**Nigdy nie zapisuje się automatycznie jako pewne dopasowanie** — trafia do kolejki
z propozycją.

Poniżej progu: `ingredientId = null`, `rawText` zachowany, token do kolejki
nierozpoznanych.

### Etap 6 — pewność

`ProductIngredient.matchConfidence` = pewność z poziomu dopasowania.
`ProductTraits.recognizedRatio` = udział składników z `matchConfidence >= 0.9`,
ważony pozycją (nierozpoznany składnik na pozycji 2 boli bardziej niż na 25).

Ta liczba trafia potem do `matchConfidence` w `04_PERSONAL_MATCH.md` i jest pokazywana
użytkownikowi. Cały łańcuch od parsera do UI jest spójny.

---

## 3. Kolejka weryfikacji w adminie — buduj od razu

To nie jest funkcja „na później". Bez niej pierwszy import 5000 produktów zostawi
Cię z tysiącem nierozpoznanych tokenów i żadnym sposobem, żeby je poprawić.

```prisma
model UnmatchedToken {
  id             String   @id @default(cuid())
  normalized     String   @unique
  rawSamples     String[]                 // przykłady wystąpień
  occurrenceCount Int     @default(1)
  suggestedIngredientId String?
  suggestedScore Float?
  status         TokenStatus @default(PENDING)
  resolvedAt     DateTime?

  @@index([status, occurrenceCount])
}

enum TokenStatus {
  PENDING
  MAPPED        // utworzono alias
  NEW_INGREDIENT
  IGNORED       // śmieć z OCR
}
```

Ekran `/admin/skladniki/kolejka`:

- lista posortowana malejąco po `occurrenceCount` — **naprawiasz najpierw to,
  co dotyczy największej liczby produktów**. To jest jedyny sensowny porządek pracy:
  jeden token występujący w 800 produktów jest wart 800 razy więcej niż literówka
  w jednym.
- przy każdym tokenie: propozycja z dopasowania trigramowego + trzy przyciski
  („to alias X", „nowy składnik", „ignoruj"),
- akcja tworzy alias i **uruchamia ponowne dopasowanie wszystkich produktów
  zawierających ten token** — jedna decyzja naprawia setki rekordów naraz.

Realistyczne oczekiwanie: pierwsze 200 decyzji w kolejce podniesie
`recognizedRatio` katalogu z ~70% do ~95%. To jest kilka godzin pracy o największym
zwrocie w całym projekcie.

---

## 4. Struktura kodu

```
apps/api/src/inci/
├── inci.module.ts
├── inci-parser.service.ts        // etapy 1-4, czysta funkcja, zero I/O
├── inci-matcher.service.ts       // etap 5, dostęp do słownika
├── inci-import.service.ts        // etapy 6-7, zapis i kolejka
├── unmatched-token.service.ts
└── __tests__/
    ├── parser.spec.ts
    └── fixtures/real-labels.json  // 50 prawdziwych list z etykiet
```

`inci-parser.service.ts` bez zależności od bazy — dzięki temu testujesz go na
50 prawdziwych etykietach w milisekundach, bez fixture'ów bazodanowych.

---

## 5. Testy

Zbierz **50 prawdziwych list INCI** z opakowań (przepisz z produktów, które masz w domu,
albo weź z Open Beauty Facts) i zapisz jako fixture z oczekiwanym wynikiem.
Każdy nowy przypadek brzegowy napotkany w produkcji dopisujesz do tego pliku.

Przypadki, które muszą być pokryte:

- [ ] separator przecinkowy i średnikowy
- [ ] `Water\Aqua\Eau` → jeden składnik
- [ ] `Aqua (Water)` → jeden składnik + alias
- [ ] sekcja `[+/- May Contain: …]`
- [ ] numery `CI 77891`
- [ ] prefiks `INGREDIENTS:`
- [ ] gwiazdki z przypisem na końcu
- [ ] podwójne spacje, twarde spacje, przełamania z OCR
- [ ] pusty ciąg i sam prefiks bez treści
- [ ] lista z jednym składnikiem
- [ ] literówka rozpoznana przez trigramy → propozycja, nie automat
- [ ] token kompletnie nieznany → kolejka, produkt nadal się zapisuje

Ostatni punkt jest ważny: **parser nigdy nie wywala importu.** Nierozpoznany składnik
to obniżona pewność, a nie błąd. Produkt z 3 nierozpoznanymi składnikami na 25
jest nadal użyteczny — trzeba go tylko oznaczyć.

---

## 6. OCR — przygotowanie na przyszłość

Gdy dojdzie zdjęcie etykiety od użytkownika:

- OCR jest osobnym krokiem **przed** tym pipeline'em, a nie jego częścią,
- wynik OCR ma znacznie więcej szumu → obniż wszystkie progi pewności o 0.1,
- produkt z OCR **nigdy** nie trafia na produkcję automatycznie, zawsze przez kolejkę,
- interfejs: `OcrProvider.extractText(image): Promise<string>` — abstrakcja jak
  `AIProvider`, żeby dało się zmienić dostawcę.

Model `ProductSubmission` (zgłoszenie od użytkownika) zaprojektuj już teraz,
nawet jeśli endpoint włączysz za pół roku. Dodanie go później oznacza kolejną
migrację na tabelach, które będą już duże.
