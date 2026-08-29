# 02 — RODO / PRYWATNOŚĆ

> Pierwotny prompt nie zawierał ani jednego zdania o RODO, a Kosvia przetwarza
> prawdopodobnie **dane szczególnej kategorii z art. 9 RODO**. To nie jest formalność
> do dopisania przed premierą — to wpływa na model danych, na to, co wysyłamy do LLM,
> i na architekturę usuwania konta.
>
> **Zastrzeżenie: to jest specyfikacja techniczna napisana przez inżyniera, nie opinia
> prawna.** Przed komercyjnym uruchomieniem politykę prywatności i podstawy prawne
> powinien zweryfikować prawnik. Poniższe traktuj jako listę rzeczy do zaimplementowania
> i do skonsultowania.

---

## 1. Dlaczego art. 9

Profil urodowy zbiera: trądzik, zaczerwienienia, przebarwienia, cerę wrażliwą,
alergie na składniki. To są **informacje o stanie zdrowia skóry**. Art. 4 pkt 15 RODO
definiuje dane dotyczące zdrowia szeroko — obejmują informacje o stanie fizycznym
osoby, także te podane przez nią samą i niepochodzące od lekarza.

Konsekwencje:

1. Podstawą przetwarzania **nie może być** wykonanie umowy ani uzasadniony interes.
   Musi być **wyraźna zgoda** (art. 9 ust. 2 lit. a).
2. Zgoda musi być odrębna od akceptacji regulaminu — osobny, niezaznaczony checkbox,
   z własnym opisem.
3. Zgoda musi być odwoływalna równie łatwo, jak została udzielona.
4. Odwołanie zgody = konto działa dalej (przeglądanie, wyszukiwanie), ale profil
   urodowy i Personal Match przestają działać, a dane profilu są usuwane.

**Praktyczny wniosek dla architektury:** aplikacja musi działać bez profilu urodowego.
Nie może być tak, że brak profilu wywraca połowę ekranów. Zaprojektuj Personal Match
jako opcjonalną warstwę na wierzchu, nie jako założenie.

---

## 2. Podstawy prawne — rejestr czynności

Zaimplementuj i udokumentuj:

| Cel | Dane | Podstawa |
|---|---|---|
| Konto i logowanie | e-mail, hash hasła | art. 6(1)(b) — umowa |
| Profil urodowy i Personal Match | typ cery, problemy, cele, alergie | **art. 9(2)(a) — wyraźna zgoda** |
| Moja Półka | posiadane produkty | art. 6(1)(b) + zgoda, jeśli ujawnia stan zdrowia |
| Przesłanie profilu do dostawcy LLM | zanonimizowany profil | zgoda (osobna!) |
| Alerty cenowe | e-mail, produkt, próg | art. 6(1)(b) |
| Bezpieczeństwo, logi, antyfraud | userId, IP, timestamp | art. 6(1)(f) |
| Analityka produktowa | zdarzenia bez PII | zgoda (jeśli cookies) lub anonimowo |

---

## 3. Model danych — zgody

```prisma
enum ConsentType {
  TERMS
  PRIVACY
  BEAUTY_PROFILE_HEALTH   // art. 9 — wyraźna zgoda
  AI_PROCESSING           // wysyłka profilu do dostawcy LLM
  MARKETING_EMAIL
}

model UserConsent {
  id          String      @id @default(cuid())
  userId      String
  user        User        @relation(fields: [userId], references: [id], onDelete: Cascade)
  type        ConsentType
  version     String      // wersja dokumentu, np. "privacy-2026-03-01"
  granted     Boolean
  grantedAt   DateTime?
  revokedAt   DateTime?
  ipHash      String?     // SHA-256(IP + sól), nie surowe IP
  userAgent   String?

  @@index([userId, type])
}
```

Zasady:

- Zgoda nie jest polem boolean na `User`. Jest zdarzeniem z historią — musisz umieć
  udowodnić, kiedy i na jaką wersję dokumentu użytkownik się zgodził.
- Zmiana treści polityki → nowa `version` → prośba o ponowną zgodę przy najbliższym
  logowaniu.
- Guard w NestJS: `@RequiresConsent(ConsentType.BEAUTY_PROFILE_HEALTH)` na wszystkich
  endpointach dotykających profilu i scoringu. Brak zgody → `403` z kodem
  `CONSENT_REQUIRED`, frontend pokazuje ekran zgody, nie błąd.

---

## 4. Usuwanie konta — implementacja

To jest miejsce, w którym większość aplikacji ma bug: „usunięcie" ustawia flagę,
a dane zostają.

```
DELETE /account
```

Przepływ:

1. Wymagane potwierdzenie hasłem (nie samo kliknięcie).
2. Tworzy się `AccountDeletionRequest` ze statusem `PENDING` i `executeAt = now + 7 dni`.
   Konto jest natychmiast wylogowane i zablokowane. 7 dni to okres na cofnięcie
   („zmieniłam zdanie") — poinformuj o tym w mailu potwierdzającym.
3. Po 7 dniach worker wykonuje **twarde usunięcie**:
   - `User` i wszystko z `onDelete: Cascade`: profil, zgody, półka, alerty, konwersacje AI,
   - `AIMessage.content` — usuwane, nie anonimizowane (mogą zawierać treść wpisaną
     przez użytkownika o swoim zdrowiu),
   - logi aplikacyjne: `userId` zastępowany przez `deleted:{hash}`.
4. Zostaje wyłącznie `DeletionAudit(idHash, deletedAt)` — dowód wykonania, bez PII.
5. W polityce prywatności napisz uczciwie, że kopie zapasowe są rotowane przez 30 dni
   i dane znikają z nich w tym okresie.

**Wymóg dla `schema.prisma`:** każda relacja do `User` ma jawnie ustawione
`onDelete: Cascade` albo `onDelete: SetNull`. Domyślne `Restrict` sprawi, że usunięcie
konta wybuchnie błędem klucza obcego. Przejdź przez cały schemat i uzupełnij.

---

## 5. Eksport danych (art. 15 i 20)

```
GET /account/export
```

Zwraca JSON ze wszystkim, co masz o użytkowniku: konto, profil, zgody z historią,
półka, alerty, konwersacje AI, historia wyników Personal Match. Generowany na żądanie,
wysyłany linkiem ważnym 24 h — nie synchronicznie, bo przy dużej półce to potrwa.

Format czytelny dla człowieka i dla maszyny. To jest jedno z tych wymagań, których
implementacja zajmuje pół dnia, a brak którego jest realnym ryzykiem.

---

## 6. LLM — minimalizacja danych

**Najpoważniejsze ryzyko w całej aplikacji: wysyłanie danych o zdrowiu do zewnętrznego
dostawcy modelu.**

Zasady bezwzględne:

1. **Nigdy nie wysyłamy do LLM:** e-maila, imienia, `userId`, adresu IP, treści
   umożliwiających identyfikację.
2. Wysyłamy wyłącznie zanonimizowany kontekst:
   ```json
   {
     "skinType": "combination",
     "concerns": ["acne", "redness"],
     "budgetMax": 70,
     "preferences": ["fragrance_free"],
     "candidateProducts": [ /* dane z naszej bazy */ ]
   }
   ```
3. Warstwa `AIProvider` ma **obowiązkowy sanitizer** wywoływany przed każdym requestem.
   Nie „powinien" — ma być niemożliwe do ominięcia: sanitizer jest w klasie bazowej,
   a nie w każdym wywołaniu.
4. Test jednostkowy: przekaż obiekt zawierający e-mail w każdym możliwym miejscu
   i sprawdź, że w payloadzie go nie ma. Ten test ma być w CI.
5. Wyłącz retencję po stronie dostawcy, jeśli oferuje taką opcję (zero data retention).
   Wybieraj region UE, jeśli dostępny.
6. Dostawca LLM = podmiot przetwarzający → potrzebna umowa powierzenia (DPA)
   i wpis w polityce prywatności z nazwą i lokalizacją.
7. Osobna zgoda `AI_PROCESSING`. Użytkownik może korzystać z Kosvii bez AI.

---

## 7. Profilowanie i art. 22

Personal Match to profilowanie. Nie wywołuje skutków prawnych ani podobnie istotnych,
więc art. 22 raczej nie ma zastosowania — ale obowiązek informacyjny o logice
przetwarzania (art. 13 ust. 2 lit. f) już tak.

**To akurat jest dobra wiadomość.** Wymóg wyjaśnienia logiki pokrywa się dokładnie
z tym, co i tak chcesz zbudować: przycisk „Dlaczego 92%?" z rozbiciem na czynniki
(patrz `04_PERSONAL_MATCH.md`). Zgodność wychodzi jako efekt uboczny dobrego UX.

Dopisz na stronie `/jak-dzialamy`: z jakich czynników składa się wynik, że jest liczony
deterministycznie przez nasz algorytm, a AI go wyłącznie opisuje słowami.

---

## 8. Pozostałe

**Wiek.** W Polsce granica zgody dziecka na usługi społeczeństwa informacyjnego to
16 lat. Pole daty urodzenia przy rejestracji + walidacja. Poniżej 16 lat — odmowa
rejestracji z komunikatem.

**Retencja.** Konto nieaktywne 24 miesiące → mail ostrzegawczy → po 30 dniach usunięcie.
Zadanie cron + `User.lastActiveAt`.

**Cookies.** Jeżeli używasz wyłącznie ciasteczek niezbędnych (sesja, CSRF) — baner
nie jest wymagany, wystarczy informacja w polityce. Dokładając analitykę, potrzebujesz
CMP i zgody przed załadowaniem skryptu. Rekomendacja: na start bez analityki
zewnętrznej, własne zdarzenia serwerowe bez PII. Mniej pracy, mniej ryzyka,
i UI bez irytującego banera — co akurat pasuje do sekcji 47 o jakości UX.

**DPIA.** Dane z art. 9 + profilowanie + skala → ocena skutków jest prawdopodobnie
wymagana. Nie jest to zadanie dla Claude Code, ale zapisz to jako zadanie przed premierą.

**Bezpieczeństwo.** Rate limiting na `/auth/*` i `/ai/chat` (koszty!), argon2id
zamiast bcrypt jeśli jeszcze nie, rotacja refresh tokenów z wykrywaniem ponownego użycia,
brak PII w logach i w Sentry.

---

## 9. Pozycjonowanie medyczne — rozszerzenie sekcji 44

Sekcja 44 pierwotnego promptu mówiła tylko o języku komunikatów. Dołóż warstwę
techniczną:

- Stały, widoczny disclaimer na ekranie profilu i przy wynikach: Kosvia nie jest
  wyrobem medycznym ani usługą medyczną i nie zastępuje konsultacji z dermatologiem.
- Blacklist fraz w outputach AI — walidator po stronie backendu odrzuca odpowiedzi
  zawierające „wyleczy", „leczy", „diagnoza", „choroba", „zalecam odstawienie",
  i prosi model o przeformułowanie. Nie ufaj wyłącznie promptowi systemowemu.
- Jeżeli użytkownik opisuje objawy sugerujące problem medyczny (zmiany skórne,
  silne reakcje alergiczne), AI kończy odpowiedź sugestią kontaktu z lekarzem
  i nie proponuje produktów jako rozwiązania.
- Nigdy nie sugeruj odstawienia leku ani preparatu przepisanego przez lekarza,
  nawet jeśli algorytm wykryje konflikt składników. Formułuj jako informację:
  „te produkty zawierają składniki, które zwykle stosuje się osobno — warto to
  omówić z dermatologiem".
