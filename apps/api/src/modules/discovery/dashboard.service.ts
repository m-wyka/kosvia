import { Injectable } from '@nestjs/common';
import type { DashboardDto } from '@kosvia/shared';
import { PrismaService } from '../../common/prisma/prisma.service';
import { toUserDto } from '../auth/auth.service';
import { ConsentService } from '../account/consent.service';
import { ProfileService } from '../profile/profile.service';
import { ViewerContextService } from '../profile/viewer-context.service';
import { RecommendationService } from '../recommendation/recommendation.service';
import { RoutineAnalysisService } from '../recommendation/routine-analysis.service';
import { RegulatoryAlertsService } from '../shelf/regulatory-alerts.service';

/** One call that fills the whole signed-in home screen. */
@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly profiles: ProfileService,
    private readonly viewers: ViewerContextService,
    private readonly recommendations: RecommendationService,
    private readonly routine: RoutineAnalysisService,
    private readonly consents: ConsentService,
    private readonly regulatoryAlerts: RegulatoryAlertsService,
  ) {}

  async load(userId: string): Promise<DashboardDto> {
    const [user, profile, viewer, shelfCount, favoriteCount, activeAlerts] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({ where: { id: userId } }),
      this.profiles.get(userId),
      this.viewers.load(userId),
      this.prisma.userShelfItem.count({ where: { userId, finishedAt: null } }),
      this.prisma.userShelfItem.count({ where: { userId, isFavorite: true } }),
      this.prisma.priceAlert.count({ where: { userId, active: true } }),
    ]);

    const [consents, deletion] = await Promise.all([
      this.consents.currentState(userId),
      this.prisma.accountDeletionRequest.findFirst({
        where: { userId, status: 'PENDING' },
        select: { executeAt: true },
      }),
    ]);
    const [recommended, routineAnalysis, regulatoryAlerts] = await Promise.all([
      this.recommendations.getPersonalizedProducts(viewer, { limit: 6 }),
      shelfCount > 0 ? this.routine.analyse(userId) : Promise.resolve(null),
      shelfCount > 0 ? this.regulatoryAlerts.alertsFor(userId) : Promise.resolve([]),
    ]);

    return {
      user: toUserDto(user, Boolean(profile), consents, deletion?.executeAt ?? null),
      profile,
      shelfCount,
      favoriteCount,
      activeAlerts,
      recommended,
      routine: routineAnalysis,
      regulatoryAlerts,
    };
  }
}
