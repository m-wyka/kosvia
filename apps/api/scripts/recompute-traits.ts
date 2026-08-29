/**
 * Recomputes ingredientScore and product_traits for the whole catalogue.
 *
 *   npm run traits:recompute -w @kosvia/api            # everything
 *   npm run traits:recompute -w @kosvia/api -- --stale # only missing / older traitsVersion
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { ProductTraitsService } from '../src/modules/scoring/product-traits.service';

const main = async () => {
  const onlyStale = process.argv.includes('--stale');
  const context = await NestFactory.createApplicationContext(AppModule, {
    logger: ['warn', 'error'],
  });
  try {
    const refreshed = await context.get(ProductTraitsService).refreshAll({ onlyStale });
    console.log(`Refreshed traits for ${refreshed} products${onlyStale ? ' (stale only)' : ''}`);
  } finally {
    await context.close();
  }
};

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
