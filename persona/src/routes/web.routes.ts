import { Router, urlencoded } from 'express';
import type { Container } from '../container';
import { requireWebAuth } from '../middlewares/web-auth.middleware';
import { revokeGrant } from '../oidc/grants';

// Server-rendered Persona pages. `provider` lets the revoke action destroy the
// live OIDC grant.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildWebRoutes(container: Container, provider?: any): Router {
  const router = Router();
  const form = urlencoded({ extended: false });
  const web = container.webController;

  router.get('/', (req, res) => res.redirect(req.cookies?.token ? '/account' : '/login'));
  router.get('/signup', web.showSignup);
  router.post('/signup', form, web.signup);
  router.get('/login', web.showLogin);
  router.post('/login', form, web.login);
  router.post('/logout', web.logout);

  router.get('/account', requireWebAuth, web.account);
  router.post('/account/connections/:clientId/revoke', requireWebAuth, async (req, res, next) => {
    try {
      const grantId = await container.accountService.revokeConnection(
        req.userId!,
        String(req.params.clientId),
      );
      if (provider && grantId) {
        await revokeGrant(provider, grantId);
      }
      res.redirect('/account');
    } catch (err) {
      next(err);
    }
  });

  return router;
}
