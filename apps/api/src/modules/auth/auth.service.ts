import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import type { User } from '@prisma/client';
import type { UserDto } from '@kosvia/shared';
import { PrismaService } from '../../common/prisma/prisma.service';
import { TokenService } from './token.service';
import type { LoginDto, RegisterDto } from './dto/auth.dto';

const BCRYPT_ROUNDS = 12;

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
  ) {}

  async register(dto: RegisterDto, userAgent?: string): Promise<IssuedSession> {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException('An account with that email already exists.');
    }

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        name: dto.name ?? null,
        passwordHash: await bcrypt.hash(dto.password, BCRYPT_ROUNDS),
      },
    });

    return this.issue(user, userAgent, false);
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
    return toUserDto(user, Boolean(user.beautyProfile));
  }

  private async issue(
    user: User,
    userAgent: string | undefined,
    hasProfile: boolean,
  ): Promise<IssuedSession> {
    const [accessToken, refreshToken] = await Promise.all([
      this.tokens.issueAccessToken(user),
      this.tokens.issueRefreshToken(user.id, userAgent),
    ]);
    return { user: toUserDto(user, hasProfile), accessToken, refreshToken };
  }
}

export function toUserDto(user: User, hasBeautyProfile: boolean): UserDto {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    subscriptionStatus: user.subscriptionStatus,
    hasBeautyProfile,
    createdAt: user.createdAt.toISOString(),
  };
}
