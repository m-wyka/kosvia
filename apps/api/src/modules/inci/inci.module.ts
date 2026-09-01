import { Module } from '@nestjs/common';
import { ScoringModule } from '../scoring/scoring.module';
import { InciImportService } from './inci-import.service';
import { InciMatcherService } from './inci-matcher.service';
import { UnmatchedTokenService } from './unmatched-token.service';
import { FormulaRevisionService } from './formula-revision.service';

@Module({
  imports: [ScoringModule],
  providers: [InciMatcherService, InciImportService, UnmatchedTokenService, FormulaRevisionService],
  exports: [InciMatcherService, InciImportService, UnmatchedTokenService, FormulaRevisionService],
})
export class InciModule {}
