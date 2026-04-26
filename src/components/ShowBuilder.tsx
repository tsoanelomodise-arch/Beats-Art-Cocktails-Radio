import React, { useState, useEffect, useCallback, useRef } from 'react';
import Logo from './Logo';
import { 
  Plus, 
  GripVertical, 
  Trash2, 
  Mic, 
  Music, 
  Radio, 
  Megaphone, 
  FileText, 
  ChevronDown, 
  ChevronUp, 
  Play, 
  Download,
  Loader2,
  Clock,
  Sparkles,
  CheckCircle2,
  RotateCcw,
  Pause,
  AlertCircle,
  FileJson,
  Archive,
  Upload,
  Volume2,
  Volume1,
  VolumeX,
  Copy
} from 'lucide-react';
import { ShowSegment, SegmentType, RadioShow, AudioTrack, Session, ProgramShow } from '../types';
import { motion, AnimatePresence, Reorder } from 'motion/react';
import JSZip from 'jszip';

const SEGMENT_TYPES: { type: SegmentType; label: string; icon: any; color: string }[] = [
  { type: 'talk', label: 'Spoken Transmission', icon: Mic, color: 'text-white' },
  { type: 'interview', label: 'External Link', icon: Radio, color: 'text-white' },
  { type: 'story', label: 'Narrative Data', icon: Sparkles, color: 'text-white' },
  { type: 'documentary', label: 'Archival Research', icon: FileText, color: 'text-white' },
  { type: 'music', label: 'Audio Export', icon: Music, color: 'text-white' },
  { type: 'ad', label: 'Network Bulletin', icon: Megaphone, color: 'text-white' },
  { type: 'jingle', label: 'Station Signature', icon: Sparkles, color: 'text-white' },
  { type: 'news', label: 'System Update', icon: FileText, color: 'text-white' },
  { type: 'mix', label: 'Studio Mix', icon: Volume2, color: 'text-white' },
];

const SCRIPTABLE_TYPES: SegmentType[] = ['talk', 'news', 'interview', 'documentary', 'story'];

const STORAGE_KEY = 'non-club-radio-draft';

import { saveAudioFile, getAudioFile } from '../lib/storage';

export default function ShowBuilder() {
  const [show, setShow] = useState<RadioShow>({
    id: '1',
    title: '',
    description: 'SYSTEM_DRAFT_V1',
    segments: [
      { id: 'start', type: 'jingle', title: 'Transmission_Init', content: 'Non-Club Radio Identity v1' },
      { id: 'welcome', type: 'talk', title: 'Link_Established', content: "Link active. Systems nominal. Initializing sequence.", voiceId: 'Thandi', styleLabel: 'Normal' }
    ],
    sessions: [
      { id: 'session1', title: 'DEFAULT_SEQUENCE', segmentIds: ['start', 'welcome'] }
    ],
    programShows: [],
    createdAt: new Date().toISOString()
  });

  const [activeSessionId, setActiveSessionId] = useState<string>(() => {
    return localStorage.getItem('non-club-radio-active-session') || 'session1';
  });
  const [activeProgramShowId, setActiveProgramShowId] = useState<string>(() => {
    return localStorage.getItem('non-club-radio-active-program-show') || 'all';
  });
  const [activeSegmentId, setActiveSegmentId] = useState<string | null>(null);
  
  // Playback state
  const [playingSegmentId, setPlayingSegmentId] = useState<string | null>(null);
  const [playingTrackId, setPlayingTrackId] = useState<string | null>(null);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(1);
  const [audioPlayer, setAudioPlayer] = useState<HTMLAudioElement | null>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const playlistRef = useRef<{ segmentId: string; tracks: AudioTrack[]; currentIndex: number } | null>(null);
  const timelineScrollRef = useRef<HTMLDivElement>(null);
  const editorScrollRef = useRef<HTMLDivElement>(null);

  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'idle'>('idle');
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [isExportingAudio, setIsExportingAudio] = useState(false);
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
  const hasLoadedRef = useRef(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load draft from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        let parsed = JSON.parse(saved);
        // Backfill segments if missing
        if (!parsed.segments) {
          parsed.segments = [];
        } else {
          // Backfill duration for synthesized segments if missing
          parsed.segments = parsed.segments.map((s: any) => 
            (s.audioUrl && !s.duration) ? { ...s, duration: 180 } : s
          );
        }
        // Backfill sessions for backwards compatibility
        if (!parsed.sessions) {
          parsed.sessions = [{
            id: 'session1',
            title: 'Default Session',
            segmentIds: parsed.segments.map((s: any) => s.id)
          }];
        }
        if (!parsed.programShows) {
          parsed.programShows = [];
        }
        setShow(parsed);
        // Pre-select the session, preferring the one from localStorage if it exists in the loaded show
        const savedSessionId = localStorage.getItem('non-club-radio-active-session');
        const savedProgramId = localStorage.getItem('non-club-radio-active-program-show');
        
        if (savedProgramId) {
          setActiveProgramShowId(savedProgramId);
        }

        if (savedSessionId && parsed.sessions.some((s: any) => s.id === savedSessionId)) {
          setActiveSessionId(savedSessionId);
        } else {
          setActiveSessionId(parsed.sessions[0]?.id || 'session1');
        }
        
        setLastSaved(new Date().toLocaleTimeString());

        // Revive dead Blob URLs from IndexedDB
        const reviveBlobs = async () => {
          const updatedSegments = await Promise.all(parsed.segments.map(async (segment: ShowSegment) => {
            if (segment.audioSequence && segment.audioSequence.length > 0) {
              const newSequence = await Promise.all(segment.audioSequence.map(async (track: AudioTrack) => {
                if (track.url.startsWith('blob:')) {
                  try {
                    const file = await getAudioFile(track.id);
                    if (file) {
                      return { ...track, url: URL.createObjectURL(file) };
                    } else {
                      return { ...track, url: 'blob-dead:' + track.url };
                    }
                  } catch (e) {
                    return { ...track, url: 'blob-dead:' + track.url };
                  }
                }
                return track;
              }));
              return { ...segment, audioSequence: newSequence };
            }
            return segment;
          }));
          setShow({ ...parsed, segments: updatedSegments });
          hasLoadedRef.current = true;
        };
        reviveBlobs();
        
      } catch (e) {
        console.error('Failed to parse draft from localStorage', e);
        hasLoadedRef.current = true;
      }
    } else {
      hasLoadedRef.current = true;
    }
  }, []);

  const saveToLocal = useCallback((data: RadioShow) => {
    if (!hasLoadedRef.current) return;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    
    setSaveStatus('saving');
    saveTimeoutRef.current = setTimeout(() => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      setSaveStatus('saved');
      setLastSaved(new Date().toLocaleTimeString());
      
      // Dispatch custom event for immediate Radio sync
      window.dispatchEvent(new CustomEvent('radio-data-updated'));

      // Reset status back to idle after a delay
      setTimeout(() => setSaveStatus('idle'), 3000);
    }, 500); // Simulate network latency/processing
  }, []);

  // Persist activeSessionId separately
  useEffect(() => {
    if (activeSessionId) {
      localStorage.setItem('non-club-radio-active-session', activeSessionId);
      window.dispatchEvent(new CustomEvent('radio-data-updated'));
    }
  }, [activeSessionId]);

  // Reactive auto-save after modification with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      saveToLocal(show);
    }, 2000); // 2 second debounce for modification saving

    return () => clearTimeout(timer);
  }, [show, saveToLocal]);

  // Periodic auto-save every 60 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      saveToLocal(show);
    }, 60000);

    return () => clearInterval(interval);
  }, [show, saveToLocal]);

  const stopPlayback = useCallback(() => {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current.onerror = null;
      currentAudioRef.current.onended = null;
      currentAudioRef.current.ontimeupdate = null;
      currentAudioRef.current.removeAttribute('src');
      currentAudioRef.current.load();
      currentAudioRef.current = null;
    }
    setAudioPlayer(null);
    setPlayingSegmentId(null);
    setPlayingTrackId(null);
    playlistRef.current = null;
    setCurrentTime(0);
  }, []);

  useEffect(() => {
    return () => stopPlayback();
  }, [stopPlayback]);

  const playTrack = (track: AudioTrack, segmentId: string, asPartOfSequence = false) => {
    if (track.url.startsWith('blob-dead:')) {
      setPlaybackError(`Audio file lost for ${track.name}. Please delete track and re-upload.`);
      stopPlayback();
      return;
    }

    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current.onerror = null;
      currentAudioRef.current.onended = null;
      currentAudioRef.current.ontimeupdate = null;
      currentAudioRef.current.removeAttribute('src');
      currentAudioRef.current.load();
    }

    const newAudio = new Audio(track.url);
    currentAudioRef.current = newAudio;
    newAudio.volume = volume;

    newAudio.onerror = () => {
      let errorMessage = `Failed to load: ${track.name}`;
      if (newAudio.error) {
        switch(newAudio.error.code) {
          case MediaError.MEDIA_ERR_NETWORK:
            errorMessage = `Network error during playback. Please check your connection.`;
            break;
          case MediaError.MEDIA_ERR_DECODE:
            errorMessage = `Audio file corrupted or decoding failed for ${track.name}. Please re-upload.`;
            break;
          case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
            errorMessage = `Format not supported or file missing for ${track.name}. Please re-upload.`;
            break;
        }
      } else if (track.url.startsWith('blob:')) {
        errorMessage = `Media missing for ${track.name}. Please re-upload.`;
      }
      setPlaybackError(errorMessage);
      stopPlayback();
    };

    newAudio.onended = () => {
      if (asPartOfSequence && playlistRef.current) {
        const nextIndex = playlistRef.current.currentIndex + 1;
        if (nextIndex < playlistRef.current.tracks.length) {
          playlistRef.current.currentIndex = nextIndex;
          playTrack(playlistRef.current.tracks[nextIndex], playlistRef.current.segmentId, true);
        } else {
          stopPlayback(); // Finished sequence
        }
      } else {
        stopPlayback();
      }
    };

    newAudio.ontimeupdate = () => setCurrentTime(newAudio.currentTime);
    
    newAudio.play().catch(err => {
      if (err.name === 'NotSupportedError') {
        setPlaybackError(`Media file missing or corrupted for ${track.name}. Please try re-uploading.`);
        stopPlayback();
      } else if (err.name === 'NotAllowedError') {
        setPlaybackError("Playback inhibited by browser auto-play policy. Please interact with the page first.");
        stopPlayback();
      } else if (err.name === 'TypeError') {
        setPlaybackError(`Network issue or invalid file for ${track.name}. Please check your connection or re-upload.`);
        stopPlayback();
      } else if (err.name !== 'AbortError') {
        setPlaybackError(`Playback failed: ${err.message || 'Unknown error'}. Please check file and connection.`);
        stopPlayback();
      }
    });

    setAudioPlayer(newAudio);
    setPlayingTrackId(track.id);
    setPlayingSegmentId(segmentId);
  };

  const toggleSegmentPreview = (segment: ShowSegment) => {
    const tracks = segment.audioSequence || [];
    if (tracks.length === 0) return;
    setPlaybackError(null);

    if (playingSegmentId === segment.id && playlistRef.current) {
      stopPlayback();
    } else {
      playlistRef.current = { segmentId: segment.id, tracks, currentIndex: 0 };
      playTrack(tracks[0], segment.id, true);
    }
  };

  const toggleTrackPreview = (track: AudioTrack, segmentId: string) => {
    setPlaybackError(null);
    if (playingTrackId === track.id) {
      stopPlayback();
    } else {
      playlistRef.current = null;
      playTrack(track, segmentId, false);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    setCurrentTime(time);
    if (currentAudioRef.current) {
      currentAudioRef.current.currentTime = time;
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVol = parseFloat(e.target.value);
    setVolume(newVol);
    if (currentAudioRef.current) {
      currentAudioRef.current.volume = newVol;
    }
  };

  const getAudioDuration = (file: File): Promise<number> => {
    return new Promise((resolve) => {
      const audio = new Audio();
      const url = URL.createObjectURL(file);
      audio.src = url;
      audio.onloadedmetadata = () => {
        const duration = audio.duration;
        URL.revokeObjectURL(url);
        resolve(duration);
      };
      audio.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(180); // Fallback
      };
    });
  };

  const handleFileUpload = async (segmentId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files) as File[];
    
    const newTracks: AudioTrack[] = await Promise.all(files.map(async file => {
      const id = Math.random().toString(36).substr(2, 9);
      try {
        await saveAudioFile(id, file);
      } catch (err) {
        console.error("Failed to save audio file to IndexedDB", err);
      }
      const duration = await getAudioDuration(file);
      return {
        id,
        name: file.name,
        url: URL.createObjectURL(file), // Create a fresh one for the track object
        duration
      };
    }));

    const existingSegment = show.segments.find(s => s.id === segmentId);
    const existingTracks = existingSegment?.audioSequence || [];
    const mergedTracks = [...existingTracks, ...newTracks];
    const totalDuration = mergedTracks.reduce((acc, curr) => acc + (curr.duration || 0), 0);

    updateSegment(segmentId, {
      audioSequence: mergedTracks,
      duration: Math.ceil(totalDuration)
    });
  };

  const handleThumbnailUpload = async (segmentId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return;
    const file = e.target.files[0];
    
    // Convert to base64 for local storage (since and indexedDB is already used for audio)
    // Actually, for simplicity and since thumbnails are small, base64 is okay here.
    const reader = new FileReader();
    reader.onloadend = () => {
      updateSegment(segmentId, { thumbnail: reader.result as string });
    };
    reader.readAsDataURL(file);
  };

  const removeTrack = (segmentId: string, trackId: string) => {
    const existingSegment = show.segments.find(s => s.id === segmentId);
    const existingTracks = existingSegment?.audioSequence || [];
    const filteredTracks = existingTracks.filter(t => t.id !== trackId);
    const totalDuration = filteredTracks.reduce((acc, curr) => acc + (curr.duration || 180), 0);

    updateSegment(segmentId, {
      audioSequence: filteredTracks,
      duration: filteredTracks.length > 0 ? totalDuration : 180
    });
  };

  const handleExportJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(show, null, 2));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute("href", dataStr);
    dlAnchorElem.setAttribute("download", `${show.title.replace(/\s+/g, '_').toLowerCase()}_config.json`);
    dlAnchorElem.click();
  };

  const handleExportAudio = async () => {
    setIsExportingAudio(true);
    try {
      const zip = new JSZip();
      let hasAudio = false;

      for (let i = 0; i < show.segments.length; i++) {
        const segment = show.segments[i];
        if (segment.audioSequence && segment.audioSequence.length > 0) {
          hasAudio = true;
          const folderName = `${String(i + 1).padStart(2, '0')}_${segment.title.replace(/[\s/\\:]+/g, '_')}`;
          const folder = zip.folder(folderName);
          
          for (let j = 0; j < segment.audioSequence.length; j++) {
            const track = segment.audioSequence[j];
            try {
              const response = await fetch(track.url);
              const blob = await response.blob();
              const ext = track.name.split('.').pop() || 'wav';
              const filename = `${String(j + 1).padStart(2, '0')}_${track.name.replace(/[\s/\\:]+/g, '_')}`;
              
              // Only add if it doesn't already have an extension, to prevent double extensions
              const finalFilename = filename.endsWith(`.${ext}`) ? filename : `${filename}.${ext}`;
              folder?.file(finalFilename, blob);
            } catch (e) {
              console.error("Failed to fetch track for zip (if object URL revoked):", e);
            }
          }
        }
      }

      if (!hasAudio) {
        alert("No audio found to export.");
        return;
      }

      const zipBlob = await zip.generateAsync({ type: "blob" });
      const url = window.URL.createObjectURL(zipBlob);
      const dlAnchorElem = document.createElement('a');
      dlAnchorElem.href = url;
      dlAnchorElem.download = `${show.title.replace(/\s+/g, '_').toLowerCase()}_audio_bundle.zip`;
      dlAnchorElem.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Failed to export audio:", err);
      alert("Failed to export audio bundle. Please check the console for details.");
    } finally {
      setIsExportingAudio(false);
    }
  };

  const addSegment = (type: SegmentType) => {
    const isScriptable = SCRIPTABLE_TYPES.includes(type);
    const newSegment: ShowSegment = {
      id: Math.random().toString(36).substr(2, 9),
      type,
      title: `New ${type.charAt(0).toUpperCase() + type.slice(1)}`,
      content: '', // Deprecated unused content field
      voiceId: isScriptable ? 'Thandi' : undefined,
      styleLabel: isScriptable ? 'Normal' : undefined,
      duration: 180, // Default to 3 minutes
    };
    setShow(prev => {
      const newSegments = [...prev.segments, newSegment];
      const newSessions = prev.sessions.map(s => 
        s.id === activeSessionId ? { ...s, segmentIds: [...s.segmentIds, newSegment.id] } : s
      );
      return { ...prev, segments: newSegments, sessions: newSessions };
    });
    setActiveSegmentId(newSegment.id);
  };

  const updateSegment = (id: string, updates: Partial<ShowSegment>) => {
    setShow(prev => ({
      ...prev,
      segments: prev.segments.map(s => s.id === id ? { ...s, ...updates } : s)
    }));
  };

  // Auto-scroll logic for better UX
  useEffect(() => {
    if (activeSegmentId) {
      // Find the element and scroll to it smoothly
      const element = document.getElementById(`segment-${activeSegmentId}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
      // Also scroll editor to top
      if (editorScrollRef.current) {
        editorScrollRef.current.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }
  }, [activeSegmentId]);

  const deleteSegment = (id: string) => {
    setShow(prev => ({
      ...prev,
      // Remove from global list
      segments: prev.segments.filter(s => s.id !== id),
      // Remove from all sessions
      sessions: prev.sessions.map(s => ({
        ...s,
        segmentIds: s.segmentIds.filter(sid => sid !== id)
      }))
    }));
    if (activeSegmentId === id) setActiveSegmentId(null);
  };

  const removeSegmentFromSession = (sessionId: string, segmentId: string) => {
    setShow(prev => ({
      ...prev,
      sessions: prev.sessions.map(s => 
        s.id === sessionId ? { ...s, segmentIds: s.segmentIds.filter(sid => sid !== segmentId) } : s
      )
    }));
  };

  const cloneSegmentFromSession = (sessionId: string, segmentId: string) => {
    setShow(prev => {
      const originalSegment = prev.segments.find(s => s.id === segmentId);
      if (!originalSegment) return prev;

      const newSegmentId = Math.random().toString(36).substr(2, 9);
      
      const newTracks = (originalSegment.audioSequence || []).map(track => ({
        ...track,
        id: Math.random().toString(36).substr(2, 9),
      }));

      const clonedSegment: ShowSegment = {
        ...originalSegment,
        id: newSegmentId,
        title: `${originalSegment.title} (Copy)`,
        audioSequence: newTracks
      };

      const newSegments = [...prev.segments, clonedSegment];

      const newSessions = prev.sessions.map(s => {
        if (s.id !== sessionId) return s;
        
        const targetIndex = s.segmentIds.indexOf(segmentId);
        const newSegmentIds = [...s.segmentIds];
        if (targetIndex !== -1) {
          newSegmentIds.splice(targetIndex + 1, 0, newSegmentId);
        } else {
          newSegmentIds.push(newSegmentId);
        }
        
        return {
          ...s,
          segmentIds: newSegmentIds
        };
      });

      return {
        ...prev,
        segments: newSegments,
        sessions: newSessions
      };
    });
  };

  const createSession = () => {
    const newSession: Session = {
      id: Math.random().toString(36).substr(2, 9),
      title: `New Session ${show.sessions.length + 1}`,
      segmentIds: [],
      showId: activeProgramShowId !== 'all' ? activeProgramShowId : undefined
    };
    setShow(prev => ({
      ...prev,
      sessions: [...prev.sessions, newSession]
    }));
    setActiveSessionId(newSession.id);
  };

  const addProgramShow = (title: string) => {
    const newShow: ProgramShow = {
      id: Math.random().toString(36).substr(2, 9),
      title,
      description: 'A recurring program.'
    };
    setShow(prev => ({
      ...prev,
      programShows: [...(prev.programShows || []), newShow]
    }));
    setActiveProgramShowId(newShow.id);
  };

  const deleteProgramShow = (id: string) => {
    setShow(prev => ({
      ...prev,
      programShows: (prev.programShows || []).filter(s => s.id !== id),
      // Optionally decouple sessions? Or keep them as is but without showId ref
      sessions: (prev.sessions || []).map(s => s.showId === id ? { ...s, showId: undefined } : s)
    }));
    if (activeProgramShowId === id) setActiveProgramShowId('all');
  };

  const filteredSessions = (show.sessions || []).filter(s => {
    if (activeProgramShowId === 'all') return true;
    return s.showId === activeProgramShowId;
  });

  const activeSession = show.sessions ? show.sessions.find(s => s.id === activeSessionId) : undefined;
  const sessionSegments = activeSession && show.segments
    ? activeSession.segmentIds.map(id => show.segments.find(s => s.id === id)).filter(Boolean) as ShowSegment[]
    : [];

  const totalDuration = sessionSegments.reduce((acc, s) => acc + (s.duration || 180), 0);
  const formatTime = (seconds: number) => {
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;
    return `${min}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex h-full bg-[#1e2022]">
      {/* Left Pane: Timeline */}
      <div className="w-[450px] border-r border-border flex flex-col bg-[#2a2d30]/20">
        <div className="p-8 border-b border-border flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-[2px] text-text-secondary">
              <span className="flex items-center gap-1.5"><Clock size={12}/> {formatTime(totalDuration)} Est. Run Time</span>
              <span className="flex items-center gap-1.5"><ListIcon size={12}/> {sessionSegments.length} Segments</span>
            </div>
            <div className="flex items-center gap-2 whitespace-nowrap">
              <AnimatePresence mode="wait">
                {saveStatus === 'saving' ? (
                  <motion.div 
                    initial={{ opacity: 0, x: 5 }} 
                    animate={{ opacity: 1, x: 0 }} 
                    exit={{ opacity: 0 }}
                    key="saving"
                    className="flex items-center gap-1.5 text-[10px] text-accent font-bold uppercase tracking-widest"
                  >
                    <Loader2 size={12} className="animate-spin" />
                    Saving
                  </motion.div>
                ) : saveStatus === 'saved' ? (
                  <motion.div 
                    initial={{ opacity: 0, x: 5 }} 
                    animate={{ opacity: 1, x: 0 }} 
                    exit={{ opacity: 0 }}
                    key="saved"
                    className="flex items-center gap-1.5 text-[10px] text-emerald-400 font-bold uppercase tracking-widest"
                  >
                    <CheckCircle2 size={12} />
                    Saved
                  </motion.div>
                ) : lastSaved ? (
                  <motion.div 
                    initial={{ opacity: 0 }} 
                    animate={{ opacity: 0.4 }} 
                    key="idle"
                    className="flex items-center gap-1.5 text-[10px] text-text-secondary font-bold uppercase tracking-widest"
                  >
                    <Clock size={12} />
                    {lastSaved}
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>
          </div>
          
          {/* Show / Series Selector */}
          <div className="flex flex-col gap-2 py-2">
            <div className="flex items-center justify-between px-1">
              <label className="text-[10px] font-black uppercase tracking-[2px] text-accent/80 flex items-center gap-2">
                <Radio size={12} /> Shows / Series
              </label>
              <div className="flex items-center gap-2">
                {activeProgramShowId !== 'all' && (
                  <button 
                    onClick={() => {
                      if (confirm(`Delete show "${show.programShows?.find(s => s.id === activeProgramShowId)?.title}"?`)) {
                        deleteProgramShow(activeProgramShowId);
                      }
                    }}
                    className="text-text-secondary hover:text-red-400 transition-colors"
                    title="Delete Active Show"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
                <button 
                  onClick={() => {
                    const title = prompt("Enter new show title:");
                    if (title) addProgramShow(title);
                  }}
                  className="text-text-secondary hover:text-white transition-colors"
                  title="Add New Show"
                >
                  <Plus size={14} />
                </button>
              </div>
            </div>
            <div className="relative">
              <select 
                value={activeProgramShowId}
                onChange={e => {
                  const val = e.target.value;
                  setActiveProgramShowId(val);
                  localStorage.setItem('non-club-radio-active-program-show', val);
                  // Auto-select first session in that show if currently active session isn't in it
                  const firstInShow = show.sessions.find(s => val === 'all' || s.showId === val);
                  if (firstInShow) setActiveSessionId(firstInShow.id);
                }}
                className="w-full bg-[#1e2022] border border-border text-[#f2e7d5] text-[10px] font-black uppercase tracking-wider rounded-lg px-3 py-2.5 outline-none appearance-none cursor-pointer hover:border-white/20 transition-colors"
              >
                <option value="all" className="bg-[#1e2022] text-white">All Episodes (Unfiltered)</option>
                {(show.programShows || []).map(ps => (
                  <option key={ps.id} value={ps.id} className="bg-[#1e2022] text-white">{ps.title}</option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-accent pointer-events-none" />
            </div>
          </div>

          <div className="flex bg-[#2a2d30]/50 border border-border rounded-xl p-1.5 px-3">
            <div className="flex items-center gap-2 flex-1 relative min-w-0">
              <div className="relative flex items-center min-w-0">
                <select 
                  value={activeSessionId}
                  onChange={e => setActiveSessionId(e.target.value)}
                  className="bg-accent/10 border-none text-[#f2e7d5] text-[10px] font-black uppercase tracking-wider rounded-lg pl-3 pr-8 py-2 outline-none appearance-none cursor-pointer max-w-[140px] truncate"
                >
                  {filteredSessions.map(s => (
                    <option key={s.id} value={s.id} className="bg-[#1e2022] text-white">{s.title}</option>
                  ))}
                </select>
                <ChevronDown size={12} className="absolute right-2 text-accent pointer-events-none" />
              </div>
              
              {activeSession && (
                <input
                  value={activeSession.title}
                  onChange={e => setShow(prev => ({
                    ...prev,
                    sessions: (prev.sessions || []).map(s => s.id === activeSession.id ? { ...s, title: e.target.value } : s)
                  }))}
                  className="bg-transparent text-sm font-bold text-white border-b border-transparent focus:border-white/20 outline-none w-full px-2"
                  placeholder="Session Title..."
                />
              )}
            </div>
            <button 
              onClick={createSession}
              className="flex-shrink-0 p-2 hover:bg-white/10 rounded-lg text-text-secondary hover:text-white transition-colors ml-2"
              title="Create New Session"
            >
              <Plus size={16} />
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-text-secondary">
              {volume === 0 ? <VolumeX size={12} /> : volume < 0.5 ? <Volume1 size={12} /> : <Volume2 size={12} />}
              <input 
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={volume}
                onChange={handleVolumeChange}
                className="w-16 accent-accent bg-white/10 h-1 rounded-full appearance-none cursor-pointer"
                title="Master Volume"
              />
            </div>
            
            <div className="flex items-center gap-2">
              <button 
                onClick={handleExportJSON}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface border border-border text-text-secondary hover:text-white transition-all text-[9px] font-bold uppercase tracking-widest hover:border-white/20"
                title="Save structure as JSON"
              >
                <FileJson size={12} />
                JSON
              </button>
              <button 
                onClick={handleExportAudio}
                disabled={isExportingAudio}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent/10 border border-accent/20 text-accent hover:bg-accent hover:text-white transition-all text-[9px] font-bold uppercase tracking-widest disabled:opacity-50"
                title="Download all generated audio as ZIP"
              >
                {isExportingAudio ? <Loader2 size={12} className="animate-spin" /> : <Archive size={12} />}
                Export Audio
              </button>
            </div>
          </div>
        </div>

        <div className="px-6 mt-6 mb-2">
          <h3 className="text-[11px] font-black uppercase tracking-[2px] text-accent/80 flex items-center gap-2">
            <Radio size={12} /> Segments
          </h3>
        </div>

        <div className="flex-1 overflow-y-auto p-6 pt-2 mask-fade-out" ref={timelineScrollRef}>
          {!activeSession ? (
            <div className="text-center text-text-secondary text-sm p-4">Please select or create a session.</div>
          ) : (
            <Reorder.Group 
              axis="y" 
              values={sessionSegments} 
              onReorder={(newSegments) => {
                setShow(prev => ({
                  ...prev,
                  sessions: prev.sessions.map(s => 
                    s.id === activeSessionId ? { ...s, segmentIds: newSegments.map(ns => ns.id) } : s
                  )
                }))
              }}
              className="space-y-3 pb-24"
            >
              {sessionSegments.map((segment, index) => {
                const TypeIcon = SEGMENT_TYPES.find(t => t.type === segment.type)?.icon || Mic;
                const typeColor = SEGMENT_TYPES.find(t => t.type === segment.type)?.color || 'text-text-secondary';
                
                return (
                  <Reorder.Item 
                    key={segment.id}
                    id={`segment-${segment.id}`}
                    value={segment}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    onClick={() => setActiveSegmentId(segment.id)}
                    className={`group relative p-5 rounded-2xl border transition-all cursor-grab active:cursor-grabbing flex items-center gap-5
                      ${activeSegmentId === segment.id ? 'bg-[#5c191c]/20 border-accent shadow-xl shadow-accent/5' : 'bg-[#2a2d30]/40 border-border hover:border-white/20'}
                    `}
                  >
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className="text-text-secondary/20 group-hover:text-text-secondary/40 transition-colors">
                        <GripVertical size={16} />
                      </div>
                      <div className={`p-3 rounded-xl bg-[#2a2d30] border border-border group-hover:bg-accent group-hover:border-accent transition-colors ${typeColor}`}>
                        <TypeIcon size={18} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-[12px] font-black uppercase tracking-wider truncate mb-1 text-[#f2e7d5]">{segment.title}</h4>
                        {segment.audioSequence && segment.audioSequence.length > 0 && (
                          <div className="flex flex-col gap-1.5 mt-2 border-t border-white/5 pt-2">
                            {segment.audioSequence.map((track, trackIdx) => (
                              <div key={track.id} className="flex items-center gap-2 group/track">
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleTrackPreview(track, segment.id);
                                  }}
                                  className="w-5 h-5 flex-shrink-0 flex items-center justify-center rounded-full bg-surface border border-border text-accent hover:bg-accent hover:text-white transition-colors"
                                  title="Preview Track"
                                >
                                  {playingTrackId === track.id ? <Pause size={10} fill="currentColor" /> : <Play size={10} fill="currentColor" className="ml-0.5" />}
                                </button>
                                <span className="text-[10px] text-text-secondary truncate group-hover/track:text-white transition-colors flex-1" title={track.name}>
                                  <span className="opacity-40 mr-1">{trackIdx + 1}.</span>{track.name}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <div className="flex flex-col items-end">
                        <span className="text-[10px] font-mono opacity-40">0{index + 1}</span>
                        {segment.duration && (
                          <span className="text-[10px] text-text-secondary mt-1">
                            {formatTime(segment.duration)}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {segment.audioSequence && segment.audioSequence.length > 0 && (
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleSegmentPreview(segment);
                            }}
                            className={`p-1 rounded-md transition-colors relative ${playingSegmentId === segment.id && playlistRef.current ? 'bg-accent/20 text-accent' : 'text-accent hover:bg-white/5'}`}
                            title="Preview Segment Audio"
                          >
                            {playingSegmentId === segment.id && playlistRef.current ? <Pause size={12} /> : <Volume2 size={12} />}
                            {playingSegmentId === segment.id && playlistRef.current && playbackError && (
                              <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                            )}
                          </button>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            cloneSegmentFromSession(activeSessionId, segment.id);
                          }}
                          className="p-1 rounded-md transition-colors text-text-secondary hover:bg-accent/10 hover:text-accent"
                          title="Clone Segment"
                        >
                          <Copy size={12} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            removeSegmentFromSession(activeSessionId, segment.id);
                          }}
                          className="p-1 rounded-md transition-colors text-text-secondary hover:bg-red-500/10 hover:text-red-400"
                          title="Remove from Session"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  </Reorder.Item>
                );
              })}
            </Reorder.Group>
          )}
        </div>

        <div className="p-6 border-t border-border bg-[#1e2022]/80 backdrop-blur-md relative">
          <label className="text-[9px] font-black uppercase tracking-[2px] text-[#888a8c] mb-3 block">
            Segments
          </label>
          
          <div className="relative flex flex-col gap-2">
            <div className="flex items-end gap-2">
              <button 
                onClick={() => setIsAddMenuOpen(!isAddMenuOpen)}
                className={`flex-1 flex items-center justify-between p-3.5 rounded-xl border transition-all font-black uppercase tracking-widest text-[10px]
                  ${isAddMenuOpen ? 'bg-accent border-accent text-[#f2e7d5] shadow-lg' : 'bg-[#2a2d30] border-border text-[#f2e7d5] hover:border-accent/40 hover:text-white'}
                `}
                disabled={!activeSession}
                title="Create New Segment"
              >
                <div className="flex items-center gap-2">
                  <Plus size={14} />
                  Create New
                </div>
                <ChevronDown size={14} className={`transition-transform duration-300 ${isAddMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              <div className="flex-1 space-y-1.5">
                <label className="text-[9px] font-black uppercase tracking-[1px] text-text-secondary/60 px-1">Select Segments</label>
                <div className="relative">
                  <select
                    value=""
                    onChange={(e) => {
                      const segmentId = e.target.value;
                      if (!segmentId) return;
                      setShow(prev => ({
                        ...prev,
                        sessions: (prev.sessions || []).map(session => {
                          if (session.id === activeSessionId) {
                            // Enforce uniqueness: segments should not repeat within a session
                            if (session.segmentIds.includes(segmentId)) return session;
                            return { ...session, segmentIds: [...session.segmentIds, segmentId] };
                          }
                          return session;
                        })
                      }));
                    }}
                    className="w-full bg-surface/50 border border-border text-[#f2e7d5]/90 hover:text-white hover:border-white/20 transition-all text-[10px] uppercase font-black tracking-widest rounded-xl pl-3 pr-8 py-3.5 outline-none focus:border-accent appearance-none disabled:opacity-30 cursor-pointer"
                    disabled={!activeSession || show.segments.filter(s => !(activeSession?.segmentIds || []).includes(s.id)).length === 0}
                  >
                    <option value="" disabled className="bg-[#1e2022] text-white/50">Add Existing...</option>
                    {activeSession && show.segments.filter(s => !activeSession.segmentIds.includes(s.id)).map(s => (
                      <option key={s.id} value={s.id} className="bg-[#1e2022] text-white">{s.title}</option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary pointer-events-none" />
                </div>
              </div>
            </div>

            <AnimatePresence>
              {isAddMenuOpen && activeSession && (
                <motion.div 
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 4, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute bottom-full left-0 right-0 mb-2 bg-[#12141c] border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-50 p-2 max-h-[400px] flex flex-col"
                >
                  <div className="overflow-y-auto pr-1">
                    <div className="px-3 py-2 text-[9px] font-black uppercase tracking-[2px] text-text-secondary">Segment Type</div>
                    <div className="grid grid-cols-1 gap-1">
                      {SEGMENT_TYPES.map(st => {
                        const Icon = st.icon;
                        return (
                          <button 
                            key={st.type}
                            onClick={() => {
                              addSegment(st.type);
                              setIsAddMenuOpen(false);
                            }}
                            className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 text-[10px] font-black uppercase tracking-wider text-[#f2e7d5]/80 hover:text-white transition-all text-left group"
                          >
                            <div className={`p-2 rounded-lg bg-surface border border-border group-hover:bg-accent group-hover:border-accent transition-colors ${st.color}`}>
                              <Icon size={14} />
                            </div>
                            {st.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Right Pane: Segment Editor */}
      <div 
        ref={editorScrollRef}
        className="flex-1 overflow-y-auto relative bg-[#1e2022] scroll-smooth pb-32 shadow-inner shadow-black/20"
      >
        <AnimatePresence mode="wait">
          {activeSegmentId ? (
            <motion.div 
              key={activeSegmentId}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="p-16 max-w-4xl mx-auto"
            >
              {show.segments.filter(s => s.id === activeSegmentId).map(segment => (
                <div key={segment.id} className="space-y-12">
                  <header className="flex items-center justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <span className={`text-[10px] font-black uppercase tracking-[3px] py-1 px-3 rounded-md bg-[#2a2d30] border border-accent/20 text-[#f2e7d5]`}>
                          {segment.type}
                        </span>
                        <input 
                          value={segment.title}
                          onChange={e => updateSegment(segment.id, { title: e.target.value })}
                          className="bg-transparent border-none text-4xl font-[900] tracking-tighter outline-none text-[#f2e7d5] w-96 underline decoration-accent/20"
                        />
                      </div>
                    </div>
                    <button 
                      onClick={() => deleteSegment(segment.id)}
                      className="p-4 rounded-full bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white transition-all"
                    >
                      <Trash2 size={20} />
                    </button>
                  </header>

                  <div className="grid grid-cols-[200px_1fr] gap-12 pt-6 border-t border-border">
                    <div className="space-y-4">
                      <label className="text-[11px] font-black uppercase tracking-[2px] text-text-secondary">Segment Image</label>
                      <div className="group relative aspect-square rounded-2xl bg-[#2a2d30] border border-border overflow-hidden flex items-center justify-center cursor-pointer shadow-xl">
                        {segment.thumbnail ? (
                          <>
                            <img src={segment.thumbnail} className="w-full h-full object-cover" alt="Segment Thumbnail" />
                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <span className="text-[10px] font-bold text-[#f2e7d5] uppercase tracking-widest">Change Image</span>
                            </div>
                          </>
                        ) : (
                          <div className="flex flex-col items-center gap-3 text-[#888a8c] group-hover:text-[#f2e7d5] transition-colors">
                            <Plus size={24} />
                            <span className="text-[9px] font-bold uppercase tracking-widest">Add Thumbnail</span>
                          </div>
                        )}
                        <input 
                          type="file" 
                          accept="image/*" 
                          className="absolute inset-0 opacity-0 cursor-pointer" 
                          onChange={(e) => handleThumbnailUpload(segment.id, e)}
                        />
                      </div>
                      {segment.thumbnail && (
                        <button 
                          onClick={() => updateSegment(segment.id, { thumbnail: undefined })}
                          className="w-full py-2 text-[9px] font-bold text-red-400 uppercase tracking-widest hover:bg-red-400/10 rounded-lg transition-colors"
                        >
                          Remove Image
                        </button>
                      )}
                    </div>
                    
                    <div className="space-y-6">
                      <label className="text-[11px] font-black uppercase tracking-[2px] text-text-secondary">Segment Description / Content</label>
                      <textarea 
                        value={segment.content}
                        onChange={e => updateSegment(segment.id, { content: e.target.value })}
                        placeholder="Add some context or script notes for this segment..."
                        className="w-full h-32 bg-[#2a2d30] border border-border rounded-2xl p-6 text-sm text-[#f2e7d5]/80 outline-none focus:border-accent/50 transition-all resize-none shadow-inner"
                      />
                    </div>
                  </div>

                  {SCRIPTABLE_TYPES.includes(segment.type) ? (
                    <div className="space-y-12">
                      <div className="space-y-6 pt-6 border-t border-border">
                        <div className="flex items-center justify-between">
                          <label className="text-[11px] font-black uppercase tracking-[2px] text-text-secondary">Segment Audio Sequence</label>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => {
                                const originalSegment = show.segments.find(s => s.id === segment.id);
                                if (!originalSegment) return;
                                const newSegment: ShowSegment = {
                                  ...originalSegment,
                                  id: Math.random().toString(36).substr(2, 9),
                                  title: `${originalSegment.title} (Library)`,
                                  type: 'mix'
                                };
                                setShow(prev => ({
                                  ...prev,
                                  segments: [...prev.segments, newSegment]
                                }));
                                alert("Success: Segment added to global playlist (Mixes library).");
                              }}
                              disabled={!segment.audioSequence || segment.audioSequence.length === 0}
                              className="flex items-center gap-2 px-4 py-2 bg-[#2a2d30] border border-accent/30 text-accent hover:bg-accent hover:text-white rounded-lg transition-all text-[10px] font-bold uppercase tracking-widest disabled:opacity-30 active:scale-95"
                              title="Add to Global Mixes Library"
                            >
                              <Plus size={14} />
                              Add to Playlist
                            </button>
                            <label className="cursor-pointer flex items-center gap-2 px-4 py-2 bg-accent text-[#f2e7d5] hover:bg-white hover:text-black rounded-lg transition-all text-[10px] font-bold uppercase tracking-widest shadow-lg active:scale-95">
                              <Upload size={14} />
                              Upload Audio
                              <input type="file" multiple accept="audio/*" hidden onChange={(e) => handleFileUpload(segment.id, e)} />
                            </label>
                          </div>
                        </div>

                        <div className="bg-[#2a2d30]/50 border border-border rounded-2xl p-4 min-h-[200px] shadow-inner">
                          {(!segment.audioSequence || segment.audioSequence.length === 0) ? (
                            <div className="h-full flex flex-col items-center justify-center p-10 opacity-40">
                              <Music size={40} className="mb-4" />
                              <p className="text-sm font-medium mb-1">No audio uploaded yet.</p>
                              <p className="text-xs text-center max-w-sm">Upload files to build your sequence for this segment. You can drag and drop to reorder them once uploaded.</p>
                            </div>
                          ) : (
                            <Reorder.Group
                              axis="y"
                              values={segment.audioSequence}
                              onReorder={(newSeq) => updateSegment(segment.id, { audioSequence: newSeq })}
                              className="space-y-2"
                            >
                              {segment.audioSequence.map((track) => (
                                <Reorder.Item
                                  key={track.id}
                                  value={track}
                                  className="flex items-center gap-4 p-4 rounded-2xl bg-[#1e2022] border border-white/[0.03] hover:border-accent/30 group cursor-grab active:cursor-grabbing transition-all shadow-md"
                                >
                                  <div className="text-white/20">
                                    <GripVertical size={16} />
                                  </div>
                                  <button 
                                    onClick={() => toggleTrackPreview(track, segment.id)}
                                    className="w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-full bg-accent text-white hover:bg-white hover:text-accent transition-colors shadow-lg"
                                  >
                                    {playingTrackId === track.id ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" className="ml-1" />}
                                  </button>
                                  <div className="flex-1 min-w-0 pr-4">
                                    <p className="text-sm font-bold truncate tracking-tight">{track.name}</p>
                                    {playingTrackId === track.id && (
                                      <div className="flex flex-col gap-2 mt-2 max-w-md">
                                        <input 
                                          type="range"
                                          min={0}
                                          max={audioPlayer?.duration || 100}
                                          value={currentTime}
                                          onChange={handleSeek}
                                          className="w-full accent-accent bg-white/10 h-1.5 rounded-full appearance-none cursor-pointer"
                                        />
                                        <div className="flex items-center justify-between text-[10px] text-text-secondary font-mono">
                                          <span>{formatTime(Math.floor(currentTime))}</span>
                                          <span>{formatTime(Math.floor(audioPlayer?.duration || 0))}</span>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                  <button
                                    onClick={() => removeTrack(segment.id, track.id)}
                                    className="p-3 text-white/20 hover:text-red-400 hover:bg-red-400/10 rounded-xl transition-colors"
                                    title="Remove Track"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </Reorder.Item>
                              ))}
                            </Reorder.Group>
                          )}
                        </div>

                        {segment.audioSequence && segment.audioSequence.length > 0 && (
                          <div className="pt-4 flex flex-col gap-4">
                            <div className="flex items-center gap-4">
                              <button
                                onClick={() => toggleSegmentPreview(segment)}
                                className={`flex items-center gap-3 px-8 py-4 rounded-xl font-black uppercase tracking-widest text-xs transition-all shadow-xl active:scale-95
                                  ${playingSegmentId === segment.id && playlistRef.current
                                    ? 'bg-accent/20 text-accent border border-accent/50' 
                                    : 'bg-[#f2e7d5] text-black hover:bg-white border border-transparent shadow-xl shadow-[#f2e7d5]/5'
                                  }
                                `}
                              >
                                {playingSegmentId === segment.id && playlistRef.current ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
                                {playingSegmentId === segment.id && playlistRef.current ? 'Pause Sequence' : 'Play Full Sequence'}
                              </button>
                              {playingSegmentId === segment.id && playlistRef.current && playbackError && (
                                <div className="flex items-center gap-2 text-red-400 text-[10px] font-bold uppercase tracking-widest bg-red-400/10 px-4 py-2 rounded-xl border border-red-400/20">
                                  <AlertCircle size={12} />
                                  {playbackError}
                                </div>
                              )}
                            </div>

                            {playingSegmentId === segment.id && playlistRef.current && (
                              <div className="bg-surface/50 border border-border rounded-xl p-4 space-y-4">
                                {/* Overall Sequence Progress */}
                                <div>
                                  <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-[2px] text-text-secondary mb-2">
                                    <span>Overall Sequence Progress</span>
                                    <span>{formatTime(Math.floor((playlistRef.current.tracks.slice(0, playlistRef.current.currentIndex).reduce((acc, t) => acc + (t.duration || 180), 0) + currentTime)))} / {formatTime(Math.floor(playlistRef.current.tracks.reduce((acc, t) => acc + (t.duration || 180), 0)))}</span>
                                  </div>
                                  <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
                                    <div 
                                      className="bg-accent h-full transition-all duration-300 linear"
                                      style={{ width: `${Math.min(100, Math.max(0, ((playlistRef.current.tracks.slice(0, playlistRef.current.currentIndex).reduce((acc, t) => acc + (t.duration || 180), 0) + currentTime) / playlistRef.current.tracks.reduce((acc, t) => acc + (t.duration || 180), 0)) * 100))}%` }}
                                    />
                                  </div>
                                </div>

                                {/* Current Track Progress */}
                                <div className="border-t border-border pt-4">
                                  <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-[2px] text-accent mb-2">
                                    <span className="truncate pr-4">Playing: {playlistRef.current.tracks[playlistRef.current.currentIndex]?.name}</span>
                                    <span className="flex-shrink-0">{formatTime(Math.floor(currentTime))} / {formatTime(Math.floor(audioPlayer?.duration || 0))}</span>
                                  </div>
                                  <input 
                                    type="range"
                                    min={0}
                                    max={audioPlayer?.duration || 100}
                                    value={currentTime}
                                    onChange={handleSeek}
                                    className="w-full accent-accent bg-white/10 h-1.5 rounded-full appearance-none cursor-pointer"
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="max-w-2xl bg-[#2a2d30]/40 border border-border rounded-[32px] p-12 text-center space-y-8 shadow-2xl backdrop-blur-sm">
                      <div className={`w-24 h-24 rounded-full bg-accent/10 border-2 border-accent/20 flex items-center justify-center mx-auto text-accent shadow-inner`}>
                        {(() => {
                          const Icon = SEGMENT_TYPES.find(t => t.type === segment.type)?.icon || Mic;
                          return <Icon size={40} />;
                        })()}
                      </div>
                      <div className="space-y-4">
                        <h3 className="text-2xl font-black uppercase tracking-tighter">Media Asset Placeholder</h3>
                        <p className="text-[#8e95ab] text-sm leading-relaxed max-w-md mx-auto">
                          Upload the actual {segment.type} audio here when it's ready for broadcast. You can attach multiple files if needed for a sequence.
                        </p>
                      </div>

                      <div className="bg-[#0a0c14] border border-border rounded-xl p-6 text-left">
                        <div className="flex items-center justify-between mb-4">
                          <label className="text-[11px] font-black uppercase tracking-[2px] text-text-secondary">Assigned Audio</label>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => {
                                const originalSegment = show.segments.find(s => s.id === segment.id);
                                if (!originalSegment) return;
                                const newSegment: ShowSegment = {
                                  ...originalSegment,
                                  id: Math.random().toString(36).substr(2, 9),
                                  title: `${originalSegment.title} (Library)`,
                                  type: 'mix'
                                };
                                setShow(prev => ({
                                  ...prev,
                                  segments: [...prev.segments, newSegment]
                                }));
                                alert("Success: Segment added to global playlist (Mixes library).");
                              }}
                              disabled={!segment.audioSequence || segment.audioSequence.length === 0}
                              className="flex items-center gap-2 px-3 py-1.5 bg-[#12141c] border border-accent/20 text-accent hover:bg-accent hover:text-white rounded-lg transition-all text-[9px] font-bold uppercase tracking-widest disabled:opacity-30 active:scale-95"
                              title="Add to Global Mixes Library"
                            >
                              <Plus size={12} />
                              Add to Playlist
                            </button>
                            <label className="cursor-pointer flex items-center gap-2 px-3 py-1.5 bg-accent/10 text-accent hover:bg-accent hover:text-white rounded-lg transition-all text-[9px] font-bold uppercase tracking-widest">
                              <Upload size={12} />
                              Upload Audio
                              <input type="file" multiple accept="audio/*" hidden onChange={(e) => handleFileUpload(segment.id, e)} />
                            </label>
                          </div>
                        </div>
                        
                        {(!segment.audioSequence || segment.audioSequence.length === 0) ? (
                            <div className="h-full flex flex-col items-center justify-center py-8 opacity-40">
                              <Music size={24} className="mb-2" />
                              <p className="text-xs font-medium">Pending audio assignment.</p>
                            </div>
                        ) : (
                            <Reorder.Group
                              axis="y"
                              values={segment.audioSequence}
                              onReorder={(newSeq) => updateSegment(segment.id, { audioSequence: newSeq })}
                              className="space-y-2"
                            >
                              {segment.audioSequence.map((track) => (
                                <Reorder.Item
                                  key={track.id}
                                  value={track}
                                  className="flex items-center gap-3 p-3 rounded-xl bg-surface border border-white/5 hover:border-white/20 group cursor-grab active:cursor-grabbing transition-colors"
                                >
                                  <div className="text-white/20">
                                    <GripVertical size={14} />
                                  </div>
                                  <button 
                                    onClick={() => toggleTrackPreview(track, segment.id)}
                                    className="w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-full bg-accent text-white hover:bg-white hover:text-accent transition-colors shadow-lg"
                                  >
                                    {playingTrackId === track.id ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" className="ml-0.5" />}
                                  </button>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-bold truncate tracking-tight text-white mb-1">{track.name}</p>
                                    {playingTrackId === track.id && (
                                      <div className="flex flex-col gap-1 mt-1 max-w-xs">
                                        <input 
                                          type="range"
                                          min={0}
                                          max={audioPlayer?.duration || 100}
                                          value={currentTime}
                                          onChange={handleSeek}
                                          className="w-full accent-accent bg-white/10 h-1 rounded-full appearance-none cursor-pointer"
                                        />
                                        <div className="flex items-center justify-between text-[9px] text-text-secondary font-mono">
                                          <span>{formatTime(Math.floor(currentTime))}</span>
                                          <span>{formatTime(Math.floor(audioPlayer?.duration || 0))}</span>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                  <button
                                    onClick={() => removeTrack(segment.id, track.id)}
                                    className="p-2 text-white/20 hover:text-red-400 hover:bg-red-400/10 rounded-xl transition-colors"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </Reorder.Item>
                              ))}
                            </Reorder.Group>
                        )}
                        
                        {segment.audioSequence && segment.audioSequence.length > 0 && (
                          <div className="pt-4 flex flex-col gap-4 mt-2 border-t border-white/5">
                            <div className="flex items-center gap-4">
                              <button
                                onClick={() => toggleSegmentPreview(segment)}
                                className={`flex items-center gap-2 px-6 py-3 rounded-xl font-black uppercase tracking-widest text-[10px] transition-all shadow-lg active:scale-95
                                  ${playingSegmentId === segment.id && playlistRef.current
                                    ? 'bg-accent/20 text-accent border border-accent/50' 
                                    : 'bg-[#f2e7d5] text-black hover:bg-white border border-transparent'
                                  }
                                `}
                              >
                                {playingSegmentId === segment.id && playlistRef.current ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
                                {playingSegmentId === segment.id && playlistRef.current ? 'Pause' : 'Play Sequence'}
                              </button>
                              {playingSegmentId === segment.id && playlistRef.current && playbackError && (
                                <div className="flex items-center gap-1.5 text-red-400 text-[10px] font-bold uppercase tracking-widest bg-red-400/10 px-3 py-1.5 rounded-lg border border-red-400/20">
                                  <AlertCircle size={10} />
                                  {playbackError}
                                </div>
                              )}
                            </div>

                            {playingSegmentId === segment.id && playlistRef.current && (
                              <div className="bg-surface/50 border border-border rounded-xl p-4 space-y-4">
                                {/* Overall Sequence Progress */}
                                <div>
                                  <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-[2px] text-text-secondary mb-2">
                                    <span>Overall Sequence Progress</span>
                                    <span>{formatTime(Math.floor((playlistRef.current.tracks.slice(0, playlistRef.current.currentIndex).reduce((acc, t) => acc + (t.duration || 180), 0) + currentTime)))} / {formatTime(Math.floor(playlistRef.current.tracks.reduce((acc, t) => acc + (t.duration || 180), 0)))}</span>
                                  </div>
                                  <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
                                    <div 
                                      className="bg-accent h-full transition-all duration-300 linear"
                                      style={{ width: `${Math.min(100, Math.max(0, ((playlistRef.current.tracks.slice(0, playlistRef.current.currentIndex).reduce((acc, t) => acc + (t.duration || 180), 0) + currentTime) / playlistRef.current.tracks.reduce((acc, t) => acc + (t.duration || 180), 0)) * 100))}%` }}
                                    />
                                  </div>
                                </div>

                                {/* Current Track Progress */}
                                <div className="border-t border-border pt-4">
                                  <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-[2px] text-accent mb-2">
                                    <span className="truncate pr-4">Playing: {playlistRef.current.tracks[playlistRef.current.currentIndex]?.name}</span>
                                    <span className="flex-shrink-0">{formatTime(Math.floor(currentTime))} / {formatTime(Math.floor(audioPlayer?.duration || 0))}</span>
                                  </div>
                                  <input 
                                    type="range"
                                    min={0}
                                    max={audioPlayer?.duration || 100}
                                    value={currentTime}
                                    onChange={handleSeek}
                                    className="w-full accent-accent bg-white/10 h-1.5 rounded-full appearance-none cursor-pointer"
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </motion.div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center p-20 opacity-30">
              <Radio size={80} className="mb-8" />
              <h2 className="text-3xl font-black uppercase tracking-tighter mb-4 text-center">Your Broadcasting Studio</h2>
              <p className="max-w-md text-center text-lg font-medium tracking-tight">Select a segment from the timeline to edit or create a new one to begin building your full show.</p>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function ListIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="8" y1="6" x2="21" y2="6"></line>
      <line x1="8" y1="12" x2="21" y2="12"></line>
      <line x1="8" y1="18" x2="21" y2="18"></line>
      <line x1="3" y1="6" x2="3.01" y2="6"></line>
      <line x1="3" y1="12" x2="3.01" y2="12"></line>
      <line x1="3" y1="18" x2="3.01" y2="18"></line>
    </svg>
  );
}
