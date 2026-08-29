import { Module } from '@nestjs/common';
import { InciModule } from '../inci/inci.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  imports: [InciModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
