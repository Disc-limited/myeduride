// @ts-nocheck
'use client';

import { useEffect, useState } from 'react';
import { fetchData } from '@/lib/api';
import {
  ClipboardCheck,
  ScanLine,
  Users,
  BarChart3,
  Calendar,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Car
} from 'lucide-react';
import DetailedAttendanceReports from '@/components/attendance/DetailedAttendanceReports';
import StaffIdScanPanel from '@/components/gate/StaffIdScanPanel';
import AttendanceSignLog from '@/components/attendance/AttendanceSignLog';
import Link from 'next/link';

export default function SchoolAdminStaffAttendancePage() {
  const [activeTab, setActiveTab] = useState<'reports' | 'scan'>('reports');
  const [schoolId, setSchoolId] = useState('');
  const [mode, setMode] = useState<'arrival' | 'departure'>('arrival');
  const [loading, setLoading] = useState(true);
  const [logKey, setLogKey] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const data = await fetchData('get_school_admin_data', { role: 'school_admin' });
        setSchoolId(data.school_id || '');
      } catch (err) {
        console.error('[StaffAttendancePage] Error loading school data:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleScanSuccess = () => {
    setLogKey((k) => k + 1);
  };

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
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase tracking-wider border border-emerald-200">
              Staff Management &amp; Oversight
            </span>
            <span className="text-xs text-slate-400 font-mono">MyEduRide Attendance</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <ClipboardCheck className="text-emerald-600" size={26} />
            Staff Attendance
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            View staff attendance reports, arrival timestamps, lateness tracking, and perform gate/reception staff check-ins.
          </p>
        </div>

        {/* Action switchers */}
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/school-admin/reports"
            className="px-3.5 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5"
          >
            <BarChart3 size={14} className="text-slate-500" /> Student Attendance
          </Link>
          <Link
            href="/dashboard/school-admin/staff"
            className="px-3.5 py-2 rounded-xl bg-[#0B1E36] hover:bg-[#07132B] text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5"
          >
            <Users size={14} className="text-emerald-400" /> Staff Directory
          </Link>
        </div>
      </div>

      {/* Main Mode Navigation Tabs */}
      <div className="bg-white rounded-2xl p-1.5 border border-slate-200 shadow-xs flex items-center gap-2">
        <button
          type="button"
          onClick={() => setActiveTab('reports')}
          className={`flex-1 sm:flex-initial px-5 py-2.5 rounded-xl font-black text-xs transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === 'reports'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <BarChart3 size={16} className={activeTab === 'reports' ? 'text-emerald-400' : ''} />
          <span>Staff Attendance Reports &amp; Ledgers</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('scan')}
          className={`flex-1 sm:flex-initial px-5 py-2.5 rounded-xl font-black text-xs transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === 'scan'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <ScanLine size={16} className={activeTab === 'scan' ? 'text-emerald-400' : ''} />
          <span>Live Staff Check-in / Scanner</span>
        </button>
      </div>

      {/* TAB 1: REPORTS & LEDGERS */}
      {activeTab === 'reports' && (
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
      )}

      {/* TAB 2: LIVE SCANNER */}
      {activeTab === 'scan' && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs max-w-xl mx-auto space-y-4">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <ScanLine className="text-emerald-600" size={20} />
                Staff ID Card Scanner
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Scan staff member ID cards or verify check-in / check-out manually.
              </p>
            </div>

            <div className="pill-tabs">
              <button
                type="button"
                onClick={() => setMode('arrival')}
                className={mode === 'arrival' ? 'pill-tab-active' : 'pill-tab-inactive'}
              >
                Sign In (Arrival)
              </button>
              <button
                type="button"
                onClick={() => setMode('departure')}
                className={mode === 'departure' ? 'pill-tab-active' : 'pill-tab-inactive'}
              >
                Sign Out (Departure)
              </button>
            </div>

            <StaffIdScanPanel
              schoolId={schoolId}
              mode={mode}
              onModeChange={setMode}
              onSuccess={handleScanSuccess}
            />
          </div>

          <div key={logKey} className="max-w-4xl mx-auto">
            <AttendanceSignLog schoolId={schoolId} title="Today's Staff Check-in & Check-out Logs" />
          </div>
        </div>
      )}
    </div>
  );
}
