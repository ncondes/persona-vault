import { Request, RequestHandler, Response, Router, json, urlencoded } from 'express';
import { config } from '../config/config';
import type { Container } from '../container';
import { signAuthToken, verifyAuthToken } from '../infrastructure/auth/token';
import { renderConsent, renderExpired, renderLogin } from './views';

const cookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: config.isProd,
  path: '/',
  maxAge: 1000 * 60 * 60 * 24 * 7,
};

// The interaction endpoints serve two callers: the frontend consent app
// (JSON, chosen via the Accept header) and plain HTML forms as a fallback.
function wantsJson(req: Request): boolean {
  return Boolean(req.headers.accept?.includes('application/json'));
}

// Wraps an interaction handler so a stale/expired interaction (oidc-provider
// throws SessionNotFound) gets a friendly response instead of crashing.
function interactionHandler(fn: (req: Request, res: Response) => Promise<unknown>): RequestHandler {
  return async (req, res, next) => {
    try {
      await fn(req, res);
    } catch (err) {
      if (err instanceof Error && err.name === 'SessionNotFound') {
        if (wantsJson(req)) {
          res.status(410).json({
            error: { code: 'INTERACTION_EXPIRED', message: 'This request has expired' },
          });
        } else {
          res.status(400).send(renderExpired());
        }
        return;
      }
      next(err);
    }
  };
}

// Routes that drive the OIDC interactions (login + consent). `provider` is the
// oidc-provider instance (ESM type, kept loose at this integration boundary).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildInteractionRoutes(provider: any, container: Container): Router {
  const router = Router();
  const form = urlencoded({ extended: false });
  const body = [json(), form];

  // Completes an interaction step and sends the resume URL back the way the
  // caller expects: JSON for the frontend, a redirect for HTML forms.
  async function finish(
    req: Request,
    res: Response,
    result: unknown,
    mergeWithLastSubmission: boolean,
  ): Promise<void> {
    const redirectTo: string = await provider.interactionResult(req, res, result, {
      mergeWithLastSubmission,
    });
    if (wantsJson(req)) {
      res.json({ redirectTo });
    } else {
      res.redirect(303, redirectTo);
    }
  }

  // Show (or return as JSON) the current interaction step.
  router.get(
    '/:uid',
    interactionHandler(async (req, res) => {
      const details = await provider.interactionDetails(req, res);
      const { prompt, params, session, uid } = details;
      const clientId = String(params.client_id);

      if (prompt.name === 'login') {
        // If the app asked to re-authenticate (prompt=login), always show the
        // login screen so the user can sign in or switch accounts.
        const reasons: string[] = Array.isArray(prompt.reasons) ? prompt.reasons : [];
        const forceLogin =
          reasons.includes('login_prompt') ||
          String(params.prompt ?? '').split(' ').includes('login');

        // Otherwise, if the user is already signed in to Persona, log in silently.
        if (!forceLogin) {
          const token = req.cookies?.token as string | undefined;
          const userId = token ? verifyAuthToken(token) : null;
          if (userId) {
            return finish(req, res, { login: { accountId: userId } }, false);
          }
        }

        if (wantsJson(req)) {
          const client = await container.repositories.clients.findById(clientId);
          return res.json({
            uid,
            prompt: 'login',
            client: client
              ? { id: client.id, name: client.name, purpose: client.purpose }
              : { id: clientId },
          });
        }
        return res.send(renderLogin(uid));
      }

      if (prompt.name === 'consent') {
        const payload = await container.interactionService.consentDetails(
          uid,
          clientId,
          String(params.scope ?? '').split(' ').filter(Boolean),
          session.accountId,
        );
        if (wantsJson(req)) {
          return res.json(payload);
        }
        return res.send(renderConsent(uid, clientId, String(params.scope ?? '')));
      }

      return res.status(400).send('Unsupported interaction');
    }),
  );

  // Authenticate the user and complete the login interaction.
  router.post(
    '/:uid/login',
    body,
    interactionHandler(async (req, res) => {
      let user;
      try {
        user = await container.authService.login(req.body.email, req.body.password);
      } catch {
        if (wantsJson(req)) {
          return res
            .status(401)
            .json({ error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } });
        }
        return res.status(401).send(renderLogin(String(req.params.uid), 'Invalid email or password'));
      }
      res.cookie('token', signAuthToken(user.id), cookieOptions);
      return finish(req, res, { login: { accountId: user.id } }, false);
    }),
  );

  // Apply the user's decision: build the grant from the approved scopes and
  // record which vault values back each one.
  router.post(
    '/:uid/decision',
    body,
    interactionHandler(async (req, res) => {
      const details = await provider.interactionDetails(req, res);
      const { params, session } = details;
      const clientId = String(params.client_id);
      const requestedScopes = String(params.scope ?? '').split(' ').filter(Boolean);

      const decision = await container.interactionService.applyDecision(
        session.accountId,
        clientId,
        requestedScopes,
        req.body ?? {},
      );

      const grant = new provider.Grant({ accountId: session.accountId, clientId });
      grant.addOIDCScope(['openid', ...decision.grantedScopes].join(' '));
      for (const scope of decision.rejectedScopes) {
        grant.rejectOIDCScope(scope);
      }
      const grantId = await grant.save();

      await container.repositories.consents.record({
        userId: session.accountId,
        clientId,
        scopes: decision.grantedScopes,
        selections: decision.selections,
        grantId,
      });
      await container.repositories.audit.record({
        userId: session.accountId,
        clientId,
        type: 'grant',
        context: decision.purpose,
        scopesReleased: decision.grantedScopes,
        fieldsReleased: decision.grantedScopes,
      });

      return finish(req, res, { consent: { grantId } }, true);
    }),
  );

  // The user declined.
  router.post(
    '/:uid/abort',
    body,
    interactionHandler(async (req, res) => {
      return finish(
        req,
        res,
        { error: 'access_denied', error_description: 'User denied the request' },
        false,
      );
    }),
  );

  return router;
}
