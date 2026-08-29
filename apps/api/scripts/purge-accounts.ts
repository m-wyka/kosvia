/**
 * Executes account deletions whose 7-day grace period has passed.
 *
 *   npm run account:purge -w @kosvia/api
 *
 * The API process runs the same sweep hourly; this exists for operators and
 * for environments where the API is not long-running.
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { AccountService } from '../src/modules/account/account.service';

const main = async () => {
  const context = await NestFactory.createApplicationContext(AppModule, {
    logger: ['warn', 'error'],
  });
  try {
    const deleted = await context.get(AccountService).purgeDue();
    console.log(`Deleted ${deleted} account(s) past their grace period`);
  } finally {
    await context.close();
  }
};

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
