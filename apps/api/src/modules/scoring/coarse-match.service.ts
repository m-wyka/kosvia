import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { BUDGET_CEILING } from '@kosvia/shared';
import { PrismaService } from '../../common/prisma/prisma.service';
import { coarseWeights, SENSITIVITY_MULTIPLIER, type CoarseWeights } from './coarse-match';
import { MatchWeightService } from './match-weight.service';
import type { ScorableProfile, ShelfSnapshot } from './types';

/** How many candidates pass A hands to the exact scorer (04_PERSONAL_MATCH.md §2). */
export const COARSE_CANDIDATE_LIMIT = 200;

const SKIN_FIT_COLUMN: Record<Exclude<ScorableProfile['skinType'], 'UNKNOWN'>, Prisma.Sql> = {
  DRY: Prisma.sql`t."skinFitDry"`,
  OILY: Prisma.sql`t."skinFitOily"`,
  COMBINATION: Prisma.sql`t."skinFitCombination"`,
  NORMAL: Prisma.sql`t."skinFitNormal"`,
  SENSITIVE: Prisma.sql`t."skinFitSensitive"`,
};

export interface CoarseCandidate {
  id: string;
  coarse: number;
}

/**
 * Pass A as SQL: the same admissible upper bound as `coarseDelta`, evaluated
 * by Postgres over product_traits so the exact scorer only ever sees the top
 * candidates. Hard exclusions (brands, ingredients the user avoids) narrow
 * the set in WHERE — they are filters, not penalties.
 */
@Injectable()
export class CoarseMatchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly weightSets: MatchWeightService,
  ) {}

  async topCandidates(
    productIds: string[],
    profile: ScorableProfile | null,
    shelf: ShelfSnapshot | undefined,
    limit = COARSE_CANDIDATE_LIMIT,
  ): Promise<CoarseCandidate[]> {
    if (!productIds.length) {
      return [];
    }
    const expression = profile
      ? this.coarseExpression(profile, shelf)
      : Prisma.sql`p."ingredientScore"`;
    const exclusions = profile ? this.exclusions(profile) : Prisma.empty;
    return this.prisma.$queryRaw<CoarseCandidate[]>(Prisma.sql`
      SELECT p."id", (${expression})::float8 AS coarse
      FROM "products" p
      LEFT JOIN "product_traits" t ON t."productId" = p."id"
      WHERE p."id" = ANY(${productIds}::text[])
        ${exclusions}
      ORDER BY coarse DESC, p."ingredientScore" DESC, p."id" ASC
      LIMIT ${limit}
    `);
  }

  private exclusions(profile: ScorableProfile): Prisma.Sql {
    const parts: Prisma.Sql[] = [];
    if (profile.excludedBrandIds.length) {
      parts.push(Prisma.sql`AND p."brandId" <> ALL(${profile.excludedBrandIds}::text[])`);
    }
    if (profile.allergenIngredientIds.length) {
      parts.push(Prisma.sql`AND NOT EXISTS (
        SELECT 1 FROM "product_ingredients" pi
        WHERE pi."productId" = p."id" AND pi."ingredientId" = ANY(${profile.allergenIngredientIds}::text[])
      )`);
    }
    return parts.length ? Prisma.join(parts, ' ', '', '') : Prisma.empty;
  }

  private coarseExpression(profile: ScorableProfile, shelf?: ShelfSnapshot): Prisma.Sql {
    const COARSE_WEIGHTS: CoarseWeights = coarseWeights(this.weightSets.current());
    const terms: Prisma.Sql[] = [];

    if (profile.skinType !== 'UNKNOWN') {
      terms.push(
        Prisma.sql`CASE WHEN ${profile.skinType}::text = ANY(p."targetSkinTypes"::text[]) THEN ${COARSE_WEIGHTS.skinTypePositioned} ELSE 0 END`,
      );
      terms.push(
        Prisma.sql`${COARSE_WEIGHTS.skinTypeIngredients} * COALESCE(${SKIN_FIT_COLUMN[profile.skinType]}, 0)`,
      );
    }

    if (profile.concernSlugs.length) {
      terms.push(
        this.coverageTerm(
          Prisma.sql`t."concernSlugs"`,
          profile.concernSlugs,
          COARSE_WEIGHTS.concerns,
          COARSE_WEIGHTS.concernsCoverageShare,
          COARSE_WEIGHTS.concernsDepthShare,
        ),
      );
    }

    if (profile.goalSlugs.length) {
      terms.push(
        this.coverageTerm(
          Prisma.sql`t."goalSlugs"`,
          profile.goalSlugs,
          COARSE_WEIGHTS.goals,
          COARSE_WEIGHTS.goalsCoverageShare,
          COARSE_WEIGHTS.goalsDepthShare,
        ),
      );
    }

    const fragranceBonus =
      profile.fragrancePreference === 'REQUIRE_FRAGRANCE_FREE'
        ? COARSE_WEIGHTS.fragranceFreeRequired
        : profile.fragrancePreference === 'PREFER_FRAGRANCE_FREE'
          ? COARSE_WEIGHTS.fragranceFreePreferred
          : COARSE_WEIGHTS.fragranceFreeBonus;
    terms.push(
      Prisma.sql`CASE WHEN COALESCE(t."hasFragrance", NOT p."isFragranceFree") THEN 0 ELSE ${fragranceBonus} END`,
    );

    const multiplier = SENSITIVITY_MULTIPLIER[profile.sensitivity];
    if (multiplier > 0 && profile.sensitivity !== 'LOW') {
      terms.push(Prisma.sql`CASE
        WHEN COALESCE(t."calmingLoad" - t."irritantLoad", 0) > ${COARSE_WEIGHTS.sensitivityFriendlyThreshold}
        THEN LEAST(${COARSE_WEIGHTS.sensitivityFriendlyMax}, (t."calmingLoad" - t."irritantLoad") * ${COARSE_WEIGHTS.sensitivityFriendlyPerNet}) * ${multiplier}
        ELSE 0 END`);
    }

    const ceiling = BUDGET_CEILING[profile.budget];
    if (ceiling !== null) {
      terms.push(
        Prisma.sql`CASE WHEN p."lowestPrice" IS NOT NULL AND p."lowestPrice" <= ${ceiling} THEN ${COARSE_WEIGHTS.budgetFit} ELSE 0 END`,
      );
    }

    if (profile.veganPreference) {
      terms.push(Prisma.sql`CASE WHEN p."isVegan" THEN ${COARSE_WEIGHTS.vegan} ELSE 0 END`);
    }
    if (profile.crueltyFreePreference) {
      terms.push(
        Prisma.sql`CASE WHEN p."isCrueltyFree" THEN ${COARSE_WEIGHTS.crueltyFree} ELSE 0 END`,
      );
    }
    if (profile.preferredBrandIds.length) {
      terms.push(
        Prisma.sql`CASE WHEN p."brandId" = ANY(${profile.preferredBrandIds}::text[]) THEN ${COARSE_WEIGHTS.brandPreferred} ELSE 0 END`,
      );
    }

    terms.push(
      Prisma.sql`GREATEST(0, (p."ingredientScore" - 50) * ${COARSE_WEIGHTS.ingredientQualityPerPoint})`,
    );

    if (shelf) {
      terms.push(
        shelf.categoryIds.length
          ? Prisma.sql`CASE WHEN p."categoryId" = ANY(${shelf.categoryIds}::text[]) THEN 0 ELSE ${COARSE_WEIGHTS.shelfGap} END`
          : Prisma.sql`${COARSE_WEIGHTS.shelfGap}`,
      );
    }

    return Prisma.join(terms, ' + ');
  }

  private coverageTerm(
    column: Prisma.Sql,
    wanted: string[],
    weight: number,
    coverageShare: number,
    depthShare: number,
  ): Prisma.Sql {
    const matched = Prisma.sql`(SELECT count(*) FROM unnest(COALESCE(${column}, ARRAY[]::text[])) AS slug WHERE slug = ANY(${wanted}::text[]))`;
    return Prisma.sql`CASE WHEN ${matched} > 0
      THEN ${weight} * ((${matched})::float8 / ${wanted.length} * ${coverageShare} + ${depthShare})
      ELSE 0 END`;
  }
}
