import { Controller, Get, HttpCode, HttpStatus, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { Public } from './common/decorators/public.decorator';
import { PrismaService } from './common/prisma/prisma.service';

/**
 * Liveness answers "is the process up?" and never touches the database, so
 * an orchestrator does not restart the API because Postgres blinked.
 * Readiness answers "can it serve traffic?" and returns 503 until it can.
 */
@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Liveness — the process is running' })
  live(): { status: 'ok'; uptime: number } {
    return { status: 'ok', uptime: Math.round(process.uptime()) };
  }

  @Public()
  @Get('ready')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Readiness — database reachable (503 otherwise)' })
  async ready(
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ status: 'ok' | 'degraded'; database: 'up' | 'down'; uptime: number }> {
    let database: 'up' | 'down' = 'up';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      database = 'down';
      res.status(HttpStatus.SERVICE_UNAVAILABLE);
    }
    return {
      status: database === 'up' ? 'ok' : 'degraded',
      database,
      uptime: Math.round(process.uptime()),
    };
  }
}
