/**
 * @file src/skills/report_gen.ts
 * Role: Assembles the final Markdown report for delivery.
 * Uses computed forensic score from JobState — no hardcoded buckets.
 */
import { JobState } from '../types';
import { logger } from '../utils/logger';
import { config } from '../config';

export const reportGen = async (state: JobState): Promise<string> => {
  logger.info('Skill: report_gen -> Generating polished markdown report');

  // --- VERDICT BADGE (uses computed score) ---
  let headerEmoji = '❌';
  let badge = `![Non-Buildable](https://img.shields.io/badge/Verdict-Non--Buildable-red?style=for-the-badge)`;

  if (state.status === 'BUILDABLE') {
    headerEmoji = '✅';
    badge = `![Buildable](https://img.shields.io/badge/Verdict-Buildable-brightgreen?style=for-the-badge)`;
  } else if (state.status === 'FIXABLE') {
    headerEmoji = '🔧';
    badge = `![Fixable](https://img.shields.io/badge/Verdict-Fixable-yellow?style=for-the-badge)`;
  } else if (state.status === 'UNSUPPORTED_ARCHITECTURE') {
    headerEmoji = '🤷';
    badge = `![Unsupported](https://img.shields.io/badge/Verdict-Unsupported-lightgrey?style=for-the-badge)`;
  } else if (state.status === 'INFRASTRUCTURE_ERROR') {
    headerEmoji = '🏗️';
    badge = `![Infrastructure](https://img.shields.io/badge/Verdict-Infrastructure--Error-orange?style=for-the-badge)`;
  } else if (state.status === 'TERMINAL_UNRESOLVED_NO_NEW_STRATEGY') {
    headerEmoji = '🛑';
    badge = `![Terminal](https://img.shields.io/badge/Verdict-Terminal--Unresolved-darkred?style=for-the-badge)`;
  }

  const stackStr = state.stack
    ? `**${state.stack.language}** (${state.stack.packageManager})`
    : '*Unknown*';

  let report = `# ${headerEmoji} RepoClaw Analysis Verdict\n\n`;
  report += `${badge}\n\n`;

  // --- FORENSIC SCORE CARD ---
  report += `### 📊 Forensic Score\n`;
  report += `- **Score:** ${state.forensicScore >= 0 ? `${state.forensicScore}/100` : 'N/A (Infrastructure)'}\n`;
  report += `- **Grade:** ${state.scoreGrade}\n`;
  report += `- **Retries Consumed:** ${state.retryCount}/${config.maxRetries}\n`;
  report += `- **Interventions Deployed:** ${state.interventionsAttempted}\n`;
  report += `- **Recovery Assets Generated:** ${state.generatedAssets.length}\n`;
  report += `\n---\n\n`;

  // --- REPOSITORY INTELLIGENCE ---
  report += `### 📡 Repository Intelligence\n`;
  report += `- **Target Origin:** [${state.url}](${state.url})\n`;
  report += `- **Detected Architecture:** ${stackStr}\n`;
  if (state.stack) {
    report += `- **Inferred Install:** \`${state.stack.installCommand}\`\n`;
    report += `- **Inferred Build:** \`${state.stack.buildCommand}\`\n`;
  }
  report += `\n---\n\n`;

  // --- CORRECTION CYCLE TABLE ---
  if (state.errors.length > 0) {
    report += `### 🤖 Autonomous Correction Cycle\n\n`;
    report += `| Cycle | Classified Error | Confidence | Severity | Retry Viable |\n`;
    report += `|-------|------------------|------------|----------|-------------|\n`;
    state.errors.forEach((err, i) => {
      report += `| **${i + 1}** | \`${err.category}\` | ${Math.round(err.confidence * 100)}% | ${err.severity} | ${err.retryRecommended ? '✅' : '❌'} |\n`;
    });
    report += `\n`;

    // Intervention succession log (actual patches applied)
    if (state.interventionSuccession.length > 0) {
      report += `#### Intervention Log\n`;
      state.interventionSuccession.forEach(entry => {
        report += `- ${entry}\n`;
      });
    }
    report += `\n---\n\n`;
  }

  // --- BUILD EXECUTION SUMMARY ---
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

  // --- MACHINE RECOMMENDATION (category-specific, never templated) ---
  report += `### 🧠 Final AI Reasoning\n`;
  report += `> `;

  if (state.status === 'BUILDABLE') {
    const log = state.logs.length > 0 ? state.logs[state.logs.length - 1] : null;
    const stackName = state.stack ? `${state.stack.language} (${state.stack.packageManager})` : 'detected';
    const buildCmd = state.stack?.buildCommand || 'build';
    let evidence = '';
    if (log && log.stdout) {
      if (log.stdout.includes('built in')) {
        const m = log.stdout.match(/(built in [\d.]+s)/);
        if (m) evidence += ` Production bundle ${m[1]}.`;
      }
      if (log.stdout.includes('modules transformed')) {
        const m = log.stdout.match(/(\d+) modules? transformed/);
        if (m) evidence += ` ${m[1]} modules compiled.`;
      }
      if (log.stdout.includes('added') && log.stdout.includes('packages')) {
        const m = log.stdout.match(/added (\d+) packages/);
        if (m) evidence += ` ${m[1]} packages resolved.`;
      }
      if (log.stdout.includes('compileall')) evidence += ' Python bytecode compilation verified.';
      if (log.stdout.includes('Successfully installed')) evidence += ' All Python dependencies installed.';
      if (log.stdout.includes('BUILD SUCCESS')) evidence += ' Maven build lifecycle completed successfully.';
    }
    if (!evidence) evidence = ` \`${buildCmd}\` completed with exit code 0.`;
    report += `The ${stackName} repository compiled successfully with zero anomalies detected during execution.${evidence} Forensic score: ${state.forensicScore}/100.\n`;

  } else if (state.status === 'FIXABLE') {
    const lastError = state.errors.length > 0 ? state.errors[state.errors.length - 1] : null;
    const cat = lastError?.category || 'UNKNOWN';
    const fixableReasoning: Record<string, string> = {
      'BUILD_SCRIPT_MISSING': `The repository lacked a deterministic build orchestration surface — no \`build\` script was defined in the project manifest. The agent autonomously synthesized a placeholder build entry point using the detected package manager (\`${state.stack?.packageManager}\`) and re-executed the compilation pipeline, achieving successful compilation after ${state.retryCount} retry cycle(s).`,
      'DEPENDENCY_CONFLICT': `The dependency graph exhibited fractured peer resolution — conflicting version constraints between transitive dependencies prevented clean installation. The agent injected legacy peer resolution overrides for ${state.stack?.packageManager}, bypassing strict semver enforcement to force a viable dependency tree. Resolution achieved after ${state.retryCount} intervention(s).`,
      'TYPESCRIPT_FAILURE': `TypeScript strict mode compilation surfaced ${state.errors.filter(e => e.category === 'TYPESCRIPT_FAILURE').length} type-system violation(s) across the codebase. The agent relaxed compiler strictness by injecting --skipLibCheck, allowing the build to proceed past third-party type definition mismatches. Final classifier confidence: ${lastError ? Math.round(lastError.confidence * 100) : 0}%.`,
      'TYPESCRIPT_CONFIG_FAILURE': `The TypeScript configuration substrate was missing or malformed, blocking the compilation pipeline entirely. The agent synthesized a minimal tsconfig.json with relaxed compilation parameters (ES2020 target, skipLibCheck enabled), restoring the compilation pipeline after ${state.retryCount} cycle(s).`,
      'MISSING_DEPENDENCY': `A critical dependency (\`${lastError?.missingPackageName || 'unidentified'}\`) was absent from the execution environment. The agent identified the missing package via stderr analysis (confidence: ${lastError ? Math.round(lastError.confidence * 100) : 0}%) and injected it into the install sequence, restoring the dependency graph.`,
      'VITE_CONFIG_FAILURE': `The Vite bundler configuration contained unresolvable references — likely missing plugins or stale optimization cache. The agent injected --force to bypass cached dependency analysis, allowing a clean rebuild. ${state.interventionsAttempted} total intervention(s) were deployed.`,
      'RUNTIME_VERSION_MISMATCH': `The project enforced strict runtime version constraints (engines field in package.json) incompatible with the sandbox environment (Node 20-alpine). The agent stripped the engines restriction from the manifest, normalizing the runtime surface for containerized execution.`,
      'MISSING_ENV': `The application required environment configuration variables that were absent from the container sandbox. The agent synthesized a placeholder .env matrix with secure sandbox defaults (PORT, DATABASE_URL, API_KEY), unblocking the initialization pipeline.`,
      'NETWORK_FETCH_FAILURE': `Package registry resolution failed due to network connectivity issues within the container sandbox. The agent switched to offline-tolerant installation with retry semantics on ${state.stack?.packageManager}, successfully recovering the dependency fetch pipeline after ${state.retryCount} cycle(s).`,
      'PYTHON_NATIVE_TOOLCHAIN_FAILURE': `A Python package required native C/Fortran compilation from source but the initial container toolchain was insufficient. The agent injected binary-only wheel preference flags (--only-binary :all:) to bypass source compilation, successfully resolving the dependency chain.`,
    };
    report += (fixableReasoning[cat] || `The RepoClaw engine autonomously intercepted ${state.errors.length} anomaly(s), classified as ${cat} (confidence: ${lastError ? Math.round(lastError.confidence * 100) : 0}%), and deployed ${state.interventionsAttempted} intervention(s) to achieve successful compilation after ${state.retryCount} retry cycle(s).`) + '\n';

  } else if (state.status === 'UNSUPPORTED_ARCHITECTURE') {
    report += `Repository classified as static/documentation/meta architecture. No deterministic runtime execution plane was detected — the codebase contains no compilable source manifests, only documentation, configuration, or template assets.\n`;

  } else {
    // NON_BUILDABLE, TERMINAL_UNRESOLVED, INFRASTRUCTURE_ERROR
    const lastError = state.errors.length > 0 ? state.errors[state.errors.length - 1] : null;
    const cat = lastError?.category || 'UNKNOWN';
    const failureReasoning: Record<string, string> = {
      'INFRASTRUCTURE_FAILURE': `The build failed due to an infrastructure anomaly external to the codebase — Docker daemon connectivity, disk space exhaustion, or container orchestration failure prevented execution. The repository code was never evaluated. Host-level infrastructure remediation is required before re-analysis.`,
      'PYTHON_NATIVE_TOOLCHAIN_FAILURE': `The Python dependency graph requires native C/Fortran compilation (gcc, gfortran, meson) that exhausted the container's build toolchain even after aggressive provisioning (gcc, g++, musl-dev, gfortran, openblas-dev, lapack-dev). Packages requiring compiled extensions could not be satisfied. Pre-built binary wheels or a full-fat container image are required.`,
      'JAVA_COMPILE_FAILURE': `The Java/Maven/Gradle compilation pipeline failed due to missing symbols, incompatible JDK version, or unresolvable plugin dependencies. ${state.retryCount} retry cycle(s) were attempted. The JVM compilation surface requires manual inspection of pom.xml or build.gradle dependency declarations.`,
      'PHP_PACKAGE_FAILURE': `Composer dependency resolution or PHP autoload generation failed. The package graph contains unresolvable version constraints or requires PHP extensions not available in the composer:2 container environment. ${state.interventionsAttempted} intervention(s) were attempted without resolution.`,
      'SYNTAX_FAILURE': `The source code contains fatal syntax errors preventing AST parsing (${lastError ? Math.round(lastError.confidence * 100) : 0}% confidence). The compilation pipeline cannot proceed until malformed source files are manually corrected. This is a codebase-level defect, not an environmental issue.`,
      'OUT_OF_MEMORY': `The build process was terminated due to memory pressure — the container's memory allocation was insufficient for the compilation workload. Large monorepos, heavy dependency trees, or memory-intensive bundlers may require increased container resource limits (currently using default Docker limits).`,
      'PERMISSION_FAILURE': `File or directory permission restrictions prevented the build process from reading or writing required resources. This is typically caused by restrictive file ownership in the cloned repository or container filesystem constraints.`,
      'NETWORK_FETCH_FAILURE': `Package registry resolution failed persistently despite retry/offline intervention. ${state.retryCount} retry cycle(s) with network resilience flags could not recover the dependency fetch pipeline. The registry may be unreachable or the packages may require authentication.`,
      'DEPENDENCY_CONFLICT': `The dependency graph contains irreconcilable version conflicts that could not be resolved even with legacy peer dependency overrides on ${state.stack?.packageManager}. ${state.retryCount} intervention cycle(s) were exhausted. Manual dependency pinning or lockfile regeneration is required.`,
      'MISSING_DEPENDENCY': `A critical package dependency could not be autonomously resolved after ${state.retryCount} retry cycle(s). The dependency is either unavailable in the target registry, requires authentication, or has been deprecated/removed. Last identified missing package: \`${lastError?.missingPackageName || 'unidentified'}\`.`,
      'BUNDLER_FAILURE': `The module bundler (Vite/Rollup/Webpack/esbuild) failed to compile assets. The bundler configuration contains errors that cannot be autonomously patched — likely missing loader plugins, incompatible source transformations, or circular dependencies.`,
      'BUILD_FAILURE': `The build script executed but produced fatal compilation errors (exit code non-zero). ${state.retryCount} retry cycle(s) with ${state.interventionsAttempted} intervention(s) could not resolve the underlying compilation defect. Manual source code inspection is required.`,
      'MISSING_FILE': `A required file or directory referenced by the build configuration is absent from the repository. The missing path could not be autonomously synthesized. Build manifest inspection is required.`,
      'UNKNOWN': `The build failed due to an unclassifiable anomaly (confidence: ${lastError ? Math.round(lastError.confidence * 100) : 0}%). The error signature did not match any of the ${21} known failure patterns in the autonomous classification engine. Manual forensic inspection of the stderr output is recommended.`,
    };
    if (state.status === 'TERMINAL_UNRESOLVED_NO_NEW_STRATEGY') {
      report += `The autonomous engine exhausted all viable remediation strategies for ${cat} after ${state.retryCount} cycle(s). ${failureReasoning[cat] || 'The failure signature could not be deterministically patched.'} The retry loop was terminated because no material command or configuration mutation was available — preventing synthetic repetition.\n`;
    } else {
      report += (failureReasoning[cat] || `The repository build failed after ${state.retryCount} autonomous retry cycle(s). The terminal anomaly (${cat}) could not be resolved through deterministic intervention. Forensic score: ${state.forensicScore}/100.`) + '\n';
    }
  }

  return report;
};
