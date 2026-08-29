import { Module } from '@nestjs/common';
import { InciModule } from '../inci/inci.module';
import { ImportRunService } from './import-run.service';
import { OpenBeautyFactsClient } from './obf/obf-client';
import { OpenBeautyFactsImportService } from './obf/obf-import.service';

@Module({
  imports: [InciModule],
  providers: [ImportRunService, OpenBeautyFactsClient, OpenBeautyFactsImportService],
  exports: [ImportRunService, OpenBeautyFactsImportService],
})
export class ImportModule {}
