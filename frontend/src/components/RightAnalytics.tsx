import type { RepoClawState } from '../hooks/useRepoClawSocket';
import { Layers, ShieldAlert, Code2, Package, ShieldCheck, XCircle, AlertTriangle, Server, Activity, Lock } from 'lucide-react';
import { motion } from 'framer-motion';
import React, { memo } from 'react';

export const RightAnalytics: React.FC<{ state: RepoClawState }> = memo(({ state }) => {
  const { targetUrl, verdict, repairTrace } = state;

  return (
    <div className="flex flex-col gap-3 h-full">

      {/* Target Architecture */}
      <div className="glass-panel-heavy p-3 relative overflow-hidden shrink-0">
        <div className="absolute inset-0 bg-noise opacity-30 pointer-events-none"></div>
        <div className="flex items-center gap-2 text-slate-500 text-[9px] font-mono mb-1.5 tracking-widest uppercase relative z-10">
          <Layers size={12} className="text-claw-purple" />
          Detected_Stack
        </div>
        <div className="text-base font-bold text-white tracking-wide truncate mb-3 relative z-10">
          {targetUrl ? new URL(targetUrl).pathname.split('/').pop() : 'AWAITING_INPUT'}
        </div>
        <div className="flex flex-col gap-2 relative z-10">
          <div className={`flex items-center gap-2 px-2 py-1.5 rounded-md border text-[10px] font-mono transition-colors duration-500 ${state.stack !== 'Awaiting Analysis' && state.stack !== 'Analyzing...' ? 'bg-claw-cyan/10 border-claw-cyan/30 text-claw-cyan' : 'bg-white/5 border-white/10 text-slate-500'}`}>
            <Code2 size={12} />
            {state.stack !== 'Awaiting Analysis' && state.stack !== 'Analyzing...' ? state.stack : 'Detecting...'}
          </div>
          <div className={`flex items-center gap-2 px-2 py-1.5 rounded-md border text-[10px] font-mono transition-colors duration-500 ${state.packageManager ? 'bg-claw-emerald/10 border-claw-emerald/30 text-claw-emerald' : 'bg-white/5 border-white/10 text-slate-500'}`}>
            <Package size={12} />
            {state.packageManager || 'Detecting...'}
          </div>
          <div className="flex gap-2">
            <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md border text-[9px] font-mono ${state.lockfilePresent ? 'bg-claw-emerald/10 border-claw-emerald/30 text-claw-emerald' : 'bg-white/5 border-white/10 text-slate-500'}`}>
              <Lock size={10} />
              Lockfile: {state.lockfilePresent ? 'YES' : 'NO'}
            </div>
          </div>
        </div>
      </div>

      {/* Execution Policy */}
      <div className="glass-panel p-3 relative overflow-hidden shrink-0">
        <div className="flex items-center gap-2 text-slate-400 text-[9px] font-mono mb-1.5 tracking-[0.2em] uppercase relative z-10">
          <Server size={12} className="text-white" />
          Execution_Policy
        </div>
        <div className="space-y-1.5 relative z-10">
          <div className="flex justify-between items-center text-[9px] font-mono">
            <span className="text-white/40 uppercase tracking-widest">Memory Limit</span>
            <span className="text-white">512MB</span>
          </div>
          <div className="flex justify-between items-center text-[9px] font-mono">
            <span className="text-white/40 uppercase tracking-widest">CPU Limit</span>
            <span className="text-white">1 Core</span>
          </div>
          <div className="flex justify-between items-center text-[9px] font-mono">
            <span className="text-white/40 uppercase tracking-widest">PID Limit</span>
            <span className="text-white">256</span>
          </div>
          <div className="flex justify-between items-center text-[9px] font-mono">
            <span className="text-white/40 uppercase tracking-widest">Readonly Mounts</span>
            <span className="text-claw-emerald">Enabled</span>
          </div>
          <div className="flex justify-between items-center text-[9px] font-mono">
            <span className="text-white/40 uppercase tracking-widest">Retry Ceiling</span>
            <span className="text-white">3 Cycles</span>
          </div>
          <div className="flex justify-between items-center text-[9px] font-mono">
            <span className="text-white/40 uppercase tracking-widest">Classification Route</span>
            <span className="text-white">Heuristic-first</span>
          </div>
        </div>
      </div>

      {/* Recovery Provenance */}
      <div className="glass-panel p-3 relative overflow-hidden flex-1 min-h-0 flex flex-col">
        <div className="flex items-center gap-2 text-slate-400 text-[9px] font-mono mb-1.5 tracking-[0.2em] uppercase shrink-0">
          <ShieldCheck size={12} className="text-white" />
          Recovery_Provenance
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-2 relative z-10">
          {state.errorCategory ? (
            <>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="text-[8px] font-mono tracking-widest text-white/40 mb-1 uppercase">Failure</div>
                  <div className="text-sm font-mono text-claw-red font-bold break-all pr-2" title={state.errorCategory}>{state.errorCategory}</div>
                </div>
                <div>
                  <div className="text-[8px] font-mono tracking-widest text-white/40 mb-1 uppercase">Execution Route</div>
                  <div className="text-[10px] font-mono text-white break-all">DETERMINISTIC_POLICY_ENGINE</div>
                </div>
              </div>

              {repairTrace.length > 0 && repairTrace[repairTrace.length - 1].repairStrategy ? (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <div className="text-[8px] font-mono tracking-widest text-white/40 mb-1 uppercase">Strategy</div>
                      <div className="text-[10px] font-mono text-claw-cyan break-all pr-2" title={repairTrace[repairTrace.length - 1].repairStrategy}>{repairTrace[repairTrace.length - 1].repairStrategy}</div>
                    </div>
                    <div>
                      <div className="text-[8px] font-mono tracking-widest text-white/40 mb-1 uppercase">Safety Policy</div>
                      <div className="text-[10px] font-mono text-white">{repairTrace[repairTrace.length - 1].repairSafety}</div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <div className="text-[8px] font-mono tracking-widest text-white/40 mb-1 uppercase">Mutation Surface</div>
                      <div className="text-[10px] font-mono text-white break-all pr-2">{repairTrace[repairTrace.length - 1].mutationSurface || 'N/A'}</div>
                    </div>
                    {repairTrace[repairTrace.length - 1].rebuildExitCode !== null && (
                      <div>
                        <div className="text-[8px] font-mono tracking-widest text-white/40 mb-1 uppercase">Validation</div>
                        <div className="text-[10px] font-mono text-claw-emerald">build_exit_code 1 → {repairTrace[repairTrace.length - 1].rebuildExitCode}</div>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div>
                  <div className="text-[8px] font-mono tracking-widest text-white/40 mb-1 uppercase">Strategy</div>
                  <div className="text-xs font-mono text-slate-500">None Applied (Non-Retryable)</div>
                </div>
              )}
            </>
          ) : null}
        </div>
      </div>

      {/* Verdict */}
      <div className={`glass-panel-heavy p-4 relative overflow-hidden shrink-0 border ${verdict ? (verdict === 'BUILD_SUCCEEDED' ? 'border-claw-emerald/50 ring-1 ring-claw-emerald/20' : verdict === 'REPAIRED' ? 'border-yellow-400/50 ring-1 ring-yellow-400/20' : verdict === 'INFRA_FAILED' ? 'border-orange-500/50 ring-1 ring-orange-500/20' : 'border-claw-red/50 ring-1 ring-claw-red/20') : 'border-white/10'} transition-all duration-1000 min-h-[80px] flex flex-col justify-center shadow-[0_0_50px_rgba(0,0,0,0.5)]`}>
        <div className="absolute inset-0 bg-noise opacity-40 mix-blend-overlay"></div>
        <div className="text-[10px] font-mono text-slate-500 tracking-[0.3em] uppercase mb-2 relative z-10 flex items-center justify-between">
           <span>VERDICT</span>
           {verdict && <span className="animate-pulse w-2 h-2 rounded-full bg-white"></span>}
        </div>

        {verdict ? (
          (() => {
            let color = 'text-claw-red';
            let Icon = XCircle;
            let label = verdict;
            if (verdict === 'BUILD_SUCCEEDED') { color = 'text-claw-emerald'; Icon = ShieldCheck; }
            else if (verdict === 'REPAIRED') { color = 'text-yellow-400'; Icon = AlertTriangle; }
            else if (verdict === 'UNSUPPORTED') { color = 'text-slate-400'; Icon = Layers; }
            else if (verdict === 'INFRA_FAILED') { color = 'text-orange-500'; Icon = ShieldAlert; }

            return (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-4 relative z-10"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 200, damping: 20 }}
                  className={`w-14 h-14 rounded-xl flex items-center justify-center shrink-0 border border-white/20 shadow-inner bg-black/50`}
                >
                  <Icon size={28} className={color} />
                </motion.div>
                <div className="flex-1">
                  <div className={`text-xl font-black font-mono leading-none tracking-tight ${color}`}>{label}</div>
                  <div className="text-[9px] font-mono uppercase tracking-widest opacity-60 mt-1.5 text-white">
                    {state.retryCount} cycles | {state.interventionsAttempted} repairs
                  </div>
                </div>
              </motion.div>
            );
          })()
        ) : (
          <div className="flex items-center justify-center gap-4 p-4 rounded-2xl relative z-10 w-full">
            <div className="relative w-12 h-12 flex items-center justify-center shrink-0">
              <div className="absolute inset-0 rounded-full border border-white/10" />
              <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-claw-cyan border-l-claw-cyan animate-spin-slow opacity-30" />
              <div className="text-xs font-mono opacity-50">?</div>
            </div>
            <div className="flex flex-col">
              <div className="text-sm font-mono uppercase tracking-[0.3em] opacity-50 text-claw-cyan animate-pulse">PENDING</div>
              <div className="text-[9px] font-mono opacity-30 tracking-widest">Awaiting pipeline completion</div>
            </div>
          </div>
        )}
      </div>

    </div>
  );
});
