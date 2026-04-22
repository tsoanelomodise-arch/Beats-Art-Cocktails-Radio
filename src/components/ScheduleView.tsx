import React, { useState, useMemo, useEffect } from 'react';
import { 
  Calendar as CalendarIcon, 
  Upload, 
  Loader2, 
  ChevronRight, 
  ChevronLeft, 
  AlertCircle, 
  Clock, 
  Plus, 
  Edit2, 
  Trash2, 
  Grid, 
  List as ListIcon, 
  X,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { MonthlySchedule, ScheduleEntry, ScheduleMode, RadioShow } from '../types';
import { computeDailySchedule } from '../lib/RadioContext';
import { GoogleGenAI, Type } from "@google/genai";
import { motion, AnimatePresence } from "motion/react";
import { 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  format, 
  isSameMonth, 
  isSameDay, 
  addMonths, 
  subMonths,
  addYears,
  subYears,
  getDay,
  parseISO
} from 'date-fns';
import { getCurrentTimeInTimezone, getStationTimezone } from '../lib/timezone';

const INITIAL_SCHEDULE: MonthlySchedule[] = [
  {
    year: 2025,
    monthIndex: 10, // November
    theme: "Finance Focus: Closing Strong",
    entries: [
      { id: '1', time: "06:00–09:00", startTime: 360, duration: 180, show: "Morning Hustle", focus: "News, traffic, motivation, funding updates", category: 'news', daysOfWeek: [1, 2, 3, 4, 5] },
      { id: '2', time: "09:00–12:00", startTime: 540, duration: 180, show: "Enterprise Unlocked", focus: "Interviews & business showcases", category: 'business', daysOfWeek: [1, 2, 3, 4, 5] },
      { id: '3', time: "12:00–15:00", startTime: 720, duration: 180, show: "Lunch & Learn", focus: "Masterclasses & skills", category: 'talk', daysOfWeek: [1, 2, 3, 4, 5] },
      { id: '4', time: "15:00–18:00", startTime: 900, duration: 180, show: "Drive to Thrive", focus: "On-air coaching & shoutouts", category: 'creative', daysOfWeek: [1, 2, 3, 4, 5] },
      { id: '5', time: "18:00–21:00", startTime: 1080, duration: 180, show: "Innovators’ Lounge", focus: "Youth, tech, creative industry", category: 'creative', daysOfWeek: [1, 2, 3, 4, 5] },
      { id: '6', time: "21:00–00:00", startTime: 1260, duration: 180, show: "TFM Sessions", focus: "Deep House & storytelling", category: 'music', daysOfWeek: [1, 2, 3, 4, 5, 0, 6] },
    ]
  }
];

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const DAYS_OF_WEEK = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

export default function ScheduleView({ tz = 'UTC' }: { tz?: string }) {
  const [schedules, setSchedules] = useState<MonthlySchedule[]>(() => {
    try {
      const stored = localStorage.getItem('transformation-radio-schedules');
      if (stored) return JSON.parse(stored);
    } catch (e) {
      console.error("Failed to load schedules from local storage", e);
    }
    return INITIAL_SCHEDULE;
  });
  const [currentDate, setCurrentDate] = useState(() => getCurrentTimeInTimezone(tz));
  const [mode, setMode] = useState<ScheduleMode>('list'); // Default to list view
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingShow, setEditingShow] = useState<ScheduleEntry | null>(null);
  const [editingYear, setEditingYear] = useState<number>(() => getCurrentTimeInTimezone(tz).getFullYear());
  const [editingMonth, setEditingMonth] = useState<number>(() => getCurrentTimeInTimezone(tz).getMonth());
  const [studioSessions, setStudioSessions] = useState<{id: string, title: string}[]>([]);
  const [fullShowData, setFullShowData] = useState<RadioShow | null>(null);

  // Sync schedules to localStorage when modified
  useEffect(() => {
    localStorage.setItem('transformation-radio-schedules', JSON.stringify(schedules));
  }, [schedules]);

  // Sync date when timezone changes
  useEffect(() => {
    setCurrentDate(getCurrentTimeInTimezone(tz));
  }, [tz]);

  useEffect(() => {
    try {
      const draft = localStorage.getItem('transformation-radio-draft');
      if (draft) {
        const parsed = JSON.parse(draft) as RadioShow;
        setFullShowData(parsed);
        if (parsed?.sessions) {
          setStudioSessions(parsed.sessions.map((s: any) => ({ id: s.id, title: s.title || 'Untitled Session' })));
        }
      }
    } catch (err) {
      console.error('Failed to load sessions', err);
    }
  }, []);

  const currentYear = currentDate.getFullYear();
  const currentMonthIndex = currentDate.getMonth();

  const currentMonthSchedule = useMemo(() => {
    return schedules.find(s => s.year === currentYear && s.monthIndex === currentMonthIndex) || {
      year: currentYear,
      monthIndex: currentMonthIndex,
      theme: "Theme not set",
      entries: []
    };
  }, [schedules, currentYear, currentMonthIndex]);

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);
    return eachDayOfInterval({ start: startDate, end: endDate });
  }, [currentDate]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      setError('Please upload a PDF file.');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64String = (reader.result as string).split(',')[1];
          resolve(base64String);
        };
        reader.readAsDataURL(file);
      });

      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
      if (!process.env.GEMINI_API_KEY) {
        throw new Error('Gemini API Key is missing.');
      }
      
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          {
            parts: [
              { text: "Extract the radio programming schedule from this PDF. For each entry, convert the time range into 'startTime' (minutes from midnight, e.g. 09:00 is 540) and 'duration' (minutes). Identify recurring days (0-6 where 0 is Sun) if possible. Return JSON mapping each month found to year, monthIndex (0-11), theme, and entries." },
              { inlineData: { mimeType: "application/pdf", data: base64 } }
            ]
          }
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                year: { type: Type.INTEGER },
                monthIndex: { type: Type.INTEGER },
                theme: { type: Type.STRING },
                entries: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      time: { type: Type.STRING },
                      show: { type: Type.STRING },
                      focus: { type: Type.STRING },
                      startTime: { type: Type.INTEGER },
                      duration: { type: Type.INTEGER },
                      daysOfWeek: { type: Type.ARRAY, items: { type: Type.INTEGER } },
                      specificDate: { type: Type.STRING },
                      category: { 
                        type: Type.STRING, 
                        enum: ['news', 'music', 'talk', 'business', 'creative'] 
                      }
                    },
                    required: ["time", "show", "focus", "startTime", "duration"]
                  }
                }
              },
              required: ["year", "monthIndex", "theme", "entries"]
            }
          }
        }
      });

      const newSCD = JSON.parse(response.text || '[]');
      if (newSCD.length > 0) {
        const withIds = newSCD.map((m: any) => ({
          ...m,
          entries: m.entries.map((e: any) => ({ ...e, id: Math.random().toString(36).substr(2, 9) }))
        }));
        setSchedules(prev => {
          // Merge or replace existing months
          const filtered = prev.filter(p => !withIds.some((n: any) => n.year === p.year && n.monthIndex === p.monthIndex));
          return [...filtered, ...withIds];
        });
      } else {
        setError('No schedule data found in PDF.');
      }
    } catch (err: any) {
      console.error(err);
      setError('AI Processing failed: ' + (err.message || 'Check API key.'));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUpdateShow = (updated: ScheduleEntry) => {
    setSchedules(prev => {
      // 1. Completely remove any existing version of this show (by ID) across ALL months
      // We use map to avoid mutating previous state objects
      let copy = prev.map(m => ({
        ...m,
        entries: m.entries.filter(e => e.id !== updated.id)
      }));
      
      // 2. Prepare the show data
      let timeStr = updated.time;
      if (updated.startTime != null && !isNaN(updated.startTime)) {
        const startH = Math.floor(updated.startTime / 60).toString().padStart(2, '0');
        const startM = (updated.startTime % 60).toString().padStart(2, '0');
        const duration = updated.duration || 60;
        const endH = Math.floor((updated.startTime + duration) / 60).toString().padStart(2, '0');
        const endM = ((updated.startTime + duration) % 60).toString().padStart(2, '0');
        timeStr = `${startH}:${startM}–${endH}:${endM}`;
      } else {
        timeStr = 'Auto-follow';
      }
      
      const showToStore = { 
        ...updated, 
        time: timeStr, 
        id: updated.id || Math.random().toString(36).substring(2, 11) 
      };

      // 3. Find target month or create it
      const targetMonthIdx = copy.findIndex(s => s.year === editingYear && s.monthIndex === editingMonth);
      
      if (targetMonthIdx === -1) {
        copy.push({ 
          year: editingYear, 
          monthIndex: editingMonth, 
          theme: "New Month", 
          entries: [showToStore] 
        });
      } else {
        copy[targetMonthIdx] = {
          ...copy[targetMonthIdx],
          entries: [...copy[targetMonthIdx].entries, showToStore]
        };
      }
      
      return copy;
    });

    // Automatically sync custom shows backwards into the Studio
    if (updated.show && !studioSessions.some(s => s.title === updated.show)) {
      const newSessionId = Math.random().toString(36).substr(2, 9);
      setStudioSessions(prev => [...prev, { id: newSessionId, title: updated.show }]);
      
      try {
        const draft = localStorage.getItem('transformation-radio-draft');
        if (draft) {
          const parsed = JSON.parse(draft) as RadioShow;
          if (parsed) {
            if (!parsed.sessions) parsed.sessions = [];
            parsed.sessions.push({
              id: newSessionId,
              title: updated.show,
              segmentIds: []
            });
            localStorage.setItem('transformation-radio-draft', JSON.stringify(parsed));
          }
        }
      } catch (err) {
        console.error('Failed to update draft sessions backward sync', err);
      }
    }

    setEditingShow(null);
  };

  const handleDeleteShow = (id: string) => {
    let deletedShowTitle: string | null = null;
    
    // Extract title before state mutation
    const month = schedules.find(s => s.year === currentYear && s.monthIndex === currentMonthIndex);
    if (month) {
      const showToDelete = month.entries.find(e => e.id === id);
      if (showToDelete) {
        deletedShowTitle = showToDelete.show;
      }
    }

    setSchedules(prev => {
      const copy = [...prev];
      const monthIndex = copy.findIndex(s => s.year === currentYear && s.monthIndex === currentMonthIndex);
      if (monthIndex !== -1) {
        const monthCopy = { ...copy[monthIndex] };
        monthCopy.entries = monthCopy.entries.filter(e => e.id !== id);
        copy[monthIndex] = monthCopy;
      }
      return copy;
    });

    if (deletedShowTitle) {
      // Remove from studio sessions dropdown in ScheduleView
      setStudioSessions(prev => prev.filter(s => s.title !== deletedShowTitle));
      
      // Remove from global draft to update Studio
      try {
        const draft = localStorage.getItem('transformation-radio-draft');
        if (draft) {
          const parsed = JSON.parse(draft) as RadioShow;
          if (parsed && parsed.sessions) {
            parsed.sessions = parsed.sessions.filter(s => s.title !== deletedShowTitle);
            localStorage.setItem('transformation-radio-draft', JSON.stringify(parsed));
          }
        }
      } catch (err) {
        console.error('Failed to update draft sessions', err);
      }
    }
  };

  const getDayEvents = (day: Date) => {
    return computeDailySchedule(currentMonthSchedule.entries, day);
  };

  const getComputedEntriesForWeekday = (dIdx: number) => {
    const filtered = currentMonthSchedule.entries.filter(e => e.daysOfWeek?.includes(dIdx) && !e.specificDate);
    const computed: ScheduleEntry[] = [];
    let currentEnd = 0;
    
    for (const e of filtered) {
       if (e.startTime !== undefined && e.startTime !== null && !isNaN(e.startTime)) {
          computed.push(e as ScheduleEntry);
          currentEnd = e.startTime + (e.duration || 0);
       } else {
          computed.push({ ...e, startTime: currentEnd } as ScheduleEntry);
          currentEnd = currentEnd + (e.duration || 0);
       }
    }
  
    return computed.sort((a, b) => (a.startTime as number) - (b.startTime as number));
  };

  const sortedEntries = useMemo(() => {
    const result: ScheduleEntry[] = [];
    const remaining = [...currentMonthSchedule.entries];
    
    // 1. Fixed times
    const fixed = remaining.filter(e => e.startTime != null && !isNaN(e.startTime))
      .sort((a, b) => (a.startTime as number) - (b.startTime as number));
      
    // 2. Build a dependency map
    const followersMap = new Map<string, ScheduleEntry[]>();
    const genericFollowers: ScheduleEntry[] = [];
    
    remaining.forEach(e => {
      if (e.startTime == null || isNaN(e.startTime)) {
        if (e.followsShowTitle) {
          const list = followersMap.get(e.followsShowTitle) || [];
          list.push(e);
          followersMap.set(e.followsShowTitle, list);
        } else {
          genericFollowers.push(e);
        }
      }
    });

    const insertFollowers = (predecessorName: string) => {
      const followers = followersMap.get(predecessorName);
      if (followers) {
        followers.forEach(f => {
          if (!result.find(r => r.id === f.id)) {
            result.push(f);
            insertFollowers(f.show);
          }
        });
      }
    };

    fixed.forEach(f => {
      if (!result.find(r => r.id === f.id)) {
        result.push(f);
        insertFollowers(f.show);
      }
    });
    
    genericFollowers.forEach(g => {
      if (!result.find(r => r.id === g.id)) {
        result.push(g);
        insertFollowers(g.show);
      }
    });

    // 3. Absolute Fallback: Ensure NO entry is lost due to complex dependency logic
    remaining.forEach(e => {
        if (!result.find(r => r.id === e.id)) {
            result.push(e);
        }
    });
    
    return result;
  }, [currentMonthSchedule.entries]);

  const allSessionTitles = useMemo(() => {
    const titles = new Set<string>();
    
    // 1. Studio Sessions (Live creations)
    studioSessions.forEach(s => { 
      if (s.title && !s.title.match(/^(Untitled Session|New Session|Default Session)/i)) {
        titles.add(s.title); 
      }
    });
    
    // 2. Currently Scheduled Entries (Relevant context)
    currentMonthSchedule.entries.forEach(e => {
       if (e.show && !e.show.match(/^(Untitled Session|New Session|Default Session)/i)) {
         titles.add(e.show);
       }
    });

    return Array.from(titles).sort();
  }, [studioSessions, currentMonthSchedule.entries]);

  return (
    <div className="flex flex-col h-full bg-[#050508] relative">
      {/* Header with Navigation */}
      <div className="p-10 pb-6 flex items-end justify-between border-b border-border bg-surface/10 backdrop-blur-md sticky top-0 z-30">
        <div className="flex flex-col">
          <div className="flex items-center gap-3 text-accent font-black text-[10px] uppercase tracking-[3px] mb-4">
            <Clock size={12} /> Live Station Programming
          </div>
          <div className="flex items-center gap-6">
            <div className="flex gap-2">
              <button 
                onClick={() => setCurrentDate(subYears(currentDate, 1))}
                className="w-8 h-8 flex items-center justify-center border border-border rounded-lg hover:border-accent transition-all hover:bg-accent/5"
                title="Previous Year"
              >
                <ChevronUp className="-rotate-90" size={16} />
                <ChevronUp className="-rotate-90 -ml-2" size={16} />
              </button>
              <button 
                onClick={() => setCurrentDate(subMonths(currentDate, 1))}
                className="w-8 h-8 flex items-center justify-center border border-border rounded-lg hover:border-accent transition-all hover:bg-accent/5"
                title="Previous Month"
              >
                <ChevronLeft size={16} />
              </button>
            </div>
            
            <h2 className="text-[54px] font-[900] tracking-[-2px] uppercase leading-none min-w-[340px] text-center">
              {format(currentDate, 'MMMM yyyy')}
            </h2>

            <div className="flex gap-2">
              <button 
                onClick={() => setCurrentDate(addMonths(currentDate, 1))}
                className="w-8 h-8 flex items-center justify-center border border-border rounded-lg hover:border-accent transition-all hover:bg-accent/5"
                title="Next Month"
              >
                <ChevronRight size={16} />
              </button>
              <button 
                onClick={() => setCurrentDate(addYears(currentDate, 1))}
                className="w-8 h-8 flex items-center justify-center border border-border rounded-lg hover:border-accent transition-all hover:bg-accent/5"
                title="Next Year"
              >
                <ChevronDown className="-rotate-90 -ml-2" size={16} />
                <ChevronDown className="-rotate-90" size={16} />
              </button>
            </div>
          </div>
          <p className="text-text-secondary font-medium tracking-wide mt-4 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-accent" />
            {currentMonthSchedule.theme}
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex bg-surface/40 p-1.5 rounded-2xl border border-border">
            <button 
              onClick={() => setMode('calendar')}
              className={`p-3 rounded-xl transition-all ${mode === 'calendar' ? 'bg-accent text-white shadow-lg' : 'text-text-secondary hover:text-white'}`}
              title="Month View"
            >
              <CalendarIcon size={18} />
            </button>
            <button 
              onClick={() => setMode('weekly')}
              className={`p-3 rounded-xl transition-all ${mode === 'weekly' ? 'bg-accent text-white shadow-lg' : 'text-text-secondary hover:text-white'}`}
              title="Week View"
            >
              <Grid size={18} />
            </button>
            <button 
              onClick={() => setMode('list')}
              className={`p-3 rounded-xl transition-all ${mode === 'list' ? 'bg-accent text-white shadow-lg' : 'text-text-secondary hover:text-white'}`}
              title="List View"
            >
              <ListIcon size={18} />
            </button>
          </div>
          
          <button 
            onClick={() => {
              setEditingYear(currentYear);
              setEditingMonth(currentMonthIndex);
              setEditingShow({ id: '', time: '09:00–10:00', startTime: 540, duration: 60, show: '', focus: 'Description', category: 'talk', daysOfWeek: [1,2,3,4,5] });
            }}
            className="flex items-center gap-3 px-6 py-4 bg-white text-black font-black rounded-xl hover:bg-neutral-200 transition-all active:scale-95 text-xs uppercase tracking-widest"
          >
            <Plus size={16} /> Add Session
          </button>

          <label className="flex items-center gap-3 px-6 py-4 bg-accent/10 border border-accent/30 text-accent font-black rounded-xl cursor-pointer hover:bg-accent hover:text-white transition-all active:scale-95 text-xs uppercase tracking-widest text center">
            {isProcessing ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
            Import PDF
            <input type="file" accept=".pdf" className="hidden" onChange={handleFileUpload} disabled={isProcessing} />
          </label>
        </div>
      </div>

      <div className="flex-1 overflow-hidden relative">
        <AnimatePresence mode="wait">
          {mode === 'calendar' ? (
            <motion.div 
              key="calendar"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.02 }}
              className="h-full p-10 pt-4 flex flex-col"
            >
              <div className="grid grid-cols-7 gap-1 mb-2">
                {DAYS_OF_WEEK.map(day => (
                  <div key={day} className="text-center text-[10px] font-black tracking-widest text-text-secondary p-2 uppercase">
                    {day}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 flex-1 border border-border rounded-3xl overflow-hidden bg-surface/5">
                {calendarDays.map((day, idx) => {
                  const events = getDayEvents(day);
                  const isCurrent = isSameMonth(day, currentDate);
                  return (
                    <div 
                      key={day.toISOString()} 
                      className={`min-h-[120px] p-2 border-r border-b border-white/[0.03] flex flex-col gap-1 hover:bg-white/[0.01] transition-colors
                        ${!isCurrent ? 'opacity-20 grayscale' : ''}
                        ${idx % 7 === 6 ? 'border-r-0' : ''}
                      `}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-xs font-bold font-mono ${isSameDay(day, getCurrentTimeInTimezone(tz)) ? 'text-accent bg-accent/10 px-1.5 py-0.5 rounded-md' : 'text-text-secondary opacity-60'}`}>
                          {format(day, 'd')}
                        </span>
                      </div>
                      <div className="flex flex-col gap-1 overflow-y-auto">
                        {events.map(event => (
                          <div 
                            key={`${day.toISOString()}-${event.id}`}
                            onClick={() => {
                              setEditingYear(currentYear);
                              setEditingMonth(currentMonthIndex);
                              setEditingShow(event);
                            }}
                            className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase truncate border cursor-pointer
                              ${event.category === 'news' ? 'bg-red-500/10 border-red-500/20 text-red-100' : 
                                event.category === 'business' ? 'bg-accent/10 border-accent/20 text-blue-100' :
                                event.category === 'music' ? 'bg-purple-500/10 border-purple-500/20 text-purple-100' :
                                'bg-surface/60 border-border text-white'}
                            `}
                            title={`${event.time}${event.followsShowTitle ? ` (Follows: ${event.followsShowTitle})` : ''}: ${event.show}`}
                          >
                            {event.show}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          ) : mode === 'weekly' ? (
            <motion.div 
              key="weekly"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="h-full overflow-y-auto p-10 pt-0"
            >
              <div className="grid grid-cols-[80px_1fr_1fr_1fr_1fr_1fr_1fr_1fr] border border-border rounded-3xl overflow-hidden bg-surface/5 min-w-[1200px]">
                <div className="border-r border-border bg-surface/20">
                  <div className="h-20 flex items-center justify-center border-b border-border italic text-[10px] text-text-secondary uppercase tracking-widest font-black">UTC</div>
                  {HOURS.map(h => (
                    <div key={h} className="h-32 p-4 text-[11px] font-mono text-text-secondary border-b border-white/[0.03] flex items-start justify-end">
                      {h.toString().padStart(2, '0')}:00
                    </div>
                  ))}
                </div>

                {DAYS_OF_WEEK.map((day, dIdx) => (
                  <div key={day} className={`relative border-r border-border last:border-0 ${dIdx % 7 === 0 || dIdx % 7 === 6 ? 'bg-accent/[0.02]' : ''}`}>
                    <div className="h-20 flex flex-col items-center justify-center border-b border-border bg-surface/10">
                      <span className="text-sm font-black tracking-widest">{day}</span>
                    </div>
                    <div className="relative h-[calc(24*128px)]">
                      {getComputedEntriesForWeekday(dIdx).map((show) => (
                        <motion.div 
                          key={`${day}-${show.id}`}
                          onClick={() => {
                            setEditingYear(currentYear);
                            setEditingMonth(currentMonthIndex);
                            setEditingShow(show);
                          }}
                          style={{
                            top: `${((show.startTime as number) / 1440) * 100}%`,
                            height: `${(show.duration / 1440) * 100}%`
                          }}
                          className={`absolute inset-x-1 border flex flex-col justify-start overflow-hidden cursor-pointer group transition-all hover:scale-[1.02] hover:z-10
                            ${show.duration <= 30 ? 'p-2 rounded-xl' : 'p-3 rounded-2xl'}
                            ${show.category === 'news' ? 'bg-red-500/10 border-red-500/20 text-red-100' : 
                              show.category === 'business' ? 'bg-accent/10 border-accent/20 text-blue-100' :
                              show.category === 'music' ? 'bg-purple-500/10 border-purple-500/20 text-purple-100' :
                              'bg-surface/60 border-border text-white'}
                          `}
                        >
                          <div className="flex flex-col gap-0.5">
                            <span className="text-[9px] font-black uppercase tracking-[1px] opacity-70 block truncate">
                              {show.time}
                              {show.followsShowTitle && (
                                <span className="ml-1 text-accent/80 font-bold">» {show.followsShowTitle}</span>
                              )}
                            </span>
                            <h4 className="font-black text-[10px] leading-tight line-clamp-2 uppercase tracking-tight">{show.show}</h4>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          ) : (
            <motion.div 
              key="list"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="p-10 h-full overflow-y-auto"
            >
              <div className="grid gap-4">
                {sortedEntries.map((entry) => (
                  <div key={entry.id} className="p-8 rounded-3xl bg-surface/20 border border-border flex items-center justify-between hover:bg-white/[0.02] transition-colors">
                    <div className="flex items-center gap-10">
                      <div className="w-48 flex flex-col gap-1">
                        <span className="text-accent font-mono text-sm tracking-tighter">
                          {entry.startTime === null ? (
                            <span className="flex flex-col">
                              <span className="text-[10px] text-text-secondary uppercase font-bold tracking-widest">Auto-follow</span>
                              {entry.followsShowTitle ? (
                                <span className="text-[9px] text-accent/70 italic truncate" title={`Follows ${entry.followsShowTitle}`}>
                                  {entry.followsShowTitle}
                                </span>
                              ) : (
                                <span className="text-[9px] text-accent/70 italic">Sequential</span>
                              )}
                            </span>
                          ) : entry.time}
                        </span>
                        <div className="flex gap-1">
                          {entry.daysOfWeek?.map(d => (
                            <span key={d} className="text-[8px] font-black px-1.5 py-0.5 rounded-sm bg-accent/10 text-accent/80">{DAYS_OF_WEEK[d].substring(0,1)}</span>
                          ))}
                        </div>
                      </div>
                      <div>
                        <h3 className="text-2xl font-black uppercase tracking-tight">{entry.show}</h3>
                        <p className="text-[#8e95ab] text-sm mt-1">{entry.focus}</p>
                      </div>
                    </div>
                    <div className="flex gap-4">
                      <button 
                        onClick={() => {
                          setEditingYear(currentYear);
                          setEditingMonth(currentMonthIndex);
                          setEditingShow(entry);
                        }} 
                        className="p-4 rounded-xl border border-border text-text-secondary hover:text-white transition-all"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button onClick={() => handleDeleteShow(entry.id)} className="p-4 rounded-xl border border-border text-text-secondary hover:text-red-400 transition-all">
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                ))}
                {currentMonthSchedule.entries.length === 0 && (
                  <div className="flex flex-col items-center justify-center p-32 border-2 border-dashed border-border rounded-3xl opacity-30">
                    <CalendarIcon size={48} className="mb-4" />
                    <p className="font-black uppercase tracking-widest text-sm">No programming set for this month</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {editingShow && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/80 backdrop-blur-xl animate-in fade-in duration-300">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-full max-w-xl bg-surface border border-white/10 rounded-[32px] p-10 shadow-3xl text-white"
          >
            <div className="flex items-center justify-between mb-10">
              <h2 className="text-3xl font-black uppercase tracking-tighter">
                {editingShow.id ? 'Edit Show' : 'Add Show'}
              </h2>
              <button onClick={() => setEditingShow(null)} className="p-2 hover:bg-white/5 rounded-full"><X /></button>
            </div>

            <div className="space-y-8 overflow-y-auto max-h-[70vh] p-1">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[11px] font-black uppercase tracking-widest text-[#8e95ab]">Month</label>
                  <div className="relative">
                    <select
                      className="w-full bg-[#1a1c26] border border-white/5 rounded-xl p-4 text-white outline-none focus:border-accent transition-all font-bold appearance-none px-4"
                      value={editingMonth}
                      onChange={e => setEditingMonth(Number(e.target.value))}
                    >
                      {Array.from({ length: 12 }, (_, i) => (
                        <option key={i} value={i}>{new Date(2000, i, 1).toLocaleString('default', { month: 'long' })}</option>
                      ))}
                    </select>
                    <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-text-secondary pointer-events-none" />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-black uppercase tracking-widest text-[#8e95ab]">Year</label>
                  <div className="relative">
                    <input
                      type="number"
                      className="w-full bg-[#1a1c26] border border-white/5 rounded-xl p-4 text-white outline-none focus:border-accent transition-all font-bold appearance-none px-4"
                      value={editingYear}
                      onChange={e => setEditingYear(Number(e.target.value))}
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[11px] font-black uppercase tracking-widest text-[#8e95ab]">Show Title</label>
                  <div className="relative">
                    <select 
                      className="w-full bg-[#1a1c26] border border-white/5 rounded-xl p-4 text-white outline-none focus:border-accent transition-all font-bold appearance-none" 
                      value={editingShow.show} 
                      onChange={e => {
                        const selectedTitle = e.target.value;
                        let newDuration = editingShow.duration;
                        
                        if (fullShowData) {
                          const session = fullShowData.sessions.find(s => s.title === selectedTitle);
                          if (session) {
                            const sessionSegments = session.segmentIds.map(id => fullShowData.segments.find(seg => seg.id === id)).filter(Boolean);
                            const totalSeconds = sessionSegments.reduce((acc, s) => acc + (s!.duration || 180), 0);
                            newDuration = Math.ceil(totalSeconds / 60);
                          }
                        }
                        
                        setEditingShow({...editingShow, show: selectedTitle, duration: newDuration});
                      }}
                    >
                      <option value="" disabled>Select a Show from Studio...</option>
                      {studioSessions.map((session) => (
                        <option key={session.id} value={session.title}>{session.title}</option>
                      ))}
                      {editingShow.show && !studioSessions.some(s => s.title === editingShow.show) && (
                        <option value={editingShow.show}>{editingShow.show} (Custom)</option>
                      )}
                    </select>
                    <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-text-secondary pointer-events-none" />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-black uppercase tracking-widest text-[#8e95ab]">Category</label>
                  <select className="w-full bg-[#1a1c26] border border-white/5 rounded-xl p-4 text-white outline-none focus:border-accent transition-all font-bold appearance-none px-4" value={editingShow.category || 'talk'} onChange={e => setEditingShow({...editingShow, category: e.target.value as any})}>
                    <option value="news">News & Updates</option>
                    <option value="business">Business & Tech</option>
                    <option value="music">Music & DJ Sets</option>
                    <option value="talk">Talk & Podcast</option>
                    <option value="creative">Creative Arts</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-black uppercase tracking-widest text-[#8e95ab]">Recurring Days</label>
                <div className="flex gap-2">
                  {DAYS_OF_WEEK.map((day, idx) => {
                    const active = editingShow.daysOfWeek?.includes(idx);
                    return (
                      <button
                        key={day}
                        onClick={() => {
                          const current = editingShow.daysOfWeek || [];
                          const next = active ? current.filter(d => d !== idx) : [...current, idx];
                          setEditingShow({...editingShow, daysOfWeek: next});
                        }}
                        className={`flex-1 py-3 rounded-lg text-[10px] font-black border transition-all ${active ? 'bg-accent border-accent text-white shadow-lg shadow-accent/20' : 'bg-white/5 border-white/5 text-text-secondary hover:text-white'}`}
                      >
                        {day.substring(0, 1)}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-black uppercase tracking-widest text-[#8e95ab]">Start Time</label>
                    <label className="text-[10px] font-bold text-text-secondary flex items-center gap-1 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={editingShow.startTime == null}
                        onChange={e => {
                           if (e.target.checked) setEditingShow({...editingShow, startTime: null, time: 'Auto', followsShowTitle: ''});
                           else setEditingShow({...editingShow, startTime: 0, time: '00:00', followsShowTitle: undefined});
                        }}
                        className="accent-accent"
                      />
                      Auto-follow
                    </label>
                  </div>
                  {editingShow.startTime == null ? (
                    <div className="space-y-1.5">
                      <div className="relative">
                        <select 
                          className="w-full bg-[#1a1c26] border border-white/5 rounded-xl p-4 text-white outline-none focus:border-accent transition-all font-bold appearance-none px-4"
                          value={editingShow.followsShowTitle || ''}
                          onChange={e => setEditingShow({...editingShow, followsShowTitle: e.target.value})}
                        >
                          <option value="">Chronological Flow</option>
                          {allSessionTitles.filter(title => title !== editingShow.show).map(title => (
                            <option key={title} value={title}>{title}</option>
                          ))}
                        </select>
                        <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-text-secondary pointer-events-none" />
                      </div>
                      <p className="text-[9px] font-bold text-text-secondary px-2 uppercase tracking-tighter opacity-70">
                        {editingShow.followsShowTitle ? `Follows the end of "${editingShow.followsShowTitle}"` : "Follows the end of whatever show is scheduled before it"}
                      </p>
                    </div>
                  ) : (
                    <input 
                      type="time" 
                      className="w-full bg-[#1a1c26] border border-white/5 rounded-xl p-4 text-white outline-none focus:border-accent transition-all font-bold appearance-none [color-scheme:dark]" 
                      value={isNaN(editingShow.startTime) ? '' : `${Math.floor(editingShow.startTime / 60).toString().padStart(2, '0')}:${(editingShow.startTime % 60).toString().padStart(2, '0')}`} 
                      onChange={e => {
                        if (e.target.value) {
                          const [h, m] = e.target.value.split(':').map(Number);
                          const mins = (h * 60) + m;
                          setEditingShow({...editingShow, startTime: mins, time: e.target.value});
                        }
                      }} 
                    />
                  )}
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-black uppercase tracking-widest text-[#8e95ab]">Duration (Derived Minutes)</label>
                  <div className="relative">
                    <input 
                      type="number" 
                      className="w-full bg-[#1a1c26]/50 border border-white/5 rounded-xl p-4 text-text-secondary outline-none font-bold" 
                      value={isNaN(editingShow.duration) ? '' : editingShow.duration} 
                      readOnly
                      title="Duration is automatically derived from the selected Studio Show's audio tracks"
                    />
                    <Clock size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/20" />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-black uppercase tracking-widest text-[#8e95ab]">Broadcast Focus</label>
                <textarea className="w-full h-24 bg-[#1a1c26] border border-white/5 rounded-xl p-4 text-white outline-none focus:border-accent transition-all font-medium resize-none text-sm" value={editingShow.focus} onChange={e => setEditingShow({...editingShow, focus: e.target.value})} />
              </div>

              <div className="flex items-center gap-4 pt-4">
                <button onClick={() => handleUpdateShow(editingShow)} className="flex-1 py-5 bg-accent text-white font-black rounded-2xl uppercase tracking-widest text-xs shadow-xl shadow-accent/20 hover:scale-[1.02] transition-all">Confirm Programming</button>
                <button onClick={() => setEditingShow(null)} className="px-10 py-5 bg-white/5 text-[#8e95ab] font-black rounded-2xl uppercase tracking-widest text-xs hover:text-white transition-all">Cancel</button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      </div>
  );
}
