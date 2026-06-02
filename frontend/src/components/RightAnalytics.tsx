import type { RepoClawState } from '../hooks/useRepoClawSocket';
import { Layers, ShieldAlert, ShieldCheck, XCircle, AlertTriangle, Server } from 'lucide-react';
import { motion } from 'framer-motion';
import React, { memo } from 'react';

export const RightAnalytics: React.FC<{ state: RepoClawState, setActiveTab: (tab: 'terminal' | 'report') => void }> = memo(({ state, setActiveTab }) => {
  const { targetUrl, verdict, repairTrace } = state;

  const handleReportClick = () => {
    console.log("[RepoClaw UI] 'View Recovery Report' clicked. Forcing setActiveTab('report')");
    setActiveTab('report');
  };

  return (
    <div className="flex flex-col gap-4 h-full">

      {/* Unified Environment & Sandbox limits */}
      <div className="border border-zinc-800 bg-[#000] p-4 relative overflow-hidden shrink-0">
        <div className="flex items-center gap-2 text-zinc-400 text-[10px] font-mono mb-4 tracking-widest uppercase relative z-10 font-bold">
          <Server size={12} className="text-claw-cyan" />
          Environment & Sandbox
        </div>
        <div className="space-y-2.5 relative z-10">
          <div className="flex justify-between items-center text-[10px] font-mono border-b border-zinc-900 pb-2">
            <span className="text-zinc-500 uppercase tracking-wider">Repository</span>
            <span className="text-white font-bold truncate max-w-[140px]" title={targetUrl || undefined}>
              {(() => {
                if (!targetUrl) return '—';
                try {
                  if (targetUrl.includes('://')) {
                    return new URL(targetUrl).pathname.split('/').pop() || targetUrl;
                  }
                } catch (e) {}
                return targetUrl.split(/[\\/]/).pop() || targetUrl;
              })()}
            </span>
          </div>
          <div className="flex justify-between items-center text-[10px] font-mono border-b border-zinc-900 pb-2">
            <span className="text-zinc-500 uppercase tracking-wider">Runtime Stack</span>
            <span className={state.stack && state.stack !== 'Awaiting Analysis' && state.stack !== 'Analyzing...' ? 'text-claw-cyan font-semibold' : 'text-zinc-500'}>
              {state.stack && state.stack !== 'Awaiting Analysis' && state.stack !== 'Analyzing...' ? state.stack : 'Awaiting...'}
            </span>
          </div>
          <div className="flex justify-between items-center text-[10px] font-mono border-b border-zinc-900 pb-2">
            <span className="text-zinc-500 uppercase tracking-wider">Package Manager</span>
            <span className={state.packageManager ? 'text-claw-emerald font-semibold' : 'text-zinc-500'}>
              {state.packageManager || 'Awaiting...'}
            </span>
          </div>
          <div className="flex justify-between items-center text-[10px] font-mono border-b border-zinc-900 pb-2">
            <span className="text-zinc-500 uppercase tracking-wider">Lockfile</span>
            <span className="text-white font-medium">{state.lockfilePresent ? 'YES' : 'NO'}</span>
          </div>
          <div className="flex justify-between items-center text-[10px] font-mono border-b border-zinc-900 pb-2">
            <span className="text-zinc-500 uppercase tracking-wider">Sandbox Resources</span>
            <span className="text-white font-medium">512MB / 1 Core</span>
          </div>
          <div className="flex justify-between items-center text-[10px] font-mono">
            <span className="text-zinc-500 uppercase tracking-wider">Mount Isolation</span>
            <span className="text-claw-emerald font-semibold">Readonly</span>
          </div>
        </div>
      </div>

      {/* Forensic summary (only rendered when failure occurs) */}
      {state.errorCategory && (
        <div className="border border-zinc-800 bg-[#000] p-4 relative overflow-hidden shrink-0">
          <div className="flex items-center gap-2 text-zinc-400 text-[10px] font-mono mb-4 tracking-widest uppercase relative z-10 font-bold">
            <ShieldCheck size={12} className="text-claw-purple" />
            Forensic Summary
          </div>
          <div className="space-y-2.5 relative z-10 text-[10px] font-mono">
            <div className="flex justify-between items-start border-b border-zinc-900 pb-2">
              <span className="text-zinc-500 uppercase tracking-wider">Classification</span>
              <span className="text-claw-red font-bold text-right max-w-[140px] truncate" title={state.errorCategory}>{state.errorCategory}</span>
            </div>
            {repairTrace.length > 0 && (
              <>
                <div className="flex justify-between items-center border-b border-zinc-900 pb-2">
                  <span className="text-zinc-500 uppercase tracking-wider">Applied Policy</span>
                  <span className="text-claw-cyan font-bold truncate max-w-[140px]" title={repairTrace[repairTrace.length - 1].repairStrategy || undefined}>
                    {repairTrace[repairTrace.length - 1].repairStrategy || 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between items-center border-b border-zinc-900 pb-2">
                  <span className="text-zinc-500 uppercase tracking-wider">Safety Tier</span>
                  <span className="text-white font-semibold">{repairTrace[repairTrace.length - 1].repairSafety}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-zinc-500 uppercase tracking-wider">Mutation Surface</span>
                  <span className="text-white truncate max-w-[140px]">{repairTrace[repairTrace.length - 1].mutationSurface || 'N/A'}</span>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Verdict Panel */}
      <div className={`border p-4 relative overflow-hidden flex-1 ${verdict ? (verdict === 'BUILD_SUCCEEDED' ? 'border-claw-emerald/30 bg-emerald-950/10' : verdict === 'REPAIRED' ? 'border-yellow-500/30 bg-yellow-950/10' : verdict === 'INFRA_FAILED' ? 'border-orange-500/30 bg-orange-950/10' : verdict === 'SANDBOX_VIOLATION' ? 'border-red-950 bg-red-950/20' : 'border-claw-red/30 bg-red-950/10') : 'border-zinc-800 bg-[#000]'} transition-all duration-300 min-h-[140px] flex flex-col justify-center`}>
        <div className="text-[10px] font-bold font-mono text-zinc-400 tracking-widest uppercase mb-3.5 relative z-10 flex items-center justify-between">
          <span>VERDICT</span>
          {verdict && <span className="animate-pulse w-1.5 h-1.5 rounded-none bg-white"></span>}
        </div>

        {verdict ? (
          (() => {
            let color = 'text-claw-red';
            let Icon = XCircle;
            let label = verdict;
            if (verdict === 'BUILD_SUCCEEDED') { color = 'text-claw-emerald'; Icon = ShieldCheck; }
            else if (verdict === 'REPAIRED') { color = 'text-yellow-500'; Icon = AlertTriangle; }
            else if (verdict === 'UNSUPPORTED') { color = 'text-zinc-500'; Icon = Layers; }
            else if (verdict === 'INFRA_FAILED') { color = 'text-orange-500'; Icon = ShieldAlert; }
            else if (verdict === 'SANDBOX_VIOLATION') { color = 'text-red-500'; Icon = ShieldAlert; label = 'SEC_VIOLATION'; }

            return (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col gap-4 relative z-10 w-full"
              >
                <div className="flex items-center gap-4">
                  <motion.div
                    initial={{ scale: 0.9 }}
                    animate={{ scale: 1 }}
                    className="w-12 h-12 rounded-none flex items-center justify-center shrink-0 border border-zinc-800 bg-[#111]"
                  >
                    <Icon size={22} className={color} />
                  </motion.div>
                  <div className="flex-1">
                    <div className={`text-base font-bold font-mono leading-none tracking-tight ${color}`}>{label}</div>
                    <div className="text-[9px] font-mono uppercase tracking-widest opacity-60 mt-1.5 text-zinc-400">
                      {state.retryCount} cycles | {state.interventionsAttempted} repairs
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleReportClick}
                  className="w-full py-2 bg-[#111] border border-zinc-800 hover:bg-white hover:text-black transition-all text-[9px] font-mono tracking-widest font-bold uppercase rounded-none text-zinc-400 relative z-20 cursor-pointer"
                >
                  View Recovery Report
                </button>
              </motion.div>
            );
          })()
        ) : (
          <div className="flex items-center justify-center gap-4 py-2 relative z-10 w-full">
            <div className="relative w-10 h-10 flex items-center justify-center shrink-0">
              <div className="absolute inset-0 border border-zinc-800" />
              <div className="absolute inset-0 border border-transparent border-t-claw-cyan border-l-claw-cyan animate-spin-slow opacity-30" />
              <div className="text-[10px] font-mono opacity-50 text-zinc-500">?</div>
            </div>
            <div className="flex flex-col">
              <div className="text-[10px] font-mono uppercase tracking-wider opacity-50 text-claw-cyan animate-pulse font-bold">PENDING</div>
              <div className="text-[9px] font-mono opacity-30 tracking-widest mt-1">Awaiting pipeline completion</div>
            </div>
          </div>
        )}
      </div>

    </div>
  );
});
