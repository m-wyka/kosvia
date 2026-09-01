import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { join } from 'node:path';
import configuration from './common/config/configuration';
import { PrismaModule } from './common/prisma/prisma.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { AuthModule } from './modules/auth/auth.module';
import { ProfileModule } from './modules/profile/profile.module';
import { ProductsModule } from './modules/products/products.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { ScoringModule } from './modules/scoring/scoring.module';
import { RecommendationModule } from './modules/recommendation/recommendation.module';
import { ShelfModule } from './modules/shelf/shelf.module';
import { PriceAlertsModule } from './modules/price-alerts/price-alerts.module';
import { AppReviewsModule } from './modules/app-reviews/app-reviews.module';
import { AIModule } from './modules/ai/ai.module';
import { DiscoveryModule } from './modules/discovery/discovery.module';
import { AdminModule } from './modules/admin/admin.module';
import { AccountModule } from './modules/account/account.module';
import { DiaryModule } from './modules/diary/diary.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      // Read the repo-root .env too, so one file can configure both apps.
      envFilePath: ['.env', join(process.cwd(), '..', '..', '.env')],
    }),
    // A conservative global ceiling; sensitive routes tighten it with @Throttle.
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 300 }]),
    PrismaModule,
    ScoringModule,
    AuthModule,
    ProfileModule,
    CatalogModule,
    ProductsModule,
    RecommendationModule,
    ShelfModule,
    PriceAlertsModule,
    AppReviewsModule,
    AIModule,
    DiscoveryModule,
    AdminModule,
    AccountModule,
    DiaryModule,
  ],
  controllers: [HealthController],
  providers: [
    // Order matters: rate limit first, then authenticate.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
