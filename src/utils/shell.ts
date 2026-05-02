/**
 * @file src/utils/shell.ts
 * Role: Safe shell execution wrapper with try/catch and timeouts.
 */
import { exec } from 'child_process';
import { logger } from './logger';

export interface ShellResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export const executeShell = (command: string, cwd: string, timeoutMs: number = 60000): Promise<ShellResult> => {
  return new Promise((resolve) => {
    logger.debug(`Executing shell command: ${command} in ${cwd} with timeout ${timeoutMs}ms`);
    
    const child = exec(command, { cwd, timeout: timeoutMs, maxBuffer: 15 * 1024 * 1024 }, (error: any, stdout: string, stderr: string) => {
      if (error) {
        logger.warn(`Command failed or timed out: ${command}`, { error: error.message });
        resolve({
          stdout: stdout || '',
          stderr: stderr || error.message,
          exitCode: error.code || 1
        });
        return;
      }
      
      resolve({
        stdout: stdout || '',
        stderr: stderr || '',
        exitCode: 0
      });
    });
  });
};
