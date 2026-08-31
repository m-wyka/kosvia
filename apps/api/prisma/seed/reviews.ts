/**
 * Demo portal reviews — DEMO DATA ONLY, like the rest of the seed. Upserts by
 * e-mail and user id, so it is safe to run against an already-seeded database
 * (the full seed assumes an empty one).
 */

import * as bcrypt from 'bcryptjs';
import type { PrismaClient } from '@prisma/client';
import { CONSENT_VERSIONS, type ConsentType } from '@kosvia/shared';

const DAY_MS = 24 * 3600 * 1000;
const REVIEWER_CONSENTS: ConsentType[] = ['TERMS', 'PRIVACY'];

const REVIEWERS = [
  {
    email: 'reviewer1@kosvia.dev',
    name: 'Anna Kowalczyk',
    rating: 5,
    daysAgo: 2,
    body: 'Personal Match trafił w punkt — pierwszy raz od lat krem nie podrażnił mi skóry. Wielkie ułatwienie dla wrażliwców.',
  },
  {
    email: 'reviewer2@kosvia.dev',
    name: 'Marta Zielińska',
    rating: 5,
    daysAgo: 5,
    body: 'W końcu rozumiem, co jest w moich kosmetykach. Opisy składników po polsku to jest dokładnie to, czego brakowało.',
  },
  {
    email: 'reviewer3@kosvia.dev',
    name: 'Katarzyna Nowak',
    rating: 4,
    daysAgo: 9,
    body: 'Porównywarka składów oszczędza mi mnóstwo czasu w drogerii. Czekam jeszcze na więcej marek w katalogu.',
  },
  {
    email: 'reviewer4@kosvia.dev',
    name: 'Piotr Wiśniewski',
    rating: 5,
    daysAgo: 14,
    body: 'Kupuję kosmetyki dla całej rodziny i alerty cenowe już kilka razy złapały dobrą promocję. Solidna robota.',
  },
  {
    email: 'reviewer5@kosvia.dev',
    name: 'Ola Kamińska',
    rating: 4,
    daysAgo: 20,
    body: 'Półka z rutyną pokazała mi, że mam trzy serum o tym samym działaniu. Przydałaby się apka mobilna!',
  },
  {
    email: 'reviewer6@kosvia.dev',
    name: 'Magda Lewandowska',
    rating: 5,
    daysAgo: 27,
    body: 'Skaner INCI rozpoznał nawet skład z pogniecionej etykiety. Jestem pod dużym wrażeniem dokładności.',
  },
  {
    email: 'reviewer7@kosvia.dev',
    name: 'Tomasz Dąbrowski',
    rating: 3,
    daysAgo: 33,
    body: 'Dobre narzędzie do sprawdzania składów, ale brakuje mi jeszcze kilku sklepów w porównaniu cen.',
  },
  {
    email: 'reviewer8@kosvia.dev',
    name: 'Ewa Szymańska',
    rating: 5,
    daysAgo: 41,
    body: 'Profil piękna z alergiami to strzał w dziesiątkę — od razu widzę, których produktów mam unikać.',
  },
  {
    email: 'reviewer9@kosvia.dev',
    name: 'Julia Woźniak',
    rating: 4,
    daysAgo: 48,
    body: 'Przejrzysty interfejs i rzetelne informacje o składnikach zamiast marketingowych obietnic. Polecam.',
  },
  {
    email: 'reviewer10@kosvia.dev',
    name: 'Natalia Jankowska',
    rating: 5,
    daysAgo: 55,
    body: 'AI doradca znalazł mi zamiennik ulubionego kremu o połowę tańszy i z lepszym składem. Rewelacja!',
  },
];

export async function seedAppReviews(prisma: PrismaClient): Promise<number> {
  const passwordHash = await bcrypt.hash(process.env.SEED_USER_PASSWORD ?? 'Password123!', 12);

  for (const reviewer of REVIEWERS) {
    const user = await prisma.user.upsert({
      where: { email: reviewer.email },
      update: {},
      create: {
        email: reviewer.email,
        name: reviewer.name,
        role: 'USER',
        birthDate: new Date('1995-03-01'),
        passwordHash,
        consents: {
          create: REVIEWER_CONSENTS.map((type) => ({
            type,
            version: CONSENT_VERSIONS[type],
            granted: true,
            grantedAt: new Date(),
          })),
        },
      },
    });

    await prisma.appReview.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        rating: reviewer.rating,
        body: reviewer.body,
        createdAt: new Date(Date.now() - reviewer.daysAgo * DAY_MS),
      },
    });
  }

  return REVIEWERS.length;
}
