import { Module } from '@nestjs/common';
import { ScoringModule } from '../scoring/scoring.module';
import { ProfileModule } from '../profile/profile.module';
import { RecommendationModule } from '../recommendation/recommendation.module';
import { ShelfController } from './shelf.controller';
import { ShelfService } from './shelf.service';
import { RegulatoryAlertsService } from './regulatory-alerts.service';

@Module({
  imports: [ScoringModule, ProfileModule, RecommendationModule],
  controllers: [ShelfController],
  providers: [ShelfService, RegulatoryAlertsService],
  exports: [ShelfService, RegulatoryAlertsService],
})
export class ShelfModule {}
