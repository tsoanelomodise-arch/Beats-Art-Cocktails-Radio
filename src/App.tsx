import React, { useState, useEffect } from 'react';
import { Radio, Calendar, LogOut, RadioReceiver, Globe } from 'lucide-react';
import Logo from './components/Logo';
import { AppView } from './types';
import ScheduleView from './components/ScheduleView';
import ShowBuilder from './components/ShowBuilder';
import LiveView from './components/LiveView';
import LandingPage from './components/LandingPage';
import GlobalPlayer from './components/GlobalPlayer';
import { RadioProvider } from './lib/RadioContext';
import { auth, loginWithGoogle, logout } from './lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { getStationTimezone, setStationTimezone, TIMEZONES } from './lib/timezone';

import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const [view, setView] = useState<AppView>('landing');
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [tz, setTz] = useState(getStationTimezone());
  const [showLogin, setShowLogin] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthLoading(false);
      if (u) {
        setShowLogin(false);
        // Default to studio for admins
        setView('studio');
      }
    });
    return () => unsub();
  }, []);

  const handleTzChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newTz = e.target.value;
    setStationTimezone(newTz);
    setTz(newTz);
  };

  if (authLoading) {
    return (
      <div className="h-screen bg-bg text-white font-sans flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <Radio size={48} className="text-accent" />
          <div className="text-[10px] font-black uppercase tracking-[3px] text-text-secondary">Initiating Broadcast Systems...</div>
        </div>
      </div>
    );
  }

  // PUBLIC/AUTHENTICATED MIXED VIEWS
  if ((!user || view === 'landing') && !showLogin) {
    return (
      <RadioProvider tz={tz}>
        <div className="h-screen bg-bg flex flex-col overflow-hidden">
          <main className="flex-1 overflow-y-auto overflow-x-hidden main-scroll-container">
            {view === 'landing' ? (
              <LandingPage 
                onLogin={() => {
                  if (user) setView('studio');
                  else setShowLogin(true);
                }} 
                onListen={() => setView('live')} 
                isUserAuthenticated={!!user}
              />
            ) : (
              <div className="h-full flex flex-col">
                 <header className="h-[80px] px-6 md:px-10 flex items-center justify-between border-b border-border shrink-0 bg-surface/80 backdrop-blur-md z-50">
                  <button onClick={() => setView('landing')} className="text-2xl font-black tracking-[0.2em] uppercase text-white">
                    Non-Club Radio
                  </button>
                  <div className="flex items-center gap-4">
                     <button 
                      onClick={() => setShowLogin(true)}
                      className="text-[10px] font-black uppercase tracking-widest text-text-secondary hover:text-white"
                     >
                      Login
                     </button>
                  </div>
                 </header>
                 <div className="flex-1 overflow-hidden">
                   <LiveView tz={tz} />
                 </div>
              </div>
            )}
          </main>
          <GlobalPlayer />
        </div>
      </RadioProvider>
    );
  }

  // LOGIN INTERFACE
  if (showLogin && !user) {
    return (
      <div className="h-screen bg-bg text-white font-sans flex flex-col items-center justify-center relative overflow-hidden">
        {/* Background elements */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-accent/5 rounded-full blur-[120px] pointer-events-none" />
        
        <div className="z-10 flex flex-col items-center text-center max-w-md p-10 bg-[#2a2d30]/30 backdrop-blur-xl border border-white/10 rounded-[40px] shadow-2xl">
          <div className="mb-8">
            <Logo className="w-24 h-24" />
          </div>
          
          <h1 className="text-3xl font-[900] tracking-[-1.5px] uppercase text-[#f2e7d5] mb-2">
            Non-Club Radio Access
          </h1>
          <p className="text-[#888a8c] text-sm mb-10 leading-relaxed uppercase tracking-widest">
            Welcome to the Non-Club Radio master control system. You must authenticate to manage programming, studios, and schedules.
          </p>
          
          <div className="w-full flex flex-col gap-3">
            <button 
              onClick={loginWithGoogle}
              className="w-full py-5 bg-[#f2e7d5] text-black hover:bg-white transition-all rounded-2xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-3 active:scale-95 shadow-xl shadow-black/20"
            >
              Authenticate via Google
            </button>
            <button 
              onClick={() => setShowLogin(false)}
              className="text-[10px] font-black uppercase tracking-widest text-text-secondary hover:text-white mt-4"
            >
              Back to Website
            </button>
          </div>
        </div>
      </div>
    );
  }

  // AUTHENTICATED DASHBOARD
  return (
    <RadioProvider tz={tz}>
      <div className="h-screen bg-bg text-white font-sans flex flex-col overflow-hidden relative">
        {/* Universal Header */}
        <header className="h-[100px] px-10 flex items-center justify-between border-b border-border shrink-0 bg-surface/10 backdrop-blur-md z-50">
          <div className="flex items-center gap-10">
            <button 
              onClick={() => setView('landing')}
              className="group flex flex-col items-start"
            >
              <div className="text-[32px] font-[900] tracking-[0.2em] uppercase text-white group-hover:text-[#666666] transition-all">
                Non-Club Radio
              </div>
              <div className="text-[10px] font-black uppercase tracking-[2px] text-text-secondary opacity-0 group-hover:opacity-100 transition-all -mt-1">
                Return to Landing Page
              </div>
            </button>
            <nav className="flex items-center gap-2 bg-surface/50 p-1 rounded-xl border border-border">
              <div className="relative group">
                <button 
                  onClick={() => setView('studio')}
                  className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${view === 'studio' || view === 'schedule' ? 'bg-accent text-white shadow-lg shadow-accent/20' : 'text-text-secondary hover:text-white'}`}
                >
                  <Radio size={14} /> Studio
                </button>
                
                <div className="absolute top-full left-0 mt-2 w-48 bg-[#1e2022] border border-border rounded-xl shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-[60] flex flex-col p-1">
                  <button 
                    onClick={() => setView('studio')}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${view === 'studio' ? 'bg-white/10 text-white' : 'text-text-secondary hover:text-white hover:bg-white/5'}`}
                  >
                    <Radio size={12} /> Station Builder
                  </button>
                  <button 
                    onClick={() => setView('schedule')}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${view === 'schedule' ? 'bg-white/10 text-white' : 'text-text-secondary hover:text-white hover:bg-white/5'}`}
                  >
                    <Calendar size={12} /> Programming
                  </button>
                </div>
              </div>
              <button 
                onClick={() => setView('live')}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${view === 'live' ? 'bg-accent text-white shadow-lg shadow-accent/20' : 'text-text-secondary hover:text-accent'}`}
              >
                <RadioReceiver size={14} className={view === 'live' ? 'animate-pulse' : ''} /> ON AIR
              </button>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center bg-surface/50 border border-border rounded-xl px-3 py-2 mr-2">
              <Globe size={14} className="text-accent mr-2" />
              <select 
                value={tz} 
                onChange={handleTzChange}
                className="bg-transparent text-xs font-bold uppercase tracking-widest text-text-secondary outline-none cursor-pointer hover:text-white"
              >
                {TIMEZONES.map(t => (
                  <option key={t} value={t} className="bg-surface text-white">{t}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col items-end mr-2 max-w-[150px] md:max-w-[200px]">
              <span className="text-[10px] text-text-secondary uppercase tracking-widest font-bold">Authorized</span>
              <span className="text-xs font-bold truncate w-full text-right">{user.email}</span>
            </div>
            <div className="text-[10px] font-black uppercase tracking-[2px] px-3 py-1.5 bg-accent/10 text-[#f2e7d5] border border-accent/30 rounded">
              Broadcast Master
            </div>
            <button 
              onClick={logout}
              className="flex items-center gap-2 pl-3 pr-4 py-2 ml-2 rounded-xl border border-border text-text-secondary hover:text-red-400 hover:border-red-400/30 hover:bg-red-400/10 transition-all group"
              title="Terminate Session"
            >
              <LogOut size={16} className="group-hover:rotate-12 transition-transform" />
              <span className="text-[10px] font-black uppercase tracking-widest">Logout</span>
            </button>
          </div>
        </header>

        {/* Main View Container */}
        <main className="flex-1 overflow-hidden relative">
          <AnimatePresence mode="wait">
            <motion.div
              key={view}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
              className="h-full w-full"
            >
              {view === 'schedule' ? (
                <ScheduleView tz={tz} />
              ) : view === 'live' ? (
                <LiveView tz={tz} />
              ) : (
                <ShowBuilder />
              )}
            </motion.div>
          </AnimatePresence>
        </main>

        <GlobalPlayer />
      </div>
    </RadioProvider>
  );
}
