import React, { useState, memo } from 'react';
import { Play, Activity, Radar } from 'lucide-react';
import type { RepoClawState } from '../hooks/useRepoClawSocket';

export const HeroInput: React.FC<{ onAnalyze: (url: string) => void, state: RepoClawState }> = memo(({ onAnalyze, state }) => {
  const [url, setUrl] = useState('https://github.com/developit/mitt');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (url && state.status !== 'RUNNING' && state.status !== 'CONNECTING') {
      onAnalyze(url);
    }
  };

  const isRunning = state.status === 'RUNNING' || state.status === 'CONNECTING';

  return (
    <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-4 items-center">
      <div className="relative flex-1 w-full group">
        <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
          <Radar className={`h-5 w-5 ${isRunning ? 'text-claw-cyan animate-pulse' : 'text-slate-500 group-focus-within:text-white transition-colors'}`} />
        </div>
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          disabled={isRunning}
          className="block w-full pl-10 pr-4 py-3 bg-black/80 backdrop-blur-2xl border border-white/10 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:border-claw-cyan focus:ring-1 focus:ring-claw-cyan transition-all font-mono shadow-[inset_0_0_20px_rgba(255,255,255,0.02)]"
          placeholder="https://github.com/user/repo"
          required
        />
        {isRunning && (
          <div className="absolute inset-y-0 right-0 pr-6 flex items-center">
            <span className="flex h-3 w-3 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-claw-cyan opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-claw-cyan shadow-[0_0_10px_#00f0ff]"></span>
            </span>
          </div>
        )}
      </div>
      <button
        type="submit"
        disabled={isRunning}
        className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-white text-black text-sm font-bold tracking-[0.2em] rounded-xl hover:bg-claw-cyan hover:shadow-[0_0_20px_rgba(0,240,255,0.6)] hover:scale-105 transition-all duration-300 disabled:opacity-50 disabled:hover:scale-100 disabled:cursor-not-allowed"
      >
        {isRunning ? (
           <>
             <Activity size={18} className="animate-pulse" />
             ENGAGED
           </>
        ) : (
           <>
             <Play size={18} />
             ANALYZE
           </>
        )}
      </button>
    </form>
  );
});
