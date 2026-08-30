import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { AnswerLocale } from '../i18n/phrases';

const DEFAULT_LOCALE: AnswerLocale = 'pl';

export const parseLocale = (acceptLanguage: string | undefined): AnswerLocale => {
  const primary = acceptLanguage?.split(',')[0]?.trim().toLowerCase() ?? '';
  return primary.startsWith('en') ? 'en' : DEFAULT_LOCALE;
};

/**
 * The reader's language, from `Accept-Language`. The web app sends its active
 * locale on every call; anything else falls back to Polish, the default locale.
 */
export const RequestLocale = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest<{ headers: Record<string, string | undefined> }>();
  return parseLocale(request.headers['accept-language']);
});
