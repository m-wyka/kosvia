import { Injectable, NotFoundException } from '@nestjs/common';
import type { BeautyProfileDto, TaxonomyItemDto } from '@kosvia/shared';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { UpdateBeautyProfileDto } from './dto/update-profile.dto';

const PROFILE_INCLUDE = {
  concerns: true,
  goals: true,
  preferredBrands: true,
  excludedBrands: true,
  excludedIngredients: true,
} as const;

type ProfileWithRelations = Awaited<
  ReturnType<PrismaService['beautyProfile']['findUniqueOrThrow']>
> & {
  concerns: Array<{ id: string; slug: string; name: string; description: string | null }>;
  goals: Array<{ id: string; slug: string; name: string; description: string | null }>;
  preferredBrands: Array<{ id: string; name: string; slug: string; logo: string | null }>;
  excludedBrands: Array<{ id: string; name: string; slug: string; logo: string | null }>;
  excludedIngredients: Array<{
    id: string;
    inciName: string;
    commonName: string | null;
    tags: string[];
  }>;
};

@Injectable()
export class ProfileService {
  constructor(private readonly prisma: PrismaService) {}

  /** Returns null rather than throwing — "no profile yet" is a normal state. */
  async get(userId: string): Promise<BeautyProfileDto | null> {
    const profile = await this.prisma.beautyProfile.findUnique({
      where: { userId },
      include: PROFILE_INCLUDE,
    });
    return profile ? this.toDto(profile as ProfileWithRelations) : null;
  }

  /**
   * Creates the profile on first save, so onboarding is a single PATCH rather
   * than a create-then-update dance on the client.
   */
  async upsert(userId: string, dto: UpdateBeautyProfileDto): Promise<BeautyProfileDto> {
    const [concernIds, goalIds] = await Promise.all([
      this.resolveSlugs('beautyConcern', dto.concernSlugs),
      this.resolveSlugs('beautyGoal', dto.goalSlugs),
    ]);

    const scalars = {
      skinType: dto.skinType,
      sensitivity: dto.sensitivity,
      budget: dto.budget,
      fragrancePreference: dto.fragrancePreference,
      veganPreference: dto.veganPreference,
      crueltyFreePreference: dto.crueltyFreePreference,
    };

    // On update we use `set`, not `connect`, so deselecting an option in the UI
    // actually removes it. On create there is nothing to replace, so `connect`.
    const links = {
      concerns: concernIds,
      goals: goalIds,
      preferredBrands: dto.preferredBrandIds,
      excludedBrands: dto.excludedBrandIds,
      excludedIngredients: dto.excludedIngredientIds,
    };
    const relations = (mode: 'set' | 'connect') =>
      Object.fromEntries(
        Object.entries(links)
          .filter(([, ids]) => ids !== undefined)
          .map(([key, ids]) => [key, { [mode]: ids!.map((id) => ({ id })) }]),
      );

    const profile = await this.prisma.beautyProfile.upsert({
      where: { userId },
      create: { userId, ...stripUndefined(scalars), ...relations('connect') },
      update: { ...stripUndefined(scalars), ...relations('set') },
      include: PROFILE_INCLUDE,
    });

    return this.toDto(profile as ProfileWithRelations);
  }

  async options(): Promise<{ concerns: TaxonomyItemDto[]; goals: TaxonomyItemDto[] }> {
    const [concerns, goals] = await Promise.all([
      this.prisma.beautyConcern.findMany({ orderBy: { name: 'asc' } }),
      this.prisma.beautyGoal.findMany({ orderBy: { name: 'asc' } }),
    ]);
    return {
      concerns: concerns.map(toTaxonomy),
      goals: goals.map(toTaxonomy),
    };
  }

  async remove(userId: string): Promise<void> {
    const existing = await this.prisma.beautyProfile.findUnique({ where: { userId } });
    if (!existing) throw new NotFoundException('You do not have a beauty profile yet.');
    await this.prisma.beautyProfile.delete({ where: { userId } });
  }

  private async resolveSlugs(
    model: 'beautyConcern' | 'beautyGoal',
    slugs: string[] | undefined,
  ): Promise<string[] | undefined> {
    if (!slugs) return undefined;
    if (!slugs.length) return [];
    const rows =
      model === 'beautyConcern'
        ? await this.prisma.beautyConcern.findMany({
            where: { slug: { in: slugs } },
            select: { id: true },
          })
        : await this.prisma.beautyGoal.findMany({
            where: { slug: { in: slugs } },
            select: { id: true },
          });
    return rows.map((row) => row.id);
  }

  private toDto(profile: ProfileWithRelations): BeautyProfileDto {
    return {
      id: profile.id,
      skinType: profile.skinType,
      sensitivity: profile.sensitivity,
      budget: profile.budget,
      fragrancePreference: profile.fragrancePreference,
      veganPreference: profile.veganPreference,
      crueltyFreePreference: profile.crueltyFreePreference,
      concerns: profile.concerns.map(toTaxonomy),
      goals: profile.goals.map(toTaxonomy),
      preferredBrands: profile.preferredBrands.map(toBrandSummary),
      excludedBrands: profile.excludedBrands.map(toBrandSummary),
      excludedIngredients: profile.excludedIngredients.map((i) => ({
        id: i.id,
        inciName: i.inciName,
        commonName: i.commonName,
        tags: i.tags as never,
      })),
      updatedAt: profile.updatedAt.toISOString(),
    };
  }
}

function toTaxonomy(item: {
  id: string;
  slug: string;
  name: string;
  description: string | null;
}): TaxonomyItemDto {
  return { id: item.id, slug: item.slug, name: item.name, description: item.description };
}

function toBrandSummary(brand: { id: string; name: string; slug: string; logo: string | null }) {
  return { id: brand.id, name: brand.name, slug: brand.slug, logo: brand.logo };
}

function stripUndefined<T extends Record<string, unknown>>(input: T): Partial<T> {
  return Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined)) as Partial<T>;
}
