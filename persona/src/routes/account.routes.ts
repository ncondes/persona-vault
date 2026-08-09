import { Router } from 'express';
import type { Container } from '../container';
import { AUTH_COOKIE, authCookieOptions } from '../infrastructure/auth/cookie';
import { requireAuth } from '../middlewares/auth.middleware';
import { revokeGrant } from '../oidc/grants';

// Account-level actions: data export and full deletion. `provider` lets the
// delete action revoke every live OIDC grant first.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildAccountRoutes(container: Container, provider?: any): Router {
  const router = Router();
  router.use(requireAuth);

  router.delete('/', async (req, res, next) => {
    try {
      const grantIds = await container.accountService.deleteAccount(req.userId!);
      if (provider) {
        for (const grantId of grantIds) {
          await revokeGrant(provider, grantId);
        }
      }
      res.clearCookie(AUTH_COOKIE, authCookieOptions);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  });

  return router;
}
