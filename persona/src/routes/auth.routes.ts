import { Router } from 'express';
import { config } from '../config/config';
import type { Container } from '../container';
import {
  devLoginSchema,
  loginSchema,
  registerSchema,
  resendSchema,
  verifySchema,
} from '../dtos/auth.dto';
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

  // Hands back a login code for an address, so the flow works without a
  // reachable inbox — the seeded demo users are @example.com, which no mail
  // provider will deliver to. This is a way past the password, so it is mounted
  // only when asked for by name, and the controller serves only the addresses on
  // the demo list. Local development leaves it on; anywhere else has to choose.
  if (!config.isProd || config.demoLogin) {
    router.post('/dev/login', validateBody(devLoginSchema), auth.devLogin);
  }

  return router;
}
