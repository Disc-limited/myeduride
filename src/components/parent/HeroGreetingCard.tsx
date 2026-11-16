'use client';

import { useState } from 'react';
import { CheckCircle2, ShieldCheck, Clock, Bus, Home, Building2 } from 'lucide-react';
import { formatTimeLagos } from '@/lib/timezone';
import { photoSrc } from '@/lib/photo';

interface Child {
  id: string;
  first_name: string;
  last_name: string;
  present_today?: boolean;
  arrival_time?: string | null;
  arrival_status?: string | null;
  in_the_bus?: boolean;
  in_transit?: boolean;
  on_afternoon_transit?: boolean;
  on_morning_transit?: boolean;
  is_weekend?: boolean;
}

interface HeroGreetingCardProps {
  userName: string;
  childrenList: Child[];
  onOpenSafetyConnect?: () => void;
  schoolInfo?: {
    id?: string;
    name?: string;
    logo_url?: string | null;
    primary_color?: string | null;
  } | null;
}

export default function HeroGreetingCard({
  userName,
  childrenList,
  onOpenSafetyConnect,
  schoolInfo,
}: HeroGreetingCardProps) {
  const [logoFailed, setLogoFailed] = useState(false);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  const hasKids = Boolean(childrenList && Array.isArray(childrenList) && childrenList.length > 0);
  const displayKids = hasKids ? childrenList : [];

  const kidsNames = displayKids.map((c) => c?.first_name || 'Child');
  const summaryText = hasKids
    ? kidsNames.length > 1
      ? `${kidsNames.slice(0, -1).join(', ')} and ${kidsNames[kidsNames.length - 1]} are linked to your live safety dashboard.`
      : `${kidsNames[0]} is linked to your live safety dashboard.`
    : 'Welcome to MyEduRide. Connect your child to monitor live school transit & safety.';

  const schoolLogoSrc = schoolInfo?.logo_url ? photoSrc(schoolInfo.logo_url) || schoolInfo.logo_url : null;
  const schoolInitials = (schoolInfo?.name || 'School')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');

  return (
    <div className="relative rounded-3xl overflow-hidden bg-slate-900 border border-slate-800 shadow-xl min-h-[220px] flex flex-col justify-between p-6 sm:p-8 text-white group h-full">
      {/* Background Graphic & Dark Gradient Overlay */}
      <div className="absolute inset-0 bg-gradient-to-r from-slate-950/90 via-slate-950/75 to-slate-900/40 z-10 pointer-events-none" />
      <div
        className="absolute inset-0 bg-cover bg-center opacity-45 group-hover:scale-105 transition-transform duration-700 pointer-events-none"
        style={{
          backgroundImage: "url('/images/student_carrying_backpack.png')",
        }}
      />

      {/* Main Content Header */}
      <div className="relative z-20 max-w-xl">
        {/* School Campus Platform Identification Banner */}
        {schoolInfo?.name && (
          <div className="mb-3 flex items-center flex-wrap gap-2">
            <div className="inline-flex items-center gap-2.5 bg-slate-950/70 hover:bg-slate-950/90 backdrop-blur-md border border-white/20 px-3 py-1.5 rounded-2xl shadow-md transition-all">
              <div className="w-7 h-7 rounded-xl bg-white p-0.5 flex items-center justify-center overflow-hidden shrink-0 shadow-xs border border-white/40">
                {schoolLogoSrc && !logoFailed ? (
                  <img
                    src={schoolLogoSrc}
                    alt={schoolInfo.name}
                    className="w-full h-full object-contain"
                    onError={() => setLogoFailed(true)}
                  />
                ) : (
                  <div className="w-full h-full rounded-lg bg-emerald-700 text-white flex items-center justify-center font-black text-[10px]">
                    {schoolInitials || <Building2 className="w-3.5 h-3.5 text-white" />}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs sm:text-sm font-extrabold text-white tracking-tight truncate max-w-[200px] sm:max-w-xs">
                  {schoolInfo.name}
                </span>
                <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-500 text-white tracking-wider shadow-xs">
                  School Platform
                </span>
              </div>
            </div>
          </div>
        )}

        <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white leading-tight">
          {getGreeting()},{' '}
          <span className="bg-gradient-to-r from-white via-slate-100 to-slate-200 bg-clip-text text-transparent">
            {userName || 'Parent'}
          </span>{' '}
          👋
        </h1>
        <p className="text-xs sm:text-sm text-slate-300 mt-2 leading-relaxed font-semibold">
          {summaryText}
        </p>
      </div>

      {/* Live Status Badges Row */}
      <div className="relative z-20 mt-6 flex flex-wrap items-center gap-3">
        {displayKids.map((child, idx) => {
          const isCheckedIn = Boolean(child?.present_today);
          const isInBus = Boolean(
            child?.in_the_bus ||
            child?.in_transit ||
            child?.on_afternoon_transit ||
            child?.on_morning_transit
          );
          const todayDay = new Date().getDay();
          const isWeekend = Boolean(child?.is_weekend ?? (todayDay === 0 || todayDay === 6));

          let timeStr = '7:28 AM';
          if (child?.arrival_time) {
            try {
              timeStr = formatTimeLagos(child.arrival_time);
            } catch {
              timeStr = '7:28 AM';
            }
          }
          const isEven = idx % 2 === 0;

          return (
            <div
              key={child?.id || idx}
              className={`flex items-center gap-2.5 px-4 py-2 rounded-2xl text-xs font-bold backdrop-blur-md border shadow-md transition-all ${
                isCheckedIn
                  ? isEven
                    ? 'bg-white/95 border-emerald-300 text-slate-900'
                    : 'bg-white/95 border-indigo-300 text-slate-900'
                  : isInBus
                    ? 'bg-amber-950/80 border-amber-500/80 text-amber-200 animate-pulse'
                    : isWeekend
                      ? 'bg-emerald-950/80 border-emerald-600/70 text-emerald-200'
                      : 'bg-slate-900/80 border-slate-700 text-slate-400'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                  isCheckedIn
                    ? isEven ? 'bg-emerald-600 text-white' : 'bg-indigo-600 text-white'
                    : isInBus
                      ? 'bg-amber-500 text-white'
                      : isWeekend
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-700 text-slate-300'
                }`}
              >
                {isCheckedIn ? (
                  <CheckCircle2 className="w-3.5 h-3.5 stroke-[2.5]" />
                ) : isInBus ? (
                  <Bus className="w-3.5 h-3.5" />
                ) : isWeekend ? (
                  <Home className="w-3.5 h-3.5" />
                ) : (
                  <Clock className="w-3.5 h-3.5" />
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <span>
                  {isCheckedIn
                    ? `${child?.first_name || 'Child'} Arrived School`
                    : isInBus
                      ? `${child?.first_name || 'Child'} In the Bus`
                      : isWeekend
                        ? `${child?.first_name || 'Child'} At Home`
                        : `${child?.first_name || 'Child'} Not Checked In`}
                </span>
                {isCheckedIn && (
                  <span className="text-[10px] text-slate-500 font-mono font-normal">{timeStr}</span>
                )}
                {!isCheckedIn && isWeekend && (
                  <span className="text-[10px] text-emerald-400 font-semibold">(Weekend)</span>
                )}
                {!isCheckedIn && isInBus && (
                  <span className="text-[10px] text-amber-400 font-semibold">(Transit)</span>
                )}
              </div>
            </div>
          );
        })}

        {onOpenSafetyConnect && (
          <button
            type="button"
            onClick={onOpenSafetyConnect}
            className="flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black transition-all shadow-md active:scale-95 cursor-pointer border border-emerald-400/40 ml-auto"
          >
            <ShieldCheck className="w-4 h-4 text-white" />
            <span>Safety Connect Hub</span>
          </button>
        )}
      </div>
    </div>
  );
}
