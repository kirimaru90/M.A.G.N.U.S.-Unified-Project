import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { FastifyRequest, FastifyReply } from 'fastify';

@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: FastifyRequest['raw'], res: FastifyReply['raw'], next: () => void) {
    const start = Date.now();
    const { method, url } = req;

    res.on('finish', () => {
      const status = res.statusCode;
      // Errors (>= 400) are logged once, with enriched detail, by
      // AllExceptionsFilter. Skip the plain access line here so each error
      // produces exactly one log line.
      if (status >= 400) return;
      const duration = Date.now() - start;
      this.logger.log(`${method} ${url} ${status} ${duration}ms`);
    });

    next();
  }
}
