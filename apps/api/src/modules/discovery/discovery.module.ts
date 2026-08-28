import { Module } from '@nestjs/common';
import { ProfileModule } from '../profile/profile.module';
import { RecommendationModule } from '../recommendation/recommendation.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [ProfileModule, RecommendationModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DiscoveryModule {}
