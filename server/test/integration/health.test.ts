import { describe, expect, it } from 'vitest';

import { _resetReadinessForTests } from '../../src/routes/health.js';
import { api, bodyOf } from '../helpers.js';

describe('health endpoints', () => {
  it('GET /health answers statically with uptime', async () => {
    const res = await api().get('/health');
    expect(res.status).toBe(200);
    const body = bodyOf<{ status: string; uptime: number }>(res);
    expect(body.status).toBe('ok');
    expect(body.uptime).toBeGreaterThan(0);
  });

  it('GET /health/ready verifies the database and reports ready', async () => {
    _resetReadinessForTests();
    const res = await api().get('/health/ready');
    expect(res.status).toBe(200);
    expect(bodyOf<{ status: string }>(res).status).toBe('ready');
    // Second probe answers from the verified-at-boot flag (still ready).
    const second = await api().get('/health/ready');
    expect(second.status).toBe(200);
  });

  it('GET /ready answers the same readiness check', async () => {
    _resetReadinessForTests();
    const res = await api().get('/ready');
    expect(res.status).toBe(200);
    expect(bodyOf<{ status: string }>(res).status).toBe('ready');
  });

  it('GET /health/db performs a live database check', async () => {
    const res = await api().get('/health/db');
    expect(res.status).toBe(200);
    expect(bodyOf<{ database: string }>(res).database).toBe('up');
  });
});

describe('request correlation', () => {
  it('echoes a well-formed inbound X-Request-Id', async () => {
    const res = await api().get('/health').set('X-Request-Id', 'trace-abc-123');
    expect(res.headers['x-request-id']).toBe('trace-abc-123');
  });

  it('generates an id when none is provided', async () => {
    const res = await api().get('/health');
    expect(res.headers['x-request-id']).toBeTruthy();
  });

  it('replaces a malformed inbound id (attacker-controllable log content)', async () => {
    const res = await api().get('/health').set('X-Request-Id', 'bad id with spaces!!');
    expect(res.headers['x-request-id']).not.toContain('bad id');
    expect(res.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('stamps errorId and requestId on error responses (unknown route)', async () => {
    const res = await api().get('/api/v1/definitely-not-a-route');
    expect(res.status).toBe(404);
    const body = bodyOf<{ errorId: string; requestId: string; status: string }>(res);
    expect(body.status).toBe('error');
    expect(body.errorId).toMatch(/^err_/);
    expect(body.requestId).toBe(res.headers['x-request-id']);
  });
});
