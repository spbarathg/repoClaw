import type { RepoClawState } from '../hooks/useRepoClawSocket';
import { Terminal, Download, FileSearch, Box, ShieldAlert, Wrench, RefreshCcw } from 'lucide-react';
import { motion } from 'framer-motion';
import React, { memo } from 'react';

const STAGES = [
  { id: 'FETCH', label: 'SOURCE AQUISITION', icon: Download },
  { id: 'STRUCTURE', label: 'ARCHITECTURAL SCAN', icon: FileSearch },
  { id: 'BUILD', label: 'AUTONOMOUS BUILD', icon: Box },
  { id: 'CLASSIFY', label: 'GEMINI DIAGNOSTICS', icon: ShieldAlert },
  { id: 'FIX', label: 'SYNTHESIZING PATCH', icon: Wrench },
  { id: 'RETRY', label: 'VERIFICATION CYCLE', icon: RefreshCcw }
];

export const PipelineVisualization: React.FC<{ state: RepoClawState }> = memo(({ state }) => {
  const { stage, verdict, status } = state;
  const currentIndex = STAGES.findIndex((s) => s.id === stage);
  const isFailed = status === 'ERROR' || verdict === 'NON-BUILDABLE';

  return (
    <div className="glass-panel-heavy p-4 lg:p-6 h-full relative overflow-hidden flex flex-col justify-center shadow-[inset_0_0_40px_rgba(0,0,0,0.8)]">
      <div className="absolute inset-0 bg-noise opacity-40 pointer-events-none mix-blend-overlay"></div>
      <div className="absolute top-0 right-0 p-4 opacity-[0.03]">
         <Terminal size={120} />
      </div>
      
      <h2 className="text-sm font-mono text-white mb-6 z-10 flex items-center gap-2 tracking-widest uppercase opacity-80 shrink-0 border-b border-white/10 pb-4">
        <Terminal className="text-claw-cyan" size={16} />
        Execution_Spine
      </h2>
      
      <div className="relative pl-4 py-2 z-10 flex-1 flex flex-col justify-between max-h-[85%]">
        {/* Animated Connector Beam Background */}
        <div className="absolute left-7 top-4 bottom-4 w-[2px] bg-white/10 overflow-hidden rounded-full shadow-[0_0_10px_rgba(255,255,255,0.05)]">
           {stage !== 'IDLE' && stage !== 'VERDICT' && status !== 'ERROR' && (
             <div className="w-full h-[200%] bg-gradient-to-b from-transparent via-claw-cyan to-transparent animate-beam shadow-[0_0_20px_#00f0ff] mix-blend-screen opacity-80"></div>
           )}
           {stage === 'VERDICT' && !isFailed && (
             <div className="w-full h-full bg-claw-emerald shadow-[0_0_20px_#00ffaa]"></div>
           )}
           {isFailed && (
             <div className="w-full h-full bg-claw-red shadow-[0_0_20px_#ff2a2a]"></div>
           )}
        </div>
        
        <div className="flex flex-col justify-between h-full gap-2">
          {STAGES.map((s, i) => {
            const isActive = stage === s.id || (stage === 'VERDICT' && i === STAGES.length - 1);
            const isPast = currentIndex > i || stage === 'VERDICT';
            const Icon = s.icon;
            
            let colorClass = 'border-white/10 bg-black/80 text-slate-700';
            let iconColor = 'text-slate-600';
            
            if (isActive) {
              if (isFailed) {
                colorClass = 'border-claw-red bg-claw-red/30 shadow-[0_0_40px_rgba(255,42,42,0.8)] scale-[1.3] relative z-20 ring-4 ring-claw-red/50 animate-pulse';
                iconColor = 'text-claw-red drop-shadow-[0_0_15px_rgba(255,42,42,1)]';
              } else {
                colorClass = 'border-claw-cyan bg-claw-cyan/30 shadow-[0_0_40px_rgba(0,240,255,0.6)] scale-[1.3] relative z-20 ring-4 ring-claw-cyan/40 animate-pulse-glow';
                iconColor = 'text-claw-cyan drop-shadow-[0_0_15px_rgba(0,240,255,1)]';
              }
            } else if (isPast) {
              if (isFailed) {
                colorClass = 'border-claw-red/50 bg-claw-red/10 shadow-[0_0_15px_rgba(255,42,42,0.4)] relative z-10';
                iconColor = 'text-claw-red drop-shadow-[0_0_5px_rgba(255,42,42,0.8)]';
              } else {
                colorClass = 'border-claw-emerald/50 bg-claw-emerald/10 shadow-[0_0_20px_rgba(0,255,170,0.4)] relative z-10';
                iconColor = 'text-claw-emerald drop-shadow-[0_0_8px_rgba(0,255,170,0.8)]';
              }
            }

            return (
              <div key={s.id} className="relative flex items-center gap-4 z-10 group shrink-0">
                <motion.div 
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: isActive ? 1.1 : 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 15, delay: i * 0.05 }}
                  className={`w-7 h-7 md:w-8 md:h-8 rounded-full border flex items-center justify-center transition-all duration-300 ${colorClass}`}
                >
                  <Icon size={isActive ? 14 : 12} className={iconColor} />
                </motion.div>
                
                <div className={`flex flex-col transition-all duration-500 ${isActive ? 'translate-x-2' : ''}`}>
                  <span className={`text-[10px] md:text-xs font-mono tracking-widest transition-colors ${isActive ? 'text-white text-glow-cyan font-bold' : isPast ? 'text-slate-300' : 'text-slate-600'}`}>
                    {s.label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
});
