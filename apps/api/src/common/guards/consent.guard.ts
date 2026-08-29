import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { ConsentType } from '@prisma/client';
import { CONSENT_REQUIRED_CODE } from '@kosvia/shared';
import { REQUIRED_CONSENT_KEY } from '../decorators/requires-consent.decorator';
import type { AuthenticatedUser } from '../decorators/current-user.decorator';
import { ConsentService } from '../../modules/account/consent.service';

@Injectable()
export class ConsentGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly consents: ConsentService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<ConsentType | undefined>(
      REQUIRED_CONSENT_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required) return true;

    const { user } = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
    if (!user) return true;

    if (!(await this.consents.hasConsent(user.id, required))) {
      throw new ForbiddenException({
        message: 'This feature needs a consent you have not given yet.',
        error: 'Forbidden',
        code: CONSENT_REQUIRED_CODE,
        consent: required,
      });
    }
    return true;
  }
}
