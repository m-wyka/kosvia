import { Module } from '@nestjs/common';
import { ScoringModule } from '../scoring/scoring.module';
import { ProfileModule } from '../profile/profile.module';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { PostgresSearchProvider } from './search/postgres-search.provider';
import { SEARCH_PROVIDER } from './search/search-provider';

@Module({
  imports: [ScoringModule, ProfileModule],
  controllers: [ProductsController],
  providers: [ProductsService, { provide: SEARCH_PROVIDER, useClass: PostgresSearchProvider }],
  exports: [ProductsService],
})
export class ProductsModule {}
