import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  AppReviewDto,
  AppReviewListResult,
  AppReviewSort,
  AppReviewSummary,
} from '@kosvia/shared';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { AppReviewQueryDto, CreateAppReviewDto } from './dto/app-review.dto';

const DEFAULT_PAGE_SIZE = 10;

const SORT_ORDERS: Record<AppReviewSort, Prisma.AppReviewOrderByWithRelationInput[]> = {
  newest: [{ createdAt: 'desc' }],
  oldest: [{ createdAt: 'asc' }],
  'rating-desc': [{ rating: 'desc' }, { createdAt: 'desc' }],
  'rating-asc': [{ rating: 'asc' }, { createdAt: 'desc' }],
};

type ReviewWithAuthor = Prisma.AppReviewGetPayload<{
  include: { user: { select: { name: true } } };
}>;

@Injectable()
export class AppReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: AppReviewQueryDto): Promise<AppReviewListResult> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;
    const where = { status: 'VISIBLE' as const };

    const [reviews, total, average, grouped] = await Promise.all([
      this.prisma.appReview.findMany({
        where,
        include: { user: { select: { name: true } } },
        orderBy: SORT_ORDERS[query.sort ?? 'newest'],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.appReview.count({ where }),
      this.prisma.appReview.aggregate({ where, _avg: { rating: true } }),
      this.prisma.appReview.groupBy({ by: ['rating'], where, _count: true }),
    ]);

    const distribution: AppReviewSummary['distribution'] = [0, 0, 0, 0, 0];
    for (const group of grouped) {
      distribution[group.rating - 1] = group._count;
    }

    return {
      items: reviews.map((review) => this.toDto(review)),
      total,
      page,
      pageSize,
      pageCount: Math.max(1, Math.ceil(total / pageSize)),
      summary: {
        average: average._avg.rating === null ? null : Math.round(average._avg.rating * 10) / 10,
        count: total,
        distribution,
      },
    };
  }

  async findOwn(userId: string): Promise<AppReviewDto | null> {
    const review = await this.prisma.appReview.findUnique({
      where: { userId },
      include: { user: { select: { name: true } } },
    });
    return review ? this.toDto(review) : null;
  }

  async create(userId: string, dto: CreateAppReviewDto): Promise<AppReviewDto> {
    try {
      const created = await this.prisma.appReview.create({
        data: { userId, rating: dto.rating, body: dto.body },
        include: { user: { select: { name: true } } },
      });
      return this.toDto(created);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('You have already reviewed Kosvia.');
      }
      throw error;
    }
  }

  async removeOwn(userId: string): Promise<void> {
    await this.prisma.appReview.deleteMany({ where: { userId } });
  }

  private toDto(review: ReviewWithAuthor): AppReviewDto {
    return {
      id: review.id,
      rating: review.rating,
      body: review.body,
      authorName: review.user.name,
      createdAt: review.createdAt.toISOString(),
      updatedAt: review.updatedAt.toISOString(),
    };
  }
}
