import React, { useEffect, useState, useMemo } from 'react';
import { useRadio, computeDailySchedule } from '../lib/RadioContext';
import { Play, Pause, Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import Logo from './Logo';

interface LandingPageProps {
  onLogin: () => void;
  onListen: () => void;
  isUserAuthenticated?: boolean;
}

export default function LandingPage({ onLogin, onListen, isUserAuthenticated }: LandingPageProps) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { activeEvent, allMixes, isPlaying, togglePlayPause, activeSession, allSchedules, radioShow, currentTime } = useRadio();
  const [selectedDay, setSelectedDay] = useState(new Date().getDay());
  const [viewMode, setViewMode] = useState<'timeline' | 'series'>('timeline');
  const [selectedSeriesId, setSelectedSeriesId] = useState<string | null>(null);

  const daySchedule = useMemo(() => {
    if (!allSchedules || allSchedules.length === 0 || !radioShow) return [];
    
    const targetDate = new Date(currentTime);
    const currentDay = targetDate.getDay();
    let diff = selectedDay - currentDay;
    targetDate.setDate(targetDate.getDate() + diff);
    
    const year = targetDate.getFullYear();
    const month = targetDate.getMonth();
    const monthData = allSchedules.find(s => s.year === year && s.monthIndex === month);
    
    if (!monthData) return [];
    return computeDailySchedule(monthData.entries, targetDate, radioShow);
  }, [allSchedules, radioShow, selectedDay, currentTime]);

  useEffect(() => {
    const scrollContainer = document.querySelector('.main-scroll-container');
    const handleScroll = () => {
      const scrollY = scrollContainer ? scrollContainer.scrollTop : window.scrollY;
      setScrolled(scrollY > 80);
      
      // Reveal animation logic
      const reveals = document.querySelectorAll('.reveal');
      reveals.forEach((el, i) => {
        const rect = el.getBoundingClientRect();
        const isVisible = rect.top < window.innerHeight - 50;
        if (isVisible) {
          setTimeout(() => el.classList.add('visible'), (i % 3) * 150);
        }
      });
    };

    if (scrollContainer) {
      scrollContainer.addEventListener('scroll', handleScroll);
    } else {
      window.addEventListener('scroll', handleScroll);
    }
    
    handleScroll(); // Initial check
    return () => {
      if (scrollContainer) {
        scrollContainer.removeEventListener('scroll', handleScroll);
      } else {
        window.removeEventListener('scroll', handleScroll);
      }
    };
  }, []);

  const toggleMobileMenu = () => setMobileMenuOpen(!mobileMenuOpen);

  return (
    <div className="landing-page-container bg-[#1e2022] text-[#f2e7d5] font-sans overflow-x-hidden selection:bg-accent selection:text-white">
      <style>{`
        .landing-page-container {
          --black: #1e2022;
          --dark: #1e2022;
          --card: #2a2d30;
          --border: #3a3d40;
          --border-hover: #5c191c;
          --accent: #a82329;
          --accent-muted: #5c191c;
          --cream: #f2e7d5;
          --glow: 0 4px 50px rgba(168, 35, 41, 0.1);
        }

        .hero-title .line1, .hero-title .line2 {
          font-weight: 800;
        }

        .reveal { 
          opacity: 0; 
          transform: translateY(20px); 
          transition: all 0.8s cubic-bezier(0.16, 1, 0.3, 1); 
        }
        .reveal.visible { 
          opacity: 1; 
          transform: translateY(0); 
        }

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(30px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .animate-fade-up {
          animation: fadeUp 1.2s cubic-bezier(0.16, 1, 0.3, 1) both;
        }

        .delay-150 { animation-delay: 0.1s; }
        .delay-300 { animation-delay: 0.2s; }
        .delay-450 { animation-delay: 0.3s; }
        .delay-600 { animation-delay: 0.4s; }

        .btn-brutal {
          position: relative;
          background: white;
          color: black;
          font-weight: 800;
          transition: all 0.2s ease;
        }
        .btn-brutal:hover {
          background: #cccccc;
          transform: translate(-2px, -2px);
          box-shadow: 4px 4px 0px rgba(255,255,255,0.2);
        }
        .btn-brutal:active {
          transform: translate(0, 0);
          box-shadow: 0px 0px 0px rgba(255,255,255,0);
        }
      `}</style>

      {/* NAV */}
      <nav 
        className={`fixed top-0 left-0 right-0 z-[100] flex items-center justify-between px-6 md:px-16 transition-all duration-400 ${
          scrolled 
            ? 'bg-[#1e2022]/95 backdrop-blur-2xl border-b border-white/5 py-4' 
            : 'bg-gradient-to-b from-[#1e2022]/80 to-transparent py-8'
        }`}
      >
        <a href="#" className="flex items-center gap-4 relative z-[2]">
          <Logo className="w-10 h-10" />
        </a>
        
        <ul className={`
          nav-links fixed md:relative top-full md:top-0 left-0 right-0 md:bg-transparent md:flex md:flex-row items-center gap-8 md:gap-12 p-8 md:p-0 transition-all duration-400 z-[2] font-mono
          ${mobileMenuOpen ? 'flex flex-col bg-[#1e2022]/98 border-b border-white/5' : 'hidden md:flex'}
        `}>
          {['About', 'Schedule', 'Vinyl', 'Contact'].map(item => (
            <li key={item}>
              <a 
                href={`#${item.toLowerCase()}`} 
                onClick={() => setMobileMenuOpen(false)}
                className="text-[10px] tracking-[0.2em] uppercase text-[#666666] hover:text-white transition-all font-bold"
              >
                {item}
              </a>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-6 relative z-[2]">
          <button 
            onClick={onListen}
            className="hidden md:block px-6 py-2 border border-accent text-accent text-[10px] tracking-[0.2em] uppercase hover:bg-accent hover:text-white transition-all font-bold"
          >
            Studio Live
          </button>
          <button 
            onClick={toggleMobileMenu}
            className="md:hidden text-white text-3xl leading-none"
          >
            {mobileMenuOpen ? '✕' : '☰'}
          </button>
        </div>
      </nav>

      {/* HERO */}
      <section id="hero" className="min-h-screen flex flex-col items-center justify-center text-center px-6 pt-32 pb-16 relative overflow-hidden bg-[#1e2022]">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1605648916319-cf082f7524a1?auto=format&fit=crop&w=1920&q=80')] bg-center bg-cover opacity-20 grayscale"></div>
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#1e2022]/40 to-[#1e2022]"></div>
        
        {activeEvent && (
          <div className="mb-12 flex items-center gap-3 px-4 py-1.5 bg-accent/5 border border-accent/20 rounded-sm animate-fade-up backdrop-blur-md">
            <div className="w-1.5 h-1.5 rounded-full bg-accent pulse-dot"></div>
            <span className="text-[10px] uppercase tracking-[4px] font-black text-accent">Live Broadcast</span>
            <span className="text-[10px] font-medium text-[#666666] uppercase tracking-widest ml-2">{activeEvent.show}</span>
          </div>
        )}

        <div className="hero-title relative z-[1]">
          <h1 className="flex flex-col gap-0 leading-[0.85] font-extrabold tracking-[-0.04em] uppercase">
            <span className="block text-[clamp(4.5rem,15vw,15rem)] text-accent line1 animate-fade-up">Non-Club</span>
            <span className="block text-[clamp(4.5rem,15vw,15rem)] text-accent line2 animate-fade-up delay-150">Radio</span>
          </h1>
        </div>

        <p className="mt-12 text-[12px] text-[#666666] uppercase font-bold tracking-[0.4em] max-w-[600px] leading-relaxed animate-fade-up delay-300 relative z-[1]">
          Vinyl Store — DJ Studio — Curated Soundscapes — Studio Exports
        </p>

        <div className="mt-16 flex gap-6 flex-wrap justify-center animate-fade-up delay-450 relative z-[1]">
          <button 
            onClick={togglePlayPause}
            disabled={!activeSession}
            className={`px-12 py-5 tracking-[0.2em] uppercase text-[11px] rounded-sm transition-all flex items-center gap-3 border font-bold
              ${isPlaying ? 'bg-white border-white text-black' : 'bg-accent border-accent text-white hover:bg-transparent hover:text-accent'}
            `}
          >
            {isPlaying ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
            {isPlaying ? 'Disconnect' : 'Connect Broadcast'}
          </button>
          <button 
            onClick={() => {
              const el = document.getElementById('schedule');
              if (el) el.scrollIntoView({ behavior: 'smooth' });
            }}
            className="px-12 py-5 bg-transparent text-white border border-white/20 font-bold tracking-[0.2em] uppercase text-[11px] rounded-sm hover:border-white transition-all flex items-center gap-3"
          >
            <CalendarIcon size={14} />
            Radio Schedule
          </button>
        </div>

        <div className="mt-32 flex gap-x-24 gap-y-12 flex-wrap justify-center animate-fade-up delay-600 relative z-[1] pt-12 border-t border-white/5 w-4/5 max-w-[1000px] font-mono">
          <div className="text-center group">
            <div className="text-4xl text-[#f2e7d5] font-bold tracking-tight mb-1">01.</div>
            <div className="text-[9px] text-[#888a8c] uppercase tracking-[0.3em] font-bold">24/7 Digital Hub</div>
          </div>
          <div className="text-center group">
            <div className="text-4xl text-[#f2e7d5] font-bold tracking-tight mb-1">02.</div>
            <div className="text-[9px] text-[#888a8c] uppercase tracking-[0.3em] font-bold">Analog Mastery</div>
          </div>
          <div className="text-center group">
            <div className="text-4xl text-[#f2e7d5] font-bold tracking-tight mb-1">03.</div>
            <div className="text-[9px] text-[#888a8c] uppercase tracking-[0.3em] font-bold">Global Presence</div>
          </div>
          <div className="text-center group">
            <div className="text-4xl text-[#f2e7d5] font-bold tracking-tight mb-1">04.</div>
            <div className="text-[9px] text-[#888a8c] uppercase tracking-[0.3em] font-bold">Curated Vinyl</div>
          </div>
        </div>
      </section>

      {/* SCHEDULE */}
      <section id="schedule" className="py-24 px-6 md:px-16 bg-[#1e2022] relative z-[1] border-t border-white/5">
        <div className="max-w-[1400px] mx-auto flex flex-col gap-12">
          
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-8 pb-12 border-b border-white/10 reveal">
            <div>
              <h2 className="font-extrabold text-5xl md:text-8xl text-[#f2e7d5] tracking-tighter uppercase leading-none mb-4">Radio Schedule</h2>
              <div className="flex gap-8 mt-6">
                <button 
                  onClick={() => setViewMode('timeline')}
                  className={`text-[10px] font-black uppercase tracking-[0.3em] transition-all pb-2 border-b-2 ${viewMode === 'timeline' ? 'border-accent text-white' : 'border-transparent text-white/30 hover:text-white'}`}
                >
                  Timeline
                </button>
                <button 
                  onClick={() => {
                    setViewMode('series');
                    setSelectedSeriesId(null);
                  }}
                  className={`text-[10px] font-black uppercase tracking-[0.3em] transition-all pb-2 border-b-2 ${viewMode === 'series' ? 'border-accent text-white' : 'border-transparent text-white/30 hover:text-white'}`}
                >
                  Series
                </button>
              </div>
            </div>
            <button 
              onClick={onListen}
              className="px-10 py-5 bg-[#FFB800] text-black text-[12px] font-black tracking-[0.2em] uppercase rounded-sm hover:bg-white transition-all shadow-[0_0_30px_rgba(255,184,0,0.2)] active:scale-95"
            >
              Jump to On Air Now
            </button>
          </div>

          <div className="reveal border border-white/10 bg-[#1e2022]">
            {viewMode === 'timeline' ? (
              <>
                {/* Day Selector */}
                <div className="flex items-stretch border-b border-white/10 bg-[#2a2d30]/30 overflow-x-auto no-scrollbar">
                  <button 
                    onClick={() => setSelectedDay(prev => (prev - 1 + 7) % 7)}
                    className="px-6 py-6 border-r border-white/10 text-white/40 hover:text-white transition-all bg-[#2a2d30]/20"
                  >
                    <ChevronLeft size={24} />
                  </button>
                  
                  {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((day, i) => (
                    <button 
                      key={day}
                      onClick={() => setSelectedDay(i)}
                      className={`flex-1 min-w-[140px] py-8 px-6 text-[10px] font-black uppercase tracking-[0.3em] transition-all border-r border-white/10 last:border-r-0
                        ${selectedDay === i ? 'bg-white/5 text-white' : 'text-white/30 hover:text-white hover:bg-white/[0.02]'}
                      `}
                    >
                      {day}
                    </button>
                  ))}

                  <button 
                    onClick={() => setSelectedDay(prev => (prev + 1) % 7)}
                    className="px-6 py-6 border-l border-white/10 text-white/40 hover:text-white transition-all bg-[#2a2d30]/20"
                  >
                    <ChevronRight size={24} />
                  </button>
                </div>

                {/* List */}
                <div className="divide-y divide-white/10">
                  {daySchedule.length > 0 ? daySchedule.map((item, idx) => {
                    const session = radioShow?.sessions.find(s => item.sessionId ? s.id === item.sessionId : s.title === item.show);
                    const firstSegId = session?.segmentIds[0];
                    const segment = radioShow?.segments.find(s => s.id === firstSegId);
                    const thumbnail = segment?.thumbnail;

                    return (
                      <div key={`${item.id}-${idx}`} className="flex flex-col md:flex-row items-stretch group hover:bg-white/[0.02] transition-colors">
                        <div className="md:w-40 p-8 border-r border-white/10 flex flex-col items-center justify-start gap-4">
                          <span className="text-[12px] font-mono text-[#888a8c] tabular-nums tracking-widest">{item.time} GMT</span>
                          <div className="w-px h-12 bg-white/10 group-hover:bg-accent/40 transition-colors"></div>
                        </div>
                        
                        <div className="flex-1 p-8 flex flex-col md:flex-row gap-10 items-start">
                          <div className="w-56 h-36 bg-[#2a2d30] border border-white/10 rounded-sm overflow-hidden relative shrink-0 group-hover:border-accent/30 transition-all shadow-xl">
                            {thumbnail ? (
                              <img src={thumbnail} className="w-full h-full object-cover grayscale opacity-60 group-hover:opacity-100 group-hover:grayscale-0 transition-all duration-700" alt={item.show} />
                            ) : (
                              <div className="w-full h-full p-6 flex flex-col items-center justify-center opacity-20 group-hover:opacity-40 transition-all">
                                 <Logo className="w-16 h-16 mb-2" />
                                 <div className="text-[8px] font-black tracking-widest uppercase opacity-40">NR-ST / SCHED</div>
                              </div>
                            )}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                          </div>

                          <div className="flex-1 pt-2">
                            {item.show.includes(' — ') && (
                              <div className="text-[10px] font-black uppercase tracking-[0.3em] text-accent mb-2">
                                 {item.show.split(' — ')[0]}
                              </div>
                            )}
                            <h3 className="text-2xl md:text-4xl font-extrabold text-[#f2e7d5] uppercase tracking-tighter mb-4 group-hover:text-accent transition-all cursor-pointer inline-block border-b border-transparent hover:border-accent">
                              {item.show.includes(' — ') ? item.show.split(' — ')[1] : item.show}
                            </h3>
                            <p className="text-xs text-[#888a8c] uppercase font-bold tracking-[0.2em] leading-relaxed max-w-2xl mb-6">
                              {item.focus || "Daily curated soundscapes and analog explorations from the Non-Club studio."}
                            </p>
                            
                            <div className="flex items-center gap-3">
                              <span className="text-[9px] text-white/20 uppercase tracking-[0.3em] font-black">Supported By</span>
                              <div className="flex items-center gap-2 px-2 py-1 bg-white/5 border border-white/5 rounded-sm">
                                 <div className="w-3 h-3 border border-white/20 flex items-center justify-center">
                                   <div className="w-1 h-1 bg-white/40"></div>
                                 </div>
                                 <span className="text-[9px] text-[#f2e7d5]/60 uppercase tracking-[0.3em] font-black">Non-Club Radio Collective</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  }) : (
                    <div className="p-32 text-center">
                       <p className="text-xs text-[#888a8c] uppercase font-bold tracking-[0.4em] animate-pulse">No programming scheduled for this rotation.</p>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="p-8">
                {!selectedSeriesId ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {radioShow?.programShows && radioShow.programShows.length > 0 ? (
                      radioShow.programShows.map(series => {
                        const episodes = radioShow.sessions.filter(s => s.showId === series.id);
                        return (
                          <div 
                            key={series.id}
                            onClick={() => setSelectedSeriesId(series.id)}
                            className="group cursor-pointer bg-[#2a2d30]/30 border border-white/5 p-8 hover:bg-white/[0.03] hover:border-white/10 transition-all"
                          >
                            <div className="w-full aspect-video bg-[#1e2022] border border-white/5 mb-6 overflow-hidden relative">
                              {series.thumbnail ? (
                                <img src={series.thumbnail} className="w-full h-full object-cover grayscale opacity-40 group-hover:opacity-100 group-hover:grayscale-0 transition-all duration-700" alt={series.title} />
                              ) : (
                                <div className="w-full h-full flex flex-col items-center justify-center opacity-10">
                                   <Logo className="w-16 h-16" />
                                </div>
                              )}
                              <div className="absolute top-4 left-4 px-3 py-1 bg-accent/20 border border-accent/30 text-accent text-[8px] font-black uppercase tracking-widest">
                                {episodes.length} EPISODES
                              </div>
                            </div>
                            <h3 className="text-xl font-bold text-[#f2e7d5] uppercase tracking-tight mb-2 group-hover:text-accent transition-colors">{series.title}</h3>
                            <p className="text-[10px] text-[#888a8c] uppercase font-bold tracking-widest leading-relaxed line-clamp-2">
                              {series.description || "Recurring series and specialized programming from the Non-Club audio lab."}
                            </p>
                          </div>
                        );
                      })
                    ) : (
                      <div className="col-span-full py-20 text-center">
                         <p className="text-xs text-[#888a8c] uppercase font-bold tracking-[0.4em]">No series library established yet.</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div>
                    <button 
                      onClick={() => setSelectedSeriesId(null)}
                      className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.3em] text-[#888a8c] hover:text-white mb-12 transition-colors group"
                    >
                      <ChevronLeft size={16} className="group-hover:-translate-x-1 transition-transform" /> Back to Series
                    </button>
                    
                    {(() => {
                      const series = radioShow?.programShows?.find(s => s.id === selectedSeriesId);
                      const episodes = radioShow?.sessions.filter(s => s.showId === selectedSeriesId) || [];
                      
                      return (
                        <div className="flex flex-col gap-12">
                          <div className="flex flex-col md:flex-row gap-12 items-start">
                             <div className="w-full md:w-80 aspect-square bg-[#2a2d30] border border-white/10 rounded-sm overflow-hidden shrink-0">
                                {series?.thumbnail ? <img src={series.thumbnail} className="w-full h-full object-cover grayscale opacity-60" alt={series.title} /> : <div className="w-full h-full p-12 opacity-10"><Logo /></div>}
                             </div>
                             <div className="flex-1">
                                <h1 className="text-4xl md:text-6xl font-extrabold text-[#f2e7d5] uppercase tracking-tighter mb-6">{series?.title}</h1>
                                <p className="text-sm text-[#888a8c] uppercase font-bold tracking-widest leading-relaxed max-w-2xl mb-8">
                                  {series?.description}
                                </p>
                                <div className="flex items-center gap-4 py-6 border-y border-white/5">
                                   <div className="text-[10px] text-white/40 uppercase font-black tracking-widest">NR-ST / CAT:00{radioShow?.programShows?.indexOf(series!) || 0}</div>
                                   <div className="w-1 h-1 bg-accent rounded-full"></div>
                                   <div className="text-[10px] text-white/40 uppercase font-black tracking-widest">{episodes.length} Recorded Episodes</div>
                                </div>
                             </div>
                          </div>

                          <div className="mt-12 divide-y divide-white/10 border border-white/10">
                            {episodes.map((ep, i) => {
                              const firstSeg = radioShow?.segments.find(s => s.id === ep.segmentIds[0]);
                              return (
                                <div key={ep.id} className="p-8 flex flex-col md:flex-row justify-between items-center group hover:bg-white/[0.02] transition-colors">
                                   <div className="flex flex-col md:flex-row items-center gap-10 flex-1">
                                      <div className="w-12 h-12 bg-white/5 text-[10px] font-black flex items-center justify-center text-[#888a8c] tabular-nums">
                                        {(i + 1).toString().padStart(2, '0')}
                                      </div>
                                      <div>
                                         <h4 className="text-xl font-bold text-[#f2e7d5] uppercase tracking-tight mb-1 group-hover:text-accent transition-colors">{ep.title}</h4>
                                         <div className="text-[9px] text-[#888a8c] uppercase font-bold tracking-widest">
                                           Recorded at Non-Club ST • {firstSeg?.duration ? `${Math.floor(firstSeg.duration / 60)} MINS` : 'DURATION VARIES'}
                                         </div>
                                      </div>
                                   </div>
                                   <button 
                                      onClick={onListen}
                                      className="mt-6 md:mt-0 px-6 py-3 bg-white/5 border border-white/10 text-white text-[9px] font-black uppercase tracking-widest hover:bg-accent hover:border-accent hover:text-white transition-all flex items-center gap-2"
                                   >
                                      Tune In
                                   </button>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* MIXES */}
      <section id="mixes" className="py-40 px-6 md:px-16 bg-[#1e2022] relative z-[1] border-t border-white/5">
        <div className="flex flex-col md:flex-row justify-between items-end mb-24 gap-8 reveal">
          <div className="max-w-2xl">
            <h2 className="font-extrabold text-5xl md:text-7xl text-[#f2e7d5] mb-6 tracking-tighter uppercase leading-none">Curated Sound</h2>
            <p className="text-[#888a8c] text-xs uppercase font-bold tracking-[0.3em]">Latest Studio Selections & Student Showcases.</p>
          </div>
          <button onClick={onListen} className="text-[#f2e7d5] text-[10px] font-bold uppercase tracking-[0.3em] underline underline-offset-8 decoration-[#f2e7d5]/20 hover:decoration-[#f2e7d5] transition-all">View Archive</button>
        </div>
        <div className="max-w-[1400px] mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-white/10 border border-white/10">
          {allMixes.length > 0 ? (
            allMixes.map(mix => (
              <div key={mix.id} className="bg-[#1e2022] p-12 flex flex-col gap-8 group hover:bg-accent transition-all duration-300 cursor-pointer">
                <div className="flex justify-between items-start">
                  <span className="text-[9px] text-[#888a8c] group-hover:text-[#f2e7d5] font-bold tracking-[0.3em] uppercase">Studio Mix</span>
                  <span className="text-[9px] text-[#888a8c] group-hover:text-[#f2e7d5] font-bold tracking-[0.2em] tabular-nums uppercase">
                    {Math.floor((mix.duration || 0) / 60)}:00
                  </span>
                </div>
                <h3 className="text-2xl text-[#f2e7d5] font-bold tracking-tight uppercase leading-tight">{mix.title}</h3>
                <div className="mt-auto flex items-center justify-between pt-8 border-t border-white/5 group-hover:border-black/10">
                  <button 
                    onClick={togglePlayPause}
                    className={`w-10 h-10 rounded-full flex items-center justify-center transition-all
                      ${isPlaying ? 'bg-[#1e2022] text-[#f2e7d5]' : 'bg-[#f2e7d5] text-black group-hover:bg-black group-hover:text-[#f2e7d5]'}
                    `}
                  >
                    {isPlaying ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" className="ml-0.5" />}
                  </button>
                  <span className="text-[9px] text-[#888a8c] group-hover:text-[#f2e7d5] tracking-[0.2em] uppercase font-bold opacity-0 group-hover:opacity-100 transition-opacity">Launch Stream</span>
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-full text-center py-24 bg-[#1e2022]">
              <p className="text-[#888a8c] text-[10px] uppercase tracking-[0.4em] font-bold animate-pulse">Syncing Archive...</p>
            </div>
          )}
        </div>
      </section>

      {/* PARTNER / STORE */}
      <section id="partners" className="py-40 px-6 md:px-16 bg-[#1e2022] relative z-[1] border-y border-white/5">
        <div className="max-w-[1200px] mx-auto flex flex-col md:flex-row gap-20 items-center reveal">
          <div className="w-full md:w-1/2">
            <div className="aspect-square bg-white/5 border border-white/10 flex items-center justify-center relative overflow-hidden group">
               <img src="https://images.unsplash.com/photo-1603048588665-791ca8aea617?auto=format&fit=crop&w=800&q=80" alt="Vinyl" className="w-full h-full object-cover grayscale opacity-40 group-hover:opacity-60 transition-opacity" />
               <div className="absolute inset-0 flex items-center justify-center">
                 <div className="w-32 h-32 rounded-full border border-[#f2e7d5]/20 flex items-center justify-center backdrop-blur-sm">
                   <span className="text-[#f2e7d5] font-bold tracking-[0.5em] uppercase text-xs">Vinyl</span>
                 </div>
               </div>
            </div>
          </div>
          <div className="w-full md:w-1/2">
            <h2 className="font-extrabold text-5xl md:text-7xl text-[#f2e7d5] mb-8 tracking-tighter uppercase leading-none">The Store</h2>
            <p className="text-[#888a8c] text-xs uppercase font-bold tracking-[0.3em] mb-8">Curated Selections. Worldwide Shipping.</p>
            <p className="text-[#888a8c] text-[13px] uppercase font-bold tracking-widest leading-relaxed mb-10">
              Our partner record store provides the foundation for our academy. Every record is handpicked to ensure the highest quality of sound and artistic integrity.
            </p>
            <a href="#" className="inline-block px-12 py-5 bg-[#f2e7d5] text-black font-bold tracking-[0.2em] uppercase text-[11px] rounded-sm hover:bg-white transition-all">
              Visit Mr. Vinyl
            </a>
          </div>
        </div>
      </section>

      {/* CONTACT */}
      <section id="contact" className="py-40 px-6 md:px-16 bg-[#1e2022] relative z-[1] border-t border-white/5">
        <div className="max-w-[1200px] mx-auto grid grid-cols-1 md:grid-cols-2 gap-24">
          <div className="reveal">
            <h2 className="font-extrabold text-5xl md:text-7xl text-[#f2e7d5] mb-8 tracking-tighter uppercase leading-none">Contact</h2>
            <p className="text-[#888a8c] text-[13px] uppercase font-bold tracking-widest leading-relaxed mb-12">
              For academy inquiries, private bookings, or vinyl distribution.
            </p>
            <div className="space-y-10">
              {[
                { label: 'E-Mail', val: 'OFFICE@NONCLUBRECORDS.COM' },
                { label: 'TEL', val: '+27 [0] 12 345 6789' },
                { label: 'INSTA', val: '@NONCLUBRECORDS' }
              ].map(item => (
                <div key={item.label} className="group">
                  <div className="text-[9px] text-[#888a8c] uppercase tracking-[0.3em] font-bold mb-2">{item.label}</div>
                  <div className="text-xl text-[#f2e7d5] font-bold tracking-tight hover:text-[#888a8c] transition-all cursor-pointer">{item.val}</div>
                </div>
              ))}
            </div>
          </div>
          
          <div className="bg-[#2a2d30] border border-white/10 p-12 reveal shadow-2xl">
            <h3 className="text-[10px] text-[#888a8c] font-bold tracking-[0.3em] uppercase mb-8">Transmission</h3>
            <form onSubmit={e => e.preventDefault()} className="space-y-8">
              <div className="space-y-2">
                <label className="text-[9px] text-[#888a8c] uppercase tracking-[0.2em] font-bold">Full Name</label>
                <input type="text" className="w-full bg-[#1e2022] border border-white/10 p-4 text-[#f2e7d5] text-xs font-bold uppercase tracking-widest outline-none focus:border-accent transition-all" />
              </div>
              <div className="space-y-2">
                <label className="text-[9px] text-[#888a8c] uppercase tracking-[0.2em] font-bold">Email Address</label>
                <input type="email" className="w-full bg-[#1e2022] border border-white/10 p-4 text-[#f2e7d5] text-xs font-bold uppercase tracking-widest outline-none focus:border-accent transition-all" />
              </div>
              <div className="space-y-2">
                <label className="text-[9px] text-[#888a8c] uppercase tracking-[0.2em] font-bold">Message Packet</label>
                <textarea className="w-full bg-[#1e2022] border border-white/10 p-4 text-[#f2e7d5] text-xs font-bold uppercase tracking-widest outline-none focus:border-accent transition-all min-h-[120px]" />
              </div>
              <button 
                type="submit"
                className="w-full py-5 bg-[#f2e7d5] text-black font-extrabold tracking-[0.3em] uppercase text-[10px] hover:bg-white transition-all shadow-lg active:scale-95"
              >
                Send Packet
              </button>
            </form>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-[#1e2022] border-t border-white/5 py-32 px-6 md:px-16 text-center">
        <div className="flex justify-center mb-8">
          <Logo className="w-24 h-24 opacity-60 hover:opacity-100 transition-opacity" />
        </div>
        <div className="text-[40px] font-extrabold tracking-[0.4em] text-[#f2e7d5] mb-4 uppercase leading-none opacity-20 text-glow">NON-CLUB RADIO</div>
        <div className="flex gap-12 justify-center flex-wrap mb-16 font-mono">
          {['About', 'Schedule', 'Vinyl', 'Contact'].map(link => (
            <a key={link} href={`#${link.toLowerCase()}`} className="text-[9px] text-[#888a8c] tracking-[0.3em] uppercase font-bold hover:text-[#f2e7d5] transition-all">
              {link}
            </a>
          ))}
          <button 
            onClick={onLogin}
            className="text-[9px] text-[#888a8c] tracking-[0.3em] uppercase font-bold hover:text-[#f2e7d5] transition-all"
          >
            {isUserAuthenticated ? 'Studio' : 'Master'}
          </button>
        </div>
        <div className="flex flex-col items-center gap-4">
           <div className="text-[9px] text-[#5c191c] tracking-[0.5em] font-bold uppercase">Vinyl Culture Preservation Society</div>
           <p className="text-[9px] text-[#5c191c] tracking-[0.1em] font-bold uppercase">© 2024 NON-CLUB RADIO. ALL TRANSMISSIONS LOGGED.</p>
        </div>
      </footer>
    </div>
  );
}
