import express, { Express } from 'express';
import session from 'express-session';
import { config } from './config/config';
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
  app.use(
    session({
      secret: config.sessionSecret,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: config.isProd,
        maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
      },
    }),
  );

  app.use('/api', buildRoutes(container));

  app.use(errorHandler);

  return app;
}
