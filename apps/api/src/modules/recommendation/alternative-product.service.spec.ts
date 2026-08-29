import { NotFoundException } from '@nestjs/common';
import { AlternativeProductService } from './alternative-product.service';
import { PersonalMatchService } from '../scoring/personal-match.service';
import type { ProductTraitsService } from '../scoring/product-traits.service';
import type { PrismaService } from '../../common/prisma/prisma.service';
import type { ViewerContext } from '../profile/viewer-context.service';
import { row } from './__fixtures__';

const ANON: ViewerContext = { userId: null, profile: null };

function prismaWith(subject: ReturnType<typeof row> | null, candidates: ReturnType<typeof row>[]) {
  return {
    product: {
      findFirst: jest.fn().mockResolvedValue(subject),
      findMany: jest.fn().mockResolvedValue(candidates),
    },
  } as unknown as PrismaService;
}

/** Every candidate is a fingerprint neighbour, so overlap alone decides the similar group. */
function traitsWith(candidates: ReturnType<typeof row>[]) {
  return {
    similarByFingerprint: jest
      .fn()
      .mockResolvedValue(candidates.map((candidate) => ({ id: candidate.id, similarity: 1 }))),
  } as unknown as ProductTraitsService;
}

describe('AlternativeProductService', () => {
  const match = new PersonalMatchService();
  const build = (subject: ReturnType<typeof row> | null, candidates: ReturnType<typeof row>[]) =>
    new AlternativeProductService(prismaWith(subject, candidates), match, traitsWith(candidates));

  it('raises a clear error when the product does not exist', async () => {
    const service = build(null, []);
    await expect(service.forProduct('missing', ANON)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('offers only genuinely cheaper products in the cheaper group', async () => {
    const subject = row({ id: 'subject', price: 100 });
    const service = build(subject, [
      row({ id: 'much-cheaper', price: 40 }),
      row({ id: 'barely-cheaper', price: 98 }),
      row({ id: 'dearer', price: 150 }),
    ]);

    const groups = await service.forProduct('subject', ANON);
    const cheaper = groups.find((group) => group.kind === 'cheaper');
    const ids = cheaper!.products.map((p) => p.id);

    expect(ids).toContain('much-cheaper');
    // Within 5% is not a meaningful saving, and never the dearer one.
    expect(ids).not.toContain('barely-cheaper');
    expect(ids).not.toContain('dearer');
  });

  it('quotes the actual saving in the reason', async () => {
    const service = build(row({ id: 'subject', price: 100 }), [
      row({ id: 'half-price', price: 50 }),
    ]);
    const groups = await service.forProduct('subject', ANON);
    const cheaper = groups.find((group) => group.kind === 'cheaper');
    const reason = cheaper!.products[0]!.alternativeReason;

    expect(reason.code).toBe('alt-cheaper');
    expect(reason.params?.percent).toBe(50);
    expect(reason.text).toContain('50%');
  });

  it('never suggests the product being viewed', async () => {
    const subject = row({ id: 'subject', price: 100 });
    const service = build(subject, [row({ id: 'other', price: 60 })]);
    const groups = await service.forProduct('subject', ANON);
    const allIds = groups.flatMap((group) => group.products.map((p) => p.id));
    expect(allIds).not.toContain('subject');
  });

  it('finds similar formulas by measured ingredient overlap, not by name', async () => {
    const subject = row({ id: 'subject', ingredientIds: ['a', 'b', 'c', 'd'] });
    const service = build(subject, [
      row({
        id: 'same-formula',
        name: 'Completely Different Name',
        ingredientIds: ['a', 'b', 'c', 'd'],
      }),
      row({ id: 'shared-name', name: 'Product subject', ingredientIds: ['w', 'x', 'y', 'z'] }),
    ]);

    const groups = await service.forProduct('subject', ANON);
    const similar = groups.find((group) => group.kind === 'similar-ingredients');
    expect(similar!.products.map((p) => p.id)).toEqual(['same-formula']);
  });

  it('omits a group entirely rather than showing an empty one', async () => {
    // Every candidate is dearer, so there is nothing cheaper to show.
    const service = build(row({ id: 'subject', price: 20 }), [row({ id: 'dearer', price: 200 })]);
    const groups = await service.forProduct('subject', ANON);
    expect(groups.every((group) => group.products.length > 0)).toBe(true);
    expect(groups.find((group) => group.kind === 'cheaper')).toBeUndefined();
  });

  it('ranks better-match candidates using the viewer’s profile', async () => {
    const viewer: ViewerContext = {
      userId: 'user-1',
      profile: {
        skinType: 'OILY',
        sensitivity: 'LOW',
        budget: 'UNDER_50',
        fragrancePreference: 'NO_PREFERENCE',
        veganPreference: false,
        crueltyFreePreference: false,
        concernSlugs: [],
        goalSlugs: [],
        preferredBrandIds: [],
        excludedBrandIds: [],
        excludedIngredientIds: [],
      },
    };

    const service = build(row({ id: 'subject', price: 200, ingredientScore: 40 }), [
      row({ id: 'better', price: 30, ingredientScore: 90, targetSkinTypes: ['OILY'] }),
    ]);

    const groups = await service.forProduct('subject', viewer);
    const better = groups.find((group) => group.kind === 'better-match');
    expect(better!.products[0].id).toBe('better');
    expect(better!.products[0].personalMatch!.personalised).toBe(true);
  });
});
