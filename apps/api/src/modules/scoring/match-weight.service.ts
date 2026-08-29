import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  type OnModuleInit,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  DEFAULT_MATCH_WEIGHTS,
  MATCH_WEIGHT_KEYS,
  type MatchWeights,
  type MatchWeightSetDto,
} from '@kosvia/shared';
import { PrismaService } from '../../common/prisma/prisma.service';

const MAX_WEIGHT = 50;

/**
 * Personal Match weights live in the database (03_MODEL_DANYCH.md §9) so they
 * can be tuned without a deploy. The active set is cached in memory — the
 * scorer runs thousands of times per request and must not hit Postgres.
 */
@Injectable()
export class MatchWeightService implements OnModuleInit {
  private readonly logger = new Logger(MatchWeightService.name);
  private active: MatchWeights = DEFAULT_MATCH_WEIGHTS;

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    await this.reload();
  }

  current(): MatchWeights {
    return this.active;
  }

  async reload(): Promise<void> {
    try {
      const row = await this.prisma.matchWeightSet.findFirst({ where: { isActive: true } });
      this.active = row ? parseWeights(row.weights) : DEFAULT_MATCH_WEIGHTS;
      if (row) this.logger.log(`Using Personal Match weight set v${row.version}`);
    } catch (error) {
      this.logger.warn(`Could not load weight sets, using defaults: ${String(error)}`);
      this.active = DEFAULT_MATCH_WEIGHTS;
    }
  }

  async list(): Promise<MatchWeightSetDto[]> {
    const rows = await this.prisma.matchWeightSet.findMany({ orderBy: { version: 'desc' } });
    const sets = rows.map(toDto);
    return rows.length
      ? sets
      : [
          {
            version: 0,
            isActive: true,
            weights: DEFAULT_MATCH_WEIGHTS,
            note: 'Built-in defaults',
            createdAt: new Date(0).toISOString(),
          },
        ];
  }

  async create(
    weights: MatchWeights,
    note: string | null,
    activate: boolean,
  ): Promise<MatchWeightSetDto> {
    const validated = validateWeights(weights);
    const last = await this.prisma.matchWeightSet.findFirst({ orderBy: { version: 'desc' } });
    const created = await this.prisma.$transaction(async (tx) => {
      if (activate) {
        await tx.matchWeightSet.updateMany({
          where: { isActive: true },
          data: { isActive: false },
        });
      }
      return tx.matchWeightSet.create({
        data: {
          version: (last?.version ?? 0) + 1,
          isActive: activate,
          weights: validated as unknown as Prisma.InputJsonValue,
          note,
        },
      });
    });
    if (activate) await this.reload();
    return toDto(created);
  }

  async activate(version: number): Promise<MatchWeightSetDto> {
    const target = await this.prisma.matchWeightSet.findUnique({ where: { version } });
    if (!target) throw new NotFoundException(`Weight set v${version} does not exist.`);
    await this.prisma.$transaction([
      this.prisma.matchWeightSet.updateMany({
        where: { isActive: true },
        data: { isActive: false },
      }),
      this.prisma.matchWeightSet.update({ where: { version }, data: { isActive: true } }),
    ]);
    await this.reload();
    return toDto({ ...target, isActive: true });
  }
}

export const validateWeights = (input: unknown): MatchWeights => {
  if (!input || typeof input !== 'object') {
    throw new BadRequestException('Weights must be an object.');
  }
  const record = input as Record<string, unknown>;
  const weights = {} as MatchWeights;
  for (const key of MATCH_WEIGHT_KEYS) {
    const value = record[key];
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > MAX_WEIGHT) {
      throw new BadRequestException(
        `Weight "${key}" must be a number between 0 and ${MAX_WEIGHT}.`,
      );
    }
    weights[key] = value;
  }
  return weights;
};

const parseWeights = (json: Prisma.JsonValue): MatchWeights => {
  try {
    return validateWeights(json);
  } catch {
    return DEFAULT_MATCH_WEIGHTS;
  }
};

const toDto = (row: {
  version: number;
  isActive: boolean;
  weights: Prisma.JsonValue;
  note: string | null;
  createdAt: Date;
}): MatchWeightSetDto => ({
  version: row.version,
  isActive: row.isActive,
  weights: parseWeights(row.weights),
  note: row.note,
  createdAt: row.createdAt.toISOString(),
});
