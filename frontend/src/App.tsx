import { useState, useEffect } from 'react';
import { useRepoClawSocket } from './hooks/useRepoClawSocket';
import { HeroInput } from './components/HeroInput';
import { PipelineVisualization } from './components/PipelineVisualization';
import { TerminalPanel } from './components/TerminalPanel';
import { RightAnalytics } from './components/RightAnalytics';
import { ShieldCheck } from 'lucide-react';
import { VerdictReportPanel } from './components/VerdictReportPanel';

export default function App() {
   const { state, analyze, abort, selectCycle } = useRepoClawSocket();
   const [activeTab, setActiveTab] = useState<'terminal' | 'report'>('terminal');

   // Auto-routing: switch to report tab when verdict is emitted
   useEffect(() => {
      if (state.stage === 'VERDICT' && state.verdict && state.report) {
         setActiveTab('report');
      }
   }, [state.stage, state.verdict, state.report]);

   // Create lists of cycles to travel back to
   const cyclesCount = Object.keys(state.cycleLogs || {}).length;

   return (
      <div className="h-screen w-screen bg-[#000] relative p-4 lg:p-6 overflow-hidden text-slate-300 font-sans selection:bg-claw-cyan/30 flex flex-col">

         {/* Deep Ambient Background */}
         <div className="fixed inset-0 bg-noise opacity-[0.03] pointer-events-none z-0"></div>
         <div className="fixed inset-0 cyber-grid-bg pointer-events-none z-0"></div>

         <div className="w-full h-full max-w-[1800px] mx-auto relative z-10 flex flex-col">

            {/* Ultra-Compact Header */}
            <header className="mb-5 flex items-center justify-between shrink-0 border-b border-zinc-900 pb-4">
               <div className="flex items-center gap-6">
                  <h1 className="text-2xl font-black text-white tracking-tighter flex items-center gap-2 font-mono">
                     REPO<span className="text-claw-cyan">CLAW</span>
                  </h1>
                  <div className="h-4 w-[1px] bg-zinc-800"></div>
                  <p className="text-zinc-500 font-mono text-[10px] tracking-widest uppercase flex items-center gap-2">
                     <ShieldCheck size={12} className="text-claw-emerald" />
                     DETERMINISTIC CI FAILOVER GATEWAY
                  </p>
               </div>

               <div className="flex-grow"></div>
               <div className={`flex items-center gap-2 px-3 py-1 border font-mono text-[9px] font-bold tracking-widest uppercase transition-colors rounded-none ${state.status === 'OFFLINE' ? 'bg-red-950/20 border-red-900 text-red-500' : 'bg-emerald-950/20 border-zinc-800 text-claw-emerald'}`}>
                  <div className={`w-1.5 h-1.5 rounded-full ${state.status === 'OFFLINE' ? 'bg-red-500 animate-pulse' : 'bg-claw-emerald shadow-[0_0_8px_#00ffaa] animate-pulse'}`}></div>
                  {state.status === 'OFFLINE' ? 'OFFLINE' : 'ONLINE'}
               </div>
            </header>

            {/* Dense Widescreen Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6 flex-1 min-h-0">

               {/* LEFT: Spine */}
               <div className="lg:col-span-3 h-full min-h-0">
                  <PipelineVisualization state={state} />
               </div>

               {/* CENTER: Main Operations */}
               <div className="lg:col-span-6 h-full flex flex-col gap-4 min-h-0">
                  <div className="shrink-0 bg-[#000] border border-zinc-800 p-4">
                     <HeroInput onAnalyze={analyze} abort={abort} state={state} />
                  </div>

                  {/* Tabbed Container */}
                  <div className="flex-1 min-h-0 flex flex-col border border-zinc-800 bg-[#000]">
                     {/* Tab Headers */}
                     <div className="flex items-center border-b border-zinc-800 bg-[#08080a] shrink-0">
                        <button
                           onClick={() => setActiveTab('terminal')}
                           className={`px-5 py-3 text-[10px] font-mono font-bold tracking-widest uppercase transition-all relative border-r border-zinc-800 ${activeTab === 'terminal' ? 'text-white bg-[#000] border-b-2 border-b-claw-cyan' : 'text-zinc-500 hover:text-zinc-300'}`}
                        >
                           Execution_Log
                        </button>
                        <button
                           onClick={() => setActiveTab('report')}
                           className={`px-5 py-3 text-[10px] font-mono font-bold tracking-widest uppercase transition-all relative border-r border-zinc-800 flex items-center gap-2.5 ${activeTab === 'report' ? 'text-white bg-[#000] border-b-2 border-b-claw-cyan' : 'text-zinc-500 hover:text-zinc-300'}`}
                        >
                           Analysis_Report
                           {state.verdict && (
                              <span className="w-1.5 h-1.5 rounded-full bg-claw-emerald animate-pulse"></span>
                           )}
                        </button>

                        <div className="flex-grow"></div>

                        {/* TIME TRAVEL PLAYER */}
                        {cyclesCount > 0 && (
                           <div className="flex items-center gap-1.5 px-3 py-1 font-mono text-[9px] select-none border-l border-zinc-800">
                              <span className="text-zinc-500 font-bold uppercase tracking-wider text-[8px]">CYCLES:</span>
                              <div className="flex items-center gap-1">
                                 {Array.from({ length: cyclesCount }).map((_, idx) => {
                                    const cycleNum = idx + 1;
                                    const isCurrent = state.selectedCycle === cycleNum;
                                    const trace = state.repairTrace.find(t => t.cycle === cycleNum);
                                    
                                    let btnColor = "bg-zinc-900 border border-zinc-800 text-zinc-500 hover:text-zinc-300";
                                    if (trace) {
                                       if (trace.rolledBack) btnColor = "bg-red-950/40 text-red-400 border border-red-900/50 hover:bg-red-950/60";
                                       else if (trace.repairStrategy) btnColor = "bg-yellow-950/40 text-yellow-400 border border-yellow-900/50 hover:bg-yellow-950/60";
                                    }
                                    if (isCurrent) {
                                       btnColor = "bg-claw-cyan text-black border border-white font-bold";
                                    }

                                    return (
                                       <button
                                          key={cycleNum}
                                          onClick={() => {
                                             selectCycle(cycleNum);
                                             setActiveTab('terminal');
                                          }}
                                          className={`px-2 py-0.5 text-[9px] transition-all font-bold ${btnColor}`}
                                       >
                                          0{cycleNum}
                                       </button>
                                    );
                                 })}
                              </div>
                           </div>
                        )}
                     </div>

                     {/* Tab Panels */}
                     <div className="flex-1 min-h-0 bg-[#000] overflow-hidden relative">
                        <div className={`h-full ${activeTab === 'terminal' ? 'block' : 'hidden'}`}>
                           <TerminalPanel state={state} />
                        </div>
                        <div className={`h-full ${activeTab === 'report' ? 'block' : 'hidden'}`}>
                           <VerdictReportPanel state={state} />
                        </div>
                     </div>
                  </div>
               </div>

               {/* RIGHT: Compact Analytics & Verdict */}
               <div className="lg:col-span-3 h-full min-h-0">
                  <RightAnalytics state={state} setActiveTab={setActiveTab} />
               </div>

            </div>
         </div>
      </div>
   );
}
