import { Module } from '@nestjs/common';
import { InciModule } from '../inci/inci.module';
import { ImportModule } from '../import/import.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  imports: [InciModule, ImportModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
