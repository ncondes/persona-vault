import { Router } from 'express';
import type { Container } from '../container';
import { loginSchema, registerSchema, resendSchema, verifySchema } from '../dtos/auth.dto';
import { requireAuth } from '../middlewares/auth.middleware';
import { validateBody } from '../middlewares/validate.middleware';

export function buildAuthRoutes(container: Container): Router {
  const router = Router();
  const auth = container.authController;

  // Both flows are two calls: the first sends a code, the second is where the
  // session cookie is issued.
  router.post('/register', validateBody(registerSchema), auth.register);
  router.post('/register/verify', validateBody(verifySchema), auth.verifyRegistration);
  router.post('/login', validateBody(loginSchema), auth.login);
  router.post('/login/verify', validateBody(verifySchema), auth.verifyLogin);
  router.post('/otp/resend', validateBody(resendSchema), auth.resendCode);
  router.post('/logout', auth.logout);
  router.get('/me', requireAuth, auth.me);

  return router;
}
