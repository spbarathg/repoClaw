/**
 * @file src/config/index.ts
 * Role: Centralised configuration management and environment variables.
 */
import * as dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  telegramToken: process.env.TELEGRAM_TOKEN || '',
  discordToken: process.env.DISCORD_TOKEN || '',
  sandboxDir: process.env.SANDBOX_DIR || './sandboxes',
  memoryDir: process.env.MEMORY_DIR || './memory',
  maxRetries: 3,
};
