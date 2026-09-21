import { Request, RequestHandler, Response, Router, json, urlencoded } from 'express';
import { config } from '../config/config';
import type { Container } from '../container';
import { AppError } from '../domain/errors';
import { AUTH_COOKIE, authCookieSetOptions } from '../infrastructure/auth/cookie';
import { signAuthToken, verifyAuthToken } from '../infrastructure/auth/token';
import { revokeGrant } from './grants';
import { renderConsent, renderExpired, renderLogin, renderOtp } from './views';

// The interaction endpoints serve two callers: the frontend consent app
// (JSON, chosen via the Accept header) and plain HTML forms as a fallback.
function wantsJson(req: Request): boolean {
  return Boolean(req.headers.accept?.includes('application/json'));
}

// Signing in can now fail for more reasons than a wrong password — the code can
// be wrong, spent, or never sent — so the real code and status are kept instead
// of flattening everything to INVALID_CREDENTIALS.
function failure(err: unknown): { status: number; code: string; message: string } {
  if (err instanceof AppError) {
    return { status: err.statusCode, code: err.code, message: err.message };
  }
  return { status: 401, code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' };
}

// Failures that leave nothing to retry against: the code form would be a dead
// end, so the fallback goes back to the password step instead.
const SPENT = ['CHALLENGE_NOT_FOUND', 'OTP_EXPIRED', 'OTP_TOO_MANY_ATTEMPTS'];

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
        } else if (config.webUrl) {
          res.redirect(303, `${config.webUrl}/authorize/${String(req.params.uid)}`);
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
  const limit = container.rateLimit;

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
            // The same shape as the consent step, so the badge cannot say one
            // thing on the sign-in screen and another on the screen after it.
            client: client
              ? {
                  id: client.id,
                  name: client.name,
                  purpose: client.purpose,
                  verifiedDomain: client.verifiedDomain,
                }
              : { id: clientId, verifiedDomain: null },
          });
        }
        if (config.webUrl) {
          return res.redirect(303, `${config.webUrl}/authorize/${uid}`);
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
        if (config.webUrl) {
          return res.redirect(303, `${config.webUrl}/authorize/${uid}`);
        }
        return res.send(renderConsent(uid, clientId, String(params.scope ?? '')));
      }

      return res.status(400).send('Unsupported interaction');
    }),
  );

  // Check the password and email a code. No session is issued here — the
  // consent screen is a sign-in like any other, so it gets the same second step
  // rather than a way around it.
  router.post(
    '/:uid/login',
    body,
    limit('authLogin'),
    interactionHandler(async (req, res) => {
      const uid = String(req.params.uid);
      // Checked before the password, so a request that has already expired costs
      // nobody an email. It throws SessionNotFound, which the wrapper turns into
      // the friendly 410.
      await provider.interactionDetails(req, res);

      let challenge;
      try {
        challenge = await container.authService.startLogin(req.body.email, req.body.password);
      } catch (err) {
        const failed = failure(err);
        if (wantsJson(req)) {
          return res
            .status(failed.status)
            .json({ error: { code: failed.code, message: failed.message } });
        }
        return res.status(failed.status).send(renderLogin(uid, failed.message));
      }

      if (wantsJson(req)) {
        return res.json(challenge);
      }
      return res.send(renderOtp(uid, challenge.challengeId, challenge.email));
    }),
  );

  // The emailed code, and the step that actually completes the login.
  router.post(
    '/:uid/verify',
    body,
    limit('interactionVerify'),
    interactionHandler(async (req, res) => {
      const uid = String(req.params.uid);
      const challengeId = String(req.body.challengeId ?? '');
      let user;
      try {
        user = await container.authService.completeLogin(challengeId, String(req.body.code ?? ''));
      } catch (err) {
        const failed = failure(err);
        if (wantsJson(req)) {
          return res
            .status(failed.status)
            .json({ error: { code: failed.code, message: failed.message } });
        }
        const email = String(req.body.email ?? '');
        return res
          .status(failed.status)
          .send(
            SPENT.includes(failed.code)
              ? renderLogin(uid, failed.message)
              : renderOtp(uid, challengeId, email, failed.message),
          );
      }
      res.cookie(AUTH_COOKIE, signAuthToken(user.id), authCookieSetOptions);
      return finish(req, res, { login: { accountId: user.id } }, false);
    }),
  );

  // Apply the user's decision: build the grant from the approved scopes and
  // record which vault values back each one.
  router.post(
    '/:uid/decision',
    body,
    limit('interactionDecision'),
    interactionHandler(async (req, res) => {
      const details = await provider.interactionDetails(req, res);
      const { params, session } = details;
      // No session means this interaction is still at the login step, so the
      // decision arrived out of order. Treat it like an expired request.
      if (!session) {
        throw new AppError(410, 'INTERACTION_EXPIRED', 'This request has expired');
      }
      const clientId = String(params.client_id);
      const requestedScopes = String(params.scope ?? '').split(' ').filter(Boolean);

      const decision = await container.interactionService.applyDecision(
        session.accountId,
        clientId,
        requestedScopes,
        req.body ?? {},
      );

      const previous = await container.repositories.consents.findByUserAndClient(
        session.accountId,
        clientId,
      );

      // A fresh grant each time: Grant.rejected is sticky, so reusing the old
      // one would keep subtracting a scope the user has since approved.
      const grant = new provider.Grant({ accountId: session.accountId, clientId });
      grant.addOIDCScope(['openid', ...decision.grantedScopes].join(' '));
      for (const scope of decision.rejectedScopes) {
        grant.rejectOIDCScope(scope);
      }
      const grantId = await grant.save();

      try {
        // The grant lives in the OIDC store and cannot join a Prisma
        // transaction, so the two Persona rows commit together and the grant is
        // rolled back by hand if they fail.
        await container.unitOfWork.run(async (repos) => {
          await repos.consents.record({
            userId: session.accountId,
            clientId,
            scopes: decision.grantedScopes,
            selections: decision.selections,
            grantId,
          });
          await repos.audit.record({
            userId: session.accountId,
            clientId,
            type: 'grant',
            context: decision.purpose,
            scopesReleased: decision.grantedScopes,
            fieldsReleased: decision.grantedScopes,
          });
        });
      } catch (err) {
        await revokeGrant(provider, grantId);
        throw err;
      }

      // Re-consenting replaces the previous decision; without this the
      // superseded grant and its access tokens would stay valid.
      if (previous?.grantId && previous.grantId !== grantId) {
        await revokeGrant(provider, previous.grantId);
      }

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
