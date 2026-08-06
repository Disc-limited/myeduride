'use client';

import { useState, useEffect } from 'react';
import { Search, Bell, Mail, Maximize2, ShieldCheck, Clock, User, ChevronDown, LogOut } from 'lucide-react';
import { getSession, logout } from '@/lib/api';

interface SuperAdminHeaderProps {
  onSearchChange?: (query: string) => void;
  searchQuery?: string;
}

export default function SuperAdminHeader({ onSearchChange, searchQuery = '' }: SuperAdminHeaderProps) {
  const [timeStr, setTimeStr] = useState('');
  const [dateStr, setDateStr] = useState('');
  const [userName, setUserName] = useState('Osatohanmwen O. Isaac');
  const [userTitle, setUserTitle] = useState('Founder / Super Administrator');

  useEffect(() => {
    // Update live clock
    const updateTime = () => {
      const now = new Date();
      setTimeStr(
        now.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        })
      );
      setDateStr(
        now.toLocaleDateString('en-GB', {
          weekday: 'short',
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        })
      );
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);

    // Fetch user details from session if available
    try {
      const session = getSession();
      if (session?.full_name) {
        setUserName(session.full_name);
      }
    } catch (e) {
      console.error(e);
    }

    return () => clearInterval(interval);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => console.error(err));
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch((err) => console.error(err));
      }
    }
  };

  return (
    <header className="bg-white border-b border-slate-200/80 sticky top-0 z-30 px-4 py-3 flex items-center justify-between gap-4 shadow-sm">
      {/* Left Title / Badge */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2.5 bg-emerald-50 text-emerald-800 border border-emerald-200/60 px-3 py-1.5 rounded-xl shadow-xs">
          <div className="w-7 h-7 rounded-lg bg-emerald-600 flex items-center justify-center text-white shrink-0 shadow-xs">
            <ShieldCheck size={18} />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="text-xs font-extrabold tracking-wide uppercase text-emerald-950">
                DISC COMMAND CENTRE
              </h1>
            </div>
            <p className="text-[10px] text-emerald-700 font-medium leading-none">
              DISC Super Administrator Dashboard
            </p>
          </div>
        </div>
      </div>

      {/* Middle Search Input */}
      <div className="flex-1 max-w-xl mx-2 hidden sm:block">
        <div className="relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange?.(e.target.value)}
            placeholder="Search anything (users, trips, invoices, schools...)"
            className="w-full bg-slate-100/80 border border-slate-200 rounded-xl pl-10 pr-10 py-2 text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:bg-white transition-all shadow-inner"
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center">
            <kbd className="hidden md:inline-flex items-center text-[10px] text-slate-400 font-mono bg-white border border-slate-200 px-1.5 py-0.5 rounded shadow-xs">
              ⌘K
            </kbd>
          </div>
        </div>
      </div>

      {/* Right Actions & Profile */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Live Time Pill */}
        <div className="hidden lg:flex items-center gap-2 bg-slate-50 border border-slate-200/80 px-3 py-1.5 rounded-xl">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
          <div className="text-[11px] leading-tight">
            <div className="flex items-center gap-1 font-bold text-slate-800">
              <Clock size={12} className="text-emerald-600" />
              <span>{timeStr || '07:32 AM'}</span>
            </div>
            <span className="text-[9px] text-slate-400 font-medium block">{dateStr || 'Mon, 26 May 2026'}</span>
          </div>
        </div>

        {/* Notification Bell */}
        <button
          type="button"
          className="relative p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
          title="Notifications"
        >
          <Bell size={18} />
          <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center shadow-xs">
            12
          </span>
        </button>

        {/* Mail / Messages */}
        <button
          type="button"
          className="relative p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
          title="Messages"
        >
          <Mail size={18} />
          <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-blue-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center shadow-xs">
            5
          </span>
        </button>

        {/* Fullscreen Toggle */}
        <button
          type="button"
          onClick={toggleFullscreen}
          className="hidden sm:flex p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
          title="Toggle Fullscreen"
        >
          <Maximize2 size={18} />
        </button>

        {/* Divider */}
        <div className="h-6 w-px bg-slate-200 mx-1 hidden sm:block" />

        {/* User Profile */}
        <div className="flex items-center gap-2.5 pl-1 cursor-pointer group">
          <div className="relative">
            <div className="w-8 h-8 rounded-full ring-2 ring-emerald-500/30 overflow-hidden bg-slate-800 flex items-center justify-center text-white font-semibold text-xs">
              <img
                src="/images/admin_avatar.png"
                alt="Admin Profile"
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
              <User size={16} />
            </div>
            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-white rounded-full" />
          </div>
          <div className="hidden xl:block text-left">
            <p className="text-xs font-bold text-slate-900 leading-none group-hover:text-emerald-700 transition-colors">
              {userName}
            </p>
            <p className="text-[10px] text-slate-500 font-medium leading-tight mt-0.5">
              {userTitle}
            </p>
          </div>
        </div>

        {/* Sign Out Button */}
        <button
          type="button"
          onClick={() => logout()}
          className="p-2 rounded-xl text-slate-500 hover:text-red-600 hover:bg-red-50 border border-transparent hover:border-red-100 transition-colors flex items-center gap-1.5 font-bold text-xs"
          title="Sign out"
          aria-label="Sign out"
        >
          <LogOut size={16} />
          <span className="hidden sm:inline">Logout</span>
        </button>
      </div>
    </header>
  );
}
