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

  // PRE-FLIGHT CHECK
  const healthCheck = await executeShell('docker info', process.cwd(), 10000);
  if (healthCheck.exitCode !== 0 || healthCheck.stderr.includes('error during connect') || healthCheck.stderr.includes('The system cannot find the file specified')) {
    logger.error('Docker daemon unreachable during pre-flight check.');
    return { success: false, stdout: '', stderr: 'PRE_FLIGHT_FAIL: Docker daemon is unreachable. Verify Docker Desktop is running on the host.' };
  }

  if (!state.stack || state.stack.language === 'Unknown') {
    throw new Error('FATAL: build_runner invoked on an UNSUPPORTED_ARCHITECTURE. This should have been aborted upstream.');
  }

  if (state.stack.buildCommand === '') {
    return { success: false, stdout: '', stderr: 'BUILD_SCRIPT_MISSING: No valid build script found in project' };
  }

  // OS-safe absolute path formatting
  const absPath = path.resolve(state.sandboxPath).replace(/\\/g, '/');

  let image = 'node:20-alpine';
  if (state.stack.language === 'Python') image = 'python:3.11-alpine';
  else if (state.stack.language === 'Go') image = 'golang:1.21-alpine';
  else if (state.stack.language === 'Rust') image = 'rust:1.75-alpine';
  else if (state.stack.language === 'C/C++') image = 'alpine:latest';
  else if (state.stack.language === 'Java') image = 'maven:3.9-eclipse-temurin-21-alpine';
  else if (state.stack.language === 'PHP') image = 'composer:2';
  else if (state.stack.language === 'Shell') image = 'alpine:latest';
  else if (state.stack.language === 'Docker') return { success: false, stdout: '', stderr: 'Docker-in-Docker not supported yet' };

  const installCmd = state.stack.installCommand || "echo 'no install'";
  const buildCmd = state.stack.buildCommand || "echo 'no build'";

  let preCmd = '';
  if (state.stack.language === 'C/C++') preCmd = 'apk add --no-cache make gcc g++ musl-dev && ';
  if (state.stack.language === 'Python') {
    preCmd += 'apk add --no-cache gcc g++ musl-dev gfortran python3-dev libffi-dev openblas-dev lapack-dev cargo rust && ';
  }
  if (state.stack.language === 'Shell') {
    preCmd += 'apk add --no-cache bash coreutils && ';
  }
  if (state.stack.language === 'Node.js') {
    preCmd += 'apk add --no-cache git && ';
    if (state.stack.packageManager === 'pnpm') preCmd += '(pnpm --version >/dev/null 2>&1 || npm install -g pnpm) && ';
    else if (state.stack.packageManager === 'yarn') preCmd += '(yarn --version >/dev/null 2>&1 || npm install -g yarn) && ';
  }

  // Copy repo to container-native filesystem to avoid slow Windows volume I/O during npm install.
  // Mount host path at /mnt/repo (read-only), copy to /build, then run install+build in /build.
  const dockerCmd = `docker run --rm --name repoclaw-${state.jobId} -v "${absPath}:/mnt/repo:ro" ${image} sh -c "${preCmd}mkdir -p /build && cp -a /mnt/repo/. /build/ && cd /build && ${installCmd} && ${buildCmd}"`;

  await executeShell(`docker rm -f repoclaw-${state.jobId}`, process.cwd(), 10000);

  const result = await executeShell(dockerCmd, process.cwd(), 600000); // 10 minute timeout

  await executeShell(`docker rm -f repoclaw-${state.jobId}`, process.cwd(), 10000);

  // Detect timeout: Node's exec sets error.killed = true and error.signal = 'SIGTERM' on timeout
  const isTimeout = result.stderr.includes('SIGTERM') || result.stderr.includes('timed out') || 
                     (result.exitCode !== 0 && result.stdout.length === 0 && result.stderr.length === 0);
  if (isTimeout) {
    result.stderr = (result.stderr || '') + '\nBUILD_TIMEOUT: Docker container execution exceeded time limit.';
  }

  state.logs.push(result);

  return {
    success: result.exitCode === 0,
    stdout: result.stdout,
    stderr: result.stderr
  };
};
