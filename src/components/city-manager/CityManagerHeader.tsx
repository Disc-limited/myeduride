'use client';

import { useState, useEffect } from 'react';
import {
  Menu,
  Search,
  Sun,
  Clock,
  AlertOctagon,
  Bell,
  Mail,
  Maximize2,
  Minimize2,
  ChevronDown,
  Building2,
  ShieldCheck,
  User,
} from 'lucide-react';
import { getSession, logout } from '@/lib/api';
import { RoleSwitcher } from '@/components/shared/RoleSwitcher';

interface CityManagerHeaderProps {
  onMenuClick?: () => void;
  isFullSize?: boolean;
  onToggleFullSize?: () => void;
  selectedCity?: string;
  onCityChange?: (city: string) => void;
}

export function CityManagerHeader({
  onMenuClick,
  isFullSize = false,
  onToggleFullSize,
  selectedCity = 'LAGOS MAINLAND',
  onCityChange,
}: CityManagerHeaderProps) {
  const [timeStr, setTimeStr] = useState('');
  const [dateStr, setDateStr] = useState('');
  const [cityName, setCityName] = useState(selectedCity);
  const [cityDropdownOpen, setCityDropdownOpen] = useState(false);
  const [managerName, setManagerName] = useState('Adekule Samuel');
  const [managerCode, setManagerCode] = useState('CM-LAG-001');

  const availableCities = [
    'LAGOS MAINLAND',
    'LAGOS ISLAND / LEKKI',
    'ABUJA CENTRAL',
    'PORT HARCOURT',
    'IBADAN URBAN',
  ];

  useEffect(() => {
    const updateClock = () => {
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

    updateClock();
    const interval = setInterval(updateClock, 1000);

    try {
      const session = getSession();
      if (session?.full_name) {
        setManagerName(session.full_name);
      }
    } catch (e) {
      console.error(e);
    }

    return () => clearInterval(interval);
  }, []);

  return (
    <header className="sticky top-0 z-30 bg-[#07172b] text-white border-b border-slate-800/80 px-4 py-2.5 flex items-center justify-between gap-3 shadow-lg">
      {/* Left: Mobile Menu Toggle & Title Badge */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onMenuClick}
          className="lg:hidden p-2 rounded-xl text-slate-300 hover:bg-slate-800 transition-colors"
          aria-label="Toggle Navigation"
        >
          <Menu size={20} />
        </button>

        {/* City Command Centre Title Badge */}
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <div className="flex items-center gap-2 bg-[#0d233a] border border-slate-700/80 px-3 py-1.5 rounded-xl shadow-xs">
            <div className="w-7 h-7 rounded-lg bg-emerald-600 flex items-center justify-center text-white shrink-0 shadow-xs font-black text-xs">
              CM
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h1 className="text-xs font-black tracking-wider uppercase text-white truncate">
                  CITY MANAGER COMMAND CENTRE
                </h1>
              </div>

              {/* City Dropdown Selector */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setCityDropdownOpen(!cityDropdownOpen)}
                  className="flex items-center gap-1 text-[11px] font-extrabold text-emerald-400 hover:text-emerald-300 transition-colors"
                >
                  <span>{cityName}</span>
                  <ChevronDown size={12} />
                </button>

                {cityDropdownOpen && (
                  <div className="absolute top-full left-0 mt-1.5 w-52 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden py-1">
                    {availableCities.map((city) => (
                      <button
                        key={city}
                        type="button"
                        onClick={() => {
                          setCityName(city);
                          onCityChange?.(city);
                          setCityDropdownOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2 text-xs font-bold transition-colors ${
                          city === cityName
                            ? 'bg-emerald-600 text-white'
                            : 'text-slate-300 hover:bg-slate-800'
                        }`}
                      >
                        {city}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Center: Global Search */}
      <div className="flex-1 max-w-md mx-2 hidden md:block">
        <div className="relative">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search anything..."
            className="w-full bg-[#0d233a] border border-slate-700 rounded-xl pl-9 pr-4 py-1.5 text-xs font-semibold text-slate-200 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all shadow-inner"
          />
        </div>
      </div>

      {/* Right Controls & Profile */}
      <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
        {/* Weather Widget */}
        <div className="hidden xl:flex items-center gap-2 bg-[#0d233a] border border-slate-700/80 px-3 py-1.5 rounded-xl">
          <Sun size={18} className="text-amber-400 animate-pulse" />
          <div className="text-[11px] leading-tight">
            <span className="font-extrabold text-white block">29°C</span>
            <span className="text-[9px] text-slate-400 font-medium block">Partly Cloudy</span>
          </div>
        </div>

        {/* Live Clock Widget */}
        <div className="hidden lg:flex items-center gap-2 bg-[#0d233a] border border-slate-700/80 px-3 py-1.5 rounded-xl">
          <Clock size={15} className="text-emerald-400" />
          <div className="text-[11px] leading-tight">
            <span className="font-extrabold text-white block">{timeStr || '10:24:35 AM'}</span>
            <span className="text-[9px] text-slate-400 font-medium block">{dateStr || 'Wed, 14 May 2025'}</span>
          </div>
        </div>

        {/* Emergency SOS Button */}
        <button
          type="button"
          onClick={() => {
            alert('EMERGENCY SOS TRIGGERED — Dispatching City Safety Officers');
          }}
          className="px-3.5 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-black tracking-wider uppercase flex items-center gap-1.5 shadow-md shadow-red-950/50 animate-pulse transition-transform hover:scale-105 active:scale-95"
        >
          <AlertOctagon size={16} />
          <span className="hidden sm:inline">EMERGENCY SOS</span>
        </button>

        {/* Role Switcher */}
        <RoleSwitcher showLogout={false} />

        {/* Messages Badge */}
        <button
          type="button"
          className="relative p-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
          title="City Messages"
        >
          <Mail size={18} />
          <span className="absolute top-1 right-1 min-w-[16px] h-[16px] px-1 bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center border-2 border-[#07172b]">
            12
          </span>
        </button>

        {/* Notifications Badge */}
        <button
          type="button"
          className="relative p-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
          title="City Safety Alerts"
        >
          <Bell size={18} />
          <span className="absolute top-1 right-1 min-w-[16px] h-[16px] px-1 bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center border-2 border-[#07172b]">
            18
          </span>
        </button>

        {/* Full Size View Toggle */}
        {onToggleFullSize && (
          <button
            type="button"
            onClick={onToggleFullSize}
            className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 transition-colors hidden sm:block"
            title={isFullSize ? 'Exit Full Size View' : 'Expand Module to Full Size'}
          >
            {isFullSize ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          </button>
        )}

        {/* Profile Pill */}
        <div className="flex items-center gap-2 pl-1 cursor-pointer group">
          <div className="w-8 h-8 rounded-full bg-emerald-600 text-white font-black text-xs flex items-center justify-center ring-2 ring-emerald-500/40 shadow-xs">
            AS
          </div>
          <div className="hidden xl:block text-left">
            <span className="text-xs font-extrabold text-white block leading-tight group-hover:text-emerald-400 transition-colors">
              {managerName}
            </span>
            <span className="text-[10px] text-slate-400 font-semibold block leading-tight">
              City Manager · {managerCode}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
