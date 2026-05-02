import { useRepoClawSocket } from './hooks/useRepoClawSocket';
import { HeroInput } from './components/HeroInput';
import { PipelineVisualization } from './components/PipelineVisualization';
import { TerminalPanel } from './components/TerminalPanel';
import { CenterIntelligence } from './components/CenterIntelligence';
import { RightAnalytics } from './components/RightAnalytics';
import { ShieldCheck } from 'lucide-react';
import { VerdictModal } from './components/VerdictModal';

export default function App() {
  const { state, analyze } = useRepoClawSocket();

  return (
    <div className="h-screen w-screen bg-claw-dark relative p-4 lg:p-6 overflow-hidden text-slate-300 font-sans selection:bg-claw-cyan/30 flex flex-col">
      
      {/* Deep Ambient Background */}
      <div className="fixed inset-0 bg-noise opacity-[0.03] pointer-events-none z-0"></div>
      <div className="fixed top-[-20%] left-[-10%] w-[50%] h-[50%] bg-claw-cyan/10 blur-[150px] rounded-full pointer-events-none z-0 mix-blend-screen"></div>
      <div className="fixed bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-claw-purple/10 blur-[150px] rounded-full pointer-events-none z-0 mix-blend-screen"></div>
      
      <div className="w-full h-full max-w-[1800px] mx-auto relative z-10 flex flex-col">
        
        {/* Ultra-Compact Header */}
        <header className="mb-4 flex items-center justify-between shrink-0">
           <div className="flex items-center gap-6">
             <h1 className="text-3xl font-black text-white tracking-tighter flex items-center gap-2">
               Repo<span className="text-claw-cyan drop-shadow-[0_0_10px_rgba(0,240,255,0.5)]">Claw</span>
             </h1>
             <div className="h-4 w-[1px] bg-white/20"></div>
             <p className="text-slate-400 font-mono text-[10px] tracking-widest uppercase flex items-center gap-2">
               <ShieldCheck size={14} className="text-claw-emerald" />
               Autonomous Command Center
             </p>
           </div>

           <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border font-mono text-[9px] font-bold tracking-widest uppercase transition-colors shadow-lg backdrop-blur-md ${state.status === 'OFFLINE' ? 'bg-red-500/10 border-red-500/30 text-red-500' : 'bg-claw-emerald/10 border-claw-emerald/30 text-claw-emerald'}`}>
              <div className={`w-1.5 h-1.5 rounded-full ${state.status === 'OFFLINE' ? 'bg-red-500' : 'bg-claw-emerald shadow-[0_0_8px_#00ffaa] animate-pulse'}`}></div>
              {state.status === 'OFFLINE' ? 'SYSTEM_OFFLINE' : 'UPLINK_SECURE'}
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
              <div className="shrink-0">
                 <HeroInput onAnalyze={analyze} state={state} />
              </div>
              
              <div className="flex-1 min-h-0">
                 <TerminalPanel />
              </div>

              <div className="shrink-0 h-[180px]">
                 <CenterIntelligence state={state} />
              </div>
           </div>

           {/* RIGHT: Compact Analytics & Verdict */}
           <div className="lg:col-span-3 h-full min-h-0">
              <RightAnalytics state={state} />
           </div>

        </div>
      </div>
      
      {/* Absolute Modal for Markdown Report (only when requested) */}
      <VerdictModal state={state} />
    </div>
  );
}
