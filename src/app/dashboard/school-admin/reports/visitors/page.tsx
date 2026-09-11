// @ts-nocheck
'use client';

import { useEffect, useState } from 'react';
import { fetchData } from '@/lib/api';
import VisitorsReportView from '@/components/visitors/VisitorsReportView';
import Link from 'next/link';
import {
  Users,
  ArrowLeft,
  DoorOpen,
  ClipboardCheck,
  ClipboardList,
  Building
} from 'lucide-react';

export default function SchoolAdminVisitorsReportPage() {
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
        console.error('[VisitorsReportPage] Error loading school:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center font-sans">
        <div className="animate-pulse text-blue-600 font-bold text-sm">
          Loading Campus Visitors Ledger…
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
            <span className="px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[10px] font-black uppercase tracking-wider">
              Campus Security
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Official Visitors Report & Action Hub
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 font-medium">
            Monitor visitor entries, exact exit timestamps, purpose of visit, and manage remote Accept/Decline clearances for the gate officer.
          </p>
        </div>

        {/* Quick Nav to other report hubs */}
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/dashboard/school-admin/reports"
            className="px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition-colors"
          >
            <ClipboardList size={14} className="text-primary-600" />
            <span>Students</span>
          </Link>
          <Link
            href="/dashboard/school-admin/reports/staff-attendance"
            className="px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition-colors"
          >
            <ClipboardCheck size={14} className="text-emerald-600" />
            <span>Staff</span>
          </Link>
          <Link
            href="/dashboard/school-admin/reports/gate-activities"
            className="px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition-colors"
          >
            <DoorOpen size={14} className="text-slate-600" />
            <span>Gate Log</span>
          </Link>
        </div>
      </div>

      {/* Main Ledger View */}
      <VisitorsReportView
        schoolId={schoolId}
        title="Official Campus Visitors Ledger"
      />
    </div>
  );
}
