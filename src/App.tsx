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
import { auth, loginWithGoogle, logout, loginWithEmail, registerWithEmail } from './lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { getStationTimezone, setStationTimezone, TIMEZONES } from './lib/timezone';
import { Mail, Lock, User as UserIcon, ArrowRight, Github } from 'lucide-react';

import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const [view, setView] = useState<AppView>('landing');
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [tz, setTz] = useState(getStationTimezone());
  const [showLogin, setShowLogin] = useState(false);
  
  // Email Auth State
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

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

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setIsAuthenticating(true);
    try {
      if (authMode === 'login') {
        await loginWithEmail(email, password);
      } else {
        await registerWithEmail(email, password);
      }
    } catch (err: any) {
      console.error("Auth error:", err);
      if (err.code === 'auth/operation-not-allowed') {
        setAuthError("Email/Password provider is not enabled in Firebase Console. Please enable it in Authentication > Sign-in method.");
      } else if (err.code === 'auth/popup-blocked') {
        setAuthError("Popup was blocked by your browser. Please allow popups or open the app in a new tab.");
      } else {
        setAuthError(err.message || "An authentication error occurred.");
      }
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleGoogleLogin = async () => {
    setAuthError(null);
    try {
      await loginWithGoogle();
    } catch (err: any) {
      console.error("Google auth error:", err);
      if (err.code === 'auth/popup-blocked' || err.code === 'auth/cancelled-popup-request') {
        setAuthError("The authentication popup was blocked or closed. Try opening the app in a new tab if this persists on Edge/Safari.");
      } else {
        setAuthError("Authentication failed. Please check your browser's third-party cookie settings.");
      }
    }
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
      <div className="min-h-screen bg-[#121212] text-white font-sans flex flex-col items-center justify-center relative overflow-hidden py-12 px-4">
        {/* Abstract background effects */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 -left-1/4 w-[500px] h-[500px] bg-accent/20 rounded-full blur-[100px] animate-pulse" />
          <div className="absolute bottom-1/4 -right-1/4 w-[500px] h-[500px] bg-accent/10 rounded-full blur-[100px] animate-pulse delay-700" />
        </div>
        
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="z-10 w-full max-w-md"
        >
          <div className="flex flex-col items-center text-center mb-8">
            <div className="mb-6 p-4 bg-white/5 rounded-3xl border border-white/10 shadow-2xl">
              <Logo className="w-16 h-16" />
            </div>
            <h1 className="text-3xl font-[950] tracking-[-1px] uppercase text-[#f2e7d5] mb-2">
              Station Access
            </h1>
            <p className="text-[#888a8c] text-[10px] font-black uppercase tracking-[3px]">
              Non-Club Radio Collective
            </p>
          </div>

          <div className="bg-[#1e2022] border border-white/5 rounded-[32px] p-8 shadow-2xl relative overflow-hidden backdrop-blur-sm">
            {/* Mode Switcher */}
            <div className="flex bg-black/20 p-1 rounded-2xl mb-8 border border-white/5">
              <button 
                onClick={() => { setAuthMode('login'); setAuthError(null); }}
                className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${authMode === 'login' ? 'bg-[#f2e7d5] text-black shadow-lg' : 'text-[#888a8c] hover:text-white'}`}
              >
                Login
              </button>
              <button 
                onClick={() => { setAuthMode('register'); setAuthError(null); }}
                className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${authMode === 'register' ? 'bg-[#f2e7d5] text-black shadow-lg' : 'text-[#888a8c] hover:text-white'}`}
              >
                Register
              </button>
            </div>

            <form onSubmit={handleEmailAuth} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase tracking-widest text-[#888a8c] ml-1">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" size={16} />
                  <input 
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="operator@non-club.radio"
                    className="w-full bg-black/40 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-sm font-medium focus:border-accent/50 outline-none transition-all placeholder:text-white/10"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase tracking-widest text-[#888a8c] ml-1">Secure Password</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" size={16} />
                  <input 
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-black/40 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-sm font-medium focus:border-accent/50 outline-none transition-all placeholder:text-white/10"
                  />
                </div>
              </div>

              {authError && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-[10px] font-bold text-red-400 uppercase tracking-widest">
                  {authError}
                </div>
              )}

              <button 
                disabled={isAuthenticating}
                type="submit"
                className="w-full py-5 bg-accent text-white hover:bg-accent/80 transition-all rounded-2xl font-black uppercase tracking-[3px] text-[10px] flex items-center justify-center gap-3 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none mt-2 shadow-xl shadow-accent/20"
              >
                {isAuthenticating ? 'Processing...' : (authMode === 'login' ? 'Authorize' : 'Join Collective')}
                {!isAuthenticating && <ArrowRight size={14} />}
              </button>
            </form>

            <div className="my-8 flex items-center gap-4 text-[#888a8c]">
              <div className="h-px flex-1 bg-white/5"></div>
              <span className="text-[9px] font-black uppercase tracking-widest">OR</span>
              <div className="h-px flex-1 bg-white/5"></div>
            </div>

            <button 
              onClick={handleGoogleLogin}
              className="w-full py-4 bg-white/5 hover:bg-white/10 border border-white/10 text-white transition-all rounded-2xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-3 active:scale-[0.98]"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Google Workspace
            </button>
          </div>
          
          <button 
            onClick={() => setShowLogin(false)}
            className="w-full text-center text-[10px] font-black uppercase tracking-widest text-[#888a8c] hover:text-white mt-8 transition-colors"
          >
            Back to Broadcast
          </button>
        </motion.div>
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
