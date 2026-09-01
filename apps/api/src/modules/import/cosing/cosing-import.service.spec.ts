import { CosIngImportService } from './cosing-import.service';
import type { CosIngAnnexEntry } from './cosing-types';
import type { PrismaService } from '../../../common/prisma/prisma.service';
import type { CosIngClient } from './cosing-client';
import type { ImportRunService } from '../import-run.service';

const LARGE_DICTIONARY = 1000;

interface IngredientState {
  id: string;
  normalizedName: string;
  isProhibited: boolean;
  isRestricted: boolean;
  cosIngAnnex: string | null;
}

const annexEntry = (overrides: Partial<CosIngAnnexEntry> = {}): CosIngAnnexEntry => ({
  annex: 'II',
  referenceNumber: '1',
  names: ['Hydroquinone'],
  maximumConcentration: null,
  conditions: null,
  isFragranceAllergen: false,
  ...overrides,
});

const buildService = (ingredients: IngredientState[], dictionarySize = LARGE_DICTIONARY) => {
  const createdChanges: Array<Record<string, unknown>> = [];
  const prisma = {
    ingredient: {
      findMany: jest.fn(({ where }: { where: Record<string, unknown> }) => {
        if ('normalizedName' in where) {
          const wanted = (where.normalizedName as { in: string[] }).in;
          return Promise.resolve(ingredients.filter((row) => wanted.includes(row.normalizedName)));
        }
        const excluded = (where.id as { notIn: string[] }).notIn;
        return Promise.resolve(
          ingredients.filter(
            (row) => (row.isProhibited || row.isRestricted) && !excluded.includes(row.id),
          ),
        );
      }),
      updateMany: jest.fn(() => Promise.resolve({ count: 0 })),
      update: jest.fn(() => Promise.resolve({})),
      count: jest.fn(() => Promise.resolve(dictionarySize)),
    },
    regulatoryChange: {
      createMany: jest.fn(({ data }: { data: Array<Record<string, unknown>> }) => {
        createdChanges.push(...data);
        return Promise.resolve({ count: data.length });
      }),
    },
  };
  const service = new CosIngImportService(
    prisma as unknown as PrismaService,
    {} as CosIngClient,
    {} as ImportRunService,
  );
  const applyAnnexes = (
    entries: CosIngAnnexEntry[],
    isDryRun = false,
  ): Promise<{ flagged: number; unmatchedNames: string[] }> =>
    (
      service as unknown as {
        applyAnnexes: (
          e: CosIngAnnexEntry[],
          dry: boolean,
          runId: string,
        ) => Promise<{ flagged: number; unmatchedNames: string[] }>;
      }
    ).applyAnnexes(entries, isDryRun, 'run-1');
  return { applyAnnexes, createdChanges, prisma };
};

describe('CosIngImportService regulatory change detection', () => {
  it('records BECAME_PROHIBITED when an unflagged ingredient lands in Annex II', async () => {
    const { applyAnnexes, createdChanges } = buildService([
      {
        id: 'ing-1',
        normalizedName: 'hydroquinone',
        isProhibited: false,
        isRestricted: false,
        cosIngAnnex: null,
      },
    ]);
    await applyAnnexes([annexEntry()]);
    expect(createdChanges).toEqual([
      expect.objectContaining({
        ingredientId: 'ing-1',
        kind: 'BECAME_PROHIBITED',
        previousAnnex: null,
        newAnnex: 'II',
        importRunId: 'run-1',
      }),
    ]);
  });

  it('records BECAME_RESTRICTED for a new Annex III listing', async () => {
    const { applyAnnexes, createdChanges } = buildService([
      {
        id: 'ing-2',
        normalizedName: 'resorcinol',
        isProhibited: false,
        isRestricted: false,
        cosIngAnnex: null,
      },
    ]);
    await applyAnnexes([annexEntry({ annex: 'III', names: ['Resorcinol'] })]);
    expect(createdChanges).toEqual([
      expect.objectContaining({
        ingredientId: 'ing-2',
        kind: 'BECAME_RESTRICTED',
        newAnnex: 'III',
      }),
    ]);
  });

  it('records a lift when a previously prohibited ingredient leaves the annexes', async () => {
    const { applyAnnexes, createdChanges } = buildService([
      {
        id: 'ing-3',
        normalizedName: 'oldbanned',
        isProhibited: true,
        isRestricted: false,
        cosIngAnnex: 'II',
      },
    ]);
    await applyAnnexes([annexEntry({ names: ['Something Else'] })]);
    expect(createdChanges).toEqual([
      expect.objectContaining({
        ingredientId: 'ing-3',
        kind: 'PROHIBITION_LIFTED',
        previousAnnex: 'II',
        newAnnex: null,
      }),
    ]);
  });

  it('stays silent when the annex state has not changed', async () => {
    const { applyAnnexes, createdChanges } = buildService([
      {
        id: 'ing-4',
        normalizedName: 'hydroquinone',
        isProhibited: true,
        isRestricted: false,
        cosIngAnnex: 'II',
      },
    ]);
    await applyAnnexes([annexEntry()]);
    expect(createdChanges).toHaveLength(0);
  });

  it('skips event writing when more than 5% of the dictionary flips', async () => {
    const { applyAnnexes, createdChanges, prisma } = buildService(
      [
        {
          id: 'ing-5',
          normalizedName: 'hydroquinone',
          isProhibited: false,
          isRestricted: false,
          cosIngAnnex: null,
        },
      ],
      10,
    );
    await applyAnnexes([annexEntry()]);
    expect(createdChanges).toHaveLength(0);
    expect(prisma.regulatoryChange.createMany).not.toHaveBeenCalled();
  });

  it('writes nothing in a dry run', async () => {
    const { applyAnnexes, createdChanges, prisma } = buildService([
      {
        id: 'ing-6',
        normalizedName: 'hydroquinone',
        isProhibited: false,
        isRestricted: false,
        cosIngAnnex: null,
      },
    ]);
    await applyAnnexes([annexEntry()], true);
    expect(createdChanges).toHaveLength(0);
    expect(prisma.ingredient.updateMany).not.toHaveBeenCalled();
  });
});
