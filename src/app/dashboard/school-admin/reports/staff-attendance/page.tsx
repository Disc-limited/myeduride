// @ts-nocheck
'use client';

import { useEffect, useState } from 'react';
import { fetchData } from '@/lib/api';
import DetailedAttendanceReports from '@/components/attendance/DetailedAttendanceReports';
import Link from 'next/link';
import {
  ClipboardCheck,
  GraduationCap,
  Users,
  DoorOpen,
  ArrowLeft,
  ShieldCheck,
  BarChart3
} from 'lucide-react';

export default function StaffAttendanceReportsPage() {
  const [loading, setLoading] = useState(true);
  const [schoolId, setSchoolId] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const schoolData = await fetchData('get_school_admin_data', { role: 'school_admin' });
        if (schoolData?.school_id) {
          setSchoolId(schoolData.school_id);
        }
      } catch (err) {
        console.error('[StaffAttendanceReportsPage] Error loading school:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center font-sans">
        <div className="animate-pulse text-emerald-600 font-bold text-sm">
          Loading Staff Attendance Records…
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell w-full max-w-full font-sans space-y-6">
      {/* Header with back navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              href="/dashboard/school-admin/reports"
              className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors"
            >
              <ArrowLeft size={14} /> Reports Hub
            </Link>
            <span className="text-slate-300">/</span>
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase tracking-wider">
              Staff Oversight
            </span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <ClipboardCheck className="text-emerald-600" size={26} />
            Staff Attendance Report
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Official staff clock-in/out records, arrival timestamps, lateness tracking, and role-based summaries.
          </p>
        </div>

        {/* Quick Nav Pill links */}
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/school-admin/reports"
            className="px-3.5 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5"
          >
            <BarChart3 size={14} className="text-slate-500" /> Student Attendance
          </Link>
          <Link
            href="/dashboard/school-admin/reports/gate-activities"
            className="px-3.5 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5"
          >
            <DoorOpen size={14} className="text-slate-500" /> Gate Log
          </Link>
          <Link
            href="/dashboard/school-admin/staff"
            className="px-3.5 py-2 rounded-xl bg-[#0B1E36] hover:bg-[#07132B] text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5"
          >
            <Users size={14} className="text-emerald-400" /> Staff Directory
          </Link>
        </div>
      </div>

      {/* Main Report Container */}
      <div className="card-elevated p-6 bg-white rounded-3xl border border-slate-200/80 shadow-xs">
        <DetailedAttendanceReports
          schoolId={schoolId}
          title="Staff Attendance & Punctuality Records"
          showStudentReports={false}
          showStaffTab={true}
          defaultView="staff"
          staffTabLabel="Staff"
        />
      </div>
    </div>
  );
}
