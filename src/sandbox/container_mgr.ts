/**
 * @file src/sandbox/container_mgr.ts
 * Role: Spins up and cleanly tears down ephemeral Docker Compose sandboxes.
 */
import { logger } from '../utils/logger';
import { executeShell } from '../utils/shell';
import fs from 'fs/promises';
import path from 'path';

export const setupSandbox = async (jobId: string): Promise<string> => {
  const sandboxPath = path.resolve(`./sandboxes/${jobId}`);
  logger.info(`Setting up Docker sandbox for Job ID: ${jobId} at ${sandboxPath}`);
  
  await fs.mkdir(sandboxPath, { recursive: true });
  return sandboxPath;
};

export const cleanupSandbox = async (jobId: string): Promise<void> => {
  const sandboxPath = path.resolve(`./sandboxes/${jobId}`);
  logger.info(`Tearing down and deleting Docker sandbox for Job ID: ${jobId}`);
  
  try {
    // Explicitly remove the container without piping, safe on Windows
    await executeShell(`docker rm -f repoclaw-${jobId}`, process.cwd(), 10000);
  } catch (err: any) {
    // Ignore errors if container didn't exist
  }
  
  // Aggressive cleanup of the sandbox directory
  try {
    await fs.rm(sandboxPath, { recursive: true, force: true });
  } catch (err: any) {
    logger.error(`Failed to remove sandbox directory: ${sandboxPath}`, { error: err.message });
  }
};
