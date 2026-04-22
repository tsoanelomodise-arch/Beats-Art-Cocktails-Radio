import React, { useState, useEffect } from 'react';
import { Radio, Calendar, LogOut, Lock, RadioReceiver, Globe } from 'lucide-react';
import { AppView } from './types';
import ScheduleView from './components/ScheduleView';
import ShowBuilder from './components/ShowBuilder';
import LiveView from './components/LiveView';
import GlobalPlayer from './components/GlobalPlayer';
import { RadioProvider } from './lib/RadioContext';
import { auth, loginWithGoogle, logout } from './lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { getStationTimezone, setStationTimezone, TIMEZONES } from './lib/timezone';

import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const [view, setView] = useState<AppView>('studio');
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [tz, setTz] = useState(getStationTimezone());

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthLoading(false);
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

  if (!user) {
    return (
      <div className="h-screen bg-bg text-white font-sans flex flex-col items-center justify-center relative overflow-hidden">
        {/* Background elements */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-accent/5 rounded-full blur-[120px] pointer-events-none" />
        
        <div className="z-10 flex flex-col items-center text-center max-w-md p-10 bg-surface/30 backdrop-blur-xl border border-white/10 rounded-[40px] shadow-2xl">
          <div className="w-20 h-20 bg-accent/20 text-accent rounded-full flex items-center justify-center mb-8 border border-accent/20">
            <Lock size={32} />
          </div>
          
          <h1 className="text-3xl font-[900] tracking-[-1.5px] uppercase bg-gradient-to-r from-white to-neutral-400 bg-clip-text text-transparent mb-2">
            Managed Access
          </h1>
          <p className="text-[#8e95ab] text-sm mb-10 leading-relaxed">
            Welcome to the Beats, Art & Cocktails master control system. You must authenticate to manage programming, studios, and schedules.
          </p>
          
          <button 
            onClick={loginWithGoogle}
            className="w-full py-5 bg-white text-black hover:bg-neutral-200 transition-all rounded-2xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-3 active:scale-95 shadow-xl shadow-white/5"
          >
            Authenticate via Google
          </button>
        </div>
      </div>
    );
  }

  return (
    <RadioProvider tz={tz}>
      <div className="h-screen bg-bg text-white font-sans flex flex-col overflow-hidden relative">
        {/* Universal Header */}
        <header className="h-[100px] px-10 flex items-center justify-between border-b border-border shrink-0 bg-surface/10 backdrop-blur-md z-50">
          <div className="flex items-center gap-10">
            <div className="text-[32px] font-[900] tracking-[-1.5px] uppercase bg-gradient-to-r from-white to-neutral-500 bg-clip-text text-transparent">
              Beats, Art & Cocktails
            </div>
            <nav className="flex items-center gap-2 bg-surface/50 p-1 rounded-xl border border-border">
              <button 
                onClick={() => setView('studio')}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${view === 'studio' ? 'bg-accent text-white shadow-lg shadow-accent/20' : 'text-text-secondary hover:text-white'}`}
              >
                <Radio size={14} /> Studio
              </button>
              <button 
                onClick={() => setView('schedule')}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${view === 'schedule' ? 'bg-accent text-white shadow-lg shadow-accent/20' : 'text-text-secondary hover:text-white'}`}
              >
                <Calendar size={14} /> Schedule
              </button>
              <button 
                onClick={() => setView('live')}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${view === 'live' ? 'bg-red-500 text-white shadow-lg shadow-red-500/20' : 'text-text-secondary hover:text-red-400'}`}
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
            <div className="flex flex-col items-end mr-2">
              <span className="text-[10px] text-text-secondary uppercase tracking-widest font-bold">Authorized</span>
              <span className="text-xs font-bold">{user.email}</span>
            </div>
            <div className="text-[10px] font-black uppercase tracking-[2px] px-3 py-1.5 bg-accent/10 text-accent border border-accent/30 rounded">
              Broadcast Master
            </div>
            <button 
              onClick={logout}
              className="w-10 h-10 ml-2 rounded-xl flex items-center justify-center border border-border text-text-secondary hover:text-red-400 hover:border-red-400/30 hover:bg-red-400/10 transition-all"
              title="Terminate Session"
            >
              <LogOut size={16} />
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
