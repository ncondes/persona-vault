import { Router } from 'express';
import type { Container } from '../container';
import { createVaultItemSchema, updateVaultItemSchema } from '../dtos/vault.dto';
import { requireAuth } from '../middlewares/auth.middleware';
import { validateBody } from '../middlewares/validate.middleware';

export function buildVaultRoutes(container: Container): Router {
  const router = Router();
  const vault = container.vaultController;
  const limit = container.rateLimit;

  router.use(requireAuth); // every vault route requires a logged-in user

  router.get('/', limit('apiRead'), vault.list);
  router.post('/items', limit('vaultWrite'), validateBody(createVaultItemSchema), vault.create);
  router.put('/items/:id', limit('vaultWrite'), validateBody(updateVaultItemSchema), vault.update);
  router.delete('/items/:id', limit('vaultWrite'), vault.remove);

  return router;
}
