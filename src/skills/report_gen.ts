/**
 * @file src/skills/report_gen.ts
 * Role: Generates structured markdown report from pipeline provenance data.
 * No fabricated metrics. Reports only what was measured.
 */
import { JobState } from '../types';
import { logger } from '../utils/logger';

export const reportGen = async (state: JobState): Promise<string> => {
  logger.info('Skill: report_gen -> Generating provenance report');

  const verdict = state.status;
  const provenance = state.provenance;

  // ━━━ VERDICT HEADER ━━━
  let headerEmoji = '❌';
  let verdictLabel = 'BUILD_FAILED';

  if (verdict === 'BUILD_SUCCEEDED') { headerEmoji = '✅'; verdictLabel = 'BUILD_SUCCEEDED'; }
  else if (verdict === 'REPAIRED') { headerEmoji = '🔧'; verdictLabel = 'REPAIRED'; }
  else if (verdict === 'UNSUPPORTED') { headerEmoji = '⬜'; verdictLabel = 'UNSUPPORTED'; }
  else if (verdict === 'INFRA_FAILED') { headerEmoji = '🏗️'; verdictLabel = 'INFRA_FAILED'; }
  else if (verdict === 'REPAIR_EXHAUSTED') { headerEmoji = '🛑'; verdictLabel = 'REPAIR_EXHAUSTED'; }
  else if (verdict === 'SANDBOX_VIOLATION') { headerEmoji = '🔒'; verdictLabel = 'SANDBOX_VIOLATION'; }
  else if (verdict === 'NON_DETERMINISTIC_FAILURE') { headerEmoji = '⚠️'; verdictLabel = 'NON_DETERMINISTIC_FAILURE'; }
  else { verdictLabel = String(verdict); }

  const stackStr = state.stack
    ? `**${state.stack.language}** (${state.stack.packageManager})`
    : '*Unknown*';

  let report = `# ${headerEmoji} RepoClaw Build Recovery Report\n\n`;
  report += `**Verdict:** \`${verdictLabel}\`\n\n`;

  // ━━━ PIPELINE METADATA ━━━
  if (provenance) {
    report += `### Pipeline Execution\n`;
    report += `- **Pipeline Version:** \`${provenance.pipelineVersion}\`\n`;
    report += `- **Job ID:** \`${provenance.jobId}\`\n`;
    report += `- **Duration:** ${provenance.totalDurationMs}ms\n`;
    report += `- **Sandbox Image:** \`${provenance.sandboxImage}\`\n`;
    report += `- **Container Limits:** \`${provenance.dockerFlags.filter(f => f.startsWith('--memory') || f.startsWith('--cpus') || f.startsWith('--pids')).join(', ') || 'default'}\`\n`;
    report += `- **Total Cycles:** ${provenance.totalCycles}\n`;
    report += `- **Mutations Applied:** ${provenance.totalMutationsApplied}\n`;
    report += `\n---\n\n`;
  }

  // ━━━ DETECTED STACK ━━━
  report += `### Detected Build System\n`;
  report += `- **Target:** [${state.url}](${state.url})\n`;
  report += `- **Stack:** ${stackStr}\n`;
  if (state.stack) {
    report += `- **Lockfile Present:** ${state.stack.lockfilePresent ? 'Yes' : 'No'}\n`;
    report += `- **Build Script Present:** ${state.stack.buildScriptPresent !== false ? 'Yes' : 'No'}\n`;
    report += `- **Install Command:** \`${state.stack.installCommand}\`\n`;
    report += `- **Build Command:** \`${state.stack.buildCommand}\`\n`;
  }
  report += `\n---\n\n`;

  // ━━━ COMMAND MUTATION DIFFS ━━━
  if (state.commandMutations && state.commandMutations.length > 0) {
    report += `### Command Mutations\n\n`;
    state.commandMutations.forEach(mut => {
      report += `**Cycle ${mut.cycle} — ${mut.type} (surface: \`${mut.surface}\`)**\n`;
      report += `\`\`\`diff\n- ${mut.before || '(empty)'}\n+ ${mut.after}\n\`\`\`\n\n`;
    });
    report += `---\n\n`;
  }

  // ━━━ REPAIR TRACE TABLE ━━━
  if (state.repairTrace.length > 0) {
    report += `### Repair Trace\n\n`;
    report += `| Cycle | Category | Match Strength | Source | Strategy | Safety | Result |\n`;
    report += `|-------|----------|---------------|--------|----------|--------|--------|\n`;
    state.repairTrace.forEach(trace => {
      const strength = `${Math.round(trace.matchStrength * 100)}%`;
      const result = trace.rejectionReason ? `Rejected: ${trace.rejectionReason}` : (trace.rolledBack ? 'Rolled back' : 'Applied');
      report += `| ${trace.cycle} | \`${trace.failureCategory}\` | ${strength} | ${trace.classificationSource} | ${trace.repairStrategy || 'none'} | ${trace.repairSafety || 'N/A'} | ${result} |\n`;
    });
    report += `\n---\n\n`;
  }

  // ━━━ BUILD OUTPUT ━━━
  const lastLog = state.logs.length > 0 ? state.logs[state.logs.length - 1] : null;
  if (lastLog) {
    report += `### Final Build Output\n`;
    report += `**Exit Code:** \`${lastLog.exitCode}\`\n\n`;
    if (lastLog.stderr && lastLog.stderr.trim().length > 0) {
      report += `#### STDERR\n\`\`\`\n${lastLog.stderr.substring(0, 1000)}\n\`\`\`\n\n`;
    }
    if (lastLog.stdout && lastLog.stdout.trim().length > 0) {
      report += `#### STDOUT\n\`\`\`\n${lastLog.stdout.substring(0, 500)}\n\`\`\`\n\n`;
    }
    report += `---\n\n`;
  }

  // ━━━ SUMMARY ━━━
  report += `### Summary\n> `;

  if (verdict === 'BUILD_SUCCEEDED') {
    report += `Repository built successfully with zero failures. `;
    if (lastLog?.stdout) {
      if (lastLog.stdout.includes('built in')) { const m = lastLog.stdout.match(/(built in [\d.]+s)/); if (m) report += `Bundle ${m[1]}. `; }
      if (lastLog.stdout.includes('added') && lastLog.stdout.includes('packages')) { const m = lastLog.stdout.match(/added (\d+) packages/); if (m) report += `${m[1]} packages resolved. `; }
    }
    report += `\n`;

  } else if (verdict === 'REPAIRED') {
    const lastError = state.errors[state.errors.length - 1];
    const lastTrace = state.repairTrace[state.repairTrace.length - 1];
    report += `Build initially failed with ${lastError?.category || 'unknown'} (match strength: ${lastError ? Math.round(lastError.matchStrength * 100) : 0}%). `;
    report += `Applied repair strategy \`${lastTrace?.repairStrategy || 'unknown'}\` (safety: ${lastTrace?.repairSafety || 'unknown'}). `;
    report += `Build succeeded after ${state.retryCount} retry cycle(s).\n`;

  } else if (verdict === 'UNSUPPORTED') {
    report += `No executable build surface detected. Repository contains documentation, configuration, or static assets only.\n`;

  } else if (verdict === 'REPAIR_EXHAUSTED') {
    const lastError = state.errors[state.errors.length - 1];
    report += `Repair loop exhausted after ${state.retryCount} cycle(s). Last failure: ${lastError?.category || 'unknown'} (match strength: ${lastError ? Math.round(lastError.matchStrength * 100) : 0}%). `;
    report += `No further material mutations available within policy boundaries.\n`;

  } else if (verdict === 'INFRA_FAILED') {
    report += `Build failed due to infrastructure issues external to the codebase. Docker daemon, network, or host environment requires manual remediation.\n`;

  } else {
    const lastError = state.errors.length > 0 ? state.errors[state.errors.length - 1] : null;
    report += `Build failed after ${state.retryCount} cycle(s). Terminal failure: ${lastError?.category || 'unknown'}. ${state.interventionsAttempted} repair attempt(s) made.\n`;
  }

  return report;
};
