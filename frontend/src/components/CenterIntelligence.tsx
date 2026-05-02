import type { RepoClawState } from '../hooks/useRepoClawSocket';
import { BrainCircuit, Cpu } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import React, { useEffect, useRef, memo } from 'react';

export const CenterIntelligence: React.FC<{ state: RepoClawState }> = memo(({ state }) => {
  const { intelligence } = state;
  const stream = intelligence.reasoningStream;
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [stream]);

  return (
    <div className="glass-panel p-4 h-full flex flex-col relative overflow-hidden shadow-[inset_0_0_20px_rgba(0,0,0,0.8)]">
      <div className="absolute inset-0 bg-noise opacity-30 pointer-events-none"></div>
      <div className="flex items-center gap-2 text-slate-500 text-[10px] font-mono mb-2 tracking-widest uppercase relative z-10 shrink-0">
        <BrainCircuit size={14} className="text-claw-purple" />
        Live_Reasoning_Stream
      </div>
      <div 
        ref={scrollRef}
        className="flex-1 bg-[#030304]/80 rounded-xl border border-white/5 p-4 flex flex-col gap-3 relative z-10 overflow-y-auto custom-scrollbar scroll-smooth"
      >
        <AnimatePresence initial={false}>
          {stream.length > 0 ? (
            stream.map((reason, i) => {
              const isLast = i === stream.length - 1;
              return (
                <motion.div 
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-start gap-3 group"
                >
                  <Cpu size={14} className={`shrink-0 mt-0.5 ${isLast && state.status === 'RUNNING' ? 'text-claw-cyan animate-pulse' : 'text-slate-600'}`} />
                  <div className={`text-xs md:text-sm font-mono leading-relaxed tracking-tight ${isLast && state.status === 'RUNNING' ? 'text-white text-glow-cyan' : 'text-slate-400'}`}>
                    {reason}
                  </div>
                </motion.div>
              );
            })
          ) : (
            <motion.div 
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-xs font-mono text-slate-600 text-center italic h-full flex items-center justify-center"
            >
              Awaiting cognitive initialization...
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
});
