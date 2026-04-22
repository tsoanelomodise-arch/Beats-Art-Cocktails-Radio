import React from 'react';
import { Play, Pause, Volume2, VolumeX, RadioReceiver, SkipForward, Clock } from 'lucide-react';
import { useRadio, getMinutesFromMidnight } from '../lib/RadioContext';

export default function LiveView({ tz = 'UTC' }: { tz?: string }) {
  const {
      currentTime, activeSession, activeShowName, nextShowName, todaysSchedule,
      isPlaying, volume, playbackError, nowPlayingTrack, trackProgress, currentDuration,
      togglePlayPause, skipForward, handleVolumeChange,
      queueLength, currentIndex
  } = useRadio();

  const progressPercent = (trackProgress / currentDuration) * 100;

  return (
    <div className="h-full bg-bg relative overflow-y-auto overflow-x-hidden">
      {/* Background Ambience */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-red-500/5 rounded-full blur-[150px] pointer-events-none min-h-[600px]" />
      
      {isPlaying && (
        <div className="fixed inset-0 bg-red-500/5 animate-pulse pointer-events-none mix-blend-screen min-h-[600px]" />
      )}

      <div className="z-10 w-full max-w-4xl min-h-full mx-auto p-6 md:p-10 flex flex-col items-center justify-center py-12 md:py-24">
        
        {/* On Air Status */}
        <div className="flex items-center gap-4 mb-8 md:mb-16 shrink-0 mt-8 md:mt-0">
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${activeShowName !== "No Active Broadcast" ? 'bg-red-500 shadow-[0_0_15px_rgba(239,68,68,0.6)] animate-pulse' : 'bg-neutral-600'}`} />
            <span className={`text-sm font-black uppercase tracking-[4px] ${activeShowName !== "No Active Broadcast" ? 'text-red-500' : 'text-neutral-500'}`}>
              LIVE BROADCAST
            </span>
          </div>
          <div className="h-4 w-px bg-white/10" />
          <div className="flex items-center gap-4 text-xl font-mono text-neutral-300">
            {currentTime.toLocaleTimeString([], { hour12: false })} 
            <span className="text-sm text-neutral-500 font-sans tracking-widest">{tz.split('/').pop()?.replace('_', ' ').toUpperCase()}</span>
          </div>
        </div>

        {/* Show Details */}
        <div className="text-center mb-8 md:mb-16 shrink-0">
          <h1 className="text-4xl md:text-5xl lg:text-7xl font-[900] tracking-[-2px] uppercase bg-gradient-to-br from-white to-neutral-400 bg-clip-text text-transparent mb-6 drop-shadow-2xl px-4">
            {activeShowName}
          </h1>
          {nextShowName && (
            <div className="flex items-center justify-center gap-2 text-sm text-neutral-400 font-bold uppercase tracking-widest bg-surface/30 inline-flex px-4 py-2 rounded-full border border-white/5 mx-4">
              <Clock size={14} className="shrink-0" /> <span className="truncate max-w-[200px] md:max-w-none">UP NEXT: {nextShowName}</span>
            </div>
          )}
        </div>

        {/* Today's Schedule List */}
        {todaysSchedule.length > 0 && (
          <div className="w-full mt-8 md:mt-12 shrink-0 max-w-2xl mx-auto flex flex-col gap-3 pb-12">
            <h3 className="text-sm font-black uppercase tracking-widest text-[#8e95ab] mb-2 px-4">Today's Schedule</h3>
            {todaysSchedule.map((entry, idx) => {
               const isPast = getMinutesFromMidnight(currentTime) >= (entry.startTime + entry.duration);
               const isActive = entry.show === activeShowName;

               return (
                 <div 
                   key={`${entry.id}-${idx}`} 
                   className={`p-4 md:p-5 rounded-2xl border transition-all flex items-center justify-between gap-4
                     ${isActive ? 'bg-red-500/10 border-red-500/30 shadow-[0_0_20px_rgba(239,68,68,0.1)]' : 
                       isPast ? 'bg-white/[0.02] border-white/5 opacity-50' : 
                       'bg-surface/50 border-white/10 hover:bg-surface'}`
                   }
                 >
                   <div className="flex items-center gap-4 md:gap-6 min-w-0">
                     <span className={`text-xs md:text-sm font-mono tracking-tighter shrink-0 ${isActive ? 'text-red-400' : isPast ? 'text-neutral-500' : 'text-accent'}`}>
                       {entry.time}
                     </span>
                     <div className="flex flex-col min-w-0">
                       <span className={`text-sm md:text-base font-black uppercase truncate ${isActive ? 'text-red-100' : isPast ? 'text-neutral-400' : 'text-white'}`}>
                         {entry.show}
                       </span>
                       <span className={`text-[10px] md:text-xs truncate ${isActive ? 'text-red-300' : 'text-[#8e95ab]'}`}>
                         {entry.focus}
                       </span>
                     </div>
                   </div>
                   {isActive && (
                     <div className="flex items-center gap-2 shrink-0 bg-red-500/20 px-3 py-1 rounded-full border border-red-500/30">
                       <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                       <span className="text-[9px] font-black uppercase tracking-widest text-red-500">LIVE</span>
                     </div>
                   )}
                 </div>
               );
            })}
          </div>
        )}

      </div>
    </div>
  );
}
