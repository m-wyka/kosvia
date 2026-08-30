/**
 * Writes plain-language entries (English and Polish) for dictionary ingredients
 * missing either language; hand-written English entries are kept and translated.
 *
 *   npm run ingredients:describe -w @kosvia/api -- [--limit=200] [--all] [--dry-run]
 *   npm run ingredients:describe -w @kosvia/api -- --from=path/to/prose.json
 *
 * By default only ingredients that appear on a product label are described,
 * most-used first, so the model is paid for entries someone will read.
 * Requires AI_PROVIDER=anthropic; the offline provider declines every entry.
 *
 * `--from` applies prose written elsewhere (see IngredientProseFile) and needs
 * no provider at all.
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { IngredientDescriberService } from '../src/modules/ai/ingredient-describer.service';

const DEFAULT_LIMIT = 200;

const readArguments = () => {
  const flags = new Map<string, string>();
  for (const argument of process.argv.slice(2)) {
    const [key, value] = argument.replace(/^--/, '').split('=');
    flags.set(key, value ?? 'true');
  }
  return {
    limit: Number(flags.get('limit') ?? DEFAULT_LIMIT),
    onlyInProducts: flags.get('all') !== 'true',
    isDryRun: flags.get('dry-run') === 'true',
    fromFile: flags.get('from') ?? null,
  };
};

const main = async () => {
  const options = readArguments();
  const context = await NestFactory.createApplicationContext(AppModule, {
    logger: ['warn', 'error'],
  });
  try {
    const describer = context.get(IngredientDescriberService);
    if (options.fromFile) {
      const summary = await describer.applyProseFile(options.fromFile);
      console.log(`applied ${summary.applied} entries from ${options.fromFile}`);
      if (summary.unknown.length) {
        console.warn(`not in the dictionary: ${summary.unknown.join(', ')}`);
      }
      return;
    }
    const summary = await describer.describeMissing({
      ...options,
      onProgress: (progress) =>
        console.log(
          `${progress.processed}/${progress.total} · written ${progress.written} · declined ${progress.declined}`,
        ),
    });
    console.log(
      `done: ${summary.written} described, ${summary.declined} declined, ${summary.total} selected`,
    );
  } finally {
    await context.close();
  }
};

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
