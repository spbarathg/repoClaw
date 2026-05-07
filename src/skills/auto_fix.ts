/**
 * @file src/skills/auto_fix.ts
 * Role: Policy-driven, deterministic repair engine.
 * Every repair strategy is registered, safety-classified, and mutation-surface-constrained.
 * No AI in the repair path. No speculative patches.
 */
import { JobState, ErrorCategory, FixStrategyResult, RepairPolicy, MutationSurface } from '../types';
import { logger } from '../utils/logger';
import fs from 'fs/promises';
import path from 'path';

// ━━━━━━━━━━━━━━━━━━━━ REPAIR POLICY TABLE ━━━━━━━━━━━━━━━━━━━━
// Each category maps to a bounded, auditable policy.
export const REPAIR_POLICIES: Record<string, RepairPolicy> = {
  MISSING_DEPENDENCY:               { retryLimit: 2, allowedMutationSurfaces: ['install_command'], safety: 'SAFE', deterministicOnly: true, rollbackOnRegression: true, description: 'Append missing package to install sequence' },
  DEPENDENCY_CONFLICT:              { retryLimit: 1, allowedMutationSurfaces: ['install_command'], safety: 'SAFE', deterministicOnly: true, rollbackOnRegression: true, description: 'Inject legacy peer dep resolution flags' },
  BUILD_SCRIPT_MISSING:             { retryLimit: 1, allowedMutationSurfaces: ['build_command', 'package_json:scripts'], safety: 'CONSTRAINED', deterministicOnly: true, rollbackOnRegression: false, description: 'Inject placeholder build script into manifest' },
  TYPESCRIPT_CONFIG_FAILURE:        { retryLimit: 1, allowedMutationSurfaces: ['tsconfig', 'build_command'], safety: 'CONSTRAINED', deterministicOnly: true, rollbackOnRegression: true, description: 'Generate minimal tsconfig.json' },
  TYPESCRIPT_FAILURE:               { retryLimit: 1, allowedMutationSurfaces: ['build_command'], safety: 'SAFE', deterministicOnly: true, rollbackOnRegression: true, description: 'Relax tsc strictness flags' },
  RUNTIME_VERSION_MISMATCH:         { retryLimit: 1, allowedMutationSurfaces: ['package_json:engines'], safety: 'CONSTRAINED', deterministicOnly: true, rollbackOnRegression: false, description: 'Strip engines constraint from package.json' },
  MISSING_ENV:                      { retryLimit: 1, allowedMutationSurfaces: ['env_file'], safety: 'CONSTRAINED', deterministicOnly: true, rollbackOnRegression: false, description: 'Generate placeholder .env file' },
  VITE_CONFIG_FAILURE:              { retryLimit: 1, allowedMutationSurfaces: ['build_command'], safety: 'SAFE', deterministicOnly: true, rollbackOnRegression: true, description: 'Inject --force to bypass Vite cache' },
  NETWORK_FETCH_FAILURE:            { retryLimit: 1, allowedMutationSurfaces: ['install_command'], safety: 'SAFE', deterministicOnly: true, rollbackOnRegression: true, description: 'Add offline/retry flags to package manager' },
  PYTHON_NATIVE_TOOLCHAIN_FAILURE:  { retryLimit: 1, allowedMutationSurfaces: ['install_command'], safety: 'CONSTRAINED', deterministicOnly: true, rollbackOnRegression: true, description: 'Force binary-only wheel installation' },
};

// Categories with NO repair policy — classify and report only
const NON_REPAIRABLE = new Set([
  'INFRASTRUCTURE_FAILURE', 'SYNTAX_FAILURE', 'PERMISSION_FAILURE',
  'OUT_OF_MEMORY', 'JAVA_COMPILE_FAILURE', 'PHP_PACKAGE_FAILURE',
  'BUNDLER_FAILURE', 'BUILD_FAILURE', 'MISSING_FILE', 'UNKNOWN'
]);

// ━━━━━━━━━━━━━━━━━━━━ REPAIR STRATEGY IMPLEMENTATIONS ━━━━━━━━━━━━━━━━━━━━
// Each strategy is a pure function: (state, error) => FixStrategyResult
// No AI calls. No network calls. Deterministic.

async function repairMissingDependency(state: JobState, error: ErrorCategory): Promise<FixStrategyResult> {
  if (!state.stack || !error.missingPackageName) {
    return reject('repair_missing_dependency', 'No package name extracted from stderr — cannot target repair');
  }
  const pkgToInstall = error.missingPackageName;
  const pm = state.stack.packageManager;
  const newInstall = pm === 'pip' ? `pip install ${pkgToInstall}` : `${pm} install ${pkgToInstall}`;

  state.stack.installCommand = state.stack.installCommand
    ? `${state.stack.installCommand} && ${newInstall}`
    : newInstall;

  return {
    patched: true,
    details: `Appended '${newInstall}' to install sequence`,
    strategy: 'repair_missing_dependency',
    safety: 'SAFE',
    mutationSurface: 'install_command',
    rejected: false,
    rejectionReason: null,
  };
}

async function repairDependencyConflict(state: JobState, _error: ErrorCategory): Promise<FixStrategyResult> {
  if (!state.stack) return reject('repair_dependency_conflict', 'No stack detected');
  const pm = state.stack.packageManager;

  if (pm === 'npm') {
    const priorAppends = state.stack.installCommand?.includes(' && ')
      ? state.stack.installCommand.substring(state.stack.installCommand.indexOf(' && '))
      : '';
    state.stack.installCommand = 'npm install --legacy-peer-deps' + priorAppends;
  } else if (pm === 'yarn') {
    const priorAppends = state.stack.installCommand?.includes(' && ')
      ? state.stack.installCommand.substring(state.stack.installCommand.indexOf(' && '))
      : '';
    state.stack.installCommand = 'yarn install --ignore-engines' + priorAppends;
  } else if (pm === 'pnpm') {
    const priorAppends = state.stack.installCommand?.includes(' && ')
      ? state.stack.installCommand.substring(state.stack.installCommand.indexOf(' && '))
      : '';
    state.stack.installCommand = 'pnpm install --no-strict-peer-dependencies' + priorAppends;
  } else {
    return reject('repair_dependency_conflict', `No conflict resolution strategy for package manager: ${pm}`);
  }

  return {
    patched: true,
    details: `Injected conflict resolution flags for ${pm} (preserved prior appends)`,
    strategy: 'repair_dependency_conflict',
    safety: 'SAFE',
    mutationSurface: 'install_command',
    rejected: false,
    rejectionReason: null,
  };
}

async function repairBuildScriptMissing(state: JobState, _error: ErrorCategory): Promise<FixStrategyResult> {
  const pkgJsonPath = path.join(state.sandboxPath, 'package.json');
  try {
    const data = await fs.readFile(pkgJsonPath, 'utf8');
    const pkg = JSON.parse(data);
    pkg.scripts = pkg.scripts || {};
    pkg.scripts.build = pkg.scripts.build || 'echo "No build script required"';
    await fs.writeFile(pkgJsonPath, JSON.stringify(pkg, null, 2));
    if (state.stack) {
      state.stack.buildCommand = `${state.stack.packageManager} run build`;
    }
    return {
      patched: true,
      details: `Injected default build script into package.json. Build command set to '${state.stack?.buildCommand}'`,
      strategy: 'repair_build_script_missing',
      safety: 'CONSTRAINED',
      mutationSurface: 'package_json:scripts',
      rejected: false,
      rejectionReason: null,
    };
  } catch (e) {
    return reject('repair_build_script_missing', 'Failed to parse package.json');
  }
}

async function repairTypescriptConfig(state: JobState, _error: ErrorCategory): Promise<FixStrategyResult> {
  const tsconfigPath = path.join(state.sandboxPath, 'tsconfig.json');
  try {
    await fs.access(tsconfigPath);
    // tsconfig exists but is malformed — relax flags
    if (state.stack) {
      state.stack.buildCommand = state.stack.buildCommand?.replace('tsc', 'tsc --skipLibCheck') || 'tsc --skipLibCheck';
    }
    return {
      patched: true,
      details: 'Relaxed TypeScript configuration by injecting --skipLibCheck',
      strategy: 'repair_tsconfig_relax',
      safety: 'CONSTRAINED',
      mutationSurface: 'build_command',
      rejected: false,
      rejectionReason: null,
    };
  } catch {
    // tsconfig missing — generate minimal one
    const minimalTsconfig = JSON.stringify({
      compilerOptions: { target: 'ES2020', module: 'commonjs', strict: false, skipLibCheck: true, esModuleInterop: true, outDir: './dist' },
      include: ['src/**/*', '*.ts']
    }, null, 2);
    await fs.writeFile(tsconfigPath, minimalTsconfig);
    return {
      patched: true,
      details: 'Generated minimal tsconfig.json with relaxed compilation settings',
      strategy: 'repair_tsconfig_generate',
      safety: 'CONSTRAINED',
      mutationSurface: 'tsconfig',
      rejected: false,
      rejectionReason: null,
    };
  }
}

async function repairTypescriptFailure(state: JobState, _error: ErrorCategory): Promise<FixStrategyResult> {
  if (!state.stack) return reject('repair_typescript_failure', 'No stack detected');
  state.stack.buildCommand = state.stack.buildCommand?.replace('tsc', 'tsc --skipLibCheck --noEmit') || 'tsc --skipLibCheck';
  return {
    patched: true,
    details: 'Relaxed strict TypeScript compilation parameters (--skipLibCheck --noEmit)',
    strategy: 'repair_typescript_strict',
    safety: 'SAFE',
    mutationSurface: 'build_command',
    rejected: false,
    rejectionReason: null,
  };
}

async function repairRuntimeVersionMismatch(state: JobState, _error: ErrorCategory): Promise<FixStrategyResult> {
  const pkgJsonPath = path.join(state.sandboxPath, 'package.json');
  try {
    const data = await fs.readFile(pkgJsonPath, 'utf8');
    const pkg = JSON.parse(data);
    if (pkg.engines) {
      delete pkg.engines.node;
      await fs.writeFile(pkgJsonPath, JSON.stringify(pkg, null, 2));
      return {
        patched: true,
        details: 'Stripped strict engines constraint from package.json',
        strategy: 'repair_runtime_version',
        safety: 'CONSTRAINED',
        mutationSurface: 'package_json:engines',
        rejected: false,
        rejectionReason: null,
      };
    }
    return reject('repair_runtime_version', 'No engines field found in package.json');
  } catch (e) {
    return reject('repair_runtime_version', 'Failed to parse package.json');
  }
}

async function repairMissingEnv(state: JobState, _error: ErrorCategory): Promise<FixStrategyResult> {
  const envPath = path.join(state.sandboxPath, '.env');
  const envData = '# Generated by RepoClaw — placeholder values for sandbox execution\nPORT=3000\nDATABASE_URL=placeholder\nAPI_KEY=placeholder\n';
  await fs.writeFile(envPath, envData);
  return {
    patched: true,
    details: 'Generated placeholder .env file for sandbox execution',
    strategy: 'repair_missing_env',
    safety: 'CONSTRAINED',
    mutationSurface: 'env_file',
    rejected: false,
    rejectionReason: null,
  };
}

async function repairViteConfig(state: JobState, _error: ErrorCategory): Promise<FixStrategyResult> {
  if (!state.stack) return reject('repair_vite_config', 'No stack detected');
  state.stack.buildCommand = state.stack.buildCommand?.replace('vite build', 'vite build --force') || 'npx vite build --force';
  return {
    patched: true,
    details: 'Injected --force flag to bypass Vite dependency optimization cache',
    strategy: 'repair_vite_force',
    safety: 'SAFE',
    mutationSurface: 'build_command',
    rejected: false,
    rejectionReason: null,
  };
}

async function repairNetworkFetchFailure(state: JobState, _error: ErrorCategory): Promise<FixStrategyResult> {
  if (!state.stack) return reject('repair_network_fetch', 'No stack detected');
  const pm = state.stack.packageManager;

  if (pm === 'npm') {
    const priorAppends = state.stack.installCommand?.includes(' && ')
      ? state.stack.installCommand.substring(state.stack.installCommand.indexOf(' && '))
      : '';
    state.stack.installCommand = 'npm install --prefer-offline --no-audit --no-fund' + priorAppends;
  } else if (pm === 'pip') {
    state.stack.installCommand = (state.stack.installCommand || 'pip install -r requirements.txt') + ' --retries 3 --timeout 60';
  } else if (pm === 'yarn') {
    state.stack.installCommand = 'yarn install --network-timeout 60000';
  } else {
    return reject('repair_network_fetch', `No network resilience strategy for package manager: ${pm}`);
  }

  return {
    patched: true,
    details: `Added network resilience flags for ${pm}`,
    strategy: 'repair_network_resilience',
    safety: 'SAFE',
    mutationSurface: 'install_command',
    rejected: false,
    rejectionReason: null,
  };
}

async function repairPythonNativeToolchain(state: JobState, _error: ErrorCategory): Promise<FixStrategyResult> {
  if (!state.stack || state.stack.language !== 'Python') {
    return reject('repair_python_toolchain', 'Toolchain failure on non-Python stack');
  }
  if (!state.stack.installCommand?.includes('--only-binary :all:')) {
    state.stack.installCommand = state.stack.installCommand
      ? `${state.stack.installCommand} --only-binary :all: || ${state.stack.installCommand}`
      : 'pip install -r requirements.txt --only-binary :all:';
  }
  return {
    patched: true,
    details: 'Injected --only-binary :all: to skip native compilation and prefer pre-built wheels',
    strategy: 'repair_python_binary_only',
    safety: 'CONSTRAINED',
    mutationSurface: 'install_command',
    rejected: false,
    rejectionReason: null,
  };
}

/** Helper to produce a clean rejection result */
function reject(strategy: string, reason: string): FixStrategyResult {
  return {
    patched: false,
    details: reason,
    strategy,
    safety: 'DISALLOWED',
    mutationSurface: null,
    rejected: true,
    rejectionReason: reason,
  };
}

// ━━━━━━━━━━━━━━━━━━━━ STRATEGY REGISTRY ━━━━━━━━━━━━━━━━━━━━
// Explicit mapping: error category -> repair function.
// Auditable, deterministic, no switch-case sprawl.
const REPAIR_STRATEGIES: Record<string, (state: JobState, error: ErrorCategory) => Promise<FixStrategyResult>> = {
  MISSING_DEPENDENCY:               repairMissingDependency,
  DEPENDENCY_CONFLICT:              repairDependencyConflict,
  BUILD_SCRIPT_MISSING:             repairBuildScriptMissing,
  TYPESCRIPT_CONFIG_FAILURE:        repairTypescriptConfig,
  TYPESCRIPT_FAILURE:               repairTypescriptFailure,
  RUNTIME_VERSION_MISMATCH:         repairRuntimeVersionMismatch,
  MISSING_ENV:                      repairMissingEnv,
  VITE_CONFIG_FAILURE:              repairViteConfig,
  NETWORK_FETCH_FAILURE:            repairNetworkFetchFailure,
  PYTHON_NATIVE_TOOLCHAIN_FAILURE:  repairPythonNativeToolchain,
};

// ━━━━━━━━━━━━━━━━━━━━ MAIN ENTRY POINT ━━━━━━━━━━━━━━━━━━━━
export const autoFix = async (state: JobState, error: ErrorCategory): Promise<FixStrategyResult> => {
  const category = error.category;
  logger.info(`Skill: auto_fix -> Evaluating repair policy for ${category}`);

  state.interventionsAttempted++;

  // Check if category is non-repairable
  if (NON_REPAIRABLE.has(category)) {
    const reason = `Category ${category} is outside deterministic policy boundaries. No automated repair available.`;
    logger.info(`Repair rejected: ${reason}`);
    return reject(`reject_${category.toLowerCase()}`, reason);
  }

  // Check if a repair policy exists
  const policy = REPAIR_POLICIES[category];
  if (!policy) {
    const reason = `No repair policy registered for category: ${category}`;
    logger.info(`Repair rejected: ${reason}`);
    return reject(`reject_no_policy`, reason);
  }

  // Check if a strategy implementation exists
  const strategyFn = REPAIR_STRATEGIES[category];
  if (!strategyFn) {
    const reason = `No strategy implementation registered for category: ${category}`;
    logger.info(`Repair rejected: ${reason}`);
    return reject(`reject_no_strategy`, reason);
  }

  // Execute the strategy
  try {
    const result = await strategyFn(state, error);

    // Post-execution: validate mutation surface was authorized
    if (result.patched && result.mutationSurface) {
      const allowed = policy.allowedMutationSurfaces.includes(result.mutationSurface);
      if (!allowed) {
        logger.error(`SANDBOX_VIOLATION: Strategy ${result.strategy} mutated surface '${result.mutationSurface}' which is not in allowed surfaces: [${policy.allowedMutationSurfaces.join(', ')}]`);
        return {
          ...result,
          patched: false,
          rejected: true,
          rejectionReason: `Mutation exceeded policy boundary. Surface '${result.mutationSurface}' not in [${policy.allowedMutationSurfaces.join(', ')}]`,
          safety: 'DISALLOWED',
        };
      }
    }

    logger.info(`Repair result: strategy=${result.strategy} safety=${result.safety} patched=${result.patched} surface=${result.mutationSurface || 'none'}`);
    return result;
  } catch (err: any) {
    logger.error('Skill: auto_fix -> Strategy execution failed', { error: err.message });
    return reject(`exception_${category.toLowerCase()}`, `Strategy execution exception: ${err.message}`);
  }
};
