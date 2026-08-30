/**
 * Imports the CosIng glossary (INCI names, CAS/EC, functions) and Annexes II–VI.
 *
 *   npm run import:cosing -w @kosvia/api -- [--dry-run] [--resume] [--skip-annexes] [--max-pages=N] [--skip-rematch]
 *
 * After the dictionary is in place, label rows that could not be matched
 * before are re-run against it and hidden imported products are re-evaluated.
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { CosIngImportService } from '../src/modules/import/cosing/cosing-import.service';
import { OpenBeautyFactsImportService } from '../src/modules/import/obf/obf-import.service';
import { UnmatchedTokenService } from '../src/modules/inci/unmatched-token.service';

const readArguments = () => {
  const flags = new Map<string, string>();
  for (const argument of process.argv.slice(2)) {
    const [key, value] = argument.replace(/^--/, '').split('=');
    flags.set(key, value ?? 'true');
  }
  const maxPages = flags.get('max-pages');
  return {
    isDryRun: flags.get('dry-run') === 'true',
    resume: flags.get('resume') === 'true',
    skipAnnexes: flags.get('skip-annexes') === 'true',
    skipRematch: flags.get('skip-rematch') === 'true',
    maxPages: maxPages ? Number(maxPages) : undefined,
  };
};

const main = async () => {
  const options = readArguments();
  const context = await NestFactory.createApplicationContext(AppModule, {
    logger: ['warn', 'error'],
  });
  try {
    const importer = context.get(CosIngImportService);
    console.log(
      `${options.isDryRun ? 'DRY RUN — ' : ''}CosIng import${options.resume ? ' (resume)' : ''}${
        options.skipAnnexes ? ' without annexes' : ''
      }`,
    );
    const summary = await importer.run({
      ...options,
      onProgress: (progress) =>
        console.log(
          `${progress.phase} ${progress.page}/${progress.totalPages} · processed ${progress.processed} · ` +
            `created ${progress.counters.created} · updated ${progress.counters.updated} · ` +
            `skipped ${progress.counters.skipped} · failed ${progress.counters.failed}`,
        ),
    });
    console.log(`run ${summary.runId} ${summary.status}`);
    console.log(`skip reasons: ${JSON.stringify(summary.skipReasons)}`);
    if (summary.errors.length) {
      console.warn(`${summary.errors.length} errors, last: ${summary.errors.at(-1)}`);
    }
    process.exitCode = summary.status === 'COMPLETED' ? 0 : 1;

    if (summary.status !== 'COMPLETED' || options.isDryRun || options.skipRematch) {
      return;
    }
    const rematch = await context.get(UnmatchedTokenService).rematchPending();
    console.log(
      `rematch: ${rematch.resolvedTokens} tokens resolved · ${rematch.rematchedRows} label rows · ${rematch.affectedProducts} products`,
    );
    const republished = await context.get(OpenBeautyFactsImportService).republishHidden();
    console.log(`republished ${republished} imported products`);
  } finally {
    await context.close();
  }
};

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
