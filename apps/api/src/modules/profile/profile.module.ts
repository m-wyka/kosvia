import { Module } from '@nestjs/common';
import { ProfileController } from './profile.controller';
import { ProfileService } from './profile.service';
import { ViewerContextService } from './viewer-context.service';

@Module({
  controllers: [ProfileController],
  providers: [ProfileService, ViewerContextService],
  exports: [ProfileService, ViewerContextService],
})
export class ProfileModule {}
