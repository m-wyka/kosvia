import { createHash } from 'node:crypto';
import { BadRequestException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import type { ConsentType } from '@prisma/client';
import type { AccountExportDto } from '@kosvia/shared';
import { PrismaService } from '../../common/prisma/prisma.service';
import { TokenService } from '../auth/token.service';
import { ProfileService } from '../profile/profile.service';
import { ConsentService, type ConsentOrigin } from './consent.service';

export const DELETION_GRACE_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class AccountService {
  private readonly logger = new Logger(AccountService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly consents: ConsentService,
    private readonly tokens: TokenService,
    private readonly profile: ProfileService,
  ) {}

  /* ------------------------------------------------------------ consents -- */

  async setConsent(
    userId: string,
    type: ConsentType,
    granted: boolean,
    origin: ConsentOrigin,
  ): Promise<void> {
    if ((type === 'TERMS' || type === 'PRIVACY') && !granted) {
      throw new BadRequestException(
        'Terms and privacy consents cannot be withdrawn — delete the account instead.',
      );
    }
    await this.consents.record(userId, type, granted, origin);
    if (type === 'BEAUTY_PROFILE_HEALTH' && !granted) {
      await this.profile.remove(userId);
    }
  }

  /* -------------------------------------------------------------- export -- */

  async exportData(userId: string): Promise<AccountExportDto> {
    const [
      user,
      beautyProfile,
      consents,
      shelf,
      priceAlerts,
      comparisons,
      conversations,
      skinDiary,
    ] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({
        where: { id: userId },
        include: { beautyProfile: { select: { id: true } } },
      }),
      this.profile.get(userId),
      this.consents.history(userId),
      this.prisma.userShelfItem.findMany({
        where: { userId },
        include: {
          product: { select: { name: true, slug: true, brand: { select: { name: true } } } },
        },
      }),
      this.prisma.priceAlert.findMany({
        where: { userId },
        include: { product: { select: { name: true, slug: true } } },
      }),
      this.prisma.productComparison.findMany({ where: { userId } }),
      this.prisma.aIConversation.findMany({
        where: { userId },
        include: { messages: { orderBy: { createdAt: 'asc' } } },
      }),
      this.prisma.skinDiaryEntry.findMany({
        where: { profile: { userId } },
        orderBy: { date: 'asc' },
      }),
    ]);

    return {
      exportedAt: new Date().toISOString(),
      account: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        subscriptionStatus: user.subscriptionStatus,
        hasBeautyProfile: Boolean(user.beautyProfile),
        birthDate: user.birthDate?.toISOString().slice(0, 10) ?? null,
        createdAt: user.createdAt.toISOString(),
      },
      beautyProfile,
      consents,
      shelf,
      priceAlerts,
      comparisons,
      conversations,
      skinDiary,
    };
  }

  /* ------------------------------------------------------------ deletion -- */

  async requestDeletion(userId: string, password: string): Promise<Date> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!(await bcrypt.compare(password, user.passwordHash))) {
      throw new UnauthorizedException('That password did not match.');
    }
    const executeAt = new Date(Date.now() + DELETION_GRACE_DAYS * DAY_MS);
    await this.prisma.accountDeletionRequest.upsert({
      where: { userId },
      create: { userId, executeAt },
      update: { status: 'PENDING', requestedAt: new Date(), executeAt, cancelledAt: null },
    });
    await this.tokens.revokeAllForUser(userId);
    return executeAt;
  }

  async cancelDeletion(userId: string): Promise<void> {
    await this.prisma.accountDeletionRequest.updateMany({
      where: { userId, status: 'PENDING' },
      data: { status: 'CANCELLED', cancelledAt: new Date() },
    });
  }

  async pendingDeletion(userId: string): Promise<Date | null> {
    const request = await this.prisma.accountDeletionRequest.findFirst({
      where: { userId, status: 'PENDING' },
      select: { executeAt: true },
    });
    return request?.executeAt ?? null;
  }

  /**
   * The hard delete. Everything hangs off User with onDelete: Cascade, so one
   * delete removes profile, consents, shelf, alerts, conversations and their
   * messages. Only a hash of the id remains, as proof it happened.
   */
  async purgeDue(now = new Date()): Promise<number> {
    const due = await this.prisma.accountDeletionRequest.findMany({
      where: { status: 'PENDING', executeAt: { lte: now } },
      select: { id: true, userId: true },
    });
    for (const request of due) {
      await this.prisma.$transaction([
        this.prisma.user.delete({ where: { id: request.userId } }),
        this.prisma.deletionAudit.create({
          data: { idHash: createHash('sha256').update(request.userId).digest('hex') },
        }),
      ]);
      this.logger.log(`Deleted account ${request.userId.slice(0, 6)}… after the grace period`);
    }
    return due.length;
  }
}
