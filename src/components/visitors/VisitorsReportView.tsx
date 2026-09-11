// @ts-nocheck
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Users,
  Search,
  Download,
  RefreshCw,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Building,
  Car,
  Phone,
  Calendar,
  Radio,
  ExternalLink,
  Filter,
  Eye,
  ShieldAlert,
  ShieldCheck,
  ChevronRight,
  MessageSquare,
  FileSpreadsheet
} from 'lucide-react';
import { toast } from 'sonner';
import { todayInLagos } from '@/lib/timezone';

interface VisitorRecord {
  id: string;
  digital_pass_token: string;
  full_name: string;
  phone: string;
  email?: string | null;
  purpose_of_visit: string;
  person_to_see: string;
  department: string;
  vehicle_plate: string;
  visitor_type: string;
  entry_time: string;
  exit_time?: string | null;
  duration_minutes?: number | null;
  computed_duration_minutes?: number;
  duration_formatted: string;
  status: 'on_campus' | 'departed';
  security_flag: 'cleared' | 'restricted' | 'flagged';
  host_response?: 'pending' | 'accepted' | 'declined';
  host_response_at?: string | null;
  host_response_notes?: string | null;
  action_taken: string;
}

interface VisitorsReportViewProps {
  schoolId?: string;
  title?: string;
}

export default function VisitorsReportView({
  schoolId,
  title = 'Visitors Report & Entry Log',
}: VisitorsReportViewProps) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [visitors, setVisitors] = useState<VisitorRecord[]>([]);
  const [summary, setSummary] = useState<any>(null);

  // Filters
  const [datePreset, setDatePreset] = useState<'today' | 'yesterday' | 'week' | 'month' | 'custom'>('today');
  const [customDate, setCustomDate] = useState(todayInLagos());
  const [statusFilter, setStatusFilter] = useState<'all' | 'on_campus' | 'departed' | 'pending' | 'accepted' | 'declined'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Decline modal state
  const [declineModalVisitor, setDeclineModalVisitor] = useState<VisitorRecord | null>(null);
  const [declineReasonPreset, setDeclineReasonPreset] = useState('Busy in a meeting / Cannot attend right now');
  const [customDeclineNote, setCustomDeclineNote] = useState('');
  const [submittingDecision, setSubmittingDecision] = useState(false);

  // Fetch visitors
  const loadVisitors = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const params = new URLSearchParams();
      if (schoolId) params.append('school_id', schoolId);

      // Date resolution
      if (datePreset === 'today') {
        params.append('date', todayInLagos());
      } else if (datePreset === 'yesterday') {
        const y = new Date();
        y.setDate(y.getDate() - 1);
        params.append('date', y.toISOString().split('T')[0]);
      } else if (datePreset === 'week') {
        const d = new Date();
        d.setDate(d.getDate() - 7);
        params.append('start_date', d.toISOString().split('T')[0]);
        params.append('end_date', todayInLagos());
      } else if (datePreset === 'month') {
        const d = new Date();
        d.setDate(1);
        params.append('start_date', d.toISOString().split('T')[0]);
        params.append('end_date', todayInLagos());
      } else if (datePreset === 'custom' && customDate) {
        params.append('date', customDate);
      }

      if (statusFilter !== 'all') {
        params.append('status', statusFilter);
      }

      if (searchQuery.trim()) {
        params.append('search', searchQuery.trim());
      }

      const res = await fetch(`/api/school-admin/reports/visitors?${params.toString()}`, {
        credentials: 'include',
        cache: 'no-store',
      });
      const data = await res.json();

      if (res.ok) {
        setVisitors(data.visitors || []);
        setSummary(data.summary || null);
      } else {
        toast.error(data.error || 'Failed to load visitor reports');
      }
    } catch (err) {
      console.warn('Visitor report fetch notice:', err);
    } finally {
      setLoading(false);
      if (isManual) {
        setTimeout(() => setRefreshing(false), 500);
      }
    }
  }, [schoolId, datePreset, customDate, statusFilter, searchQuery]);

  useEffect(() => {
    loadVisitors();
  }, [loadVisitors]);

  // Auto-refresh every 8s
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      loadVisitors();
    }, 8000);
    return () => clearInterval(interval);
  }, [autoRefresh, loadVisitors]);

  // Handle Accept Action
  const handleAcceptVisitor = async (visitor: VisitorRecord) => {
    try {
      setSubmittingDecision(true);
      const res = await fetch('/api/school-admin/reports/visitors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          school_id: schoolId,
          visitor_id: visitor.id,
          action: 'accept',
          reason: 'Approved by School Admin. Proceed to Reception.',
        }),
      });

      const data = await res.json();
      if (res.ok) {
        toast.success(`Visitor ${visitor.full_name} APPROVED. Gate officer informed to clear entry.`);
        loadVisitors();
      } else {
        toast.error(data.error || 'Failed to approve visitor');
      }
    } catch (err) {
      toast.error('Network error approving visitor');
    } finally {
      setSubmittingDecision(false);
    }
  };

  // Open Decline Dialog
  const openDeclineDialog = (visitor: VisitorRecord) => {
    setDeclineModalVisitor(visitor);
    setDeclineReasonPreset('Busy in a meeting / Cannot attend right now');
    setCustomDeclineNote('');
  };

  // Submit Decline Decision
  const handleConfirmDecline = async () => {
    if (!declineModalVisitor) return;
    const finalReason = customDeclineNote.trim() || declineReasonPreset;

    try {
      setSubmittingDecision(true);
      const res = await fetch('/api/school-admin/reports/visitors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          school_id: schoolId,
          visitor_id: declineModalVisitor.id,
          action: 'decline',
          reason: finalReason,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        toast.info(`Visitor ${declineModalVisitor.full_name} DECLINED (${finalReason}). Gate officer notified.`);
        setDeclineModalVisitor(null);
        loadVisitors();
      } else {
        toast.error(data.error || 'Failed to decline visitor');
      }
    } catch (err) {
      toast.error('Network error declining visitor');
    } finally {
      setSubmittingDecision(false);
    }
  };

  // Download CSV
  const handleDownloadCsv = () => {
    const params = new URLSearchParams();
    if (schoolId) params.append('school_id', schoolId);
    params.append('format', 'csv');

    if (datePreset === 'today') params.append('date', todayInLagos());
    else if (datePreset === 'yesterday') {
      const y = new Date();
      y.setDate(y.getDate() - 1);
      params.append('date', y.toISOString().split('T')[0]);
    } else if (datePreset === 'week') {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      params.append('start_date', d.toISOString().split('T')[0]);
      params.append('end_date', todayInLagos());
    } else if (datePreset === 'month') {
      const d = new Date();
      d.setDate(1);
      params.append('start_date', d.toISOString().split('T')[0]);
      params.append('end_date', todayInLagos());
    } else if (datePreset === 'custom') {
      params.append('date', customDate);
    }

    if (statusFilter !== 'all') params.append('status', statusFilter);
    if (searchQuery.trim()) params.append('search', searchQuery.trim());

    window.open(`/api/school-admin/reports/visitors?${params.toString()}`, '_blank');
  };

  return (
    <div className="space-y-6 font-sans text-slate-800">
      
      {/* 1. Header Banner & Top KPI Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        
        {/* Total Visitors */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-blue-50 text-blue-600 border border-blue-200 flex items-center justify-center shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
              Total Visitors
            </span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-xl font-black text-slate-900 leading-none">{summary?.total_visitors ?? visitors.length}</span>
              <span className="text-[11px] text-slate-500 font-bold">Logged</span>
            </div>
          </div>
        </div>

        {/* Currently On Campus */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center shrink-0">
            <Building className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
              On Campus Now
            </span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-xl font-black text-emerald-700 leading-none">{summary?.currently_on_campus ?? 0}</span>
              <span className="text-[11px] text-emerald-600 font-bold">Active</span>
            </div>
          </div>
        </div>

        {/* Pending Admin Action */}
        <div className={`rounded-2xl p-4 border shadow-xs flex items-center gap-3 ${
          (summary?.awaiting_admin_action ?? 0) > 0
            ? 'bg-amber-50/70 border-amber-300 ring-2 ring-amber-400/20'
            : 'bg-white border-slate-200'
        }`}>
          <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
            (summary?.awaiting_admin_action ?? 0) > 0
              ? 'bg-amber-100 text-amber-800 border border-amber-300'
              : 'bg-slate-50 text-slate-500 border border-slate-200'
          }`}>
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block">
              Awaiting Action
            </span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className={`text-xl font-black leading-none ${
                (summary?.awaiting_admin_action ?? 0) > 0 ? 'text-amber-800' : 'text-slate-900'
              }`}>
                {summary?.awaiting_admin_action ?? 0}
              </span>
              <span className="text-[11px] text-amber-700 font-bold">Needs Decision</span>
            </div>
          </div>
        </div>

        {/* Approved / Cleared */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-teal-50 text-teal-600 border border-teal-200 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
              Approved Visits
            </span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-xl font-black text-slate-900 leading-none">{summary?.accepted_count ?? 0}</span>
              <span className="text-[11px] text-teal-600 font-bold">Cleared</span>
            </div>
          </div>
        </div>

        {/* Declined */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex items-center gap-3 col-span-2 lg:col-span-1">
          <div className="w-11 h-11 rounded-2xl bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center shrink-0">
            <XCircle className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
              Declined Visits
            </span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-xl font-black text-rose-700 leading-none">{summary?.declined_count ?? 0}</span>
              <span className="text-[11px] text-rose-600 font-bold">Turned Away</span>
            </div>
          </div>
        </div>

      </div>

      {/* 2. Control Toolbar (Date, Status, Search, Export) */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs space-y-4">
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-extrabold text-slate-900">{title}</h2>
            <p className="text-xs text-slate-500">
              Audit trails of campus entries, exit timestamps, host approvals, and gate officer decisions.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadCsv}
              className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
            >
              <Download size={13} />
              <span>Export CSV</span>
            </button>

            <button
              type="button"
              onClick={() => loadVisitors(true)}
              disabled={refreshing}
              className="px-3.5 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold text-xs border border-slate-200 flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
            >
              <RefreshCw size={13} className={refreshing ? 'animate-spin text-emerald-600' : ''} />
              <span>{refreshing ? 'Refreshing...' : 'Sync'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setAutoRefresh(!autoRefresh);
                toast.info(autoRefresh ? 'Auto-refresh paused' : 'Auto-refresh resumed (8s)');
              }}
              className={`px-3 py-2 rounded-xl font-bold text-xs border flex items-center gap-1.5 transition-all cursor-pointer ${
                autoRefresh
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                  : 'bg-slate-50 text-slate-500 border-slate-200'
              }`}
            >
              <Radio size={13} className={autoRefresh ? 'animate-pulse text-emerald-600' : ''} />
              <span className="hidden sm:inline">{autoRefresh ? 'Live (8s)' : 'Paused'}</span>
            </button>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 pt-3 border-t border-slate-100">
          
          {/* Date Presets (5 Cols) */}
          <div className="md:col-span-5 flex flex-wrap items-center gap-1.5 text-xs font-bold bg-slate-50 p-1 rounded-2xl border border-slate-200">
            <button
              type="button"
              onClick={() => setDatePreset('today')}
              className={`px-3 py-1.5 rounded-xl transition-all ${
                datePreset === 'today' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => setDatePreset('yesterday')}
              className={`px-3 py-1.5 rounded-xl transition-all ${
                datePreset === 'yesterday' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Yesterday
            </button>
            <button
              type="button"
              onClick={() => setDatePreset('week')}
              className={`px-3 py-1.5 rounded-xl transition-all ${
                datePreset === 'week' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              7 Days
            </button>
            <button
              type="button"
              onClick={() => setDatePreset('month')}
              className={`px-3 py-1.5 rounded-xl transition-all ${
                datePreset === 'month' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              This Month
            </button>
            <button
              type="button"
              onClick={() => setDatePreset('custom')}
              className={`px-3 py-1.5 rounded-xl transition-all ${
                datePreset === 'custom' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Custom
            </button>
          </div>

          {/* Custom Date Picker (if active) */}
          {datePreset === 'custom' && (
            <div className="md:col-span-3">
              <input
                type="date"
                value={customDate}
                onChange={(e) => setCustomDate(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>
          )}

          {/* Search Input (Remaining cols) */}
          <div className={`${datePreset === 'custom' ? 'md:col-span-4' : 'md:col-span-7'} relative`}>
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              placeholder="Search visitor, phone, plate, pass token, person to see..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
          </div>

        </div>

        {/* Status Pills */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase mr-1">Status:</span>
          {[
            { id: 'all', label: 'All Records' },
            { id: 'pending', label: 'Awaiting Action' },
            { id: 'on_campus', label: 'Currently On Campus' },
            { id: 'accepted', label: 'Approved' },
            { id: 'declined', label: 'Declined' },
            { id: 'departed', label: 'Departed' },
          ].map((pill) => (
            <button
              key={pill.id}
              type="button"
              onClick={() => setStatusFilter(pill.id as any)}
              className={`px-3 py-1 rounded-full font-extrabold text-xs transition-all cursor-pointer ${
                statusFilter === pill.id
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {pill.label}
            </button>
          ))}
        </div>

      </div>

      {/* 3. Visitors Ledger Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
        
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-sm animate-pulse">
            Loading visitor records and gate ledger...
          </div>
        ) : visitors.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
              <Users size={22} />
            </div>
            <p className="text-sm font-bold text-slate-700">No visitor records found for this period</p>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Any visitor registered at the school gate will automatically appear here with their arrival timestamp and purpose.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-extrabold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">Visitor Identity</th>
                  <th className="py-3 px-4">Time of Visit & Exit</th>
                  <th className="py-3 px-4">Purpose & Host</th>
                  <th className="py-3 px-4">Vehicle Plate</th>
                  <th className="py-3 px-4">Action Taken</th>
                  <th className="py-3 px-4 text-right">Admin Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visitors.map((v) => {
                  const isPending = v.host_response === 'pending' || !v.host_response;
                  const isAccepted = v.host_response === 'accepted';
                  const isDeclined = v.host_response === 'declined';
                  const isOnCampus = v.status === 'on_campus';

                  const entryDate = v.entry_time ? new Date(v.entry_time) : null;
                  const exitDate = v.exit_time ? new Date(v.exit_time) : null;

                  return (
                    <tr key={v.id} className="hover:bg-slate-50/50 transition-colors">
                      
                      {/* Visitor Identity */}
                      <td className="py-3.5 px-4">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-extrabold text-slate-900 text-sm block truncate max-w-[170px]">
                              {v.full_name}
                            </span>
                            <span className="text-[9px] font-black uppercase px-1.5 py-0.2 rounded-md bg-slate-100 text-slate-600">
                              {v.visitor_type || 'Visitor'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 text-slate-500 text-[11px]">
                            <span>📞 {v.phone}</span>
                            <span className="text-slate-300">•</span>
                            <span className="font-mono text-slate-400 text-[10px]">{v.digital_pass_token || 'PASS'}</span>
                          </div>
                        </div>
                      </td>

                      {/* Time of Visit & Exit */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5 font-bold text-slate-800">
                            <Clock size={12} className="text-emerald-600" />
                            <span>In: {entryDate ? entryDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</span>
                            <span className="text-slate-400 text-[10px] font-normal">
                              ({entryDate ? entryDate.toLocaleDateString() : ''})
                            </span>
                          </div>

                          <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                            {exitDate ? (
                              <span>Out: {exitDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            ) : (
                              <span className="text-emerald-700 font-extrabold bg-emerald-50 px-1.5 py-0.2 rounded text-[10px]">
                                ● On Campus ({v.duration_formatted})
                              </span>
                            )}
                          </div>

                          {exitDate && (
                            <span className="text-[10px] text-slate-400 block font-medium">
                              Spent: {v.duration_formatted}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Purpose & Host */}
                      <td className="py-3.5 px-4 max-w-[200px]">
                        <div>
                          <p className="font-bold text-slate-800 truncate" title={v.purpose_of_visit}>
                            {v.purpose_of_visit}
                          </p>
                          <p className="text-[11px] text-slate-500 truncate" title={`To see: ${v.person_to_see} (${v.department})`}>
                            To see: <span className="font-semibold text-slate-700">{v.person_to_see}</span>
                          </p>
                        </div>
                      </td>

                      {/* Vehicle Plate */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {v.vehicle_plate && v.vehicle_plate !== 'N/A' ? (
                          <span className="font-mono font-black text-slate-800 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                            {v.vehicle_plate}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">No Vehicle</span>
                        )}
                      </td>

                      {/* Action Taken */}
                      <td className="py-3.5 px-4 max-w-[190px]">
                        <div className="space-y-1">
                          {isAccepted && (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-black text-[10px] uppercase flex items-center gap-1 w-fit">
                              <CheckCircle2 size={11} /> Approved
                            </span>
                          )}
                          {isDeclined && (
                            <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 font-black text-[10px] uppercase flex items-center gap-1 w-fit">
                              <XCircle size={11} /> Declined
                            </span>
                          )}
                          {isPending && (
                            <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-black text-[10px] uppercase flex items-center gap-1 w-fit">
                              <Clock size={11} /> Awaiting Action
                            </span>
                          )}

                          <p className="text-[10px] text-slate-500 truncate" title={v.action_taken}>
                            {v.action_taken}
                          </p>
                        </div>
                      </td>

                      {/* Admin Decision Controls */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        {isPending ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleAcceptVisitor(v)}
                              disabled={submittingDecision}
                              className="px-2.5 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[11px] flex items-center gap-1 shadow-2xs transition-all cursor-pointer disabled:opacity-50"
                              title="Approve entry for this visitor"
                            >
                              <CheckCircle2 size={12} />
                              <span>Accept</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => openDeclineDialog(v)}
                              disabled={submittingDecision}
                              className="px-2.5 py-1 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-black text-[11px] flex items-center gap-1 transition-all cursor-pointer disabled:opacity-50"
                              title="Decline if busy or not around"
                            >
                              <XCircle size={12} />
                              <span>Decline</span>
                            </button>
                          </div>
                        ) : isAccepted ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                              Entry Cleared
                            </span>
                            <button
                              type="button"
                              onClick={() => openDeclineDialog(v)}
                              className="text-[10px] text-slate-400 hover:text-rose-600 underline cursor-pointer"
                            >
                              Revoke
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-1.5">
                            <span className="text-[10px] text-rose-700 font-bold bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
                              Gate Informed
                            </span>
                            <button
                              type="button"
                              onClick={() => handleAcceptVisitor(v)}
                              className="text-[10px] text-slate-400 hover:text-emerald-600 underline cursor-pointer"
                            >
                              Re-clear
                            </button>
                          </div>
                        )}
                      </td>

                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

      </div>

      {/* 4. Decline Decision Modal */}
      {declineModalVisitor && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center font-bold">
                  <XCircle size={18} />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-base">Decline Visitor</h3>
                  <p className="text-xs text-slate-500">Gate officer will politely inform visitor</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDeclineModalVisitor(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            {/* Visitor Details Recap */}
            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 space-y-1 text-xs">
              <p className="font-extrabold text-slate-900">
                {declineModalVisitor.full_name} ({declineModalVisitor.phone})
              </p>
              <p className="text-slate-600">
                <b>Purpose:</b> {declineModalVisitor.purpose_of_visit}
              </p>
              <p className="text-slate-600">
                <b>Seeking:</b> {declineModalVisitor.person_to_see} ({declineModalVisitor.department})
              </p>
            </div>

            {/* Reason Presets */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 block">
                Select Reason for Declining / Turning Away:
              </label>
              {[
                'Busy in a meeting / Cannot attend right now',
                'Not around / Out of campus today',
                'Please reschedule / By appointment only',
                'Official school visiting hours have ended',
              ].map((reason) => (
                <label
                  key={reason}
                  onClick={() => setDeclineReasonPreset(reason)}
                  className={`p-2.5 rounded-xl border flex items-center gap-2 text-xs font-semibold cursor-pointer transition-all ${
                    declineReasonPreset === reason
                      ? 'bg-rose-50 border-rose-300 text-rose-900 ring-1 ring-rose-300'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="declineReason"
                    checked={declineReasonPreset === reason}
                    onChange={() => setDeclineReasonPreset(reason)}
                    className="accent-rose-600"
                  />
                  <span>{reason}</span>
                </label>
              ))}
            </div>

            {/* Optional Custom Note */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 block">
                Additional Note for Gate Officer (Optional):
              </label>
              <textarea
                value={customDeclineNote}
                onChange={(e) => setCustomDeclineNote(e.target.value)}
                placeholder="e.g., Ask visitor to return on Thursday at 10 AM, or email the bursary..."
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-rose-500/20"
                rows={2}
              />
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDeclineModalVisitor(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDecline}
                disabled={submittingDecision}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 shadow-md cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                <XCircle size={14} />
                <span>Confirm & Inform Gate</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
