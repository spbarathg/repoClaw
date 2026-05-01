/**
 * @file src/adapters/protocol.ts
 * Role: Normalizes Telegram/Discord inputs into unified AnalysisRequest.
 */
import { AnalysisRequest } from '../types';

export const normalizeInput = (rawPayload: any, source: 'telegram' | 'discord'): AnalysisRequest => {
  let url = '';
  let chatId = 'unknown';

  if (source === 'telegram' && rawPayload?.message?.text) {
    url = rawPayload.message.text.trim();
    chatId = String(rawPayload.message.chat?.id || 'unknown');
  } else if (source === 'discord' && rawPayload?.content) {
    url = rawPayload.content.trim();
    chatId = String(rawPayload.channel_id || 'unknown');
  } else {
    // Generic fallback for direct WS json tests
    url = rawPayload.url || '';
    chatId = rawPayload.chatId || 'direct';
  }

  if (!url.startsWith('http')) {
    throw new Error('Invalid URL format in payload');
  }

  return { url, source, chatId };
};
