'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Camera,
  Car,
  CheckCircle2,
  Wallet,
  ArrowDownRight,
  Gift,
  Calendar,
  ChevronDown,
  ExternalLink,
  ArrowUpRight,
  Filter,
  Layers,
  PieChart as PieChartIcon,
  Bell,
  History,
  ShieldCheck,
  UserCheck,
  HelpCircle,
  Clock,
  MapPin,
  TrendingUp,
  TrendingDown,
  Inbox
} from 'lucide-react';
import { toast } from 'sonner';
import { photoSrc } from '@/lib/photo';

interface ParentReportsOverviewViewProps {
  childrenList?: any[];
  activeSubReport?: string;
  className?: string;
}

export default function ParentReportsOverviewView({
  childrenList = [],
  activeSubReport,
  className = '',
}: ParentReportsOverviewViewProps) {
  // Active Date Filter Range
  const [dateFilter, setDateFilter] = useState<'today' | 'week' | 'month' | 'year'>('month');

  // Sub-tabs states
  const [escortFilter, setEscortFilter] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('daily');
  const [walletSubTab, setWalletSubTab] = useState<'summary' | 'deposit' | 'transfer' | 'topup'>('summary');
  const [withdrawalFilter, setWithdrawalFilter] = useState<'all' | 'successful' | 'pending' | 'failed'>('all');

  // API Data state
  const [reportsData, setReportsData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Real enrolled children
  const safeChildren = Array.isArray(childrenList) ? childrenList : [];
  const [selectedStudentId, setSelectedStudentId] = useState<string>(safeChildren[0]?.id || '');

  useEffect(() => {
    if (safeChildren.length > 0 && !selectedStudentId) {
      setSelectedStudentId(safeChildren[0].id);
    }
  }, [childrenList]);

  useEffect(() => {
    fetchReportsData();
  }, [dateFilter]);

  const fetchReportsData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/parent/reports/overview', {
        credentials: 'include',
        cache: 'no-store',
      });
      const data = await res.json();
      if (res.ok && data.reports) {
        setReportsData(data.reports);
      }
    } catch (err) {
      console.warn('[ParentReportsOverviewView] fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const selectedChild = useMemo(() => {
    return safeChildren.find((c) => c.id === selectedStudentId) || safeChildren[0] || null;
  }, [safeChildren, selectedStudentId]);

  // Current Dynamic Date strings
  const now = new Date();
  const todayFormatted = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const monthRangeFormatted = `${now.toLocaleDateString('en-US', { month: 'short' })} 1 – ${todayFormatted}`;

  const kpis = reportsData?.summary_kpis;
  const gateReport = reportsData?.gate_activity_report;
  const escortReport = reportsData?.escort_movement_report;
  const financialReport = reportsData?.financial_report;
  const walletReport = reportsData?.wallet_report;
  const withdrawalReport = reportsData?.withdrawal_report || [];
  const referralReport = reportsData?.referral_report;

  return (
    <div className={`space-y-6 text-slate-800 text-xs font-sans ${className}`}>
      
      {/* ------------------------------------------------------------------------- */}
      {/* BREADCRUMB & TOP HEADER BAR */}
      {/* ------------------------------------------------------------------------- */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-slate-200/90 shadow-xs">
        <div>
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-medium mb-1">
            <span>Home</span>
            <span>›</span>
            <span>Reports</span>
            <span>›</span>
            <span className="text-slate-800 font-bold">Overview</span>
          </div>
          <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">
            Reports Overview
          </h1>
          <p className="text-slate-500 text-xs font-medium mt-0.5">
            View and track all activities, movements, and financial transactions in real-time.
          </p>
        </div>

        {/* Date Filter Range Tabs & Picker Pill */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center bg-slate-100 p-1 rounded-2xl text-xs font-bold">
            <button
              onClick={() => setDateFilter('today')}
              className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                dateFilter === 'today' ? 'bg-white text-slate-900 shadow-xs font-black' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Today
            </button>
            <button
              onClick={() => setDateFilter('week')}
              className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                dateFilter === 'week' ? 'bg-white text-slate-900 shadow-xs font-black' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              This Week
            </button>
            <button
              onClick={() => setDateFilter('month')}
              className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                dateFilter === 'month' ? 'bg-blue-600 text-white shadow-xs font-black' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              This Month
            </button>
            <button
              onClick={() => setDateFilter('year')}
              className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                dateFilter === 'year' ? 'bg-white text-slate-900 shadow-xs font-black' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              This Year
            </button>
          </div>

          <div className="flex items-center gap-2 bg-slate-50 px-3.5 py-2 rounded-2xl border border-slate-200 text-xs font-extrabold text-slate-800">
            <span>{monthRangeFormatted}</span>
            <Calendar size={14} className="text-slate-400" />
          </div>
        </div>
      </div>

      {loading && !reportsData ? (
        <div className="py-20 text-center space-y-3 bg-white rounded-3xl border border-slate-200 shadow-xs">
          <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-bold text-slate-400">Loading live reports from database...</p>
        </div>
      ) : (
        <>
          {/* ------------------------------------------------------------------------- */}
          {/* ROW 1: 6 SUMMARY KPI METRIC CARDS GRID */}
          {/* ------------------------------------------------------------------------- */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3.5">
            {/* Card 1: Gate Activities */}
            <div className="bg-white p-4 rounded-3xl border border-slate-200/90 shadow-xs space-y-2">
              <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100 shadow-xs">
                <Camera size={18} />
              </div>
              <div>
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Gate Activities</span>
                <strong className="text-xl font-black text-slate-900 block leading-tight">{kpis?.gate_activities?.count ?? 0}</strong>
                <span className="text-[9px] text-slate-400 font-medium block">Total Entries/Exits</span>
                <span className="text-[10px] text-emerald-600 font-bold block pt-0.5">{kpis?.gate_activities?.change || 'Active'}</span>
              </div>
            </div>

            {/* Card 2: Escort Movements */}
            <div className="bg-white p-4 rounded-3xl border border-slate-200/90 shadow-xs space-y-2">
              <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100 shadow-xs">
                <Car size={18} />
              </div>
              <div>
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Escort Movements</span>
                <strong className="text-xl font-black text-slate-900 block leading-tight">{kpis?.escort_movements?.count ?? 0}</strong>
                <span className="text-[9px] text-slate-400 font-medium block">Total Trips</span>
                <span className="text-[10px] text-blue-600 font-bold block pt-0.5">{kpis?.escort_movements?.change || 'Active'}</span>
              </div>
            </div>

            {/* Card 3: Services Completed */}
            <div className="bg-white p-4 rounded-3xl border border-slate-200/90 shadow-xs space-y-2">
              <div className="w-10 h-10 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center border border-purple-100 shadow-xs">
                <CheckCircle2 size={18} />
              </div>
              <div>
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Services Completed</span>
                <strong className="text-xl font-black text-slate-900 block leading-tight">{kpis?.services_completed?.count ?? 0}</strong>
                <span className="text-[9px] text-slate-400 font-medium block">Completed Services</span>
                <span className="text-[10px] text-purple-600 font-bold block pt-0.5">{kpis?.services_completed?.change || 'Active'}</span>
              </div>
            </div>

            {/* Card 4: Total Spent */}
            <div className="bg-white p-4 rounded-3xl border border-slate-200/90 shadow-xs space-y-2">
              <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-100 shadow-xs">
                <Wallet size={18} />
              </div>
              <div>
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Total Spent</span>
                <strong className="text-base font-black text-slate-900 block leading-tight truncate">
                  ₦{Number(kpis?.total_spent?.amount ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </strong>
                <span className="text-[9px] text-slate-400 font-medium block">This Month</span>
                <span className="text-[10px] text-emerald-600 font-bold block pt-0.5">{kpis?.total_spent?.change || 'Live Data'}</span>
              </div>
            </div>

            {/* Card 5: Total Withdrawn */}
            <div className="bg-white p-4 rounded-3xl border border-slate-200/90 shadow-xs space-y-2">
              <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100 shadow-xs">
                <ArrowDownRight size={18} />
              </div>
              <div>
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Total Withdrawn</span>
                <strong className="text-base font-black text-slate-900 block leading-tight truncate">
                  ₦{Number(kpis?.total_withdrawn?.amount ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </strong>
                <span className="text-[9px] text-slate-400 font-medium block">This Month</span>
                <span className="text-[10px] text-rose-600 font-bold block pt-0.5">{kpis?.total_withdrawn?.change || 'Live Data'}</span>
              </div>
            </div>

            {/* Card 6: Bonuses Earned */}
            <div className="bg-white p-4 rounded-3xl border border-slate-200/90 shadow-xs space-y-2">
              <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100 shadow-xs">
                <Gift size={18} />
              </div>
              <div>
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Bonuses Earned</span>
                <strong className="text-base font-black text-slate-900 block leading-tight truncate">
                  ₦{Number(kpis?.bonuses_earned?.amount ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </strong>
                <span className="text-[9px] text-slate-400 font-medium block">This Month</span>
                <span className="text-[10px] text-emerald-600 font-bold block pt-0.5">{kpis?.bonuses_earned?.change || 'Live Data'}</span>
              </div>
            </div>
          </div>

          {/* ------------------------------------------------------------------------- */}
          {/* ROW 2: 3 MAJOR SECTION CARDS GRID */}
          {/* ------------------------------------------------------------------------- */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
            
            {/* ========================================================================= */}
            {/* SECTION 1: GATE ACTIVITY REPORT */}
            {/* ========================================================================= */}
            <div id="gate_activity_report" className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-extrabold text-sm text-slate-900">1. Gate Activity Report</h3>
                <button
                  onClick={() => toast.info('Full Gate Activity report view')}
                  className="text-[11px] font-bold text-sky-600 hover:text-sky-800 transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <span>View Full Report</span>
                </button>
              </div>

              {/* Student Selector Switcher */}
              {safeChildren.length > 0 ? (
                <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-2xl border border-slate-200/80">
                  <img
                    src={photoSrc(selectedChild?.avatar_url || selectedChild?.photo_url) || ''}
                    alt={selectedChild?.first_name || 'Student'}
                    className="w-7 h-7 rounded-xl object-cover border border-slate-200 shrink-0"
                  />
                  <select
                    value={selectedStudentId}
                    onChange={(e) => setSelectedStudentId(e.target.value)}
                    className="w-full bg-transparent text-xs font-bold text-slate-900 focus:outline-none cursor-pointer"
                  >
                    {safeChildren.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.first_name} {c.last_name} ({c.class?.name || c.class_name || 'Student'})
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="p-2.5 bg-slate-50 rounded-2xl border border-slate-200 text-slate-500 text-[11px]">
                  No enrolled children registered
                </div>
              )}

              {/* 4 Metric Badges Row */}
              <div className="grid grid-cols-4 gap-1.5 text-center text-[10px] font-bold">
                <div className="p-2 rounded-xl bg-emerald-50/80 text-emerald-900 border border-emerald-100">
                  <span className="text-slate-400 block text-[9px]">Entries</span>
                  <strong className="text-sm font-black text-emerald-700">{gateReport?.total_entries ?? 0}</strong>
                </div>
                <div className="p-2 rounded-xl bg-blue-50/80 text-blue-900 border border-blue-100">
                  <span className="text-slate-400 block text-[9px]">Exits</span>
                  <strong className="text-sm font-black text-blue-700">{gateReport?.total_exits ?? 0}</strong>
                </div>
                <div className="p-2 rounded-xl bg-amber-50/80 text-amber-900 border border-amber-100">
                  <span className="text-slate-400 block text-[9px]">Late Arrivals</span>
                  <strong className="text-sm font-black text-amber-700">{gateReport?.late_arrivals ?? 0}</strong>
                </div>
                <div className="p-2 rounded-xl bg-rose-50/80 text-rose-900 border border-rose-100">
                  <span className="text-slate-400 block text-[9px]">Early Pickups</span>
                  <strong className="text-sm font-black text-rose-700">{gateReport?.early_pickups ?? 0}</strong>
                </div>
              </div>

              {/* Gate Departure Logs Table / Empty State */}
              {(!gateReport?.logs || gateReport.logs.length === 0) ? (
                <div className="p-8 text-center bg-slate-50/70 rounded-2xl border border-dashed border-slate-200 space-y-1">
                  <Camera size={22} className="mx-auto text-slate-300" />
                  <p className="font-bold text-slate-700 text-xs">No Gate Logs Yet</p>
                  <p className="text-[10px] text-slate-400">Gate entries and departures will appear here in real-time as gate officers scan passes.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[11px]">
                    <thead>
                      <tr className="border-b border-slate-100 text-[10px] font-bold uppercase text-slate-400">
                        <th className="pb-2">Date</th>
                        <th className="pb-2">Gate</th>
                        <th className="pb-2">Entry Time</th>
                        <th className="pb-2">Exit Time</th>
                        <th className="pb-2 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 font-medium">
                      {gateReport.logs.map((log: any, idx: number) => (
                        <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-2.5 font-bold text-slate-900">{log.date}</td>
                          <td className="py-2.5 text-slate-500">{log.gate}</td>
                          <td className="py-2.5 text-slate-700">{log.entry_time}</td>
                          <td className="py-2.5 text-slate-700">{log.exit_time}</td>
                          <td className="py-2.5 text-right">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                              log.status === 'On Time' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-900'
                            }`}>
                              {log.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* ========================================================================= */}
            {/* SECTION 2: ESCORT MOVEMENT REPORT */}
            {/* ========================================================================= */}
            <div id="escort_movement_report" className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-extrabold text-sm text-slate-900">2. Escort Movement Report</h3>
                <button
                  onClick={() => toast.info('Full Escort Movement report view')}
                  className="text-[11px] font-bold text-sky-600 hover:text-sky-800 transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <span>View Full Report</span>
                </button>
              </div>

              {/* Time Filter Pills */}
              <div className="flex items-center justify-between">
                <div className="flex items-center bg-slate-100 p-1 rounded-xl text-[10px] font-bold">
                  <button
                    onClick={() => setEscortFilter('daily')}
                    className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                      escortFilter === 'daily' ? 'bg-white text-slate-900 shadow-xs font-black' : 'text-slate-500'
                    }`}
                  >
                    Daily
                  </button>
                  <button
                    onClick={() => setEscortFilter('weekly')}
                    className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                      escortFilter === 'weekly' ? 'bg-white text-slate-900 shadow-xs font-black' : 'text-slate-500'
                    }`}
                  >
                    Weekly
                  </button>
                  <button
                    onClick={() => setEscortFilter('monthly')}
                    className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                      escortFilter === 'monthly' ? 'bg-white text-slate-900 shadow-xs font-black' : 'text-slate-500'
                    }`}
                  >
                    Monthly
                  </button>
                  <button
                    onClick={() => setEscortFilter('yearly')}
                    className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                      escortFilter === 'yearly' ? 'bg-white text-slate-900 shadow-xs font-black' : 'text-slate-500'
                    }`}
                  >
                    Yearly
                  </button>
                </div>

                <div className="flex items-center gap-1 text-[10px] font-extrabold text-slate-600 bg-slate-50 px-2.5 py-1 rounded-xl border border-slate-200">
                  <span>{todayFormatted}</span>
                  <Calendar size={12} className="text-slate-400" />
                </div>
              </div>

              {/* 5 Metric Badges Row */}
              <div className="grid grid-cols-5 gap-1 text-center text-[9px] font-bold bg-slate-50 p-2 rounded-2xl border border-slate-100">
                <div>
                  <span className="text-slate-400 block">Trips</span>
                  <strong className="text-xs font-black text-slate-900">{escortReport?.trips ?? 0}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block">Distance</span>
                  <strong className="text-xs font-black text-slate-900">{escortReport?.distance_km ?? 0} km</strong>
                </div>
                <div>
                  <span className="text-slate-400 block">Pickups</span>
                  <strong className="text-xs font-black text-slate-900">{escortReport?.pickups ?? 0}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block">Drop-offs</span>
                  <strong className="text-xs font-black text-slate-900">{escortReport?.dropoffs ?? 0}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block">Duration</span>
                  <strong className="text-xs font-black text-slate-900">{escortReport?.duration ?? '0m'}</strong>
                </div>
              </div>

              {/* Route Map Preview Canvas */}
              <div className="bg-slate-900 rounded-2xl h-36 relative overflow-hidden border border-slate-800 shadow-xs flex items-center justify-center">
                <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-40">
                  <path
                    d="M 30 90 Q 110 30 200 80 T 300 50"
                    fill="none"
                    stroke="#10B981"
                    strokeWidth="4"
                    strokeDasharray="6 4"
                  />
                </svg>
                <div className="relative z-10 flex items-center gap-2 bg-slate-900/90 text-white px-3 py-1.5 rounded-full border border-slate-700 text-[10px] font-bold">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  <span>Route Corridor GPS Telemetry</span>
                </div>
              </div>

              {/* Timeline Details / Empty State */}
              {(!escortReport?.timeline || escortReport.timeline.length === 0) ? (
                <div className="p-6 text-center bg-slate-50/70 rounded-2xl border border-dashed border-slate-200 space-y-1">
                  <Car size={20} className="mx-auto text-slate-300" />
                  <p className="font-bold text-slate-700 text-xs">No Movement Trips Logged</p>
                  <p className="text-[10px] text-slate-400">Escort pickup and drop-off timeline stops will appear here when active.</p>
                </div>
              ) : (
                <div className="space-y-2 text-[11px] pt-1">
                  {escortReport.timeline.map((stop: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-100">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-slate-700 text-[10px]">{stop.time}</span>
                        <span className="px-1.5 py-0.2 rounded-md bg-emerald-100 text-emerald-800 text-[9px] font-black uppercase">
                          {stop.type}
                        </span>
                      </div>
                      <span className="text-slate-600 font-medium truncate max-w-[180px]">{stop.location}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ========================================================================= */}
            {/* SECTION 3: FINANCIAL PAYMENTS REPORT */}
            {/* ========================================================================= */}
            <div id="financial_report" className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-extrabold text-sm text-slate-900">3. Financial Payments Report</h3>
                <button
                  onClick={() => toast.info('Full Financial report view')}
                  className="text-[11px] font-bold text-sky-600 hover:text-sky-800 transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <span>View Full Report</span>
                </button>
              </div>

              {/* Donut Chart / Spending breakdown */}
              {Number(financialReport?.total_spent ?? 0) === 0 ? (
                <div className="p-8 text-center bg-slate-50/70 rounded-2xl border border-dashed border-slate-200 space-y-1">
                  <Wallet size={22} className="mx-auto text-slate-300" />
                  <p className="font-bold text-slate-700 text-xs">No Payments Recorded</p>
                  <p className="text-[10px] text-slate-400">Total spend across Shared Rides, E-Drive, and Escort services will be summarized here.</p>
                </div>
              ) : (
                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 flex items-center gap-4">
                  {/* SVG Donut Circle */}
                  <div className="relative w-28 h-28 shrink-0 flex items-center justify-center">
                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                      <path
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none"
                        stroke="#E2E8F0"
                        strokeWidth="3.8"
                      />
                      <path
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none"
                        stroke="#10B981"
                        strokeWidth="4"
                        strokeDasharray="100, 100"
                      />
                    </svg>

                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                      <span className="text-[8px] font-bold text-slate-400 uppercase">Total Spent</span>
                      <strong className="text-[10px] font-black text-slate-900">
                        ₦{Number(financialReport.total_spent).toLocaleString('en-US', { minimumFractionDigits: 0 })}
                      </strong>
                      <span className="text-[7px] text-slate-400">This Month</span>
                    </div>
                  </div>

                  {/* Category Breakdown Legend List */}
                  <div className="space-y-1.5 min-w-0 text-[10px] flex-1">
                    {(financialReport.breakdown || []).map((item: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                          <span className="font-medium text-slate-700 truncate">{item.category}</span>
                        </div>
                        <strong className="font-mono text-slate-900 shrink-0">
                          ₦{Number(item.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })} ({item.percentage}%)
                        </strong>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recent Payment Transactions Log */}
              {(!financialReport?.recent_transactions || financialReport.recent_transactions.length === 0) ? null : (
                <div className="space-y-2 text-[11px]">
                  {financialReport.recent_transactions.map((tx: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-100">
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 block">{tx.date}</span>
                        <strong className="font-extrabold text-slate-900">{tx.service}</strong>
                      </div>
                      <strong className="font-mono text-emerald-600 font-extrabold">
                        ₦{Number(tx.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </strong>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>

          {/* ------------------------------------------------------------------------- */}
          {/* ROW 3: 3 SECONDARY SECTION CARDS GRID */}
          {/* ------------------------------------------------------------------------- */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
            
            {/* ========================================================================= */}
            {/* SECTION 4: WALLET & DEPOSIT REPORT */}
            {/* ========================================================================= */}
            <div id="wallet_report" className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-extrabold text-sm text-slate-900">4. Wallet &amp; Deposit Report</h3>
                <button
                  onClick={() => toast.info('Full Wallet report view')}
                  className="text-[11px] font-bold text-sky-600 hover:text-sky-800 transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <span>View Full Report</span>
                </button>
              </div>

              {/* Filter Sub-Tabs */}
              <div className="flex items-center bg-slate-100 p-1 rounded-xl text-[10px] font-bold">
                <button
                  onClick={() => setWalletSubTab('summary')}
                  className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                    walletSubTab === 'summary' ? 'bg-white text-slate-900 shadow-xs font-black' : 'text-slate-500'
                  }`}
                >
                  Summary
                </button>
                <button
                  onClick={() => setWalletSubTab('deposit')}
                  className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                    walletSubTab === 'deposit' ? 'bg-white text-slate-900 shadow-xs font-black' : 'text-slate-500'
                  }`}
                >
                  Deposit
                </button>
                <button
                  onClick={() => setWalletSubTab('transfer')}
                  className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                    walletSubTab === 'transfer' ? 'bg-white text-slate-900 shadow-xs font-black' : 'text-slate-500'
                  }`}
                >
                  Transfer
                </button>
                <button
                  onClick={() => setWalletSubTab('topup')}
                  className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                    walletSubTab === 'topup' ? 'bg-white text-slate-900 shadow-xs font-black' : 'text-slate-500'
                  }`}
                >
                  Top Up
                </button>
              </div>

              {/* Financial Summary Ledger Grid */}
              <div className="flex items-center justify-between gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-100">
                <div className="space-y-2 text-xs flex-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-500">Opening Balance</span>
                    <strong className="font-mono text-slate-900">
                      ₦{Number(walletReport?.opening_balance ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </strong>
                  </div>

                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-500">Total Deposits</span>
                    <strong className="font-mono text-emerald-600 font-extrabold">
                      ₦{Number(walletReport?.total_deposits ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </strong>
                  </div>

                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-500">Total Spent</span>
                    <strong className="font-mono text-rose-600 font-extrabold">
                      ₦{Number(walletReport?.total_spent ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </strong>
                  </div>

                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-500">Total Transfers</span>
                    <strong className="font-mono text-slate-900">
                      ₦{Number(walletReport?.total_transfers ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </strong>
                  </div>

                  <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between">
                    <span className="font-extrabold text-slate-900">Closing Balance</span>
                    <strong className="font-mono text-sm font-black text-blue-900">
                      ₦{Number(walletReport?.closing_balance ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </strong>
                  </div>
                </div>

                {/* 3D Wallet Graphic Box */}
                <div className="w-20 h-24 rounded-2xl bg-gradient-to-tr from-slate-900 to-slate-800 text-white flex flex-col items-center justify-center p-2 shadow-md border border-slate-700 shrink-0 text-center space-y-1">
                  <Wallet size={24} className="text-emerald-400" />
                  <span className="text-[8px] font-mono text-slate-400 uppercase block">Transport Wallet</span>
                </div>
              </div>
            </div>

            {/* ========================================================================= */}
            {/* SECTION 5: WITHDRAWAL REPORT */}
            {/* ========================================================================= */}
            <div id="withdrawal_report" className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-extrabold text-sm text-slate-900">5. Withdrawal Report</h3>
                <button
                  onClick={() => toast.info('Full Withdrawal report view')}
                  className="text-[11px] font-bold text-sky-600 hover:text-sky-800 transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <span>View Full Report</span>
                </button>
              </div>

              {/* Status Filter Tabs */}
              <div className="flex items-center bg-slate-100 p-1 rounded-xl text-[10px] font-bold">
                <button
                  onClick={() => setWithdrawalFilter('all')}
                  className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                    withdrawalFilter === 'all' ? 'bg-white text-slate-900 shadow-xs font-black' : 'text-slate-500'
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setWithdrawalFilter('successful')}
                  className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                    withdrawalFilter === 'successful' ? 'bg-white text-slate-900 shadow-xs font-black' : 'text-slate-500'
                  }`}
                >
                  Successful
                </button>
                <button
                  onClick={() => setWithdrawalFilter('pending')}
                  className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                    withdrawalFilter === 'pending' ? 'bg-white text-slate-900 shadow-xs font-black' : 'text-slate-500'
                  }`}
                >
                  Pending
                </button>
                <button
                  onClick={() => setWithdrawalFilter('failed')}
                  className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                    withdrawalFilter === 'failed' ? 'bg-white text-slate-900 shadow-xs font-black' : 'text-slate-500'
                  }`}
                >
                  Failed
                </button>
              </div>

              {/* Withdrawal History Rows / Empty State */}
              {withdrawalReport.length === 0 ? (
                <div className="p-8 text-center bg-slate-50/70 rounded-2xl border border-dashed border-slate-200 space-y-1">
                  <ArrowDownRight size={22} className="mx-auto text-slate-300" />
                  <p className="font-bold text-slate-700 text-xs">No Withdrawals Yet</p>
                  <p className="text-[10px] text-slate-400">Wallet balance withdrawal payouts to your linked bank accounts will show here.</p>
                </div>
              ) : (
                <div className="space-y-2 text-[11px]">
                  {withdrawalReport.map((w: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 block">{w.date}</span>
                        <strong className="font-extrabold text-slate-900">{w.destination}</strong>
                      </div>
                      <div className="text-right">
                        <strong className="font-mono text-slate-900 block font-extrabold">
                          ₦{Number(w.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </strong>
                        <span className="px-1.5 py-0.2 rounded-md bg-emerald-100 text-emerald-800 text-[9px] font-black uppercase">
                          {w.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ========================================================================= */}
            {/* SECTION 6: REFERRAL & BONUS REPORT */}
            {/* ========================================================================= */}
            <div id="referral_report" className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-extrabold text-sm text-slate-900">6. Referral &amp; Bonus Report</h3>
                <button
                  onClick={() => toast.info('Full Referral report view')}
                  className="text-[11px] font-bold text-sky-600 hover:text-sky-800 transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <span>View Full Report</span>
                </button>
              </div>

              {/* Referral Metric Row */}
              <div className="grid grid-cols-3 gap-2 text-center text-[10px] bg-slate-50 p-2.5 rounded-2xl border border-slate-100">
                <div>
                  <span className="text-slate-400 font-bold block text-[9px]">Total Referrals</span>
                  <strong className="text-sm font-black text-slate-900">{referralReport?.total_referrals ?? 0}</strong>
                </div>
                <div>
                  <span className="text-slate-400 font-bold block text-[9px]">Successful Referrals</span>
                  <strong className="text-sm font-black text-slate-900">{referralReport?.successful_referrals ?? 0}</strong>
                </div>
                <div>
                  <span className="text-slate-400 font-bold block text-[9px]">Bonuses Earned</span>
                  <strong className="text-xs font-black text-emerald-600 truncate block">
                    ₦{Number(referralReport?.bonuses_earned ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </strong>
                </div>
              </div>

              {/* Referral History List / Empty State */}
              {(!referralReport?.history || referralReport.history.length === 0) ? (
                <div className="p-8 text-center bg-slate-50/70 rounded-2xl border border-dashed border-slate-200 space-y-1">
                  <Gift size={22} className="mx-auto text-slate-300" />
                  <p className="font-bold text-slate-700 text-xs">No Referral Bonuses Yet</p>
                  <p className="text-[10px] text-slate-400">Invite fellow parents to earn wallet credits and bonus ride vouchers.</p>
                </div>
              ) : (
                <div className="space-y-2 text-[11px]">
                  {referralReport.history.map((item: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 block">{item.date}</span>
                        <strong className="font-extrabold text-slate-900">{item.type}</strong>
                      </div>
                      <strong className="font-mono text-emerald-600 font-extrabold">
                        ₦{Number(item.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </strong>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>

          {/* ------------------------------------------------------------------------- */}
          {/* ROW 4: OTHER REPORTS QUICK LINKS BAR */}
          {/* ------------------------------------------------------------------------- */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-xs space-y-4">
            <h3 className="font-extrabold text-sm text-slate-900">Other Reports</h3>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
              {/* Notifications Report */}
              <div
                id="notifications_report"
                onClick={() => toast.info('Opening Notifications Report...')}
                className="p-3.5 rounded-2xl bg-slate-50 hover:bg-slate-100 border border-slate-200/80 cursor-pointer transition-all space-y-1.5"
              >
                <Bell size={18} className="text-sky-600" />
                <h4 className="font-extrabold text-xs text-slate-900">Notifications Report</h4>
                <p className="text-[10px] text-slate-500">All notifications history</p>
              </div>

              {/* Service & Booking History */}
              <div
                onClick={() => toast.info('Opening Booking History Report...')}
                className="p-3.5 rounded-2xl bg-slate-50 hover:bg-slate-100 border border-slate-200/80 cursor-pointer transition-all space-y-1.5"
              >
                <History size={18} className="text-purple-600" />
                <h4 className="font-extrabold text-xs text-slate-900">Service &amp; Booking History</h4>
                <p className="text-[10px] text-slate-500">All bookings and services</p>
              </div>

              {/* Escrow & Settlement Report */}
              <div
                onClick={() => toast.info('Opening Escrow Report...')}
                className="p-3.5 rounded-2xl bg-slate-50 hover:bg-slate-100 border border-slate-200/80 cursor-pointer transition-all space-y-1.5"
              >
                <ShieldCheck size={18} className="text-amber-600" />
                <h4 className="font-extrabold text-xs text-slate-900">Escrow &amp; Settlement Report</h4>
                <p className="text-[10px] text-slate-500">Escrow transactions &amp; settlements</p>
              </div>

              {/* Attendance Report */}
              <div
                onClick={() => toast.info('Opening Attendance Report...')}
                className="p-3.5 rounded-2xl bg-slate-50 hover:bg-slate-100 border border-slate-200/80 cursor-pointer transition-all space-y-1.5"
              >
                <UserCheck size={18} className="text-emerald-600" />
                <h4 className="font-extrabold text-xs text-slate-900">Attendance Report</h4>
                <p className="text-[10px] text-slate-500">School attendance summary</p>
              </div>

              {/* Support & Complaints Report */}
              <div
                onClick={() => toast.info('Opening Support Report...')}
                className="p-3.5 rounded-2xl bg-slate-50 hover:bg-slate-100 border border-slate-200/80 cursor-pointer transition-all space-y-1.5"
              >
                <HelpCircle size={18} className="text-blue-600" />
                <h4 className="font-extrabold text-xs text-slate-900">Support &amp; Complaints Report</h4>
                <p className="text-[10px] text-slate-500">All support interactions</p>
              </div>
            </div>
          </div>
        </>
      )}

    </div>
  );
}
