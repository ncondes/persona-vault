import cookieParser from 'cookie-parser';
import express, { Express } from 'express';
import { requestLogger } from './middlewares/requestLogger.middleware';
import { errorHandler } from './middlewares/error.middleware';
import { buildInteractionRoutes } from './oidc/interactions';
import { buildRoutes } from './routes';
import { buildWebRoutes } from './routes/web.routes';
import type { Container } from './container';

// Builds the Express app from a wired container. No network side effects, so it
// can be imported directly in tests. When an OIDC provider is supplied, it is
// mounted at /oidc (before the body parsers, so it parses its own bodies) and
// its login/consent screens are served at /interaction.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildApp(container: Container, provider?: any): Express {
  const app = express();

  app.use(requestLogger);

  if (provider) {
    app.use('/oidc', provider.callback());
  }

  app.use(express.json());
  app.use(cookieParser());

  if (provider) {
    app.use('/interaction', buildInteractionRoutes(provider, container));
  }

  app.use(buildWebRoutes(container, provider));
  app.use('/api', buildRoutes(container, provider));

  app.use(errorHandler);

  return app;
}
