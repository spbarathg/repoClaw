import type { RepoClawState } from '../hooks/useRepoClawSocket';
import { ShieldCheck, ShieldAlert, AlertTriangle, XCircle, Terminal, Layers, Server, Lock, Activity, OctagonX, Copy, Check } from 'lucide-react';
import React, { useState, memo } from 'react';

export const VerdictReportPanel: React.FC<{ state: RepoClawState }> = memo(({ state }) => {
  const { verdict, provenance, commandMutations, repairTrace } = state;
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  if (!verdict) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-zinc-500 font-mono text-center p-8 border border-zinc-800 bg-[#000]">
        <Activity size={32} className="mb-4 text-zinc-700 animate-pulse" />
        <div className="text-xs font-bold tracking-widest text-zinc-400 uppercase">AWAITING ENGINE ANALYSIS</div>
        <p className="text-[11px] max-w-sm mx-auto mt-2 text-zinc-500 leading-relaxed font-mono">
          Enter a repository URL above and run the build pipeline to generate the SRE report.
        </p>
      </div>
    );
  }

  const isSuccess = verdict === 'BUILD_SUCCEEDED';
  const isRepaired = verdict === 'REPAIRED';
  const isInfra = verdict === 'INFRA_FAILED';
  const isUnsupported = verdict === 'UNSUPPORTED';
  const isExhausted = verdict === 'REPAIR_EXHAUSTED';
  const isViolation = verdict === 'SANDBOX_VIOLATION';

  let color = 'text-claw-red';
  let bgGlow = 'bg-red-950/20 border-zinc-800';
  let Icon = XCircle;
  let sub = 'BUILD FAILED';
  let bannerText = 'BUILD FAILURE CONFIRMED';

  if (isSuccess) {
    color = 'text-claw-emerald'; bgGlow = 'bg-emerald-950/20 border-zinc-800';
    Icon = ShieldCheck; sub = 'BUILD SUCCEEDED';
    bannerText = 'BUILD SUCCEEDED — ZERO FAILURES';
  }
  else if (isRepaired) {
    color = 'text-yellow-500'; bgGlow = 'bg-yellow-950/20 border-zinc-800';
    Icon = AlertTriangle; sub = 'REPAIRED';
    bannerText = 'BUILD REPAIRED VIA DETERMINISTIC POLICY';
  }
  else if (isUnsupported) {
    color = 'text-zinc-500'; bgGlow = 'bg-zinc-950/50 border-zinc-800';
    Icon = Layers; sub = 'UNSUPPORTED';
    bannerText = 'NO EXECUTABLE BUILD SURFACE DETECTED';
  }
  else if (isInfra) {
    color = 'text-orange-500'; bgGlow = 'bg-orange-950/20 border-zinc-800';
    Icon = ShieldAlert; sub = 'INFRASTRUCTURE FAILED';
    bannerText = 'INFRASTRUCTURE OR RUNTIME FAILURE';
  }
  else if (isExhausted) {
    color = 'text-red-500'; bgGlow = 'bg-red-950/30 border-zinc-800';
    Icon = OctagonX; sub = 'REPAIR EXHAUSTED';
    bannerText = 'REPAIR LOOP EXHAUSTED — NO MUTATIONS REMAINING';
  }
  else if (isViolation) {
    color = 'text-red-500'; bgGlow = 'bg-red-950/50 border-red-900';
    Icon = ShieldAlert; sub = 'SANDBOX VIOLATION DETECTED';
    bannerText = 'CRITICAL SANDBOX SECURITY BREACH DETECTED';
  }

  const handleCopyDiff = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <div className="flex flex-col h-full bg-[#000] border border-zinc-800 rounded-none overflow-hidden">
      {/* Banner */}
      <div className={`w-full py-3 flex items-center justify-center gap-2.5 border-b ${bgGlow} shrink-0`}>
        <Icon size={16} className={color} />
        <span className={`text-[11px] font-mono tracking-widest font-bold uppercase ${color}`}>{bannerText}</span>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
        {/* Header Block */}
        <div className="flex items-center gap-6 pb-5 border-b border-zinc-800">
          <div className={`w-16 h-16 rounded-none border border-zinc-800 bg-[#111] flex items-center justify-center shrink-0 ${color}`}>
            <Icon size={32} />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-[10px] font-mono tracking-widest uppercase font-bold ${color}`}>{sub}</span>
            </div>
            <h3 className="text-xl font-bold text-white tracking-tight truncate max-w-[400px] font-mono">
              {(() => {
                const target = state.targetUrl;
                if (!target) return 'UNKNOWN_REPOSITORY';
                try {
                  if (target.includes('://')) {
                    return new URL(target).pathname.split('/').pop() || target;
                  }
                } catch (e) {}
                return target.split(/[\\/]/).pop() || target;
              })()}
            </h3>
            <div className="text-[10px] font-mono text-zinc-500 mt-1 flex items-center gap-5">
              <span className="flex items-center gap-1.5"><Server size={12} /> JOB: {state.jobId || '—'}</span>
              <span className="flex items-center gap-1.5"><Lock size={12} /> DOCKER: {provenance?.sandboxImage || 'node:20-alpine'}</span>
            </div>
          </div>
        </div>

        {/* Technical Diffs & Trace */}
        <div className="space-y-6">
          {isUnsupported ? (
            <div className="flex flex-col items-center justify-center text-zinc-500 font-mono text-center p-8 border border-dashed border-zinc-800 bg-[#08080a]">
              <Layers size={36} className="mb-4 text-zinc-700" />
              <div className="text-[11px] font-bold tracking-widest text-zinc-400 mb-1">NO EXECUTABLE SURFACE</div>
              <p className="text-[11px] max-w-sm mx-auto leading-relaxed text-zinc-500">
                This repository has no supported build configuration. No build scripts or recognized manifest files were identified.
              </p>
            </div>
          ) : (
            <>
              {/* Mutations */}
              {commandMutations && commandMutations.length > 0 && (
                <div className="space-y-3.5">
                  <h4 className="text-[10px] font-mono tracking-widest text-zinc-400 uppercase flex items-center gap-2 border-b border-zinc-800 pb-2.5">
                    <Terminal size={14} className="text-claw-cyan" />
                    Command Mutation Diffs
                  </h4>
                  <div className="space-y-3">
                    {commandMutations.map((mut, idx) => (
                      <div key={idx} className="bg-[#08080a] border border-zinc-800 rounded-none p-4 font-mono text-xs relative group">
                        <button
                          onClick={() => handleCopyDiff(mut.after, idx)}
                          className="absolute top-3 right-3 p-1.5 rounded-none bg-[#111] border border-zinc-800 text-zinc-400 opacity-0 group-hover:opacity-100 hover:text-white transition-all cursor-pointer"
                          title="Copy mutated command"
                        >
                          {copiedIndex === idx ? <Check size={12} className="text-claw-emerald" /> : <Copy size={12} />}
                        </button>
                        <div className="flex justify-between items-center mb-2.5 border-b border-zinc-800 pb-2 pr-8">
                          <span className="text-claw-cyan text-[11px] font-bold tracking-wider uppercase font-mono">CYCLE {mut.cycle} // {mut.type}</span>
                          <span className="text-[10px] text-zinc-500 font-mono">Surface: {mut.surface}</span>
                        </div>
                        <div className="space-y-1 font-mono text-[11px]">
                          {mut.before && (
                            <div className="flex items-start text-red-500/80 line-through">
                              <span className="w-4 select-none">-</span>
                              <span className="flex-1 break-all">{mut.before}</span>
                            </div>
                          )}
                          <div className="flex items-start text-claw-emerald">
                            <span className="w-4 select-none">+</span>
                            <span className="flex-1 break-all font-bold">{mut.after}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Repair Trace */}
              {repairTrace && repairTrace.length > 0 && (
                <div className="space-y-3.5">
                  <h4 className="text-[10px] font-mono tracking-widest text-zinc-400 uppercase flex items-center gap-2 border-b border-zinc-800 pb-2.5">
                    <Activity size={14} className="text-claw-cyan" />
                    Recovery Policy Logs & File Diffs
                  </h4>
                  <div className="relative pl-6 space-y-5 before:absolute before:left-3 before:top-2 before:bottom-2 before:w-[1px] before:bg-zinc-800">
                    {repairTrace.map((trace, idx) => (
                      <div key={idx} className="relative group">
                        {/* Chronological bullet dot */}
                        <div className="absolute -left-[23px] top-1.5 w-3 h-3 bg-[#000] border border-claw-cyan flex items-center justify-center">
                          <div className="w-1 h-1 bg-claw-cyan" />
                        </div>
                        <div className="bg-[#08080a] border border-zinc-800 rounded-none p-4">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-mono font-bold text-white">{trace.failureCategory}</span>
                            <span className="text-[10px] font-mono text-claw-cyan bg-claw-cyan/5 px-2 py-0.5 border border-claw-cyan/15">
                              {Math.round(trace.matchStrength * 100)}% Match
                            </span>
                          </div>
                          {trace.repairStrategy ? (
                            <div className="space-y-2 text-[11px] font-mono">
                              <div className="text-zinc-400">
                                Strategy: <span className="text-white font-semibold">{trace.repairStrategy}</span>
                              </div>
                              <div className="text-zinc-500 text-[10px] flex items-center gap-3">
                                <span>Safety: <span className={trace.repairSafety === 'SAFE' ? 'text-claw-emerald font-bold' : trace.repairSafety === 'CONSTRAINED' ? 'text-yellow-500 font-bold' : 'text-claw-red font-bold'}>{trace.repairSafety}</span></span>
                                <span>|</span>
                                <span>Surface: {trace.mutationSurface || 'none'}</span>
                              </div>
                              {trace.rolledBack && (
                                <div className="text-[10px] font-mono text-claw-red animate-pulse mt-1">
                                  ⟲ Rolled back — regression detected in validation
                                </div>
                              )}

                              {/* SIDE-BY-SIDE GIT DIFF INSPECTOR */}
                              {trace.fileMutated && (
                                <div className="mt-3.5 border border-zinc-800 bg-[#000] font-mono text-[10px] overflow-hidden">
                                  <div className="bg-[#0c0c0e] px-3 py-1.5 border-b border-zinc-800 text-[9px] text-zinc-400 flex justify-between items-center select-none">
                                    <span className="font-bold uppercase tracking-wider text-claw-cyan">FILE MUTATED: {trace.fileMutated.path.split(/[\\/]/).pop()}</span>
                                    <span className="text-zinc-600 font-mono text-[8px]">{trace.fileMutated.path}</span>
                                  </div>
                                  <div className="grid grid-cols-2 divide-x divide-zinc-800 max-h-56 overflow-y-auto custom-scrollbar">
                                    {/* Content Before */}
                                    <div className="p-3 bg-[#110505] text-red-200/90">
                                      <div className="text-[9px] text-red-500 font-bold border-b border-red-950/50 pb-1 mb-2 tracking-wider">BEFORE (ORIGINAL)</div>
                                      <pre className="whitespace-pre font-mono leading-relaxed">{trace.fileMutated.contentBefore || '(Empty or Non-Existent)'}</pre>
                                    </div>
                                    {/* Content After */}
                                    <div className="p-3 bg-[#051105] text-emerald-200/90">
                                      <div className="text-[9px] text-claw-emerald font-bold border-b border-emerald-950/50 pb-1 mb-2 tracking-wider">AFTER (MUTATED)</div>
                                      <pre className="whitespace-pre font-mono leading-relaxed font-bold">{trace.fileMutated.contentAfter || '(Empty or Deleted)'}</pre>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="text-[11px] font-mono text-zinc-500">
                              {trace.rejectionReason ? `Rejected: ${trace.rejectionReason}` : 'No recovery policy applied.'}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Footer Info */}
      <div className="px-6 py-4 border-t border-zinc-800 bg-[#08080a] flex justify-between items-center text-[10px] font-mono text-zinc-500 tracking-wider">
        <span>REPOCLAW REPORT PIPELINE // JOB-{state.jobId || 'AWAITING'}</span>
        <span>{state.retryCount || 0} CYCLES COMPLETED</span>
      </div>
    </div>
  );
});
