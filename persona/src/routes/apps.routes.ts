import { Router } from 'express';
import type { Container } from '../container';
import { createAppSchema, previewAppSchema, updateAppSchema } from '../dtos/app.dto';
import { requireAuth } from '../middlewares/auth.middleware';
import { validateBody } from '../middlewares/validate.middleware';
import { revokeGrant } from '../oidc/grants';

// The developer console API. `provider` lets edits and deletions revoke the
// live OIDC grants whose consent they invalidate.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildAppRoutes(container: Container, provider?: any): Router {
  const router = Router();
  const apps = container.appController;

  router.use(requireAuth);

  router.get('/', apps.list);
  router.post('/', validateBody(createAppSchema), apps.create);
  router.post('/preview', validateBody(previewAppSchema), apps.preview);
  router.get('/:id', apps.get);
  router.get('/:id/activity', apps.activity);
  router.post('/:id/secret', apps.rotateSecret);

  router.put('/:id', validateBody(updateAppSchema), async (req, res, next) => {
    try {
      const { app, revokedGrantIds } = await container.clientService.update(
        req.userId!,
        String(req.params.id),
        req.body,
      );
      if (provider) {
        for (const grantId of revokedGrantIds) {
          await revokeGrant(provider, grantId);
        }
      }
      res.json({ data: app });
    } catch (err) {
      next(err);
    }
  });

  router.delete('/:id', async (req, res, next) => {
    try {
      const grantIds = await container.clientService.remove(req.userId!, String(req.params.id));
      if (provider) {
        for (const grantId of grantIds) {
          await revokeGrant(provider, grantId);
        }
      }
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  });

  return router;
}
