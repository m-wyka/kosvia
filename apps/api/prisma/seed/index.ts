/**
 * Kosvia database seed — DEMO DATA ONLY.
 *
 * Everything created here is invented for local development: the brands do not
 * exist, the products do not exist, and the prices and store offers are
 * generated, not scraped. Nothing in this file is copied from a real retailer.
 *
 * Run with:  npm run db:seed -w @kosvia/api
 */

import { PrismaClient, Prisma, type SkinType } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { computeIngredientScore } from '../../src/modules/scoring/ingredient-score';
import type { ScorableProductIngredient } from '../../src/modules/scoring/types';
import { normalizeToken } from '../../src/modules/inci/inci-parser';
import { toVolumeUnitEnum } from '../../src/modules/products/volume-unit';
import { DATA_SOURCES, MANUAL_SOURCE_CODE } from '../../src/modules/import/data-sources';
import { CONSENT_VERSIONS, pricePerHundred, type ConsentType } from '@kosvia/shared';
import { ProductTraitsService } from '../../src/modules/scoring/product-traits.service';
import type { PrismaService } from '../../src/common/prisma/prisma.service';
import { BRANDS, CATEGORIES, CONCERNS, GOALS, STORES } from './data/taxonomy';
import { INGREDIENTS, INGREDIENT_ALIASES } from './data/ingredients';
import INGREDIENT_PROSE_PL from './data/ingredients.pl.json';
import { FORMULAS } from './data/formulas';
import { seedAppReviews } from './reviews';

const prisma = new PrismaClient();

/* -------------------------------------------------------------------------- */
/* Deterministic pseudo-randomness — the same seed always builds the same DB.  */
/* -------------------------------------------------------------------------- */

function hashSeed(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function rng(seed: string): () => number {
  let a = hashSeed(seed);
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Prices that look like shelf prices: 39.99, 64.99, 129.00. */
function shelfPrice(value: number): number {
  const base = Math.max(6, value);
  const whole = Math.floor(base);
  return round2(whole + 0.99);
}

/** Snaps a size to something that could plausibly appear on a box. */
function roundVolume(value: number): number {
  const step = value >= 200 ? 50 : value >= 100 ? 25 : value >= 40 ? 10 : 5;
  return Math.max(step, Math.round(value / step) * step);
}

const consentRows = (types: ConsentType[]) =>
  types.map((type) => ({
    type,
    version: CONSENT_VERSIONS[type],
    granted: true,
    grantedAt: new Date(),
  }));

/** Deterministic, checksum-valid EAN-13. */
function makeEan(index: number): string {
  const body = `59${String(1000000000 + index * 7919).slice(0, 10)}`.slice(0, 12);
  let sum = 0;
  for (let i = 0; i < 12; i += 1) sum += Number(body[i]) * (i % 2 === 0 ? 1 : 3);
  return body + String((10 - (sum % 10)) % 10);
}

/** Brands whose whole range is unscented. */
const FRAGRANCE_FREE_BRANDS = new Set([
  'kalme',
  'dermivo',
  'aurelis-skin',
  'serenna',
  'ekhos',
  'cerulea',
  'hydrapure-lab',
]);

type PolishProse = {
  pl: {
    description: string;
    functions: string[];
    commonName: string | null;
    concerns: string | null;
  };
};
const polishProse = (inci: string) => {
  const entry = (INGREDIENT_PROSE_PL as Record<string, PolishProse>)[inci];
  if (!entry) {
    return {};
  }
  return {
    descriptionPl: entry.pl.description,
    functionsPl: entry.pl.functions,
    commonNamePl: entry.pl.commonName,
    concernsPl: entry.pl.concerns,
  };
};

const NON_VEGAN_INGREDIENTS = new Set([
  'Beeswax',
  'Lanolin',
  'Honey Extract',
  'Hydrolyzed Wheat Protein',
]);

const TIER_MULTIPLIER = { value: 0.7, mid: 1, premium: 1.65 } as const;

async function reset(): Promise<void> {
  // Order matters — children first. `deleteMany` keeps the schema intact so
  // re-seeding does not require a migration reset.
  await prisma.aIMessage.deleteMany();
  await prisma.aIConversation.deleteMany();
  await prisma.productComparison.deleteMany();
  await prisma.priceAlert.deleteMany();
  await prisma.userShelfItem.deleteMany();
  await prisma.priceHistory.deleteMany();
  await prisma.productOffer.deleteMany();
  await prisma.productSubmission.deleteMany();
  await prisma.unmatchedToken.deleteMany();
  await prisma.productIngredient.deleteMany();
  await prisma.product.deleteMany();
  await prisma.ingredientAlias.deleteMany();
  await prisma.ingredient.deleteMany();
  await prisma.store.deleteMany();
  await prisma.category.deleteMany();
  await prisma.brand.deleteMany();
  await prisma.beautyProfile.deleteMany();
  await prisma.beautyConcern.deleteMany();
  await prisma.beautyGoal.deleteMany();
  await prisma.importRun.deleteMany();
  await prisma.dataSource.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.user.deleteMany();
}

async function main(): Promise<void> {
  console.log('› Resetting demo data…');
  await reset();

  /* ------------------------------------------------------------ taxonomy -- */

  console.log('› Beauty concerns and goals');
  await prisma.beautyConcern.createMany({ data: CONCERNS.map((c) => ({ ...c })) });
  await prisma.beautyGoal.createMany({ data: GOALS.map((g) => ({ ...g })) });
  const concerns = await prisma.beautyConcern.findMany();
  const goals = await prisma.beautyGoal.findMany();
  const concernBySlug = new Map(concerns.map((c) => [c.slug, c]));
  const goalBySlug = new Map(goals.map((g) => [g.slug, g]));

  console.log('› Categories');
  const categoryBySlug = new Map<string, { id: string; slug: string; name: string }>();
  // Two passes so parents always exist before their children.
  for (const pass of [0, 1, 2]) {
    for (const category of CATEGORIES) {
      const depth = category.parent
        ? CATEGORIES.find((c) => c.slug === category.parent)?.parent
          ? 2
          : 1
        : 0;
      if (depth !== pass || categoryBySlug.has(category.slug)) continue;
      const created = await prisma.category.create({
        data: {
          slug: category.slug,
          name: category.name,
          description: category.description ?? null,
          routineStep: category.routineStep,
          sortOrder: category.sortOrder ?? 0,
          parentId: category.parent ? categoryBySlug.get(category.parent)!.id : null,
        },
      });
      categoryBySlug.set(created.slug, created);
    }
  }

  console.log('› Stores');
  await prisma.store.createMany({
    data: STORES.map((store) => ({
      slug: store.slug,
      name: store.name,
      websiteUrl: store.websiteUrl,
      affiliateUrlTemplate: store.affiliateUrlTemplate ?? null,
      logo: `/img/store/${store.slug}.svg`,
    })),
  });
  const stores = await prisma.store.findMany({ orderBy: { slug: 'asc' } });

  console.log('› Data sources');
  await prisma.dataSource.createMany({ data: DATA_SOURCES });
  const manualSource = await prisma.dataSource.findUniqueOrThrow({
    where: { code: MANUAL_SOURCE_CODE },
  });

  console.log('› Brands');
  await prisma.brand.createMany({
    data: BRANDS.map((brand) => ({
      slug: brand.slug,
      name: brand.name,
      description: brand.description,
      isVegan: brand.isVegan,
      isCrueltyFree: brand.isCrueltyFree,
      logo: `/img/brand/${brand.slug}.svg`,
    })),
  });
  const brands = await prisma.brand.findMany();
  const brandBySlug = new Map(brands.map((b) => [b.slug, b]));

  /* --------------------------------------------------------- ingredients -- */

  console.log(`› Ingredients (${INGREDIENTS.length})`);
  for (const ingredient of INGREDIENTS) {
    const slug = ingredient.inci
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    await prisma.ingredient.create({
      data: {
        inciName: ingredient.inci,
        normalizedName: normalizeToken(ingredient.inci),
        slug,
        commonName: ingredient.common ?? null,
        description: ingredient.description,
        functions: ingredient.functions,
        tags: ingredient.tags,
        concerns: ingredient.concerns ?? null,
        comedogenicRating: ingredient.comedogenic ?? null,
        sensitivityImpact: ingredient.sensitivityImpact ?? 0,
        goodForSkinTypes: (ingredient.goodFor ?? []) as SkinType[],
        isActiveIngredient: ingredient.active ?? false,
        ...polishProse(ingredient.inci),
        targetsConcerns: {
          connect: (ingredient.targets ?? []).map((slugRef) => {
            const found = concernBySlug.get(slugRef);
            if (!found) throw new Error(`Unknown concern slug "${slugRef}" on ${ingredient.inci}`);
            return { id: found.id };
          }),
        },
        supportsGoals: {
          connect: (ingredient.supports ?? []).map((slugRef) => {
            const found = goalBySlug.get(slugRef);
            if (!found) throw new Error(`Unknown goal slug "${slugRef}" on ${ingredient.inci}`);
            return { id: found.id };
          }),
        },
      },
    });
  }
  const ingredients = await prisma.ingredient.findMany({
    include: { targetsConcerns: true, supportsGoals: true },
  });
  const ingredientByInci = new Map(ingredients.map((i) => [i.inciName, i]));

  console.log('› Ingredient aliases');
  for (const alias of INGREDIENT_ALIASES) {
    const ingredient = ingredientByInci.get(alias.inci);
    if (!ingredient)
      throw new Error(`Alias "${alias.alias}" points at unknown INCI "${alias.inci}"`);
    await prisma.ingredientAlias.create({
      data: {
        ingredientId: ingredient.id,
        alias: normalizeToken(alias.alias),
        aliasRaw: alias.alias,
        kind: alias.kind,
      },
    });
  }

  /* ------------------------------------------------------------ products -- */

  console.log('› Products, ingredient lists and offers');
  const brandList = BRANDS;
  let productIndex = 0;
  const createdProducts: Array<{ id: string; slug: string; categoryId: string; price: number }> =
    [];

  for (const [formulaIndex, formula] of FORMULAS.entries()) {
    const category = categoryBySlug.get(formula.category);
    if (!category) throw new Error(`Unknown category "${formula.category}" on ${formula.key}`);

    // Four brands per formula, rotated so every brand ends up with a range.
    for (let variant = 0; variant < 4; variant += 1) {
      const brandSeed = brandList[(formulaIndex * 4 + variant * 3) % brandList.length];
      const brand = brandBySlug.get(brandSeed.slug)!;
      const random = rng(`${formula.key}:${brandSeed.slug}`);

      const scented = !FRAGRANCE_FREE_BRANDS.has(brandSeed.slug) && Boolean(formula.fragranceInci);
      const inciNames = scented ? [...formula.inci, ...formula.fragranceInci!] : formula.inci;

      const volumeVariants = [1, 1, 1, 0.75, 1.25];
      const volumeFactor = volumeVariants[Math.floor(random() * volumeVariants.length)];
      // Cosmetics ship in round sizes — 15/30/50/200, never 23.
      const volume = roundVolume(formula.volume * volumeFactor);

      const price = shelfPrice(
        formula.basePrice *
          TIER_MULTIPLIER[brandSeed.tier] *
          volumeFactor *
          (0.88 + random() * 0.3),
      );

      const slug = `${brandSeed.slug}-${formula.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')}`;
      const isVegan = brandSeed.isVegan && !inciNames.some((n) => NON_VEGAN_INGREDIENTS.has(n));

      const productIngredients: Prisma.ProductIngredientCreateWithoutProductInput[] = [];
      const scorable: ScorableProductIngredient[] = [];
      inciNames.forEach((inci, idx) => {
        const ingredient = ingredientByInci.get(inci);
        if (!ingredient)
          throw new Error(`Formula ${formula.key} references unknown INCI "${inci}"`);
        productIngredients.push({
          position: idx + 1,
          rawText: inci,
          ingredient: { connect: { id: ingredient.id } },
        });
        scorable.push({
          position: idx + 1,
          ingredient: {
            id: ingredient.id,
            inciName: ingredient.inciName,
            tags: ingredient.tags,
            sensitivityImpact: ingredient.sensitivityImpact,
            comedogenicRating: ingredient.comedogenicRating,
            isActiveIngredient: ingredient.isActiveIngredient,
            goodForSkinTypes: ingredient.goodForSkinTypes,
            targetsConcerns: ingredient.targetsConcerns.map((c) => c.slug),
            supportsGoals: ingredient.supportsGoals.map((g) => g.slug),
          },
        });
      });

      const { score } = computeIngredientScore(scorable);

      const product = await prisma.product.create({
        data: {
          name: formula.name,
          slug,
          brandId: brand.id,
          categoryId: category.id,
          description: `${formula.description}\n\n${brandSeed.name}'s take on a ${formula.shortPurpose}.`,
          usage: formula.usage,
          variants: {
            create: {
              ean: makeEan(productIndex),
              imageUrl: `/img/product/${slug}.svg`,
              volume,
              volumeUnit: toVolumeUnitEnum(formula.volumeUnit),
              isDefault: true,
            },
          },
          highlights: formula.highlights,
          isFragranceFree: !scented,
          isVegan,
          isCrueltyFree: brandSeed.isCrueltyFree,
          targetSkinTypes: formula.targetSkinTypes as SkinType[],
          ingredientScore: score,
          sourceId: manualSource.id,
          ingredients: { create: productIngredients },
        },
        include: { variants: true },
      });
      const defaultVariant = product.variants[0]!;

      /* ------------------------------------------------------- offers ---- */

      const offerCount = 2 + Math.floor(random() * 3); // 2-4 stores
      const chosen = [...stores].sort(() => random() - 0.5).slice(0, offerCount);
      // Only in-stock offers count towards the denormalised lowest price — it
      // has to mean the same thing here, in the API response and in the admin
      // recompute, or budget filters quietly disagree with what is displayed.
      let lowest = Number.POSITIVE_INFINITY;

      for (const store of chosen) {
        const storePrice = shelfPrice(price * (0.9 + random() * 0.22));
        const availabilityRoll = random();
        const inStock = availabilityRoll <= 0.92;
        if (inStock) lowest = Math.min(lowest, storePrice);
        await prisma.productOffer.create({
          data: {
            variantId: defaultVariant.id,
            storeId: store.id,
            price: new Prisma.Decimal(storePrice),
            url: `${store.websiteUrl}/p/${slug}`,
            availability: !inStock
              ? 'OUT_OF_STOCK'
              : availabilityRoll > 0.82
                ? 'LOW_STOCK'
                : 'IN_STOCK',
            lastCheckedAt: new Date(Date.now() - Math.floor(random() * 36) * 3600 * 1000),
          },
        });

        // Six months of monthly price points, so the future price-history UI
        // has something real-shaped to draw.
        const history: Prisma.PriceHistoryCreateManyInput[] = [];
        for (let month = 6; month >= 1; month -= 1) {
          history.push({
            variantId: defaultVariant.id,
            storeId: store.id,
            price: new Prisma.Decimal(shelfPrice(storePrice * (0.92 + random() * 0.2))),
            recordedAt: new Date(Date.now() - month * 30 * 24 * 3600 * 1000),
          });
        }
        await prisma.priceHistory.createMany({ data: history });
      }

      const lowestPrice = Number.isFinite(lowest) ? new Prisma.Decimal(lowest) : null;
      const unitPrice = Number.isFinite(lowest)
        ? pricePerHundred(lowest, volume, formula.volumeUnit)
        : null;
      await prisma.product.update({
        where: { id: product.id },
        data: {
          lowestPrice,
          pricePerHundred: unitPrice === null ? null : new Prisma.Decimal(unitPrice),
        },
      });

      createdProducts.push({
        id: product.id,
        slug,
        categoryId: category.id,
        price: Number.isFinite(lowest) ? lowest : price,
      });
      productIndex += 1;
    }
  }
  console.log(`  created ${createdProducts.length} products`);

  /* --------------------------------------------------------- demo users -- */

  console.log('› Demo accounts');
  const userPassword = process.env.SEED_USER_PASSWORD ?? 'Password123!';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'Admin123!';

  await prisma.user.create({
    data: {
      email: 'admin@kosvia.app',
      name: 'Kosvia Admin',
      role: 'ADMIN',
      birthDate: new Date('1990-01-01'),
      passwordHash: await bcrypt.hash(adminPassword, 12),
      consents: { create: consentRows(['TERMS', 'PRIVACY']) },
    },
  });

  const demo = await prisma.user.create({
    data: {
      email: 'demo@kosvia.app',
      name: 'Demo User',
      role: 'USER',
      subscriptionStatus: 'PREMIUM',
      birthDate: new Date('1992-05-14'),
      passwordHash: await bcrypt.hash(userPassword, 12),
      consents: {
        create: consentRows(['TERMS', 'PRIVACY', 'BEAUTY_PROFILE_HEALTH', 'AI_PROCESSING']),
      },
      beautyProfile: {
        create: {
          skinType: 'COMBINATION',
          sensitivity: 'MEDIUM',
          budget: 'UNDER_100',
          fragrancePreference: 'PREFER_FRAGRANCE_FREE',
          veganPreference: false,
          crueltyFreePreference: true,
          concerns: {
            connect: ['dehydration', 'redness', 'pores', 'uneven-tone'].map((slug) => ({
              id: concernBySlug.get(slug)!.id,
            })),
          },
          goals: {
            connect: ['hydration', 'barrier-support', 'brightening', 'sun-protection'].map(
              (slug) => ({
                id: goalBySlug.get(slug)!.id,
              }),
            ),
          },
        },
      },
    },
  });

  // A believable starter shelf: one product per routine step, plus a second
  // serum so the routine analysis has a real overlap to point out, and no SPF
  // so the gap detection has something to say too.
  const pickByStep = async (step: 'CLEANSER' | 'SERUM' | 'MOISTURIZER' | 'TONER', skip = 0) =>
    prisma.product.findFirst({
      where: { category: { routineStep: step } },
      orderBy: { ingredientScore: 'desc' },
      skip,
      select: { id: true },
    });

  const shelfPicks = [
    {
      product: await pickByStep('CLEANSER'),
      favorite: true,
      notes: 'Works well, no tightness afterwards.',
    },
    { product: await pickByStep('TONER'), favorite: false, notes: null },
    { product: await pickByStep('SERUM'), favorite: true, notes: null },
    {
      product: await pickByStep('SERUM', 1),
      favorite: false,
      notes: 'Alternating this with the other serum.',
    },
    { product: await pickByStep('MOISTURIZER'), favorite: false, notes: null },
  ];

  for (const [index, pick] of shelfPicks.entries()) {
    if (!pick.product) continue;
    await prisma.userShelfItem.create({
      data: {
        userId: demo.id,
        productId: pick.product.id,
        isFavorite: pick.favorite,
        openedAt: index < 3 ? new Date(Date.now() - 20 * 24 * 3600 * 1000) : null,
        addedAt: new Date(Date.now() - (40 - index * 6) * 24 * 3600 * 1000),
        notes: pick.notes,
      },
    });
  }

  const alertTargets = createdProducts.slice(10, 12);
  for (const product of alertTargets) {
    await prisma.priceAlert.create({
      data: {
        userId: demo.id,
        productId: product.id,
        targetPrice: new Prisma.Decimal(round2(product.price * 0.85)),
      },
    });
  }

  const conversation = await prisma.aIConversation.create({
    data: { userId: demo.id, title: 'A moisturiser under 70 PLN' },
  });
  await prisma.aIMessage.createMany({
    data: [
      {
        conversationId: conversation.id,
        role: 'USER',
        content: 'I need a moisturiser under 70 PLN for combination, slightly sensitive skin.',
      },
      {
        conversationId: conversation.id,
        role: 'ASSISTANT',
        content:
          'Looking at your profile and what is already on your shelf, a fragrance-free barrier cream is the safest fit in that price range. Open the chat to run this again with live prices.',
        suggestions: [],
      },
    ],
  });

  /* --------------------------------------------------------- app reviews -- */

  console.log('› Portal reviews');
  const reviewCount = await seedAppReviews(prisma);
  console.log(`  created ${reviewCount} reviewers with reviews`);

  /* -------------------------------------------------------------- traits -- */

  console.log('› Product traits');
  const traitsService = new ProductTraitsService(prisma as unknown as PrismaService);
  await traitsService.refreshAll();

  /* ------------------------------------------------------------- summary -- */

  const counts = {
    brands: await prisma.brand.count(),
    categories: await prisma.category.count(),
    ingredients: await prisma.ingredient.count(),
    products: await prisma.product.count(),
    productIngredients: await prisma.productIngredient.count(),
    stores: await prisma.store.count(),
    offers: await prisma.productOffer.count(),
    priceHistory: await prisma.priceHistory.count(),
    users: await prisma.user.count(),
  };
  console.log('\n✔ Seed complete (demo data)');
  console.table(counts);
  console.log(`\n  demo@kosvia.app  / ${userPassword}`);
  console.log(`  admin@kosvia.app / ${adminPassword}\n`);
}

main()
  .catch((error) => {
    console.error('\n✖ Seed failed:\n', error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
