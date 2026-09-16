'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  CalendarDays,
  Download,
  Loader2,
  RefreshCw,
  UserPlus,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { fetchData } from '@/lib/api';
import { todayInLagos } from '@/lib/timezone';
import StudentAvatar from '@/components/shared/StudentAvatar';

export default function StudentRegistrationsReportPage() {
  const [schoolId, setSchoolId] = useState('');
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [date, setDate] = useState(todayInLagos());
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [useRange, setUseRange] = useState(false);
  const [total, setTotal] = useState(0);
  const [byDay, setByDay] = useState<{ date: string; count: number; date_display: string }[]>([]);
  const [students, setStudents] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const schoolData = await fetchData('get_school_admin_data', { role: 'school_admin' });
        if (schoolData?.school_id) setSchoolId(schoolData.school_id);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const load = useCallback(async () => {
    if (!schoolId) return;
    setFetching(true);
    try {
      const params = new URLSearchParams({ school_id: schoolId });
      if (useRange && from && to) {
        params.set('from', from);
        params.set('to', to);
      } else {
        params.set('date', date);
      }
      const res = await fetch(`/api/school-admin/reports/student-registrations?${params}`, {
        credentials: 'include',
        cache: 'no-store',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load');
      setTotal(data.total_registered || 0);
      setByDay(data.by_day || []);
      setStudents(data.students || []);
    } catch (err: any) {
      toast.error(err.message || 'Could not load registrations');
    } finally {
      setFetching(false);
    }
  }, [schoolId, date, from, to, useRange]);

  useEffect(() => {
    if (schoolId) load();
  }, [schoolId, load]);

  const downloadCsv = () => {
    const params = new URLSearchParams({ school_id: schoolId, format: 'csv' });
    if (useRange && from && to) {
      params.set('from', from);
      params.set('to', to);
    } else {
      params.set('date', date);
    }
    window.open(`/api/school-admin/reports/student-registrations?${params}`, '_blank');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-primary-600 text-sm font-bold">Loading registration ledger…</div>
      </div>
    );
  }

  return (
    <div className="page-shell w-full max-w-full space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              href="/dashboard/school-admin/reports"
              className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-800"
            >
              <ArrowLeft size={14} /> Reports Hub
            </Link>
          </div>
          <h1 className="page-title flex items-center gap-2">
            <UserPlus className="text-emerald-600" size={22} />
            Student Registration Ledger
          </h1>
          <p className="page-subtitle">
            Date of creation for every registered student — daily totals for accountant records.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={load} className="btn-secondary text-xs min-h-[40px] flex items-center gap-1.5">
            <RefreshCw size={14} className={fetching ? 'animate-spin' : ''} /> Refresh
          </button>
          <button type="button" onClick={downloadCsv} className="btn-primary text-xs min-h-[40px] flex items-center gap-1.5">
            <Download size={14} /> Export CSV
          </button>
        </div>
      </div>

      <div className="card p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-xs font-bold text-slate-600">
            <input type="checkbox" checked={useRange} onChange={(e) => setUseRange(e.target.checked)} />
            Date range
          </label>
          {!useRange ? (
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
              <CalendarDays size={14} />
              Day
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="input text-sm min-h-[40px]"
              />
            </label>
          ) : (
            <>
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                From
                <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="input text-sm min-h-[40px]" />
              </label>
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                To
                <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="input text-sm min-h-[40px]" />
              </label>
            </>
          )}
          <button type="button" onClick={load} disabled={fetching} className="btn-primary text-xs min-h-[40px] px-4">
            {fetching ? <Loader2 size={14} className="animate-spin" /> : 'Apply'}
          </button>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <div className="card border-2 border-emerald-200 bg-emerald-50/50 p-4">
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700">Total registered</p>
          <p className="text-3xl font-black text-slate-900 mt-1">{total}</p>
          <p className="text-xs text-slate-500 mt-1">Students created in selected period</p>
        </div>
        <div className="card p-4 sm:col-span-1 lg:col-span-2">
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1">
            <Users size={12} /> By day
          </p>
          {byDay.length === 0 ? (
            <p className="text-sm text-slate-400">No registrations in this period.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {byDay.map((d) => (
                <div key={d.date} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                  <p className="text-[10px] font-bold text-slate-500">{d.date_display || d.date}</p>
                  <p className="text-lg font-black text-slate-900">{d.count}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="card p-0 overflow-hidden overflow-x-auto">
        <table className="w-full min-w-[720px]">
          <thead className="bg-slate-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Student</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Class</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Student ID</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Date created</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {students.map((s) => (
              <tr key={s.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <StudentAvatar photoUrl={s.photo_url} firstName={s.first_name} lastName={s.last_name} size="sm" />
                    <span className="text-sm font-semibold">{s.full_name}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-primary-700 font-medium">{s.class_name}</td>
                <td className="px-4 py-3 text-sm font-mono text-gray-500">{s.student_id_number}</td>
                <td className="px-4 py-3 text-sm text-slate-700 font-medium">{s.created_at_display || '—'}</td>
              </tr>
            ))}
            {students.length === 0 && (
              <tr>
                <td colSpan={4} className="py-10 text-center text-slate-400 text-sm">
                  No student registrations for this date.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
