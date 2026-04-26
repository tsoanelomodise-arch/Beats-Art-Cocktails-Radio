import React from 'react';
import { Volume2, VolumeX, RadioReceiver, Play, Pause } from 'lucide-react';
import { useRadio } from '../lib/RadioContext';

function formatTime(seconds: number) {
  if (isNaN(seconds) || seconds < 0) return '00:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export default function GlobalPlayer() {
  const {
      isPlaying, activeShowName, togglePlayPause, isStudioMode, activeSession,
      volume, playbackError, nowPlayingTrack, nowPlayingSegment, sessionProgress, sessionDuration,
      handleVolumeChange
  } = useRadio();

  const progressPercent = sessionDuration > 0 ? (sessionProgress / sessionDuration) * 100 : 0;

   return (
    <div className="h-[90px] md:h-[110px] border-t border-border bg-[#1e2022] z-50 flex items-center px-4 md:px-10 shrink-0">
       <div className="w-full max-w-7xl mx-auto flex items-center gap-6 md:gap-12 h-full">
         
         {/* App Controls & Volume */}
         <div className="flex items-center gap-4 md:gap-8 shrink-0">
            <button 
              onClick={togglePlayPause}
              disabled={!activeSession}
              className={`w-14 h-14 md:w-16 md:h-16 rounded-sm flex items-center justify-center transition-all active:scale-95 disabled:opacity-30 disabled:grayscale
                ${isPlaying ? 'bg-accent text-[#f2e7d5] shadow-[0_0_20px_rgba(168,35,41,0.3)]' : 'bg-transparent border border-white/20 text-white hover:border-accent hover:bg-accent/5'}
              `}
            >
              {isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" className="ml-1" />}
            </button>
 
            {/* Desktop Volume Controller (Left-aligned relative to info) */}
            <div className="hidden md:flex items-center gap-3 w-32 group">
              <button 
                onClick={() => handleVolumeChange({ target: { value: volume > 0 ? '0' : '0.5' } } as any)}
                className="text-neutral-500 hover:text-accent transition-colors"
              >
                {volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
              </button>
              <input 
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={volume}
                onChange={handleVolumeChange}
                className="flex-1 accent-accent bg-white/10 h-1 appearance-none cursor-pointer hover:bg-white/20 transition-all"
              />
            </div>
         </div>
 
         {/* Track Info */}
         <div className="flex-1 min-w-0 flex items-center gap-4 h-full md:border-l md:border-white/5 md:pl-10">
            {nowPlayingSegment?.thumbnail && (
              <div className="w-12 h-12 md:w-16 md:h-16 border border-white/10 flex-shrink-0 grayscale">
                <img src={nowPlayingSegment.thumbnail} className="w-full h-full object-cover" alt="Segment Thumbnail" />
              </div>
            )}
            <div className="flex-1 min-w-0 flex flex-col justify-center">
              {nowPlayingTrack ? (
                <>
                  <div className="text-[9px] font-black uppercase tracking-[3px] flex items-center gap-2 mb-1 text-accent">
                    <RadioReceiver size={10} /> {isStudioMode ? 'STUDIO_PREVIEW' : activeShowName}
                  </div>
                  <div className="text-sm font-bold truncate text-[#f2e7d5] uppercase tracking-tight">
                    {nowPlayingTrack.name}
                  </div>
                </>
              ) : activeSession ? (
                <>
                  <div className="text-[9px] font-black uppercase tracking-[3px] flex items-center gap-2 mb-1 text-accent animate-pulse">
                    <RadioReceiver size={10} /> {isStudioMode ? 'PREPARING_SESSION' : activeShowName}
                  </div>
                  <div className="text-xs font-bold truncate text-[#f2e7d5] uppercase tracking-widest opacity-50">
                    {isPlaying ? 'TUNING_SEQUENCE...' : 'READY_TO_STREAM'}
                  </div>
                </>
              ) : activeShowName !== "OFFLINE_STANDBY" && activeShowName !== "No Active Broadcast" ? (
                <>
                  <div className="text-[9px] font-black uppercase tracking-[3px] flex items-center gap-2 mb-1 text-[#666666]">
                    <RadioReceiver size={10} /> {activeShowName}
                  </div>
                  <div className="text-xs font-bold truncate text-[#333333] uppercase tracking-widest">
                    NO_SIGNAL_DETECTED
                  </div>
                </>
              ) : (
                <div className="text-[#333333] font-bold uppercase tracking-widest text-[9px] tracking-[4px]">STANDBY_MODE</div>
              )}
              {playbackError && (
                <div className="text-red-500 text-[10px] font-bold mt-1 truncate uppercase">
                  ERROR: {playbackError}
                </div>
              )}
              
              {/* Mobile Progress Bar - Only in Studio Mode */}
              {isStudioMode && nowPlayingTrack && (
                <div className="mt-2 md:hidden flex flex-col gap-1">
                  <div className="h-0.5 bg-white/10 overflow-hidden">
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
              )}
            </div>
         </div>
 
         {/* Desktop Studio Progress */}
         {isStudioMode && nowPlayingTrack && (
           <div className="hidden md:flex items-center gap-4 w-64 shrink-0">
             <span className="text-[10px] font-mono text-[#666666] w-10 text-right">{formatTime(sessionProgress)}</span>
             <div className="flex-1 h-0.5 bg-white/10 overflow-hidden relative">
                <div 
                  className="absolute top-0 left-0 h-full bg-accent transition-all duration-100 ease-linear"
                  style={{ width: `${Math.min(100, Math.max(0, progressPercent || 0))}%` }}
                />
             </div>
             <span className="text-[10px] font-mono text-[#666666] w-10 text-left">{formatTime(sessionDuration)}</span>
           </div>
         )}
 
       </div>
    </div>
  );
}
