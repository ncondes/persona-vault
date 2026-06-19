import { Router, urlencoded } from 'express';
import { config } from '../config/config';
import type { Container } from '../container';
import { signAuthToken, verifyAuthToken } from '../infrastructure/auth/token';
import { renderConsent, renderLogin } from './views';

const cookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: config.isProd,
  path: '/',
  maxAge: 1000 * 60 * 60 * 24 * 7,
};

// Routes that drive the OIDC interactions (login + consent). `provider` is the
// oidc-provider instance (ESM type, kept loose at this integration boundary).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildInteractionRoutes(provider: any, container: Container): Router {
  const router = Router();
  const form = urlencoded({ extended: false });

  // Show the right screen for the current interaction.
  router.get('/:uid', async (req, res, next) => {
    try {
      const details = await provider.interactionDetails(req, res);
      const { prompt, params, uid } = details;

      if (prompt.name === 'login') {
        // If the user is already signed in to Persona, complete login silently.
        const token = req.cookies?.token as string | undefined;
        const userId = token ? verifyAuthToken(token) : null;
        if (userId) {
          return await provider.interactionFinished(
            req,
            res,
            { login: { accountId: userId } },
            { mergeWithLastSubmission: false },
          );
        }
        return res.send(renderLogin(uid));
      }

      if (prompt.name === 'consent') {
        return res.send(renderConsent(uid, String(params.client_id), String(params.scope ?? '')));
      }

      return res.status(400).send('Unsupported interaction');
    } catch (err) {
      next(err);
    }
  });

  // Authenticate the user and complete the login interaction.
  router.post('/:uid/login', form, async (req, res, next) => {
    try {
      let user;
      try {
        user = await container.authService.login(req.body.email, req.body.password);
      } catch {
        return res.status(401).send(renderLogin(req.params.uid, 'Invalid email or password'));
      }
      res.cookie('token', signAuthToken(user.id), cookieOptions);
      return await provider.interactionFinished(
        req,
        res,
        { login: { accountId: user.id } },
        { mergeWithLastSubmission: false },
      );
    } catch (err) {
      next(err);
    }
  });

  // Grant the requested scopes and complete the consent interaction.
  router.post('/:uid/confirm', form, async (req, res, next) => {
    try {
      const details = await provider.interactionDetails(req, res);
      const { params, session } = details;

      const grant = new provider.Grant({ accountId: session.accountId, clientId: String(params.client_id) });
      grant.addOIDCScope(String(params.scope ?? ''));
      const grantId = await grant.save();

      return await provider.interactionFinished(
        req,
        res,
        { consent: { grantId } },
        { mergeWithLastSubmission: true },
      );
    } catch (err) {
      next(err);
    }
  });

  // The user declined.
  router.post('/:uid/abort', async (req, res, next) => {
    try {
      return await provider.interactionFinished(
        req,
        res,
        { error: 'access_denied', error_description: 'User denied the request' },
        { mergeWithLastSubmission: false },
      );
    } catch (err) {
      next(err);
    }
  });

  return router;
}
