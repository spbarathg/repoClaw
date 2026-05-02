import type { RepoClawState } from '../hooks/useRepoClawSocket';
import { X, ShieldCheck, ShieldAlert, AlertTriangle, XCircle, Code2, Terminal, Layers, Cpu, Server, Lock, Activity, Eye, Play, OctagonX, BadgeCheck, FileWarning } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import React, { useState, useEffect, useMemo, memo } from 'react';
import { parseMarkdownReport } from '../utils/reportParser';

export const VerdictModal: React.FC<{ state: RepoClawState }> = memo(({ state }) => {
  const [isOpen, setIsOpen] = useState(false);
  const { stage, verdict, report, confidence, jobId, targetUrl, commandMutations, confidenceMatrix } = state;

  useEffect(() => {
    if (stage === 'VERDICT' && verdict && report) {
      setIsOpen(true);
    }
  }, [stage, verdict, report]);

  const parsed = useMemo(() => parseMarkdownReport(report), [report]);

  const forensicScore = state.forensicScore;
  const scoreGrade = state.scoreGrade;
  
  const isSuccess = verdict === 'BUILDABLE';
  const isFixable = verdict === 'FIXABLE';
  const isInfra = verdict === 'INFRASTRUCTURE_ERROR';
  const isUnsupported = verdict === 'UNSUPPORTED_ARCHITECTURE';
  const isTerminal = verdict === 'TERMINAL_UNRESOLVED_NO_NEW_STRATEGY';
  
  let color = 'text-claw-red';
  let glow = 'text-glow-red';
  let bgGlow = 'bg-claw-red/10 border-claw-red/30';
  let Icon = XCircle;
  let sub = 'NON-BUILDABLE / FATAL';
  let certificationText = 'FORENSIC BUILD FAILURE CONFIRMED';

  if (isSuccess) { 
    color = 'text-claw-emerald'; glow = 'text-glow-emerald'; bgGlow = 'bg-claw-emerald/10 border-claw-emerald/30'; 
    Icon = ShieldCheck; sub = 'BUILDABLE / PRISTINE'; 
    certificationText = 'REPOSITORY CERTIFIED UNDER AUTONOMOUS BUILD PROTOCOL';
  }
  else if (isFixable) { 
    color = 'text-yellow-400'; glow = 'text-glow'; bgGlow = 'bg-yellow-400/10 border-yellow-400/30'; 
    Icon = AlertTriangle; sub = 'FIXABLE / PATCHED'; 
    certificationText = 'REPOSITORY CERTIFIED UNDER AUTONOMOUS BUILD PROTOCOL (PATCHED)';
  }
  else if (isUnsupported) {
    color = 'text-slate-400'; glow = ''; bgGlow = 'bg-slate-500/10 border-slate-500/30';
    Icon = Layers; sub = 'STATIC / META ARCHITECTURE';
    certificationText = 'STATIC ARCHITECTURE / NO EXECUTION SURFACE';
  }
  else if (isInfra) { 
    color = 'text-orange-500'; glow = 'text-glow-orange'; bgGlow = 'bg-orange-500/10 border-orange-500/30'; 
    Icon = ShieldAlert; sub = 'INFRASTRUCTURE ERROR'; 
    certificationText = 'INFRASTRUCTURE OR RUNTIME ENVIRONMENT FAILURE';
  }
  else if (isTerminal) {
    color = 'text-rose-500'; glow = 'text-glow-red'; bgGlow = 'bg-rose-500/10 border-rose-500/30';
    Icon = OctagonX; sub = 'TERMINAL UNRESOLVED';
    certificationText = 'TERMINAL BUILD FAILURE / LOOP EXHAUSTED';
  }

  const fingerprint = useMemo(() => {
    if (!jobId || !targetUrl) return 'PENDING';
    let hash = 0;
    const str = `${jobId}-${targetUrl}`;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0;
    }
    return Math.abs(hash).toString(16).toUpperCase().padStart(8, '0');
  }, [jobId, targetUrl]);

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
            className={`glass-panel-heavy border border-white/10 ring-1 ring-white/5 shadow-[0_0_120px_rgba(0,0,0,0.8)] w-[92vw] h-[86vh] flex flex-col relative z-10 overflow-hidden rounded-3xl bg-[#030305]`}
          >
            <div className="absolute inset-0 cyber-grid-bg opacity-30 pointer-events-none" />
            
            <div className="scanline-horizontal" />

            <div className="absolute inset-0 pointer-events-none overflow-hidden flex items-center justify-center opacity-5 select-none z-0 mix-blend-overlay">
               <div className="text-[120px] font-black font-sans tracking-[0.2em] transform -rotate-12 whitespace-nowrap">
                 REPOCLAW FORENSIC SYSTEM // CLASSIFIED
               </div>
               <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/5 to-transparent animate-beam" />
            </div>

            {/* Certification Banner */}
            <div className={`w-full py-2 flex items-center justify-center gap-4 ${bgGlow} shrink-0`}>
              {isSuccess || isFixable ? <BadgeCheck size={18} className={color} /> : <FileWarning size={18} className={color} />}
              <span className={`text-[11px] font-mono tracking-[0.4em] font-bold uppercase ${color}`}>{certificationText}</span>
              {isSuccess || isFixable ? <BadgeCheck size={18} className={color} /> : <FileWarning size={18} className={color} />}
            </div>

            {/* Header / Hero Band */}
            <div className={`relative p-8 border-b border-white/5 bg-gradient-to-r from-black/80 to-transparent flex items-center justify-between shrink-0 overflow-hidden`}>
              <div className="absolute top-0 left-0 w-1 h-full bg-current opacity-50" />
              
              <div className="flex items-center gap-8 relative z-10">
                <motion.div 
                  initial={{ rotateY: 90 }}
                  animate={{ rotateY: 0 }}
                  transition={{ delay: 0.3, type: "spring" }}
                  className={`w-28 h-28 rounded-2xl border border-white/10 bg-black/50 shadow-inner flex items-center justify-center shrink-0 ${color} ${glow}`}
                >
                  <span className="text-8xl font-black font-sans leading-none tracking-tighter">{scoreGrade}</span>
                </motion.div>

                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <Icon className={`${color} ${glow}`} size={24} />
                    <span className={`text-sm font-mono tracking-[0.3em] uppercase ${color} ${glow}`}>{sub}</span>
                  </div>
                  <h1 className="text-4xl font-bold text-white tracking-tight font-sans">
                    {targetUrl ? new URL(targetUrl).pathname.split('/').pop() : 'UNKNOWN_TARGET'}
                  </h1>
                  <div className="text-xs font-mono text-slate-500 mt-2 flex items-center gap-2">
                    <Activity size={12} className="animate-pulse" />
                    DOSSIER ID: {jobId || 'AWAITING'}
                  </div>
                </div>
              </div>

              <button onClick={() => setIsOpen(false)} className="p-3 rounded-xl hover:bg-white/10 text-slate-500 hover:text-white transition-colors border border-white/5 bg-black/50 backdrop-blur-md relative z-10">
                <X size={24} />
              </button>
            </div>

            {/* Readiness Badge Strip */}
            <div className="flex items-center gap-1 p-2 bg-black/90 border-b border-white/5 shrink-0 overflow-x-auto custom-scrollbar relative z-10">
               <div className="flex items-center gap-2 px-4 py-1 border border-white/10 rounded-full text-[9px] font-mono tracking-widest text-slate-400 bg-white/5 whitespace-nowrap"><Lock size={10} className="text-claw-cyan" /> ZERO_TRUST_SANDBOX</div>
               <div className={`flex items-center gap-2 px-4 py-1 border rounded-full text-[9px] font-mono tracking-widest whitespace-nowrap ${state.interventionsAttempted > 0 ? 'border-claw-cyan/30 text-claw-cyan bg-claw-cyan/10' : 'border-white/10 text-slate-400 bg-white/5'}`}><Cpu size={10} /> AUTO_PATCH: {state.interventionsAttempted > 0 ? `${state.interventionsAttempted} DEPLOYED` : 'STANDBY'}</div>
               <div className={`flex items-center gap-2 px-4 py-1 border rounded-full text-[9px] font-mono tracking-widest whitespace-nowrap ${isSuccess || isFixable ? 'border-claw-emerald/30 text-claw-emerald bg-claw-emerald/10' : 'border-slate-700 text-slate-600 bg-black'}`}><Play size={10} /> {isSuccess || isFixable ? 'CI_READY' : 'CI_BLOCKED'}</div>
               <div className={`flex items-center gap-2 px-4 py-1 border rounded-full text-[9px] font-mono tracking-widest whitespace-nowrap ${scoreGrade !== 'N/A' && forensicScore >= 75 ? 'border-claw-emerald/30 text-claw-emerald bg-claw-emerald/10' : scoreGrade !== 'N/A' && forensicScore >= 35 ? 'border-yellow-400/30 text-yellow-400 bg-yellow-400/10' : 'border-claw-red/30 text-claw-red bg-claw-red/10'}`}><Activity size={10} /> SCORE: {scoreGrade === 'N/A' || scoreGrade === 'I' ? 'N/A' : `${forensicScore}/100`}</div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-8 relative z-10">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 h-full">
                
                {/* Left: Autonomous Intervention Timeline (Hero) */}
                <div className="col-span-1 lg:col-span-8 flex flex-col gap-8 pr-4">
                   {isUnsupported ? (
                     <div className="h-full flex flex-col items-center justify-center text-slate-500 font-mono text-center opacity-50 p-12 border border-dashed border-slate-700/50 rounded-2xl bg-black/20">
                        <Layers size={48} className="mb-6 text-slate-600" />
                        <div className="text-xl font-bold tracking-widest text-slate-400 mb-2">NO EXECUTABLE WORKSPACE DETECTED</div>
                        <div className="text-sm max-w-md mx-auto leading-relaxed">
                          This repository has been classified as a static, documentation, or meta architecture. 
                          No deterministic runtime build surface was found.
                          Autonomous intervention cycles are disabled.
                        </div>
                     </div>
                   ) : (
                     <>
                       {/* Command Mutations Transparent Log */}
                       {commandMutations && commandMutations.length > 0 && (
                         <div className="mb-8">
                           <div className="text-sm font-sans tracking-widest text-slate-400 uppercase border-b border-white/10 pb-4 flex items-center gap-3 mb-4">
                              <Terminal size={18} className="text-claw-cyan" /> 
                              Command Intervention Diffs
                           </div>
                           <div className="space-y-4">
                             {commandMutations.map((mut, idx) => (
                               <div key={idx} className="bg-black/40 border border-white/5 rounded-lg p-4 font-mono text-xs">
                                 <div className="flex justify-between items-center mb-3 border-b border-white/5 pb-2">
                                   <span className="text-claw-cyan tracking-widest uppercase">CYCLE {mut.cycle} - {mut.type} MUTATION</span>
                                   <span className="text-slate-500">Asset: {mut.asset}</span>
                                 </div>
                                 <div className="grid grid-cols-1 gap-2">
                                   <div className="flex">
                                     <span className="w-16 text-slate-500 select-none">- PRE:</span>
                                     <span className="text-red-400/80 line-through truncate">{mut.before || '(empty)'}</span>
                                   </div>
                                   <div className="flex">
                                     <span className="w-16 text-slate-500 select-none">+ POST:</span>
                                     <span className="text-claw-emerald truncate">{mut.after}</span>
                                   </div>
                                 </div>
                               </div>
                             ))}
                           </div>
                         </div>
                       )}

                       <div className="text-sm font-sans tracking-widest text-slate-400 uppercase border-b border-white/10 pb-4 flex items-center gap-3">
                          <Activity size={18} className="text-claw-cyan" /> 
                          Diagnostics Timeline
                       </div>

                       {parsed.cycles.length > 0 ? (
                         <div className="flex flex-col gap-10 relative mt-4">
                            <div className="absolute left-[27px] top-4 bottom-4 w-[2px] bg-gradient-to-b from-claw-cyan via-claw-purple to-transparent opacity-40 shadow-[0_0_15px_#00f0ff]" />
                            
                            {parsed.cycles.map((cycle, idx) => (
                               <div key={idx} className="flex gap-8 relative z-10 group">
                                  <div className="w-14 h-14 rounded-full bg-black border border-claw-cyan flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(0,240,255,0.2)] mt-1">
                                     <div className="text-sm font-mono font-bold text-claw-cyan">{cycle.cycle}</div>
                                  </div>
                                  <div className="flex-1">
                                     <div className="flex items-center justify-between mb-3 border-b border-white/5 pb-2">
                                        <div className="text-lg font-sans font-semibold text-white tracking-tight">Cycle Intervention Analysis</div>
                                        <div className="text-xs font-mono text-claw-cyan bg-claw-cyan/10 px-3 py-1 rounded">CONF: {cycle.confidence}</div>
                                     </div>
                                     <div className="mb-4">
                                        <div className="text-[10px] font-mono tracking-widest text-slate-500 mb-1 uppercase">Diagnosed Fault</div>
                                        <div className="text-base font-sans text-claw-red leading-relaxed">{cycle.error}</div>
                                     </div>
                                     <div>
                                        <div className="text-[10px] font-mono tracking-widest text-slate-500 mb-1 uppercase">Severity / Retry Status</div>
                                        <div className="text-sm font-mono text-slate-300 leading-relaxed border-l-2 border-slate-700 pl-4 py-1">{cycle.patch}</div>
                                     </div>
                                  </div>
                               </div>
                            ))}
                         </div>
                       ) : (
                         <div className="text-slate-500 font-mono text-sm">No intervention cycles logged.</div>
                       )}
                     </>
                   )}
                </div>

                {/* Right: Stacked Intelligence Cards */}
                <div className="col-span-1 lg:col-span-4 flex flex-col gap-6">
                   
                   <div className="pb-4 border-b border-white/5">
                      <div className="text-[10px] font-mono tracking-widest text-slate-500 mb-2 uppercase flex items-center gap-2">
                         <Layers size={14} /> Detected Stack
                      </div>
                      <div className="font-sans text-xl font-medium text-white">{parsed.architecture}</div>
                      <div className="text-xs font-mono text-slate-600 mt-2">FINGERPRINT: {fingerprint}</div>
                   </div>

                   <div className="pb-4 border-b border-white/5">
                      <div className="text-[10px] font-mono tracking-widest text-slate-500 mb-3 uppercase flex items-center justify-between">
                         <span className="flex items-center gap-2"><Cpu size={14} /> Forensic Score</span>
                          <span className={`font-bold ${color}`}>{scoreGrade === 'N/A' || scoreGrade === 'I' ? 'N/A' : `${forensicScore}/100`}</span>
                      </div>
                      <div className="h-2 w-full bg-black rounded-full overflow-hidden border border-white/5">
                         <div 
                           className={`h-full transition-all duration-1000 ${forensicScore >= 75 ? 'bg-claw-emerald' : forensicScore >= 55 ? 'bg-yellow-400' : forensicScore >= 35 ? 'bg-orange-400' : 'bg-claw-red'}`} 
                           style={{ width: `${Math.max(forensicScore, 0)}%` }} 
                         />
                      </div>
                      <div className="flex justify-between mt-2 text-[8px] font-mono text-slate-600">
                        <span>Retries: {state.retryCount}</span>
                        <span>Interventions: {state.interventionsAttempted}</span>
                      </div>
                   </div>

                   {/* Confidence Matrix Compact View */}
                   {confidenceMatrix && (
                     <div className="pb-4 border-b border-white/5">
                        <div className="text-[10px] font-mono tracking-widest text-slate-500 mb-3 uppercase flex items-center gap-2">
                           <Activity size={14} /> Intelligence Matrix
                        </div>
                        <div className="space-y-2">
                          <div className="flex justify-between text-xs font-mono text-slate-300">
                            <span>Manifest Integrity</span><span className={confidenceMatrix.manifestIntegrity >= 70 ? "text-claw-cyan" : "text-orange-400"}>{confidenceMatrix.manifestIntegrity}%</span>
                          </div>
                          <div className="flex justify-between text-xs font-mono text-slate-300">
                            <span>Dependency Stability</span><span className={confidenceMatrix.dependencyStability >= 70 ? "text-claw-emerald" : "text-orange-400"}>{confidenceMatrix.dependencyStability}%</span>
                          </div>
                          <div className="flex justify-between text-xs font-mono text-slate-300">
                            <span>Build Surface</span><span className={confidenceMatrix.buildSurface >= 70 ? "text-claw-purple" : "text-orange-400"}>{confidenceMatrix.buildSurface}%</span>
                          </div>
                          <div className="flex justify-between text-xs font-mono text-slate-300">
                            <span>Recoverability</span><span className={confidenceMatrix.recoverability >= 70 ? "text-yellow-400" : "text-red-400"}>{confidenceMatrix.recoverability}%</span>
                          </div>
                          <div className="flex justify-between text-xs font-mono text-slate-300">
                            <span>Environment Risk</span><span className={confidenceMatrix.environmentRisk <= 30 ? "text-claw-emerald" : "text-red-500"}>{confidenceMatrix.environmentRisk}%</span>
                          </div>
                        </div>
                     </div>
                   )}

                   <div className="pb-4 border-b border-white/5">
                      <div className="text-[10px] font-mono tracking-widest text-slate-500 mb-3 uppercase flex items-center gap-2">
                         <Activity size={14} /> Root Cause Vector
                      </div>
                      {isSuccess ? (
                        <ul className="text-sm font-sans text-slate-300 space-y-3 pl-1">
                          <li className="flex items-start gap-3">
                            <span className="text-claw-emerald mt-1">✓</span>
                            <span>Primary Anomaly: <span className="text-claw-emerald">CLEAN</span></span>
                          </li>
                          <li className="flex items-start gap-3">
                            <span className="text-claw-emerald mt-1">✓</span>
                            <span>Vector Cascade: NONE</span>
                          </li>
                        </ul>
                      ) : isFixable ? (
                        <ul className="text-sm font-sans text-slate-300 space-y-3 pl-1">
                          <li className="flex items-start gap-3">
                            <span className="text-yellow-400 mt-1">&#10003;</span>
                            <span>Primary Anomaly: <span className="text-yellow-400">{state.errorCategory || 'RESOLVED'}</span></span>
                          </li>
                          <li className="flex items-start gap-3">
                            <span className="text-yellow-400 mt-1">&#10003;</span>
                            <span>Status: <span className="text-claw-emerald">AUTONOMOUSLY PATCHED</span></span>
                          </li>
                          {confidence != null && (
                            <li className="flex items-start gap-3">
                              <span className="text-slate-500 mt-1">&#8226;</span>
                              <span>Confidence: {confidence}%</span>
                            </li>
                          )}
                        </ul>
                      ) : (
                        <ul className="text-sm font-sans text-slate-300 space-y-3 pl-1">
                          <li className="flex items-start gap-3">
                            <span className="text-slate-500 mt-1">•</span>
                            <span>Primary Anomaly: <span className="text-claw-red">{state.errorCategory || (isUnsupported ? 'N/A' : 'UNRESOLVED')}</span></span>
                          </li>
                          <li className="flex items-start gap-3">
                            <span className="text-slate-500 mt-1">•</span>
                            <span>Confidence: {confidence != null ? `${confidence}%` : 'N/A'}</span>
                          </li>
                        </ul>
                      )}
                   </div>

                   <div className="flex-1 flex flex-col">
                      <div className="text-[10px] font-mono tracking-widest text-slate-500 mb-3 uppercase flex items-center gap-2">
                         <AlertTriangle size={14} /> Machine Recommendation
                      </div>
                      <div className="text-sm font-sans text-slate-300 leading-relaxed overflow-y-auto">
                         {parsed.reasoning}
                      </div>
                   </div>

                </div>
              </div>
            </div>

            {/* Bottom Artifact Strip */}
            {!isUnsupported && state.generatedAssets && state.generatedAssets.length > 0 && (
               <div className="px-8 py-4 bg-white/[0.01] border-t border-white/5 shrink-0 flex items-center gap-4 overflow-x-auto custom-scrollbar">
                  <div className="text-[10px] font-mono tracking-widest text-slate-500 uppercase shrink-0">Generated Payloads:</div>
                  <div className="flex items-center gap-3">
                     {state.generatedAssets.map((asset, idx) => (
                        <div key={idx} className="bg-black border border-white/10 px-3 py-1.5 rounded-md text-xs font-mono text-slate-400 flex items-center gap-2 whitespace-nowrap shrink-0">
                           <Code2 size={12} className="text-claw-cyan opacity-70" /> {asset}
                        </div>
                     ))}
                  </div>
               </div>
            )}
            
            {/* Footer */}
            <div className="p-4 border-t border-white/10 bg-black/80 shrink-0 flex items-center justify-between">
               <div className="text-[9px] font-mono text-slate-600 tracking-widest">
                  REPOCLAW // FORENSIC DOSSIER // {state.interventionsAttempted || 0} INTERVENTIONS // SCORE: {scoreGrade === 'N/A' || scoreGrade === 'I' ? 'N/A' : forensicScore}/{scoreGrade} // FP-{fingerprint}
               </div>
               <button 
                 onClick={() => setIsOpen(false)}
                 className="px-8 py-3 bg-white/10 hover:bg-white/20 text-white font-bold font-mono text-sm tracking-widest rounded-xl transition-all border border-white/10 hover:border-white/30 hover:shadow-[0_0_20px_rgba(255,255,255,0.1)]"
               >
                 CLOSE DOSSIER
               </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
});
