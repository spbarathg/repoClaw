/**
 * @file src/gateway/websocket.ts
 * Role: Manages WebSocket connections for incoming chat messages.
 */
import { logger } from '../utils/logger';
import { handleIncomingRequest } from './routing';
import { normalizeInput } from '../adapters/protocol';
import { WebSocketServer } from 'ws';
import { config } from '../config';

export const startWebSocketServer = () => {
  const wss = new WebSocketServer({ port: config.port });

  wss.on('connection', (ws) => {
    logger.info('New WebSocket client connected.');

    ws.on('message', async (message) => {
      try {
        const payload = JSON.parse(message.toString());
        logger.debug('Received WS Payload', payload);
        
        const source = payload.message ? 'telegram' : payload.content ? 'discord' : 'telegram';
        const request = normalizeInput(payload, source);
        
        ws.send(JSON.stringify({ status: 'ACK', message: `Job accepted for ${request.url}` }));
        
        const onProgress = (msg: string) => {
           if (ws.readyState === ws.OPEN) {
              ws.send(JSON.stringify({ status: 'PROGRESS', message: msg }));
           }
        };

        await handleIncomingRequest(request, onProgress);
        
        ws.send(JSON.stringify({ status: 'DONE', message: `Analysis complete for ${request.url}` }));
      } catch (err: any) {
        logger.error('Failed to process WS message', { error: err.message });
        ws.send(JSON.stringify({ status: 'ERROR', error: err.message }));
      }
    });

    ws.on('close', () => {
      logger.info('WebSocket client disconnected.');
    });
  });

  logger.info(`WebSocket Gateway started and listening on ws://localhost:${config.port}`);
};
