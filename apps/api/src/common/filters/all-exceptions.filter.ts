import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';
import type { ApiErrorBody } from '@kosvia/shared';

/**
 * Single error shape for the whole API, so the frontend can render one
 * consistent error state instead of guessing at response bodies.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('HTTP');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Something went wrong on our side.';
    let error = 'Internal Server Error';
    let extras: Pick<ApiErrorBody, 'code' | 'consent'> = {};

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'string') {
        message = body;
      } else if (typeof body === 'object' && body !== null) {
        const shaped = body as {
          message?: string | string[];
          error?: string;
          code?: string;
          consent?: ApiErrorBody['consent'];
        };
        message = shaped.message ?? exception.message;
        error = shaped.error ?? exception.name;
        extras = {
          ...(shaped.code && { code: shaped.code }),
          ...(shaped.consent && { consent: shaped.consent }),
        };
      }
      if (error === 'Internal Server Error') error = exception.name;
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') {
        status = HttpStatus.CONFLICT;
        error = 'Conflict';
        message = 'That record already exists.';
      } else if (exception.code === 'P2025') {
        status = HttpStatus.NOT_FOUND;
        error = 'Not Found';
        message = 'We could not find what you were looking for.';
      } else {
        error = 'Bad Request';
        status = HttpStatus.BAD_REQUEST;
        message = 'The request could not be completed.';
      }
    }

    if (status >= 500) {
      this.logger.error(
        `${request.method} ${request.url} → ${status}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    const body: ApiErrorBody = {
      statusCode: status,
      error,
      message,
      ...extras,
      path: request.url,
      timestamp: new Date().toISOString(),
    };
    response.status(status).json(body);
  }
}
