import { Module } from '@nestjs/common';
import { ScoringModule } from '../scoring/scoring.module';
import { ProfileModule } from '../profile/profile.module';
import { ProductsModule } from '../products/products.module';
import { RecommendationController } from './recommendation.controller';
import { RecommendationService } from './recommendation.service';
import { AlternativeProductService } from './alternative-product.service';
import { ComparisonService } from './comparison.service';
import { RoutineAnalysisService } from './routine-analysis.service';

@Module({
  imports: [ScoringModule, ProfileModule, ProductsModule],
  controllers: [RecommendationController],
  providers: [
    RecommendationService,
    AlternativeProductService,
    ComparisonService,
    RoutineAnalysisService,
  ],
  exports: [
    RecommendationService,
    AlternativeProductService,
    ComparisonService,
    RoutineAnalysisService,
  ],
})
export class RecommendationModule {}
