import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Error as MongooseError } from 'mongoose';
import { MongoServerError } from 'mongodb';
import { FastifyReply, FastifyRequest } from 'fastify';

/**
 * Global catch-all filter. It is the single place that holds both the request
 * and the exception, so it owns all error logging (4xx `warn`, 5xx `error`
 * with stack) and preserves the Mongoose data-error mappings that previously
 * lived in `MongooseExceptionFilter`. Client-facing responses are unchanged.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exceptions');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<FastifyRequest & { user?: { id?: string } }>();
    const reply = ctx.getResponse<FastifyReply>();

    const { status, body, message, stack } = this.resolve(exception);

    const user = req.user?.id ?? 'anon';
    const line = `${req.method} ${req.url} ${status} user=${user} - ${message}`;

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(line, stack);
    } else {
      this.logger.warn(line);
    }

    reply.code(status).send(body);
  }

  /**
   * Derive the HTTP status, client response body, and log message for any
   * thrown value, preserving prior client-facing behaviour.
   */
  private resolve(exception: unknown): {
    status: number;
    body: unknown;
    message: string;
    stack?: string;
  } {
    // Mongoose CastError → 400 Invalid id format (unchanged behaviour)
    if (exception instanceof MongooseError.CastError) {
      const status = HttpStatus.BAD_REQUEST;
      return {
        status,
        body: { statusCode: status, message: 'Invalid id format' },
        message: 'Invalid id format',
        stack: exception.stack,
      };
    }

    // Duplicate-key MongoServerError (code 11000) → 409 (unchanged behaviour)
    if (exception instanceof MongoServerError && exception.code === 11000) {
      const status = HttpStatus.CONFLICT;
      return {
        status,
        body: { statusCode: status, message: 'Duplicate key conflict' },
        message: 'Duplicate key conflict',
        stack: exception.stack,
      };
    }

    // HttpException → derive status/body the way Nest would
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      return {
        status,
        body,
        message: this.extractMessage(body, exception.message),
        stack: exception.stack,
      };
    }

    // Anything else → generic 500
    const status = HttpStatus.INTERNAL_SERVER_ERROR;
    const err = exception instanceof Error ? exception : undefined;
    return {
      status,
      body: { statusCode: status, message: 'Internal server error' },
      message: err?.message ?? 'Internal server error',
      stack: err?.stack,
    };
  }

  /**
   * Normalize an HttpException response body into a log message. Nest bodies
   * are typically `{ statusCode, message, error }` where `message` is a string
   * or a `string[]` (class-validator field errors); a plain string body is
   * also possible. Fall back to the exception message for any other shape.
   */
  private extractMessage(body: unknown, fallback: string): string {
    if (typeof body === 'string') return body;
    if (body && typeof body === 'object' && 'message' in body) {
      const msg = (body as { message: unknown }).message;
      if (Array.isArray(msg)) return msg.join('; ');
      if (typeof msg === 'string') return msg;
    }
    return fallback;
  }
}
