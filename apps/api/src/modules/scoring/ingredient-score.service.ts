import { Injectable } from '@nestjs/common';
import type { IngredientScoreBreakdownDto } from '@kosvia/shared';
import { computeIngredientScore } from './ingredient-score';
import type { ScorableProductIngredient } from './types';

/** Thin injectable wrapper so controllers/services depend on DI, not a module import. */
@Injectable()
export class IngredientScoreService {
  compute(ingredients: ScorableProductIngredient[]): IngredientScoreBreakdownDto {
    return computeIngredientScore(ingredients);
  }
}
