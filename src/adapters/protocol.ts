/**
 * @file src/adapters/protocol.ts
 * Role: Normalizes incoming payloads into AnalysisRequest.
 */
import { AnalysisRequest } from '../types';

export const normalizeInput = (payload: any, source: 'websocket' | 'cli'): AnalysisRequest => {
  const url = payload.url || payload.message || payload.content || '';
  return {
    url: url.trim(),
    source,
    chatId: payload.chatId || payload.channel_id || 'default',
  };
};
