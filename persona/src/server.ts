import cookieParser from 'cookie-parser';
import express, { Express } from 'express';
import { requestLogger } from './middlewares/requestLogger.middleware';
import { errorHandler } from './middlewares/error.middleware';
import { buildRoutes } from './routes';
import type { Container } from './container';

// Builds the Express app from a wired container. No network side effects,
// so it can be imported directly in tests.
export function buildApp(container: Container): Express {
  const app = express();

  app.use(requestLogger);
  app.use(express.json());
  app.use(cookieParser());

  app.use('/api', buildRoutes(container));

  app.use(errorHandler);

  return app;
}
