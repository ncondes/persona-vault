import { Router } from 'express';
import type { Container } from '../container';

export function buildHealthRoutes(container: Container): Router {
  const router = Router();
  router.get('/', (req, res) => container.healthController.check(req, res));
  return router;
}
