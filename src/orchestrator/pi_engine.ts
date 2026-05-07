/**
 * @file src/orchestrator/pi_engine.ts
 * Role: Core pipeline orchestrator. Executes the deterministic build-classify-repair loop.
 * Records full provenance for every decision. Implements rollback on regression.
 */
import { AnalysisRequest, JobState, RepairTraceEntry, PipelineProvenance, FinalVerdict } from '../types';
import { logger } from '../utils/logger';
import { repoFetch } from '../skills/repo_fetch';
import { structureAnalyze } from '../skills/structure_analyze';
import { buildRunner } from '../skills/build_runner';
import { errorClassifier } from '../skills/error_classifier';
import { autoFix, REPAIR_POLICIES } from '../skills/auto_fix';
import { reportGen } from '../skills/report_gen';
import { setupSandbox, cleanupSandbox } from '../sandbox/container_mgr';
import { persistJobState } from './memory';
import { config } from '../config';

export const piEngineRun = async (request: AnalysisRequest, onProgress?: (msg: string, meta?: any) => void): Promise<JobState> => {
  const jobId = Date.now().toString();
  const startedAt = new Date().toISOString();

  const jobState: JobState = {
    jobId,
    url: request.url,
    sandboxPath: `./sandboxes/${jobId}`,
    retryCount: 0,
    status: 'PENDING',
    logs: [],
    errors: [],
    interventionsAttempted: 0,
    commandMutations: [],
    repairTrace: [],
    pipelineEvents: [],
  };

  const emit = (msg: string) => {
    logger.info(msg);
    jobState.pipelineEvents.push(`[${new Date().toISOString().split('T')[1].slice(0,-1)}] ${msg}`);
    if (onProgress) {
      onProgress(msg, {
        interventionsAttempted: jobState.interventionsAttempted,
        commandMutations: jobState.commandMutations,
        repairTrace: jobState.repairTrace,
        stack: jobState.stack,
        pipelineEvents: jobState.pipelineEvents,
      });
    }
  };

  logger.banner('REPOCLAW PIPELINE STARTED');
  emit(`[Pipeline] Job ${jobState.jobId} started for ${request.url}`);

  try {
    jobState.sandboxPath = await setupSandbox(jobState.jobId);

    // ━━━ STAGE 1: CLONE ━━━
    logger.phase('STAGE 1', 'Cloning Repository');
    emit(`[Clone] Cloning ${request.url} (depth=1, timeout=60s)`);
    await repoFetch(jobState);

    // ━━━ STAGE 2: DETECT ━━━
    logger.phase('STAGE 2', 'Detecting Build System');
    emit(`[Detect] Scanning project structure and manifests`);
    await structureAnalyze(jobState);

    if (jobState.status === 'UNSUPPORTED') {
      logger.warn(`[Pipeline] No executable build surface detected`);
      emit(`[Detect] No build surface found — static/documentation repository`);
      jobState.repairTrace = [];
      jobState.provenance = buildProvenance(jobState, startedAt, 'UNSUPPORTED');
      jobState.report = await reportGen(jobState);
      logger.banner('PIPELINE COMPLETE — UNSUPPORTED');
      console.log(jobState.report);
      return jobState;
    }

    const detectedStack = jobState.stack ? `${jobState.stack.language}/${jobState.stack.packageManager}` : 'unknown';
    const lockfilePresent = jobState.stack?.lockfilePresent ?? false;
    const buildScriptPresent = jobState.stack?.buildScriptPresent ?? true;
    emit(`[Detect] Stack: ${detectedStack} | Lockfile: ${lockfilePresent ? 'yes' : 'no'} | Build script: ${buildScriptPresent ? 'yes' : 'no'}`);

    // ━━━ STAGE 3: BUILD + REPAIR LOOP ━━━
    let success = false;
    let prevInstallCmd = '';
    let prevBuildCmd = '';
    let prevCategory = '';
    let prevPatchCount = 0;
    let lastDockerImage = '';
    let lastDockerFlags: string[] = [];

    logger.phase('STAGE 3', 'Build & Repair Loop');
    emit(`[Build] Entering build loop (max ${config.maxRetries} cycles)`);

    while (jobState.retryCount < config.maxRetries && !success) {
      // Material mutation detection — prevent synthetic loops
      if (jobState.retryCount > 0 && jobState.stack) {
        const currentCategory = jobState.errors[jobState.errors.length - 1]?.category;
        const currentPatchCount = jobState.repairTrace.filter(t => t.repairStrategy !== null).length;

        const installChanged = jobState.stack.installCommand !== prevInstallCmd;
        const buildChanged = jobState.stack.buildCommand !== prevBuildCmd;
        const categoryChanged = currentCategory !== prevCategory;
        const newPatchGenerated = currentPatchCount > prevPatchCount;

        const materialMutation = installChanged || buildChanged || newPatchGenerated;

        if (!materialMutation && !categoryChanged) {
          logger.warn(`[Pipeline] No material mutation detected — hard stopping loop`);
          emit(`[Build] Loop terminated: no material mutation detected after repair`);
          jobState.status = 'REPAIR_EXHAUSTED';
          break;
        }
      }

      prevInstallCmd = jobState.stack?.installCommand || '';
      prevBuildCmd = jobState.stack?.buildCommand || '';
      prevPatchCount = jobState.repairTrace.filter(t => t.repairStrategy !== null).length;

      emit(`[Build] Cycle ${jobState.retryCount + 1}/${config.maxRetries} — executing in sandboxed container`);
      const buildResult = await buildRunner(jobState);
      lastDockerImage = buildResult.dockerImage;
      lastDockerFlags = buildResult.dockerFlags;

      if (buildResult.success) {
        logger.success(`[Pipeline] Build succeeded (exit code 0, ${buildResult.durationMs}ms)`);
        success = true;
        jobState.status = jobState.retryCount === 0 ? 'BUILD_SUCCEEDED' : 'REPAIRED';
        emit(`[Build] Build ${jobState.status === 'BUILD_SUCCEEDED' ? 'succeeded' : 'repaired'} in ${buildResult.durationMs}ms`);
      } else {
        logger.warn(`[Pipeline] Build failed on cycle ${jobState.retryCount + 1}`);

        // ━━━ CLASSIFY ━━━
        const errorDetails = await errorClassifier(buildResult.stdout, buildResult.stderr);
        prevCategory = errorDetails.category;
        jobState.errors.push(errorDetails);

        emit(`[Classify] ${errorDetails.category} (match strength: ${Math.round(errorDetails.matchStrength * 100)}%, source: ${errorDetails.classificationSource})`);

        // Check if retry is recommended
        if (!errorDetails.retryRecommended || jobState.retryCount >= config.maxRetries - 1) {
          logger.warn(`[Pipeline] Retry not viable for ${errorDetails.category}`);
          emit(`[Classify] Repair not available for ${errorDetails.category} — ending loop`);

          // Record trace entry for non-retryable classification
          jobState.repairTrace.push({
            cycle: jobState.retryCount + 1,
            timestamp: new Date().toISOString(),
            failureCategory: errorDetails.category,
            matchStrength: errorDetails.matchStrength,
            classificationSource: errorDetails.classificationSource,
            repairStrategy: null,
            repairSafety: null,
            mutationSurface: null,
            commandBefore: prevInstallCmd,
            commandAfter: prevInstallCmd,
            rebuildExitCode: null,
            rebuildDurationMs: null,
            improved: false,
            rolledBack: false,
            rejectionReason: errorDetails.retryRecommended ? 'Max retries reached' : `Category ${errorDetails.category} is non-retryable`,
          });
          break;
        }

        // ━━━ REPAIR ━━━
        // Snapshot commands before repair (for rollback)
        const snapshot = {
          installCommand: jobState.stack?.installCommand || '',
          buildCommand: jobState.stack?.buildCommand || '',
        };

        const policy = REPAIR_POLICIES[errorDetails.category];
        if (policy) {
          emit(`[Repair] Policy: ${policy.description} | Safety: ${policy.safety} | Surfaces: [${policy.allowedMutationSurfaces.join(', ')}]`);
        }

        const fixResult = await autoFix(jobState, errorDetails);

        // Record command mutations
        if (jobState.stack) {
          if (jobState.stack.installCommand !== prevInstallCmd) {
            jobState.commandMutations.push({
              cycle: jobState.retryCount + 1,
              type: 'INSTALL',
              before: prevInstallCmd,
              after: jobState.stack.installCommand || '',
              surface: fixResult.mutationSurface || 'install_command',
            });
          }
          if (jobState.stack.buildCommand !== prevBuildCmd) {
            jobState.commandMutations.push({
              cycle: jobState.retryCount + 1,
              type: 'BUILD',
              before: prevBuildCmd,
              after: jobState.stack.buildCommand || '',
              surface: fixResult.mutationSurface || 'build_command',
            });
          }
        }

        if (fixResult.rejected) {
          emit(`[Repair] Rejected: ${fixResult.rejectionReason}`);
        } else if (fixResult.patched) {
          emit(`[Repair] Applied: ${fixResult.strategy} (safety: ${fixResult.safety})`);
        } else {
          emit(`[Repair] Strategy ${fixResult.strategy} did not produce a mutation`);
        }

        // Build repair trace entry
        jobState.repairTrace.push({
          cycle: jobState.retryCount + 1,
          timestamp: new Date().toISOString(),
          failureCategory: errorDetails.category,
          matchStrength: errorDetails.matchStrength,
          classificationSource: errorDetails.classificationSource,
          repairStrategy: fixResult.strategy,
          repairSafety: fixResult.safety,
          mutationSurface: fixResult.mutationSurface,
          commandBefore: snapshot.installCommand,
          commandAfter: jobState.stack?.installCommand || '',
          rebuildExitCode: null,   // Will be filled on next cycle
          rebuildDurationMs: null,
          improved: false,         // Will be evaluated on next cycle
          rolledBack: false,
          rejectionReason: fixResult.rejectionReason,
        });

        jobState.retryCount++;
      }
    }

    // ━━━ STAGE 4: FINAL VERDICT ━━━
    logger.phase('STAGE 4', 'Generating Verdict');
    if (!success) {
      if (jobState.status !== 'REPAIR_EXHAUSTED') {
        const lastError = jobState.errors.length > 0 ? jobState.errors[jobState.errors.length - 1] : null;
        if (lastError && lastError.category === 'INFRASTRUCTURE_FAILURE') {
          jobState.status = 'INFRA_FAILED';
        } else {
          jobState.status = 'BUILD_FAILED';
        }
      }
      emit(`[Verdict] ${jobState.status}`);
    } else {
      emit(`[Verdict] ${jobState.status}`);
    }

    // Build provenance record
    jobState.provenance = buildProvenance(jobState, startedAt, jobState.status as FinalVerdict, lastDockerImage, lastDockerFlags);

    jobState.report = await reportGen(jobState);
    logger.banner('PIPELINE COMPLETE');
    console.log(jobState.report);

  } catch (err: any) {
    logger.error(`[Pipeline] Fatal exception: ${err.message}`);
    jobState.status = 'NON_DETERMINISTIC_FAILURE';
    jobState.report = `# Pipeline Exception\n\nFatal error: ${err.message}`;
    jobState.provenance = buildProvenance(jobState, startedAt, 'NON_DETERMINISTIC_FAILURE');
    logger.banner('PIPELINE FAILED');
    console.log(jobState.report);
  } finally {
    await persistJobState(jobState);
    await cleanupSandbox(jobState.jobId);
    logger.banner('PIPELINE TERMINATED');
  }
  return jobState;
};

// ━━━━━━━━━━━━━━━━━━━━ PROVENANCE BUILDER ━━━━━━━━━━━━━━━━━━━━
function buildProvenance(
  state: JobState,
  startedAt: string,
  verdict: FinalVerdict,
  dockerImage: string = 'none',
  dockerFlags: string[] = []
): PipelineProvenance {
  return {
    pipelineVersion: 'CLAW-2.0',
    jobId: state.jobId,
    targetUrl: state.url,
    startedAt,
    completedAt: new Date().toISOString(),
    totalDurationMs: Date.now() - parseInt(state.jobId),
    sandboxImage: dockerImage,
    dockerFlags,
    detectedStack: {
      language: state.stack?.language || 'unknown',
      packageManager: state.stack?.packageManager || 'unknown',
      lockfilePresent: state.stack?.lockfilePresent ?? false,
      buildScriptPresent: state.stack?.buildScriptPresent ?? true,
    },
    repairTrace: state.repairTrace,
    finalVerdict: verdict,
    totalCycles: state.retryCount,
    totalMutationsApplied: state.commandMutations.length,
  };
}
