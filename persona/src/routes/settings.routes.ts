import { Router } from 'express';
import type { Container } from '../container';
import { updateSettingsSchema } from '../dtos/settings.dto';
import { requireAuth } from '../middlewares/auth.middleware';
import { validateBody } from '../middlewares/validate.middleware';

export function buildSettingsRoutes(container: Container): Router {
  const router = Router();
  const account = container.accountController;

  router.use(requireAuth);

  router.get('/', account.settings);
  router.put('/', validateBody(updateSettingsSchema), account.updateSettings);

  return router;
}
