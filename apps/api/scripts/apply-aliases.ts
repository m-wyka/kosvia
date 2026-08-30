/**
 * Loads hand-curated label aliases (synonyms, translations, typos, trade names)
 * onto their canonical INCI entries, then re-matches pending label tokens.
 *
 *   npm run aliases:apply -w @kosvia/api -- [--from=prisma/seed/data/ingredient-aliases.json]
 *
 * Safe to re-run: an alias that already exists is left alone.
 */
import { readFile } from 'node:fs/promises';
import { NestFactory } from '@nestjs/core';
import type { AliasKind } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { normalizeToken } from '../src/modules/inci/inci-parser';
import { UnmatchedTokenService } from '../src/modules/inci/unmatched-token.service';

type AliasFile = Record<string, Array<{ alias: string; kind: AliasKind }>>;

const DEFAULT_FILE = 'prisma/seed/data/ingredient-aliases.json';

const readArguments = () => {
  const fromFlag = process.argv.find((argument) => argument.startsWith('--from='));
  return { file: fromFlag ? fromFlag.slice('--from='.length) : DEFAULT_FILE };
};

const main = async () => {
  const { file } = readArguments();
  const entries = JSON.parse(await readFile(file, 'utf8')) as AliasFile;
  const context = await NestFactory.createApplicationContext(AppModule, {
    logger: ['warn', 'error'],
  });
  try {
    const prisma = context.get(PrismaService);
    let created = 0;
    const unknownTargets: string[] = [];
    const conflicts: string[] = [];
    for (const [inciName, aliases] of Object.entries(entries)) {
      const target = await prisma.ingredient.findFirst({
        where: { normalizedName: normalizeToken(inciName) },
        select: { id: true },
      });
      if (!target) {
        unknownTargets.push(inciName);
        continue;
      }
      for (const entry of aliases) {
        const alias = normalizeToken(entry.alias);
        const existing = await prisma.ingredientAlias.findUnique({
          where: { alias },
          select: { ingredientId: true },
        });
        if (existing) {
          if (existing.ingredientId !== target.id) {
            conflicts.push(`${entry.alias} → ${inciName}`);
          }
          continue;
        }
        await prisma.ingredientAlias.create({
          data: { ingredientId: target.id, alias, aliasRaw: entry.alias, kind: entry.kind },
        });
        created += 1;
      }
    }
    console.log(`created ${created} aliases`);
    if (unknownTargets.length) {
      console.warn(`not in the dictionary: ${unknownTargets.join(', ')}`);
    }
    if (conflicts.length) {
      console.warn(`already an alias of another ingredient: ${conflicts.join(', ')}`);
    }
    const rematch = await context.get(UnmatchedTokenService).rematchPending();
    console.log(
      `rematch: ${rematch.resolvedTokens} tokens resolved · ${rematch.rematchedRows} label rows · ${rematch.affectedProducts} products`,
    );
  } finally {
    await context.close();
  }
};

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
