import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { getAudioFile } from './storage';
import { RadioShow, ScheduleEntry, MonthlySchedule, ShowSegment, AudioTrack } from '../types';
import { getCurrentTimeInTimezone, getStationTimezone } from './timezone';

export function getMinutesFromMidnight(d: Date) {
  return d.getHours() * 60 + d.getMinutes();
}

export function computeDailySchedule(entries: ScheduleEntry[], date: Date): ScheduleEntry[] {
  const dayOfWeek = date.getDay();
  const localDateString = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

  const filtered = entries.filter(e => {
    if (e.specificDate) return e.specificDate.startsWith(localDateString);
    if (e.daysOfWeek) return e.daysOfWeek.includes(dayOfWeek);
    return false;
  });

  const computed: ScheduleEntry[] = [];
  let currentEnd = 0;
  
  // Sort entries: fixed times first (sorted by time), then auto-follow entries
  const sorted = [...filtered].sort((a, b) => {
    const aFixed = a.startTime != null && !isNaN(a.startTime);
    const bFixed = b.startTime != null && !isNaN(b.startTime);
    if (aFixed && bFixed) return (a.startTime as number) - (b.startTime as number);
    if (aFixed) return -1;
    if (bFixed) return 1;
    return 0;
  });

  for (const e of sorted) {
     if (e.startTime !== undefined && e.startTime !== null && !isNaN(e.startTime)) {
        computed.push(e as ScheduleEntry);
        currentEnd = (e.startTime as number) + (e.duration || 0);
     } else {
        let start = currentEnd;
        if (e.followsShowTitle) {
           const predecessor = computed.find(c => c.show === e.followsShowTitle);
           if (predecessor && predecessor.startTime != null) {
              start = (predecessor.startTime as number) + predecessor.duration;
           }
        }
        computed.push({ ...e, startTime: start } as ScheduleEntry);
        // We update currentEnd for the NEXT item in the list, 
        // but only if we are just flowing normally.
        currentEnd = start + (e.duration || 0);
     }
  }

  return computed.sort((a, b) => (a.startTime as number) - (b.startTime as number));
}

interface RadioContextProps {
  currentTime: Date;
  activeSession: {title: string; segments: ShowSegment[]} | null;
  activeShowName: string;
  nextShowName: string | null;
  todaysSchedule: ScheduleEntry[];
  isPlaying: boolean;
  volume: number;
  playbackError: string | null;
  nowPlayingTrack: AudioTrack | null;
  trackProgress: number;
  currentDuration: number;
  sessionProgress: number;
  sessionDuration: number;
  togglePlayPause: () => void;
  skipForward: () => void;
  handleVolumeChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  queueLength: number;
  currentIndex: number;
}

const RadioContext = createContext<RadioContextProps | null>(null);

export function RadioProvider({ children, tz = 'UTC' }: { children: React.ReactNode; tz?: string }) {
  const [currentTime, setCurrentTime] = useState(getCurrentTimeInTimezone(tz));
  const [activeSession, setActiveSession] = useState<{title: string; segments: ShowSegment[]} | null>(null);
  const [activeShowName, setActiveShowName] = useState<string>("No Active Broadcast");
  const [activeEventStartTime, setActiveEventStartTime] = useState<number | null>(null);
  const [nextShowName, setNextShowName] = useState<string | null>(null);
  const [todaysSchedule, setTodaysSchedule] = useState<ScheduleEntry[]>([]);

  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(1);
  const volumeRef = useRef(1);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [nowPlayingTrack, setNowPlayingTrack] = useState<AudioTrack | null>(null);
  
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const [trackProgress, setTrackProgress] = useState(0);
  const [sessionProgress, setSessionProgress] = useState(0);
  const [sessionDuration, setSessionDuration] = useState(0);

  const queueRef = useRef<AudioTrack[]>([]);
  const currentIndexRef = useRef<number>(0);
  const isEngagedRef = useRef(false);

  useEffect(() => {
    setCurrentTime(getCurrentTimeInTimezone(tz));
    const timer = setInterval(() => setCurrentTime(getCurrentTimeInTimezone(tz)), 1000);
    return () => clearInterval(timer);
  }, [tz]);

  useEffect(() => {
    const resolveLiveSession = async () => {
      try {
        const schedulesStr = localStorage.getItem('transformation-radio-schedules');
        const draftStr = localStorage.getItem('transformation-radio-draft');

        if (!schedulesStr || !draftStr) return;

        const schedules = JSON.parse(schedulesStr) as MonthlySchedule[];
        const draft = JSON.parse(draftStr) as RadioShow;

        const now = getCurrentTimeInTimezone(tz);
        const year = now.getFullYear();
        const month = now.getMonth();
        const currentMins = getMinutesFromMidnight(now);

        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayMonth = yesterday.getMonth();
        const yesterdayYear = yesterday.getFullYear();

        const currentMonthData = schedules.find(s => s.year === year && s.monthIndex === month);
        const yesterdayMonthData = schedules.find(s => s.year === yesterdayYear && s.monthIndex === yesterdayMonth);

        const yesterdaysEvents = yesterdayMonthData ? computeDailySchedule(yesterdayMonthData.entries, yesterday) : [];
        const todaysEvents = currentMonthData ? computeDailySchedule(currentMonthData.entries, now) : [];

        let activeEvent: ScheduleEntry | null = null;
        let nextEvent: ScheduleEntry | null = null;

        for (const ev of yesterdaysEvents) {
          const endMins = ev.startTime + ev.duration;
          if (endMins > 1440) {
            const remainingMinsToday = endMins - 1440;
            if (currentMins < remainingMinsToday) {
              activeEvent = ev;
              break;
            }
          }
        }

        for (let i = 0; i < todaysEvents.length; i++) {
          const ev = todaysEvents[i];
          const endMins = ev.startTime + ev.duration;
          if (!activeEvent && currentMins >= ev.startTime && currentMins < endMins) {
            activeEvent = ev;
            nextEvent = todaysEvents[i + 1] || null;
          } else if (ev.startTime > currentMins && !nextEvent) {
            if (activeEvent && ev.startTime >= (activeEvent.startTime + activeEvent.duration)) {
              nextEvent = ev;
            } else if (!activeEvent) {
              nextEvent = ev;
            }
          }
        }

        setNextShowName(nextEvent ? nextEvent.show : null);

        if (activeEvent) {
          if (activeEvent.show !== activeShowName) {
            setActiveShowName(activeEvent.show);
            setActiveEventStartTime(activeEvent.startTime);
            const session = draft.sessions?.find(s => s.title === activeEvent!.show);
            
            if (session && draft.segments) {
              const segs = session.segmentIds
                .map(id => draft.segments.find(s => s.id === id))
                .filter(Boolean) as ShowSegment[];

              const revivedSegs = await Promise.all(segs.map(async seg => {
                if (seg.audioSequence) {
                  const revivedSeq = await Promise.all(seg.audioSequence.map(async t => {
                    if (t.url.startsWith('blob:')) {
                      try {
                        const file = await getAudioFile(t.id);
                        if (file) return { ...t, url: URL.createObjectURL(file) };
                        return { ...t, url: 'blob-dead:' + t.url };
                      } catch (e) {
                         return { ...t, url: 'blob-dead:' + t.url };
                      }
                    }
                    return t;
                  }));
                  return { ...seg, audioSequence: revivedSeq };
                }
                return seg;
              }));

              setActiveSession({ title: session.title, segments: revivedSegs });
            } else {
              setActiveSession(null);
            }
          }
        } else {
          setActiveShowName("No Active Broadcast");
          setActiveEventStartTime(null);
          setActiveSession(null);
        }

        setTodaysSchedule(todaysEvents);

      } catch (err) {
        console.error("Failed to parse live schedule context", err);
      }
    };

    resolveLiveSession();
    const checkInterval = setInterval(resolveLiveSession, 5000);
    return () => clearInterval(checkInterval);
  }, [tz, activeShowName]);

  const cleanupAudio = useCallback(() => {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current.ontimeupdate = null;
      currentAudioRef.current.onended = null;
      currentAudioRef.current.onerror = null;
      currentAudioRef.current.src = "";
      currentAudioRef.current.removeAttribute('src');
      currentAudioRef.current.load();
      currentAudioRef.current = null;
      setTrackProgress(0);
    }
  }, []);

  const loadAndPlayTrack = useCallback((index: number, startTimeOffset: number = 0) => {
    if (index >= queueRef.current.length) {
      cleanupAudio();
      setNowPlayingTrack(null);
      setIsPlaying(false);
      isEngagedRef.current = false;
      return;
    }

    const track = queueRef.current[index];
    setNowPlayingTrack(track);
    currentIndexRef.current = index;
    cleanupAudio();

    const audio = new Audio();
    currentAudioRef.current = audio;
    audio.src = track.url;
    audio.volume = volumeRef.current;
    
    if (startTimeOffset > 0) {
      audio.currentTime = startTimeOffset;
    }

    audio.onerror = () => {
      let errorMessage = 'An unknown error occurred playback.';
      if (audio.error) {
        switch (audio.error.code) {
          case MediaError.MEDIA_ERR_ABORTED:
            errorMessage = 'Playback was aborted.';
            break;
          case MediaError.MEDIA_ERR_NETWORK:
            errorMessage = 'Network error occurred while fetching media.';
            break;
          case MediaError.MEDIA_ERR_DECODE:
            errorMessage = `Audio file corrupted or decoding failed for ${track.name}.`;
            break;
          case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
            errorMessage = `Format not supported or file missing for ${track.name}.`;
            break;
        }
      } else if (track.url.startsWith('blob:')) {
        errorMessage = `Media missing for ${track.name}.`;
      }
      setPlaybackError(errorMessage);
      setIsPlaying(false);
      isEngagedRef.current = false;
    };

    audio.onended = () => loadAndPlayTrack(index + 1);
    audio.ontimeupdate = () => {
      setTrackProgress(audio.currentTime);
      const preDuration = queueRef.current.slice(0, index).reduce((acc, t) => acc + (t.duration || 180), 0);
      setSessionProgress(preDuration + audio.currentTime);
    };

    audio.play().then(() => {
      setIsPlaying(true);
      isEngagedRef.current = true;
      setPlaybackError(null);
    }).catch(err => {
      if (err.name === 'NotSupportedError') {
        setPlaybackError(`Media file missing or corrupted for ${track.name}.`);
      } else if (err.name === 'NotAllowedError') {
        // This is expected for auto-play; it will resume on next user interaction
        setPlaybackError(null);
      } else if (err.name !== 'AbortError') {
        setPlaybackError(`Playback failed: ${err.message || 'Unknown error'}.`);
      }
      
      if (err.name !== 'AbortError') {
         setIsPlaying(false);
         isEngagedRef.current = false;
      }
    });
  }, [cleanupAudio]);

  // Global Auto-play Unlocker
  useEffect(() => {
    const handleGlobalInteraction = () => {
      if (!isEngagedRef.current && currentAudioRef.current && currentAudioRef.current.src && activeSession) {
        currentAudioRef.current.play().then(() => {
          setIsPlaying(true);
          isEngagedRef.current = true;
          setPlaybackError(null);
        }).catch(() => {
          // Silent catch
        });
      }
    };

    window.addEventListener('click', handleGlobalInteraction, { capture: true });
    window.addEventListener('keydown', handleGlobalInteraction, { capture: true });
    window.addEventListener('touchstart', handleGlobalInteraction, { capture: true });

    return () => {
      window.removeEventListener('click', handleGlobalInteraction, { capture: true });
      window.removeEventListener('keydown', handleGlobalInteraction, { capture: true });
      window.removeEventListener('touchstart', handleGlobalInteraction, { capture: true });
    };
  }, [activeSession]);

  useEffect(() => {
    if (!activeSession || activeEventStartTime === null) {
       queueRef.current = [];
       currentIndexRef.current = 0;
       if (isEngagedRef.current || isPlaying) {
          cleanupAudio();
          setNowPlayingTrack(null);
          setIsPlaying(false);
          isEngagedRef.current = false;
       }
       return;
    }

    const flatQueue: AudioTrack[] = [];
    activeSession.segments.forEach(seg => {
      if (seg.audioSequence) flatQueue.push(...seg.audioSequence);
    });

    queueRef.current = flatQueue;
    
    const totalDuration = flatQueue.reduce((acc, t) => acc + (t.duration || 180), 0);
    setSessionDuration(totalDuration);
    
    if (flatQueue.length > 0) {
      // Calculate current offset based on start time vs wall clock
      const now = getCurrentTimeInTimezone(tz);
      const nowMins = getMinutesFromMidnight(now);
      let elapsedSecs = (nowMins - activeEventStartTime) * 60 + now.getSeconds();
      
      // Handle wrap-around shows from previous day
      if (elapsedSecs < 0) {
        elapsedSecs += 1440 * 60;
      }
      
      let totalOffset = 0;
      let targetIndex = -1;
      let trackOffset = 0;

      for (let i = 0; i < flatQueue.length; i++) {
        const dur = flatQueue[i].duration || 180;
        if (totalOffset + dur > elapsedSecs) {
          targetIndex = i;
          trackOffset = elapsedSecs - totalOffset;
          break;
        }
        totalOffset += dur;
      }

      if (targetIndex !== -1) {
        // If we are already playing this session, don't restart it
        if (nowPlayingTrack && queueRef.current[currentIndexRef.current]?.id === flatQueue[targetIndex].id) {
          return;
        }
        loadAndPlayTrack(targetIndex, trackOffset);
      } else {
        // Show is over
        cleanupAudio();
        setNowPlayingTrack(null);
        setIsPlaying(false);
        isEngagedRef.current = false;
      }
    }
  }, [activeSession, activeEventStartTime, tz, loadAndPlayTrack, cleanupAudio]);

  const togglePlayPause = () => {
    if (isPlaying) {
      currentAudioRef.current?.pause();
      setIsPlaying(false);
      isEngagedRef.current = false;
    } else {
      if (currentAudioRef.current && currentAudioRef.current.src) {
        currentAudioRef.current.play().then(() => {
           setIsPlaying(true);
           isEngagedRef.current = true;
        }).catch(console.error);
      } else if (queueRef.current.length > 0) {
        loadAndPlayTrack(currentIndexRef.current);
      }
    }
  };

  const skipForward = () => {
    if (queueRef.current.length > currentIndexRef.current + 1) {
      loadAndPlayTrack(currentIndexRef.current + 1);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    volumeRef.current = val;
    if (currentAudioRef.current) {
      currentAudioRef.current.volume = val;
    }
  };

  const currentDuration = nowPlayingTrack?.duration || currentAudioRef.current?.duration || 180;

  return (
    <RadioContext.Provider value={{
      currentTime, activeSession, activeShowName, nextShowName, todaysSchedule,
      isPlaying, volume, playbackError, nowPlayingTrack, trackProgress, currentDuration,
      sessionProgress, sessionDuration,
      togglePlayPause, skipForward, handleVolumeChange,
      queueLength: queueRef.current.length, currentIndex: currentIndexRef.current
    }}>
      {children}
    </RadioContext.Provider>
  );
}

export function useRadio() {
  const ctx = useContext(RadioContext);
  if (!ctx) throw new Error("useRadio must be inside a RadioProvider");
  return ctx;
}
