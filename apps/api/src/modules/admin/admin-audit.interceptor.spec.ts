import { lastValueFrom, of } from 'rxjs';
import type { CallHandler, ExecutionContext } from '@nestjs/common';
import type { PrismaService } from '../../common/prisma/prisma.service';
import { AdminAuditInterceptor } from './admin-audit.interceptor';

const contextFor = (request: Record<string, unknown>): ExecutionContext =>
  ({
    switchToHttp: () => ({ getRequest: () => request }),
  }) as unknown as ExecutionContext;

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('AdminAuditInterceptor', () => {
  const build = () => {
    const create = jest.fn().mockResolvedValue(undefined);
    const interceptor = new AdminAuditInterceptor({
      auditLog: { create },
    } as unknown as PrismaService);
    return { interceptor, create };
  };
  const next: CallHandler = { handle: () => of({ id: 'created-1' }) };

  it('records entity, action, actor and a redacted body for mutating requests', async () => {
    const { interceptor, create } = build();
    await lastValueFrom(
      interceptor.intercept(
        contextFor({
          method: 'PUT',
          path: '/admin/products/p1/ingredients/label',
          params: { id: 'p1' },
          body: { rawLabel: 'Aqua', password: 'secret', nested: { token: 'x', keep: 1 } },
          user: { id: 'admin-1' },
        }),
        next,
      ),
    );
    await flush();
    expect(create).toHaveBeenCalledWith({
      data: {
        actorId: 'admin-1',
        action: 'products.label',
        entity: 'products',
        entityId: 'p1',
        diff: { rawLabel: 'Aqua', nested: { keep: 1 } },
      },
    });
  });

  it('uses the verb and the created id when there is no id in the path', async () => {
    const { interceptor, create } = build();
    await lastValueFrom(
      interceptor.intercept(
        contextFor({ method: 'POST', path: '/admin/brands', params: {}, body: { name: 'X' } }),
        next,
      ),
    );
    await flush();
    expect(create.mock.calls[0][0].data).toMatchObject({
      action: 'brands.create',
      entityId: 'created-1',
      actorId: null,
    });
  });

  it('ignores reads', async () => {
    const { interceptor, create } = build();
    await lastValueFrom(
      interceptor.intercept(contextFor({ method: 'GET', path: '/admin/brands', params: {} }), next),
    );
    await flush();
    expect(create).not.toHaveBeenCalled();
  });
});
