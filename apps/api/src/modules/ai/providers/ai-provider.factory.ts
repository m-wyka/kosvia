import { Logger, type Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AI_PROVIDER, type AIProvider } from './ai-provider.interface';
import { MockAIProvider } from './mock-ai.provider';
import { AnthropicAIProvider } from './anthropic-ai.provider';

/**
 * Chooses the provider at boot. Switching model vendors later means adding a
 * class here — nothing above this line changes.
 */
export const aiProviderFactory: Provider = {
  provide: AI_PROVIDER,
  inject: [ConfigService],
  useFactory: (config: ConfigService): AIProvider => {
    const logger = new Logger('AIProvider');
    const provider = config.get<string>('ai.provider', 'mock');
    const apiKey = config.get<string | null>('ai.apiKey', null);
    const model = config.get<string>('ai.model', 'claude-opus-5');

    if (provider === 'anthropic') {
      if (!apiKey) {
        logger.warn('AI_PROVIDER=anthropic but AI_API_KEY is empty — using the offline provider.');
        return new MockAIProvider();
      }
      logger.log(`Using Claude (${model}) for natural-language answers.`);
      return new AnthropicAIProvider(apiKey, model);
    }

    logger.log('Using the offline deterministic AI provider (set AI_PROVIDER=anthropic to change).');
    return new MockAIProvider();
  },
};
