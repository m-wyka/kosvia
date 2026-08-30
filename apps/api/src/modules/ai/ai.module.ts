import { Module } from '@nestjs/common';
import { ScoringModule } from '../scoring/scoring.module';
import { ProfileModule } from '../profile/profile.module';
import { ProductsModule } from '../products/products.module';
import { RecommendationModule } from '../recommendation/recommendation.module';
import { AIController } from './ai.controller';
import { AIService } from './ai.service';
import { BeautyAdvisorService } from './beauty-advisor.service';
import { IngredientDescriberService } from './ingredient-describer.service';
import { aiProviderFactory } from './providers/ai-provider.factory';

@Module({
  imports: [ScoringModule, ProfileModule, ProductsModule, RecommendationModule],
  controllers: [AIController],
  providers: [AIService, BeautyAdvisorService, IngredientDescriberService, aiProviderFactory],
  exports: [AIService, BeautyAdvisorService, IngredientDescriberService],
})
export class AIModule {}
