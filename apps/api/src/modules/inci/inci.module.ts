import { Module } from '@nestjs/common';
import { InciImportService } from './inci-import.service';
import { InciMatcherService } from './inci-matcher.service';
import { UnmatchedTokenService } from './unmatched-token.service';

@Module({
  providers: [InciMatcherService, InciImportService, UnmatchedTokenService],
  exports: [InciMatcherService, InciImportService, UnmatchedTokenService],
})
export class InciModule {}
