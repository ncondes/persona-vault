import request from 'supertest';
import type { Express } from 'express';

// The root of the API origin. It is not the product — the interface is the Next
// app — so it either hands the browser over or says who it is. Both branches are
// driven by WEB_URL, which `config.ts` reads once at import, so each case
// rebuilds the module graph with the value it needs.
function appWith(webUrl: string): Express {
  let app!: Express;
  const previous = process.env.WEB_URL;
  process.env.WEB_URL = webUrl;

  jest.isolateModules(() => {
    const { buildContainer } = require('../src/container');
    const { buildApp } = require('../src/server');
    app = buildApp(buildContainer());
  });

  process.env.WEB_URL = previous;
  return app;
}

describe('GET /', () => {
  it('sends a browser to the web app when one is configured', async () => {
    const res = await request(appWith('http://localhost:4420')).get('/');

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('http://localhost:4420');
  });

  it('identifies itself when the API runs on its own', async () => {
    const res = await request(appWith('')).get('/');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ data: { name: 'persona', status: 'ok' } });
  });

  it('does not mount the interaction routes without a provider', async () => {
    const res = await request(appWith('')).get('/interaction/anything');
    expect(res.status).toBe(404);
  });

  it('answers an unknown path with 404 rather than the root payload', async () => {
    const res = await request(appWith('')).get('/not-a-route');
    expect(res.status).toBe(404);
  });
});
