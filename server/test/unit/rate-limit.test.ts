import express from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';

import ENV from '../../src/config/env.js';
import { errorHandler } from '../../src/middlewares/error-handler.js';
import { createRateLimiter } from '../../src/middlewares/rateLimit.js';

const buildApp = () => {
  const app = express();
  app.use(createRateLimiter(60_000, 2, 'limited'));
  app.get('/thing', (_req, res) => {
    res.json({ ok: true });
  });
  app.use(errorHandler);
  return app;
};

const originalSecret = ENV.RATE_LIMIT_BYPASS_SECRET;

describe('rate limiter', () => {
  afterEach(() => {
    ENV.RATE_LIMIT_BYPASS_SECRET = originalSecret;
  });

  it('throttles past the max with a 429 + Retry-After', async () => {
    const app = buildApp();
    await request(app).get('/thing').expect(200);
    await request(app).get('/thing').expect(200);
    const res = await request(app).get('/thing');
    expect(res.status).toBe(429);
    expect(res.headers['retry-after']).toBeDefined();
  });

  it('does NOT honor the bypass header when no secret is configured', async () => {
    ENV.RATE_LIMIT_BYPASS_SECRET = '';
    const app = buildApp();
    await request(app).get('/thing').set('X-Rate-Limit-Bypass', '').expect(200);
    await request(app).get('/thing').set('X-Rate-Limit-Bypass', '').expect(200);
    // An unset secret must never mean "everyone bypasses".
    const res = await request(app).get('/thing').set('X-Rate-Limit-Bypass', '');
    expect(res.status).toBe(429);
  });

  it('honors the bypass header only with the exact configured secret', async () => {
    ENV.RATE_LIMIT_BYPASS_SECRET = 'internal-secret';
    const app = buildApp();
    for (let i = 0; i < 5; i += 1) {
      await request(app)
        .get('/thing')
        .set('X-Rate-Limit-Bypass', 'internal-secret')
        .expect(200);
    }
    // Wrong secret still counts against the limit.
    await request(app).get('/thing').set('X-Rate-Limit-Bypass', 'wrong').expect(200);
    await request(app).get('/thing').set('X-Rate-Limit-Bypass', 'wrong').expect(200);
    const res = await request(app).get('/thing').set('X-Rate-Limit-Bypass', 'wrong');
    expect(res.status).toBe(429);
  });

  it('never throttles health checks', async () => {
    const app = express();
    app.use(createRateLimiter(60_000, 1, 'limited'));
    app.get('/health', (_req, res) => {
      res.json({ status: 'ok' });
    });
    app.use(errorHandler);
    for (let i = 0; i < 4; i += 1) {
      await request(app).get('/health').expect(200);
    }
  });
});
