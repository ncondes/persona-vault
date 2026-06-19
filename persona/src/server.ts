import express, { Express } from 'express';
import { requestLogger } from './middlewares/requestLogger.middleware';
import { errorHandler } from './middlewares/error.middleware';
import { buildRoutes } from './routes';
import type { Container } from './container';

export function buildApp(container: Container): Express {
  const app = express();

  app.use(requestLogger);
  app.use(express.json());

  app.use('/api', buildRoutes(container));

  app.use(errorHandler);

  return app;
}
