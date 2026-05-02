import { AnalysisRequest, JobState, ConfidenceMatrix } from '../types';
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

function computeForensicScore(state: JobState): { score: number; grade: string } {
  let score = 0;

  if (state.status === 'UNSUPPORTED_ARCHITECTURE') {
    return { score: 0, grade: 'N/A' };
  }
  if (state.status === 'INFRASTRUCTURE_ERROR') {
    return { score: -1, grade: 'I' };
  }

  const isSuccess = state.status === 'BUILDABLE' || state.status === 'FIXABLE';

  if (isSuccess) {
    score = state.status === 'BUILDABLE' ? 95 : 70;
    score -= state.retryCount * 7;
    if (state.status === 'FIXABLE' && state.interventionsAttempted > 0) {
      const effectivePatches = state.patchMutationLog.length;
      score += Math.min(effectivePatches * 5, 15);
    }
    if (state.errors.length > 0) {
      const avgConf = state.errors.reduce((sum, e) => sum + e.confidence, 0) / state.errors.length;
      score += Math.round(avgConf * 5);
    }
  } else {
    score = 15;
    const effectivePatches = state.patchMutationLog.length;
    score += Math.min(effectivePatches * 3, 12);
    if (state.errors.length > 0) {
      const maxConf = Math.max(...state.errors.map(e => e.confidence));
      score += Math.round(maxConf * 10);
    }
    if (state.status === 'TERMINAL_UNRESOLVED_NO_NEW_STRATEGY') {
      score -= 5;
    }
  }

  score = Math.max(0, Math.min(100, score));

  let grade = 'F';
  if (score >= 90) grade = 'S';
  else if (score >= 75) grade = 'A';
  else if (score >= 55) grade = 'B';
  else if (score >= 35) grade = 'C';

  return { score, grade };
}

function computeConfidenceMatrix(state: JobState): ConfidenceMatrix {
  let manifestIntegrity = 100;
  let dependencyStability = 100;
  let buildSurface = 100;
  let recoverability = 100;
  let environmentRisk = 10; // Low risk by default

  const errorCats = state.errors.map(e => e.category);
  
  if (errorCats.includes('TYPESCRIPT_CONFIG_FAILURE') || errorCats.includes('VITE_CONFIG_FAILURE')) manifestIntegrity -= 30;
  
  if (errorCats.includes('MISSING_DEPENDENCY') || errorCats.includes('DEPENDENCY_CONFLICT')) dependencyStability -= 40;
  
  if (errorCats.includes('BUILD_SCRIPT_MISSING') || errorCats.includes('BUILD_FAILURE') || errorCats.includes('BUNDLER_FAILURE')) buildSurface -= 40;
  if (state.status === 'UNSUPPORTED_ARCHITECTURE') buildSurface = 0;

  if (state.status === 'NON_BUILDABLE' || state.status === 'TERMINAL_UNRESOLVED_NO_NEW_STRATEGY') recoverability -= 60;
  if (state.interventionsAttempted > 0 && state.status === 'FIXABLE') recoverability = 95;

  if (errorCats.includes('INFRASTRUCTURE_FAILURE') || errorCats.includes('OUT_OF_MEMORY') || errorCats.includes('PERMISSION_FAILURE')) environmentRisk += 80;

  return {
    manifestIntegrity: Math.max(0, Math.min(100, manifestIntegrity)),
    dependencyStability: Math.max(0, Math.min(100, dependencyStability)),
    buildSurface: Math.max(0, Math.min(100, buildSurface)),
    recoverability: Math.max(0, Math.min(100, recoverability)),
    environmentRisk: Math.max(0, Math.min(100, environmentRisk))
  };
}

export const piEngineRun = async (request: AnalysisRequest, onProgress?: (msg: string, meta?: any) => void): Promise<JobState> => {
  const jobId = Date.now().toString();
  const jobState: JobState = {
    jobId,
    url: request.url,
    sandboxPath: `./sandboxes/${jobId}`,
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
    patchMutationLog: [],
    commandMutations: [],
    protocolIdentity: {
      version: 'CLAW-R7',
      sandboxImage: 'repoclaw-sandbox:alpine',
      fingerprint: require('crypto').createHash('sha256').update(jobId + request.url).digest('hex').substring(0, 16).toUpperCase(),
      buildChainSignature: 'VERIFIED_ISOLATED'
    }
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
       jobState.confidenceMatrix = computeConfidenceMatrix(jobState);
       
       jobState.report = await reportGen(jobState);
       logger.banner('FINAL INTELLIGENCE VERDICT');
       console.log(jobState.report);
       return jobState;
    }

    // Update protocol identity with actual sandbox image
    if (jobState.stack && jobState.protocolIdentity) {
      const imageMap: Record<string, string> = {
        'Node.js': 'node:20-alpine', 'Python': 'python:3.11-alpine', 'Go': 'golang:1.21-alpine',
        'Rust': 'rust:1.75-alpine', 'C/C++': 'alpine:latest', 'Java': 'maven:3.9-eclipse-temurin-21-alpine',
        'PHP': 'composer:2', 'Shell': 'alpine:latest'
      };
      jobState.protocolIdentity.sandboxImage = imageMap[jobState.stack.language] || 'node:20-alpine';
    }

    let success = false;
    let prevInstallCmd = '';
    let prevBuildCmd = '';
    let prevCategory = '';
    let prevPatchCount = 0;
    logger.phase('PHASE 3', 'Entering Autonomous Build & Repair Loop');
    notify(`[Pi Engine] Initializing Gemini diagnostic matrix...`, 'provisioning sandboxed execution container');
    
    while (jobState.retryCount < config.maxRetries && !success) {
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
           notify(`[Pi Engine] 🛑 Escalating unresolved fault state...`, 'terminal state reached: TERMINAL_UNRESOLVED_NO_NEW_STRATEGY — no material command/config mutation detected');
           jobState.status = 'TERMINAL_UNRESOLVED_NO_NEW_STRATEGY';
           break;
        }
      }

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
        
        // Record Explicit Command Mutations
        if (jobState.stack) {
           if (jobState.stack.installCommand !== prevInstallCmd) {
              jobState.commandMutations.push({
                 cycle: jobState.retryCount + 1,
                 type: 'INSTALL',
                 before: prevInstallCmd,
                 after: jobState.stack.installCommand || '',
                 asset: fixResult.generatedFilename || 'None'
              });
           }
           if (jobState.stack.buildCommand !== prevBuildCmd) {
              jobState.commandMutations.push({
                 cycle: jobState.retryCount + 1,
                 type: 'BUILD',
                 before: prevBuildCmd,
                 after: jobState.stack.buildCommand || '',
                 asset: fixResult.generatedFilename || 'None'
              });
           }
        }

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
    
    const { score, grade } = computeForensicScore(jobState);
    jobState.forensicScore = score;
    jobState.scoreGrade = grade;
    jobState.confidenceMatrix = computeConfidenceMatrix(jobState);
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
    jobState.confidenceMatrix = computeConfidenceMatrix(jobState);
    logger.banner('FATAL EXCEPTION REPORT');
    console.log(jobState.report);
  } finally {
    await persistJobState(jobState);
    await cleanupSandbox(jobState.jobId);
    logger.banner('PIPELINE TERMINATED');
  }
  return jobState;
};
