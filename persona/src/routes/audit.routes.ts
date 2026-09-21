import { Router } from 'express';
import type { Container } from '../container';
import { requireAuth } from '../middlewares/auth.middleware';

export function buildAuditRoutes(container: Container): Router {
  const router = Router();
  router.use(requireAuth);
  router.get('/', container.rateLimit('apiRead'), container.accountController.auditHistory);
  return router;
}
