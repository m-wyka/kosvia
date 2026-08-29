import type { ConfigService } from '@nestjs/config';
import type { JwtService } from '@nestjs/jwt';
import type { PrismaService } from '../../common/prisma/prisma.service';
import { TokenService } from './token.service';

const inAnHour = () => new Date(Date.now() + 60 * 60 * 1000);

const prismaWith = (record: Record<string, unknown> | null) => {
  const refreshToken = {
    findUnique: jest.fn().mockResolvedValue(record),
    update: jest.fn().mockResolvedValue(undefined),
    updateMany: jest.fn().mockResolvedValue({ count: 1 }),
  };
  return { client: { refreshToken } as unknown as PrismaService, refreshToken };
};

const configStub = {
  get: (key: string, fallback?: unknown) => (key === 'jwt.refreshSecret' ? 'secret' : fallback),
} as unknown as ConfigService;

describe('TokenService.consumeRefreshToken', () => {
  const build = (record: Record<string, unknown> | null) => {
    const { client, refreshToken } = prismaWith(record);
    return { service: new TokenService({} as JwtService, configStub, client), refreshToken };
  };

  it('rotates a live token and returns its owner', async () => {
    const { service, refreshToken } = build({
      id: 'token-1',
      userId: 'user-1',
      revokedAt: null,
      expiresAt: inAnHour(),
    });
    await expect(service.consumeRefreshToken('raw')).resolves.toBe('user-1');
    expect(refreshToken.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'token-1' } }),
    );
    expect(refreshToken.updateMany).not.toHaveBeenCalled();
  });

  it('treats a replayed (already revoked) token as theft and revokes every session', async () => {
    const { service, refreshToken } = build({
      id: 'token-1',
      userId: 'user-1',
      revokedAt: new Date(),
      expiresAt: inAnHour(),
    });
    await expect(service.consumeRefreshToken('raw')).resolves.toBeNull();
    expect(refreshToken.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'user-1', revokedAt: null } }),
    );
  });

  it('rejects unknown and expired tokens without touching other sessions', async () => {
    const unknown = build(null);
    await expect(unknown.service.consumeRefreshToken('raw')).resolves.toBeNull();
    const expired = build({
      id: 'token-1',
      userId: 'user-1',
      revokedAt: null,
      expiresAt: new Date(Date.now() - 1000),
    });
    await expect(expired.service.consumeRefreshToken('raw')).resolves.toBeNull();
    expect(expired.refreshToken.updateMany).not.toHaveBeenCalled();
  });
});
