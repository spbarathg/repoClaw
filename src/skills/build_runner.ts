/**
 * @file src/skills/build_runner.ts
 * Role: Executes commands in Docker; captures stdout/stderr.
 */
import { JobState } from '../types';
import { logger } from '../utils/logger';
import { executeShell } from '../utils/shell';
import path from 'path';

export interface BuildResult {
  success: boolean;
  stdout: string;
  stderr: string;
}

export const buildRunner = async (state: JobState): Promise<BuildResult> => {
  logger.info(`Skill: build_runner -> Executing build for ${state.sandboxPath}`);

  if (!state.stack || state.stack.language === 'Unknown') {
    return { success: false, stdout: '', stderr: 'Unsupported or unknown stack' };
  }

  if (state.stack.buildCommand === '') {
    return { success: false, stdout: '', stderr: 'BUILD_SCRIPT_MISSING: No valid build script found in project' };
  }

  // Normalize path to use forward slashes for Docker on Windows
  const absPath = path.resolve(state.sandboxPath).replace(/\\/g, '/');

  let image = 'node:22-alpine';
  if (state.stack.language === 'Python') image = 'python:3.11-alpine';
  else if (state.stack.language === 'Go') image = 'golang:1.21-alpine';
  else if (state.stack.language === 'Rust') image = 'rust:1.75-alpine';
  else if (state.stack.language === 'C/C++') image = 'alpine:latest'; // Need apk add make gcc g++
  else if (state.stack.language === 'Docker') return { success: false, stdout: '', stderr: 'Docker-in-Docker not supported yet' };

  const installCmd = state.stack.installCommand || 'echo "no install"';
  const buildCmd = state.stack.buildCommand || 'echo "no build"';

  let preCmd = '';
  if (state.stack.language === 'C/C++') preCmd = 'apk add --no-cache make gcc g++ musl-dev && ';

  const dockerCmd = `docker run --rm --name repoclaw-${state.jobId} -v "${absPath}:/app" -w /app ${image} sh -c "${preCmd}${installCmd} && ${buildCmd}"`;

  await executeShell(`docker rm -f repoclaw-${state.jobId}`, process.cwd(), 10000);

  const result = await executeShell(dockerCmd, process.cwd(), 300000); // 5 minute timeout

  await executeShell(`docker rm -f repoclaw-${state.jobId}`, process.cwd(), 10000);

  state.logs.push(result);

  return {
    success: result.exitCode === 0,
    stdout: result.stdout,
    stderr: result.stderr
  };
};
