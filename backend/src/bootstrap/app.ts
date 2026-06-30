import { createServer } from './server';
import { buildContainer } from './container';
import { registerEventHandlers } from './eventBus';
import { logger } from '../@shared/infrastructure/logger/Logger';
import { env } from '../@shared/config/env';
import { validateEnv } from '../@shared/config/validateEnv';

validateEnv();

async function main() {
  const container = buildContainer();
  const eventBus = container.resolve('eventBus');

  registerEventHandlers(eventBus);

  const app = createServer(container);

  app.listen(env.PORT, () => {
    logger.info(
      { port: env.PORT, env: env.NODE_ENV },
      'POSMono server started',
    );
  });
}

main().catch((err) => {
  logger.error(err, 'Failed to start server');
  process.exit(1);
});
