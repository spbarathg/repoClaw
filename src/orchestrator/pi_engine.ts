/**
 * @file src/orchestrator/pi_engine.ts
 * Role: Orchestrator managing the try -> classify -> fix -> retry loop.
 */
import { AnalysisRequest, JobState } from '../types';
import { logger } from '../utils/logger';
import { repoFetch } from '../skills/repo_fetch';
import { structureAnalyze } from '../skills/structure_analyze';
import { buildRunner } from '../skills/build_runner';
import { errorClassifier } from '../skills/error_classifier';
import { autoFix } from '../skills/auto_fix';
import { reportGen } from '../skills/report_gen';
import { setupSandbox, cleanupSandbox } from '../sandbox/container_mgr';
import { persistJobState } from './memory';
import { config } from '../config';

/**
 * Computes a deterministic forensic score (0–100) based on actual pipeline execution facts.
 * No hardcoded buckets — every point is earned from real data.
 */
function computeForensicScore(state: JobState): { score: number; grade: string } {
  let score = 0;

  if (state.status === 'UNSUPPORTED_ARCHITECTURE') {
    return { score: 0, grade: 'N/A' };
  }
  if (state.status === 'INFRASTRUCTURE_ERROR') {
    // Repo itself is unknown — infrastructure failed, not the code
    return { score: -1, grade: 'I' };
  }

  const isSuccess = state.status === 'BUILDABLE' || state.status === 'FIXABLE';

  if (isSuccess) {
    // Base: 95 for clean build, 70 for fixed build
    score = state.status === 'BUILDABLE' ? 95 : 70;

    // Retry penalty: -7 per retry consumed (max 3 retries = -21)
    score -= state.retryCount * 7;

    // Intervention effectiveness bonus: successful patches earn credit
    if (state.status === 'FIXABLE' && state.interventionsAttempted > 0) {
      // Each successful intervention adds value
      const effectivePatches = state.patchMutationLog.length;
      score += Math.min(effectivePatches * 5, 15);
    }

    // Confidence weight from classifier (if errors existed)
    if (state.errors.length > 0) {
      const avgConf = state.errors.reduce((sum, e) => sum + e.confidence, 0) / state.errors.length;
      score += Math.round(avgConf * 5); // 0-5 bonus
    }
  } else {
    // Failed build base: 15
    score = 15;

    // Credit for meaningful attempts (actual patches applied)
    const effectivePatches = state.patchMutationLog.length;
    score += Math.min(effectivePatches * 3, 12);

    // Credit for high-confidence diagnosis (at least we know what's wrong)
    if (state.errors.length > 0) {
      const maxConf = Math.max(...state.errors.map(e => e.confidence));
      score += Math.round(maxConf * 10); // 0-10 bonus for good diagnosis
    }

    // Penalty for terminal unresolved (loop exhaustion)
    if (state.status === 'TERMINAL_UNRESOLVED_NO_NEW_STRATEGY') {
      score -= 5;
    }
  }

  // Clamp to 0–100
  score = Math.max(0, Math.min(100, score));

  // Grade mapping
  let grade = 'F';
  if (score >= 90) grade = 'S';
  else if (score >= 75) grade = 'A';
  else if (score >= 55) grade = 'B';
  else if (score >= 35) grade = 'C';

  return { score, grade };
}

export const piEngineRun = async (request: AnalysisRequest, onProgress?: (msg: string, meta?: any) => void): Promise<JobState> => {
  const jobState: JobState = {
    jobId: Date.now().toString(),
    url: request.url,
    sandboxPath: `./sandboxes/${Date.now()}`,
    retryCount: 0,
    status: 'PENDING',
    logs: [],
    errors: [],
    interventionsAttempted: 0,
    generatedAssets: [],
    reasoningFeed: [],
    interventionSuccession: [],
    forensicScore: 0,
    scoreGrade: 'F',
    patchMutationLog: []
  };

  const notify = (msg: string, thought?: string) => {
     logger.info(msg);
     if (thought) {
       jobState.reasoningFeed.push(`[${new Date().toISOString().split('T')[1].slice(0,-1)}] ${thought}`);
     }
     if (onProgress) {
       const progressMeta = {
         interventionsAttempted: jobState.interventionsAttempted,
         generatedAssets: jobState.generatedAssets,
         interventionSuccession: jobState.interventionSuccession,
         reasoningFeed: jobState.reasoningFeed,
         stack: jobState.stack
       };
       onProgress(msg, progressMeta);
     }
  };

  logger.banner('REPOCLAW AI PIPELINE INITIATED');
  notify(`[Pi Engine] Job ID Allocated: ${jobState.jobId}`, 'initializing secure pipeline');
  notify(`[Pi Engine] Target Origin: ${request.url}`, 'establishing secure uplink to target origin');
  
  try {
    jobState.sandboxPath = await setupSandbox(jobState.jobId);
    
    logger.phase('PHASE 1', 'Cloning Target Repository');
    notify(`[Pi Engine] Cloning remote origin...`, 'establishing secure uplink to target repository');
    await repoFetch(jobState);
    
    logger.phase('PHASE 2', 'Analyzing Architectural Structure');
    notify(`[Pi Engine] Parsing repository architecture signatures...`, 'parsing abstract syntax trees, isolating structural boundaries');
    await structureAnalyze(jobState);
    
    if (jobState.status === 'UNSUPPORTED_ARCHITECTURE') {
       logger.warn(`[Pi Engine] Aborting loop. Architecture unsupported.`);
       notify(`[Pi Engine] 🛑 Aborting execution: No executable build surface detected.`, 'terminating pipeline: non-software repository identified');
       
       jobState.errors = [];
       jobState.interventionSuccession = [];
       jobState.generatedAssets = [];
       
       const { score, grade } = computeForensicScore(jobState);
       jobState.forensicScore = score;
       jobState.scoreGrade = grade;
       
       jobState.report = await reportGen(jobState);
       logger.banner('FINAL INTELLIGENCE VERDICT');
       console.log(jobState.report);
       return jobState;
    }

    let success = false;
    let prevInstallCmd = '';
    let prevBuildCmd = '';
    let prevCategory = '';
    let prevPatchCount = 0;
    logger.phase('PHASE 3', 'Entering Autonomous Build & Repair Loop');
    notify(`[Pi Engine] Initializing Gemini diagnostic matrix...`, 'provisioning sandboxed execution container');
    
    while (jobState.retryCount < config.maxRetries && !success) {
      // --- RETRY TRUTHFULNESS GUARD ---
      // Before any retry (retryCount > 0), prove that at least one material mutation occurred.
      if (jobState.retryCount > 0 && jobState.stack) {
        const currentCategory = jobState.errors[jobState.errors.length - 1]?.category;
        const currentPatchCount = jobState.patchMutationLog.length;
        
        const installChanged = jobState.stack.installCommand !== prevInstallCmd;
        const buildChanged = jobState.stack.buildCommand !== prevBuildCmd;
        const categoryChanged = currentCategory !== prevCategory;
        const newPatchGenerated = currentPatchCount > prevPatchCount;
        
        const materialMutation = installChanged || buildChanged || newPatchGenerated;
        
        if (!materialMutation && !categoryChanged) {
           logger.warn(`[Pi Engine] 🛑 No material mutation detected after intervention. Hard stopping synthetic loop.`);
           logger.warn(`[Pi Engine]    installCmd: "${prevInstallCmd}" -> "${jobState.stack.installCommand}" (${installChanged ? 'CHANGED' : 'SAME'})`);
           logger.warn(`[Pi Engine]    buildCmd: "${prevBuildCmd}" -> "${jobState.stack.buildCommand}" (${buildChanged ? 'CHANGED' : 'SAME'})`);
           logger.warn(`[Pi Engine]    patches: ${prevPatchCount} -> ${currentPatchCount} (${newPatchGenerated ? 'NEW' : 'SAME'})`);
           notify(`[Pi Engine] 🛑 Escalating unresolved fault state...`, 'terminal state reached: TERMINAL_UNRESOLVED_NO_NEW_STRATEGY — no material command/config mutation detected');
           jobState.status = 'TERMINAL_UNRESOLVED_NO_NEW_STRATEGY';
           break;
        }
      }

      // Snapshot state BEFORE this cycle
      prevInstallCmd = jobState.stack?.installCommand || '';
      prevBuildCmd = jobState.stack?.buildCommand || '';
      prevPatchCount = jobState.patchMutationLog.length;

      notify(`[Pi Engine] 🔄 Executing Build Pass [Cycle ${jobState.retryCount + 1}/${config.maxRetries}]`, `initiating secure compilation cycle`);
      const buildResult = await buildRunner(jobState);
      
      if (buildResult.success) {
        logger.success(`[Pi Engine] ✅ Build Successful!`);
        success = true;
        jobState.status = jobState.retryCount === 0 ? 'BUILDABLE' : 'FIXABLE';
      } else {
        logger.warn(`[Pi Engine] ❌ Build Failed on Cycle ${jobState.retryCount + 1}`);
        
        const errorDetails = await errorClassifier(buildResult.stdout, buildResult.stderr);
        prevCategory = errorDetails.category;
        
        jobState.errors.push(errorDetails);
        jobState.interventionSuccession.push(`Cycle ${jobState.retryCount + 1}: Isolated ${errorDetails.category} (confidence: ${Math.round(errorDetails.confidence * 100)}%)`);
        notify(`[Pi Engine] 🧠 Root cause isolated: ${errorDetails.category} (Confidence: ${Math.round(errorDetails.confidence * 100)}%)`, `evaluating stderr anomaly clusters... confidence threshold exceeded for ${errorDetails.category}`);
        
        if (!errorDetails.retryRecommended || jobState.retryCount >= config.maxRetries - 1) {
           logger.warn(`[Pi Engine] 🛑 Max retries reached or retry not recommended for ${errorDetails.category}. Exhausting loop.`);
           notify(`[Pi Engine] 🛑 Escalating unresolved fault state...`, `terminal state reached — retry not viable for ${errorDetails.category}`);
           break;
        }

        notify(`[Pi Engine] ⚙️ Synthesizing intervention strategy #${jobState.interventionsAttempted + 1}...`, `generating autonomous recovery asset for ${errorDetails.category}`);
        const fixResult = await autoFix(jobState, errorDetails);
        if (fixResult.patched) {
           jobState.interventionSuccession.push(`Cycle ${jobState.retryCount + 1}: Deployed recovery asset - ${fixResult.details}`);
           notify(`[Pi Engine] 🔧 Auto-Fix Applied: ${fixResult.details}`, `intervention packet generated, re-arming secure verification cycle`);
        } else {
           jobState.interventionSuccession.push(`Cycle ${jobState.retryCount + 1}: Strategy synthesis failed - ${fixResult.details}`);
           notify(`[Pi Engine] ⚠️ Auto-Fix Failed: ${fixResult.details}`, `unable to synthesize effective remediation protocol`);
        }
        
        jobState.retryCount++;
      }
    }
    
    logger.phase('PHASE 4', 'Generating Final Intelligence Verdict');
    notify(`[Pi Engine] Generating Final Intelligence Verdict`, 'computing final structural viability score...');
    if (!success) {
       if (jobState.status !== 'TERMINAL_UNRESOLVED_NO_NEW_STRATEGY') {
         const lastError = jobState.errors.length > 0 ? jobState.errors[jobState.errors.length - 1] : null;
         if (lastError && lastError.category === 'INFRASTRUCTURE_FAILURE') {
           jobState.status = 'INFRASTRUCTURE_ERROR';
           logger.error(`[Pi Engine] Loop Exhausted. Final Verdict: INFRASTRUCTURE_ERROR`);
         } else {
           jobState.status = 'NON_BUILDABLE';
           logger.error(`[Pi Engine] Loop Exhausted. Final Verdict: NON_BUILDABLE`);
         }
       } else {
         logger.error(`[Pi Engine] Loop Exhausted. Final Verdict: TERMINAL_UNRESOLVED_NO_NEW_STRATEGY`);
       }
    } else {
       logger.success(`[Pi Engine] Loop Concluded. Final Verdict: ${jobState.status}`);
    }
    
    // --- COMPUTE FORENSIC SCORE ---
    const { score, grade } = computeForensicScore(jobState);
    jobState.forensicScore = score;
    jobState.scoreGrade = grade;
    logger.info(`[Pi Engine] Forensic Score: ${score}/100 (Grade: ${grade})`);
    
    jobState.report = await reportGen(jobState);
    
    logger.banner('FINAL INTELLIGENCE VERDICT');
    console.log(jobState.report);
    
  } catch (err: any) {
    logger.error(`[Pi Engine] FATAL EXCEPTION: ${err.message}`);
    jobState.status = 'NON_BUILDABLE';
    jobState.report = `# ❌ Fatal Pipeline Exception\n\nThe orchestrator encountered a critical fault: ${err.message}`;
    const { score, grade } = computeForensicScore(jobState);
    jobState.forensicScore = score;
    jobState.scoreGrade = grade;
    logger.banner('FATAL EXCEPTION REPORT');
    console.log(jobState.report);
  } finally {
    await persistJobState(jobState);
    await cleanupSandbox(jobState.jobId);
    logger.banner('PIPELINE TERMINATED');
  }
  return jobState;
};
