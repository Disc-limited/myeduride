// @ts-nocheck
'use client';

import { useEffect, useState } from 'react';
import { fetchData } from '@/lib/api';
import VisitorsReportView from '@/components/visitors/VisitorsReportView';
import Link from 'next/link';
import {
  Users,
  Shield,
  DoorOpen,
  ClipboardList,
  Clock,
  CheckCircle,
  XCircle,
} from 'lucide-react';

export default function SchoolAdminVisitorsPage() {
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
        console.error('[AdminVisitorsPage] Error loading school:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center font-sans">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <div className="text-slate-600 font-bold text-sm">
            Loading Campus Visitors Clearance Hub…
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell w-full max-w-full font-sans space-y-6">
      {/* Header with quick stats preview */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-800 text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
              <Shield size={12} /> Security & Access Management
            </span>
            <span className="text-slate-300">/</span>
            <span className="text-xs font-semibold text-slate-500">Live Visitor Clearance</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            School Visitor Acceptance Hub
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 font-medium">
            Review arriving visitors scanned or registered at the gate, accept or decline access with reason, and track on-campus time left.
          </p>
        </div>

        {/* Quick Nav */}
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/dashboard/school-admin/reports/visitors"
            className="px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm"
          >
            <ClipboardList size={14} className="text-blue-600" />
            <span>Full Visitors Archive</span>
          </Link>
          <Link
            href="/dashboard/school-admin/reports/gate-activities"
            className="px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm"
          >
            <DoorOpen size={14} className="text-slate-600" />
            <span>Gate Activity Log</span>
          </Link>
        </div>
      </div>

      {/* Main Visitor Ledger & Acceptance Component */}
      <VisitorsReportView
        schoolId={schoolId}
        title="Active Campus Visitors & Acceptance Desk"
      />
    </div>
  );
}
