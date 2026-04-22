import React from 'react';
import { Volume2, VolumeX, RadioReceiver } from 'lucide-react';
import { useRadio } from '../lib/RadioContext';

function formatTime(seconds: number) {
  if (isNaN(seconds) || seconds < 0) return '00:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export default function GlobalPlayer() {
  const {
      volume, playbackError, nowPlayingTrack, sessionProgress, sessionDuration,
      handleVolumeChange
  } = useRadio();

  const progressPercent = sessionDuration > 0 ? (sessionProgress / sessionDuration) * 100 : 0;

  return (
    <div className="h-[72px] md:h-[90px] border-t border-border bg-surface/90 backdrop-blur-2xl z-50 flex items-center px-4 md:px-10 shrink-0 shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
       <div className="w-full max-w-7xl mx-auto flex items-center justify-between gap-4 md:gap-8 h-full">
         
         {/* Track Info */}
         <div className="flex-1 min-w-0 pr-4 flex flex-col justify-center">
           {nowPlayingTrack ? (
             <>
               <div className="text-[9px] font-bold uppercase tracking-[3px] text-accent flex items-center gap-2 mb-1">
                 <RadioReceiver size={10} /> Now Playing
               </div>
               <div className="text-sm font-bold truncate text-white">
                 {nowPlayingTrack.name}
               </div>
             </>
           ) : (
             <div className="text-neutral-500 italic text-sm">Standby...</div>
           )}
           {playbackError && (
             <div className="text-red-400 text-[10px] font-bold mt-1 truncate">
               {playbackError}
             </div>
           )}
           
           {/* Mobile Progress Bar (shows up under text) */}
           <div className="mt-2 md:hidden flex flex-col gap-1">
             <div className="h-1 bg-white/10 rounded-full overflow-hidden">
               <div 
                 className="h-full bg-accent transition-all duration-100 ease-linear"
                 style={{ width: `${Math.min(100, Math.max(0, progressPercent || 0))}%` }}
               />
             </div>
             <div className="flex items-center justify-between">
               <span className="text-[8px] font-mono text-neutral-500">{formatTime(sessionProgress)}</span>
               <span className="text-[8px] font-mono text-neutral-500">{formatTime(sessionDuration)}</span>
             </div>
           </div>
         </div>

         {/* Desktop Volume and Progress */}
         <div className="hidden md:flex flex-1 items-center gap-6 justify-end">
            <div className="flex-1 max-w-[400px] flex items-center gap-4">
              <span className="text-[10px] font-mono text-neutral-500 w-10 text-right">{formatTime(sessionProgress)}</span>
              <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden relative">
                 <div 
                   className="absolute top-0 left-0 h-full bg-accent transition-all duration-100 ease-linear"
                   style={{ width: `${Math.min(100, Math.max(0, progressPercent || 0))}%` }}
                 />
              </div>
              <span className="text-[10px] font-mono text-neutral-500 w-10 text-left">{formatTime(sessionDuration)}</span>
            </div>
            
            <div className="flex items-center gap-3 w-32 border-l border-white/10 pl-6">
              <VolumeX size={14} className="text-neutral-500 shrink-0" />
              <input 
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={volume}
                onChange={handleVolumeChange}
                className="flex-1 accent-accent bg-white/10 h-1 rounded-full appearance-none cursor-pointer"
              />
              <Volume2 size={14} className="text-neutral-500 shrink-0" />
            </div>
         </div>

       </div>
    </div>
  );
}
