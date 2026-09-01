/**
 * Generates deterministic demo offers for catalogue products that have none,
 * so budget filters, price sorting, alerts and history work during local
 * testing. Fully reversible — remove everything before wiring real feeds.
 *
 *   npm run prices:demo -w @kosvia/api               # create offers + history
 *   npm run prices:demo -w @kosvia/api -- --dry-run  # report without writing
 *   npm run prices:demo -w @kosvia/api -- --remove   # revert to the pre-script state
 */
import { Prisma, PrismaClient, RoutineStep } from '@prisma/client';

const prisma = new PrismaClient();

const DEMO_SOURCE_CODE = 'demo-prices';

const DEMO_STORES = [
  { slug: 'drogeria-demo-1', name: 'Drogeria Różana', multiplier: 0.95 },
  { slug: 'drogeria-demo-2', name: 'Kosmetyczka.pl', multiplier: 1.0 },
  { slug: 'drogeria-demo-3', name: 'Uroda24', multiplier: 1.08 },
];

const PRICE_RANGES: Partial<Record<RoutineStep, [number, number]>> = {
  CLEANSER: [12, 60],
  TONER: [15, 70],
  EXFOLIANT: [20, 90],
  SERUM: [30, 150],
  EYE: [25, 120],
  MOISTURIZER: [15, 120],
  SPF: [25, 70],
  MASK: [10, 60],
  TREATMENT: [25, 130],
  BODY: [10, 70],
  HAIR: [10, 80],
  MAKEUP: [15, 110],
};
const DEFAULT_RANGE: [number, number] = [15, 90];

const HISTORY_WEEKS = 6;
const HISTORY_JITTER = 0.05;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const BATCH_SIZE = 1000;

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

function shelfPrice(value: number, random: () => number): number {
  const whole = Math.max(5, Math.floor(value));
  const ending = random() < 0.7 ? 0.99 : 0.49;
  return whole + ending;
}

function chunk<T>(items: T[], size: number): T[][] {
  const batches: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    batches.push(items.slice(index, index + size));
  }
  return batches;
}

async function refreshLowestPrices(productIds: string[]): Promise<void> {
  for (const ids of chunk(productIds, BATCH_SIZE)) {
    await prisma.$executeRaw`
      UPDATE products AS p
      SET "lowestPrice" = sub.min_price
      FROM (
        SELECT v."productId" AS product_id, MIN(o.price) AS min_price
        FROM product_offers o
        JOIN product_variants v ON v.id = o."variantId"
        WHERE o.availability <> 'OUT_OF_STOCK'
        GROUP BY v."productId"
      ) AS sub
      WHERE p.id = sub.product_id AND p.id IN (${Prisma.join(ids)})`;
    await prisma.$executeRaw`
      UPDATE products AS p
      SET "lowestPrice" = NULL
      WHERE p.id IN (${Prisma.join(ids)})
        AND NOT EXISTS (
          SELECT 1
          FROM product_offers o
          JOIN product_variants v ON v.id = o."variantId"
          WHERE v."productId" = p.id AND o.availability <> 'OUT_OF_STOCK')`;
  }
}

async function remove(): Promise<void> {
  const source = await prisma.dataSource.findUnique({ where: { code: DEMO_SOURCE_CODE } });
  const stores = await prisma.store.findMany({
    where: { slug: { in: DEMO_STORES.map((store) => store.slug) } },
    select: { id: true },
  });
  const storeIds = stores.map((store) => store.id);

  const offers = source
    ? await prisma.productOffer.findMany({
        where: { sourceId: source.id },
        select: { variant: { select: { productId: true } } },
      })
    : [];
  const productIds = [...new Set(offers.map((offer) => offer.variant.productId))];

  const history = storeIds.length
    ? await prisma.priceHistory.deleteMany({ where: { storeId: { in: storeIds } } })
    : { count: 0 };
  const removedOffers = source
    ? await prisma.productOffer.deleteMany({ where: { sourceId: source.id } })
    : { count: 0 };

  if (productIds.length) {
    await refreshLowestPrices(productIds);
  }

  const removableStores = storeIds.length
    ? await prisma.store.deleteMany({
        where: { id: { in: storeIds }, offers: { none: {} }, priceHistory: { none: {} } },
      })
    : { count: 0 };
  if (source) {
    const remaining = await prisma.productOffer.count({ where: { sourceId: source.id } });
    if (remaining === 0) {
      await prisma.dataSource.delete({ where: { id: source.id } });
    }
  }

  console.log(
    `Removed ${removedOffers.count} offers, ${history.count} history points, ` +
      `${removableStores.count} stores; recomputed lowestPrice for ${productIds.length} products.`,
  );
}

async function generate(isDryRun: boolean): Promise<void> {
  const variants = await prisma.productVariant.findMany({
    where: { isDefault: true, offers: { none: {} } },
    select: {
      id: true,
      product: {
        select: {
          id: true,
          name: true,
          category: { select: { routineStep: true } },
        },
      },
    },
  });

  if (!variants.length) {
    console.log('Every default variant already has offers — nothing to do.');
    return;
  }

  const now = Date.now();
  const offers: Prisma.ProductOfferCreateManyInput[] = [];
  const history: Prisma.PriceHistoryCreateManyInput[] = [];
  const samples: string[] = [];
  const storeIdBySlug = new Map<string, string>();
  let sourceId = '';

  if (!isDryRun) {
    const source = await prisma.dataSource.upsert({
      where: { code: DEMO_SOURCE_CODE },
      update: {},
      create: {
        code: DEMO_SOURCE_CODE,
        name: 'Demo prices',
        license: 'Generated locally for development — not real market data',
      },
    });
    sourceId = source.id;
    for (const store of DEMO_STORES) {
      const row = await prisma.store.upsert({
        where: { slug: store.slug },
        update: {},
        create: { slug: store.slug, name: store.name },
      });
      storeIdBySlug.set(store.slug, row.id);
    }
  }

  for (const variant of variants) {
    const random = rng(`demo-price:${variant.product.id}`);
    const [minPrice, maxPrice] =
      PRICE_RANGES[variant.product.category.routineStep] ?? DEFAULT_RANGE;
    const basePrice = minPrice + random() * (maxPrice - minPrice);
    const storePrices: number[] = [];

    for (const store of DEMO_STORES) {
      const price = shelfPrice(basePrice * store.multiplier, random);
      storePrices.push(price);
      offers.push({
        variantId: variant.id,
        storeId: storeIdBySlug.get(store.slug) ?? store.slug,
        sourceId: sourceId || null,
        price: new Prisma.Decimal(price),
      });

      for (let weeksAgo = HISTORY_WEEKS; weeksAgo >= 1; weeksAgo -= 1) {
        const jitter = 1 + (random() * 2 - 1) * HISTORY_JITTER;
        history.push({
          variantId: variant.id,
          storeId: storeIdBySlug.get(store.slug) ?? store.slug,
          price: new Prisma.Decimal(shelfPrice(price * jitter, random)),
          recordedAt: new Date(now - weeksAgo * WEEK_MS),
        });
      }
      history.push({
        variantId: variant.id,
        storeId: storeIdBySlug.get(store.slug) ?? store.slug,
        price: new Prisma.Decimal(price),
        recordedAt: new Date(now),
      });
    }

    if (samples.length < 5) {
      const lowest = Math.min(...storePrices);
      samples.push(
        `  ${variant.product.name.slice(0, 60)} [${variant.product.category.routineStep}] → od ${lowest.toFixed(2)} PLN`,
      );
    }
  }

  console.log(
    `${isDryRun ? '[dry-run] Would create' : 'Creating'} ${offers.length} offers and ` +
      `${history.length} history points for ${variants.length} products across ${DEMO_STORES.length} stores.`,
  );
  console.log(samples.join('\n'));

  if (isDryRun) {
    return;
  }

  for (const batch of chunk(offers, BATCH_SIZE)) {
    await prisma.productOffer.createMany({ data: batch, skipDuplicates: true });
  }
  for (const batch of chunk(history, BATCH_SIZE)) {
    await prisma.priceHistory.createMany({ data: batch });
  }

  const productIds = [...new Set(variants.map((variant) => variant.product.id))];
  await refreshLowestPrices(productIds);
  console.log(`Recomputed lowestPrice for ${productIds.length} products.`);
}

const main = async () => {
  const isDryRun = process.argv.includes('--dry-run');
  const isRemove = process.argv.includes('--remove');
  try {
    if (isRemove) {
      await remove();
    } else {
      await generate(isDryRun);
    }
  } finally {
    await prisma.$disconnect();
  }
};

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
