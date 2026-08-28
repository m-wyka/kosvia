import { INestApplication, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit(): Promise<void> {
    try {
      await this.$connect();
    } catch (error) {
      this.logger.error(
        'Could not connect to PostgreSQL. Is the database running and DATABASE_URL correct?',
      );
      throw error;
    }
  }

  /** Closes the pool cleanly when the process is asked to stop. */
  enableShutdownHooks(app: INestApplication): void {
    process.on('beforeExit', () => {
      void app.close();
    });
  }
}
