import { Router } from 'express';
import type { Container } from '../container';
import { buildAuthRoutes } from './auth.routes';
import { buildHealthRoutes } from './health.routes';

// Registers every /api route group.
export function buildRoutes(container: Container): Router {
  const router = Router();
  router.use('/health', buildHealthRoutes(container));
  router.use('/auth', buildAuthRoutes(container));
  return router;
}
