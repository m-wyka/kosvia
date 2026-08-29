import { type INestApplication } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AllExceptionsFilter } from '../../common/filters/all-exceptions.filter';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ProfileController } from './profile.controller';
import { ProfileService } from './profile.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ConsentService } from '../account/consent.service';

/**
 * "No profile yet" is the normal state during onboarding, so the endpoint has
 * to be able to say so in a way a client can actually read.
 *
 * Nest serialises a returned `null` as an empty body; clients receive `""`,
 * which is not nullish, so `profile?.concerns` yields `undefined` rather than
 * short-circuiting — and the onboarding page died on `.map` of undefined.
 */
describe('GET /profile', () => {
  let app: INestApplication;

  const prismaDouble = {
    beautyProfile: { findUnique: jest.fn() },
    beautyConcern: { findMany: jest.fn() },
    beautyGoal: { findMany: jest.fn() },
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ProfileController],
      providers: [
        ProfileService,
        { provide: PrismaService, useValue: prismaDouble },
        { provide: ConsentService, useValue: { hasConsent: async () => true } },
        { provide: APP_FILTER, useClass: AllExceptionsFilter },
      ],
    })
      // The route is normally behind the global JWT guard; stand in a user.
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleRef.createNestApplication();
    app.use((req: { user?: unknown }, _res: unknown, next: () => void) => {
      req.user = { id: 'user-1', email: 'demo@kosvia.app', role: 'USER' };
      next();
    });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns a body that parses as null when the user has no profile', async () => {
    prismaDouble.beautyProfile.findUnique.mockResolvedValue(null);

    const response = await request(app.getHttpServer()).get('/profile').expect(200);

    expect(response.headers['content-type']).toMatch(/application\/json/);
    expect(response.text).toBe('null');
    expect(JSON.parse(response.text)).toBeNull();
  });

  it('never returns an empty body, which clients read as an empty string', async () => {
    prismaDouble.beautyProfile.findUnique.mockResolvedValue(null);

    const response = await request(app.getHttpServer()).get('/profile').expect(200);

    expect(response.text).not.toBe('');
    expect(response.headers['content-length']).not.toBe('0');
  });

  it('returns the profile when there is one', async () => {
    prismaDouble.beautyProfile.findUnique.mockResolvedValue({
      id: 'profile-1',
      skinType: 'COMBINATION',
      sensitivity: 'MEDIUM',
      budget: 'UNDER_100',
      fragrancePreference: 'PREFER_FRAGRANCE_FREE',
      veganPreference: false,
      crueltyFreePreference: true,
      updatedAt: new Date('2026-01-01T00:00:00Z'),
      concerns: [{ id: 'c1', slug: 'redness', name: 'Redness', description: null }],
      goals: [{ id: 'g1', slug: 'hydration', name: 'Hydration', description: null }],
      preferredBrands: [],
      excludedBrands: [],
      excludedIngredients: [],
    });

    const response = await request(app.getHttpServer()).get('/profile').expect(200);

    expect(response.body).toMatchObject({ id: 'profile-1', skinType: 'COMBINATION' });
    expect(response.body.concerns).toEqual([
      { id: 'c1', slug: 'redness', name: 'Redness', description: null },
    ]);
  });
});
