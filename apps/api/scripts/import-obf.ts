/**
 * Batch import from Open Beauty Facts.
 *
 *   npm run import:obf -w @kosvia/api -- --category=en:facial-creams --limit=200 [--dry-run] [--resume]
 *
 * Boots the Nest application context without HTTP, so the run uses the same
 * INCI pipeline, queue and provenance rules as the admin UI.
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { OpenBeautyFactsImportService } from '../src/modules/import/obf/obf-import.service';

const DEFAULT_CATEGORY = 'en:facial-creams';
const DEFAULT_COUNTRY = 'en:poland';
const DEFAULT_LIMIT = 200;

const readArguments = () => {
  const flags = new Map<string, string>();
  for (const argument of process.argv.slice(2)) {
    const [key, value] = argument.replace(/^--/, '').split('=');
    flags.set(key, value ?? 'true');
  }
  return {
    categoryTag: flags.get('category') ?? DEFAULT_CATEGORY,
    countryTag: flags.get('country') ?? DEFAULT_COUNTRY,
    limit: Number(flags.get('limit') ?? DEFAULT_LIMIT),
    isDryRun: flags.get('dry-run') === 'true',
    resume: flags.get('resume') === 'true',
  };
};

const main = async () => {
  const options = readArguments();
  const context = await NestFactory.createApplicationContext(AppModule, {
    logger: ['warn', 'error'],
  });
  try {
    const importer = context.get(OpenBeautyFactsImportService);
    console.log(
      `${options.isDryRun ? 'DRY RUN — ' : ''}category=${options.categoryTag} country=${options.countryTag} limit=${options.limit}${options.resume ? ' (resume)' : ''}`,
    );
    const summary = await importer.run({
      ...options,
      onProgress: (progress) =>
        console.log(
          `page ${progress.page}/${progress.totalPages} · processed ${progress.processed} · ` +
            `created ${progress.counters.created} · updated ${progress.counters.updated} · ` +
            `skipped ${progress.counters.skipped} · queued ${progress.counters.queued} · failed ${progress.counters.failed}`,
        ),
    });
    console.log(`run ${summary.runId} ${summary.status}`);
    console.log(`skip reasons: ${JSON.stringify(summary.skipReasons)}`);
    if (summary.errors.length) {
      console.warn(`${summary.errors.length} errors, last: ${summary.errors.at(-1)}`);
    }
    process.exitCode = summary.status === 'COMPLETED' ? 0 : 1;
  } finally {
    await context.close();
  }
};

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
