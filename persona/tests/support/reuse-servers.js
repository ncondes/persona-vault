// Gives each Express app one long-lived listening server, instead of letting
// supertest open and close a fresh ephemeral one for every single request.
//
// Why this exists: supertest's default is `app.listen(0)` per request, closed
// when the response arrives. An integration run makes many hundreds of
// requests, so the operating system recycles the same ephemeral ports over and
// over, and a request can reach a server that is mid-close — or one that has
// just been bound by a different app. The result was a flaky suite: roughly
// three runs in twenty failed, never the same test twice, with the failure
// showing up as an unexplained 404 (from a server that was not ours: no
// `x-powered-by`, no Express error page) or as a five-second timeout.
//
// Measured: ~15% of runs failed before this, 1 in 60 after.
//
// Ruled out first, each by experiment: email collisions, concurrency between
// files, shared process state, HTTP keep-alive, `oidc_payload` table bloat,
// Postgres connection limits, and the Docker services on neighbouring ports.
// See tasks/draft-report/evidence.md for the full trail.
const supertest = require('supertest');

// Keyed on the app so each test file's app gets exactly one server, and so a
// garbage-collected app does not pin it.
const servers = new WeakMap();
const open = new Set();

function listening(app) {
  // Supertest also accepts a URL string or an already-listening server; leave
  // those exactly as they are.
  if (typeof app !== 'function') return app;

  if (!servers.has(app)) {
    const server = app.listen(0);
    // Nothing should wait on these at exit; the run owns their lifetime.
    server.unref();
    servers.set(app, server);
    open.add(server);
  }
  return servers.get(app);
}

const patched = function (app) {
  return supertest(listening(app));
};

patched.agent = function (app, options) {
  return supertest.agent(listening(app), options);
};

// Keep the rest of supertest's surface (Test, agent internals, etc.) reachable.
Object.setPrototypeOf(patched, supertest);

require.cache[require.resolve('supertest')].exports = patched;

// Belt and braces: close what we opened, so a run without `forceExit` still
// ends on its own.
afterAll(() => {
  for (const server of open) server.close();
  open.clear();
});
