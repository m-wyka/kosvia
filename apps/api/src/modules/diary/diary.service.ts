import { BadRequestException, Injectable } from '@nestjs/common';
import type { SkinDiaryEntry } from '@prisma/client';
import type {
  SkinDiaryEntryDto,
  SkinDiaryFlag,
  SkinDiaryMonthDto,
  SkinDiaryStatsDto,
} from '@kosvia/shared';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { EntitlementService } from '../subscription/entitlement.service';
import type { UpsertSkinDiaryEntryDto } from './dto/diary.dto';

const DATE_PATTERN = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const MAX_BACKDATE_DAYS = 62;
const FUTURE_TOLERANCE_DAYS = 1;
const DAY_MS = 24 * 60 * 60 * 1000;

const FLAG_COLUMNS: Record<SkinDiaryFlag, keyof SkinDiaryEntry> = {
  breakouts: 'hasBreakouts',
  dryness: 'hasDryness',
  irritation: 'hasIrritation',
  redness: 'hasRedness',
};

const emptyFlagCounts = (): Record<SkinDiaryFlag, number> => ({
  breakouts: 0,
  dryness: 0,
  irritation: 0,
  redness: 0,
});

/**
 * Dates are opaque YYYY-MM-DD calendar days in the user's local time, stored
 * at UTC midnight and never converted — otherwise an entry saved after 23:00
 * in Poland would land on the wrong day.
 */
const toUtcDate = (date: string): Date => new Date(`${date}T00:00:00Z`);

@Injectable()
export class DiaryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlements: EntitlementService,
  ) {}

  async month(user: AuthenticatedUser, month: string): Promise<SkinDiaryMonthDto> {
    const userId = user.id;
    const monthStart = toUtcDate(`${month}-01`);
    const nextMonthStart = new Date(
      Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 1),
    );
    const previousMonthStart = new Date(
      Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() - 1, 1),
    );

    const plan = await this.entitlements.currentPlan(user);
    const historyDays = this.entitlements.limitsFor(plan).diaryHistoryDays;
    const historyFloor = historyDays === null ? null : new Date(Date.now() - historyDays * DAY_MS);

    const [entries, previousEntries] = await Promise.all([
      this.prisma.skinDiaryEntry.findMany({
        where: {
          profile: { userId },
          date: {
            gte: historyFloor && historyFloor > monthStart ? historyFloor : monthStart,
            lt: nextMonthStart,
          },
        },
        orderBy: { date: 'asc' },
      }),
      historyFloor === null
        ? this.prisma.skinDiaryEntry.findMany({
            where: { profile: { userId }, date: { gte: previousMonthStart, lt: monthStart } },
          })
        : Promise.resolve([]),
    ]);

    return {
      month,
      entries: entries.map((entry) => this.toDto(entry)),
      stats: this.stats(entries, previousEntries),
      historyLimited: historyFloor !== null,
    };
  }

  async upsert(
    userId: string,
    date: string,
    dto: UpsertSkinDiaryEntryDto,
  ): Promise<SkinDiaryEntryDto> {
    this.assertWritableDate(date);
    const profile = await this.prisma.beautyProfile.upsert({
      where: { userId },
      update: {},
      create: { userId },
      select: { id: true },
    });
    const flags = dto.flags ?? [];
    const data = {
      overall: dto.overall,
      hasBreakouts: flags.includes('breakouts'),
      hasDryness: flags.includes('dryness'),
      hasIrritation: flags.includes('irritation'),
      hasRedness: flags.includes('redness'),
      note: dto.note?.trim() || null,
    };
    const entry = await this.prisma.skinDiaryEntry.upsert({
      where: { profileId_date: { profileId: profile.id, date: toUtcDate(date) } },
      update: data,
      create: { ...data, profileId: profile.id, date: toUtcDate(date) },
    });
    return this.toDto(entry);
  }

  async remove(userId: string, date: string): Promise<void> {
    this.assertValidDate(date);
    await this.prisma.skinDiaryEntry.deleteMany({
      where: { profile: { userId }, date: toUtcDate(date) },
    });
  }

  private toDto(entry: SkinDiaryEntry): SkinDiaryEntryDto {
    const flags = (Object.keys(FLAG_COLUMNS) as SkinDiaryFlag[]).filter(
      (flag) => entry[FLAG_COLUMNS[flag]] === true,
    );
    return {
      date: entry.date.toISOString().slice(0, 10),
      overall: entry.overall,
      flags,
      note: entry.note,
    };
  }

  private stats(entries: SkinDiaryEntry[], previousEntries: SkinDiaryEntry[]): SkinDiaryStatsDto {
    const flagCounts = this.countFlags(entries);
    const averageOverall = entries.length
      ? Math.round((entries.reduce((sum, entry) => sum + entry.overall, 0) / entries.length) * 10) /
        10
      : null;
    return {
      loggedDays: entries.length,
      averageOverall,
      flagCounts,
      previousMonthFlagCounts: this.countFlags(previousEntries),
    };
  }

  private countFlags(entries: SkinDiaryEntry[]): Record<SkinDiaryFlag, number> {
    const counts = emptyFlagCounts();
    for (const entry of entries) {
      for (const flag of Object.keys(FLAG_COLUMNS) as SkinDiaryFlag[]) {
        if (entry[FLAG_COLUMNS[flag]] === true) {
          counts[flag] += 1;
        }
      }
    }
    return counts;
  }

  private assertValidDate(date: string): void {
    if (!DATE_PATTERN.test(date)) {
      throw new BadRequestException('Dates look like 2026-09-01.');
    }
  }

  private assertWritableDate(date: string): void {
    this.assertValidDate(date);
    const entryTime = toUtcDate(date).getTime();
    const now = Date.now();
    if (entryTime > now + FUTURE_TOLERANCE_DAYS * DAY_MS) {
      throw new BadRequestException('The diary only takes days that already happened.');
    }
    if (entryTime < now - MAX_BACKDATE_DAYS * DAY_MS) {
      throw new BadRequestException('That day is too far back to log now.');
    }
  }
}
