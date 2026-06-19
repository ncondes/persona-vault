import request from 'supertest';
import { buildContainer } from '../src/container';
import { buildApp } from '../src/server';

describe('GET /api/health', () => {
  it('returns 200 with status ok', async () => {
    const app = buildApp(buildContainer());

    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });
});
