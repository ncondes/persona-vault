import { Router } from 'express';
import type { Container } from '../container';
import { requireAuth } from '../middlewares/auth.middleware';
import { buildAccountRoutes } from './account.routes';
import { buildAppRoutes } from './apps.routes';
import { buildAuditRoutes } from './audit.routes';
import { buildAuthRoutes } from './auth.routes';
import { buildCatalogRoutes } from './catalog.routes';
import { buildConnectionRoutes } from './connections.routes';
import { buildHealthRoutes } from './health.routes';
import { buildSettingsRoutes } from './settings.routes';
import { buildVaultRoutes } from './vault.routes';

// Registers every /api route group. `provider` (when present) lets the
// connections routes revoke live OIDC grants.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildRoutes(container: Container, provider?: any): Router {
  const router = Router();
  router.use('/health', buildHealthRoutes(container));
  router.use('/auth', buildAuthRoutes(container));
  router.use('/vault', buildVaultRoutes(container));
  router.use('/catalog', buildCatalogRoutes());
  router.use('/audit', buildAuditRoutes(container));
  router.use('/connections', buildConnectionRoutes(container, provider));
  router.use('/settings', buildSettingsRoutes(container));
  router.use('/account', buildAccountRoutes(container, provider));
  router.use('/apps', buildAppRoutes(container, provider));

  // GET /api/export downloads everything Persona holds about the user.
  router.get('/export', requireAuth, container.accountController.exportData);
  return router;
}
