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

export const piEngineRun = async (request: AnalysisRequest, onProgress?: (msg: string) => void) => {
  const notify = (msg: string) => {
     logger.info(msg);
     if (onProgress) onProgress(msg);
  };

  const jobState: JobState = {
    jobId: Date.now().toString(),
    url: request.url,
    sandboxPath: `./sandboxes/${Date.now()}`,
    retryCount: 0,
    status: 'PENDING',
    logs: [],
    errors: []
  };

  logger.banner('REPOCLAW AI PIPELINE INITIATED');
  notify(`[Pi Engine] Job ID Allocated: ${jobState.jobId}`);
  notify(`[Pi Engine] Target Origin: ${request.url}`);
  
  try {
    jobState.sandboxPath = await setupSandbox(jobState.jobId);
    
    logger.phase('PHASE 1', 'Cloning Target Repository');
    await repoFetch(jobState);
    
    logger.phase('PHASE 2', 'Analyzing Architectural Structure');
    await structureAnalyze(jobState);
    
    let success = false;
    logger.phase('PHASE 3', 'Entering Autonomous Build & Repair Loop');
    
    while (jobState.retryCount < config.maxRetries && !success) {
      notify(`[Pi Engine] 🔄 Executing Build Pass [Cycle ${jobState.retryCount + 1}/${config.maxRetries}]`);
      const buildResult = await buildRunner(jobState);
      
      if (buildResult.success) {
        logger.success(`[Pi Engine] ✅ Build Successful!`);
        success = true;
        jobState.status = jobState.retryCount === 0 ? 'BUILDABLE' : 'FIXABLE';
      } else {
        logger.warn(`[Pi Engine] ❌ Build Failed on Cycle ${jobState.retryCount + 1}`);
        
        const errorDetails = await errorClassifier(buildResult.stdout, buildResult.stderr);
        jobState.errors.push(errorDetails);
        notify(`[Pi Engine] 🧠 Classified Error: ${errorDetails.category} (Confidence: ${Math.round(errorDetails.confidence * 100)}%)`);
        
        if (!errorDetails.retryRecommended || jobState.retryCount >= config.maxRetries - 1) {
           logger.warn(`[Pi Engine] 🛑 Max retries reached or retry not recommended. Exhausting loop.`);
           break;
        }

        const fixResult = await autoFix(jobState, errorDetails);
        if (fixResult.patched) {
           logger.success(`[Pi Engine] 🔧 Auto-Fix Applied: ${fixResult.details}`);
        } else {
           logger.warn(`[Pi Engine] ⚠️ Auto-Fix Failed or No Strategy Available.`);
        }
        
        jobState.retryCount++;
      }
    }
    
    logger.phase('PHASE 4', 'Generating Final Intelligence Verdict');
    if (!success) {
       jobState.status = 'NON_BUILDABLE';
       logger.error(`[Pi Engine] Loop Exhausted. Final Verdict: NON_BUILDABLE`);
    } else {
       logger.success(`[Pi Engine] Loop Concluded. Final Verdict: ${jobState.status}`);
    }
    
    jobState.report = await reportGen(jobState);
    
    logger.banner('FINAL INTELLIGENCE VERDICT');
    console.log(jobState.report);
    
  } catch (err: any) {
    logger.error(`[Pi Engine] FATAL EXCEPTION: ${err.message}`);
    jobState.status = 'NON_BUILDABLE';
    jobState.report = `# ❌ Fatal Pipeline Exception\n\nThe orchestrator encountered a critical fault: ${err.message}`;
    logger.banner('FATAL EXCEPTION REPORT');
    console.log(jobState.report);
  } finally {
    await persistJobState(jobState);
    await cleanupSandbox(jobState.jobId);
    logger.banner('PIPELINE TERMINATED');
  }
};
