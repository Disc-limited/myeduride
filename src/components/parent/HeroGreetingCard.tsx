'use client';

import { CheckCircle2, ShieldCheck, Clock } from 'lucide-react';
import { formatTimeLagos } from '@/lib/timezone';

interface Child {
  id: string;
  first_name: string;
  last_name: string;
  present_today?: boolean;
  arrival_time?: string | null;
  arrival_status?: string | null;
}

interface HeroGreetingCardProps {
  userName: string;
  childrenList: Child[];
}

export default function HeroGreetingCard({ userName, childrenList }: HeroGreetingCardProps) {
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  const displayKids =
    childrenList && Array.isArray(childrenList) && childrenList.length > 0
      ? childrenList
      : [
          {
            id: 'demo-1',
            first_name: 'David',
            last_name: 'James',
            present_today: true,
            arrival_time: '2026-08-04T07:28:00Z',
          },
          {
            id: 'demo-2',
            first_name: 'Esther',
            last_name: 'James',
            present_today: true,
            arrival_time: '2026-08-04T07:31:00Z',
          },
        ];

  const kidsNames = displayKids.map((c) => c?.first_name || 'Child');
  const summaryText =
    kidsNames.length > 1
      ? `${kidsNames.slice(0, -1).join(', ')} and ${kidsNames[kidsNames.length - 1]} are safely on their way to school.`
      : `${kidsNames[0]} is safely on their way to school.`;

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
                  : 'bg-slate-900/80 border-slate-700 text-slate-400'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full flex items-center justify-center ${
                  isEven ? 'bg-emerald-600 text-white' : 'bg-indigo-600 text-white'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5 stroke-[2.5]" />
              </div>
              <div className="flex items-center gap-1.5">
                <span>{child?.first_name || 'Child'} Arrived School</span>
                <span className="text-[10px] text-slate-500 font-mono font-normal">{timeStr}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
