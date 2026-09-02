/**
 * Re-runs the matcher over every pending label token. Use it after the matcher
 * itself learns something new — a repair rule, a widened alias lookup — when no
 * import is due and `aliases:apply` would do unrelated work.
 *
 *   npm run inci:rematch -w @kosvia/api
 *
 * Safe to re-run: a token that still fails to match is left pending.
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { UnmatchedTokenService } from '../src/modules/inci/unmatched-token.service';

const main = async () => {
  const context = await NestFactory.createApplicationContext(AppModule, {
    logger: ['warn', 'error'],
  });
  try {
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
