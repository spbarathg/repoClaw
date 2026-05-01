/**
 * @file src/skills/structure_analyze.ts
 * Role: Detects tech stack based on file extensions and config files.
 */
import { JobState } from '../types';
import { logger } from '../utils/logger';
import fs from 'fs/promises';
import path from 'path';

async function findFileDeep(dir: string, filenames: string[], depth = 1): Promise<string | null> {
  if (depth < 0) return null;
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && filenames.includes(entry.name)) {
        return path.join(dir, entry.name);
      }
    }
    for (const entry of entries) {
      if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== '.git') {
        const found = await findFileDeep(path.join(dir, entry.name), filenames, depth - 1);
        if (found) return found;
      }
    }
  } catch (e) {}
  return null;
}

export const structureAnalyze = async (state: JobState): Promise<void> => {
  logger.info(`Skill: structure_analyze -> Scanning ${state.sandboxPath}`);
  
  try {
    const pkgJsonPath = await findFileDeep(state.sandboxPath, ['package.json']);
    if (pkgJsonPath) {
      const dir = path.dirname(pkgJsonPath);
      const files = await fs.readdir(dir);
      const packageManager = files.includes('yarn.lock') ? 'yarn' : 
                             files.includes('pnpm-lock.yaml') ? 'pnpm' : 'npm';
      
      let buildCommand = `${packageManager} run build`;
      try {
        const pkgData = await fs.readFile(pkgJsonPath, 'utf8');
        const pkg = JSON.parse(pkgData);
        if (!pkg.scripts || !pkg.scripts.build) {
          buildCommand = ''; // Empty means no build script
        }
      } catch (e) {}

      state.stack = {
        language: 'Node.js',
        packageManager,
        installCommand: `${packageManager} install`,
        buildCommand
      };
    } else {
      const reqTxtPath = await findFileDeep(state.sandboxPath, ['requirements.txt']);
      if (reqTxtPath) {
        state.stack = {
          language: 'Python',
          packageManager: 'pip',
          installCommand: 'pip install -r requirements.txt',
          buildCommand: 'python -m compileall .'
        };
      } else {
        const goModPath = await findFileDeep(state.sandboxPath, ['go.mod']);
        if (goModPath) {
           state.stack = { language: 'Go', packageManager: 'go', installCommand: 'go mod download', buildCommand: 'go build ./...' };
        } else {
           const cargoPath = await findFileDeep(state.sandboxPath, ['Cargo.toml']);
           if (cargoPath) {
              state.stack = { language: 'Rust', packageManager: 'cargo', installCommand: '', buildCommand: 'cargo build' };
           } else {
              const makePath = await findFileDeep(state.sandboxPath, ['Makefile']);
              if (makePath) {
                 state.stack = { language: 'C/C++', packageManager: 'make', installCommand: '', buildCommand: 'make' };
              } else {
                 const dockerPath = await findFileDeep(state.sandboxPath, ['Dockerfile']);
                 if (dockerPath) {
                    state.stack = { language: 'Docker', packageManager: 'docker', installCommand: '', buildCommand: 'docker build .' };
                 } else {
                    state.stack = { language: 'Unknown', packageManager: 'unknown' };
                 }
              }
           }
        }
      }
    }
    
    state.status = 'ANALYZED';
  } catch (err: any) {
    logger.error(`Failed to analyze structure`, { error: err.message });
    throw new Error(`Analyze failed: ${err.message}`);
  }
};
