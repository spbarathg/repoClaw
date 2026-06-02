import { useState, useCallback, useRef, useEffect } from 'react';
import { logStore } from '../utils/logStore';

export interface RepairTraceEntry {
  cycle: number;
  timestamp: string;
  failureCategory: string;
  matchStrength: number;
  classificationSource: 'heuristic' | 'ai_fallback';
  repairStrategy: string | null;
  repairSafety: string | null;
  mutationSurface: string | null;
  commandBefore: string;
  commandAfter: string;
  rebuildExitCode: number | null;
  rebuildDurationMs: number | null;
  improved: boolean;
  rolledBack: boolean;
  rejectionReason: string | null;
  fileMutated?: {
    path: string;
    contentBefore: string;
    contentAfter: string;
  } | null;
}

export interface CommandMutation {
  cycle: number;
  type: 'INSTALL' | 'BUILD';
  before: string;
  after: string;
  surface: string;
}

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
  finalVerdict: string;
  totalCycles: number;
  totalMutationsApplied: number;
}

export interface HistoryLedgerEntry {
  jobId: string;
  url: string;
  category: string;
  verdict: string;
  timestamp: string;
}

export interface RepoClawState {
  status: 'IDLE' | 'CONNECTING' | 'RUNNING' | 'DONE' | 'ERROR' | 'OFFLINE';
  stage: 'IDLE' | 'CLONE' | 'DETECT' | 'BUILD' | 'CLASSIFY' | 'REPAIR' | 'REBUILD' | 'VERDICT';
  jobId: string | null;
  targetUrl: string | null;
  stack: string;
  packageManager: string | null;
  lockfilePresent: boolean;
  buildScriptPresent: boolean;
  errorCategory: string | null;
  matchStrength: number | null;
  classificationSource: string | null;
  verdict: string | null;
  report: string | null;
  interventionsAttempted: number;
  retryCount: number;
  commandMutations: CommandMutation[];
  repairTrace: RepairTraceEntry[];
  provenance: PipelineProvenance | null;
  pipelineEvents: string[];
  historyLedger: HistoryLedgerEntry[];
  cycleLogs: Record<number, string[]>;
  selectedCycle: number;
  simulateViolation: boolean;
}

const INITIAL_STATE: RepoClawState = {
  status: 'IDLE',
  stage: 'IDLE',
  jobId: null,
  targetUrl: null,
  stack: 'Awaiting Analysis',
  packageManager: null,
  lockfilePresent: false,
  buildScriptPresent: false,
  errorCategory: null,
  matchStrength: null,
  classificationSource: null,
  verdict: null,
  report: null,
  interventionsAttempted: 0,
  retryCount: 0,
  commandMutations: [],
  repairTrace: [],
  provenance: null,
  pipelineEvents: [],
  historyLedger: [],
  cycleLogs: {},
  selectedCycle: 1,
  simulateViolation: false,
};

export function useRepoClawSocket() {
  const [state, setState] = useState<RepoClawState>({ ...INITIAL_STATE });
  const wsRef = useRef<WebSocket | null>(null);

  const appendLog = (msg: string) => {
    logStore.append(msg);
  };

  const parseLogForState = (msg: string, meta?: any) => {
    setState((prev) => {
      const next = { ...prev };

      // Job ID extraction
      if (msg.includes('Job') && msg.includes('started for')) {
        const match = msg.match(/Job (\d+) started for/);
        if (match) next.jobId = match[1];
      }

      // Stage detection from pipeline event messages
      if (msg.includes('[Clone]')) next.stage = 'CLONE';
      if (msg.includes('[Detect]')) next.stage = 'DETECT';
      if (msg.includes('[Build] Cycle') || msg.includes('[Build] Entering')) next.stage = 'BUILD';
      if (msg.includes('[Classify]')) next.stage = 'CLASSIFY';
      if (msg.includes('[Repair]')) next.stage = 'REPAIR';
      if (msg.includes('[Build] Build succeeded') || msg.includes('[Build] Build repaired')) next.stage = 'BUILD';
      if (msg.includes('[Verdict]')) next.stage = 'VERDICT';

      // Classification extraction
      if (msg.includes('[Classify]')) {
        const match = msg.match(/\[Classify\]\s*(\S+)\s*\(match strength:\s*(\d+)%,\s*source:\s*(\w+)\)/);
        if (match) {
          next.errorCategory = match[1];
          next.matchStrength = parseInt(match[2], 10);
          next.classificationSource = match[3];
        }
      }

      // Stack detection from meta
      if (meta) {
        if (typeof meta.interventionsAttempted === 'number') next.interventionsAttempted = meta.interventionsAttempted;
        if (Array.isArray(meta.commandMutations)) next.commandMutations = meta.commandMutations;
        if (Array.isArray(meta.repairTrace)) next.repairTrace = meta.repairTrace;
        if (Array.isArray(meta.pipelineEvents)) next.pipelineEvents = meta.pipelineEvents;
        if (meta.cycleLogs) {
          next.cycleLogs = meta.cycleLogs;
          // Dynamically highlight the active running cycle
          const keys = Object.keys(meta.cycleLogs).map(Number);
          if (keys.length > 0) {
            next.selectedCycle = Math.max(...keys);
          }
        }
        if (meta.stack) {
          if (meta.stack.language) next.stack = meta.stack.language;
          if (meta.stack.packageManager) next.packageManager = meta.stack.packageManager;
          if (typeof meta.stack.lockfilePresent === 'boolean') next.lockfilePresent = meta.stack.lockfilePresent;
          if (typeof meta.stack.buildScriptPresent === 'boolean') next.buildScriptPresent = meta.stack.buildScriptPresent;
        }
      }

      return next;
    });
  };

  const checkConnection = useCallback(() => {
    const ws = new WebSocket('ws://localhost:3000');
    ws.onopen = () => {
      ws.close();
      setState(prev => prev.status === 'OFFLINE' ? { ...prev, status: 'IDLE' } : prev);
    };
    ws.onerror = () => {
      setState(prev => prev.status !== 'OFFLINE' ? { ...prev, status: 'OFFLINE' } : prev);
    };
  }, []);

  useEffect(() => {
    checkConnection();
    const interval = setInterval(checkConnection, 5000);

    // Fetch initial history on mount
    const initWs = new WebSocket('ws://localhost:3000');
    initWs.onopen = () => {
      initWs.send(JSON.stringify({ action: 'GET_HISTORY' }));
    };
    initWs.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.status === 'HISTORY_SYNC') {
          setState(prev => ({ ...prev, historyLedger: payload.history }));
          initWs.close();
        }
      } catch (e) {}
    };

    return () => {
      clearInterval(interval);
      initWs.close();
    };
  }, [checkConnection]);

  const analyze = useCallback((url: string, simulateViolation: boolean = false) => {
    if (wsRef.current) wsRef.current.close();

    setState({
      ...INITIAL_STATE,
      status: 'CONNECTING',
      targetUrl: url,
      stack: 'Analyzing...',
      simulateViolation,
    });

    try {
      const ws = new WebSocket('ws://localhost:3000');
      wsRef.current = ws;

      ws.onopen = () => {
        logStore.clear();
        setState((prev) => ({ ...prev, status: 'RUNNING' }));
        appendLog(`[SYSTEM] Connected. Starting pipeline for ${url}`);

        setTimeout(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ url, simulateViolation }));
          }
        }, 100);
      };

      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.status === 'HISTORY_SYNC') {
            setState((prev) => ({ ...prev, historyLedger: payload.history }));
          } else if (payload.status === 'PROGRESS') {
            appendLog(payload.message);
            parseLogForState(payload.message, payload.meta);
          } else if (payload.status === 'DONE') {
            const fs = payload.finalState;
            setState((prev) => {
              const maxCycle = fs?.retryCount ? fs.retryCount : 1;
              return {
                ...prev,
                status: 'DONE',
                stage: 'VERDICT',
                report: fs?.report ?? null,
                verdict: fs?.verdict ?? null,
                errorCategory: fs?.errorCategory ?? prev.errorCategory,
                matchStrength: fs?.matchStrength != null ? Math.round(fs.matchStrength * 100) : prev.matchStrength,
                classificationSource: fs?.classificationSource ?? prev.classificationSource,
                interventionsAttempted: fs?.interventionsAttempted ?? prev.interventionsAttempted,
                retryCount: fs?.retryCount ?? 0,
                commandMutations: fs?.commandMutations || [],
                repairTrace: fs?.repairTrace || [],
                provenance: fs?.provenance || null,
                pipelineEvents: fs?.pipelineEvents || prev.pipelineEvents,
                stack: fs?.stack?.language ?? prev.stack,
                packageManager: fs?.stack?.packageManager ?? prev.packageManager,
                lockfilePresent: fs?.stack?.lockfilePresent ?? prev.lockfilePresent,
                buildScriptPresent: fs?.stack?.buildScriptPresent ?? prev.buildScriptPresent,
                cycleLogs: fs?.cycleLogs || prev.cycleLogs,
                selectedCycle: maxCycle,
              };
            });
            appendLog(`[SYSTEM] Pipeline complete.`);
          } else if (payload.status === 'ERROR') {
            setState((prev) => ({ ...prev, status: 'ERROR' }));
            appendLog(`[FATAL] ${payload.error}`);
          }
        } catch (e) {
          console.error('Failed to parse WS message', e);
        }
      };

      ws.onerror = () => {
        setState((prev) => ({ ...prev, status: 'ERROR' }));
        appendLog('[FATAL] WebSocket connection refused. Is the backend running on port 3000?');
      };

      ws.onclose = () => {
        if (wsRef.current === ws) {
          setState((prev) => prev.status === 'RUNNING' ? { ...prev, status: 'ERROR' } : prev);
        }
      };
    } catch (err: any) {
      setState((prev) => ({ ...prev, status: 'ERROR' }));
      appendLog(`[FATAL] Failed to initialize WebSocket: ${err.message}`);
    }
  }, []);

  const abort = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setState((prev) => ({
      ...prev,
      status: 'IDLE',
      stage: 'IDLE',
    }));
    appendLog('[SYSTEM] Pipeline execution aborted by user.');
  }, []);

  const selectCycle = useCallback((cycle: number) => {
    setState((prev) => ({ ...prev, selectedCycle: cycle }));
  }, []);

  return { state, analyze, abort, selectCycle };
}
