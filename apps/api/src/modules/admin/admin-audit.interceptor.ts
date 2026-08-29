import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { Request } from 'express';
import { Observable, tap } from 'rxjs';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../common/prisma/prisma.service';

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const ACTION_BY_METHOD: Record<string, string> = {
  POST: 'create',
  PUT: 'update',
  PATCH: 'update',
  DELETE: 'delete',
};
/** Keys that must never land in an audit row. */
const SECRET_KEYS = new Set(['password', 'passwordHash', 'token', 'refreshToken']);

/**
 * Records every mutating admin request as `entity.action` with the actor,
 * the target id and the validated body. Writes happen after the handler
 * succeeds and never fail the request — a lost audit row is logged, a
 * failed product save because of the audit table is not acceptable.
 */
@Injectable()
export class AdminAuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AdminAuditInterceptor.name);

  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    if (!MUTATING_METHODS.has(request.method)) {
      return next.handle();
    }
    return next.handle().pipe(
      tap((result: unknown) => {
        void this.record(request, result);
      }),
    );
  }

  private async record(
    request: Request & { user?: AuthenticatedUser },
    result: unknown,
  ): Promise<void> {
    const { entity, action, entityId } = describe(request, result);
    try {
      await this.prisma.auditLog.create({
        data: {
          actorId: request.user?.id ?? null,
          action: `${entity}.${action}`,
          entity,
          entityId,
          diff: redact(request.body) as Prisma.InputJsonValue,
        },
      });
    } catch (error) {
      this.logger.warn(`Audit write failed for ${entity}.${action}: ${String(error)}`);
    }
  }
}

/** `/admin/products/abc/ingredients/label` → entity `products`, action from the tail or the verb. */
const describe = (request: Request, result: unknown) => {
  const segments = request.path.split('/').filter(Boolean);
  const afterAdmin = segments[0] === 'admin' ? segments.slice(1) : segments;
  const entity = afterAdmin[0] ?? 'unknown';
  const id = (request.params as Record<string, string | undefined>).id;
  const tail = afterAdmin.length > 2 ? afterAdmin[afterAdmin.length - 1] : null;
  const action = tail && !id?.startsWith(tail) ? tail : ACTION_BY_METHOD[request.method];
  const resultId =
    result && typeof result === 'object' && typeof (result as { id?: unknown }).id === 'string'
      ? (result as { id: string }).id
      : null;
  return { entity, action, entityId: id ?? resultId };
};

const redact = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(redact);
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([key]) => !SECRET_KEYS.has(key))
        .map(([key, entry]) => [key, redact(entry)]),
    );
  }
  return value ?? null;
};
