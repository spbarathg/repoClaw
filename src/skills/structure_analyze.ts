/**
 * @file src/skills/structure_analyze.ts
 * Role: Detects tech stack based on file extensions and config files.
 */
import { JobState } from '../types';
import { logger } from '../utils/logger';
import fs from 'fs/promises';
import path from 'path';

async function findFileDeep(dir: string, filenames: string[], depth = 0): Promise<string | null> {
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
    const candidates: { path: string, type: string, depth: number }[] = [];
    const sourceStats = { md: 0, code: 0 };
    
    // Deep scan (depth 3) to collect candidates and stats
    const scanDir = async (currentDir: string, currentDepth: number) => {
      if (currentDepth > 3) return;
      try {
        const entries = await fs.readdir(currentDir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isFile()) {
            const ext = path.extname(entry.name);
            if (ext === '.md' || ext === '.mdx' || ext === '.txt') sourceStats.md++;
            else if (['.js', '.ts', '.jsx', '.tsx', '.mjs', '.cjs', '.py', '.go', '.rs', '.java', '.c', '.cpp', '.php'].includes(ext)) sourceStats.code++;
            
            if (['package.json', 'pnpm-workspace.yaml', 'turbo.json', 'nx.json', 'lerna.json', 'requirements.txt', 'pyproject.toml', 'setup.py', 'Cargo.toml', 'go.mod', 'pom.xml', 'build.gradle', 'composer.json', 'Makefile', 'Dockerfile', 'bootstrap.sh', 'build.sh'].includes(entry.name)) {
              candidates.push({ path: path.join(currentDir, entry.name), type: entry.name, depth: currentDepth });
            }
          } else if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== '.git' && entry.name !== 'dist' && entry.name !== 'build') {
            await scanDir(path.join(currentDir, entry.name), currentDepth + 1);
          }
        }
      } catch (e) {}
    };
    
    await scanDir(state.sandboxPath, 0);

    // Filter and score
    let bestCandidate = null;
    let highestScore = -1;

    for (const c of candidates) {
      let score = 50; // Base score
      
      // Proximity to root (depth 0 is best)
      score -= (c.depth * 15);
      
      // Folder semantic names
      const dirPath = path.dirname(c.path);
      const dirName = path.basename(dirPath).toLowerCase();
      if (['example', 'examples', 'docs', 'test', 'tests', 'mock', 'fixtures'].includes(dirName)) score -= 30;
      if (['src', 'app', 'core', 'server', 'packages', 'nodejs', 'python', 'go', 'java', 'backend'].includes(dirName)) score += 20;
      
      // Richness & Scripts (Node.js specifically)
      if (c.type === 'package.json') {
        try {
          const data = JSON.parse(await fs.readFile(c.path, 'utf8'));
          if (data.scripts && data.scripts.build) score += 20;
          if (data.dependencies) score += Object.keys(data.dependencies).length;
          if (data.private) score -= 10;
        } catch (e) {}
      }
      
      // Demote generic Dockerfile so native language manifests (pyproject.toml, etc.) win depth ties
      if (c.type === 'Dockerfile') score -= 5;

      if (score > highestScore) {
        highestScore = score;
        bestCandidate = c;
      }
    }

    // Heuristic: Surrounding source code density vs Markdown
    const isDocumentationHeavy = sourceStats.md > (sourceStats.code * 2);

    logger.info(`Skill: structure_analyze -> Smart Inference Complete. Best Candidate: ${bestCandidate?.path} (Score: ${highestScore}). Code: ${sourceStats.code}, MD: ${sourceStats.md}`);

    // Selection or Abort
    if (!bestCandidate || highestScore < 20 || isDocumentationHeavy) {
      state.stack = { language: 'Unknown', packageManager: 'unknown' };
      state.status = 'UNSUPPORTED_ARCHITECTURE';
      logger.warn(`Skill: structure_analyze -> No credible executable workspace found or repository is static/meta. Aborting.`);
      return;
    }

    // Set stack based on best candidate
    const dir = path.dirname(bestCandidate.path);
    const type = bestCandidate.type;

    if (['package.json', 'pnpm-workspace.yaml', 'turbo.json', 'nx.json', 'lerna.json'].includes(type)) {
      const files = await fs.readdir(dir);
      const packageManager = files.includes('yarn.lock') ? 'yarn' : 
                             (files.includes('pnpm-lock.yaml') || files.includes('pnpm-workspace.yaml')) ? 'pnpm' : 'npm';
      
      // Monorepo workspace detection
      const hasTurbo = files.includes('turbo.json');
      const hasPnpmWorkspace = files.includes('pnpm-workspace.yaml');
      const hasNx = files.includes('nx.json');
      const hasLerna = files.includes('lerna.json');
      const isMonorepo = hasTurbo || hasPnpmWorkspace || hasNx || hasLerna;

      let buildCommand = `${packageManager} run build`;
      if (isMonorepo) {
        if (hasTurbo) buildCommand = 'npx turbo run build';
        else if (hasNx) buildCommand = 'npx nx run-many -t build';
        else if (hasLerna) buildCommand = 'npx lerna run build';
        else if (hasPnpmWorkspace) buildCommand = 'pnpm -r run build';
        logger.info(`Skill: structure_analyze -> Monorepo detected. Orchestrator: ${hasTurbo ? 'Turborepo' : hasNx ? 'Nx' : hasLerna ? 'Lerna' : 'pnpm workspace'}`);
      } else if (type === 'package.json') {
        try {
          const pkgData = await fs.readFile(bestCandidate.path, 'utf8');
          const pkg = JSON.parse(pkgData);
          if (!pkg.scripts || !pkg.scripts.build) buildCommand = ''; 
        } catch (e) {}
      }
      state.stack = { language: 'Node.js', packageManager, installCommand: `${packageManager} install`, buildCommand };
    } 
    else if (['requirements.txt', 'pyproject.toml', 'setup.py'].includes(type)) {
      state.stack = { language: 'Python', packageManager: type === 'pyproject.toml' ? 'poetry' : 'pip', installCommand: type === 'requirements.txt' ? 'pip install -r requirements.txt' : 'pip install .', buildCommand: 'python -m compileall .' };
    }
    else if (type === 'go.mod') { state.stack = { language: 'Go', packageManager: 'go', installCommand: 'go mod download', buildCommand: 'go build ./...' }; }
    else if (type === 'Cargo.toml') { state.stack = { language: 'Rust', packageManager: 'cargo', installCommand: '', buildCommand: 'cargo build' }; }
    else if (type === 'Makefile') { state.stack = { language: 'C/C++', packageManager: 'make', installCommand: '', buildCommand: 'make' }; }
    else if (type === 'pom.xml') { state.stack = { language: 'Java', packageManager: 'maven', installCommand: 'mvn install -DskipTests', buildCommand: 'mvn compile' }; }
    else if (type === 'build.gradle') { state.stack = { language: 'Java', packageManager: 'gradle', installCommand: '', buildCommand: 'gradle build' }; }
    else if (type === 'composer.json') { state.stack = { language: 'PHP', packageManager: 'composer', installCommand: 'composer install', buildCommand: '' }; }
    else if (['bootstrap.sh', 'build.sh'].includes(type)) { state.stack = { language: 'Shell', packageManager: 'sh', installCommand: '', buildCommand: `sh ${path.basename(bestCandidate.path)}` }; }
    else if (type === 'Dockerfile') { state.stack = { language: 'Docker', packageManager: 'docker', installCommand: '', buildCommand: 'docker build .' }; }

    state.status = 'ANALYZED';
  } catch (err: any) {
    logger.error(`Failed to analyze structure`, { error: err.message });
    throw new Error(`Analyze failed: ${err.message}`);
  }
};
