import { Router } from 'express';
import type { Container } from '../container';
import { requireAuth } from '../middlewares/auth.middleware';
import { revokeGrant } from '../oidc/grants';

// `provider` is the oidc-provider instance, used to revoke the live grant.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildConnectionRoutes(container: Container, provider?: any): Router {
  const router = Router();
  router.use(requireAuth);

  router.get('/', container.rateLimit('apiRead'), container.accountController.connections);

  router.delete('/:clientId', container.rateLimit('vaultWrite'), async (req, res, next) => {
    try {
      const grantId = await container.accountService.revokeConnection(
        req.userId!,
        String(req.params.clientId),
      );
      if (provider && grantId) {
        await revokeGrant(provider, grantId);
      }
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  });

  return router;
}
