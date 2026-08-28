import { Module } from '@nestjs/common';
import { IngredientScoreService } from './ingredient-score.service';
import { PersonalMatchService } from './personal-match.service';

@Module({
  providers: [PersonalMatchService, IngredientScoreService],
  exports: [PersonalMatchService, IngredientScoreService],
})
export class ScoringModule {}
