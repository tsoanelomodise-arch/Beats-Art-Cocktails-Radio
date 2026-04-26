import React from 'react';
import { Play, Pause, Volume2, VolumeX, RadioReceiver, SkipForward, Clock } from 'lucide-react';
import Logo from './Logo';
import { useRadio, getSecondsFromMidnight } from '../lib/RadioContext';

export default function LiveView({ tz = 'UTC' }: { tz?: string }) {
  const {
      currentTime, activeSession, activeShowName, nextShowName, todaysSchedule,
      isPlaying, volume, playbackError, nowPlayingTrack, nowPlayingSegment, trackProgress, currentDuration,
      togglePlayPause, skipForward, handleVolumeChange,
      queueLength, currentIndex, isStudioMode
  } = useRadio();

  const progressPercent = (trackProgress / currentDuration) * 100;
  const isActualLive = activeShowName !== "No Active Broadcast" && !isStudioMode;

  const currentSecs = getSecondsFromMidnight(currentTime);
  const nextEvent = todaysSchedule.find(entry => (entry.startTimeSecs || (entry.startTime * 60)) > currentSecs);

  const countdown = React.useMemo(() => {
    if (!nextEvent) return null;
    const targetSecs = nextEvent.startTimeSecs || (nextEvent.startTime * 60);
    const diffSecs = targetSecs - currentSecs;
    
    if (diffSecs <= 0) return "00:00:00";

    const h = Math.floor(diffSecs / 3600);
    const m = Math.floor((diffSecs % 3600) / 60);
    const s = Math.floor(diffSecs % 60);
    
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }, [nextEvent, currentSecs]);

  return (
    <div className="h-full bg-[#1e2022] relative overflow-y-auto overflow-x-hidden">
      {/* Background Ambience */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-accent/5 rounded-full blur-[150px] pointer-events-none min-h-[600px]" />
      
      {isPlaying && !isStudioMode && (
        <div className="fixed inset-0 bg-accent/5 animate-pulse pointer-events-none mix-blend-screen min-h-[600px]" />
      )}

      <div className="z-10 w-full max-w-4xl min-h-full mx-auto p-6 md:p-10 flex flex-col items-center justify-center py-12 md:py-24 font-mono">
        
        {/* On Air Status */}
        <div className="flex items-center gap-4 mb-8 md:mb-16 shrink-0 mt-8 md:mt-0">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-sm ${isActualLive ? 'bg-accent shadow-[0_0_15px_rgba(168,35,41,0.6)] animate-pulse' : 'bg-neutral-800'}`} />
            <span className={`text-[10px] font-black uppercase tracking-[4px] ${isActualLive ? 'text-accent' : 'text-neutral-500'}`}>
              {isActualLive ? 'BROADCAST_ACTIVE' : 'SYSTEM_STANDBY'}
            </span>
          </div>
          <div className="h-3 w-px bg-white/10" />
          <div className="flex items-center gap-4 text-sm font-bold text-white tracking-[0.2em] uppercase">
            {!isActualLive && countdown ? (
              <div className="flex flex-col items-start leading-none gap-2">
                <span className="text-[9px] font-black tracking-[0.3em] text-[#666666]">NEXT_TRANSMISSION:</span>
                <span className="text-xl text-white font-bold tracking-tight">{countdown}</span>
              </div>
            ) : (
              <>
                {currentTime.toLocaleTimeString([], { hour12: false })} 
                <span className="text-[9px] text-[#666666] tracking-[0.4em] translate-y-[1px]">{tz.split('/').pop()?.replace('_', ' ').toUpperCase()}</span>
              </>
            )}
          </div>
        </div>

        {/* Show Details */}
        <div className="text-center mb-8 md:mb-20 shrink-0">
          <div className="flex justify-center mb-8">
            <Logo className="w-32 h-32 md:w-48 md:h-48 opacity-20" />
          </div>
          {isActualLive && (
            <div className="flex flex-col items-center">
              {activeShowName.includes(' — ') && (
                <div className="text-[12px] font-black uppercase tracking-[0.4em] text-accent mb-4">
                   {activeShowName.split(' — ')[0]}
                </div>
              )}
              <h1 className="text-4xl md:text-6xl font-black tracking-[-1px] uppercase text-white mb-6 px-4 leading-none">
                {activeShowName.includes(' — ') ? activeShowName.split(' — ')[1] : activeShowName}
              </h1>
            </div>
          )}
          {nextShowName && (
            <div className="flex items-center justify-center gap-2 text-[10px] text-[#888a8c] font-bold uppercase tracking-[0.3em] bg-[#5c191c]/20 inline-flex px-6 py-2 border border-accent/20 mx-4">
              <Clock size={12} className="shrink-0" /> <span className="truncate max-w-[200px] md:max-w-none text-[#f2e7d5]">UP NEXT: {nextShowName}</span>
            </div>
          )}
        </div>

        {/* Big On-Air Play Button */}
        <div className="mb-12 md:mb-24 shrink-0 relative group flex flex-col items-center">
           {nowPlayingSegment?.thumbnail && (
             <div className="mb-12 w-48 h-48 md:w-80 md:h-80 grayscale border border-white/10 group-hover:border-white transition-all duration-700">
               <img src={nowPlayingSegment.thumbnail} className="w-full h-full object-cover opacity-60 group-hover:opacity-100" alt="Current Segment" />
             </div>
           )}
           <div className="relative">
             <div className={`absolute inset-0 blur-3xl transition-all duration-1000 ${isPlaying ? 'bg-accent/20' : 'bg-white/5'} scale-110`} />
             <button 
               onClick={togglePlayPause}
               disabled={!activeSession}
               className={`relative w-32 h-32 md:w-48 md:h-48 border flex items-center justify-center transition-all active:scale-95 disabled:opacity-20
                  ${isPlaying ? 'bg-accent border-accent text-[#f2e7d5] shadow-[0_0_50px_rgba(168,35,41,0.3)]' : 'bg-transparent border-white/10 text-white hover:border-accent hover:bg-accent/5'}
               `}
             >
                {isPlaying ? (
                  <Pause size={64} fill="currentColor" />
                ) : (
                  <Play size={64} fill="currentColor" className="ml-2" />
                )}
             </button>
           </div>
           {activeSession && !isPlaying && !isStudioMode && (
             <div className="absolute top-full left-1/2 -translate-x-1/2 mt-8 text-[9px] font-black uppercase tracking-[0.4em] text-white/40">
               STATION_LINK_READY
             </div>
           )}
        </div>

        {/* Today's Schedule List */}
        {todaysSchedule.length > 0 && (
          <div className="w-full mt-8 md:mt-12 shrink-0 max-w-xl mx-auto flex flex-col gap-px bg-white/5 border border-white/5 mb-12">
            <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-[#666666] mb-6 px-4">Daily_Protocol</h3>
            {todaysSchedule.map((entry, idx) => {
               const startSecs = entry.startTimeSecs || (entry.startTime * 60);
               const durSecs = entry.durationSecs || (entry.duration * 60);
               const isPast = currentSecs >= (startSecs + durSecs);
               const isActive = entry.show === activeShowName;

               return (
                 <div 
                   key={`${entry.id}-${idx}`} 
                   className={`p-6 bg-black transition-all flex items-center justify-between gap-6
                     ${isActive ? 'bg-accent' : isPast ? 'opacity-30' : 'hover:bg-white/5'}`
                   }
                 >
                   <div className="flex items-center gap-6 min-w-0">
                     <span className={`text-xs font-bold tracking-tight shrink-0 ${isActive ? 'text-white' : 'text-[#666666]'}`}>
                       [{entry.time}]
                     </span>
                     <div className="flex flex-col min-w-0">
                       <span className={`text-sm font-bold uppercase truncate tracking-tight text-white`}>
                         {entry.show}
                       </span>
                       <span className={`text-[9px] font-bold uppercase tracking-widest truncate ${isActive ? 'text-white/60' : 'text-[#666666]'}`}>
                         {entry.focus}
                       </span>
                     </div>
                   </div>
                   {isActive && (
                     <div className="flex items-center gap-2 shrink-0 bg-black px-3 py-1">
                       <div className="w-1.5 h-1.5 bg-accent animate-pulse" />
                       <span className="text-[9px] font-black uppercase tracking-[0.2em] text-accent">ON_AIR</span>
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
