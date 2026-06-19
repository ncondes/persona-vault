import cookieParser from 'cookie-parser';
import express, { Express, RequestHandler } from 'express';
import { requestLogger } from './middlewares/requestLogger.middleware';
import { errorHandler } from './middlewares/error.middleware';
import { buildRoutes } from './routes';
import type { Container } from './container';

// Builds the Express app from a wired container. No network side effects,
// so it can be imported directly in tests. The optional OIDC handler is mounted
// before the body parsers so the provider can parse its own request bodies.
export function buildApp(container: Container, oidcHandler?: RequestHandler): Express {
  const app = express();

  app.use(requestLogger);

  if (oidcHandler) {
    app.use('/oidc', oidcHandler);
  }

  app.use(express.json());
  app.use(cookieParser());

  app.use('/api', buildRoutes(container));

  app.use(errorHandler);

  return app;
}
