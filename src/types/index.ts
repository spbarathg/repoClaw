/**
 * @file src/types/index.ts
 * Role: Single source of truth for pipeline state, repair policies, and provenance schemas.
 */

// ━━━━━━━━━━━━━━━━━━━━ FINAL VERDICTS ━━━━━━━━━━━━━━━━━━━━
export type FinalVerdict =
  | 'BUILD_SUCCEEDED'
  | 'REPAIRED'
  | 'BUILD_FAILED'
  | 'REPAIR_EXHAUSTED'
  | 'UNSUPPORTED'
  | 'INFRA_FAILED'
  | 'SANDBOX_VIOLATION'
  | 'NON_DETERMINISTIC_FAILURE';

// ━━━━━━━━━━━━━━━━━━━━ PIPELINE STATUS ━━━━━━━━━━━━━━━━━━━━
export type PipelineStatus =
  | 'PENDING'
  | 'CLONED'
  | 'ANALYZED'
  | FinalVerdict;

// ━━━━━━━━━━━━━━━━━━━━ REPAIR SAFETY ━━━━━━━━━━━━━━━━━━━━
export type RepairSafety =
  | 'SAFE'           // Deterministic, no side effects beyond intended surface
  | 'CONSTRAINED'    // Deterministic but touches config files
  | 'SPECULATIVE'    // May not help; bounded attempt
  | 'DISALLOWED';    // System refuses to attempt

// ━━━━━━━━━━━━━━━━━━━━ REPAIR POLICY ━━━━━━━━━━━━━━━━━━━━
export type MutationSurface =
  | 'install_command'
  | 'build_command'
  | 'package_json:scripts'
  | 'package_json:engines'
  | 'tsconfig'
  | 'env_file';

export interface RepairPolicy {
  retryLimit: number;
  allowedMutationSurfaces: MutationSurface[];
  safety: RepairSafety;
  deterministicOnly: boolean;
  rollbackOnRegression: boolean;
  description: string;
}

// ━━━━━━━━━━━━━━━━━━━━ ANALYSIS REQUEST ━━━━━━━━━━━━━━━━━━━━
export interface AnalysisRequest {
  url: string;
  source: 'websocket' | 'cli';
  chatId: string;
}

// ━━━━━━━━━━━━━━━━━━━━ COMMAND MUTATION ━━━━━━━━━━━━━━━━━━━━
export interface CommandMutation {
  cycle: number;
  type: 'INSTALL' | 'BUILD';
  before: string;
  after: string;
  surface: MutationSurface;
}

// ━━━━━━━━━━━━━━━━━━━━ REPAIR TRACE ━━━━━━━━━━━━━━━━━━━━
export interface RepairTraceEntry {
  cycle: number;
  timestamp: string;
  failureCategory: string;
  matchStrength: number;
  classificationSource: 'heuristic' | 'ai_fallback';
  repairStrategy: string | null;
  repairSafety: RepairSafety | null;
  mutationSurface: MutationSurface | null;
  commandBefore: string;
  commandAfter: string;
  rebuildExitCode: number | null;
  rebuildDurationMs: number | null;
  improved: boolean;
  rolledBack: boolean;
  rejectionReason: string | null;
}

// ━━━━━━━━━━━━━━━━━━━━ PIPELINE PROVENANCE ━━━━━━━━━━━━━━━━━━━━
export interface PipelineProvenance {
  pipelineVersion: string;
  jobId: string;
  targetUrl: string;
  startedAt: string;
  completedAt: string;
  totalDurationMs: number;
  sandboxImage: string;
  dockerFlags: string[];
  detectedStack: {
    language: string;
    packageManager: string;
    lockfilePresent: boolean;
    buildScriptPresent: boolean;
  };
  repairTrace: RepairTraceEntry[];
  finalVerdict: FinalVerdict;
  totalCycles: number;
  totalMutationsApplied: number;
}

// ━━━━━━━━━━━━━━━━━━━━ HISTORY LEDGER ━━━━━━━━━━━━━━━━━━━━
export interface HistoryLedgerEntry {
  jobId: string;
  url: string;
  category: string;
  verdict: string;
  timestamp: string;
}

// ━━━━━━━━━━━━━━━━━━━━ JOB STATE ━━━━━━━━━━━━━━━━━━━━
export interface JobState {
  jobId: string;
  url: string;
  sandboxPath: string;
  retryCount: number;
  stack?: TechStack;
  status: PipelineStatus;
  logs: BuildLog[];
  errors: ErrorCategory[];
  report?: string;
  interventionsAttempted: number;
  commandMutations: CommandMutation[];
  repairTrace: RepairTraceEntry[];
  provenance?: PipelineProvenance;
  pipelineEvents: string[];
}

// ━━━━━━━━━━━━━━━━━━━━ TECH STACK ━━━━━━━━━━━━━━━━━━━━
export interface TechStack {
  language: string;
  framework?: string;
  packageManager: string;
  installCommand?: string;
  buildCommand?: string;
  lockfilePresent?: boolean;
  buildScriptPresent?: boolean;
}

// ━━━━━━━━━━━━━━━━━━━━ BUILD LOG ━━━━━━━━━━━━━━━━━━━━
export interface BuildLog {
  stdout: string;
  stderr: string;
  exitCode: number;
}

// ━━━━━━━━━━━━━━━━━━━━ ERROR CATEGORY ━━━━━━━━━━━━━━━━━━━━
export interface ErrorCategory {
  category: 'MISSING_ENV' | 'MISSING_DEPENDENCY' | 'RUNTIME_VERSION_MISMATCH' | 'BUILD_SCRIPT_MISSING' | 'INFRASTRUCTURE_FAILURE' | 'UNKNOWN' | 'DEPENDENCY_CONFLICT' | 'BUILD_FAILURE' | 'MISSING_FILE' | 'TYPESCRIPT_FAILURE' | 'BUNDLER_FAILURE' | 'PYTHON_NATIVE_TOOLCHAIN_FAILURE' | 'JAVA_COMPILE_FAILURE' | 'PHP_PACKAGE_FAILURE' | 'PERMISSION_FAILURE' | 'OUT_OF_MEMORY' | 'NETWORK_FETCH_FAILURE' | 'SYNTAX_FAILURE' | 'VITE_CONFIG_FAILURE' | 'TYPESCRIPT_CONFIG_FAILURE';
  severity: 'high' | 'medium' | 'low';
  probableCause: string;
  matchStrength: number;
  classificationSource: 'heuristic' | 'ai_fallback';
  suggestedFix: string;
  missingPackageName?: string;
  retryRecommended: boolean;
}

// ━━━━━━━━━━━━━━━━━━━━ FIX STRATEGY RESULT ━━━━━━━━━━━━━━━━━━━━
export interface FixStrategyResult {
  patched: boolean;
  details: string;
  strategy: string;
  safety: RepairSafety;
  mutationSurface: MutationSurface | null;
  rejected: boolean;
  rejectionReason: string | null;
}
