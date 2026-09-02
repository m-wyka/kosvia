import type { ApiErrorBody } from '@kosvia/shared';

const errorBody = (caught: unknown): ApiErrorBody | null => {
  if (caught && typeof caught === 'object' && 'data' in caught) {
    const data = (caught as { data?: unknown }).data;
    if (data && typeof data === 'object') {
      return data as ApiErrorBody;
    }
  }
  return null;
};

export const apiErrorCode = (caught: unknown): string | null => errorBody(caught)?.code ?? null;

export const apiErrorLimit = (caught: unknown): number | null => errorBody(caught)?.limit ?? null;
