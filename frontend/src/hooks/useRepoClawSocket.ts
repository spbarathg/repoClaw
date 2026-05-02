import { useState, useCallback, useRef, useEffect } from 'react';
import { logStore } from '../utils/logStore';

export interface LiveIntelligence {
  language: string | null;
  packageManager: string | null;
  currentCycle: string | null;
  patchesApplied: string[];
  reasoningStream: string[];
}

export interface RepoClawState {
  status: 'IDLE' | 'CONNECTING' | 'RUNNING' | 'DONE' | 'ERROR' | 'OFFLINE';
  stage: 'IDLE' | 'FETCH' | 'STRUCTURE' | 'BUILD' | 'CLASSIFY' | 'FIX' | 'RETRY' | 'VERDICT';
  jobId: string | null;
  targetUrl: string | null;
  stack: string;
  errorCategory: string | null;
  confidence: number | null;
  verdict: string | null;
  report: string | null;
  interventionsAttempted: number;
  generatedAssets: string[];
  interventionSuccession: string[];
  intelligence: LiveIntelligence;
  // --- NEW: Computed forensic score from backend ---
  forensicScore: number;
  scoreGrade: string;
  retryCount: number;
}

export function useRepoClawSocket() {
  const [state, setState] = useState<RepoClawState>({
    status: 'IDLE',
    stage: 'IDLE',
    jobId: null,
    targetUrl: null,
    stack: 'Awaiting Analysis',
    errorCategory: null,
    confidence: null,
    verdict: null,
    report: null,
    interventionsAttempted: 0,
    generatedAssets: [],
    interventionSuccession: [],
    intelligence: {
      language: null,
      packageManager: null,
      currentCycle: null,
      patchesApplied: [],
      reasoningStream: []
    },
    forensicScore: 0,
    scoreGrade: '?',
    retryCount: 0
  });

  const wsRef = useRef<WebSocket | null>(null);

  const appendLog = (msg: string) => {
    logStore.append(msg);
  };

  const parseLogForState = (msg: string, meta?: any) => {
    setState((prev) => {
      const next = { ...prev };
      const intel = { ...prev.intelligence };
      let intelChanged = false;

      if (msg.includes('Job ID Allocated:')) {
        const match = msg.match(/Job ID Allocated:\s*(\d+)/);
        if (match) next.jobId = match[1];
      }
      if (msg.includes('Target Origin:')) {
        const match = msg.match(/Target Origin:\s*(https?:\/\/[^\s]+)/);
        if (match) next.targetUrl = match[1];
      }
      
      // Stage inference from progress messages
      if (msg.includes('Cloning Target Repository')) next.stage = 'FETCH';
      if (msg.includes('Analyzing Architectural Structure')) next.stage = 'STRUCTURE';
      if (msg.includes('Entering Autonomous Build') || msg.includes('Executing Build Pass')) {
         if (prev.stage === 'CLASSIFY' || prev.stage === 'FIX') next.stage = 'RETRY';
         else next.stage = 'BUILD';
      }
      if (msg.includes('Root cause isolated:')) next.stage = 'CLASSIFY';
      if (msg.includes('Auto-Fix Applied:')) next.stage = 'FIX';
      if (msg.includes('Generating Final Intelligence Verdict')) next.stage = 'VERDICT';

      // Intelligence parsing — build cycle tracking
      if (msg.includes('Executing Build Pass [Cycle')) {
        const match = msg.match(/\[Cycle (\d+\/\d+)\]/);
        if (match) {
          intel.currentCycle = match[1];
          intelChanged = true;
        }
      }

      // Root cause isolation — extract from backend message (NOT from guessing)
      if (msg.includes('Root cause isolated:')) {
         const match = msg.match(/Root cause isolated:\s*([A-Z_]+)\s*\(Confidence:\s*(\d+)%\)/);
         if (match) {
            next.errorCategory = match[1];
            next.confidence = parseInt(match[2], 10);
            intelChanged = true;
         }
      }

      // Handle backend meta payload for exact state sync
      if (meta) {
         if (typeof meta.interventionsAttempted === 'number') next.interventionsAttempted = meta.interventionsAttempted;
         if (Array.isArray(meta.generatedAssets)) next.generatedAssets = meta.generatedAssets;
         if (Array.isArray(meta.interventionSuccession)) next.interventionSuccession = meta.interventionSuccession;
         if (Array.isArray(meta.reasoningFeed)) {
            intel.reasoningStream = meta.reasoningFeed.slice(-15);
            intelChanged = true;
         }
         // Live stack from backend meta (authoritative source)
         if (meta.stack) {
            if (meta.stack.language) { intel.language = meta.stack.language; intelChanged = true; next.stack = meta.stack.language; }
            if (meta.stack.packageManager) { intel.packageManager = meta.stack.packageManager; intelChanged = true; }
         }
      }

      if (intelChanged) next.intelligence = intel;

      return next;
    });
  };

  const checkConnection = useCallback(() => {
     // A ping just to see if the server is alive
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
     return () => clearInterval(interval);
  }, [checkConnection]);

  const analyze = useCallback((url: string) => {
    if (wsRef.current) wsRef.current.close();
    
    setState({
      status: 'CONNECTING',
      stage: 'IDLE',
      jobId: null,
      targetUrl: url,
      stack: 'Analyzing...',
      errorCategory: null,
      confidence: null,
      verdict: null,
      report: null,
      interventionsAttempted: 0,
      generatedAssets: [],
      interventionSuccession: [],
      intelligence: {
        language: null,
        packageManager: null,
        currentCycle: null,
        patchesApplied: [],
        reasoningStream: []
      },
      forensicScore: 0,
      scoreGrade: '?',
      retryCount: 0
    });

    try {
      const ws = new WebSocket('ws://localhost:3000');
      wsRef.current = ws;

      ws.onopen = () => {
        logStore.clear();
        ws.send(JSON.stringify({ url }));
        setState((prev) => ({ ...prev, status: 'RUNNING' }));
        appendLog(`[SYSTEM] WebSocket Link Established. Instructing Pi Engine on ${url}...`);
      };

      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.status === 'PROGRESS') {
            appendLog(payload.message);
            parseLogForState(payload.message, payload.meta);
          } else if (payload.status === 'DONE') {
            const fs = payload.finalState;
            setState((prev) => ({ 
              ...prev, 
              status: 'DONE', 
              stage: 'VERDICT', 
              report: fs?.report ?? payload.report, 
              verdict: fs?.verdict ?? payload.verdict,
              errorCategory: fs?.errorCategory ?? prev.errorCategory,
              generatedAssets: fs?.generatedAssets ?? prev.generatedAssets,
              interventionSuccession: fs?.interventionSuccession ?? prev.interventionSuccession,
              interventionsAttempted: fs?.interventionsAttempted ?? prev.interventionsAttempted,
              // Use backend's final confidence (from last error), not stale PROGRESS value
              confidence: fs?.confidence != null ? Math.round(fs.confidence * 100) : prev.confidence,
              // Computed forensic score from backend
              forensicScore: fs?.forensicScore ?? 0,
              scoreGrade: fs?.scoreGrade ?? 'F',
              retryCount: fs?.retryCount ?? 0,
              intelligence: {
                ...prev.intelligence,
                language: fs?.stack?.language ?? prev.intelligence.language,
                packageManager: fs?.stack?.packageManager ?? prev.intelligence.packageManager,
              }
            }));
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
        appendLog('[FATAL] WebSocket Connection Refused. Is the Gateway running on port 3000?');
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

  return { state, analyze };
}
