# 01 — POZYSKIWANIE DANYCH

> To jest najważniejszy plik w całym zestawie. Kosvia bez danych jest ładnym demem.
> Ręczne wpisywanie produktów nie skaluje się, a kopiowanie zdjęć i opisów z Rossmanna
> czy Hebe to naruszenie praw autorskich i prawa sui generis do baz danych
> (dyrektywa 96/9/WE, w PL ustawa o ochronie baz danych).

---

## 1. Rozdziel trzy różne problemy

Pierwotny prompt traktował „dane" jako jedną rzecz. To trzy niezależne problemy
o różnych źródłach i różnych licencjach:

| Warstwa | Co to jest | Skąd | Licencja |
|---|---|---|---|
| **A. Słownik składników** | INCI, funkcje, ograniczenia, alergeny | EU CosIng | dane KE, reużywalne |
| **B. Katalog produktów** | EAN, marka, nazwa, skład, zdjęcie | Open Beauty Facts + feedy afiliacyjne + producenci | ODbL / licencja partnerska |
| **C. Ceny i dostępność** | cena, link, stan | feedy afiliacyjne | licencja partnerska |

Każdą warstwę importujemy osobnym pipeline'em, z osobnym oznaczeniem pochodzenia.

---

## 2. Warstwa A — słownik składników (rób to pierwsze)

**Źródło: CosIng — baza składników kosmetycznych Komisji Europejskiej.**

To oficjalna baza KE prowadzona na podstawie rozporządzenia 1223/2009. Zawiera
ok. 15 tys. nazw INCI, numery CAS/EC, funkcje składników oraz Aneksy II–VI
(substancje zakazane, ograniczone, konserwanty, barwniki, filtry UV). Nazewnictwo
na etykietach kosmetyków musi pochodzić z tego glosariusza (art. 19 ust. 1 lit. g),
czyli jest to dokładnie ten sam słownik, który widzisz na opakowaniu.

Treści Komisji Europejskiej są co do zasady reużywalne na warunkach CC BY 4.0,
o ile nie zaznaczono inaczej — wymagane jest wskazanie źródła. **Sprawdź aktualną
notę prawną na stronie KE przed publikacją i umieść atrybucję w stopce oraz
na `/o-danych`.**

Co z tego bierzemy:
- kanoniczna nazwa INCI → `Ingredient.inciName`
- numer CAS / EC → identyfikator do deduplikacji
- funkcje (`humectant`, `emollient`, `preservative`, `uv filter`…) → `IngredientFunction`
- flagi z Aneksów → `Ingredient.restrictionNote`, `Ingredient.isRestricted`
- lista alergenów zapachowych z rozporządzenia 2023/1545 (rozszerzona z 26 do 82 pozycji,
  z terminami przejściowymi na 2026 i 2028) → `Ingredient.isFragranceAllergen`

**To jest realna przewaga produktowa.** Konkurencja pokazuje „ten składnik jest zły".
Ty możesz pokazać: „ten składnik jest alergenem zapachowym z listy 82 wg
rozporządzenia 2023/1545, a Ty zaznaczyłaś wrażliwość na zapachy" — z podaniem podstawy.
To jest informacja, nie opinia, i jest weryfikowalna.

Czego **nie** robimy: nie tłumaczymy Aneksów na język ocen („szkodliwy", „toksyczny").
Podajemy fakt regulacyjny i zostawiamy interpretację użytkownikowi.

---

## 3. Warstwa B — katalog produktów

### 3.1 Open Beauty Facts (start, największa dźwignia)

Open Beauty Facts to społecznościowa, otwarta baza kosmetyków: ponad 100 tys. produktów
ze 170 krajów, dodanych przez ok. 4800 kontrybutorów przez skanowanie kodów kreskowych
i zdjęcia etykiet. Zawiera dokładnie to, czego potrzebujesz: EAN, markę, nazwę, kategorię,
listę INCI, alergeny, numery CI. API v2 jest publiczne i nie wymaga uwierzytelnienia:
`/api/v2/product/{barcode}.json` oraz `/api/v2/search` z filtrowaniem po tagach
kategorii. Są też pełne zrzuty bazy do pobrania.

**Licencje — czytaj uważnie, to ma konsekwencje biznesowe:**

- Baza jest dostępna na Open Database License (ODbL), zawartość rekordów na
  Database Contents License, a zdjęcia produktów na CC BY-SA.

ODbL zawiera klauzulę share-alike: jeżeli publicznie udostępniasz bazę pochodną,
musisz ją udostępnić na tej samej licencji. **To nie znaczy, że nie możesz zarabiać** —
możesz, komercyjne użycie jest dozwolone. Znaczy natomiast, że musisz zaprojektować
system tak, żeby dało się oddzielić „bazę pochodną" od tego, co jest Twoje.

**Praktyczna strategia — obowiązkowa w modelu danych:**

1. Każdy rekord ma pochodzenie: `Product.sourceId`, `ProductIngredient.sourceId`
   (patrz `03_MODEL_DANYCH.md`, model `DataSource`).
2. Dane z OBF trzymamy w polach oznaczonych jako pochodzące z OBF, nigdy nie mieszamy
   ich w jednej kolumnie z danymi własnymi. Gdy dostaniesz ten sam produkt z feedu
   afiliacyjnego — zapisujesz jako drugie źródło, nie nadpisujesz.
3. **Personal Match, oceny składu i wyjaśnienia to nie jest baza pochodna** — to
   „produced work" w rozumieniu ODbL: efekt algorytmu, nie kopia bazy. Wyświetlanie ich
   nie uruchamia share-alike. Uruchamia go dopiero udostępnianie samego zbioru produktów.
4. Atrybucja na każdej stronie produktu, którego dane pochodzą z OBF, plus strona
   `/o-danych` z pełną notą licencyjną.
5. **Zanim wejdziesz na produkcję komercyjną — 2 godziny u prawnika od IP.**
   To jedyne miejsce w projekcie, gdzie to naprawdę rekomenduję.

Zdjęcia na CC BY-SA: da się użyć z atrybucją, ale jakość jest nierówna (zdjęcia
z telefonu, przypadkowe tła). Do premium UI z sekcji 50 się nie nadają. Traktuj je jako
fallback, nie jako źródło docelowe.

**Dodatkowa korzyść:** OBF przyjmuje zwrotnie zdjęcia i dane. Możesz zbudować pętlę —
użytkownik skanuje produkt, którego nie ma w bazie, wysyła zdjęcie etykiety, Ty
odsyłasz je do OBF, a robot Robotoff wyciąga z nich dane. Ekosystem pracuje na Twoją bazę.

### 3.2 Feedy afiliacyjne (jakość i zdjęcia)

Zostając wydawcą w sieciach afiliacyjnych, dostajesz **legalnie licencjonowany feed
produktowy** — XML lub JSON, czasem REST API — z nazwami, opisami, zdjęciami, cenami,
EAN-ami i linkami z deep linkiem. Zdjęcia w feedzie są udostępnione do celów
promocyjnych, czyli dokładnie do tego, do czego ich potrzebujesz. To rozwiązuje
jednocześnie problem zdjęć, problem cen i problem monetyzacji.

Kto jest gdzie (stan do zweryfikowania w momencie rejestracji, programy się przenoszą):

| Sklep | Sieć |
|---|---|
| Hebe PL | Awin |
| Notino | CJ Affiliate / własny program |
| Douglas PL | Convertiser |
| Rossmann | ograniczony program, zwykle bonowy/kuponowy, nie produktowy |
| pozostałe drogerie i sklepy z kosmetykami | Awin, TradeDoubler, webePartners, Convertiser |

Uwagi praktyczne:

- Rejestracja wydawcy wymaga działającej strony. To argument, żeby wypuścić publiczną
  wersję z bazą z OBF **zanim** złożysz wnioski.
- Feedy nie zawierają INCI. Zawierają nazwy, zdjęcia, ceny, EAN. INCI dokładasz
  z warstwy A + OBF, łącząc po EAN.
- **EAN jest kluczem łączącym cały system.** Bez niego nie połączysz feedu z OBF.
  Produkt bez EAN traktuj jako niepełny (patrz `matchConfidence` w `04`).
- Feedy trzeba odświeżać — cron nocny, plus osobny, częstszy dla cen.
  To jest ten moment, w którym NestJS zarobi na siebie.

### 3.3 Producenci bezpośrednio

Marki mają media kity i chętnie udostępniają zdjęcia na białym tle oraz pełne składy —
bo to zwiększa sprzedaż. Napisz do 20 marek, na których Ci zależy najbardziej.
Skuteczność będzie niska, ale te, które odpowiedzą, dadzą dane w jakości nieosiągalnej
inaczej. Zacznij od polskich marek (Ziaja, Bielenda, Tołpa, Only Bio) — próg wejścia
jest niższy niż u L'Oréala.

### 3.4 Użytkownicy (długoterminowo najcenniejsze)

Skan EAN → produktu nie ma w bazie → „zrób zdjęcie składu, dodamy go w ciągu 24 h".
OCR + parser z `07_INCI_PIPELINE.md` + kolejka weryfikacji w adminie.

To jest jedyne źródło, które rośnie razem z produktem i którego konkurencja nie ma.
Zaprojektuj je od razu (model `ProductSubmission`), nawet jeśli włączysz później.

---

## 4. Czego nie robimy — jasno

- **Żadnego scrapingu sklepów.** Ani Rossmanna, ani Hebe, ani Notino, ani „tylko cen".
  Naruszenie regulaminu, prawdopodobne naruszenie prawa do bazy danych, i pierwszy
  poważny inwestor to wychwyci w due diligence.
- **Żadnego kopiowania zdjęć produktowych ze sklepów.** Zdjęcia biorą się z feedu
  afiliacyjnego (licencja), z OBF (CC BY-SA + atrybucja) albo od producenta.
- **Żadnego kopiowania opisów marketingowych.** Opis generuj z faktów, które masz
  (kategoria, kluczowe składniki, przeznaczenie) albo zostaw puste.
- **Żadnego importu z konkurencyjnych baz INCI.** Chronione prawem sui generis.

---

## 5. Plan wykonawczy

**Etap 1 — słownik (1–2 dni)**
- `apps/api/src/import/cosing/` — parser CosIng → `Ingredient`, `IngredientFunction`,
  `IngredientRestriction`
- idempotentny: ponowny import aktualizuje, nie duplikuje
- `pnpm import:cosing`

**Etap 2 — katalog (3–5 dni)**
- `apps/api/src/import/obf/` — klient API + import wsadowy
- filtr: kategorie skincare/haircare, kraj PL + produkty dostępne w PL
- każdy produkt przechodzi przez pipeline z `07`
- produkt bez rozpoznanego składu w ≥80% trafia do kolejki weryfikacji, nie na produkcję
- `pnpm import:obf -- --category=skincare --limit=5000`

**Etap 3 — jakość (ciągle)**
- panel admina: kolejka nierozpoznanych składników, kolejka produktów niepełnych,
  scalanie duplikatów
- metryka do wyświetlania w adminie: % produktów z pełnym składem, % z EAN,
  % z rozpoznanymi wszystkimi składnikami

**Etap 4 — feedy (po publicznym uruchomieniu)**
- `apps/api/src/import/feed/` z abstrakcją `FeedAdapter` (XML/CSV/JSON → `NormalizedOffer`)
- pierwszy adapter: Awin (bo Hebe)
- cron: katalog raz na dobę, ceny co 6 h
- łączenie po EAN, konflikt → kolejka w adminie

---

## 6. Wymagania implementacyjne

Każdy import musi być:

- **idempotentny** — dwukrotne uruchomienie daje ten sam wynik,
- **wznawialny** — kursor zapisany w `ImportRun`, przerwanie nie zaczyna od zera,
- **audytowalny** — `ImportRun(id, source, startedAt, finishedAt, created, updated, skipped, errors[])`,
- **dry-run** — flaga `--dry-run` pokazuje, co by się zmieniło, bez zapisu,
- **nienadpisujący danych ręcznych** — pole edytowane w adminie dostaje
  `isManuallyEdited = true` i import go nie dotyka.

Ostatni punkt jest ważniejszy, niż wygląda. Bez niego pierwszy nocny import skasuje
tydzień ręcznych poprawek.
