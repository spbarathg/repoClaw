/**
 * @file src/gateway/routing.ts
 * Role: Routes incoming normalized requests to the Pi Engine Orchestrator.
 */
import { AnalysisRequest } from '../types';
import { piEngineRun } from '../orchestrator/pi_engine';
import { logger } from '../utils/logger';

export const handleIncomingRequest = async (request: AnalysisRequest, onProgress?: (msg: string) => void) => {
  logger.info(`Routing request for URL: ${request.url}`);
  try {
    await piEngineRun(request, onProgress);
  } catch (err: any) {
    logger.error('Fatal error in pipeline', { error: err.message });
  }
};
