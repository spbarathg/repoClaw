/**
 * @file src/skills/repo_fetch.ts
 * Role: Handles git clone, directory parsing, and GitHub REST API metadata fetching.
 */
import { JobState } from '../types';
import { logger } from '../utils/logger';
import simpleGit from 'simple-git';

export const repoFetch = async (state: JobState): Promise<void> => {
  logger.info(`Skill: repo_fetch -> Cloning ${state.url} into ${state.sandboxPath}`);
  
  try {
    const git = simpleGit().env('GIT_TERMINAL_PROMPT', '0');
    
    // Add a strict timeout to the clone operation
    const clonePromise = git.clone(state.url, state.sandboxPath, ['--depth', '1']);
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Git clone timed out after 60s')), 60000));
    
    await Promise.race([clonePromise, timeoutPromise]);
    state.status = 'CLONED';
  } catch (err: any) {
    logger.error(`Failed to clone ${state.url}`, { error: err.message });
    throw new Error(`Clone failed: ${err.message}`);
  }
};
