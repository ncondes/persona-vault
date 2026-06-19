import { config } from './config/config';
import { buildContainer } from './container';
import { buildApp } from './server';
import { logger } from './infrastructure/logger/logger';

const app = buildApp(buildContainer());

app.listen(config.port, () => {
  logger.info(`Persona API listening on http://localhost:${config.port}`);
});
