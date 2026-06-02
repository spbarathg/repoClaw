import React, { useEffect, useRef, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { RepoClawState } from '../hooks/useRepoClawSocket';

interface TerminalPanelProps {
  state: RepoClawState;
}

export const TerminalPanel: React.FC<TerminalPanelProps> = memo(({ state }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  
  // Use cycle-specific logs if available, otherwise fallback to empty array
  const logs = state.cycleLogs[state.selectedCycle] || [];

  useEffect(() => {
    if (scrollRef.current) {
      requestAnimationFrame(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
      });
    }
  }, [logs]);

  const getColor = (log: string) => {
    if (log.includes('[stderr]') || log.includes('[FATAL]') || log.includes('[ERROR]') || log.includes('❌') || log.includes('npm ERR!')) {
      return 'text-claw-red font-semibold';
    }
    if (log.includes('[WARN]') || log.includes('⚠️')) {
      return 'text-yellow-500';
    }
    if (log.includes('✅') || log.includes('SUCCESS') || log.includes('BUILD_SUCCEEDED') || log.includes('successful')) {
      return 'text-claw-emerald font-semibold';
    }
    if (log.includes('[Pi Engine]') || log.includes('Skill:') || log.includes('[Build]') || log.includes('[Classify]') || log.includes('[Repair]')) {
      return 'text-claw-cyan';
    }
    if (log.includes('[SYSTEM]')) {
      return 'text-zinc-500 italic';
    }
    return 'text-zinc-300';
  };

  return (
    <div className="h-full flex flex-col overflow-hidden bg-[#000] border-t border-zinc-800">
      {/* Console Subheader */}
      <div className="flex items-center justify-between bg-[#08080a] border-b border-zinc-800 px-4 py-2 shrink-0 select-none">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-claw-cyan"></div>
          <span className="text-[10px] text-zinc-400 font-mono uppercase tracking-wider font-bold">CONSOLE OUTPUT — CYCLE_0{state.selectedCycle}</span>
        </div>
        <span className="text-[9px] text-zinc-500 font-mono">LINES: {logs.length}</span>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 p-4 overflow-y-auto custom-scrollbar font-mono text-xs leading-relaxed bg-[#000] scroll-smooth"
      >
        <AnimatePresence initial={false}>
          {logs.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-zinc-600 italic flex items-center gap-2 font-mono"
            >
              <div className="w-2.5 h-4 bg-claw-cyan animate-pulse"></div>
              Awaiting cycle run...
            </motion.div>
          ) : (
            logs.map((log, i) => (
              <div
                key={i}
                className={`mb-1.5 ${getColor(log)} break-words flex gap-3 group font-mono text-[11px]`}
              >
                <span className="opacity-40 text-zinc-600 select-none shrink-0 group-hover:opacity-75 transition-opacity font-mono w-10 text-right">
                  {(i + 1).toString().padStart(4, '0')}
                </span>
                <span className="flex-1 leading-relaxed tracking-normal font-mono">{log}</span>
              </div>
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
});
