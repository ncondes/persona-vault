import { Router } from 'express';
import type { Container } from '../container';
import { updateProfileSchema } from '../dtos/profile.dto';
import { requireAuth } from '../middlewares/auth.middleware';
import { validateBody } from '../middlewares/validate.middleware';

export function buildProfileRoutes(container: Container): Router {
  const router = Router();
  const profile = container.profileController;

  router.use(requireAuth); // every profile route requires a logged-in user

  router.get('/', profile.get);
  router.put('/', validateBody(updateProfileSchema), profile.update);

  return router;
}
