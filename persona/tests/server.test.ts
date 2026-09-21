import request from 'supertest';
import type { Express } from 'express';

// The root of the API origin. It is not the product — the interface is the Next
// app — so it either hands the browser over or says who it is. Both branches are
// driven by WEB_URL, which `config.ts` reads once at import, so each case
// rebuilds the module graph with the value it needs.
function rebuild(env: Record<string, string>): Express {
  let app!: Express;
  const previous = Object.fromEntries(Object.keys(env).map((k) => [k, process.env[k]]));
  Object.assign(process.env, env);

  jest.isolateModules(() => {
    const { buildContainer } = require('../src/container');
    const { buildApp } = require('../src/server');
    app = buildApp(buildContainer());
  });

  for (const [key, value] of Object.entries(previous)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  return app;
}

function appWith(webUrl: string): Express {
  return rebuild({ WEB_URL: webUrl });
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

// The API has no public domain: it answers through the web app's rewrites, so
// without being told how many hops to skip, every caller looks like the proxy
// and the one IP-keyed limit becomes a single shared bucket.
describe('trust proxy', () => {
  function setting(app: Express): unknown {
    return (app as unknown as { settings: Record<string, unknown> }).settings['trust proxy'];
  }

  // Express's default is already false; the point of asserting it is that a
  // missing or zero hop count must never quietly start trusting a header.
  it('trusts nothing unless a hop count is given', () => {
    expect(setting(rebuild({ WEB_URL: '', TRUST_PROXY_HOPS: '0' }))).toBe(false);
  });

  it('takes the hop count from the environment', () => {
    expect(setting(rebuild({ WEB_URL: '', TRUST_PROXY_HOPS: '2' }))).toBe(2);
  });
});
