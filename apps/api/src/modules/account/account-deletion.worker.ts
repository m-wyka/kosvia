import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { AccountService } from './account.service';

const SWEEP_INTERVAL_MS = 60 * 60 * 1000;

/**
 * Executes account deletions once their grace period is over. Runs inside
 * the API process on an hourly timer; `npm run account:purge` triggers the
 * same sweep from the command line.
 */
@Injectable()
export class AccountDeletionWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AccountDeletionWorker.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(private readonly account: AccountService) {}

  onModuleInit(): void {
    if (process.env.NODE_ENV === 'test') return;
    this.timer = setInterval(() => void this.sweep(), SWEEP_INTERVAL_MS);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async sweep(): Promise<number> {
    try {
      return await this.account.purgeDue();
    } catch (error) {
      this.logger.error(`Deletion sweep failed: ${String(error)}`);
      return 0;
    }
  }
}
