/**
 * @file src/types/index.ts
 * Role: Single source of truth for the JSON schema returned by Claude, the fix strategies, and the internal state object passed between skills.
 */

export interface AnalysisRequest {
  url: string;
  source: 'telegram' | 'discord';
  chatId: string;
}

export interface JobState {
  jobId: string;
  url: string;
  sandboxPath: string;
  retryCount: number;
  stack?: TechStack;
  status: 'PENDING' | 'CLONED' | 'ANALYZED' | 'BUILD_FAILED' | 'CLASSIFIED' | 'FIXED' | 'BUILDABLE' | 'FIXABLE' | 'NON_BUILDABLE';
  logs: BuildLog[];
  errors: ErrorCategory[];
  report?: string;
}

export interface TechStack {
  language: string;
  framework?: string;
  packageManager: string;
  installCommand?: string;
  buildCommand?: string;
}

export interface BuildLog {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface ErrorCategory {
  category: 'MISSING_ENV' | 'MISSING_DEPENDENCY' | 'RUNTIME_VERSION_MISMATCH' | 'BUILD_SCRIPT_MISSING' | 'IMPORT_FAILURE' | 'UNKNOWN';
  severity: 'high' | 'medium' | 'low';
  probableCause: string;
  confidence: number;
  suggestedFix: string;
  missingPackageName?: string;
  retryRecommended: boolean;
}

export interface FixStrategyResult {
  patched: boolean;
  details: string;
}
