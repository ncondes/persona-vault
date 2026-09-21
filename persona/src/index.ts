import { config } from './config/config';
import { buildContainer } from './container';
import { buildApp } from './server';
import { createOidcProvider } from './oidc/provider';
import { logger } from './infrastructure/logger/logger';

const SWEEP_INTERVAL_MS = 15 * 60 * 1000;

async function main(): Promise<void> {
  const container = buildContainer();
  const provider = await createOidcProvider(container);
  const app = buildApp(container, provider);

  // Expired sessions, codes, tokens and unfinished sign-ups are only filtered
  // out on read; this clears them out of the tables. Unref'd so it never holds
  // the process open.
  //
  // Signing keys are deliberately not swept here. oidc-provider fixes its key
  // set when it is constructed, so a promotion made mid-process would leave the
  // database calling a key retired while this process was still signing with
  // it — and once it was deleted, every token it had signed would stop
  // verifying. Stepping the rollover only at startup (loadJwks, called from
  // createOidcProvider above) makes that impossible rather than unlikely.
  setInterval(() => {
    container.repositories.oidcPayloads
      .deleteExpired()
      .catch((err) => logger.warn({ err }, 'oidc sweep failed'));
    container.repositories.otpChallenges
      .deleteExpired()
      .catch((err) => logger.warn({ err }, 'otp sweep failed'));
  }, SWEEP_INTERVAL_MS).unref();

  app.listen(config.port, () => {
    logger.info(`Persona API listening on http://localhost:${config.port}`);
  });
}

main().catch((err) => {
  logger.error({ err }, 'failed to start the server');
  process.exit(1);
});
