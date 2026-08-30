import { Module } from '@nestjs/common';
import { InciModule } from '../inci/inci.module';
import { ImportRunService } from './import-run.service';
import { CosIngClient } from './cosing/cosing-client';
import { CosIngImportService } from './cosing/cosing-import.service';
import { OpenBeautyFactsClient } from './obf/obf-client';
import { OpenBeautyFactsImportService } from './obf/obf-import.service';

@Module({
  imports: [InciModule],
  providers: [
    ImportRunService,
    OpenBeautyFactsClient,
    OpenBeautyFactsImportService,
    CosIngClient,
    CosIngImportService,
  ],
  exports: [ImportRunService, OpenBeautyFactsImportService, CosIngImportService],
})
export class ImportModule {}
