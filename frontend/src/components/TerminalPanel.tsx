import React, { useEffect, useRef, useState, memo } from 'react';
import { Terminal as TerminalIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { logStore } from '../utils/logStore';

export const TerminalPanel: React.FC = memo(() => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [logs, setLogs] = useState<string[]>([]);

  useEffect(() => {
    const unsubscribe = logStore.subscribe((newLogs) => {
      setLogs(newLogs);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      // Use requestAnimationFrame to let DOM settle before scrolling
      requestAnimationFrame(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
      });
    }
  }, [logs]);

  const getColor = (log: string) => {
    if (log.includes('[FATAL]') || log.includes('[ERROR]') || log.includes('❌')) return 'text-claw-red text-glow-red font-bold';
    if (log.includes('[WARN]') || log.includes('⚠️')) return 'text-yellow-400 font-medium';
    if (log.includes('✅') || log.includes('SUCCESS') || log.includes('BUILDABLE')) return 'text-claw-emerald text-glow-emerald font-bold';
    if (log.includes('[Pi Engine]') || log.includes('Skill:')) return 'text-claw-cyan font-medium';
    if (log.includes('[SYSTEM]')) return 'text-white/80 italic';
    return 'text-slate-400';
  };

  return (
    <div className="glass-panel-heavy h-full flex flex-col overflow-hidden border-white/10 relative z-10 shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
      <div className="absolute inset-0 bg-noise opacity-30 pointer-events-none"></div>
      
      <div className="bg-black/80 px-4 py-3 border-b border-white/10 flex items-center gap-3 relative z-10">
        <TerminalIcon size={14} className="text-slate-500" />
        <span className="text-[10px] font-mono text-slate-500 tracking-[0.3em] uppercase">Intelligence_Feed</span>
        <div className="ml-auto flex gap-2 opacity-50 hover:opacity-100 transition-opacity">
          <div className="w-2.5 h-2.5 rounded-full bg-red-500/80 shadow-[0_0_5px_rgba(239,68,68,0.5)]"></div>
          <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/80 shadow-[0_0_5px_rgba(250,204,21,0.5)]"></div>
          <div className="w-2.5 h-2.5 rounded-full bg-green-500/80 shadow-[0_0_5px_rgba(34,197,94,0.5)]"></div>
        </div>
      </div>
      
      <div 
        ref={scrollRef}
        className="flex-1 p-6 overflow-y-auto custom-scrollbar font-mono text-[13px] leading-relaxed bg-[#020203]/90 relative z-10 scroll-smooth"
      >
        <AnimatePresence initial={false}>
          {logs.length === 0 ? (
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              className="text-slate-600 italic animate-pulse flex items-center gap-2"
            >
              <div className="w-2 h-4 bg-claw-cyan animate-ping"></div>
              Awaiting telemetry stream...
            </motion.div>
          ) : (
            logs.map((log, i) => (
              <div 
                key={i} 
                className={`mb-2 ${getColor(log)} break-words flex gap-3 group`}
              >
                <span className="opacity-30 text-slate-500 select-none shrink-0 group-hover:opacity-60 transition-opacity">
                  {`[${i.toString().padStart(4, '0')}]`}
                </span>
                <span className="flex-1 leading-snug tracking-tight">{log}</span>
              </div>
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
});
