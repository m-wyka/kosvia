/**
 * Step 2 of 3 of the ProductVariant migration (03_MODEL_DANYCH.md §3).
 *
 *   npm run variants:backfill -w @kosvia/api
 *
 * Every product without a variant gets one default variant carrying its
 * ean / volume / volumeUnit / imageUrl; offers and price points that do not
 * know their variant yet are attached to that default. Safe to re-run.
 */
import { PrismaClient, type VolumeUnit } from '@prisma/client';

const prisma = new PrismaClient();

const MILLILITRES_PER_FLUID_OUNCE = 29.5735;

const toVolume = (
  volume: number | null,
  unit: string | null,
): { volume: number | null; volumeUnit: VolumeUnit } => {
  if (volume === null) {
    return { volume: null, volumeUnit: 'ML' };
  }
  switch ((unit ?? 'ml').toLowerCase()) {
    case 'g':
      return { volume, volumeUnit: 'G' };
    case 'kg':
      return { volume: volume * 1000, volumeUnit: 'G' };
    case 'l':
      return { volume: volume * 1000, volumeUnit: 'ML' };
    case 'fl oz':
      return { volume: Math.round(volume * MILLILITRES_PER_FLUID_OUNCE), volumeUnit: 'ML' };
    case 'piece':
    case 'pcs':
      return { volume, volumeUnit: 'PIECE' };
    default:
      return { volume, volumeUnit: 'ML' };
  }
};

const main = async () => {
  const products = await prisma.product.findMany({
    where: { variants: { none: {} } },
    select: {
      id: true,
      ean: true,
      volume: true,
      volumeUnit: true,
      imageUrl: true,
      sourceRef: true,
    },
  });
  for (const product of products) {
    await prisma.productVariant.create({
      data: {
        productId: product.id,
        ean: product.ean,
        ...toVolume(product.volume, product.volumeUnit),
        imageUrl: product.imageUrl,
        sourceRef: product.sourceRef,
        isDefault: true,
      },
    });
  }
  console.log(`created ${products.length} default variants`);

  const defaults = await prisma.productVariant.findMany({
    where: { isDefault: true },
    select: { id: true, productId: true },
  });
  let offers = 0;
  let pricePoints = 0;
  for (const variant of defaults) {
    const offerResult = await prisma.productOffer.updateMany({
      where: { productId: variant.productId, variantId: null },
      data: { variantId: variant.id },
    });
    const historyResult = await prisma.priceHistory.updateMany({
      where: { productId: variant.productId, variantId: null },
      data: { variantId: variant.id },
    });
    offers += offerResult.count;
    pricePoints += historyResult.count;
  }
  console.log(`attached ${offers} offers and ${pricePoints} price points to default variants`);

  const orphans = await prisma.product.count({
    where: { variants: { none: { isDefault: true } } },
  });
  if (orphans) {
    throw new Error(`${orphans} products still have no default variant`);
  }
};

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
