import type { RepoClawState } from '../hooks/useRepoClawSocket';
import { Layers, ShieldAlert, Code2, Package, Settings2, ShieldCheck, XCircle, AlertTriangle } from 'lucide-react';
import { motion } from 'framer-motion';
import React, { memo } from 'react';

export const RightAnalytics: React.FC<{ state: RepoClawState }> = memo(({ state }) => {
  const { intelligence, targetUrl, errorCategory, confidence, verdict } = state;

  return (
    <div className="flex flex-col gap-4 h-full">
      
      {/* Target Origin Box */}
      <div className="glass-panel-heavy p-4 relative overflow-hidden shrink-0">
        <div className="absolute inset-0 bg-noise opacity-30 pointer-events-none"></div>

        <div className="flex items-center gap-2 text-slate-500 text-[9px] font-mono mb-2 tracking-widest uppercase relative z-10">
          <Layers size={12} className="text-claw-purple" />
          Target_Architecture
        </div>
        <div className="text-base font-bold text-white tracking-wide truncate mb-3 relative z-10">
          {targetUrl ? new URL(targetUrl).pathname.split('/').pop() : 'AWAITING_INPUT'}
        </div>
        
        {/* Dynamic Stack Chips */}
        <div className="flex flex-col gap-2 relative z-10">
          <div className={`flex items-center gap-2 px-2 py-1.5 rounded-md border text-[10px] font-mono transition-colors duration-500 ${intelligence.language ? 'bg-claw-cyan/10 border-claw-cyan/30 text-claw-cyan' : 'bg-white/5 border-white/10 text-slate-500'}`}>
             <Code2 size={12} />
             {intelligence.language || 'DETECTING_LANG...'}
          </div>
          <div className={`flex items-center gap-2 px-2 py-1.5 rounded-md border text-[10px] font-mono transition-colors duration-500 ${intelligence.packageManager ? 'bg-claw-emerald/10 border-claw-emerald/30 text-claw-emerald' : 'bg-white/5 border-white/10 text-slate-500'}`}>
             <Package size={12} />
             {intelligence.packageManager || 'DETECTING_PKG...'}
          </div>
        </div>
      </div>

      {/* Live Inference Box */}
      <div className="glass-panel p-4 relative overflow-hidden flex-1 flex flex-col min-h-0">
        <div className="flex items-center gap-2 text-slate-400 text-[9px] font-mono mb-3 tracking-[0.2em] uppercase shrink-0">
          <Settings2 size={12} className="text-white" />
          Live_Inference_State
        </div>

        <div className="flex justify-around mb-4 shrink-0 px-2">
           <div className="flex flex-col items-center gap-2">
              <div className="relative w-14 h-14 flex items-center justify-center rounded-full border border-white/10 bg-black/40 shadow-inner">
                 <div className="absolute inset-0 rounded-full border border-t-claw-cyan animate-spin-slow opacity-50" />
                 <div className={`text-xs font-mono font-bold ${intelligence.currentCycle ? 'text-white' : 'text-slate-600'}`}>
                    {intelligence.currentCycle?.replace('/', ' / ') || '--'}
                 </div>
              </div>
              <div className="text-[8px] text-slate-500 font-mono tracking-widest uppercase text-center">RETRY CYCLE</div>
           </div>
           
           <div className="flex flex-col items-center gap-2">
               <div className="relative w-14 h-14 flex items-center justify-center rounded-full border border-white/10 bg-black/40 shadow-inner">
                 <div className="absolute inset-0 rounded-full border border-b-claw-cyan animate-spin-reverse-slow opacity-50" />
                 <div className={`text-xl font-mono font-bold ${state.interventionsAttempted > 0 ? 'text-claw-cyan text-glow-cyan' : 'text-slate-600'}`}>
                    {state.interventionsAttempted}
                 </div>
              </div>
              <div className="text-[8px] text-slate-500 font-mono tracking-widest uppercase text-center">INTERVENTIONS</div>
           </div>
           
           <div className="flex flex-col items-center gap-2">
              <div className="relative w-14 h-14 flex items-center justify-center rounded-full border border-white/10 bg-black/40 shadow-inner">
                 <div className="absolute inset-0 rounded-full border border-r-claw-purple animate-spin-slow opacity-50" />
                 <div className={`text-xl font-mono font-bold ${state.generatedAssets.length > 0 ? 'text-claw-purple text-glow-purple' : 'text-slate-600'}`}>
                    {state.generatedAssets.length}
                 </div>
              </div>
              <div className="text-[8px] text-slate-500 font-mono tracking-widest uppercase text-center">ASSETS</div>
           </div>
        </div>
        
        {/* Compact AI Diagnostic */}
        <div className="bg-black/40 border border-white/5 p-3 rounded-lg mb-3 shrink-0 flex items-center justify-between">
           <div>
             <div className="flex items-center gap-2 text-slate-500 text-[8px] font-mono mb-1 tracking-widest uppercase">
               <ShieldAlert size={10} className={errorCategory ? 'text-yellow-400' : 'text-slate-500'} />
               AI_DIAGNOSTIC
             </div>
             <div className={`text-[10px] font-mono truncate w-24 ${errorCategory ? 'text-yellow-400 text-glow' : 'text-slate-600'}`}>
               {errorCategory || 'AWAITING'}
             </div>
           </div>
           
           <div className="relative w-10 h-10 shrink-0">
              <svg className="w-10 h-10 transform -rotate-90">
                 <circle cx="20" cy="20" r="16" stroke="currentColor" strokeWidth="2.5" fill="transparent" className="text-white/5" />
                 <circle cx="20" cy="20" r="16" stroke="currentColor" strokeWidth="2.5" fill="transparent" 
                         strokeDasharray={2 * Math.PI * 16} 
                         strokeDashoffset={2 * Math.PI * 16 * (1 - (confidence || 0) / 100)}
                         className="text-yellow-400 transition-all duration-1000 ease-out" />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center text-[8px] font-mono text-yellow-400 font-bold">
                {confidence || 0}%
              </div>
           </div>
        </div>

        {/* Generated Assets List */}
        <div className="flex-1 min-h-0 flex flex-col">
           <div className="text-[8px] text-slate-500 font-mono tracking-widest mb-2 shrink-0 flex items-center gap-2">
             <span className="w-1.5 h-1.5 rounded-full bg-claw-cyan animate-pulse"></span>
             GENERATED_RECOVERY_ASSETS
           </div>
           {state.generatedAssets.length > 0 ? (
             <div className="flex flex-col gap-2 overflow-y-auto custom-scrollbar pr-1 flex-1">
               {state.generatedAssets.map((asset, i) => (
                  <div key={i} className="bg-claw-cyan/5 border border-claw-cyan/20 p-2 rounded border-l-2 border-l-claw-cyan text-[9px] font-mono text-slate-300">
                     <span className="opacity-70 mr-2">📄</span><span className="line-clamp-2 leading-snug">{asset}</span>
                  </div>
               ))}
             </div>
           ) : (
             <div className="text-[10px] font-mono text-slate-600 border border-dashed border-white/10 rounded-lg p-3 text-center flex-1 flex items-center justify-center">
               Awaiting synthesis...
             </div>
           )}
        </div>
      </div>

      {/* Dominant CLAW SCORE Component */}
      <div className={`glass-panel-heavy p-6 relative overflow-hidden shrink-0 border ${verdict ? (verdict === 'BUILDABLE' ? 'border-claw-emerald/50 ring-1 ring-claw-emerald/20' : verdict === 'FIXABLE' ? 'border-yellow-400/50 ring-1 ring-yellow-400/20' : verdict === 'INFRASTRUCTURE_ERROR' ? 'border-orange-500/50 ring-1 ring-orange-500/20' : 'border-claw-red/50 ring-1 ring-claw-red/20') : 'border-white/10'} transition-all duration-1000 min-h-[140px] flex flex-col justify-center shadow-[0_0_50px_rgba(0,0,0,0.5)]`}>
        <div className="absolute inset-0 bg-noise opacity-40 mix-blend-overlay"></div>
        <div className="text-[10px] font-mono text-slate-500 tracking-[0.3em] uppercase mb-4 relative z-10 flex items-center justify-between">
           <span>FINAL_CLAW_SCORE</span>
           {verdict && <span className="animate-pulse w-2 h-2 rounded-full bg-white"></span>}
        </div>
        
        {verdict ? (
          (() => {
            // Use COMPUTED grade from backend
            const grade = state.scoreGrade || 'F';
            const score = state.forensicScore;
            let color = 'text-claw-red bg-claw-red/10 text-glow-red';
            let Icon = XCircle;
            let sub = `SCORE: ${score >= 0 ? score : 'N/A'}/100`;
            if (grade === 'S') { color = 'text-claw-emerald bg-claw-emerald/10 text-glow-emerald'; Icon = ShieldCheck; }
            else if (grade === 'A') { color = 'text-yellow-400 bg-yellow-400/10 text-glow'; Icon = AlertTriangle; }
            else if (grade === 'B') { color = 'text-blue-400 bg-blue-400/10'; Icon = ShieldAlert; }
            else if (grade === 'C') { color = 'text-orange-400 bg-orange-400/10 text-glow-orange'; Icon = ShieldAlert; }
            else if (grade === 'I') { color = 'text-orange-500 bg-orange-500/10 text-glow-orange'; Icon = ShieldAlert; }
            else if (grade === 'N/A') { color = 'text-slate-400 bg-slate-500/10'; Icon = Layers; }
            
            return (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-6 relative z-10"
              >
                 <motion.div 
                   initial={{ scale: 0, rotate: -90 }}
                   animate={{ scale: 1, rotate: 0 }}
                   transition={{ type: "spring", stiffness: 200, damping: 20 }}
                   className={`w-20 h-20 rounded-2xl flex items-center justify-center shrink-0 border border-white/20 shadow-inner ${color.split(' ')[1]}`}
                 >
                    <Icon size={40} className={color.split(' ')[0]} />
                 </motion.div>
                 <div className="flex-1">
                   <div className={`text-6xl font-black font-sans leading-none tracking-tighter ${color.split(' ')[0]} drop-shadow-[0_0_15px_currentColor]`}>{grade}</div>
                   <div className="text-[10px] font-mono uppercase tracking-widest opacity-80 mt-2 text-white">{sub}</div>
                 </div>
              </motion.div>
            )
          })()
        ) : (
          <div className="flex items-center justify-center gap-6 p-4 rounded-2xl relative z-10 w-full">
             <div className="relative w-16 h-16 flex items-center justify-center shrink-0">
               <div className="absolute inset-0 rounded-full border border-white/10" />
               <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-claw-cyan border-l-claw-cyan animate-spin-slow opacity-30" />
               <div className="absolute inset-2 rounded-full border border-dashed border-white/20 animate-spin-reverse-slow" />
               <div className="text-xs font-mono opacity-50">?</div>
             </div>
             <div className="flex flex-col">
               <div className="text-sm font-mono uppercase tracking-[0.3em] opacity-50 mb-1 text-claw-cyan animate-pulse">AWAITING_VERDICT</div>
               <div className="text-[9px] font-mono opacity-30 tracking-widest">DOSSIER_PENDING</div>
             </div>
          </div>
        )}
      </div>

    </div>
  );
});
