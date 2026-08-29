import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import type { User } from '@prisma/client';
import { MINIMUM_AGE, type ConsentState, type UserDto } from '@kosvia/shared';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ConsentService, type ConsentOrigin } from '../account/consent.service';
import { TokenService } from './token.service';
import type { LoginDto, RegisterDto } from './dto/auth.dto';

const BCRYPT_ROUNDS = 12;

export type SessionOrigin = ConsentOrigin;

export interface IssuedSession {
  user: UserDto;
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
    private readonly consents: ConsentService,
  ) {}

  async register(dto: RegisterDto, origin: SessionOrigin = {}): Promise<IssuedSession> {
    const birthDate = new Date(dto.birthDate);
    if (Number.isNaN(birthDate.getTime()) || ageInYears(birthDate) < MINIMUM_AGE) {
      throw new BadRequestException(
        `You need to be at least ${MINIMUM_AGE} to create a Kosvia account.`,
      );
    }
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException('An account with that email already exists.');
    }

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        name: dto.name ?? null,
        birthDate,
        lastActiveAt: new Date(),
        passwordHash: await bcrypt.hash(dto.password, BCRYPT_ROUNDS),
      },
    });
    await this.consents.recordMany(
      user.id,
      {
        TERMS: true,
        PRIVACY: true,
        ...(dto.healthConsent !== undefined && { BEAUTY_PROFILE_HEALTH: dto.healthConsent }),
        ...(dto.aiConsent !== undefined && { AI_PROCESSING: dto.aiConsent }),
      },
      origin,
    );

    return this.issue(user, origin.userAgent, false);
  }

  async login(dto: LoginDto, userAgent?: string): Promise<IssuedSession> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: { beautyProfile: { select: { id: true } } },
    });

    // Compare against a dummy hash when the account is missing so the response
    // time does not reveal whether an email is registered.
    const hash =
      user?.passwordHash ?? '$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidi';
    const valid = await bcrypt.compare(dto.password, hash);
    if (!user || !valid) {
      throw new UnauthorizedException('That email and password combination did not match.');
    }

    await this.touch(user.id);
    return this.issue(user, userAgent, Boolean(user.beautyProfile));
  }

  async refresh(rawRefreshToken: string, userAgent?: string): Promise<IssuedSession> {
    const userId = await this.tokens.consumeRefreshToken(rawRefreshToken);
    if (!userId) throw new UnauthorizedException('Your session has expired. Please sign in again.');

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { beautyProfile: { select: { id: true } } },
    });
    if (!user) throw new UnauthorizedException('Your session is no longer valid.');

    await this.touch(user.id);
    return this.issue(user, userAgent, Boolean(user.beautyProfile));
  }

  async logout(rawRefreshToken: string | undefined): Promise<void> {
    if (rawRefreshToken) await this.tokens.revoke(rawRefreshToken);
  }

  async me(userId: string): Promise<UserDto> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: { beautyProfile: { select: { id: true } } },
    });
    return this.describe(user, Boolean(user.beautyProfile));
  }

  /** Consents and any pending deletion travel with the user, so the client never guesses. */
  private async describe(user: User, hasProfile: boolean): Promise<UserDto> {
    const [consents, deletion] = await Promise.all([
      this.consents.currentState(user.id),
      this.prisma.accountDeletionRequest.findFirst({
        where: { userId: user.id, status: 'PENDING' },
        select: { executeAt: true },
      }),
    ]);
    return toUserDto(user, hasProfile, consents, deletion?.executeAt ?? null);
  }

  private async touch(userId: string): Promise<void> {
    await this.prisma.user.update({ where: { id: userId }, data: { lastActiveAt: new Date() } });
  }

  private async issue(
    user: User,
    userAgent: string | undefined,
    hasProfile: boolean,
  ): Promise<IssuedSession> {
    const [accessToken, refreshToken, described] = await Promise.all([
      this.tokens.issueAccessToken(user),
      this.tokens.issueRefreshToken(user.id, userAgent),
      this.describe(user, hasProfile),
    ]);
    return { user: described, accessToken, refreshToken };
  }
}

export function toUserDto(
  user: User,
  hasBeautyProfile: boolean,
  consents: ConsentState,
  deletionScheduledFor: Date | null,
): UserDto {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    subscriptionStatus: user.subscriptionStatus,
    hasBeautyProfile,
    consents,
    deletionScheduledFor: deletionScheduledFor?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
  };
}

const MS_PER_YEAR = 365.25 * 24 * 60 * 60 * 1000;

const ageInYears = (birthDate: Date): number => (Date.now() - birthDate.getTime()) / MS_PER_YEAR;
