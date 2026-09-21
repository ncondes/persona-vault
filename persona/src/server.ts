import cookieParser from 'cookie-parser';
import express, { Express } from 'express';
import { config } from './config/config';
import { requestLogger } from './middlewares/requestLogger.middleware';
import { errorHandler } from './middlewares/error.middleware';
import { buildInteractionRoutes } from './oidc/interactions';
import { buildRoutes } from './routes';
import type { Container } from './container';

// Builds the Express app from a wired container. No network side effects, so it
// can be imported directly in tests. When an OIDC provider is supplied, it is
// mounted at /oidc (before the body parsers, so it parses its own bodies) and
// its login/consent screens are served at /interaction.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildApp(container: Container, provider?: any): Express {
  const app = express();

  // Zero by default, so req.ip is the socket address and nothing is taken on
  // trust. Behind the web app's rewrites it has to be told how many hops to
  // skip, or every request appears to come from the proxy. See config.ts for
  // why only the public-read limit relies on the answer.
  if (config.trustProxyHops > 0) {
    app.set('trust proxy', config.trustProxyHops);
  }

  app.use(requestLogger);

  if (provider) {
    // Limits go in front of the provider rather than inside it. Each path gets
    // the key it can actually produce without a database read: the token
    // endpoint has client_secret_basic in its Authorization header, authorize
    // has client_id in the query string, and userinfo has a bearer token that
    // is already per client per user. Order matters — Express runs the first
    // match, so these have to be mounted before the catch-all below.
    app.use('/oidc/token', container.rateLimit('oidcToken'));
    app.use('/oidc/auth', container.rateLimit('oidcAuthorize'));
    app.use('/oidc/me', container.rateLimit('oidcUserinfo'));
    app.use('/oidc/jwks', container.rateLimit('publicRead'));
    app.use('/oidc/.well-known', container.rateLimit('publicRead'));
    app.use('/oidc', provider.callback());
  }

  app.use(express.json());
  app.use(cookieParser());

  if (provider) {
    app.use('/interaction', buildInteractionRoutes(provider, container));
  }

  // The user interface lives in the Next app; this origin only serves the API,
  // the OIDC endpoints and the interaction pages.
  app.get('/', (_req, res) => {
    if (config.webUrl) {
      res.redirect(config.webUrl);
      return;
    }
    res.json({ data: { name: 'persona', status: 'ok' } });
  });

  app.use('/api', buildRoutes(container, provider));

  app.use(errorHandler);

  return app;
}
