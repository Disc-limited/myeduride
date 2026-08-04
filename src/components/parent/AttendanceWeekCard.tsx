'use client';

import { CheckCircle2, XCircle, Clock, Minus } from 'lucide-react';

export interface DayAttendance {
  day: 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri';
  status: 'present' | 'late' | 'absent' | 'none';
}

interface AttendanceWeekCardProps {
  days?: DayAttendance[];
  presentCount?: number;
  lateCount?: number;
  absentCount?: number;
  attendanceRate?: number;
  onViewAll?: () => void;
}

export default function AttendanceWeekCard({
  days = [
    { day: 'Mon', status: 'present' },
    { day: 'Tue', status: 'present' },
    { day: 'Wed', status: 'absent' },
    { day: 'Thu', status: 'present' },
    { day: 'Fri', status: 'present' },
  ],
  presentCount = 4,
  lateCount = 0,
  absentCount = 1,
  attendanceRate = 80,
  onViewAll,
}: AttendanceWeekCardProps) {
  const getDayIcon = (status: string) => {
    switch (status) {
      case 'present':
        return <CheckCircle2 className="w-5 h-5 text-emerald-500 fill-emerald-100" />;
      case 'late':
        return <Clock className="w-5 h-5 text-amber-500 fill-amber-100" />;
      case 'absent':
        return <XCircle className="w-5 h-5 text-red-500 fill-red-100" />;
      default:
        return <Minus className="w-4 h-4 text-slate-300" />;
    }
  };

  return (
    <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm flex flex-col justify-between h-full hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-extrabold text-slate-900 tracking-tight">Attendance This Week</h2>
        <button
          type="button"
          onClick={onViewAll}
          className="text-xs font-bold text-emerald-600 hover:text-emerald-700 transition-colors"
        >
          View All
        </button>
      </div>

      {/* Days Checklist Row */}
      <div className="my-3 grid grid-cols-5 gap-1.5 text-center">
        {days.map((d) => (
          <div key={d.day} className="flex flex-col items-center gap-1.5 p-2 rounded-2xl bg-slate-50 border border-slate-100">
            <span className="text-[10px] font-bold text-slate-400 uppercase">{d.day}</span>
            <div className="my-0.5">{getDayIcon(d.status)}</div>
          </div>
        ))}
      </div>

      {/* Summary Stat Counters */}
      <div className="grid grid-cols-4 gap-2 pt-2 border-t border-slate-100 text-center">
        <div>
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
            Present
          </span>
          <span className="text-lg font-black text-emerald-600 block leading-tight mt-0.5">
            {presentCount}
          </span>
        </div>

        <div>
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
            Late
          </span>
          <span className="text-lg font-black text-amber-600 block leading-tight mt-0.5">
            {lateCount}
          </span>
        </div>

        <div>
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
            Absent
          </span>
          <span className="text-lg font-black text-red-600 block leading-tight mt-0.5">
            {absentCount}
          </span>
        </div>

        <div>
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
            Attendance
          </span>
          <span className="text-lg font-black text-emerald-600 block leading-tight mt-0.5">
            {attendanceRate}%
          </span>
        </div>
      </div>
    </div>
  );
}
