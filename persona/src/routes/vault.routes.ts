import { Router } from 'express';
import type { Container } from '../container';
import { createVaultItemSchema, updateVaultItemSchema } from '../dtos/vault.dto';
import { requireAuth } from '../middlewares/auth.middleware';
import { validateBody } from '../middlewares/validate.middleware';

export function buildVaultRoutes(container: Container): Router {
  const router = Router();
  const vault = container.vaultController;

  router.use(requireAuth); // every vault route requires a logged-in user

  router.get('/', vault.list);
  router.post('/items', validateBody(createVaultItemSchema), vault.create);
  router.put('/items/:id', validateBody(updateVaultItemSchema), vault.update);
  router.delete('/items/:id', vault.remove);

  return router;
}
