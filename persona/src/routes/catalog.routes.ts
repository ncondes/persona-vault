import { Router } from 'express';
import { BLOOD_TYPES, DOCUMENT_TYPES, EPS_PROVIDERS } from '../constants/catalog';
import { KIND_META } from '../constants/vault';

// Public code lists + per-kind metadata, so the frontend can build forms and
// badges without hardcoding them.
export function buildCatalogRoutes(): Router {
  const router = Router();

  router.get('/', (_req, res) => {
    res.json({
      data: {
        documentTypes: DOCUMENT_TYPES,
        bloodTypes: BLOOD_TYPES,
        epsProviders: EPS_PROVIDERS,
        kinds: KIND_META,
      },
    });
  });

  return router;
}
