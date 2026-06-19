import { Router } from 'express';
import type { Container } from '../container';
import { buildAuthRoutes } from './auth.routes';
import { buildHealthRoutes } from './health.routes';
import { buildProfileRoutes } from './profile.routes';

// Registers every /api route group.
export function buildRoutes(container: Container): Router {
  const router = Router();
  router.use('/health', buildHealthRoutes(container));
  router.use('/auth', buildAuthRoutes(container));
  router.use('/profile', buildProfileRoutes(container));
  return router;
}
