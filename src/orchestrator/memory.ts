/**
 * @file src/orchestrator/memory.ts
 * Role: Reads/writes per-repo analysis state to YAML memory.
 */
import { JobState } from '../types';
import { logger } from '../utils/logger';
import yaml from 'js-yaml';
import fs from 'fs/promises';
import path from 'path';

export const persistJobState = async (state: JobState): Promise<void> => {
  logger.info(`Persisting state to YAML memory for Job ID: ${state.jobId}`);
  try {
    const memoryDir = path.resolve('./memory');
    await fs.mkdir(memoryDir, { recursive: true });
    
    const yamlContent = yaml.dump(state);
    await fs.writeFile(path.join(memoryDir, `${state.jobId}.yaml`), yamlContent, 'utf8');
  } catch (err: any) {
    logger.error(`Failed to persist YAML memory for Job ID: ${state.jobId}`, { error: err.message });
  }
};

export const readJobState = async (jobId: string): Promise<JobState | null> => {
  try {
    const memoryDir = path.resolve('./memory');
    const filePath = path.join(memoryDir, `${jobId}.yaml`);
    const fileContent = await fs.readFile(filePath, 'utf8');
    return yaml.load(fileContent) as JobState;
  } catch (err: any) {
    logger.error(`Failed to read YAML memory for Job ID: ${jobId}`, { error: err.message });
    return null;
  }
};

import { IntelligenceLedgerEntry } from '../types';

export const getGlobalHistory = async (): Promise<IntelligenceLedgerEntry[]> => {
  try {
    const memoryDir = path.resolve('./memory');
    await fs.mkdir(memoryDir, { recursive: true });
    const files = await fs.readdir(memoryDir);
    const yamlFiles = files.filter(f => f.endsWith('.yaml'));
    
    const history: IntelligenceLedgerEntry[] = [];
    
    for (const file of yamlFiles) {
      try {
        const content = await fs.readFile(path.join(memoryDir, file), 'utf8');
        const state = yaml.load(content) as JobState;
        if (state && state.jobId) {
          history.push({
            jobId: state.jobId,
            url: state.url,
            category: state.errors && state.errors.length > 0 ? state.errors[state.errors.length - 1].category : 'CLEAN',
            verdict: state.status,
            score: state.forensicScore || 0,
            timestamp: new Date(parseInt(state.jobId)).toISOString()
          });
        }
      } catch (e) {
        // Skip corrupted files
      }
    }
    
    // Sort by descending timestamp (newest first)
    return history.sort((a, b) => parseInt(b.jobId) - parseInt(a.jobId)).slice(0, 50); // limit to last 50
  } catch (err) {
    logger.error('Failed to read global history', { error: err });
    return [];
  }
};
