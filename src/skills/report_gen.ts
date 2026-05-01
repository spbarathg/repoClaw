/**
 * @file src/skills/report_gen.ts
 * Role: Assembles the final Markdown report for delivery.
 */
import { JobState } from '../types';
import { logger } from '../utils/logger';

export const reportGen = async (state: JobState): Promise<string> => {
  logger.info('Skill: report_gen -> Generating polished markdown report');

  let headerEmoji = '❌';
  let badge = '![Non-Buildable](https://img.shields.io/badge/Verdict-Non--Buildable-red?style=for-the-badge)';

  if (state.status === 'BUILDABLE') {
    headerEmoji = '✅';
    badge = '![Buildable](https://img.shields.io/badge/Verdict-Buildable-brightgreen?style=for-the-badge)';
  } else if (state.status === 'FIXABLE') {
    headerEmoji = '🔧';
    badge = '![Fixable](https://img.shields.io/badge/Verdict-Fixable-yellow?style=for-the-badge)';
  }

  const stackStr = state.stack
    ? `**${state.stack.language}** (${state.stack.packageManager})`
    : '*Unknown*';

  let report = `# ${headerEmoji} RepoClaw Analysis Verdict\n\n`;
  report += `${badge}\n\n`;
  report += `### 📡 Repository Intelligence\n`;
  report += `- **Target Origin:** [${state.url}](${state.url})\n`;
  report += `- **Detected Architecture:** ${stackStr}\n`;
  if (state.stack) {
    report += `- **Inferred Install:** \`${state.stack.installCommand}\`\n`;
    report += `- **Inferred Build:** \`${state.stack.buildCommand}\`\n`;
  }
  report += `\n---\n\n`;

  if (state.errors.length > 0) {
    report += `### 🤖 Autonomous Correction Cycle\n\n`;
    report += `| Cycle | Classified Error | Confidence | Patch Applied |\n`;
    report += `|-------|------------------|------------|---------------|\n`;
    state.errors.forEach((err, i) => {
      report += `| **${i + 1}** | \`${err.category}\` | ${Math.round(err.confidence * 100)}% | ${err.suggestedFix} |\n`;
    });
    report += `\n---\n\n`;
  }

  const lastLog = state.logs.length > 0 ? state.logs[state.logs.length - 1] : null;

  if (lastLog) {
    report += `### 🛠 Final Build Execution Summary\n`;
    report += `**Container Exit Code:** \`${lastLog.exitCode}\`\n\n`;
    if (lastLog.stderr && lastLog.stderr.trim().length > 0) {
      report += `#### \`STDERR\`\n\`\`\`bash\n${lastLog.stderr.substring(0, 1000)}\n\`\`\`\n\n`;
    }
    if (lastLog.stdout && lastLog.stdout.trim().length > 0) {
      report += `#### \`STDOUT\`\n\`\`\`bash\n${lastLog.stdout.substring(0, 500)}...\n\`\`\`\n\n`;
    }
  }

  report += `### 🧠 Final AI Reasoning\n`;
  report += `> `;
  if (state.status === 'BUILDABLE') {
    report += `The repository architecture was successfully parsed and compiled flawlessly on the first execution pass. Zero configuration or missing dependency anomalies were detected within the target environment.\n`;
  } else if (state.status === 'FIXABLE') {
    report += `The repository initially suffered a catastrophic build failure. However, the RepoClaw Intelligence layer autonomously intercepted the error stream, correctly classified ${state.errors.length} systemic flaw(s), and dynamically injected deterministic code patches to force a successful compilation.\n`;
  } else {
    const lastError = state.errors.length > 0 ? state.errors[state.errors.length - 1] : null;
    if (lastError && lastError.category === 'UNKNOWN') {
      report += `The build failed due to an UNKNOWN infrastructure or environmental anomaly. The agent exhausted ${state.retryCount} sequential autonomous retry cycles, but the failure appears to be external to the codebase itself. The repository may be perfectly valid but requires manual infrastructure inspection.\n`;
    } else {
      report += `The repository is fundamentally broken. The agent exhausted ${state.retryCount} sequential autonomous retry cycles without achieving a successful build state. Deep architectural missing dependencies, hardcoded private module references, or syntax errors are likely present.\n`;
    }
  }

  return report;
};
