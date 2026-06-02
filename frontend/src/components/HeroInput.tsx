import React, { useState, memo } from 'react';
import { Play, Activity, Radar } from 'lucide-react';
import type { RepoClawState } from '../hooks/useRepoClawSocket';

export const HeroInput: React.FC<{
  onAnalyze: (url: string, simulateViolation: boolean) => void;
  abort: () => void;
  state: RepoClawState;
}> = memo(({ onAnalyze, abort, state }) => {
  const [url, setUrl] = useState('');
  const [simulateViolation, setSimulateViolation] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (url && state.status !== 'RUNNING' && state.status !== 'CONNECTING') {
      onAnalyze(url, simulateViolation);
    }
  };

  const isRunning = state.status === 'RUNNING' || state.status === 'CONNECTING';

  return (
    <div className="w-full flex flex-col gap-2.5">
      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 items-center w-full">
        <div className="relative flex-1 w-full group">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Radar className={`h-4 w-4 ${isRunning ? 'text-claw-cyan animate-pulse' : 'text-zinc-500 group-focus-within:text-white transition-colors'}`} />
          </div>
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={isRunning}
            className="block w-full pl-10 pr-4 py-2.5 bg-[#000] border border-zinc-800 rounded-none text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-claw-cyan transition-all font-mono"
            placeholder="Enter local path (e.g. C:\path\to\repo) or Git URL..."
            required
          />
          {isRunning && (
            <div className="absolute inset-y-0 right-0 pr-4 flex items-center">
              <span className="flex h-1.5 w-1.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-claw-cyan opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-claw-cyan"></span>
              </span>
            </div>
          )}
        </div>
        <div className="flex gap-2 w-full sm:w-auto shrink-0">
          <button
            type="submit"
            disabled={isRunning}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-2.5 bg-white text-black text-[10px] font-bold tracking-[0.2em] rounded-none hover:bg-claw-cyan transition-all duration-200 disabled:opacity-30 disabled:hover:bg-white disabled:cursor-not-allowed uppercase font-mono"
          >
            {isRunning ? (
              <>
                <Activity size={12} className="animate-pulse" />
                RUNNING
              </>
            ) : (
              <>
                <Play size={12} />
                ANALYZE
              </>
            )}
          </button>

          {isRunning && (
            <button
              type="button"
              onClick={abort}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-2.5 bg-red-950/20 border border-red-500/20 text-red-400 text-[10px] font-bold tracking-[0.2em] rounded-none hover:bg-red-500 hover:text-black transition-all duration-200 uppercase font-mono"
            >
              ABORT
            </button>
          )}
        </div>
      </form>

      {/* Security Violation Simulator */}
      <div className="flex items-center gap-4 text-[10px] font-mono select-none px-1">
        <label className="flex items-center gap-2 cursor-pointer text-zinc-400 hover:text-white">
          <input
            type="checkbox"
            checked={simulateViolation}
            onChange={(e) => setSimulateViolation(e.target.checked)}
            disabled={isRunning}
            className="h-3.5 w-3.5 bg-[#000] border border-zinc-800 text-red-600 focus:ring-0 focus:ring-offset-0 rounded-none cursor-pointer"
          />
          <span className={simulateViolation ? 'text-red-500 font-bold' : ''}>
            [SECURITY_VIOLATION_SHIELD] SIMULATE DOCKER HOST-WRITE BYPASS
          </span>
        </label>
        {simulateViolation && (
          <span className="text-[9px] text-red-500 animate-pulse font-bold">
            ⚠️ SHIELD SHIELD ACTIVE — DETECTS OUT-OF-SANDBOX FILE ALTERATIONS
          </span>
        )}
      </div>
    </div>
  );
});
