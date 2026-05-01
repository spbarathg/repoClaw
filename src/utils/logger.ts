/**
 * @file src/utils/logger.ts
 * Role: Console logger for RepoClaw (Hackathon-ready visual formatting).
 */

export const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  info: '\x1b[36m', // Cyan
  error: '\x1b[31m', // Red
  warn: '\x1b[33m', // Yellow
  success: '\x1b[32m', // Green
  debug: '\x1b[90m', // Gray
  magenta: '\x1b[35m',
};

const format = (level: string, color: string, msg: string, meta?: any) => {
  const metaStr = meta ? ` \n${JSON.stringify(meta, null, 2)}` : '';
  const timestamp = new Date().toISOString().substring(11, 19);
  return `${colors.debug}[${timestamp}]${colors.reset} ${colors.bold}${color}[${level.toUpperCase()}]${colors.reset} ${msg}${metaStr}`;
};

export const logger = {
  info: (msg: string, meta?: any) => console.log(format('info', colors.info, msg, meta)),
  error: (msg: string, meta?: any) => console.error(format('error', colors.error, msg, meta)),
  warn: (msg: string, meta?: any) => console.warn(format('warn', colors.warn, msg, meta)),
  debug: (msg: string, meta?: any) => console.debug(format('debug', colors.debug, msg, meta)),
  success: (msg: string, meta?: any) => console.log(format('success', colors.success, msg, meta)),
  
  // Theatrical Banners
  banner: (title: string) => {
    console.log(`\n${colors.magenta}================================================================${colors.reset}`);
    console.log(`${colors.magenta}  ${colors.bold}${title.toUpperCase()}${colors.reset}`);
    console.log(`${colors.magenta}================================================================${colors.reset}\n`);
  },
  phase: (step: string, desc: string) => {
    console.log(`\n${colors.info}► ${colors.bold}${step}${colors.reset} ${colors.info}— ${desc}${colors.reset}`);
  }
};
