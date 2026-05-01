/**
 * @file src/index.ts
 * Role: Main application entry point. Bootstraps Gateway & Pi Engine.
 */
import { config } from './config';
import { logger } from './utils/logger';
import { startWebSocketServer } from './gateway/websocket';
import { piEngineRun } from './orchestrator/pi_engine';

const bootstrap = async () => {
  const args = process.argv.slice(2);
  if (args.length > 0) {
    const url = args[0];
    await piEngineRun({ url, source: 'telegram', chatId: 'CLI' });
    process.exit(0);
  } else {
    logger.banner('REPOCLAW GATEWAY ONLINE');
    startWebSocketServer();
  }
};

bootstrap();
