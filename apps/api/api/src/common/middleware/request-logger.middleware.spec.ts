import { Logger } from '@nestjs/common';
import { FastifyReply, FastifyRequest } from 'fastify';
import { RequestLoggerMiddleware } from './request-logger.middleware';

/**
 * Drives the middleware and returns the captured `finish` handler so a test
 * can fire it after setting the final status code.
 */
function run(
  middleware: RequestLoggerMiddleware,
  req: Partial<FastifyRequest['raw']>,
) {
  let finish: (() => void) | undefined;
  const res = {
    statusCode: 200,
    on: (event: string, cb: () => void) => {
      if (event === 'finish') finish = cb;
    },
  } as unknown as FastifyReply['raw'];
  const next = jest.fn();

  middleware.use(req as FastifyRequest['raw'], res, next);
  expect(next).toHaveBeenCalledTimes(1);

  return {
    res,
    emitFinish: () => finish?.(),
  };
}

describe('RequestLoggerMiddleware', () => {
  let middleware: RequestLoggerMiddleware;
  let log: jest.SpyInstance;

  beforeEach(() => {
    middleware = new RequestLoggerMiddleware();
    log = jest.spyOn(Logger.prototype, 'log').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('emits an access line for a < 400 response', () => {
    const { res, emitFinish } = run(middleware, {
      method: 'GET',
      url: '/characters',
    });
    res.statusCode = 200;
    emitFinish();

    expect(log).toHaveBeenCalledTimes(1);
    const line = log.mock.calls[0][0] as string;
    expect(line).toContain('GET');
    expect(line).toContain('/characters');
    expect(line).toContain('200');
  });

  it('does not log when the response status is >= 400', () => {
    const { res, emitFinish } = run(middleware, {
      method: 'POST',
      url: '/characters',
    });
    res.statusCode = 400;
    emitFinish();

    expect(log).not.toHaveBeenCalled();
  });
});
