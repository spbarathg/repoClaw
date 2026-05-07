import type { RepoClawState } from '../hooks/useRepoClawSocket';
import { X, ShieldCheck, ShieldAlert, AlertTriangle, XCircle, Code2, Terminal, Layers, Server, Lock, Activity, Play, OctagonX } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import React, { useState, useEffect, useMemo, memo } from 'react';

export const VerdictModal: React.FC<{ state: RepoClawState }> = memo(({ state }) => {
  const [isOpen, setIsOpen] = useState(false);
  const { stage, verdict, report, provenance, commandMutations, repairTrace, matchStrength, classificationSource } = state;

  useEffect(() => {
    if (stage === 'VERDICT' && verdict && report) {
      setIsOpen(true);
    }
  }, [stage, verdict, report]);

  const isSuccess = verdict === 'BUILD_SUCCEEDED';
  const isRepaired = verdict === 'REPAIRED';
  const isInfra = verdict === 'INFRA_FAILED';
  const isUnsupported = verdict === 'UNSUPPORTED';
  const isExhausted = verdict === 'REPAIR_EXHAUSTED';

  let color = 'text-claw-red';
  let glow = 'text-glow-red';
  let bgGlow = 'bg-claw-red/10 border-claw-red/30';
  let Icon = XCircle;
  let sub = 'BUILD FAILED';
  let bannerText = 'BUILD FAILURE CONFIRMED';

  if (isSuccess) {
    color = 'text-claw-emerald'; glow = 'text-glow-emerald'; bgGlow = 'bg-claw-emerald/10 border-claw-emerald/30';
    Icon = ShieldCheck; sub = 'BUILD SUCCEEDED';
    bannerText = 'BUILD SUCCEEDED — ZERO FAILURES';
  }
  else if (isRepaired) {
    color = 'text-yellow-400'; glow = 'text-glow'; bgGlow = 'bg-yellow-400/10 border-yellow-400/30';
    Icon = AlertTriangle; sub = 'REPAIRED';
    bannerText = 'BUILD REPAIRED VIA DETERMINISTIC POLICY';
  }
  else if (isUnsupported) {
    color = 'text-slate-400'; glow = ''; bgGlow = 'bg-slate-500/10 border-slate-500/30';
    Icon = Layers; sub = 'UNSUPPORTED';
    bannerText = 'NO EXECUTABLE BUILD SURFACE DETECTED';
  }
  else if (isInfra) {
    color = 'text-orange-500'; glow = 'text-glow-orange'; bgGlow = 'bg-orange-500/10 border-orange-500/30';
    Icon = ShieldAlert; sub = 'INFRASTRUCTURE FAILED';
    bannerText = 'INFRASTRUCTURE OR RUNTIME FAILURE';
  }
  else if (isExhausted) {
    color = 'text-rose-500'; glow = 'text-glow-red'; bgGlow = 'bg-rose-500/10 border-rose-500/30';
    Icon = OctagonX; sub = 'REPAIR EXHAUSTED';
    bannerText = 'REPAIR LOOP EXHAUSTED — NO FURTHER MUTATIONS AVAILABLE';
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 lg:p-8">

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/80 blur-backdrop-heavy"
            onClick={() => setIsOpen(false)}
          />

          <motion.div
            initial={{ opacity: 0, y: 100, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 100, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 150, damping: 20 }}
            className="glass-panel-heavy border border-white/10 ring-1 ring-white/5 shadow-[0_0_120px_rgba(0,0,0,0.8)] w-[92vw] h-[86vh] flex flex-col relative z-10 overflow-hidden rounded-3xl bg-[#030305]"
          >
            {/* Banner */}
            <div className={`w-full py-2 flex items-center justify-center gap-4 ${bgGlow} shrink-0`}>
              <Icon size={16} className={color} />
              <span className={`text-[11px] font-mono tracking-[0.4em] font-bold uppercase ${color}`}>{bannerText}</span>
              <Icon size={16} className={color} />
            </div>

            {/* Header */}
            <div className="relative p-8 border-b border-white/5 bg-gradient-to-r from-black/80 to-transparent flex items-center justify-between shrink-0 overflow-hidden">
              <div className="flex items-center gap-8 relative z-10">
                <motion.div
                  initial={{ rotateY: 90 }}
                  animate={{ rotateY: 0 }}
                  transition={{ delay: 0.3, type: "spring" }}
                  className={`w-20 h-20 rounded-2xl border border-white/10 bg-black/50 shadow-inner flex items-center justify-center shrink-0 ${color} ${glow}`}
                >
                  <Icon size={40} />
                </motion.div>
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <span className={`text-sm font-mono tracking-[0.3em] uppercase ${color} ${glow}`}>{sub}</span>
                  </div>
                  <h1 className="text-4xl font-bold text-white tracking-tight font-sans">
                    {state.targetUrl ? new URL(state.targetUrl).pathname.split('/').pop() : 'UNKNOWN'}
                  </h1>
                  <div className="text-xs font-mono text-slate-500 mt-2 flex items-center gap-2">
                    <Server size={12} />
                    JOB: {state.jobId || '—'}
                  </div>
                </div>
              </div>
              <button onClick={() => setIsOpen(false)} className="p-3 rounded-xl hover:bg-white/10 text-slate-500 hover:text-white transition-colors border border-white/5 bg-black/50 backdrop-blur-md relative z-10">
                <X size={24} />
              </button>
            </div>

            {/* Badge Strip */}
            <div className="flex items-center gap-1 p-2 bg-black/90 border-b border-white/5 shrink-0 overflow-x-auto custom-scrollbar relative z-10">
              <div className="flex items-center gap-2 px-4 py-1 border border-white/10 rounded-full text-[9px] font-mono tracking-widest text-slate-400 bg-white/5 whitespace-nowrap">
                <Lock size={10} className="text-claw-cyan" /> SANDBOX: {provenance?.sandboxImage || 'pending'}
              </div>
              <div className={`flex items-center gap-2 px-4 py-1 border rounded-full text-[9px] font-mono tracking-widest whitespace-nowrap ${state.interventionsAttempted > 0 ? 'border-claw-cyan/30 text-claw-cyan bg-claw-cyan/10' : 'border-white/10 text-slate-400 bg-white/5'}`}>
                <Activity size={10} /> REPAIRS: {state.interventionsAttempted}
              </div>
              <div className={`flex items-center gap-2 px-4 py-1 border rounded-full text-[9px] font-mono tracking-widest whitespace-nowrap ${isSuccess || isRepaired ? 'border-claw-emerald/30 text-claw-emerald bg-claw-emerald/10' : 'border-slate-700 text-slate-600 bg-black'}`}>
                <Play size={10} /> {isSuccess || isRepaired ? 'CI_READY' : 'CI_BLOCKED'}
              </div>
              {provenance && (
                <div className="flex items-center gap-2 px-4 py-1 border border-white/10 rounded-full text-[9px] font-mono tracking-widest text-slate-400 bg-white/5 whitespace-nowrap">
                  <Terminal size={10} /> {provenance.totalDurationMs}ms | {provenance.totalCycles} cycles
                </div>
              )}
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-8 relative z-10">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 h-full">

                {/* Left: Repair Trace & Mutations */}
                <div className="col-span-1 lg:col-span-8 flex flex-col gap-8 pr-4">
                  {isUnsupported ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-500 font-mono text-center opacity-50 p-12 border border-dashed border-slate-700/50 rounded-2xl bg-black/20">
                      <Layers size={48} className="mb-6 text-slate-600" />
                      <div className="text-xl font-bold tracking-widest text-slate-400 mb-2">NO EXECUTABLE BUILD SURFACE</div>
                      <div className="text-sm max-w-md mx-auto leading-relaxed">
                        This repository contains documentation, configuration, or static assets only.
                        No build system or compilation step was detected.
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Command Mutation Diffs */}
                      {commandMutations && commandMutations.length > 0 && (
                        <div className="mb-4">
                          <div className="text-sm font-sans tracking-widest text-slate-400 uppercase border-b border-white/10 pb-4 flex items-center gap-3 mb-4">
                            <Terminal size={18} className="text-claw-cyan" />
                            Command Mutation Diffs
                          </div>
                          <div className="space-y-4">
                            {commandMutations.map((mut, idx) => (
                              <div key={idx} className="bg-black/40 border border-white/5 rounded-lg p-4 font-mono text-xs">
                                <div className="flex justify-between items-center mb-3 border-b border-white/5 pb-2">
                                  <span className="text-claw-cyan tracking-widest uppercase">CYCLE {mut.cycle} — {mut.type} MUTATION</span>
                                  <span className="text-slate-500">Surface: {mut.surface}</span>
                                </div>
                                <div className="grid grid-cols-1 gap-2">
                                  <div className="flex">
                                    <span className="w-8 text-red-400 select-none">-</span>
                                    <span className="text-red-400/80 line-through">{mut.before || '(empty)'}</span>
                                  </div>
                                  <div className="flex">
                                    <span className="w-8 text-claw-emerald select-none">+</span>
                                    <span className="text-claw-emerald">{mut.after}</span>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Repair Trace */}
                      {repairTrace.length > 0 && (
                        <>
                          <div className="text-sm font-sans tracking-widest text-slate-400 uppercase border-b border-white/10 pb-4 flex items-center gap-3">
                            <Activity size={18} className="text-claw-cyan" />
                            Repair Trace
                          </div>
                          <div className="flex flex-col gap-6 relative mt-2">
                            <div className="absolute left-[27px] top-4 bottom-4 w-[2px] bg-gradient-to-b from-claw-cyan via-claw-purple to-transparent opacity-40 shadow-[0_0_15px_#00f0ff]" />
                            {repairTrace.map((trace, idx) => (
                              <div key={idx} className="flex gap-6 relative z-10">
                                <div className="w-14 h-14 rounded-full bg-black border border-claw-cyan flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(0,240,255,0.2)]">
                                  <div className="text-sm font-mono font-bold text-claw-cyan">{trace.cycle}</div>
                                </div>
                                <div className="flex-1 bg-black/30 border border-white/5 rounded-lg p-4">
                                  <div className="flex items-center justify-between mb-2">
                                    <span className="text-sm font-mono text-claw-red font-bold">{trace.failureCategory}</span>
                                    <span className="text-[10px] font-mono text-claw-cyan bg-claw-cyan/10 px-2 py-0.5 rounded">
                                      {Math.round(trace.matchStrength * 100)}% {trace.classificationSource}
                                    </span>
                                  </div>
                                  {trace.repairStrategy ? (
                                    <div className="space-y-1.5">
                                      <div className="text-xs font-mono text-white/80">
                                        Strategy: <span className="text-white">{trace.repairStrategy}</span>
                                      </div>
                                      <div className={`text-[10px] font-mono ${trace.repairSafety === 'SAFE' ? 'text-claw-emerald' : trace.repairSafety === 'CONSTRAINED' ? 'text-yellow-400' : 'text-claw-red'}`}>
                                        Safety: {trace.repairSafety} | Surface: {trace.mutationSurface || 'none'}
                                      </div>
                                      {trace.rolledBack && (
                                        <div className="text-[10px] font-mono text-claw-red animate-pulse">⟲ Rolled back — regression detected</div>
                                      )}
                                    </div>
                                  ) : trace.rejectionReason ? (
                                    <div className="text-xs font-mono text-claw-red/80 mt-1 border-l-2 border-claw-red/30 pl-3">
                                      Rejected: {trace.rejectionReason}
                                    </div>
                                  ) : (
                                    <div className="text-xs font-mono text-slate-500 mt-1">No repair strategy available</div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </>
                      )}

                      {repairTrace.length === 0 && commandMutations.length === 0 && (
                        <div className="text-slate-500 font-mono text-sm p-4">No repair cycles needed.</div>
                      )}
                    </>
                  )}
                </div>

                {/* Right: Provenance Cards */}
                <div className="col-span-1 lg:col-span-4 flex flex-col gap-6">

                  <div className="pb-4 border-b border-white/5">
                    <div className="text-[10px] font-mono tracking-widest text-slate-500 mb-2 uppercase flex items-center gap-2">
                      <Layers size={14} /> Detected Stack
                    </div>
                    <div className="font-sans text-xl font-medium text-white">{state.stack}</div>
                    <div className="text-xs font-mono text-slate-600 mt-1">{state.packageManager || 'unknown'}</div>
                  </div>

                  {/* Sandbox Details */}
                  {provenance && (
                    <div className="pb-4 border-b border-white/5">
                      <div className="text-[10px] font-mono tracking-widest text-slate-500 mb-3 uppercase flex items-center gap-2">
                        <Server size={14} /> Container Execution
                      </div>
                      <div className="space-y-1.5 text-xs font-mono">
                        <div className="flex justify-between"><span className="text-slate-500">Image</span><span className="text-white/80">{provenance.sandboxImage}</span></div>
                        <div className="flex justify-between"><span className="text-slate-500">Duration</span><span className="text-white/80">{provenance.totalDurationMs}ms</span></div>
                        <div className="flex justify-between"><span className="text-slate-500">Cycles</span><span className="text-white/80">{provenance.totalCycles}</span></div>
                        <div className="flex justify-between"><span className="text-slate-500">Mutations</span><span className="text-white/80">{provenance.totalMutationsApplied}</span></div>
                        <div className="flex justify-between"><span className="text-slate-500">Lockfile</span><span className={provenance.detectedStack.lockfilePresent ? 'text-claw-emerald' : 'text-slate-500'}>{provenance.detectedStack.lockfilePresent ? 'Present' : 'Missing'}</span></div>
                        <div className="flex justify-between"><span className="text-slate-500">Build Script</span><span className={provenance.detectedStack.buildScriptPresent ? 'text-claw-emerald' : 'text-yellow-400'}>{provenance.detectedStack.buildScriptPresent ? 'Present' : 'Missing'}</span></div>
                      </div>
                    </div>
                  )}

                  {/* Classification Summary */}
                  <div className="pb-4 border-b border-white/5">
                    <div className="text-[10px] font-mono tracking-widest text-slate-500 mb-3 uppercase flex items-center gap-2">
                      <Activity size={14} /> Error Classification
                    </div>
                    {isSuccess ? (
                      <div className="text-sm font-sans text-claw-emerald">✓ No failures detected</div>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex justify-between text-xs font-mono">
                          <span className="text-slate-400">Category</span>
                          <span className="text-claw-red font-bold">{state.errorCategory || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between text-xs font-mono">
                          <span className="text-slate-400">Match Strength</span>
                          <span className="text-claw-cyan">{matchStrength != null ? `${matchStrength}%` : 'N/A'}</span>
                        </div>
                        <div className="flex justify-between text-xs font-mono">
                          <span className="text-slate-400">Source</span>
                          <span className={classificationSource === 'heuristic' ? 'text-claw-emerald' : 'text-yellow-400'}>{classificationSource || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between text-xs font-mono">
                          <span className="text-slate-400">Retries</span>
                          <span className="text-white/80">{state.retryCount}</span>
                        </div>
                        <div className="flex justify-between text-xs font-mono">
                          <span className="text-slate-400">Interventions</span>
                          <span className="text-white/80">{state.interventionsAttempted}</span>
                        </div>
                      </div>
                    )}
                  </div>

                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-white/10 bg-black/80 shrink-0 flex items-center justify-between">
              <div className="text-[9px] font-mono text-slate-600 tracking-widest">
                REPOCLAW // BUILD RECOVERY REPORT // {state.interventionsAttempted || 0} REPAIRS // {state.retryCount || 0} CYCLES // JOB-{state.jobId || '?'}
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="px-8 py-3 bg-white/10 hover:bg-white/20 text-white font-bold font-mono text-sm tracking-widest rounded-xl transition-all border border-white/10 hover:border-white/30 hover:shadow-[0_0_20px_rgba(255,255,255,0.1)]"
              >
                CLOSE REPORT
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
});
