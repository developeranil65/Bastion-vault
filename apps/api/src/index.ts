import app from './app';
import prisma from './lib/prisma';
import { config, assertRuntimeConfig } from './config/env';
import { disconnectRedis } from './config/redis';
import { logger } from './utils/logger';

assertRuntimeConfig();

const server = app.listen(config.PORT, () => {
  logger.info(`${config.APP_NAME} API running`, { port: config.PORT, environment: config.NODE_ENV });
});

async function shutdown(signal: string) {
  logger.warn('Shutdown signal received', { signal });

  server.close(async () => {
    try {
      await disconnectRedis();
      await prisma.$disconnect();
      logger.info('Shutdown complete');
      process.exit(0);
    } catch (error) {
      logger.error('Shutdown failed', { error: error instanceof Error ? error.message : 'unknown' });
      process.exit(1);
    }
  });

  setTimeout(() => {
    logger.error('Forced shutdown timeout exceeded');
    process.exit(1);
  }, 10000).unref();
}

process.on('SIGINT', () => {
  void shutdown('SIGINT');
});

process.on('SIGTERM', () => {
  void shutdown('SIGTERM');
});

export default server;
