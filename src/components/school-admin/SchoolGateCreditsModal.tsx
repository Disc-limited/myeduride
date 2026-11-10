'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  X,
  CreditCard,
  ShieldCheck,
  Sparkles,
  CheckCircle2,
  ArrowUpRight,
  ArrowDownLeft,
  Clock,
  FileText,
  Mail,
  Download,
  RefreshCw,
  Wallet,
  Gift,
  Search,
  AlertTriangle,
  Plus,
} from 'lucide-react';
import { toast } from 'sonner';

interface GateCreditPackage {
  id: string;
  name: string;
  units: number;
  price_kobo: number;
  price_ngn: number;
  daily_equivalent: number;
  description: string;
  badge_text?: string | null;
}

interface GateCreditLedgerItem {
  id: string;
  entry_type: 'PURCHASE' | 'FREE_TRIAL' | 'CONSUMPTION_SCAN' | 'ADJUSTMENT_CREDIT' | 'ADJUSTMENT_DEBIT';
  units_delta: number;
  units_before: number;
  units_after: number;
  amount_ngn: number;
  package_id?: string | null;
  person_name?: string | null;
  person_code?: string | null;
  person_role?: string | null;
  scan_type?: 'clock_in' | 'clock_out' | 'manual' | null;
  reference: string;
  description: string;
  created_at: string;
}

interface SchoolGateCreditsModalProps {
  isOpen: boolean;
  onClose: () => void;
  schoolId?: string;
  initialTab?: 'ledger' | 'purchase' | 'reports';
  isSuperAdmin?: boolean;
  schoolsList?: Array<{ id: string; name: string; gate_credit_units?: number }>;
  onSelectSchool?: (schoolId: string) => void;
  onUpdated?: () => void;
}

export default function SchoolGateCreditsModal({
  isOpen,
  onClose,
  schoolId,
  initialTab = 'ledger',
  isSuperAdmin = false,
  schoolsList,
  onSelectSchool,
  onUpdated,
}: SchoolGateCreditsModalProps) {
  const [activeTab, setActiveTab] = useState<'ledger' | 'purchase' | 'reports'>(initialTab);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);

  // Purchase States
  const [selectedPurpose, setSelectedPurpose] = useState<'school_gate_credit'>('school_gate_credit');
  const [selectedPackageId, setSelectedPackageId] = useState<string>('PKG_25');
  const [customUnits, setCustomUnits] = useState<number>(25);
  const [purchasing, setPurchasing] = useState(false);
  const [purchaseReceipt, setPurchaseReceipt] = useState<any | null>(null);
  const [claimingTrial, setClaimingTrial] = useState(false);

  // Super Admin Direct Adjustment States
  const [adjustType, setAdjustType] = useState<'CREDIT' | 'DEBIT'>('CREDIT');
  const [adjustUnits, setAdjustUnits] = useState<number>(25);
  const [adjustReason, setAdjustReason] = useState<string>('');
  const [adjusting, setAdjusting] = useState(false);

  // Ledger Filter States
  const [filterType, setFilterType] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Monthly Report States
  const [reportMonth, setReportMonth] = useState<string>(new Date().toISOString().slice(0, 7));
  const [sendingReport, setSendingReport] = useState(false);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab, isOpen]);

  const loadCreditsData = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (schoolId) qs.set('school_id', schoolId);
      qs.set('limit', '150');
      const res = await fetch(`/api/schools/gate-credits?${qs.toString()}`, {
        credentials: 'include',
        cache: 'no-store',
      });
      const json = await res.json();
      if (res.ok) {
        setData(json);
      } else {
        toast.error(json.error || 'Could not load gate credit records');
      }
    } catch (err: any) {
      console.error('[SchoolGateCreditsModal] Error:', err);
    } finally {
      setLoading(false);
    }
  }, [schoolId]);

  useEffect(() => {
    if (isOpen) {
      setPurchaseReceipt(null);
      loadCreditsData();
    }
  }, [isOpen, loadCreditsData]);

  if (!isOpen) return null;

  const credits = data?.credits || {
    remaining_units: 0,
    remaining_scans: 0,
    status: 'healthy',
    free_trial_claimed: false,
  };
  const wallet = data?.wallet || { available_balance_ngn: 0 };
  const packages: GateCreditPackage[] = data?.packages || [
    { id: 'PKG_25', name: 'Starter Credit Bundle', units: 25, price_kobo: 300000, price_ngn: 3000, daily_equivalent: 25, description: '25 Units · 50 Clock-In/Out Scans', badge_text: 'Starter' },
    { id: 'PKG_50', name: 'Standard Growth Bundle', units: 50, price_kobo: 600000, price_ngn: 6000, daily_equivalent: 50, description: '50 Units · 100 Clock-In/Out Scans', badge_text: 'Most Popular' },
    { id: 'PKG_100', name: 'Institutional Pro Bundle', units: 100, price_kobo: 1200000, price_ngn: 12000, daily_equivalent: 100, description: '100 Units · 200 Clock-In/Out Scans', badge_text: 'Best Value' },
  ];
  const summary = data?.summary || {
    total_units_purchased: 0,
    total_units_trial: 0,
    total_units_consumed: 0,
    month_units_consumed: 0,
    today_units_consumed: 0,
    total_clock_ins: 0,
    total_clock_outs: 0,
  };
  const ledger: GateCreditLedgerItem[] = data?.ledger || [];
  const monthlyReports = data?.monthly_reports || [];

  const selectedPkg =
    selectedPackageId === 'CUSTOM'
      ? {
          id: 'CUSTOM',
          name: `Custom ${customUnits} Units Bundle`,
          units: customUnits,
          price_ngn: customUnits * 120,
        }
      : packages.find((p) => p.id === selectedPackageId) || packages[0];

  const handlePurchaseCredits = async () => {
    if (!selectedPkg) return;
    setPurchasing(true);
    setPurchaseReceipt(null);
    try {
      const res = await fetch('/api/schools/gate-credits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'purchase',
          school_id: schoolId || data?.school?.id,
          package_id: selectedPackageId,
          custom_units: selectedPackageId === 'CUSTOM' ? customUnits : undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.error || 'Failed to purchase Gate Credit Units');
        return;
      }

      toast.success(`Purchased ${json.units_purchased} Gate Credit Units! New balance: ${json.new_units} Units.`);
      setPurchaseReceipt(json);
      await loadCreditsData();
      if (onUpdated) onUpdated();
    } catch (err: any) {
      toast.error(err.message || 'Purchase failed');
    } finally {
      setPurchasing(false);
    }
  };

  const handleClaimFreeTrial = async () => {
    setClaimingTrial(true);
    try {
      const res = await fetch('/api/schools/gate-credits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'claim_free_trial',
          school_id: schoolId || data?.school?.id,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.error || 'Could not claim free trial');
        return;
      }
      toast.success('25 Free Trial Gate Credit Units activated!');
      await loadCreditsData();
      if (onUpdated) onUpdated();
    } catch (err: any) {
      toast.error(err.message || 'Failed to claim trial');
    } finally {
      setClaimingTrial(false);
    }
  };

  const handleSuperAdminAdjust = async () => {
    if (!adjustUnits || adjustUnits <= 0) {
      toast.error('Please enter a valid number of units');
      return;
    }
    setAdjusting(true);
    try {
      const res = await fetch('/api/schools/gate-credits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'super_admin_adjust',
          school_id: schoolId || data?.school?.id,
          adjust_type: adjustType,
          units: adjustUnits,
          reason: adjustReason,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.error || 'Failed to adjust Gate Credit Units');
        return;
      }
      toast.success(json.message || 'Gate Credit Units updated!');
      setAdjustReason('');
      await loadCreditsData();
      if (onUpdated) onUpdated();
    } catch (err: any) {
      toast.error(err.message || 'Error adjusting units');
    } finally {
      setAdjusting(false);
    }
  };

  const handleSendMonthlyReport = async () => {
    setSendingReport(true);
    try {
      const res = await fetch('/api/schools/gate-credits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send_monthly_report',
          school_id: schoolId || data?.school?.id,
          report_month: reportMonth,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.error || 'Failed to generate monthly report');
        return;
      }
      toast.success(json.message || 'Monthly report sent via email and app notification!');
      await loadCreditsData();
    } catch (err: any) {
      toast.error(err.message || 'Error sending monthly report');
    } finally {
      setSendingReport(false);
    }
  };

  const handleExportCsv = () => {
    if (!ledger.length) {
      toast.info('No credit transactions to export');
      return;
    }
    const headers = ['Date & Time', 'Type', 'Person Name', 'ID Code', 'Action', 'Units Delta', 'Balance After (Units)', 'Amount (NGN)', 'Reference', 'Description'];
    const rows = filteredLedger.map((item) => [
      new Date(item.created_at).toLocaleString('en-NG', { timeZone: 'Africa/Lagos' }),
      item.entry_type,
      item.person_name || '-',
      item.person_code || '-',
      item.scan_type || '-',
      item.units_delta > 0 ? `+${item.units_delta.toFixed(1)}` : item.units_delta.toFixed(1),
      item.units_after.toFixed(1),
      item.amount_ngn.toFixed(2),
      item.reference,
      `"${(item.description || '').replace(/"/g, '""')}"`,
    ]);
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `school-gate-credits-ledger-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredLedger = ledger.filter((item) => {
    if (filterType !== 'ALL' && item.entry_type !== filterType) return false;
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      return (
        (item.description || '').toLowerCase().includes(q) ||
        (item.person_name || '').toLowerCase().includes(q) ||
        (item.person_code || '').toLowerCase().includes(q) ||
        (item.reference || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-3 sm:p-6 overflow-y-auto">
      <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* TOP HEADER */}
        <div className="bg-gradient-to-r from-[#042f2e] via-[#064e3b] to-[#0f172a] text-white px-6 py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-300 shadow-inner shrink-0">
              <CreditCard size={24} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-emerald-400/20 text-emerald-300 border border-emerald-400/30">
                  School Gate Manager
                </span>
                {data?.school?.name && (
                  <span className="text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-white/15 text-white border border-white/20 truncate max-w-[260px]">
                    🏫 {data.school.name}
                  </span>
                )}
                <span className="text-xs text-emerald-200/80 font-medium hidden md:inline">
                  1 Unit = ₦6/day (Clock-In 0.5U + Clock-Out 0.5U)
                </span>
              </div>
              <h2 className="text-lg sm:text-xl font-black tracking-tight mt-0.5">
                School Gate Credit System &amp; Audit Ledger
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isSuperAdmin && schoolsList && schoolsList.length > 0 && onSelectSchool && (
              <select
                value={schoolId || data?.school?.id || ''}
                onChange={(e) => {
                  if (e.target.value) onSelectSchool(e.target.value);
                }}
                aria-label="Select School for Gate Credits"
                className="px-3 py-2 rounded-xl bg-white/15 hover:bg-white/20 text-white text-xs font-bold border border-white/25 focus:outline-none focus:ring-2 focus:ring-emerald-400 max-w-[230px] truncate cursor-pointer"
              >
                {schoolsList.map((s) => (
                  <option key={s.id} value={s.id} className="text-slate-900 bg-white font-semibold">
                    {s.name} ({Number(s.gate_credit_units ?? 25).toFixed(1)}U)
                  </option>
                ))}
              </select>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition"
              aria-label="Close modal"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* SUMMARY BAR */}
        <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 grid grid-cols-2 sm:grid-cols-4 gap-3 shrink-0">
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
              Available Credit Units
            </span>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-2xl font-black text-emerald-700 font-mono">
                {Number(credits.remaining_units || 0).toFixed(1)}
              </span>
              <span className="text-xs font-bold text-slate-600">Units</span>
            </div>
            <span className="text-[11px] text-slate-500 font-medium">
              Covers {credits.remaining_scans || 0} gate clock-in/out scans
            </span>
          </div>

          <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
              School Wallet Float
            </span>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-xl font-black text-slate-900">
                ₦{Number(wallet.available_balance_ngn || 0).toLocaleString('en-NG', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <Link
              href="/dashboard/school-admin/wallet"
              onClick={onClose}
              className="text-[11px] font-bold text-emerald-700 hover:underline inline-flex items-center gap-0.5 mt-0.5"
            >
              Fund Wallet <ArrowUpRight size={11} />
            </Link>
          </div>

          <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
              Units Spent (This Month)
            </span>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-xl font-black text-rose-600 font-mono">
                {Number(summary.month_units_consumed || 0).toFixed(1)}
              </span>
              <span className="text-xs font-bold text-slate-500">Units</span>
            </div>
            <span className="text-[11px] text-slate-500 font-medium">
              {summary.total_clock_ins || 0} In · {summary.total_clock_outs || 0} Out
            </span>
          </div>

          <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col justify-between">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
              Quick Action
            </span>
            <button
              type="button"
              onClick={() => setActiveTab(activeTab === 'purchase' ? 'ledger' : 'purchase')}
              className="mt-1.5 w-full py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs shadow-sm transition flex items-center justify-center gap-1.5"
            >
              <Plus size={14} />
              <span>{activeTab === 'purchase' ? 'View Audit Ledger' : 'Buy Gate Credits'}</span>
            </button>
          </div>
        </div>

        {/* NAVIGATION TABS */}
        <div className="px-6 pt-3 bg-white border-b border-slate-200 flex items-center justify-between gap-2 shrink-0 flex-wrap">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('ledger')}
              className={`px-4 py-2.5 text-xs font-extrabold border-b-2 transition-all flex items-center gap-1.5 ${
                activeTab === 'ledger'
                  ? 'border-emerald-600 text-emerald-700 bg-emerald-50/50 rounded-t-xl'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <FileText size={15} />
              <span>Transaction History &amp; Units Spent ({ledger.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('purchase')}
              className={`px-4 py-2.5 text-xs font-extrabold border-b-2 transition-all flex items-center gap-1.5 ${
                activeTab === 'purchase'
                  ? 'border-emerald-600 text-emerald-700 bg-emerald-50/50 rounded-t-xl'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <CreditCard size={15} />
              <span>Purchase Gate Credits</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('reports')}
              className={`px-4 py-2.5 text-xs font-extrabold border-b-2 transition-all flex items-center gap-1.5 ${
                activeTab === 'reports'
                  ? 'border-emerald-600 text-emerald-700 bg-emerald-50/50 rounded-t-xl'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Mail size={15} />
              <span>Monthly Email &amp; App Reports</span>
            </button>
          </div>

          <button
            type="button"
            onClick={loadCreditsData}
            className="p-2 text-slate-400 hover:text-slate-700 rounded-lg"
            title="Refresh"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin text-emerald-600' : ''} />
          </button>
        </div>

        {/* BODY CONTENT */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          {/* FREE TRIAL BANNER IF NOT YET CLAIMED */}
          {!credits.free_trial_claimed && (
            <div className="bg-gradient-to-r from-amber-50 via-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="p-2.5 rounded-xl bg-emerald-600 text-white shrink-0">
                  <Gift size={20} />
                </div>
                <div>
                  <h4 className="text-sm font-black text-slate-900">
                    New School Onboarding Free Trial — 25 Credit Units Available!
                  </h4>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Claim your complimentary 25 Gate Credit Units (worth ₦3,000) to test student and staff clock-in/clock-out before paying.
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={claimingTrial}
                onClick={handleClaimFreeTrial}
                className="px-4 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-extrabold text-xs shrink-0 shadow-sm disabled:opacity-50"
              >
                {claimingTrial ? 'Activating...' : 'Claim 25 Free Units'}
              </button>
            </div>
          )}

          {/* TAB 1: TRANSACTION LEDGER */}
          {activeTab === 'ledger' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {[
                    { key: 'ALL', label: 'All Transactions' },
                    { key: 'CONSUMPTION_SCAN', label: 'Gate Scans (-0.5U)' },
                    { key: 'PURCHASE', label: 'Credit Purchases' },
                    { key: 'FREE_TRIAL', label: 'Free Trial' },
                  ].map((tab) => (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setFilterType(tab.key)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                        filterType === tab.key
                          ? 'bg-slate-900 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Search student, staff, ref..."
                      className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-hidden focus:border-emerald-500"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleExportCsv}
                    className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-1.5"
                  >
                    <Download size={13} />
                    <span>CSV</span>
                  </button>
                </div>
              </div>

              <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                        <th className="py-3 px-4">Date &amp; Time</th>
                        <th className="py-3 px-4">Type</th>
                        <th className="py-3 px-4">Documented Activity / User</th>
                        <th className="py-3 px-4 text-right">Units</th>
                        <th className="py-3 px-4 text-right">Balance After</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {loading ? (
                        <tr>
                          <td colSpan={5} className="py-12 text-center text-slate-400 font-medium">
                            Loading documented credit transactions...
                          </td>
                        </tr>
                      ) : filteredLedger.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-12 text-center text-slate-500">
                            No credit transactions match the current filter.
                          </td>
                        </tr>
                      ) : (
                        filteredLedger.map((item) => {
                          const isCredit = item.units_delta >= 0;
                          return (
                            <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                              <td className="py-3 px-4 whitespace-nowrap text-slate-500 font-medium">
                                {new Date(item.created_at).toLocaleString('en-NG', {
                                  timeZone: 'Africa/Lagos',
                                  day: '2-digit',
                                  month: 'short',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </td>
                              <td className="py-3 px-4 whitespace-nowrap">
                                {item.entry_type === 'PURCHASE' ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800">
                                    <ArrowDownLeft size={11} /> Purchase
                                  </span>
                                ) : item.entry_type === 'FREE_TRIAL' ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-800">
                                    <Gift size={11} /> Free Trial
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-50 text-blue-700">
                                    <Clock size={11} /> {item.scan_type === 'clock_out' ? 'Clock-Out' : 'Clock-In'}
                                  </span>
                                )}
                              </td>
                              <td className="py-3 px-4">
                                <div className="font-bold text-slate-900">{item.description}</div>
                                <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                                  Ref: {item.reference}
                                  {item.amount_ngn > 0 ? ` • ₦${item.amount_ngn.toLocaleString()}` : ''}
                                </div>
                              </td>
                              <td
                                className={`py-3 px-4 text-right font-mono font-black whitespace-nowrap ${
                                  isCredit ? 'text-emerald-600' : 'text-rose-600'
                                }`}
                              >
                                {isCredit ? `+${item.units_delta.toFixed(1)}` : item.units_delta.toFixed(1)} Units
                              </td>
                              <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                                {item.units_after.toFixed(1)} Units
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: PURCHASE GATE CREDITS FROM WALLET */}
          {activeTab === 'purchase' && (
            <div className="space-y-5">
              {/* Purchase Confirmation Banner */}
              {purchaseReceipt && (
                <div className="bg-emerald-50 border-2 border-emerald-500 rounded-2xl p-5 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-emerald-800 font-black text-sm">
                      <CheckCircle2 size={20} className="text-emerald-600" />
                      <span>Gate Credit Purchase Confirmed!</span>
                    </div>
                    <span className="text-xs font-mono font-bold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-lg">
                      {purchaseReceipt.reference}
                    </span>
                  </div>
                  <p className="text-xs text-emerald-900 font-medium">
                    Deducted <strong>₦{Number(purchaseReceipt.debited_ngn).toLocaleString()}</strong> from your School Wallet and credited{' '}
                    <strong>+{purchaseReceipt.units_purchased} Gate Credit Units</strong> ({purchaseReceipt.package_name}). Your updated Gate Credit balance is{' '}
                    <strong>{purchaseReceipt.new_units} Units</strong>.
                  </p>
                </div>
              )}

              {/* Step 1: Indicate What You Want to Pay For */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
                <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-500 mb-2">
                  1. Select Payment Purpose (From Institutional Wallet)
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setSelectedPurpose('school_gate_credit')}
                    className="flex items-center justify-between p-3.5 rounded-xl border-2 border-emerald-600 bg-white shadow-2xs text-left"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-emerald-100 text-emerald-700">
                        <ShieldCheck size={18} />
                      </div>
                      <div>
                        <p className="text-xs font-black text-slate-900">School Gate Credit</p>
                        <p className="text-[11px] text-slate-500">Prepaid Clock-In &amp; Clock-Out Attendance Units</p>
                      </div>
                    </div>
                    <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
                  </button>

                  <div className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 bg-white/70 text-left">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-slate-100 text-slate-600">
                        <Wallet size={18} />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-700">Available Wallet Balance</p>
                        <p className="text-sm font-black text-slate-900">
                          ₦{Number(wallet.available_balance_ngn || 0).toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                    </div>
                    <Link
                      href="/dashboard/school-admin/wallet"
                      onClick={onClose}
                      className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-[11px] font-bold hover:bg-slate-800"
                    >
                      Top Up Wallet
                    </Link>
                  </div>
                </div>
              </div>

              {/* Step 2: Select Credit Package Option */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
                    2. Choose Gate Credit Unit Package
                  </label>
                  <span className="text-[11px] font-semibold text-emerald-700">
                    1 Unit = ₦6/day (Clock-In 0.5U + Clock-Out 0.5U)
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                  {packages.map((pkg) => {
                    const isSelected = selectedPackageId === pkg.id;
                    return (
                      <button
                        key={pkg.id}
                        type="button"
                        onClick={() => setSelectedPackageId(pkg.id)}
                        className={`relative p-4 rounded-2xl border-2 text-left transition-all flex flex-col justify-between ${
                          isSelected
                            ? 'border-emerald-600 bg-emerald-50/40 shadow-md'
                            : 'border-slate-200 bg-white hover:border-slate-300'
                        }`}
                      >
                        {pkg.badge_text && (
                          <span
                            className={`self-start px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider mb-2 ${
                              isSelected ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {pkg.badge_text}
                          </span>
                        )}
                        <div>
                          <div className="flex items-baseline justify-between">
                            <span className="text-2xl font-black text-slate-900">{pkg.units} Units</span>
                            <span className="text-base font-black text-emerald-700">
                              ₦{Number(pkg.price_ngn).toLocaleString()}
                            </span>
                          </div>
                          <p className="text-xs font-bold text-slate-700 mt-1">{pkg.name}</p>
                          <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                            {pkg.description || `${pkg.units} Gate Credit Units (${pkg.units * 2} clock-in/out scans)`}
                          </p>
                        </div>
                      </button>
                    );
                  })}

                  {/* Custom Multiples of 25 Units */}
                  <div
                    onClick={() => setSelectedPackageId('CUSTOM')}
                    className={`p-4 rounded-2xl border-2 text-left transition-all cursor-pointer flex flex-col justify-between ${
                      selectedPackageId === 'CUSTOM'
                        ? 'border-emerald-600 bg-emerald-50/40 shadow-md'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div>
                      <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider mb-2 bg-slate-100 text-slate-700">
                        Custom Volume
                      </span>
                      <div className="flex items-baseline justify-between">
                        <span className="text-lg font-black text-slate-900">Custom Units</span>
                        <span className="text-sm font-black text-emerald-700">
                          ₦{(customUnits * 120).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1">Select multiples of 25 units:</p>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <select
                        value={customUnits}
                        onChange={(e) => {
                          setSelectedPackageId('CUSTOM');
                          setCustomUnits(Number(e.target.value));
                        }}
                        className="w-full px-2.5 py-1.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-900 bg-white"
                      >
                        {[25, 50, 75, 100, 150, 200, 250, 300, 400, 500, 1000].map((u) => (
                          <option key={u} value={u}>
                            {u} Units — ₦{(u * 120).toLocaleString()}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {/* Step 3: Immediate Wallet Deduction & Purchase Action */}
              <div className="bg-slate-900 text-white rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-400">
                    Instant Wallet Deduction Summary
                  </span>
                  <h4 className="text-base font-black mt-0.5">
                    {selectedPkg?.units} Gate Credit Units &bull; ₦{Number(selectedPkg?.price_ngn || 0).toLocaleString()}
                  </h4>
                  <p className="text-xs text-slate-300 mt-0.5">
                    Payment is deducted immediately from your School Wallet (Balance: ₦
                    {Number(wallet.available_balance_ngn || 0).toLocaleString()}) and units are credited instantly.
                  </p>
                </div>

                <button
                  type="button"
                  disabled={purchasing}
                  onClick={handlePurchaseCredits}
                  className="w-full sm:w-auto px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg transition disabled:opacity-50 shrink-0"
                >
                  {purchasing
                    ? 'Processing Purchase...'
                    : `Purchase ${selectedPkg?.units} Units Now (₦${Number(selectedPkg?.price_ngn || 0).toLocaleString()})`}
                </button>
              </div>

              {/* Super Admin Direct Credit Grant / Adjustment */}
              {isSuperAdmin && (
                <div className="border-2 border-amber-300 bg-amber-50/60 rounded-2xl p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-black uppercase tracking-wider text-amber-800 flex items-center gap-1.5">
                      <Sparkles size={14} /> Super Admin Override: Direct Unit Grant / Deduction
                    </span>
                    <span className="text-[11px] font-bold text-amber-700">No Wallet Deduction Required</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <select
                      value={adjustType}
                      onChange={(e) => setAdjustType(e.target.value as 'CREDIT' | 'DEBIT')}
                      className="px-3 py-2 rounded-xl border border-amber-300 bg-white text-xs font-extrabold text-slate-900"
                    >
                      <option value="CREDIT">+ Grant Units (Credit)</option>
                      <option value="DEBIT">- Deduct Units (Debit)</option>
                    </select>
                    <input
                      type="number"
                      min="0.5"
                      step="0.5"
                      value={adjustUnits}
                      onChange={(e) => setAdjustUnits(Number(e.target.value))}
                      placeholder="Units (e.g. 25)"
                      className="px-3 py-2 rounded-xl border border-amber-300 bg-white text-xs font-extrabold text-slate-900"
                    />
                    <input
                      type="text"
                      value={adjustReason}
                      onChange={(e) => setAdjustReason(e.target.value)}
                      placeholder="Reason (e.g. Free trial / Promo grant)"
                      className="px-3 py-2 rounded-xl border border-amber-300 bg-white text-xs font-medium text-slate-900"
                    />
                    <button
                      type="button"
                      disabled={adjusting}
                      onClick={handleSuperAdminAdjust}
                      className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-black text-xs shadow-sm transition disabled:opacity-50"
                    >
                      {adjusting ? 'Applying...' : `${adjustType === 'CREDIT' ? 'Grant' : 'Deduct'} ${adjustUnits || 0} Units`}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: MONTHLY REPORTS (EMAIL & IN-APP) */}
          {activeTab === 'reports' && (
            <div className="space-y-5">
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h4 className="text-sm font-black text-slate-900">
                    Monthly School Gate Credit Statement (Email &amp; In-App)
                  </h4>
                  <p className="text-xs text-slate-600 mt-1">
                    Every unit purchased and spent is documented and automatically dispatched to your school monthly via email and in-app notification. You can also generate and send any month&apos;s statement below.
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <input
                    type="month"
                    value={reportMonth}
                    onChange={(e) => setReportMonth(e.target.value)}
                    className="px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-800 bg-white"
                  />
                  <button
                    type="button"
                    disabled={sendingReport}
                    onClick={handleSendMonthlyReport}
                    className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                  >
                    <Mail size={14} />
                    <span>{sendingReport ? 'Sending...' : 'Send Monthly Report'}</span>
                  </button>
                </div>
              </div>

              <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                      <th className="py-3 px-4">Month</th>
                      <th className="py-3 px-4 text-right">Added / Trial</th>
                      <th className="py-3 px-4 text-right">Units Spent</th>
                      <th className="py-3 px-4 text-right">Clock In / Out</th>
                      <th className="py-3 px-4 text-right">Closing Units</th>
                      <th className="py-3 px-4">Delivery Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {monthlyReports.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-10 text-center text-slate-500">
                          No monthly statements archived yet. Click &ldquo;Send Monthly Report&rdquo; above to compile and dispatch this month&apos;s statement immediately.
                        </td>
                      </tr>
                    ) : (
                      monthlyReports.map((rep: any) => (
                        <tr key={rep.id} className="hover:bg-slate-50">
                          <td className="py-3 px-4 font-black text-slate-900">{rep.report_month}</td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-emerald-600">
                            +{(Number(rep.purchased_units || 0) + Number(rep.trial_units || 0)).toFixed(1)} U
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-rose-600">
                            -{Number(rep.consumed_units || 0).toFixed(1)} U
                          </td>
                          <td className="py-3 px-4 text-right text-slate-600 font-medium">
                            {rep.total_clock_ins} In / {rep.total_clock_outs} Out
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-black text-slate-900">
                            {Number(rep.closing_units || 0).toFixed(1)} U
                          </td>
                          <td className="py-3 px-4">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                              <CheckCircle2 size={11} /> {rep.email_dispatched ? 'Sent via Email & App' : 'Published in App'}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

