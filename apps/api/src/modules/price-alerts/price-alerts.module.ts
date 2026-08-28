import { Module } from '@nestjs/common';
import { ScoringModule } from '../scoring/scoring.module';
import { ProfileModule } from '../profile/profile.module';
import { PriceAlertsController } from './price-alerts.controller';
import { PriceAlertsService } from './price-alerts.service';

@Module({
  imports: [ScoringModule, ProfileModule],
  controllers: [PriceAlertsController],
  providers: [PriceAlertsService],
  exports: [PriceAlertsService],
})
export class PriceAlertsModule {}
