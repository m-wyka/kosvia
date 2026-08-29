import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { PRODUCT_INCLUDE, type ProductRow } from '../products/product.select';
import { toScorable } from '../products/product.mapper';
import { computeIngredientScore } from './ingredient-score';
import { computeTraits, TRAITS_VERSION, type ComputedTraits } from './product-traits';

const BATCH_SIZE = 200;

/**
 * Keeps the denormalised columns that depend on a product's ingredient list
 * — `ingredientScore` and the `product_traits` row — in step with it. Every
 * path that changes a formula (admin, INCI import, queue re-match, seed)
 * calls `refresh`.
 */
@Injectable()
export class ProductTraitsService {
  private readonly logger = new Logger(ProductTraitsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async refresh(productIds: string[]): Promise<void> {
    const unique = [...new Set(productIds)];
    for (let offset = 0; offset < unique.length; offset += BATCH_SIZE) {
      const rows = await this.prisma.product.findMany({
        where: { id: { in: unique.slice(offset, offset + BATCH_SIZE) } },
        include: PRODUCT_INCLUDE,
      });
      for (const row of rows) {
        await this.refreshRow(row);
      }
    }
  }

  async refreshAll(options: { onlyStale?: boolean } = {}): Promise<number> {
    const where: Prisma.ProductWhereInput = options.onlyStale
      ? { OR: [{ traits: null }, { traits: { traitsVersion: { lt: TRAITS_VERSION } } }] }
      : {};
    let refreshed = 0;
    let cursor: string | undefined;
    for (;;) {
      const rows = await this.prisma.product.findMany({
        where,
        include: PRODUCT_INCLUDE,
        orderBy: { id: 'asc' },
        take: BATCH_SIZE,
        ...(cursor && { skip: 1, cursor: { id: cursor } }),
      });
      if (!rows.length) {
        return refreshed;
      }
      for (const row of rows) {
        await this.refreshRow(row);
        refreshed += 1;
      }
      cursor = rows[rows.length - 1].id;
      this.logger.log(`Refreshed traits for ${refreshed} products`);
    }
  }

  async refreshRow(row: ProductRow): Promise<ComputedTraits> {
    const scorable = toScorable(row);
    const { score } = computeIngredientScore(scorable.ingredients);
    const traits = computeTraits({
      isFragranceFree: row.isFragranceFree,
      labelRowCount: row.ingredients.length,
      ingredients: row.ingredients.flatMap((entry) =>
        entry.ingredient
          ? [
              {
                position: entry.position,
                isAfterMayContain: entry.isAfterMayContain,
                matchConfidence: entry.matchConfidence,
                normalizedName: entry.ingredient.normalizedName,
                ingredient: {
                  id: entry.ingredient.id,
                  inciName: entry.ingredient.inciName,
                  commonName: entry.ingredient.commonName,
                  tags: entry.ingredient.tags,
                  sensitivityImpact: entry.ingredient.sensitivityImpact,
                  comedogenicRating: entry.ingredient.comedogenicRating,
                  isActiveIngredient: entry.ingredient.isActiveIngredient,
                  goodForSkinTypes: entry.ingredient.goodForSkinTypes,
                  targetsConcerns: entry.ingredient.targetsConcerns.map((c) => c.slug),
                  supportsGoals: entry.ingredient.supportsGoals.map((g) => g.slug),
                },
              },
            ]
          : [],
      ),
    });

    await this.prisma.$transaction([
      ...(score !== row.ingredientScore
        ? [this.prisma.product.update({ where: { id: row.id }, data: { ingredientScore: score } })]
        : []),
      this.upsertTraits(row.id, traits),
    ]);
    return traits;
  }

  /** Nearest formulas by cosine distance on the fingerprint, same category only. */
  async similarByFingerprint(
    productId: string,
    categoryId: string,
    limit: number,
  ): Promise<Array<{ id: string; similarity: number }>> {
    return this.prisma.$queryRaw<Array<{ id: string; similarity: number }>>(Prisma.sql`
      SELECT p."id", (1 - (t."fingerprint" <=> s."fingerprint"))::float8 AS similarity
      FROM "product_traits" s
      JOIN "product_traits" t ON t."productId" <> s."productId"
      JOIN "products" p ON p."id" = t."productId"
      WHERE s."productId" = ${productId}
        AND s."fingerprint" IS NOT NULL
        AND t."fingerprint" IS NOT NULL
        AND p."isActive"
        AND p."categoryId" = ${categoryId}
      ORDER BY t."fingerprint" <=> s."fingerprint"
      LIMIT ${limit}
    `);
  }

  private upsertTraits(productId: string, traits: ComputedTraits) {
    const { fingerprint, ...columns } = traits;
    const vector = `[${fingerprint.map((value) => value.toFixed(6)).join(',')}]`;
    return this.prisma.$executeRaw(Prisma.sql`
      INSERT INTO "product_traits" (
        "productId", "hasFragrance", "hasFragranceAllergen", "hasAlcoholDenat", "alcoholDenatPosition",
        "hasEssentialOils", "hasSilicones", "hasSpf",
        "humectantScore", "emollientScore", "occlusiveScore", "antioxidantScore", "exfoliantScore",
        "soothingScore", "brighteningScore", "antiAgingScore", "sebumRegulationScore",
        "skinFitDry", "skinFitOily", "skinFitCombination", "skinFitNormal", "skinFitSensitive",
        "calmingLoad", "irritantLoad", "activeIngredientIds", "concernSlugs", "goalSlugs", "fingerprint",
        "ingredientCount", "recognizedRatio", "dataCompleteness", "traitsVersion", "computedAt"
      ) VALUES (
        ${productId}, ${columns.hasFragrance}, ${columns.hasFragranceAllergen}, ${columns.hasAlcoholDenat},
        ${columns.alcoholDenatPosition}, ${columns.hasEssentialOils}, ${columns.hasSilicones}, ${columns.hasSpf},
        ${columns.humectantScore}, ${columns.emollientScore}, ${columns.occlusiveScore}, ${columns.antioxidantScore},
        ${columns.exfoliantScore}, ${columns.soothingScore}, ${columns.brighteningScore}, ${columns.antiAgingScore},
        ${columns.sebumRegulationScore}, ${columns.skinFitDry}, ${columns.skinFitOily}, ${columns.skinFitCombination},
        ${columns.skinFitNormal}, ${columns.skinFitSensitive}, ${columns.calmingLoad}, ${columns.irritantLoad},
        ${columns.activeIngredientIds}::text[], ${columns.concernSlugs}::text[], ${columns.goalSlugs}::text[],
        ${vector}::vector, ${columns.ingredientCount}, ${columns.recognizedRatio}, ${columns.dataCompleteness},
        ${columns.traitsVersion}, NOW()
      )
      ON CONFLICT ("productId") DO UPDATE SET
        "hasFragrance" = EXCLUDED."hasFragrance",
        "hasFragranceAllergen" = EXCLUDED."hasFragranceAllergen",
        "hasAlcoholDenat" = EXCLUDED."hasAlcoholDenat",
        "alcoholDenatPosition" = EXCLUDED."alcoholDenatPosition",
        "hasEssentialOils" = EXCLUDED."hasEssentialOils",
        "hasSilicones" = EXCLUDED."hasSilicones",
        "hasSpf" = EXCLUDED."hasSpf",
        "humectantScore" = EXCLUDED."humectantScore",
        "emollientScore" = EXCLUDED."emollientScore",
        "occlusiveScore" = EXCLUDED."occlusiveScore",
        "antioxidantScore" = EXCLUDED."antioxidantScore",
        "exfoliantScore" = EXCLUDED."exfoliantScore",
        "soothingScore" = EXCLUDED."soothingScore",
        "brighteningScore" = EXCLUDED."brighteningScore",
        "antiAgingScore" = EXCLUDED."antiAgingScore",
        "sebumRegulationScore" = EXCLUDED."sebumRegulationScore",
        "skinFitDry" = EXCLUDED."skinFitDry",
        "skinFitOily" = EXCLUDED."skinFitOily",
        "skinFitCombination" = EXCLUDED."skinFitCombination",
        "skinFitNormal" = EXCLUDED."skinFitNormal",
        "skinFitSensitive" = EXCLUDED."skinFitSensitive",
        "calmingLoad" = EXCLUDED."calmingLoad",
        "irritantLoad" = EXCLUDED."irritantLoad",
        "activeIngredientIds" = EXCLUDED."activeIngredientIds",
        "concernSlugs" = EXCLUDED."concernSlugs",
        "goalSlugs" = EXCLUDED."goalSlugs",
        "fingerprint" = EXCLUDED."fingerprint",
        "ingredientCount" = EXCLUDED."ingredientCount",
        "recognizedRatio" = EXCLUDED."recognizedRatio",
        "dataCompleteness" = EXCLUDED."dataCompleteness",
        "traitsVersion" = EXCLUDED."traitsVersion",
        "computedAt" = NOW()
    `);
  }
}
