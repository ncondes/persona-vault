import { Router } from 'express';
import type { Container } from '../container';
import { loginSchema, registerSchema } from '../dtos/auth.dto';
import { requireAuth } from '../middlewares/auth.middleware';
import { validateBody } from '../middlewares/validate.middleware';

export function buildAuthRoutes(container: Container): Router {
  const router = Router();
  const auth = container.authController;

  router.post('/register', validateBody(registerSchema), auth.register);
  router.post('/login', validateBody(loginSchema), auth.login);
  router.post('/logout', auth.logout);
  router.get('/me', requireAuth, auth.me);

  return router;
}
