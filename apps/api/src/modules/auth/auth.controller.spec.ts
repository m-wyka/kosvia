import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcryptjs';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import configuration from '../../common/config/configuration';
import { AllExceptionsFilter } from '../../common/filters/all-exceptions.filter';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { TokenService } from './token.service';
import { JwtStrategy } from './strategies/jwt.strategy';

/**
 * Auth API tests.
 *
 * Prisma is replaced with an in-memory double so the whole HTTP path — pipes,
 * guards, cookies, error shape — is exercised without needing a database.
 */
describe('Auth API', () => {
  let app: INestApplication;
  let users: Array<{
    id: string;
    email: string;
    passwordHash: string;
    name: string | null;
    role: 'USER' | 'ADMIN';
    subscriptionStatus: 'FREE';
    createdAt: Date;
    updatedAt: Date;
    beautyProfile: null;
  }>;
  let refreshTokens: Array<{
    id: string;
    userId: string;
    tokenHash: string;
    expiresAt: Date;
    revokedAt: Date | null;
  }>;

  const prismaDouble = {
    user: {
      findUnique: jest.fn(
        async ({ where }: { where: { email?: string; id?: string } }) =>
          users.find((u) => (where.email ? u.email === where.email : u.id === where.id)) ?? null,
      ),
      findUniqueOrThrow: jest.fn(async ({ where }: { where: { id: string } }) => {
        const found = users.find((u) => u.id === where.id);
        if (!found) throw new Error('not found');
        return found;
      }),
      create: jest.fn(
        async ({
          data,
        }: {
          data: { email: string; passwordHash: string; name: string | null };
        }) => {
          const created = {
            id: `user-${users.length + 1}`,
            email: data.email,
            passwordHash: data.passwordHash,
            name: data.name,
            role: 'USER' as const,
            subscriptionStatus: 'FREE' as const,
            createdAt: new Date(),
            updatedAt: new Date(),
            beautyProfile: null,
          };
          users.push(created);
          return created;
        },
      ),
    },
    refreshToken: {
      create: jest.fn(
        async ({ data }: { data: { userId: string; tokenHash: string; expiresAt: Date } }) => {
          const created = { id: `rt-${refreshTokens.length + 1}`, revokedAt: null, ...data };
          refreshTokens.push(created);
          return created;
        },
      ),
      findUnique: jest.fn(
        async ({ where }: { where: { tokenHash: string } }) =>
          refreshTokens.find((t) => t.tokenHash === where.tokenHash) ?? null,
      ),
      update: jest.fn(
        async ({ where, data }: { where: { id: string }; data: { revokedAt: Date } }) => {
          const found = refreshTokens.find((t) => t.id === where.id)!;
          found.revokedAt = data.revokedAt;
          return found;
        },
      ),
      updateMany: jest.fn(
        async ({ where, data }: { where: { tokenHash: string }; data: { revokedAt: Date } }) => {
          const found = refreshTokens.find((t) => t.tokenHash === where.tokenHash);
          if (found) found.revokedAt = data.revokedAt;
          return { count: found ? 1 : 0 };
        },
      ),
    },
  };

  beforeAll(async () => {
    process.env.JWT_SECRET = 'test-access-secret';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';

    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, load: [configuration], ignoreEnvFile: true }),
        PassportModule,
        JwtModule.register({}),
      ],
      controllers: [AuthController],
      providers: [
        AuthService,
        TokenService,
        JwtStrategy,
        { provide: PrismaService, useValue: prismaDouble },
        { provide: APP_GUARD, useClass: JwtAuthGuard },
        { provide: APP_FILTER, useClass: AllExceptionsFilter },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
  });

  beforeEach(async () => {
    users = [
      {
        id: 'user-existing',
        email: 'demo@kosvia.app',
        passwordHash: await bcrypt.hash('Password123!', 4),
        name: 'Demo',
        role: 'USER',
        subscriptionStatus: 'FREE',
        createdAt: new Date(),
        updatedAt: new Date(),
        beautyProfile: null,
      },
    ];
    refreshTokens = [];
  });

  afterAll(async () => {
    await app.close();
  });

  const cookiesFrom = (res: request.Response): string[] =>
    (res.headers['set-cookie'] as unknown as string[] | undefined) ?? [];

  describe('POST /auth/register', () => {
    it('creates an account and sets both auth cookies', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'New@Kosvia.app', password: 'StrongPass1', name: 'New User' })
        .expect(201);

      expect(res.body.user.email).toBe('new@kosvia.app'); // normalised
      expect(res.body.user.hasBeautyProfile).toBe(false);
      expect(res.body.user).not.toHaveProperty('passwordHash');

      const cookies = cookiesFrom(res).join(';');
      expect(cookies).toContain('kosvia_at=');
      expect(cookies).toContain('kosvia_rt=');
      expect(cookies).toContain('HttpOnly');
    });

    it('never stores the password in plain text', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'hash@kosvia.app', password: 'StrongPass1' })
        .expect(201);

      const stored = users.find((u) => u.email === 'hash@kosvia.app')!;
      expect(stored.passwordHash).not.toBe('StrongPass1');
      expect(await bcrypt.compare('StrongPass1', stored.passwordHash)).toBe(true);
    });

    it.each([
      ['short', 'Ab1'],
      ['no uppercase', 'lowercase1234'],
      ['no digit', 'NoDigitsHere'],
    ])('rejects a %s password with a helpful message', async (_label, password) => {
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'weak@kosvia.app', password })
        .expect(400);
      expect(res.body.message).toBeDefined();
      expect(users.some((u) => u.email === 'weak@kosvia.app')).toBe(false);
    });

    it('rejects an invalid email', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'not-an-email', password: 'StrongPass1' })
        .expect(400);
    });

    it('refuses a duplicate email with 409', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'demo@kosvia.app', password: 'StrongPass1' })
        .expect(409);
    });

    it('strips unknown fields instead of trusting them', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'sneaky@kosvia.app', password: 'StrongPass1', role: 'ADMIN' })
        .expect(400);
    });
  });

  describe('POST /auth/login', () => {
    it('signs in with the right password', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'demo@kosvia.app', password: 'Password123!' })
        .expect(200);
      expect(res.body.user.id).toBe('user-existing');
      expect(res.body.accessToken).toEqual(expect.any(String));
    });

    it('gives the same response for a wrong password and an unknown account', async () => {
      const wrongPassword = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'demo@kosvia.app', password: 'WrongPassword1' })
        .expect(401);
      const unknownUser = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'nobody@kosvia.app', password: 'WrongPassword1' })
        .expect(401);

      expect(wrongPassword.body.message).toBe(unknownUser.body.message);
    });
  });

  describe('GET /auth/me', () => {
    it('is rejected without a session', async () => {
      await request(app.getHttpServer()).get('/auth/me').expect(401);
    });

    it('returns the signed-in user when the cookie is present', async () => {
      const login = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'demo@kosvia.app', password: 'Password123!' });

      const res = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Cookie', cookiesFrom(login))
        .expect(200);
      expect(res.body.email).toBe('demo@kosvia.app');
    });

    it('also accepts a bearer token', async () => {
      const login = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'demo@kosvia.app', password: 'Password123!' });

      await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${login.body.accessToken}`)
        .expect(200);
    });

    it('rejects a tampered token', async () => {
      await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', 'Bearer not.a.real.token')
        .expect(401);
    });
  });

  describe('POST /auth/refresh', () => {
    it('rotates the refresh token and revokes the old one', async () => {
      const login = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'demo@kosvia.app', password: 'Password123!' });
      const firstCookies = cookiesFrom(login);

      await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', firstCookies)
        .expect(200);

      expect(refreshTokens).toHaveLength(2);
      expect(refreshTokens[0].revokedAt).not.toBeNull();
      expect(refreshTokens[1].revokedAt).toBeNull();

      // A replayed refresh token must not work a second time.
      await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', firstCookies)
        .expect(401);
    });

    it('fails cleanly when there is no refresh cookie', async () => {
      await request(app.getHttpServer()).post('/auth/refresh').expect(401);
    });
  });

  describe('POST /auth/logout', () => {
    it('revokes the session and clears the cookies', async () => {
      const login = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'demo@kosvia.app', password: 'Password123!' });

      const res = await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Cookie', cookiesFrom(login))
        .expect(204);

      expect(refreshTokens[0].revokedAt).not.toBeNull();
      expect(cookiesFrom(res).join(';')).toContain('kosvia_at=;');
    });
  });

  it('returns errors in one consistent shape', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'demo@kosvia.app', password: 'nope' })
      .expect(401);
    expect(res.body).toMatchObject({
      statusCode: 401,
      error: expect.any(String),
      message: expect.any(String),
      path: '/auth/login',
    });
  });
});
