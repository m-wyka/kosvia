import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_OPTIONAL_AUTH_KEY, IS_PUBLIC_KEY } from '../decorators/public.decorator';

/**
 * Applied globally. Routes are protected by default — the safer direction — and
 * opt out explicitly with `@Public()` or `@OptionalAuth()`.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets)) return true;
    return super.canActivate(context);
  }

  handleRequest<TUser>(err: unknown, user: TUser, info: unknown, context: ExecutionContext): TUser {
    const optional = this.reflector.getAllAndOverride<boolean>(IS_OPTIONAL_AUTH_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (optional && !user) return null as TUser;
    return super.handleRequest(err, user, info, context);
  }
}
