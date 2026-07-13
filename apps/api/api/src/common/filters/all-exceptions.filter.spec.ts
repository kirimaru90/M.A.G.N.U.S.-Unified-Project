import {
  ArgumentsHost,
  BadRequestException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Error as MongooseError } from 'mongoose';
import { MongoServerError } from 'mongodb';
import { FastifyReply, FastifyRequest } from 'fastify';
import { AllExceptionsFilter } from './all-exceptions.filter';

interface CapturedReply {
  code: jest.Mock;
  send: jest.Mock;
  status?: number;
  body?: unknown;
}

function makeReply(): CapturedReply {
  const reply: CapturedReply = {
    code: jest.fn().mockImplementation((s: number) => {
      reply.status = s;
      return reply;
    }),
    send: jest.fn().mockImplementation((b: unknown) => {
      reply.body = b;
      return reply;
    }),
  };
  return reply;
}

function makeHost(
  reply: CapturedReply,
  req: Partial<FastifyRequest>,
): ArgumentsHost {
  return {
    switchToHttp: () => ({
      getResponse: () => reply as unknown as FastifyReply,
      getRequest: () => req as FastifyRequest,
    }),
  } as unknown as ArgumentsHost;
}

describe('AllExceptionsFilter', () => {
  let filter: AllExceptionsFilter;
  let warn: jest.SpyInstance;
  let error: jest.SpyInstance;

  const authedReq: Partial<FastifyRequest> = {
    method: 'POST',
    url: '/characters',
    user: { id: 'user-1', role: 'admin' },
  } as unknown as Partial<FastifyRequest>;

  beforeEach(() => {
    filter = new AllExceptionsFilter();
    warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    error = jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('logs a 4xx HttpException at warn with method/url/status/message/user', () => {
    const reply = makeReply();
    filter.catch(
      new NotFoundException('Character not found'),
      makeHost(reply, authedReq),
    );

    expect(reply.status).toBe(404);
    expect(error).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledTimes(1);
    const line = warn.mock.calls[0][0] as string;
    expect(line).toContain('POST');
    expect(line).toContain('/characters');
    expect(line).toContain('404');
    expect(line).toContain('user=user-1');
    expect(line).toContain('Character not found');
  });

  it('logs the joined field messages of a validation BadRequestException', () => {
    const reply = makeReply();
    filter.catch(
      new BadRequestException(['name must be a string', 'level must be a number']),
      makeHost(reply, authedReq),
    );

    expect(reply.status).toBe(400);
    expect(warn).toHaveBeenCalledTimes(1);
    const line = warn.mock.calls[0][0] as string;
    expect(line).toContain('name must be a string');
    expect(line).toContain('level must be a number');
  });

  it('responds 500 and logs a raw Error at error including the stack', () => {
    const reply = makeReply();
    const raw = new Error('boom');
    filter.catch(raw, makeHost(reply, authedReq));

    expect(reply.status).toBe(500);
    expect(reply.body).toEqual({
      statusCode: 500,
      message: 'Internal server error',
    });
    expect(warn).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledTimes(1);
    expect(error.mock.calls[0][0]).toContain('boom');
    expect(error.mock.calls[0][1]).toBe(raw.stack);
  });

  it('preserves the CastError → 400 mapping and logs at warn', () => {
    const reply = makeReply();
    const cast = new MongooseError.CastError('ObjectId', 'nope', '_id');
    filter.catch(cast, makeHost(reply, authedReq));

    expect(reply.status).toBe(400);
    expect(reply.body).toEqual({
      statusCode: 400,
      message: 'Invalid id format',
    });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(error).not.toHaveBeenCalled();
  });

  it('preserves the duplicate-key MongoServerError → 409 mapping and logs at warn', () => {
    const reply = makeReply();
    const dup = new MongoServerError({ message: 'E11000 duplicate key' });
    dup.code = 11000;
    filter.catch(dup, makeHost(reply, authedReq));

    expect(reply.status).toBe(409);
    expect(reply.body).toEqual({
      statusCode: 409,
      message: 'Duplicate key conflict',
    });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(error).not.toHaveBeenCalled();
  });

  it('falls back to anon when req.user is absent', () => {
    const reply = makeReply();
    const anonReq: Partial<FastifyRequest> = {
      method: 'GET',
      url: '/characters/x',
    } as unknown as Partial<FastifyRequest>;
    filter.catch(new NotFoundException(), makeHost(reply, anonReq));

    const line = warn.mock.calls[0][0] as string;
    expect(line).toContain('user=anon');
  });

  it('uses req.user.id when present', () => {
    const reply = makeReply();
    filter.catch(new NotFoundException(), makeHost(reply, authedReq));

    const line = warn.mock.calls[0][0] as string;
    expect(line).toContain('user=user-1');
  });
});
