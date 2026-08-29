import { Injectable } from '@nestjs/common';
import type { ImportRun, ImportRunStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

export interface ImportCounters {
  created: number;
  updated: number;
  skipped: number;
  queued: number;
  failed: number;
}

const MAX_STORED_ERRORS = 200;

export const emptyCounters = (): ImportCounters => ({
  created: 0,
  updated: 0,
  skipped: 0,
  queued: 0,
  failed: 0,
});

@Injectable()
export class ImportRunService {
  constructor(private readonly prisma: PrismaService) {}

  start(sourceId: string, params: Prisma.InputJsonValue, isDryRun: boolean): Promise<ImportRun> {
    return this.prisma.importRun.create({ data: { sourceId, params, isDryRun } });
  }

  /** The most recent run for this source that did not finish cleanly, if any. */
  findResumable(sourceId: string): Promise<ImportRun | null> {
    return this.prisma.importRun.findFirst({
      where: { sourceId, status: { in: ['FAILED', 'INTERRUPTED'] }, isDryRun: false },
      orderBy: { startedAt: 'desc' },
    });
  }

  async checkpoint(
    runId: string,
    cursor: Prisma.InputJsonValue,
    counters: ImportCounters,
    errors: string[],
  ): Promise<void> {
    await this.prisma.importRun.update({
      where: { id: runId },
      data: { cursor, ...counters, errors: errors.slice(-MAX_STORED_ERRORS) },
    });
  }

  async finish(
    runId: string,
    status: Extract<ImportRunStatus, 'COMPLETED' | 'FAILED' | 'INTERRUPTED'>,
    counters: ImportCounters,
    errors: string[],
  ): Promise<void> {
    await this.prisma.importRun.update({
      where: { id: runId },
      data: {
        status,
        finishedAt: new Date(),
        ...counters,
        errors: errors.slice(-MAX_STORED_ERRORS),
      },
    });
  }

  list(take = 30): Promise<Array<ImportRun & { source: { code: string; name: string } }>> {
    return this.prisma.importRun.findMany({
      orderBy: { startedAt: 'desc' },
      take,
      include: { source: { select: { code: true, name: true } } },
    });
  }
}
