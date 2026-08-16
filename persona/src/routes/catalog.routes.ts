import { Router } from 'express';
import { config } from '../config/config';
import { BLOOD_TYPES, COUNTRIES, DOCUMENT_TYPES, EPS_PROVIDERS } from '../constants/catalog';
import { KIND_SCOPE, PURPOSES, SCOPE_CATALOG, SCOPE_GROUPS } from '../constants/scopes';
import { KIND_META, VAULT_KINDS } from '../constants/vault';

// Each kind carries the scope it is released under, or null when it cannot be
// shared at all.
const KINDS = Object.fromEntries(
  VAULT_KINDS.map((kind) => [kind, { ...KIND_META[kind], scope: KIND_SCOPE[kind] }]),
);

// Public code lists, per-kind metadata and the scope catalog, so the frontend
// and the developer console can build forms and badges without hardcoding them.
export function buildCatalogRoutes(): Router {
  const router = Router();

  router.get('/', (_req, res) => {
    res.json({
      data: {
        // Already public through the discovery document; the console builds
        // its integration snippets from it.
        issuer: config.oidcIssuer,
        // The sign-in screen offers a way past the emailed code when this copy
        // is a public demo, and says so on the page. Listing the accounts here
        // gives away nothing: the whole point is that anyone may use them.
        demoLogin: config.demoLogin ? { accounts: config.demoLoginEmails } : null,
        documentTypes: DOCUMENT_TYPES,
        bloodTypes: BLOOD_TYPES,
        epsProviders: EPS_PROVIDERS,
        countries: COUNTRIES,
        purposes: PURPOSES,
        scopeGroups: SCOPE_GROUPS,
        scopes: SCOPE_CATALOG,
        kinds: KINDS,
      },
    });
  });

  return router;
}
