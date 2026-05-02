/**
 * @file src/skills/error_classifier.ts
 * Role: Interfaces with AI API; converts raw logs into structured, typed JSON error objects.
 * Architecture: Provider-agnostic AIClassifier interface.
 */
import { ErrorCategory } from '../types';
import { logger } from '../utils/logger';
import { ERROR_CLASSIFICATION_PROMPT } from '../prompts';
import { config } from '../config';
import axios from 'axios';

export interface AIClassifier {
  classifyError(stdout: string, stderr: string): Promise<ErrorCategory>;
}

export class GeminiCompatibleClassifier implements AIClassifier {
  async classifyError(stdout: string, stderr: string): Promise<ErrorCategory> {
    try {
      const promptPayload = `
${ERROR_CLASSIFICATION_PROMPT}

STDOUT:
${stdout.slice(-5000)}

STDERR:
${stderr.slice(-5000)}
      `;

      logger.debug('Sending classification request to Gemini API...');

      if (config.geminiApiKey) {
        try {
          const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${config.geminiApiKey}`;
          const response = await axios.post(url, {
            contents: [{ parts: [{ text: promptPayload }] }],
            generationConfig: { responseMimeType: "application/json" }
          });

          if (response.data && response.data.candidates && response.data.candidates[0].content.parts[0].text) {
            let jsonStr = response.data.candidates[0].content.parts[0].text;
            // Sanitize markdown fences
            jsonStr = jsonStr.replace(/```json/g, '').replace(/```/g, '').trim();
            const parsed = JSON.parse(jsonStr);
            logger.info('Successfully classified error via Gemini API');
            logger.info('Classification source: Gemini API');
            return {
              category: parsed.category || 'UNKNOWN',
              severity: parsed.severity || 'high',
              probableCause: parsed.probableCause || 'Unknown',
              confidence: parsed.confidence || 0.5,
              suggestedFix: parsed.suggestedFix || 'Manual check required',
              missingPackageName: parsed.missingPackageName,
              retryRecommended: parsed.retryRecommended ?? false
            };
          }
        } catch (apiErr: any) {
          logger.error('Gemini API call failed, falling back to heuristics', { error: apiErr.message });
        }
      } else {
        logger.warn('No GEMINI_API_KEY found, using heuristic fallback');
      }

      // Fallback Heuristics — use lowercase for all substring checks
      const stderrLc = stderr.toLowerCase();
      const stdoutLc = stdout.toLowerCase();
      const combined = stderrLc + ' ' + stdoutLc;
      let category: ErrorCategory['category'] = 'UNKNOWN';
      let suggestedFix = 'No clear fix available';
      let probableCause = 'An unknown compilation or execution error occurred.';
      let missingPackageName = '';

      // === INFRASTRUCTURE FAILURES ===
      if (stderrLc.includes('docker daemon') || stderrLc.includes('failed to connect to the docker api') || stderrLc.includes('error during connect') || stderrLc.includes('command failed: docker') || stderrLc.includes('no space left on device') || stderrLc.includes('git clone timed out') || stderr.includes('BUILD_TIMEOUT') || stderr.includes('PRE_FLIGHT_FAIL')) {
        category = 'INFRASTRUCTURE_FAILURE';
        probableCause = 'The build environment or container infrastructure failed.';
        suggestedFix = 'Check Docker daemon, network connectivity, and disk space.';

      // === OUT OF MEMORY ===
      } else if (stderrLc.includes('oomkilled') || stderrLc.includes('out of memory') || stderrLc.includes('heap out of memory') || stderrLc.includes('javascript heap') || stderrLc.includes('fatal error: ineffective mark-compacts') || stderrLc.includes('signal: killed')) {
        category = 'OUT_OF_MEMORY';
        probableCause = 'The process was killed due to memory exhaustion inside the container.';
        suggestedFix = 'Increase container memory limit or optimize build process';

      // === PERMISSION FAILURES ===
      } else if (stderrLc.includes('permission denied') || stderrLc.includes('eacces') || stderrLc.includes('operation not permitted')) {
        category = 'PERMISSION_FAILURE';
        probableCause = 'File or directory permission denied during build execution.';
        suggestedFix = 'Run with appropriate permissions or fix file ownership';

      // === NETWORK / FETCH FAILURES ===
      } else if (stderrLc.includes('etimeout') || stderrLc.includes('econnrefused') || stderrLc.includes('econnreset') || stderrLc.includes('getaddrinfo enotfound') || stderrLc.includes('npm err! 404') || stderrLc.includes('404 not found') || stderrLc.includes('network error') || stderrLc.includes('could not resolve host') || stderrLc.includes('ssl_error') || stderrLc.includes('certificate') || stderrLc.includes('unable to access')) {
        category = 'NETWORK_FETCH_FAILURE';
        probableCause = 'Package registry or network resource was unreachable during dependency resolution.';
        suggestedFix = 'Check network connectivity, registry URLs, or retry with a mirror';

      // === PYTHON NATIVE TOOLCHAIN ===
      } else if (stderrLc.includes('unknown compiler') || (stderrLc.includes('no such file or directory') && (stderrLc.includes('gcc') || stderrLc.includes('clang') || stderrLc.includes("'cc'"))) || stderrLc.includes('subprocess-exited-with-error') || stderrLc.includes('metadata-generation-failed') || stderrLc.includes('failed building wheel') || stderrLc.includes('meson setup') || stderrLc.includes('error: command \'gcc\'')) {
        category = 'PYTHON_NATIVE_TOOLCHAIN_FAILURE';
        probableCause = 'A native compilation toolchain (gcc/clang/make) is missing in the container. A Python package requires C/Fortran compilation from source.';
        suggestedFix = 'Install build-essential, gcc, gfortran in the container, or use pre-built binary wheels';

      // === JAVA COMPILE FAILURES ===
      } else if (stderrLc.includes('cannot find symbol') || stderrLc.includes('package does not exist') || stderrLc.includes('compilation failure') || stderrLc.includes('build_failure') || stderrLc.includes('[error] failed to execute goal') || stderrLc.includes('javac') || stderrLc.includes('maven-compiler-plugin') || stderrLc.includes('gradle build failed')) {
        category = 'JAVA_COMPILE_FAILURE';
        probableCause = 'Java/Maven/Gradle compilation failed due to missing symbols, packages, or plugin errors.';
        suggestedFix = 'Check Java version compatibility and resolve missing dependencies';

      // === PHP PACKAGE FAILURES ===
      } else if (stderrLc.includes('composer') && (stderrLc.includes('failed to download') || stderrLc.includes('require') || stderrLc.includes('autoload')) || stderrLc.includes('php fatal error') || stderrLc.includes('class not found')) {
        category = 'PHP_PACKAGE_FAILURE';
        probableCause = 'Composer dependency resolution or PHP autoload failed.';
        suggestedFix = 'Run composer update and verify PHP version requirements';

      // === SYNTAX ERRORS ===
      } else if (stderrLc.includes('syntaxerror') || stderrLc.includes('syntax error') || stderrLc.includes('unexpected token') || stderrLc.includes('parsing error') || stderrLc.includes('unterminated string') || stderrLc.includes('unexpected end of input') || stderrLc.includes('invalid syntax')) {
        category = 'SYNTAX_FAILURE';
        probableCause = 'Source code contains syntax errors preventing compilation or parsing.';
        suggestedFix = 'Fix syntax errors in the source files identified in the error output';

      // === VITE CONFIG FAILURES ===
      } else if ((stderrLc.includes('vite') || stdoutLc.includes('vite')) && (stderrLc.includes('failed to resolve') || stderrLc.includes('plugin') || stderrLc.includes('config') || stderrLc.includes('could not resolve entry'))) {
        category = 'VITE_CONFIG_FAILURE';
        probableCause = 'Vite configuration error: missing plugin, unresolved entry point, or malformed vite.config.';
        suggestedFix = 'Check vite.config.ts for missing plugins or entry point references';

      // === TYPESCRIPT CONFIG FAILURES ===
      } else if (stderrLc.includes('tsconfig') || stderrLc.includes('ts18003') || stderrLc.includes('no inputs were found') || (stderrLc.includes('typescript') && stderrLc.includes('config'))) {
        category = 'TYPESCRIPT_CONFIG_FAILURE';
        probableCause = 'TypeScript configuration is missing, malformed, or references nonexistent files.';
        suggestedFix = 'Generate a valid tsconfig.json or fix include/exclude paths';

      // === GENERAL MISSING DEPENDENCY (package-level) ===
      } else if (stderrLc.includes('module not found') || stderrLc.includes('no module named') || stderrLc.includes('cannot find module') || stderrLc.includes('sh: pnpm: not found') || stderrLc.includes('sh: yarn: not found') || stderrLc.includes('sh: git: not found') || stderrLc.includes('command not found') || stderrLc.includes('importerror') || stderrLc.includes('modulenotfounderror')) {
        category = 'MISSING_DEPENDENCY';
        probableCause = 'A required package or system-level dependency is missing.';
        const match = stderr.match(/Cannot find module '([^']+)'/) || stderr.match(/No module named '?([a-zA-Z0-9_-]+)'?/) || stderr.match(/ModuleNotFoundError: No module named '([^']+)'/);
        if (match && match[1]) {
          missingPackageName = match[1];
          suggestedFix = `Install ${match[1]}`;
        } else suggestedFix = 'Install missing dependency identified in logs';

      // === DEPENDENCY CONFLICTS ===
      } else if (stderrLc.includes('eresolve') || stderrLc.includes('peer dep') || stderrLc.includes('dependency conflict') || stderrLc.includes('could not resolve dependency') || stderrLc.includes('conflicting peer')) {
        category = 'DEPENDENCY_CONFLICT';
        probableCause = 'Package manager strict peer dependency resolution failed.';
        suggestedFix = 'Retry install with --legacy-peer-deps or --force';

      // === BUILD LIFECYCLE FAILURES ===
      } else if (stderrLc.includes('elifecycle') || stderrLc.includes('exit status 1') || stderrLc.includes('exit code 1') || stderrLc.includes('exited with code')) {
        category = 'BUILD_FAILURE';
        probableCause = 'The build script executed but failed with a non-zero exit code.';
        suggestedFix = 'Inspect error logs for specific compilation failure details';

      // === FILE COLLISION / EEXIST ===
      } else if (stderrLc.includes('eexist') || stderrLc.includes('file already exists')) {
        category = 'INFRASTRUCTURE_FAILURE';
        probableCause = 'A global tool installation collided with an existing binary in the container image.';
        suggestedFix = 'Skip redundant global installs or use --force flag';

      // === MISSING FILE / ENOENT ===
      } else if (stderrLc.includes('enoent') || stderrLc.includes('no such file or directory')) {
        category = 'MISSING_FILE';
        probableCause = 'A required file or directory for the build is missing.';
        suggestedFix = 'Check path references in build scripts';

      // === TYPESCRIPT COMPILATION ===
      } else if (stderrLc.includes('ts2304') || stderrLc.includes('ts2322') || stderrLc.includes('ts2345') || stderrLc.includes('ts2307') || (stderrLc.includes('error ts') && stderrLc.includes('typescript'))) {
        category = 'TYPESCRIPT_FAILURE';
        probableCause = 'TypeScript compiler encountered strict type errors.';
        suggestedFix = 'Add --skipLibCheck or fix type definitions';

      // === BUNDLER FAILURES ===
      } else if (stderrLc.includes('rollup failed') || stderrLc.includes('webpack') && stderrLc.includes('error') || stderrLc.includes('esbuild') && stderrLc.includes('error') || (stderrLc.includes('vite') && stderrLc.includes('build failed'))) {
        category = 'BUNDLER_FAILURE';
        probableCause = 'Module bundler (Vite/Rollup/Webpack/esbuild) failed to compile assets.';
        suggestedFix = 'Check bundler configuration and plugin compatibility';

      // === MISSING ENV ===
      } else if (stderr.match(/\B\.env\b/) || stderrLc.includes('environment variable') || stderrLc.includes('env not found') || stderrLc.includes('missing required env')) {
        category = 'MISSING_ENV';
        probableCause = 'The application requires a configuration variable that is not set.';
        suggestedFix = 'Generate a .env placeholder file';

      // === RUNTIME VERSION ===
      } else if (stderrLc.includes('node version') || stderrLc.includes('engine strict') || stderrLc.includes('unsupported engine') || stderrLc.includes('requires node') || stderrLc.includes('python version')) {
        category = 'RUNTIME_VERSION_MISMATCH';
        probableCause = 'The package requires a different runtime version.';
        suggestedFix = 'Update runtime version or patch engines block';

      // === BUILD SCRIPT MISSING ===
      } else if (stderrLc.includes('missing script') || stderr.includes('BUILD_SCRIPT_MISSING') || stderrLc.includes('npm err! missing script')) {
        category = 'BUILD_SCRIPT_MISSING';
        probableCause = 'The build script is not defined in the project manifest.';
        suggestedFix = 'Add a default build script to package.json';
      }

      logger.info(`Classification source: Fallback Heuristics -> ${category}`);

      // --- DETERMINISTIC CONFIDENCE ENGINE ---
      // Tier 1 (0.90): Highly specific matches — exact error codes or very narrow signatures
      // Tier 2 (0.82): Specific category with clear keyword cluster
      // Tier 3 (0.72): Broad category inferred from general keywords
      // Tier 4 (0.30): UNKNOWN — no match at all
      const confidenceTiers: Record<string, number> = {
        'INFRASTRUCTURE_FAILURE': 0.90,   // Docker daemon / PRE_FLIGHT / BUILD_TIMEOUT — very specific
        'OUT_OF_MEMORY': 0.88,            // OOMKilled / heap out of memory — precise
        'TYPESCRIPT_FAILURE': 0.85,       // TS error codes (TS2304, etc) — exact
        'TYPESCRIPT_CONFIG_FAILURE': 0.85, // tsconfig / TS18003 — exact
        'VITE_CONFIG_FAILURE': 0.82,      // Vite + config keywords — specific
        'PYTHON_NATIVE_TOOLCHAIN_FAILURE': 0.82, // gcc/wheel/meson — specific
        'JAVA_COMPILE_FAILURE': 0.80,     // maven-compiler-plugin / javac — specific
        'PHP_PACKAGE_FAILURE': 0.78,      // composer + autoload — specific
        'PERMISSION_FAILURE': 0.85,       // EACCES / permission denied — clear
        'SYNTAX_FAILURE': 0.83,           // SyntaxError / unexpected token — clear
        'MISSING_DEPENDENCY': 0.78,       // module not found — broad but reliable
        'DEPENDENCY_CONFLICT': 0.80,      // ERESOLVE / peer dep — specific
        'NETWORK_FETCH_FAILURE': 0.75,    // ETIMEOUT / 404 — moderately specific
        'BUILD_SCRIPT_MISSING': 0.88,     // missing script — very specific
        'MISSING_ENV': 0.72,              // .env patterns — moderate
        'RUNTIME_VERSION_MISMATCH': 0.75, // engine strict / unsupported — moderate
        'BUNDLER_FAILURE': 0.70,          // rollup/webpack + error — broad
        'BUILD_FAILURE': 0.65,            // ELIFECYCLE / exit code — very broad catch-all
        'MISSING_FILE': 0.70,             // ENOENT — could be many things
        'UNKNOWN': 0.30,                  // No signature matched
      };
      let confidence = confidenceTiers[category] ?? 0.50;
      // Bonus: if we extracted a concrete artifact (package name), bump confidence
      if (missingPackageName && missingPackageName.length > 0) confidence = Math.min(confidence + 0.05, 0.95);

      // --- DETERMINISTIC SEVERITY ENGINE ---
      const severityMap: Record<string, ErrorCategory['severity']> = {
        'INFRASTRUCTURE_FAILURE': 'high',
        'OUT_OF_MEMORY': 'high',
        'SYNTAX_FAILURE': 'high',
        'JAVA_COMPILE_FAILURE': 'high',
        'PYTHON_NATIVE_TOOLCHAIN_FAILURE': 'high',
        'PERMISSION_FAILURE': 'medium',
        'NETWORK_FETCH_FAILURE': 'medium',
        'MISSING_ENV': 'medium',
        'RUNTIME_VERSION_MISMATCH': 'medium',
        'BUILD_SCRIPT_MISSING': 'medium',
        'DEPENDENCY_CONFLICT': 'medium',
        'MISSING_DEPENDENCY': 'medium',
        'TYPESCRIPT_FAILURE': 'medium',
        'TYPESCRIPT_CONFIG_FAILURE': 'medium',
        'VITE_CONFIG_FAILURE': 'medium',
        'BUNDLER_FAILURE': 'high',
        'BUILD_FAILURE': 'high',
        'MISSING_FILE': 'low',
        'PHP_PACKAGE_FAILURE': 'medium',
        'UNKNOWN': 'high',
      };

      return {
        category,
        severity: severityMap[category] ?? 'high',
        probableCause,
        confidence,
        suggestedFix,
        missingPackageName,
        retryRecommended: category !== 'INFRASTRUCTURE_FAILURE' && category !== 'UNKNOWN' && category !== 'SYNTAX_FAILURE' && category !== 'PERMISSION_FAILURE' && category !== 'OUT_OF_MEMORY'
      };
    } catch (err: any) {
      logger.error('AI Classification API completely failed', { error: err.message });
      return {
        category: 'UNKNOWN',
        severity: 'medium',
        probableCause: 'AI Provider failed to classify',
        confidence: 0,
        suggestedFix: 'Manual intervention required',
        retryRecommended: false
      };
    }
  }
}

export const errorClassifier = async (stdout: string, stderr: string): Promise<ErrorCategory> => {
  logger.info('Skill: error_classifier -> Classifying build failure');
  const classifier = new GeminiCompatibleClassifier();
  return await classifier.classifyError(stdout, stderr);
};
