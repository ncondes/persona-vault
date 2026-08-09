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

  // Expired sessions, codes and tokens are only filtered out on read; this
  // clears them out of the table. Unref'd so it never holds the process open.
  setInterval(() => {
    container.repositories.oidcPayloads
      .deleteExpired()
      .catch((err) => logger.warn({ err }, 'oidc sweep failed'));
  }, SWEEP_INTERVAL_MS).unref();

  app.listen(config.port, () => {
    logger.info(`Persona API listening on http://localhost:${config.port}`);
  });
}

main().catch((err) => {
  logger.error({ err }, 'failed to start the server');
  process.exit(1);
});
