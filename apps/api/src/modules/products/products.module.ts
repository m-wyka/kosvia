import { Module } from '@nestjs/common';
import { ScoringModule } from '../scoring/scoring.module';
import { ProfileModule } from '../profile/profile.module';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';

@Module({
  imports: [ScoringModule, ProfileModule],
  controllers: [ProductsController],
  providers: [ProductsService],
  exports: [ProductsService],
})
export class ProductsModule {}
