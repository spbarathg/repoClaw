import type { RepoClawState } from '../hooks/useRepoClawSocket';
import { Terminal, Download, FileSearch, Box, ShieldAlert, Wrench, RefreshCcw, Award } from 'lucide-react';
import { motion } from 'framer-motion';
import React, { memo } from 'react';

const STAGES = [
  { id: 'CLONE', label: 'CLONE REPOSITORY', icon: Download },
  { id: 'DETECT', label: 'DETECT BUILD SYSTEM', icon: FileSearch },
  { id: 'BUILD', label: 'EXECUTE BUILD', icon: Box },
  { id: 'CLASSIFY', label: 'CLASSIFY FAILURE', icon: ShieldAlert },
  { id: 'REPAIR', label: 'APPLY REPAIR POLICY', icon: Wrench },
  { id: 'REBUILD', label: 'REBUILD & VALIDATE', icon: RefreshCcw },
  { id: 'VERDICT', label: 'EMIT VERDICT', icon: Award }
];

export const PipelineVisualization: React.FC<{ state: RepoClawState }> = memo(({ state }) => {
  const { stage, verdict, status } = state;
  const currentIndex = STAGES.findIndex((s) => s.id === stage);
  const isFailed = status === 'ERROR' || verdict === 'BUILD_FAILED' || verdict === 'REPAIR_EXHAUSTED' || verdict === 'INFRA_FAILED' || verdict === 'SANDBOX_VIOLATION';

  return (
    <div className="border border-zinc-800 bg-[#000] p-4 lg:p-6 h-full relative overflow-hidden flex flex-col justify-center">
      <div className="absolute inset-0 bg-noise opacity-40 pointer-events-none mix-blend-overlay"></div>
      <div className="absolute top-0 right-0 p-4 opacity-[0.02]">
        <Terminal size={120} />
      </div>

      <h2 className="text-xs font-bold text-white mb-6 z-10 flex items-center gap-2 tracking-widest uppercase opacity-90 shrink-0 border-b border-zinc-800 pb-4 font-mono">
        <Terminal className="text-claw-cyan" size={14} />
        Pipeline_Stages
      </h2>

      <div className="relative pl-2 py-2 z-10 flex-1 flex flex-col justify-between max-h-[85%]">
        {/* Connector beam */}
        <div className="absolute left-[24px] md:left-[26px] top-4 bottom-4 w-[1px] bg-zinc-800 overflow-hidden z-0">
          {stage !== 'IDLE' && stage !== 'VERDICT' && status !== 'ERROR' && (
            <div className="w-full h-[200%] bg-gradient-to-b from-transparent via-claw-cyan to-transparent animate-beam opacity-80"></div>
          )}
          {stage === 'VERDICT' && !isFailed && (
            <div className="w-full h-full bg-claw-emerald opacity-60"></div>
          )}
          {isFailed && (
            <div className="w-full h-full bg-claw-red opacity-60"></div>
          )}
        </div>

        <div className="flex flex-col justify-between h-full gap-3">
          {STAGES.map((s, i) => {
            const isActive = stage === s.id;
            const isPast = currentIndex > i;
            const Icon = s.icon;

            let colorClass = 'border-zinc-800 bg-zinc-950/40 text-slate-500 rounded-none';
            let iconColor = 'text-slate-500';

            if (isActive) {
              if (isFailed) {
                colorClass = 'border-claw-red bg-red-950/20 scale-[1.03] relative z-20 rounded-none';
                iconColor = 'text-claw-red';
              } else {
                colorClass = 'border-claw-cyan bg-cyan-950/20 scale-[1.03] relative z-20 rounded-none';
                iconColor = 'text-claw-cyan';
              }
            } else if (isPast) {
              if (isFailed) {
                colorClass = 'border-claw-red/30 bg-red-950/10 relative z-10 rounded-none';
                iconColor = 'text-claw-red';
              } else {
                colorClass = 'border-claw-emerald/30 bg-emerald-950/10 relative z-10 rounded-none';
                iconColor = 'text-claw-emerald';
              }
            }

            return (
              <div key={s.id} className="relative flex items-center gap-4 z-10 group shrink-0 select-none">
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: isActive ? 1.03 : 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 20, delay: i * 0.03 }}
                  className={`w-8 h-8 md:w-9 md:h-9 border flex items-center justify-center transition-all duration-200 ${colorClass}`}
                >
                  <Icon size={isActive ? 14 : 12} className={iconColor} />
                </motion.div>

                <div className="flex flex-col transition-all duration-200">
                  <span className={`text-[11px] font-mono tracking-wider transition-colors ${isActive ? 'text-white font-bold' : isPast ? 'text-zinc-300 font-medium' : 'text-zinc-600'}`}>
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
