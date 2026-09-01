import { Module } from '@nestjs/common';
import { ScoringModule } from '../scoring/scoring.module';
import { ProfileModule } from '../profile/profile.module';
import { ProductsModule } from '../products/products.module';
import { RecommendationController } from './recommendation.controller';
import { RecommendationService } from './recommendation.service';
import { AlternativeProductService } from './alternative-product.service';
import { DupeFinderService } from './dupe-finder.service';
import { ComparisonService } from './comparison.service';
import { RoutineAnalysisService } from './routine-analysis.service';
import { RoutinePlanService } from './routine-plan.service';

@Module({
  imports: [ScoringModule, ProfileModule, ProductsModule],
  controllers: [RecommendationController],
  providers: [
    RecommendationService,
    AlternativeProductService,
    DupeFinderService,
    ComparisonService,
    RoutineAnalysisService,
    RoutinePlanService,
  ],
  exports: [
    RecommendationService,
    AlternativeProductService,
    ComparisonService,
    RoutineAnalysisService,
    RoutinePlanService,
  ],
})
export class RecommendationModule {}
