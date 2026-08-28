import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { UserRole } from '@prisma/client';

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: UserRole;
}

/**
 * Injects the authenticated user, or `null` on `@OptionalAuth()` routes when the
 * request is anonymous.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser | null => {
    const request = ctx.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
    return request.user ?? null;
  },
);
