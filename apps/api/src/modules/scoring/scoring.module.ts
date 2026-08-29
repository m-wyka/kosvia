import { Module } from '@nestjs/common';
import { CoarseMatchService } from './coarse-match.service';
import { IngredientScoreService } from './ingredient-score.service';
import { PersonalMatchService } from './personal-match.service';
import { ProductTraitsService } from './product-traits.service';
import { MatchWeightService } from './match-weight.service';

@Module({
  providers: [
    MatchWeightService,
    PersonalMatchService,
    IngredientScoreService,
    ProductTraitsService,
    CoarseMatchService,
  ],
  exports: [
    MatchWeightService,
    PersonalMatchService,
    IngredientScoreService,
    ProductTraitsService,
    CoarseMatchService,
  ],
})
export class ScoringModule {}
