import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes } from 'node:crypto';
import type { User } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

export interface AccessTokenPayload {
  sub: string;
  email: string;
  role: User['role'];
}

/**
 * Issues short-lived access tokens and opaque refresh tokens.
 *
 * Refresh tokens are random 64-byte strings stored only as SHA-256 hashes, so a
 * database leak does not hand out sessions. Every refresh rotates the token and
 * revokes its predecessor.
 */
@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  get accessTtl(): string {
    return this.config.get<string>('jwt.accessTtl', '15m');
  }

  get refreshTtl(): string {
    return this.config.get<string>('jwt.refreshTtl', '30d');
  }

  async issueAccessToken(user: Pick<User, 'id' | 'email' | 'role'>): Promise<string> {
    const payload: AccessTokenPayload = { sub: user.id, email: user.email, role: user.role };
    return this.jwt.signAsync(payload, {
      secret: this.config.getOrThrow<string>('jwt.accessSecret'),
      // `expiresIn` is typed as a literal union of duration strings; ours comes
      // from the environment, so it is validated by parseDuration instead.
      expiresIn: this.accessTtl as unknown as number,
    });
  }

  async issueRefreshToken(userId: string, userAgent?: string): Promise<string> {
    const raw = randomBytes(64).toString('hex');
    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: this.hash(raw),
        userAgent: userAgent?.slice(0, 255) ?? null,
        expiresAt: new Date(Date.now() + this.refreshTtlMs()),
      },
    });
    return raw;
  }

  /** Returns the owning user id and rotates the token, or null if it is not usable. */
  /**
   * Rotation with reuse detection: a refresh token is single-use, so seeing an
   * already-revoked one means either the user or an attacker holds a stale
   * copy. We cannot tell which, so every session of that user is revoked and
   * both parties have to sign in again.
   */
  async consumeRefreshToken(raw: string): Promise<string | null> {
    const record = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: this.hash(raw) },
    });
    if (!record) return null;
    if (record.revokedAt) {
      await this.revokeAllForUser(record.userId);
      return null;
    }
    if (record.expiresAt < new Date()) return null;

    await this.prisma.refreshToken.update({
      where: { id: record.id },
      data: { revokedAt: new Date() },
    });
    return record.userId;
  }

  async revoke(raw: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: this.hash(raw), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  refreshTtlMs(): number {
    return parseDuration(this.refreshTtl);
  }

  accessTtlMs(): number {
    return parseDuration(this.accessTtl);
  }

  private hash(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }
}

/** Supports the `15m` / `7d` / `12h` style used in the env file. */
export function parseDuration(input: string): number {
  const match = /^(\d+)\s*([smhd])$/.exec(input.trim());
  if (!match) throw new Error(`Cannot parse duration "${input}". Use e.g. 15m, 12h, 30d.`);
  const value = Number(match[1]);
  const unit = match[2] as 's' | 'm' | 'h' | 'd';
  const multipliers = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
  return value * multipliers[unit];
}
