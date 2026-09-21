import { Router } from 'express';
import type { Container } from '../container';
import { updateSettingsSchema } from '../dtos/settings.dto';
import { requireAuth } from '../middlewares/auth.middleware';
import { validateBody } from '../middlewares/validate.middleware';

export function buildSettingsRoutes(container: Container): Router {
  const router = Router();
  const account = container.accountController;
  const limit = container.rateLimit;

  router.use(requireAuth);

  router.get('/', limit('apiRead'), account.settings);
  router.put('/', limit('vaultWrite'), validateBody(updateSettingsSchema), account.updateSettings);

  return router;
}
