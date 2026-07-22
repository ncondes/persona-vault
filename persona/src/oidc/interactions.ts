import { Request, RequestHandler, Response, Router, urlencoded } from 'express';
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

// Wraps an interaction handler so a stale/expired interaction (oidc-provider
// throws SessionNotFound) shows a friendly page instead of crashing.
function interactionHandler(fn: (req: Request, res: Response) => Promise<unknown>): RequestHandler {
  return async (req, res, next) => {
    try {
      await fn(req, res);
    } catch (err) {
      if (err instanceof Error && err.name === 'SessionNotFound') {
        res.status(400).send(renderExpired());
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

  // Show the right screen for the current interaction.
  router.get(
    '/:uid',
    interactionHandler(async (req, res) => {
      const details = await provider.interactionDetails(req, res);
      const { prompt, params, uid } = details;

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
            return provider.interactionFinished(
              req,
              res,
              { login: { accountId: userId } },
              { mergeWithLastSubmission: false },
            );
          }
        }
        return res.send(renderLogin(uid));
      }

      if (prompt.name === 'consent') {
        return res.send(renderConsent(uid, String(params.client_id), String(params.scope ?? '')));
      }

      return res.status(400).send('Unsupported interaction');
    }),
  );

  // Authenticate the user and complete the login interaction.
  router.post(
    '/:uid/login',
    form,
    interactionHandler(async (req, res) => {
      let user;
      try {
        user = await container.authService.login(req.body.email, req.body.password);
      } catch {
        return res.status(401).send(renderLogin(String(req.params.uid), 'Invalid email or password'));
      }
      res.cookie('token', signAuthToken(user.id), cookieOptions);
      return provider.interactionFinished(
        req,
        res,
        { login: { accountId: user.id } },
        { mergeWithLastSubmission: false },
      );
    }),
  );

  // Grant the requested scopes and complete the consent interaction.
  router.post(
    '/:uid/confirm',
    form,
    interactionHandler(async (req, res) => {
      const details = await provider.interactionDetails(req, res);
      const { params, session } = details;

      const grant = new provider.Grant({
        accountId: session.accountId,
        clientId: String(params.client_id),
      });
      grant.addOIDCScope(String(params.scope ?? ''));
      const grantId = await grant.save();

      // Record the connection so the user can review and revoke it later.
      // Per-field selections arrive with the interaction API; empty means the
      // vault defaults apply.
      await container.repositories.consents.record({
        userId: session.accountId,
        clientId: String(params.client_id),
        scopes: String(params.scope ?? '')
          .split(' ')
          .filter(Boolean),
        selections: [],
        grantId,
      });

      return provider.interactionFinished(
        req,
        res,
        { consent: { grantId } },
        { mergeWithLastSubmission: true },
      );
    }),
  );

  // The user declined.
  router.post(
    '/:uid/abort',
    interactionHandler(async (req, res) => {
      return provider.interactionFinished(
        req,
        res,
        { error: 'access_denied', error_description: 'User denied the request' },
        { mergeWithLastSubmission: false },
      );
    }),
  );

  return router;
}
