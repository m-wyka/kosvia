import type { IngredientScoreBreakdownDto, LocalisedText } from '@kosvia/shared';
import { clamp, positionWeight, type ScorableProductIngredient } from './types';

/**
 * Deterministic ingredient quality score (0-100).
 *
 * This is NOT a safety rating and never labels an ingredient "toxic" or "bad".
 * It answers a narrower question: how much of this formula is doing useful work
 * for the skin, weighted by how far up the INCI list each ingredient sits?
 *
 * Positive signals  — actives, humectants, emollients, barrier lipids,
 *                     antioxidants, soothing agents, UV filters.
 * Negative signals  — fragrance high in the list, ingredients widely reported
 *                     as poorly tolerated, high comedogenic ratings up front.
 */

const SUPPORTIVE_TAGS = new Set([
  'humectant',
  'emollient',
  'occlusive',
  'antioxidant',
  'soothing',
  'barrier-support',
  'peptide',
  'brightening',
  'sebum-regulating',
  'uv-filter',
  'retinoid',
  'exfoliant',
]);

/** Structural ingredients — necessary, but not a reason to score higher. */
const NEUTRAL_TAGS = new Set([
  'solvent',
  'thickener',
  'emulsifier',
  'preservative',
  'ph-adjuster',
  'surfactant',
  'colorant',
]);

export function computeIngredientScore(
  ingredients: ScorableProductIngredient[],
): IngredientScoreBreakdownDto {
  if (!ingredients.length) {
    return {
      score: 50,
      activeCount: 0,
      supportiveCount: 0,
      potentialIrritantCount: 0,
      notes: [
        { code: 'ingredient-no-list', text: 'No ingredient list on file for this product yet.' },
      ],
    };
  }

  const sorted = [...ingredients].sort((a, b) => a.position - b.position);

  let benefit = 0;
  let penalty = 0;
  let activeCount = 0;
  let supportiveCount = 0;
  let potentialIrritantCount = 0;
  const notes: LocalisedText[] = [];

  let fragranceHigh = false;
  let comedogenicHigh = false;

  for (const entry of sorted) {
    const { ingredient, position } = entry;
    const weight = positionWeight(position);
    const tags = new Set(ingredient.tags);

    if (ingredient.isActiveIngredient) {
      activeCount += 1;
      // Actives count for more when they are high in the list.
      benefit += 9 * weight;
    }

    let supportive = false;
    for (const tag of tags) {
      if (SUPPORTIVE_TAGS.has(tag)) supportive = true;
    }
    if (supportive) {
      supportiveCount += 1;
      benefit += 4 * weight;
    } else if (![...tags].some((tag) => NEUTRAL_TAGS.has(tag)) && tags.size > 0) {
      benefit += 1 * weight;
    }

    if (tags.has('fragrance')) {
      potentialIrritantCount += 1;
      penalty += 10 * weight;
      if (position <= 8) fragranceHigh = true;
    } else if (ingredient.sensitivityImpact <= -1) {
      potentialIrritantCount += 1;
      penalty += 5 * weight;
    }

    if ((ingredient.comedogenicRating ?? 0) >= 4 && position <= 8) {
      penalty += 6 * weight;
      comedogenicHigh = true;
    }
  }

  // Normalise against list length so a 30-ingredient formula is not
  // automatically "better" than a well-chosen 8-ingredient one. The 4.6
  // constant is calibrated against the seed catalogue so scores spread across
  // roughly 40-90 instead of bunching at the top of the scale.
  const listWeight = Math.sqrt(sorted.length);
  const score = clamp(Math.round(50 + (benefit - penalty) * (4.6 / listWeight)), 0, 100);

  if (activeCount === 0) {
    notes.push({
      code: 'ingredient-no-actives',
      text: 'No headline actives — this is a supporting-role product rather than a treatment.',
    });
  } else if (activeCount >= 3) {
    notes.push({
      code: 'ingredient-many-actives',
      text: `${activeCount} active ingredients, so introduce it alongside other treatments slowly.`,
      params: { count: activeCount },
    });
  }
  if (fragranceHigh) {
    notes.push({
      code: 'ingredient-fragrance-high',
      text: 'Fragrance appears high in the list, which is worth knowing if your skin reacts easily.',
    });
  }
  if (comedogenicHigh) {
    notes.push({
      code: 'ingredient-comedogenic',
      text: 'Contains an ingredient often reported as congesting, high in the list.',
    });
  }
  if (supportiveCount >= 6) {
    notes.push({
      code: 'ingredient-supportive',
      text: 'A large share of the formula is hydrating, softening or barrier-supporting.',
    });
  }

  return { score, activeCount, supportiveCount, potentialIrritantCount, notes };
}
