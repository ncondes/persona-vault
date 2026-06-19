import { RequestHandler } from 'express';
import { config } from './config/config';
import { buildContainer } from './container';
import { buildApp } from './server';
import { createOidcProvider } from './oidc/provider';
import { logger } from './infrastructure/logger/logger';

async function main(): Promise<void> {
  const container = buildContainer();
  const provider = await createOidcProvider();
  const app = buildApp(container, provider.callback() as unknown as RequestHandler);

  app.listen(config.port, () => {
    logger.info(`Persona API listening on http://localhost:${config.port}`);
  });
}

main().catch((err) => {
  logger.error({ err }, 'failed to start the server');
  process.exit(1);
});
