import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from './firebase';
import { getAudioFile } from './storage';
import { RadioShow, ScheduleEntry, MonthlySchedule, ShowSegment, AudioTrack } from '../types';
import { getCurrentTimeInTimezone, getStationTimezone } from './timezone';

export function getSecondsFromMidnight(d: Date) {
  return d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds();
}

export function computeDailySchedule(entries: ScheduleEntry[], date: Date, draft?: RadioShow): ScheduleEntry[] {
  const dayOfWeek = date.getDay();
  const localDateString = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

  const filtered = entries.filter(e => {
    if (e.specificDate) return e.specificDate.startsWith(localDateString);
    if (e.daysOfWeek) return e.daysOfWeek.includes(dayOfWeek);
    return false;
  });

  if (filtered.length === 0) return [];

  const getSessionDurationSecs = (showTitle: string, sessId?: string): number => {
    if (!draft || !draft.segments || !draft.sessions) return 3600; 
    const session = draft.sessions.find(s => sessId ? s.id === sessId : s.title === showTitle);
    if (!session) return 3600;
    
    let totalDuration = 0;
    for (const sid of session.segmentIds) {
      const seg = draft.segments.find(s => s.id === sid);
      if (seg) {
        if (seg.duration) {
          totalDuration += seg.duration;
        } else if (seg.audioSequence && seg.audioSequence.length > 0) {
          totalDuration += seg.audioSequence.reduce((acc, t) => acc + (t.duration || 0), 0);
        } else {
          totalDuration += 180; // Default 3 min
        }
      }
    }
    return totalDuration > 0 ? totalDuration : 3600;
  };

  const entriesWithDuration = filtered.map(e => ({
     ...e,
     durationSecs: getSessionDurationSecs(e.show, e.sessionId),
     startTimeSecs: undefined as number | undefined
  }));

  // Resolve start times iteratively
  let changed = true;
  let iterations = 0;
  const maxIterations = entriesWithDuration.length * 2;

  while (changed && iterations < maxIterations) {
     changed = false;
     iterations++;
     
     for (let i = 0; i < entriesWithDuration.length; i++) {
        const e = entriesWithDuration[i];
        if (e.startTimeSecs !== undefined) continue;

        // 1. Fixed time?
        if (e.startTime != null && !isNaN(e.startTime)) {
           e.startTimeSecs = (e.startTime as number) * 60;
           changed = true;
           continue;
        }

        // 2. Explicit follower?
        if (e.followsShowTitle) {
           // Find the show it follows
           const pred = entriesWithDuration.find(p => p.show === e.followsShowTitle && p.startTimeSecs !== undefined && p.id !== e.id);
           if (pred) {
              e.startTimeSecs = pred.startTimeSecs + pred.durationSecs;
              changed = true;
           }
           continue;
        }

        // 3. Natural follower?
        if (i > 0) {
           const pred = entriesWithDuration[i-1];
           if (pred.startTimeSecs !== undefined) {
              e.startTimeSecs = pred.startTimeSecs + pred.durationSecs;
              changed = true;
           }
        } else {
           // First show starts at midnight
           e.startTimeSecs = 0;
           changed = true;
        }
     }
  }

  return entriesWithDuration
    .filter(e => e.startTimeSecs !== undefined)
    .map(e => ({
       ...e,
       startTime: e.startTimeSecs! / 60,
       duration: e.durationSecs! / 60
    }))
    .sort((a, b) => a.startTimeSecs! - b.startTimeSecs!);
}

interface RadioContextProps {
  currentTime: Date;
  activeSession: {title: string; segments: ShowSegment[]} | null;
  activeEvent: ScheduleEntry | null;
  activeShowName: string;
  nextShowName: string | null;
  todaysSchedule: ScheduleEntry[];
  isPlaying: boolean;
  volume: number;
  playbackError: string | null;
  nowPlayingTrack: AudioTrack | null;
  nowPlayingSegment: ShowSegment | null;
  trackProgress: number;
  currentDuration: number;
  sessionProgress: number;
  sessionDuration: number;
  isStudioMode: boolean;
  togglePlayPause: () => void;
  skipForward: () => void;
  handleVolumeChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  queueLength: number;
  currentIndex: number;
  allMixes: ShowSegment[];
}

const RadioContext = createContext<RadioContextProps | null>(null);

export function RadioProvider({ children, tz = 'UTC' }: { children: React.ReactNode; tz?: string }) {
  const [currentTime, setCurrentTime] = useState(getCurrentTimeInTimezone(tz));
  const [activeSession, setActiveSession] = useState<{title: string; segments: ShowSegment[]} | null>(null);
  const [activeEvent, setActiveEvent] = useState<ScheduleEntry | null>(null);
  const [allMixes, setAllMixes] = useState<ShowSegment[]>([]);
  const [activeShowName, setActiveShowName] = useState<string>("OFFLINE_STANDBY");
  const [activeEventStartTime, setActiveEventStartTime] = useState<number | null>(null);
  const [nextShowName, setNextShowName] = useState<string | null>(null);
  const [todaysSchedule, setTodaysSchedule] = useState<ScheduleEntry[]>([]);
  const [isStudioMode, setIsStudioMode] = useState(false);
  const lastStateVersionRef = useRef<string>('');
  const lastSessionFingerprintRef = useRef<string>('none');

  const [isPlaying, setIsPlaying] = useState(() => {
    return localStorage.getItem('non-club-radio-play-intent') === 'true';
  });
  const [volume, setVolume] = useState(() => {
    const saved = localStorage.getItem('radio-volume');
    return saved ? parseFloat(saved) : 1;
  });
  const volumeRef = useRef(volume);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [nowPlayingTrack, setNowPlayingTrack] = useState<AudioTrack | null>(null);
  const [nowPlayingSegment, setNowPlayingSegment] = useState<ShowSegment | null>(null);
  
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const [trackProgress, setTrackProgress] = useState(0);
  const [sessionProgress, setSessionProgress] = useState(0);
  const [sessionDuration, setSessionDuration] = useState(0);

  const queueRef = useRef<AudioTrack[]>([]);
  const currentIndexRef = useRef<number>(0);
  const isEngagedRef = useRef(false);

  // Sync isPlaying to localStorage
  useEffect(() => {
    localStorage.setItem('non-club-radio-play-intent', isPlaying.toString());
  }, [isPlaying]);

  useEffect(() => {
    setCurrentTime(getCurrentTimeInTimezone(tz));
    const timer = setInterval(() => setCurrentTime(getCurrentTimeInTimezone(tz)), 1000);
    return () => clearInterval(timer);
  }, [tz]);

  const isBusyResolving = useRef(false);

  useEffect(() => {
    const resolveLiveSession = async () => {
      if (isBusyResolving.current) return;
      isBusyResolving.current = true;
      try {
        const schedulesStr = localStorage.getItem('non-club-radio-schedules');
        const draftStr = localStorage.getItem('non-club-radio-draft');

        if (!schedulesStr || !draftStr) return;

        // Same-window/Multi-window change detection
        const currentStateFingerprint = `${schedulesStr}-${draftStr}`;
        const hasDataChanged = currentStateFingerprint !== lastStateVersionRef.current;
        
        lastStateVersionRef.current = currentStateFingerprint;

        const schedules = JSON.parse(schedulesStr) as MonthlySchedule[];
        const draft = JSON.parse(draftStr) as RadioShow;

        // Populate all mixes
        if (draft.segments) {
          const mixes = draft.segments.filter(s => s.type === 'mix');
          setAllMixes(mixes);
        }

        const now = getCurrentTimeInTimezone(tz);
        const year = now.getFullYear();
        const month = now.getMonth();
        const currentSecs = getSecondsFromMidnight(now);

        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayMonth = yesterday.getMonth();
        const yesterdayYear = yesterday.getFullYear();

        const currentMonthData = schedules.find(s => s.year === year && s.monthIndex === month);
        const yesterdayMonthData = schedules.find(s => s.year === yesterdayYear && s.monthIndex === yesterdayMonth);

        const yesterdaysEvents = yesterdayMonthData ? computeDailySchedule(yesterdayMonthData.entries, yesterday, draft) : [];
        const todaysEvents = currentMonthData ? computeDailySchedule(currentMonthData.entries, now, draft) : [];

        let foundActiveEvent: ScheduleEntry | null = null;
        let foundNextEvent: ScheduleEntry | null = null;

        // Check yesterday's events (for shows crossing midnight)
        for (const ev of yesterdaysEvents) {
          const startSecs = ev.startTimeSecs || 0;
          const durationSecs = ev.durationSecs || 3600;
          const endSecsAbs = startSecs + durationSecs;
          if (endSecsAbs > 86400) {
            const overflowSecs = endSecsAbs - 86400;
            if (currentSecs < overflowSecs) {
              foundActiveEvent = { ...ev, startTimeSecs: startSecs - 86400 };
              break; // Found the spilling-over show
            }
          }
        }

        // Check today's events - only look if yesterday didn't provide one or to override with today's explicit midnight show
        for (let i = 0; i < todaysEvents.length; i++) {
          const ev = todaysEvents[i];
          const startSecs = ev.startTimeSecs || 0;
          const durationSecs = ev.durationSecs || 3600;
          const endSecs = startSecs + durationSecs;

          if (currentSecs >= startSecs && currentSecs < endSecs) {
            foundActiveEvent = ev;
            foundNextEvent = todaysEvents[i + 1] || null;
            break; // Found today's active show
          } else if (startSecs > currentSecs && !foundNextEvent) {
            foundNextEvent = ev;
          }
        }

        let newActiveShowName = "OFFLINE_STANDBY";
        let newActiveEventStartTime: number | null = null;
        let newActiveSession: {title: string; segments: ShowSegment[]} | null = null;
        let newIsStudioMode = false;
        let sessionToRevive = null;

        if (foundActiveEvent) {
          newIsStudioMode = false;
          const session = draft.sessions?.find(s => 
            foundActiveEvent!.sessionId ? s.id === foundActiveEvent!.sessionId : s.title === foundActiveEvent!.show
          );
          
          newActiveShowName = foundActiveEvent.show;
          newActiveEventStartTime = foundActiveEvent.startTimeSecs || 0;
          sessionToRevive = session;
        } else {
          // No live event - check if we should show the Studio Session in the player
          const studioSessionId = localStorage.getItem('non-club-radio-active-session');
          const studioSession = draft.sessions?.find(s => s.id === studioSessionId);
          
          if (studioSession) {
            newIsStudioMode = true;
            newActiveShowName = `Studio: ${studioSession.title}`;
            newActiveEventStartTime = null;
            sessionToRevive = studioSession;
          }
        }

        // Only revive and update if the session identity or the data has changed
        const activeSessionId = sessionToRevive?.id;
        const currentSessionId = activeSession?.segments?.[0]?.id ? activeSessionId : null; // Close enough for check
        
        // Use a fingerprint for deep change detection
        const sessionFingerprint = sessionToRevive ? JSON.stringify(sessionToRevive.segmentIds) : 'none';
        const sessionChanged = sessionFingerprint !== lastSessionFingerprintRef.current || newIsStudioMode !== isStudioMode;

        if (sessionToRevive && (sessionChanged || hasDataChanged)) {
            lastSessionFingerprintRef.current = sessionFingerprint;
            const segs = sessionToRevive.segmentIds
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

            newActiveSession = { title: sessionToRevive.title, segments: revivedSegs };
            setActiveSession(newActiveSession);
        } else if (!sessionToRevive) {
            lastSessionFingerprintRef.current = 'none';
            setActiveSession(null);
        }

        // Apply other state updates atomically
        setActiveEvent(foundActiveEvent);
        setActiveShowName(newActiveShowName);
        setActiveEventStartTime(newActiveEventStartTime);
        setIsStudioMode(newIsStudioMode);

        if (hasDataChanged) {
          setTodaysSchedule(todaysEvents);
        }

      } catch (err) {
        console.error("Failed to parse live schedule context", err);
      } finally {
        isBusyResolving.current = false;
      }
    };

    resolveLiveSession();
    
    // Fast polling for same-tab updates
    const checkInterval = setInterval(resolveLiveSession, 2000);
    
    // Immediate response to multi-tab/multi-window updates
    window.addEventListener('storage', resolveLiveSession);
    // Immediate response to same-tab updates
    window.addEventListener('radio-data-updated', resolveLiveSession);
    
    return () => {
      clearInterval(checkInterval);
      window.removeEventListener('storage', resolveLiveSession);
      window.removeEventListener('radio-data-updated', resolveLiveSession);
    };
  }, [tz, activeShowName, activeSession]);

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

  const syncToWallClockRef = useRef<() => void>(() => {});

  const loadAndPlayTrack = useCallback((index: number, startTimeOffset: number = 0) => {
    if (index >= queueRef.current.length) {
      // End of playlist
      cleanupAudio();
      setNowPlayingTrack(null);
      setNowPlayingSegment(null);
      
      // If we are in Live mode, we keep 'isPlaying' true if there's a next show or if we want to stay "ready"
      if (isStudioMode) {
        setIsPlaying(false);
        isEngagedRef.current = false;
      } else {
        // Live mode: Stay on-air, but with no track. resolveLiveSession or syncToWallClock will handle the next show.
        // We don't explicitly set isPlaying false here to avoid killing the user's "listen" intent 
        // during short gaps or transitions.
      }
      return;
    }

    const track = queueRef.current[index];
    setNowPlayingTrack(track);
    
    // Find segment this track belongs to
    if (activeSession) {
      const segment = activeSession.segments.find(s => s.audioSequence?.some(t => t.id === track.id));
      if (segment) setNowPlayingSegment(segment);
    }

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

    audio.onloadedmetadata = () => {
      // Correct the stored duration with the actual media duration once known
      if (audio.duration && !isNaN(audio.duration) && audio.duration > 0) {
        if (queueRef.current[index]) {
          queueRef.current[index].duration = audio.duration;
        }
      }
    };

    audio.onended = () => {
      // Advance to next track in session
      loadAndPlayTrack(index + 1);
      
      // If we just finished the last track, trigger a schedule re-resolve 
      // to jump into the next scheduled show immediately
      if (index + 1 >= queueRef.current.length) {
        window.dispatchEvent(new CustomEvent('radio-data-updated'));
      }
    };
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
        setIsPlaying(false);
        isEngagedRef.current = false;
      } else if (err.name === 'NotAllowedError') {
        // This is expected for auto-play; it will resume on next user interaction
        // We STAY in 'isPlaying' state so that the UI reflects the intent
        // and global interaction listeners can trigger syncToWallClock
        setPlaybackError(null);
      } else if (err.name !== 'AbortError') {
        setPlaybackError(`Playback failed: ${err.message || 'Unknown error'}.`);
        setIsPlaying(false);
        isEngagedRef.current = false;
      }
    });
  }, [cleanupAudio, activeSession, activeEventStartTime]);

  const syncToWallClock = useCallback(() => {
    if (!activeSession || activeEventStartTime === null) return;

    const now = getCurrentTimeInTimezone(tz);
    const currentSecs = getSecondsFromMidnight(now);
    let elapsedSecs = currentSecs - activeEventStartTime;
    
    if (elapsedSecs < 0) elapsedSecs += 86400;

    const totalPlaylistDuration = queueRef.current.reduce((acc, t) => acc + (t.duration || 180), 0);
    
    if (totalPlaylistDuration === 0) return;

    const targetOffset = elapsedSecs;
    let totalOffset = 0;
    let targetIndex = -1;
    let trackOffset = 0;

    for (let i = 0; i < queueRef.current.length; i++) {
      const dur = queueRef.current[i].duration || 180;
      if (totalOffset + dur > targetOffset) {
        targetIndex = i;
        trackOffset = targetOffset - totalOffset;
        break;
      }
      totalOffset += dur;
    }

    // Check if the scheduled content has actually finished or if we are just in a gap
    const isPastEnd = elapsedSecs >= totalPlaylistDuration;
    
    if (isPastEnd) {
      // If we are technically past the end of the content, but the show is still scheduled to be active,
      // we don't kill isPlaying. We let resolveLiveSession or natural completion handle it.
      // We only kill if we've reached the very end of the playlist and no more tracks exist.
      if (isPlaying && targetIndex === -1 && currentIndexRef.current >= queueRef.current.length - 1) {
         // Optionally keep it alive for a few more seconds
      }
      return;
    }

    if (targetIndex !== -1) {
      const currentAudio = currentAudioRef.current;
      const currentTrackId = queueRef.current[currentIndexRef.current]?.id;
      const targetTrackId = queueRef.current[targetIndex]?.id;

      // If we are on the wrong track or significantly drifted (> 2s), re-sync
      const needsResync = !currentAudio || 
                          currentTrackId !== targetTrackId || 
                          Math.abs(currentAudio.currentTime - trackOffset) > 2;

      if (needsResync) {
        loadAndPlayTrack(targetIndex, trackOffset);
      } else if (currentAudio && currentAudio.paused && isPlaying) {
        currentAudio.play().then(() => {
          setIsPlaying(true);
          isEngagedRef.current = true;
        }).catch(() => {
          setIsPlaying(false);
          isEngagedRef.current = false;
        });
      }
    }
  }, [activeSession, activeEventStartTime, tz, loadAndPlayTrack, isPlaying]);

  useEffect(() => {
    syncToWallClockRef.current = syncToWallClock;
  }, [syncToWallClock]);

  // Handle initial auto-play attempt and session-change auto-play
  useEffect(() => {
    // If the show changed or we just loaded with an intent to play, sync up.
    if (activeSession && !isStudioMode && activeEventStartTime !== null) {
      const now = getCurrentTimeInTimezone(tz);
      const nowSecs = getSecondsFromMidnight(now);
      
      // If a show JUST started (matching current second or very close) OR we have play intent, sync and play
      const justStarted = Math.abs(nowSecs - activeEventStartTime) < 5;
      const playIntent = localStorage.getItem('non-club-radio-play-intent') === 'true';
      
      if (justStarted || playIntent || isPlaying) {
        if (!isEngagedRef.current || justStarted) {
          syncToWallClock();
        }
      }
    }
  }, [activeSession, isStudioMode, activeEventStartTime]);

  // Watch for the exact second a show starts to trigger auto-play
  useEffect(() => {
    if (!activeSession || isStudioMode || activeEventStartTime === null || isPlaying) return;
    
    const nowSecs = getSecondsFromMidnight(currentTime);
    if (nowSecs === activeEventStartTime) {
      syncToWallClock();
    }
  }, [currentTime, activeSession, isStudioMode, activeEventStartTime]);

  // Global Auto-play Unlocker & Drifters Sync
  useEffect(() => {
    const handleGlobalInteraction = () => {
      if (isPlaying && !isEngagedRef.current && activeSession && !isStudioMode) {
        syncToWallClock();
      }
    };

    window.addEventListener('click', handleGlobalInteraction, { capture: true });
    window.addEventListener('keydown', handleGlobalInteraction, { capture: true });
    window.addEventListener('touchstart', handleGlobalInteraction, { capture: true });

    // Periodic Sync (handles tab dormancy / drift)
    const syncInterval = setInterval(() => {
      if (isPlaying) syncToWallClock();
    }, 15000);

    return () => {
      window.removeEventListener('click', handleGlobalInteraction, { capture: true });
      window.removeEventListener('keydown', handleGlobalInteraction, { capture: true });
      window.removeEventListener('touchstart', handleGlobalInteraction, { capture: true });
      clearInterval(syncInterval);
    };
  }, [activeSession, syncToWallClock, isPlaying]);

  useEffect(() => {
    // We only clear if strictly off-air
    const hasScheduledEvent = activeEvent !== null;
    const isActuallyOff = !activeSession && !hasScheduledEvent && !isStudioMode;

    if (isActuallyOff) {
       queueRef.current = [];
       currentIndexRef.current = 0;
       if (isEngagedRef.current || isPlaying) {
          cleanupAudio();
          setNowPlayingTrack(null);
          setNowPlayingSegment(null);
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
    
    if (flatQueue.length > 0 && !isStudioMode) {
      // Periodic sync will handle the initial jump too, but let's be explicit
      syncToWallClock();
    }
  }, [activeSession, activeEventStartTime, tz, loadAndPlayTrack, cleanupAudio, syncToWallClock, isStudioMode]);

  const togglePlayPause = useCallback(() => {
    if (isPlaying) {
      currentAudioRef.current?.pause();
      setIsPlaying(false);
      isEngagedRef.current = false;
    } else {
      // If we have an active session (Live), start playback
      // Studio sessions (isStudioMode) are not "on-air" sessions
      if (activeSession && !isStudioMode) {
        setPlaybackError(null);
        syncToWallClock();
      } else {
        // No session is on-air
        setPlaybackError("Tuning Failed: The station is currently OFF-AIR. No live sessions are active.");
      }
    }
  }, [isPlaying, activeSession, isStudioMode, syncToWallClock]);

  const skipForward = useCallback(() => {
    if (queueRef.current.length > currentIndexRef.current + 1) {
      loadAndPlayTrack(currentIndexRef.current + 1);
    }
  }, [loadAndPlayTrack]);

  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    volumeRef.current = val;
    localStorage.setItem('radio-volume', val.toString());
    if (currentAudioRef.current) {
      currentAudioRef.current.volume = val;
    }
  }, []);

  const currentDuration = nowPlayingTrack?.duration || currentAudioRef.current?.duration || 180;

  return (
    <RadioContext.Provider value={{
      currentTime, activeSession, activeEvent, activeShowName, nextShowName, todaysSchedule,
      isPlaying, volume, playbackError, nowPlayingTrack, nowPlayingSegment, trackProgress, currentDuration,
      sessionProgress, sessionDuration, isStudioMode,
      togglePlayPause, skipForward, handleVolumeChange,
      queueLength: queueRef.current.length, currentIndex: currentIndexRef.current,
      allMixes
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
