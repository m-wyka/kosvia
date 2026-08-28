# Kosvia — AI Beauty Shopper

> Your personal AI for choosing cosmetics.

Kosvia answers one question well: **which cosmetic is best for _me_?** It reads
INCI ingredient lists, weighs them against your skin, your concerns, your budget
and what is already on your shelf, and then finds the best price for what it
recommends.

It is deliberately **not** an ingredient scanner. Scanners tell you what is in a
product; Kosvia tells you whether that product suits you.

```
I need something → Kosvia knows my profile → searches products → analyses
ingredients → compares alternatives → finds the best option → finds the best
price → I buy it
```

---

## Contents

- [Stack](#stack)
- [Quick start](#quick-start)
- [Environment variables](#environment-variables)
- [Project structure](#project-structure)
- [How it works](#how-it-works)
- [API reference](#api-reference)
- [Commands](#commands)
- [Testing](#testing)
- [Demo data](#demo-data)
- [Known limitations](#known-limitations)
- [Next steps](#next-steps)

---

## Stack

| Layer     | Choice                                                        |
| --------- | ------------------------------------------------------------- |
| Frontend  | Nuxt 4 (SSR), Vue 3, TypeScript, Tailwind CSS 4, Pinia, VueUse |
| i18n      | @nuxtjs/i18n — English and Polish, browser-detected, prefixed URLs |
| Backend   | NestJS 11, TypeScript, REST, Passport JWT, class-validator     |
| Database  | PostgreSQL 16, Prisma ORM                                      |
| AI        | Provider abstraction — offline mock by default, Claude opt-in  |
| Shared    | `@kosvia/shared` — one set of types for both apps              |

```
Nuxt 4  ──REST──▶  NestJS  ──Prisma──▶  PostgreSQL
```

No microservices, no GraphQL, no message bus. One API, one database.

---

## Quick start

**Requirements:** Node 20.19+ (22 recommended), npm 10+, and either Docker or a
local PostgreSQL 14+.

```bash
git clone <repo> kosvia && cd kosvia

npm install          # also writes .env from .env.example and builds @kosvia/shared
npm run db:up        # starts PostgreSQL on port 5433 via docker compose
npm run db:migrate   # applies the schema
npm run db:seed      # ~130 demo products, 139 ingredients, 2 accounts

npm run dev          # API on :3001, web on :3000
```

Then open **http://localhost:3000**.

Seeded accounts:

| Account            | Password       | What it has                                   |
| ------------------ | -------------- | --------------------------------------------- |
| `demo@kosvia.app`  | `Password123!` | Full beauty profile, five-product shelf, alerts |
| `admin@kosvia.app` | `Admin123!`    | Admin role, access to `/admin`                 |

The login page has a **Use the demo account** button so you never need to type these.

### Using a PostgreSQL you already run

If you have Postgres locally, skip `db:up` and point `DATABASE_URL` at it:

```bash
createuser --createdb kosvia            # or: CREATE ROLE kosvia LOGIN PASSWORD 'kosvia';
createdb -O kosvia kosvia
# edit .env → DATABASE_URL=postgresql://kosvia:kosvia@localhost:5432/kosvia?schema=public
npm run env                             # redistribute .env to the apps
npm run db:migrate && npm run db:seed
```

---

## Environment variables

One file at the repository root: `.env` (copied from `.env.example` on install).
`npm run env` redistributes it to `apps/api/.env` and `apps/web/.env` — the web
app receives only the URL variables, never database credentials or JWT secrets.

| Variable                                   | Purpose                                                     |
| ------------------------------------------ | ----------------------------------------------------------- |
| `DATABASE_URL`                             | PostgreSQL connection string                                 |
| `JWT_SECRET`, `JWT_REFRESH_SECRET`         | Token signing. **Required in production** — no fallback      |
| `JWT_ACCESS_TTL`, `JWT_REFRESH_TTL`        | `15m` / `30d` by default                                     |
| `COOKIE_DOMAIN`, `COOKIE_SECURE`           | Set `COOKIE_SECURE=true` behind HTTPS                        |
| `API_PORT`, `API_URL`                      | Where the API listens, and where the browser reaches it      |
| `API_INTERNAL_URL`                         | Where the Nuxt server reaches the API during SSR             |
| `FRONTEND_URL`                             | Drives CORS and canonical URLs                               |
| `AI_PROVIDER`                              | `mock` (default, offline) or `anthropic`                     |
| `AI_API_KEY`, `AI_MODEL`                   | Only needed when `AI_PROVIDER=anthropic`                     |
| `SEED_USER_PASSWORD`, `SEED_ADMIN_PASSWORD`| Demo account passwords, seed only                            |

No secrets are committed. `.env` is gitignored; `.env.example` holds placeholders.

---

## Project structure

```
kosvia/
├── apps/
│   ├── api/                        NestJS REST API
│   │   ├── prisma/
│   │   │   ├── schema.prisma       18 models, migrations under migrations/
│   │   │   └── seed/               demo catalogue generator
│   │   └── src/
│   │       ├── common/             config, Prisma, guards, decorators, filters
│   │       └── modules/
│   │           ├── auth/           register, login, refresh rotation, logout
│   │           ├── profile/        beauty profile + ViewerContext
│   │           ├── catalog/        brands, categories, ingredients, stores
│   │           ├── products/       search, facets, detail, DTO mapping
│   │           ├── scoring/        PersonalMatchService, ingredient score
│   │           ├── recommendation/ alternatives, comparison, routine, discovery
│   │           ├── shelf/          My Shelf
│   │           ├── price-alerts/   watch a product for a price
│   │           ├── ai/             BeautyAdvisorService + AIProvider
│   │           ├── discovery/      dashboard
│   │           └── admin/          role-gated CRUD
│   │
│   └── web/                        Nuxt 4 application
│       ├── app/                    app.vue, error.vue
│       ├── layers/
│       │   ├── core/               the public product
│       │   │   ├── app/
│       │   │   │   ├── assets/css/ design tokens (Tailwind 4 @theme)
│       │   │   │   ├── components/ base/ product/ layout/ ai/ landing/
│       │   │   │   ├── composables/ useApi, useSeo, useShelf, useToast
│       │   │   │   ├── stores/     auth, compare
│       │   │   │   ├── layouts/    default, focused
│       │   │   │   ├── middleware/ auth, guest
│       │   │   │   └── pages/
│       │   │   └── server/routes/  robots.txt, sitemap.xml, generated imagery
│       │   └── admin/              back office — own layout, guard, pages
│       └── tests/                  unit + component tests
│
├── packages/shared/                types shared by both apps (dual ESM/CJS)
├── docker-compose.yml
└── scripts/prepare-env.mjs
```

## Languages

Two locales, English and Polish, each with its own URL space:

```
/products/kalme-ceramide-barrier-cream      English
/pl/products/kalme-ceramide-barrier-cream   Polish
```

`prefix_except_default` rather than a single shared URL, because both languages
have to be separately indexable — a catalogue this content-heavy loses half its
SEO surface otherwise. Every page emits a self-referencing canonical plus
`hreflang` alternates, and `/sitemap.xml` lists both locales with `xhtml:link`
alternates so a crawler pairs them instead of reading them as duplicates.

The language is detected from the browser on first visit and remembered in the
`kosvia_locale` cookie. Detection only redirects from the site root: a link
someone shared in Polish must stay Polish, and redirecting on every route makes
the switcher fight the detector.

### Where the strings live

```
apps/web/i18n/
├── i18n.config.ts       vue-i18n runtime options, incl. the Polish plural rule
└── locales/
    ├── en.json          941 keys
    └── pl.json          941 keys, same shape
```

Keys are `UPPER_SNAKE_CASE`, grouped by area:

```json
"ADMIN": {
  "USERS": {
    "TITLE": "Użytkownicy",
    "COL_ROLE": "Rola"
  }
}
```

Polish has three plural forms where English has two, so `i18n.config.ts`
registers a CLDR-correct rule for it — otherwise "5 produkty" instead of
"5 produktów":

```
1 produkt · 2-4 produkty · 5+ produktów · 12-14 produktów
```

### Translating what the API says

The backend answers in English, which is right for an API. The UI never renders
those strings; it renders the **identifier** next to them:

| The API sends | The UI translates on |
| --- | --- |
| `{ slug: "eye-care", name: "Eye care" }` | `VOCAB.CATEGORY.EYE_CARE` |
| `{ code: "budget-over", label: "Well above your 100 PLN budget", params: { budget: 100 } }` | `MATCH.BUDGET_OVER` + params |
| `availability: "LOW_STOCK"` | `VOCAB.AVAILABILITY.LOW_STOCK` |

`useVocabulary()` bridges slugs and enum members to keys; `useMatchReason()`
renders a Personal Match reason from its code and raw params. Both fall back to
the API's English wording for anything the frontend does not recognise, so a new
reason shipped by the backend degrades to English rather than showing a raw key.

`useFormat()` handles money and dates per locale: `59.99 PLN` in English,
`59,99 zł` in Polish.

**Not translated:** free-text catalogue content — product names, product
descriptions, ingredient descriptions. That needs translated columns in the
database, not a lookup table, and is listed under "Next steps".

### Keeping the two files honest

```bash
npm run i18n:check -w @kosvia/web
```

Fails the build when a key is used but undefined, or defined in one locale and
not the other; reports keys nobody uses any more. It understands dynamically
built keys (`` `VOCAB.TAG.${tag}` ``) by prefix. `npm test` runs it first.

The test suite also asserts that no Polish value is byte-identical to its English
counterpart outside an explicit allowlist of loanwords and technical terms
(`Slug`, `INCI`, `Premium`, `Retinoid`…) — that catches a translation someone
forgot to write.

### Why layers

`layers/core` owns the design system and the API client; `layers/admin` extends
it. `BaseButton`, `ProductCard` and `useApi` are defined once and auto-imported
in both. The admin panel gets its own layout, route middleware and navigation
without forking a single component.

Two things layers need that are easy to miss:

- **A bare `@` in a translation.** vue-i18n reads it as linked-message syntax,
  so `you@example.com` fails to compile the message at render time. Escape it as
  `{'@'}`.
- **Tailwind source roots.** Tailwind 4 scans outward from the stylesheet's own
  directory, so it cannot see sibling layers on its own. Every app root is
  declared with `@source` at the top of
  `layers/core/app/assets/css/main.css`. **Add a layer, add an `@source` line**,
  or none of its classes will be generated — and the failure is silent.
- **Store auto-imports.** Nuxt auto-imports `composables/` and `utils/` per
  layer but not `stores/`, so `layers/core/nuxt.config.ts` registers
  `imports.dirs: ['./stores']`.

The Nuxt build directory is set to `.nuxt` rather than the Nuxt 4 default under
`node_modules/.cache`, because the tsconfigs generated there exclude their own
directory and silently break `nuxt typecheck`.

---

## How it works

### The three-way separation

This is the architectural spine of the project, and it is enforced by module
boundaries rather than convention:

| Kind             | Where it comes from                                   | Example                                |
| ---------------- | ----------------------------------------------------- | -------------------------------------- |
| **Raw data**     | PostgreSQL, via Prisma                                | ingredients, prices, stores, categories |
| **Computed data**| Deterministic services in `modules/scoring`           | Personal Match, ingredient score        |
| **AI output**    | `AIProvider`, given the two above as facts            | the sentence explaining the score       |

The AI never produces a number, a price, an ingredient or a product name.

### Personal Match

`PersonalMatchService` is a pure, synchronous, unit-tested function. It starts at
a neutral 50 and moves on named signals — skin type, concerns, goals, fragrance
preference, sensitivity load, budget, ethics, brand preferences, formula quality
and what is already on the shelf. Every point is attributable, which is what makes
the **Why?** panel on the product page possible.

The summed signals are then compressed with `tanh`, so a product matching every
criterion lands near the top of the scale rather than pinning at 99 alongside
every other strong match. Each reported impact is scaled by the same ratio, so
the breakdown still adds up to the number the user sees.

### Ingredient score

`computeIngredientScore` weights each ingredient by its INCI position — earlier
means more of it — and normalises against list length so a padded formula does
not out-score a well-chosen short one. It answers "how much of this formula is
doing useful work?", not "is this safe?". Nothing is ever labelled toxic or bad.

### AI Beauty Shopper

```
question → rule-based intent parsing → profile + shelf → product search →
recommendation engine → real rows → AIProvider writes prose → answer
```

Intent parsing (product type, budget, "cheaper", "do I already have…") is
rule-based on purpose: misreading "under 70 PLN" is a correctness bug, not a
phrasing one. The model receives a fixed list of retrieved products and is told
it may not mention anything else.

`AI_PROVIDER=mock` composes the answer from the retrieved data with no network
call — the chat works offline on a fresh clone. Setting `AI_PROVIDER=anthropic`
with an `AI_API_KEY` routes the same structured context through Claude, and falls
back to the deterministic provider if the call fails.

### SEO

Server-rendered throughout. `useSeo()` owns titles, descriptions, canonicals,
Open Graph and Twitter cards; `useProductJsonLd()` and `useBreadcrumbJsonLd()`
emit structured data. `/sitemap.xml` walks the live catalogue; `/robots.txt`
excludes everything behind auth. Product URLs are clean slugs
(`/products/kalme-ceramide-barrier-cream`), and filtered search pages point their
canonical at the clean category URL so the index is not flooded with duplicates.

---

## API reference

Interactive docs at **http://localhost:3001/docs** in development.

```
POST   /auth/register            POST   /auth/login
POST   /auth/refresh             POST   /auth/logout
GET    /auth/me

GET    /profile                  PATCH  /profile
GET    /profile/options          DELETE /profile

GET    /products                 GET    /products/:slug
GET    /products/:slug/ingredient-score
GET    /products/:id/alternatives
GET    /products/:id/similar
GET    /compare?products=a,b     GET    /discover
POST   /routine/build

GET    /brands                   GET    /categories  ·  /categories/:slug
GET    /ingredients              GET    /ingredients/:slug
GET    /stores

GET    /shelf                    POST   /shelf
PATCH  /shelf/:id                DELETE /shelf/:id
GET    /shelf/analysis

GET    /price-alerts             POST   /price-alerts
PATCH  /price-alerts/:id         DELETE /price-alerts/:id

POST   /ai/chat                  GET    /ai/conversations  ·  /ai/conversations/:id
GET    /ai/products/:slug/explain
GET    /ai/products/:slug/why

GET    /dashboard                GET    /health
/admin/*                         (ADMIN role only)
```

Catalogue endpoints accept an optional session: signed in, every product carries
a personal `personalMatch`; anonymous, it falls back to formula quality.

### Security

Argon-grade password hashing (bcrypt, 12 rounds), HttpOnly + SameSite cookies for
both tokens, refresh-token rotation with hashed storage and single use, global
JWT guard with explicit opt-outs, role guard on `/admin`, Helmet, credentialed
CORS pinned to `FRONTEND_URL`, whitelisted DTO validation that strips unknown
fields, and rate limits tightened on auth and AI endpoints.

---

## Commands

```bash
npm run dev            # shared (watch) + API (watch) + web (dev), in parallel
npm run build          # shared → API → web
npm start              # run both production builds

npm run typecheck      # every workspace
npm run lint           # every workspace
npm test               # every workspace

npm run env            # redistribute .env after editing it
npm run db:up          # docker compose up -d
npm run db:migrate     # prisma migrate dev
npm run db:seed        # reset and reseed demo data
npm run db:reset       # drop, migrate, seed
npm run db:studio      # Prisma Studio
```

---

## Testing

```
apps/api    74 tests   business logic, retrieval, auth API
apps/web    27 tests   formatters and the components that carry meaning
```

The emphasis is on logic that would be expensive to get wrong:

- `PersonalMatchService` — determinism, additive breakdown, fragrance and budget
  handling, hard exclusions, sensitivity weighting, shelf context, bounds
- `computeIngredientScore` — position weighting, list-length normalisation, and
  that no note ever calls an ingredient harmful
- `AlternativeProductService` — cheaper means meaningfully cheaper, similarity is
  measured overlap rather than name matching, no empty groups
- `ComparisonService` — column order, price-per-100 ml normalisation, verdicts
- `BeautyAdvisorService.parseIntent` — the budget and product-type extraction the
  AI is deliberately not trusted with
- Auth API — cookie flags, password policy, timing-equal failures, refresh
  rotation and replay rejection, consistent error shape

---

## Demo data

Everything in `apps/api/prisma/seed` is **invented**. The 22 brands do not exist,
the ~130 products do not exist, the prices are generated and the five retailers
are fictional. Product imagery is generated as SVG at request time from the
product slug, so no third-party photography or copy is used anywhere.

The seed is deterministic: the same slug always produces the same variant,
palette and price band.

| | |
| --- | --- |
| Brands | 22 |
| Categories | 17, three levels deep |
| Ingredients | 139, with functions, tags, tolerance and concern/goal links |
| Products | 132, across 33 realistic formulas |
| Product-ingredient rows | ~1,900 |
| Stores / offers | 5 / ~400 |
| Price history | ~2,400 points |

---

## Known limitations

Deliberate, not accidental:

- **No retailer integrations.** Rossmann, Hebe, Notino and friends are out of
  scope until the product is proven. The `Store` / `ProductOffer` / `PriceHistory`
  schema and the affiliate URL template are in place for when feeds are connected.
- **Price alerts are evaluated on read.** There is no background worker and no
  push notification.
- **Barcode scanning is a placeholder.** `/scan` accepts a typed EAN and looks it
  up; the API has accepted EANs on the shelf endpoint since day one, so the
  camera pipeline is a UI change.
- **Smart Basket is a foundation.** `POST /routine/build` allocates a budget
  across the four core steps greedily; multi-store optimisation is not built.
- **Admin cannot edit ingredient lists yet.** Everything else is editable, and
  saving recomputes the affected scores.
- **No payments.** The Premium tier is described, not sold.
- **Search is PostgreSQL `ILIKE`.** Fine at this scale; a trigram index or a
  dedicated search engine is the next step past ~100k products.

---

## Next steps

Roughly in the order I would do them:

1. **Full-text search** — `pg_trgm` indexes on product and brand names, then a
   ranked query. The cheapest large win as the catalogue grows.
2. **Ingredient editing in admin** — the one CRUD gap; the recompute hooks
   already exist.
3. **Feed importers** — a scheduled job reading affiliate product feeds into
   `ProductOffer` and `PriceHistory`, with a per-store adapter interface.
4. **Price alert worker** — evaluate alerts on import and send email, then push.
5. **Smart Basket proper** — optimise a routine across budget, match, store count
   and product compatibility instead of the current greedy pass.
6. **Barcode scanning** — `BarcodeDetector` where available, a WASM fallback
   elsewhere.
7. **Translated catalogue content** — product and ingredient copy currently
   exists once, in English. The shape is a `translations` table keyed by
   `(entity, entityId, locale, field)`, read through the same fallback the
   frontend vocabulary already uses.
8. **Caching** — the discovery feed and facet counts are the obvious candidates.

---

## A note on positioning

Kosvia gives information about cosmetic products and their ingredients. It is not
a medical service: it does not diagnose skin conditions and does not claim that
any product will treat one. Ingredients are described by what they do, and where
something is worth knowing — fragrance being a common trigger for reactive skin,
for instance — it is stated as information, never as a verdict.
