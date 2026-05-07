/**
 * @file src/skills/build_runner.ts
 * Role: Executes install+build inside resource-limited Docker containers.
 * Captures stdout/stderr and enforces timeout via both Docker --stop-timeout and Node exec timeout.
 */
import { JobState } from '../types';
import { logger } from '../utils/logger';
import { executeShell } from '../utils/shell';
import path from 'path';

export interface BuildResult {
  success: boolean;
  stdout: string;
  stderr: string;
  durationMs: number;
  dockerImage: string;
  dockerFlags: string[];
}

/** Resource limits applied to every container */
const SANDBOX_LIMITS = {
  memory: '512m',
  cpus: '1.0',
  pidsLimit: 256,
  stopTimeout: 300,       // seconds — Docker-enforced kill
  execTimeout: 600000,    // ms — Node exec fallback kill (10 min)
} as const;

/** Docker flags that apply to every container invocation */
function buildDockerFlags(jobId: string, absPath: string, image: string): { flags: string[]; flagString: string } {
  const flags = [
    '--rm',
    `--name=repoclaw-${jobId}`,
    `--memory=${SANDBOX_LIMITS.memory}`,
    `--cpus=${SANDBOX_LIMITS.cpus}`,
    `--pids-limit=${SANDBOX_LIMITS.pidsLimit}`,
    `--stop-timeout=${SANDBOX_LIMITS.stopTimeout}`,
    '--security-opt=no-new-privileges',
    `-v "${absPath}:/mnt/repo:ro"`,
  ];
  return { flags, flagString: flags.join(' ') };
}

export const buildRunner = async (state: JobState): Promise<BuildResult> => {
  logger.info(`Skill: build_runner -> Executing build for ${state.sandboxPath}`);
  const startTime = Date.now();

  // PRE-FLIGHT CHECK
  const healthCheck = await executeShell('docker info', process.cwd(), 10000);
  if (healthCheck.exitCode !== 0 || healthCheck.stderr.includes('error during connect') || healthCheck.stderr.includes('The system cannot find the file specified')) {
    logger.error('Docker daemon unreachable during pre-flight check.');
    return { success: false, stdout: '', stderr: 'PRE_FLIGHT_FAIL: Docker daemon is unreachable. Verify Docker Desktop is running on the host.', durationMs: Date.now() - startTime, dockerImage: 'none', dockerFlags: [] };
  }

  if (!state.stack || state.stack.language === 'Unknown') {
    throw new Error('FATAL: build_runner invoked on an UNSUPPORTED architecture. This should have been aborted upstream.');
  }

  if (state.stack.buildCommand === '') {
    return { success: false, stdout: '', stderr: 'BUILD_SCRIPT_MISSING: No valid build script found in project', durationMs: Date.now() - startTime, dockerImage: 'none', dockerFlags: [] };
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
  else if (state.stack.language === 'Docker') return { success: false, stdout: '', stderr: 'Docker-in-Docker not supported', durationMs: Date.now() - startTime, dockerImage: 'none', dockerFlags: [] };

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

  const { flags, flagString } = buildDockerFlags(state.jobId, absPath, image);

  // Copy repo to container-native filesystem to avoid slow Windows volume I/O during npm install.
  // Mount host path at /mnt/repo (read-only), copy to /build, then run install+build in /build.
  const dockerCmd = `docker run ${flagString} ${image} sh -c "${preCmd}mkdir -p /build && cp -a /mnt/repo/. /build/ && cd /build && ${installCmd} && ${buildCmd}"`;

  await executeShell(`docker rm -f repoclaw-${state.jobId}`, process.cwd(), 10000);

  const result = await executeShell(dockerCmd, process.cwd(), SANDBOX_LIMITS.execTimeout);

  await executeShell(`docker rm -f repoclaw-${state.jobId}`, process.cwd(), 10000);

  // Detect timeout: Node's exec sets error.killed = true and error.signal = 'SIGTERM' on timeout
  const isTimeout = result.stderr.includes('SIGTERM') || result.stderr.includes('timed out') || 
                     (result.exitCode !== 0 && result.stdout.length === 0 && result.stderr.length === 0);
  if (isTimeout) {
    result.stderr = (result.stderr || '') + '\nBUILD_TIMEOUT: Docker container execution exceeded time limit.';
  }

  state.logs.push(result);
  const durationMs = Date.now() - startTime;

  return {
    success: result.exitCode === 0,
    stdout: result.stdout,
    stderr: result.stderr,
    durationMs,
    dockerImage: image,
    dockerFlags: flags,
  };
};
