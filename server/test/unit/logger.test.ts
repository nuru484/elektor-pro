import pino from 'pino';
import { describe, expect, it } from 'vitest';

import { loggerOptions } from '../../src/utils/logger.js';

const capture = () => {
  const lines: string[] = [];
  const log = pino(
    { ...loggerOptions, level: 'info' },
    { write: (line: string) => lines.push(line) },
  );
  return { last: () => JSON.parse(lines[lines.length - 1]) as Record<string, unknown>, log };
};

describe('logger redaction', () => {
  it('masks credential fields at any depth', () => {
    const { last, log } = capture();
    log.info({
      body: {
        confirmPassword: 'p',
        currentPassword: 'p',
        newPassword: 'p',
        password: 'p',
        temporaryPassword: 'p',
        user: { profile: { totpSecret: 's' }, token: 't' },
      },
      email: 'a@b.com',
    }, 'login');
    const body = last().body as Record<string, unknown>;
    expect(body.password).toBe('[REDACTED]');
    expect(body.newPassword).toBe('[REDACTED]');
    expect(body.currentPassword).toBe('[REDACTED]');
    expect(body.confirmPassword).toBe('[REDACTED]');
    expect(body.temporaryPassword).toBe('[REDACTED]');
    const user = body.user as Record<string, unknown>;
    expect(user.token).toBe('[REDACTED]');
    expect((user.profile as Record<string, unknown>).totpSecret).toBe('[REDACTED]');
    expect(last().email).toBe('a@b.com');
  });

  it('masks tokens, secrets, one-time codes and contact identifiers', () => {
    const { last, log } = capture();
    log.info({
      query: {
        accessToken: 'a',
        code: '123456',
        otp: '999999',
        phone: '+233200000001',
        phoneNumber: '+233200000001',
        refreshToken: 'r',
        secret: 's',
        token: 't',
        voterId: 'V-1',
      },
    }, 'query');
    const query = last().query as Record<string, unknown>;
    for (const key of Object.keys(query)) expect(query[key], key).toBe('[REDACTED]');
  });

  it('masks request and response auth headers', () => {
    const { last, log } = capture();
    log.info({
      req: { headers: { authorization: 'Bearer x', cookie: 'rt=y', host: 'api' } },
      res: { headers: { 'set-cookie': ['rt=z'] } },
    }, 'request');
    const req = last().req as { headers: Record<string, unknown> };
    const res = last().res as { headers: Record<string, unknown> };
    expect(req.headers.authorization).toBe('[REDACTED]');
    expect(req.headers.cookie).toBe('[REDACTED]');
    expect(req.headers.host).toBe('api');
    expect(res.headers['set-cookie']).toBe('[REDACTED]');
  });
});
