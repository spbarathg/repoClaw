/**
 * @file src/gateway/websocket.ts
 * Role: Manages WebSocket connections for incoming chat messages.
 */
import { logger } from '../utils/logger';
import { handleIncomingRequest } from './routing';
import { normalizeInput } from '../adapters/protocol';
import { WebSocketServer, WebSocket } from 'ws';
import { config } from '../config';

import { getGlobalHistory } from '../orchestrator/memory';

export const startWebSocketServer = () => {
  const wss = new WebSocketServer({ port: config.port });

  wss.on('connection', async (ws) => {
    logger.info('New WebSocket client connected.');
    
    ws.on('message', async (message) => {
      try {
        const payload = JSON.parse(message.toString());
        logger.debug('Received WS Payload', payload);
        
        if (payload.action === 'GET_HISTORY') {
          const history = await getGlobalHistory();
          ws.send(JSON.stringify({ status: 'HISTORY_SYNC', history }));
          return;
        }
        
        if (!payload.message && !payload.content && !payload.url) return;
        
        const source = payload.message ? 'telegram' : payload.content ? 'discord' : 'telegram';
        const request = normalizeInput(payload, source);
        
        ws.send(JSON.stringify({ status: 'ACK', message: `Job accepted for ${request.url}` }));
        
        const onProgress = (msg: string, meta?: any) => {
           if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ status: 'PROGRESS', message: msg, meta }));
           }
        };

        const result = await handleIncomingRequest(request, onProgress);
        
        ws.send(JSON.stringify({ 
           status: 'DONE', 
           message: `Analysis complete for ${request.url}`,
           report: result?.report,
           verdict: result?.status,
           finalState: {
             verdict: result?.status,
             report: result?.report,
             errorCategory: result?.errors?.length ? result.errors[result.errors.length - 1].category : null,
             errors: result?.errors || [],
             generatedAssets: result?.generatedAssets || [],
             interventionSuccession: result?.interventionSuccession || [],
             interventionsAttempted: result?.interventionsAttempted || 0,
             logs: result?.logs || [],
             stack: result?.stack || null,
             forensicScore: result?.forensicScore ?? 0,
             scoreGrade: result?.scoreGrade ?? 'F',
             patchMutationLog: result?.patchMutationLog || [],
             retryCount: result?.retryCount ?? 0,
             confidence: result?.errors?.length ? result.errors[result.errors.length - 1].confidence : null,
             confidenceMatrix: result?.confidenceMatrix,
             commandMutations: result?.commandMutations || [],
             protocolIdentity: result?.protocolIdentity,
             reasoningFeed: result?.reasoningFeed || []
           }
        }));
      } catch (err: any) {
        logger.error('Failed to process WS message', { error: err.message });
        ws.send(JSON.stringify({ status: 'ERROR', error: err.message }));
      }
    });

    try {
      const history = await getGlobalHistory();
      ws.send(JSON.stringify({ status: 'HISTORY_SYNC', history }));
    } catch (e) {
      logger.error('Failed to send history sync', { error: e });
    }

    ws.on('close', () => {
      logger.info('WebSocket client disconnected.');
    });
  });

  logger.info(`WebSocket Gateway started and listening on ws://localhost:${config.port}`);
};
