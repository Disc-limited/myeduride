'use client';

import {
  UserCheck,
  Navigation,
  MessageSquare,
  CreditCard,
  Wallet,
  History,
  FileCheck2,
  Bot,
  Sparkles,
} from 'lucide-react';

interface QuickActionsGridProps {
  onActionClick: (actionKey: string) => void;
}

export default function QuickActionsGrid({ onActionClick }: QuickActionsGridProps) {
  const actions = [
    {
      key: 'authorize_pickup',
      label: 'Authorize Pickup',
      fullLabel: 'Authorize Pickup Person',
      description: 'Authorize an escort or family member for student pickup today',
      icon: UserCheck,
      bgColor: 'bg-emerald-100 text-emerald-700',
      hoverColor: 'hover:bg-emerald-200/80',
    },
    {
      key: 'track_vehicle',
      label: 'Track Vehicle',
      fullLabel: 'Live Vehicle GPS Tracking',
      description: 'View live GPS location and ETA of the school shuttle',
      icon: Navigation,
      bgColor: 'bg-blue-100 text-blue-700',
      hoverColor: 'hover:bg-blue-200/80',
    },
    {
      key: 'chat_school',
      label: 'Chat School',
      fullLabel: 'EduChat Direct Messaging',
      description: 'Send direct messages to class teacher or school office',
      icon: MessageSquare,
      bgColor: 'bg-purple-100 text-purple-700',
      hoverColor: 'hover:bg-purple-200/80',
    },
    {
      key: 'book_ride',
      label: 'Book Ride',
      fullLabel: 'Book MyEduRide Escort & Ride',
      description: 'Request a verified backup escort or scheduled transport ride',
      icon: Sparkles,
      bgColor: 'bg-amber-100 text-amber-700',
      hoverColor: 'hover:bg-amber-200/80',
    },
    {
      key: 'fund_wallet',
      label: 'Fund Wallet',
      fullLabel: 'Fund Parent Wallet Balance',
      description: 'Add credit to your parent wallet for quick automated payments',
      icon: Wallet,
      bgColor: 'bg-cyan-100 text-cyan-700',
      hoverColor: 'hover:bg-cyan-200/80',
    },
    {
      key: 'journey_history',
      label: 'Journey History',
      fullLabel: 'Shuttle Trip Telemetry History',
      description: 'Review historical route logs and arrival timelines',
      icon: History,
      bgColor: 'bg-teal-100 text-teal-700',
      hoverColor: 'hover:bg-teal-200/80',
    },
    {
      key: 'attendance_report',
      label: 'Attendance Log',
      fullLabel: 'Student Attendance & Absence Logs',
      description: 'View daily, weekly, and termly attendance reports',
      icon: FileCheck2,
      bgColor: 'bg-emerald-100 text-emerald-700',
      hoverColor: 'hover:bg-emerald-200/80',
    },
    {
      key: 'ask_migo',
      label: 'Ask Migo AI',
      fullLabel: 'Ask Migo AI Assistant',
      description: 'Ask questions about school schedules, attendance & safety',
      icon: Bot,
      bgColor: 'bg-indigo-100 text-indigo-700',
      hoverColor: 'hover:bg-indigo-200/80',
    },
  ];

  return (
    <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs hover:shadow-md transition-all">
      <div className="flex items-center justify-between mb-3.5">
        <h2 className="text-sm font-extrabold text-slate-900 tracking-tight">Quick Actions</h2>
        <span className="text-[10px] font-bold text-slate-400">Hover for info</span>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        {actions.map((act) => {
          const Icon = act.icon;
          return (
            <div key={act.key} className="relative group">
              {/* Interactive Button */}
              <button
                type="button"
                onClick={() => onActionClick(act.key)}
                title={act.fullLabel}
                aria-label={act.fullLabel}
                className="w-full flex items-center gap-2 p-2 rounded-2xl bg-slate-50/90 hover:bg-slate-100 border border-slate-200/60 transition-all text-left min-w-0 shadow-2xs hover:border-slate-300 active:scale-98"
              >
                <div
                  className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 transition-all ${act.bgColor} ${act.hoverColor} group-hover:scale-105 shadow-2xs`}
                >
                  <Icon className="w-3.5 h-3.5" />
                </div>
                <span className="text-[11px] font-extrabold text-slate-800 leading-tight group-hover:text-emerald-700 truncate">
                  {act.label}
                </span>
              </button>

              {/* Floating Custom Hover Tooltip Popover */}
              <div className="opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-200 ease-out transform group-hover:-translate-y-1 absolute left-1/2 -translate-x-1/2 bottom-full mb-2 z-50 w-48 p-2.5 bg-slate-900/95 backdrop-blur-md text-white rounded-2xl shadow-xl border border-slate-700/80 text-center">
                <p className="text-[11px] font-extrabold text-emerald-400 leading-tight">
                  {act.fullLabel}
                </p>
                <p className="text-[9px] text-slate-300 mt-1 leading-snug font-medium">
                  {act.description}
                </p>

                {/* Downward Caret Arrow */}
                <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-x-6 border-x-transparent border-t-6 border-t-slate-900/95" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
