import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ConsentType } from '@prisma/client';
import {
  CONSENT_TYPES,
  CONSENT_VERSIONS,
  type ConsentEventDto,
  type ConsentState,
} from '@kosvia/shared';
import { PrismaService } from '../../common/prisma/prisma.service';

export interface ConsentOrigin {
  ip?: string;
  userAgent?: string;
}

const EMPTY_STATE = (): ConsentState =>
  Object.fromEntries(CONSENT_TYPES.map((type) => [type, false])) as ConsentState;

/**
 * Consent is append-only history. "Is it granted?" means "what does the
 * latest event for that type say, and is it for the current document
 * version?" — a policy change invalidates old consents automatically.
 */
@Injectable()
export class ConsentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async record(
    userId: string,
    type: ConsentType,
    granted: boolean,
    origin: ConsentOrigin = {},
  ): Promise<void> {
    const now = new Date();
    await this.prisma.userConsent.create({
      data: {
        userId,
        type,
        version: CONSENT_VERSIONS[type],
        granted,
        grantedAt: granted ? now : null,
        revokedAt: granted ? null : now,
        ipHash: origin.ip ? this.hashIp(origin.ip) : null,
        userAgent: origin.userAgent?.slice(0, 300) ?? null,
      },
    });
  }

  async recordMany(
    userId: string,
    grants: Partial<Record<ConsentType, boolean>>,
    origin: ConsentOrigin = {},
  ): Promise<void> {
    for (const [type, granted] of Object.entries(grants)) {
      if (granted !== undefined) {
        await this.record(userId, type as ConsentType, granted, origin);
      }
    }
  }

  async currentState(userId: string): Promise<ConsentState> {
    const latest = await this.prisma.userConsent.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      distinct: ['type'],
      select: { type: true, granted: true, version: true },
    });
    const state = EMPTY_STATE();
    for (const event of latest) {
      state[event.type] = event.granted && event.version === CONSENT_VERSIONS[event.type];
    }
    return state;
  }

  async hasConsent(userId: string, type: ConsentType): Promise<boolean> {
    const state = await this.currentState(userId);
    return state[type];
  }

  async history(userId: string): Promise<ConsentEventDto[]> {
    const rows = await this.prisma.userConsent.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
      select: { type: true, version: true, granted: true, createdAt: true },
    });
    return rows.map((row) => ({
      type: row.type,
      version: row.version,
      granted: row.granted,
      createdAt: row.createdAt.toISOString(),
    }));
  }

  private hashIp(ip: string): string {
    const salt = this.config.get<string>('jwt.refreshSecret', 'kosvia');
    return createHash('sha256').update(`${ip}:${salt}`).digest('hex');
  }
}
