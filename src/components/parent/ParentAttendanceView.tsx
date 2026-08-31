'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  CalendarCheck,
  UserCheck,
  Clock,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Calendar,
  ChevronDown,
  Filter,
  Users,
  Building,
  ShieldCheck,
  ArrowRight,
  TrendingUp,
  MapPin
} from 'lucide-react';
import { toast } from 'sonner';
import { photoSrc } from '@/lib/photo';
import { formatTimeLagos, todayInLagos } from '@/lib/timezone';
import { DAY_STATUS_LABELS } from '@/lib/attendance/status';

interface ParentAttendanceViewProps {
  childrenList?: any[];
  className?: string;
}

export default function ParentAttendanceView({
  childrenList = [],
  className = '',
}: ParentAttendanceViewProps) {
  const safeChildren = Array.isArray(childrenList) ? childrenList : [];
  const [selectedChildId, setSelectedChildId] = useState<string>(safeChildren[0]?.id || '');
  const [filterType, setFilterType] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('weekly');
  const [historyDate, setHistoryDate] = useState<string>(todayInLagos());
  const [attendanceData, setAttendanceData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (safeChildren.length > 0 && !selectedChildId) {
      setSelectedChildId(safeChildren[0].id);
    }
  }, [childrenList]);

  const selectedChild = useMemo(() => {
    return safeChildren.find((c) => c.id === selectedChildId) || safeChildren[0] || null;
  }, [safeChildren, selectedChildId]);

  useEffect(() => {
    if (selectedChildId) {
      loadAttendance();
    }
  }, [selectedChildId, filterType, historyDate]);

  const loadAttendance = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        student_id: selectedChildId,
        type: filterType,
        date: historyDate,
      });
      const res = await fetch(`/api/parent/attendance-history?${params}`, {
        credentials: 'include',
        cache: 'no-store',
      });
      const json = await res.json();
      if (res.ok) {
        setAttendanceData(json);
      } else {
        toast.error(json.error || 'Could not load attendance logs');
      }
    } catch {
      toast.error('Network error loading attendance logs');
    } finally {
      setLoading(false);
    }
  };

  const summary = attendanceData?.summary || {
    total_school_days: 0,
    present: 0,
    late: 0,
    absent: 0,
    attendance_pct: 0,
  };

  const calendarLogs = attendanceData?.calendar || [];

  return (
    <div className={`space-y-6 text-slate-800 text-xs font-sans ${className}`}>
      
      {/* ------------------------------------------------------------------------- */}
      {/* HEADER & DATE RANGE FILTER BAR */}
      {/* ------------------------------------------------------------------------- */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-slate-200/90 shadow-xs">
        <div>
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-medium mb-1">
            <span>Home</span>
            <span>›</span>
            <span className="text-slate-800 font-bold">Attendance Hub</span>
          </div>
          <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">
            Student Attendance
          </h1>
          <p className="text-slate-500 text-xs font-medium mt-0.5">
            Monitor daily check-ins, gate departures, and term attendance records.
          </p>
        </div>

        {/* Time range switcher */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center bg-slate-100 p-1 rounded-2xl text-xs font-bold">
            {(['daily', 'weekly', 'monthly', 'yearly'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setFilterType(t)}
                className={`px-3 py-1.5 rounded-xl transition-all capitalize cursor-pointer ${
                  filterType === t
                    ? 'bg-emerald-600 text-white shadow-xs font-black'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 bg-slate-50 px-3.5 py-2 rounded-2xl border border-slate-200 text-xs font-extrabold text-slate-800">
            <Calendar size={14} className="text-emerald-600" />
            <input
              type="date"
              value={historyDate}
              onChange={(e) => setHistoryDate(e.target.value)}
              className="bg-transparent font-extrabold text-xs focus:outline-none cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------------------- */}
      {/* CHILD SELECTOR BAR */}
      {/* ------------------------------------------------------------------------- */}
      {safeChildren.length > 0 ? (
        <div className="bg-white p-3.5 rounded-3xl border border-slate-200/90 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <img
              src={photoSrc(selectedChild?.avatar_url || selectedChild?.photo_url) || ''}
              alt={selectedChild?.first_name || 'Child'}
              className="w-11 h-11 rounded-2xl object-cover border-2 border-emerald-500/20 shadow-xs"
            />
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Selected Student</span>
              <h3 className="text-sm font-black text-slate-900">
                {selectedChild?.first_name} {selectedChild?.last_name}
              </h3>
              <span className="text-[11px] text-slate-500 font-medium">
                Class: {selectedChild?.class?.name || selectedChild?.class_name || 'Enrolled Student'}
              </span>
            </div>
          </div>

          {safeChildren.length > 1 && (
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-slate-500">Switch Child:</span>
              <select
                value={selectedChildId}
                onChange={(e) => setSelectedChildId(e.target.value)}
                className="bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-xs font-bold text-slate-800 focus:outline-none cursor-pointer"
              >
                {safeChildren.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.first_name} {c.last_name} ({c.class?.name || c.class_name || 'Student'})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white p-6 rounded-3xl border border-slate-200 text-center space-y-2">
          <Users size={28} className="mx-auto text-slate-400" />
          <p className="text-xs font-bold text-slate-600">No children linked to your parent account</p>
        </div>
      )}

      {/* ------------------------------------------------------------------------- */}
      {/* 4 SUMMARY METRIC KPI CARDS */}
      {/* ------------------------------------------------------------------------- */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Attendance Rate */}
        <div className="bg-white p-4 rounded-3xl border border-slate-200/90 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Attendance Rate</span>
            <strong className="text-2xl font-black text-slate-900 block leading-none">
              {summary.attendance_pct}%
            </strong>
            <span className="text-[10px] text-emerald-600 font-bold block">Target &gt; 90%</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100 shadow-xs">
            <TrendingUp size={22} />
          </div>
        </div>

        {/* Present Days */}
        <div className="bg-white p-4 rounded-3xl border border-slate-200/90 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Present (On-Time)</span>
            <strong className="text-2xl font-black text-slate-900 block leading-none">
              {summary.present}
            </strong>
            <span className="text-[10px] text-blue-600 font-bold block">Verified on Campus</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100 shadow-xs">
            <CheckCircle2 size={22} />
          </div>
        </div>

        {/* Late Arrivals */}
        <div className="bg-white p-4 rounded-3xl border border-slate-200/90 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Late Arrivals</span>
            <strong className="text-2xl font-black text-amber-600 block leading-none">
              {summary.late}
            </strong>
            <span className="text-[10px] text-amber-600 font-bold block">After gate cutoff</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 border border-amber-100 shadow-xs">
            <Clock size={22} />
          </div>
        </div>

        {/* Absences */}
        <div className="bg-white p-4 rounded-3xl border border-slate-200/90 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Unexcused Absences</span>
            <strong className="text-2xl font-black text-rose-600 block leading-none">
              {summary.absent}
            </strong>
            <span className="text-[10px] text-rose-600 font-bold block">Days missed</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0 border border-rose-100 shadow-xs">
            <XCircle size={22} />
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------------------- */}
      {/* ATTENDANCE CALENDAR TIMELINE & LOGS */}
      {/* ------------------------------------------------------------------------- */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="font-extrabold text-sm text-slate-900">Attendance Log &amp; Check-in Details</h3>
            <p className="text-[11px] text-slate-500">Live check-in and checkout timestamps recorded at school campus gate</p>
          </div>
          <span className="px-3 py-1 bg-slate-100 rounded-full text-[10px] font-black uppercase text-slate-600">
            {filterType.toUpperCase()} VIEW
          </span>
        </div>

        {loading ? (
          <div className="py-16 text-center space-y-2">
            <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs font-bold text-slate-400">Loading attendance records...</p>
          </div>
        ) : filterType === 'daily' ? (
          /* Single Daily Record View */
          <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200/80 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase">Selected Date</span>
                <strong className="text-sm font-black text-slate-900 block">{attendanceData?.date || historyDate}</strong>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-black uppercase ${
                attendanceData?.status === 'on_time' ? 'bg-emerald-100 text-emerald-800' :
                attendanceData?.status === 'late' ? 'bg-amber-100 text-amber-900' :
                attendanceData?.status === 'absent' ? 'bg-rose-100 text-rose-900' : 'bg-slate-200 text-slate-700'
              }`}>
                {(DAY_STATUS_LABELS as Record<string, string>)[attendanceData?.status] || attendanceData?.status || 'No Record'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="bg-white p-3.5 rounded-xl border border-slate-200">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Morning Gate Arrival</span>
                <strong className="text-xs font-black text-slate-900 block mt-0.5">
                  {attendanceData?.check_in_time ? formatTimeLagos(attendanceData.check_in_time) : '— Not Recorded'}
                </strong>
                {attendanceData?.minutes_late ? (
                  <span className="text-[10px] text-amber-600 font-bold">
                    {attendanceData.minutes_late} min late arrival
                  </span>
                ) : null}
              </div>

              <div className="bg-white p-3.5 rounded-xl border border-slate-200">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Afternoon Gate Departure</span>
                <strong className="text-xs font-black text-slate-900 block mt-0.5">
                  {attendanceData?.check_out_time ? formatTimeLagos(attendanceData.check_out_time) : '— Not Dismissed Yet'}
                </strong>
                <span className="text-[10px] text-slate-400 font-medium">Standard school dismissal</span>
              </div>
            </div>
          </div>
        ) : calendarLogs.length === 0 ? (
          <div className="py-12 text-center bg-slate-50/70 rounded-2xl border border-dashed border-slate-200 space-y-1">
            <CalendarCheck size={24} className="mx-auto text-slate-300" />
            <p className="font-bold text-slate-700 text-xs">No Attendance Logs for this Period</p>
            <p className="text-[10px] text-slate-400">Select another date range or child to view past history.</p>
          </div>
        ) : (
          /* Multi-day / Weekly / Monthly Calendar Table */
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[11px]">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] font-bold uppercase text-slate-400">
                  <th className="pb-2.5">Date</th>
                  <th className="pb-2.5">School Day</th>
                  <th className="pb-2.5">Gate Check-in</th>
                  <th className="pb-2.5">Gate Departure</th>
                  <th className="pb-2.5 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 font-medium">
                {calendarLogs.map((log: any, idx: number) => {
                  const statusLabel = (DAY_STATUS_LABELS as Record<string, string>)[log.status] || log.status;
                  const isSuccess = log.status === 'on_time';
                  const isLate = log.status === 'late';
                  const isAbsent = log.status === 'absent';

                  return (
                    <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 font-extrabold text-slate-900">{log.date}</td>
                      <td className="py-3 text-slate-500">
                        {log.is_school_day ? 'Active School Day' : log.is_weekend ? 'Weekend' : 'Holiday / Recess'}
                      </td>
                      <td className="py-3 text-slate-700">
                        {log.check_in_time ? formatTimeLagos(log.check_in_time) : '—'}
                      </td>
                      <td className="py-3 text-slate-700">
                        {log.check_out_time ? formatTimeLagos(log.check_out_time) : '—'}
                      </td>
                      <td className="py-3 text-right">
                        <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase ${
                          isSuccess ? 'bg-emerald-100 text-emerald-800' :
                          isLate ? 'bg-amber-100 text-amber-900' :
                          isAbsent ? 'bg-rose-100 text-rose-900' :
                          'bg-slate-100 text-slate-500'
                        }`}>
                          {statusLabel}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
