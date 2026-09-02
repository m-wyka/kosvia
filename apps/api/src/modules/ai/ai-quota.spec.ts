import { ForbiddenException } from '@nestjs/common';
import { AIService } from './ai.service';
import { planLimitReachedException } from '../subscription/plan-errors';
import type { EntitlementService } from '../subscription/entitlement.service';
import type { PrismaService } from '../../common/prisma/prisma.service';
import type { BeautyAdvisorService } from './beauty-advisor.service';
import type { ViewerContextService } from '../profile/viewer-context.service';
import type { ProductsService } from '../products/products.service';
import type { PersonalMatchService } from '../scoring/personal-match.service';
import type { IngredientScoreService } from '../scoring/ingredient-score.service';
import type { AIProvider } from './providers/ai-provider.interface';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';

const freeUser: AuthenticatedUser = {
  id: 'user-1',
  email: 'free@kosvia.app',
  role: 'USER',
  subscriptionStatus: 'FREE',
};

const buildHarness = () => {
  const provider = {
    generateResponse: jest.fn(() => Promise.resolve('A perfectly safe answer.')),
  } as unknown as AIProvider;
  const prisma = {
    aIConversation: {
      create: jest.fn(() => Promise.resolve({ id: 'conversation-1', messages: [] as unknown[] })),
      findFirst: jest.fn(() => Promise.resolve(null)),
      update: jest.fn(() => Promise.resolve({})),
    },
    aIMessage: {
      create: jest.fn(() => Promise.resolve({ id: 'message-1', createdAt: new Date() })),
    },
  };
  const advisor = {
    buildContext: jest.fn(() => Promise.resolve({ context: {}, retrieved: [] })),
    toSuggestions: jest.fn(() => []),
  } as unknown as BeautyAdvisorService;
  const viewers = {
    load: jest.fn(() => Promise.resolve({ profile: null, shelf: undefined })),
  } as unknown as ViewerContextService;
  const entitlements = {
    currentPlan: jest.fn(() => Promise.resolve('FREE')),
    consumeAiMessage: jest.fn(() => Promise.resolve()),
    refundAiMessage: jest.fn(() => Promise.resolve()),
  };
  const service = new AIService(
    provider,
    prisma as unknown as PrismaService,
    advisor,
    viewers,
    {} as ProductsService,
    {} as PersonalMatchService,
    {} as IngredientScoreService,
    entitlements as unknown as EntitlementService,
  );
  return { service, provider, prisma, entitlements };
};

describe('AI message quota', () => {
  it('answers when a credit is available', async () => {
    const { service, provider, entitlements } = buildHarness();
    const response = await service.chat(freeUser, 'Który krem na suchą skórę?');
    expect(entitlements.consumeAiMessage).toHaveBeenCalledWith('user-1', 'FREE');
    expect(provider.generateResponse).toHaveBeenCalled();
    expect(response.message.content).toBe('A perfectly safe answer.');
  });

  it('never calls the provider or stores a message once the limit is hit', async () => {
    const { service, provider, prisma, entitlements } = buildHarness();
    entitlements.consumeAiMessage.mockRejectedValue(planLimitReachedException('AI_MESSAGE', 5));
    await expect(service.chat(freeUser, 'Szósta wiadomość')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(provider.generateResponse).not.toHaveBeenCalled();
    expect(prisma.aIMessage.create).not.toHaveBeenCalled();
  });

  it('refunds the credit when the provider fails', async () => {
    const { service, provider, entitlements } = buildHarness();
    (provider.generateResponse as jest.Mock).mockRejectedValue(new Error('provider down'));
    await expect(service.chat(freeUser, 'Pytanie')).rejects.toThrow('provider down');
    expect(entitlements.refundAiMessage).toHaveBeenCalledWith('user-1');
  });
});
