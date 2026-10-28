// @ts-nocheck
'use client';

import { useState } from 'react';
import {
  Wallet,
  Building2,
  ArrowUpRight,
  ArrowDownLeft,
  DollarSign,
  TrendingUp,
  Sparkles,
  ShieldCheck,
  Eye,
  EyeOff,
  CheckCircle2,
  RefreshCw,
  Clock,
  X,
  CreditCard,
  Receipt,
  Printer,
  ChevronRight,
  ExternalLink,
  Edit2,
  Check,
  AlertTriangle,
  Lock,
  Unlock,
} from 'lucide-react';
import { toast } from 'sonner';

interface EscortWalletViewProps {
  liveDashboardData: any;
  onRefreshData: () => void;
}

export default function EscortWalletView({
  liveDashboardData,
  onRefreshData,
}: EscortWalletViewProps) {
  const [showBalance, setShowBalance] = useState(true);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [showBankModal, setShowBankModal] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('25000');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeReceipt, setActiveReceipt] = useState<any | null>(null);
  const [filterType, setFilterType] = useState<'ALL' | 'CREDIT' | 'DEBIT'>('ALL');

  // Bank Form State
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');

  const wallet = liveDashboardData?.wallet || {};
  const balance = Number(wallet.balance ?? wallet.available_balance ?? 0);
  const transactions = wallet.transactions || [];
  const payoutBank = wallet.payout_bank || {};
  const earningsSummary = wallet.earnings_summary || liveDashboardData?.earningsSummary || {};

  const isWorkClosed = Boolean(wallet.work_closed_for_day);
  const tripStatus = wallet.today_trip_status || liveDashboardData?.todayTripStatus || 'scheduled';
  const isInProgress = !isWorkClosed && tripStatus === 'in_progress';

  const approvedKmFare = earningsSummary.total_daily_approved_km_fare ?? (earningsSummary.total_daily_earnings ? Number(earningsSummary.total_daily_earnings) / 0.8 : 0);
  const driverNetEarnings = earningsSummary.total_daily_earnings ?? (approvedKmFare * 0.8);
  const platformLevy = earningsSummary.total_daily_platform_levy ?? (approvedKmFare * 0.2);

  // Close of Work: Marks shift complete and settles today's 80% driver net earnings
  const handleCloseWork = async () => {
    setIsSubmitting(true);
    const toastId = toast.loading('Closing shift and settling today\'s 80% net earnings...');
    try {
      const res = await fetch('/api/escorts/dashboard-live', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'close_of_work' }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(data.message || 'Work for today marked closed! Earnings settled to wallet.', { id: toastId });
        onRefreshData();
      } else {
        throw new Error(data.error || 'Failed to close work for today');
      }
    } catch (err: any) {
      toast.error(err.message || 'Error closing work for today', { id: toastId });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Compute Statistics
  const totalStipends = transactions
    .filter((t: any) => t.channel === 'SCHOOL_STIPEND_CREDIT' || t.type === 'credit')
    .reduce((sum: number, t: any) => sum + Number(t.amount || 0), 0);

  const totalPayouts = transactions
    .filter((t: any) => t.channel === 'ESCORT_PAYOUT' || t.type === 'debit')
    .reduce((sum: number, t: any) => sum + Number(t.amount || 0), 0);

  // Filtered Transactions
  const filteredTransactions = transactions.filter((tx: any) => {
    if (filterType === 'CREDIT') return tx.type === 'credit';
    if (filterType === 'DEBIT') return tx.type === 'debit';
    return true;
  });

  // Handle Withdrawal Request
  const handleWithdrawWallet = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = Number(withdrawAmount);

    if (isInProgress) {
      toast.error('Withdrawals are locked during an active shift. Please close work for today to unlock bank payout.');
      return;
    }

    if (isNaN(numAmount) || numAmount < 500) {
      toast.error('Minimum withdrawal amount is ₦500');
      return;
    }

    if (numAmount > balance) {
      toast.error(`Insufficient balance. Your available balance is ₦${balance.toLocaleString()}`);
      return;
    }

    setIsSubmitting(true);
    const toastId = toast.loading(
      `Processing ₦${numAmount.toLocaleString()} withdrawal request...`
    );

    try {
      const res = await fetch('/api/escorts/dashboard-live', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'withdraw_wallet', amount: numAmount }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(
          data.message || `Payout request for ₦${numAmount.toLocaleString()} submitted!`,
          { id: toastId }
        );
        setShowWithdrawModal(false);
        onRefreshData();
      } else {
        throw new Error(data.error || 'Withdrawal failed');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to request withdrawal', { id: toastId });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Updating Bank Account Details
  const handleUpdateBank = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bankName || !accountNumber) {
      toast.error('Bank name and account number are required');
      return;
    }

    setIsSubmitting(true);
    const toastId = toast.loading('Saving commercial bank payout account...');

    try {
      const res = await fetch('/api/escorts/dashboard-live', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_payout_bank',
          bank_name: bankName.trim(),
          account_number: accountNumber.trim(),
          account_name: accountName.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success('Payout commercial bank account updated successfully!', { id: toastId });
        setShowBankModal(false);
        onRefreshData();
      } else {
        throw new Error(data.error || 'Failed to save bank account');
      }
    } catch (err: any) {
      toast.error(err.message || 'Error updating bank account', { id: toastId });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 0. APPROVED KM FARE & 80/20 COMPENSATION BREAKDOWN */}
      <div className="rounded-3xl border border-blue-200/90 bg-gradient-to-br from-blue-50/70 via-indigo-50/40 to-emerald-50/40 p-5 md:p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-blue-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-blue-600 text-white font-black text-xs shadow-xs">
                ₦
              </span>
              <h3 className="text-sm md:text-base font-black text-blue-950">
                Approved Km Fare &amp; 80/20 Driver Compensation
              </h3>
              <span className="rounded-full bg-blue-100 border border-blue-200 px-2.5 py-0.5 text-[10px] font-black uppercase text-blue-800">
                CM Regulated
              </span>
            </div>
            <p className="mt-1.5 text-xs text-slate-600 leading-relaxed max-w-2xl">
              Escort earnings are strictly calculated from the <strong>Approved Km Fare</strong> set by your City Manager. Platform service charges are separate and excluded from your view. A <strong>20% platform levy</strong> is deducted, with the remaining <strong>80% net</strong> credited to you and unlockable for withdrawal upon close of work.
            </p>
          </div>

          {/* Shift Status Badge & Action */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2.5 shrink-0">
            {isWorkClosed ? (
              <div className="inline-flex items-center gap-1.5 rounded-2xl bg-emerald-100 border border-emerald-300 px-3.5 py-2 text-xs font-black text-emerald-800 shadow-xs">
                <CheckCircle2 size={16} className="text-emerald-600" />
                <span>Shift Closed • Earnings Withdrawable</span>
              </div>
            ) : isInProgress ? (
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
                <div className="inline-flex items-center gap-1.5 rounded-2xl bg-amber-100 border border-amber-300 px-3 py-2 text-xs font-black text-amber-900 shadow-xs">
                  <Clock size={15} className="text-amber-700 animate-spin" />
                  <span>Shift In Progress (Locked)</span>
                </div>
                <button
                  type="button"
                  onClick={handleCloseWork}
                  disabled={isSubmitting}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white px-3.5 py-2 text-xs font-black shadow-sm transition-all disabled:opacity-50"
                >
                  <Lock size={14} className="text-emerald-400" />
                  <span>{isSubmitting ? 'Closing Shift...' : 'Close Work for Day'}</span>
                </button>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
                <div className="inline-flex items-center gap-1.5 rounded-2xl bg-slate-100 border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700 shadow-xs">
                  <Clock size={15} className="text-slate-500" />
                  <span>Shift Scheduled</span>
                </div>
                <button
                  type="button"
                  onClick={handleCloseWork}
                  disabled={isSubmitting}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white px-3.5 py-2 text-xs font-black shadow-sm transition-all disabled:opacity-50"
                >
                  <Check size={14} className="text-emerald-400" />
                  <span>{isSubmitting ? 'Closing Shift...' : 'Mark Close of Work'}</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* 3 Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-4">
          <div className="rounded-2xl border border-blue-200/60 bg-white/90 p-3.5">
            <span className="text-[10px] font-extrabold uppercase text-slate-500 block">
              1. Approved Km Fare (100%)
            </span>
            <p className="text-lg md:text-xl font-mono font-black text-blue-950 mt-0.5">
              ₦{Number(approvedKmFare).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className="text-[11px] text-slate-500 mt-1">
              Strictly per approved distance (Rate: ₦{earningsSummary.agreed_rate_per_km || 500}/km).
            </p>
          </div>

          <div className="rounded-2xl border border-emerald-300/80 bg-emerald-50/80 p-3.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-extrabold uppercase text-emerald-800 block">
                2. Driver Net Share (80%)
              </span>
              <span className="rounded-md bg-emerald-200 px-1.5 py-0.5 text-[9px] font-black text-emerald-900">
                Your Payout
              </span>
            </div>
            <p className="text-lg md:text-xl font-mono font-black text-emerald-950 mt-0.5">
              ₦{Number(driverNetEarnings).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className="text-[11px] text-emerald-800 mt-1">
              Your 80% entitlement, withdrawable to bank after close of work.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white/80 p-3.5">
            <span className="text-[10px] font-extrabold uppercase text-slate-500 block">
              3. Platform Levy (20%)
            </span>
            <p className="text-lg md:text-xl font-mono font-black text-slate-700 mt-0.5">
              ₦{Number(platformLevy).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className="text-[11px] text-slate-500 mt-1">
              Platform administration, fleet insurance &amp; technology upkeep.
            </p>
          </div>
        </div>
      </div>

      {/* 1. WALLET HERO BALANCE & OVERVIEW */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        {/* Main Wallet Balance Card */}
        <div className="relative flex flex-col justify-between overflow-hidden rounded-3xl border border-emerald-500/20 bg-gradient-to-tr from-[#0A1128] via-slate-900 to-[#0A1128] p-6 text-white shadow-xl md:col-span-2 md:p-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-500/30 bg-emerald-500/20 text-emerald-400 shadow-inner">
                <Wallet size={22} />
              </span>
              <div>
                <span className="block text-[10px] font-extrabold uppercase tracking-widest text-emerald-400">
                  Available Wallet Balance
                </span>
                <span className="text-xs font-semibold text-slate-300">
                  Official MyEduRide Escort Stipend & Earnings Wallet
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onRefreshData}
                title="Refresh Live Balance"
                className="cursor-pointer rounded-xl bg-white/5 p-2.5 text-slate-400 transition-all hover:bg-white/10 hover:text-white"
              >
                <RefreshCw size={15} />
              </button>
              <button
                type="button"
                onClick={() => setShowBalance(!showBalance)}
                title={showBalance ? 'Hide Balance' : 'Show Balance'}
                className="cursor-pointer rounded-xl bg-white/5 p-2.5 text-slate-400 transition-all hover:bg-white/10 hover:text-white"
              >
                {showBalance ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          <div className="my-6">
            <h2 className="flex items-baseline gap-2 font-mono text-3xl font-black tracking-tight text-white md:text-5xl">
              <span className="text-emerald-400">
                {showBalance
                  ? `₦${balance.toLocaleString('en-NG', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}`
                  : '••••••••'}
              </span>
              <span className="font-sans text-xs font-bold uppercase text-slate-400">NGN</span>
            </h2>
            <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-400">
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
              <span>
                Instant commercial bank payout ready • Direct institutional stipend receiver
              </span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 border-t border-slate-800 pt-4">
            <button
              type="button"
              onClick={() => {
                setWithdrawAmount(String(Math.min(balance || 25000, 50000)));
                setShowWithdrawModal(true);
              }}
              disabled={balance < 500}
              className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-xs font-black text-white shadow-md shadow-emerald-600/30 transition-all hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ArrowUpRight size={16} />
              <span>Withdraw to Bank Account</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setBankName(payoutBank.bank_name || '');
                setAccountNumber(payoutBank.account_number || '');
                setAccountName(payoutBank.account_name || '');
                setShowBankModal(true);
              }}
              className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-xs font-extrabold text-white transition-all hover:bg-white/15"
            >
              <Building2 size={15} className="text-slate-300" />
              <span>{payoutBank.account_number ? 'Bank Destination' : 'Link Bank Account'}</span>
            </button>
          </div>
        </div>

        {/* Financial Badges & EduSave / EduInsuRed Overview */}
        <div className="space-y-4">
          {/* Linked Bank Card */}
          <div className="shadow-xs space-y-3 rounded-3xl border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
                <Building2 size={14} className="text-indigo-600" /> Settlement Bank
              </span>
              <button
                type="button"
                onClick={() => {
                  setBankName(payoutBank.bank_name || '');
                  setAccountNumber(payoutBank.account_number || '');
                  setAccountName(payoutBank.account_name || '');
                  setShowBankModal(true);
                }}
                className="flex cursor-pointer items-center gap-1 text-[11px] font-extrabold text-emerald-700 hover:text-emerald-900"
              >
                <Edit2 size={12} /> {payoutBank.account_number ? 'Edit' : 'Add'}
              </button>
            </div>
            {payoutBank.account_number ? (
              <div className="space-y-1">
                <p className="font-mono text-sm font-black text-slate-900">
                  {payoutBank.bank_name || 'Commercial Bank'}
                </p>
                <p className="font-mono text-xs font-bold text-slate-600">
                  {payoutBank.account_number}
                  {payoutBank.account_name && ` • ${payoutBank.account_name}`}
                </p>
                <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                  <Check size={11} /> Verified for Instant Wire Settlement
                </span>
              </div>
            ) : (
              <div className="py-1 text-[11px] text-slate-500">
                <p className="font-medium">No commercial bank linked yet.</p>
                <button
                  type="button"
                  onClick={() => setShowBankModal(true)}
                  className="mt-1 block cursor-pointer font-extrabold text-emerald-700 underline"
                >
                  Click to link bank account for payouts
                </button>
              </div>
            )}
          </div>

          {/* EduSave Card */}
          <div className="shadow-xs space-y-2 rounded-3xl border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
                <Sparkles size={14} className="text-amber-500" /> EduSave Goal
              </span>
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-extrabold text-amber-800">
                Active Goal
              </span>
            </div>
            <p className="font-mono text-xl font-black text-slate-900">
              ₦{Number(wallet.eduSave ?? 0).toLocaleString('en-NG', { minimumFractionDigits: 2 })}
            </p>
            <p className="text-[11px] text-slate-500">
              Auto-saving 10% of monthly stipend disbursements.
            </p>
          </div>
        </div>
      </div>

      {/* 2. RECENT TRANSACTIONS LEDGER */}
      <div className="shadow-xs space-y-5 rounded-3xl border border-slate-200 bg-white p-6 md:p-8">
        <div className="flex flex-col justify-between gap-4 border-b border-slate-100 pb-4 sm:flex-row sm:items-center">
          <div>
            <h3 className="flex items-center gap-2 text-base font-black text-slate-900 md:text-lg">
              <Receipt size={20} className="text-emerald-600" />
              <span>Disbursements &amp; Payout Ledger</span>
            </h3>
            <p className="text-xs font-medium text-slate-500">
              Real-time audit trail of school stipends received and bank payouts.
            </p>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 self-start rounded-2xl bg-slate-100 p-1 text-xs sm:self-auto">
            <button
              type="button"
              onClick={() => setFilterType('ALL')}
              className={`cursor-pointer rounded-xl px-3 py-1.5 font-bold transition-all ${
                filterType === 'ALL'
                  ? 'shadow-xs bg-white text-slate-900'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All ({transactions.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterType('CREDIT')}
              className={`cursor-pointer rounded-xl px-3 py-1.5 font-bold transition-all ${
                filterType === 'CREDIT'
                  ? 'shadow-xs bg-emerald-600 text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Stipends ({transactions.filter((t: any) => t.type === 'credit').length})
            </button>
            <button
              type="button"
              onClick={() => setFilterType('DEBIT')}
              className={`cursor-pointer rounded-xl px-3 py-1.5 font-bold transition-all ${
                filterType === 'DEBIT'
                  ? 'shadow-xs bg-slate-900 text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Payouts ({transactions.filter((t: any) => t.type === 'debit').length})
            </button>
          </div>
        </div>

        {/* Transactions List */}
        <div className="divide-y divide-slate-100 text-xs">
          {filteredTransactions.length === 0 ? (
            <div className="space-y-2 py-12 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                <Receipt size={24} />
              </div>
              <p className="text-sm font-bold text-slate-700">No transaction records found</p>
              <p className="mx-auto max-w-sm text-xs text-slate-400">
                When schools disburse stipends or you initiate bank payouts, official ledger records
                appear here instantly.
              </p>
            </div>
          ) : (
            filteredTransactions.map((tx: any) => {
              const amount = Number(tx.amount || 0);
              const isCredit = tx.type === 'credit';
              return (
                <div
                  key={tx.id || tx.reference}
                  onClick={() => setActiveReceipt(tx)}
                  className="group flex cursor-pointer flex-col justify-between gap-3 rounded-2xl p-3 py-4 transition-all hover:bg-slate-50/80 sm:flex-row sm:items-center"
                >
                  <div className="flex items-center gap-3.5">
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl transition-transform group-hover:scale-105 ${
                        isCredit ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {isCredit ? <ArrowDownLeft size={18} /> : <ArrowUpRight size={18} />}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-black text-slate-900 transition-colors group-hover:text-emerald-900">
                          {tx.title || (isCredit ? 'School Stipend Disbursement' : 'Bank Payout')}
                        </p>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-black ${
                            isCredit
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-slate-200 text-slate-700'
                          }`}
                        >
                          {isCredit ? 'RECEIVED' : 'PAYOUT'}
                        </span>
                      </div>

                      <p className="mt-0.5 line-clamp-1 text-xs font-medium text-slate-500">
                        {tx.description}
                      </p>

                      <div className="mt-1 flex items-center gap-2 text-[11px] font-medium text-slate-400">
                        <span className="font-mono font-bold text-slate-600">{tx.reference}</span>
                        <span>•</span>
                        <span>
                          {tx.created_at
                            ? new Date(tx.created_at).toLocaleString('en-NG', {
                                dateStyle: 'medium',
                                timeStyle: 'short',
                              })
                            : 'Recently'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3 self-end sm:justify-end sm:self-center">
                    <span
                      className={`font-mono text-base font-black sm:text-lg ${
                        isCredit ? 'text-emerald-700' : 'text-slate-900'
                      }`}
                    >
                      {isCredit ? '+' : '-'}₦
                      {Math.abs(amount).toLocaleString('en-NG', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                    <ChevronRight
                      size={16}
                      className="text-slate-300 transition-colors group-hover:text-slate-600"
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* MODAL: REQUEST WITHDRAWAL / PAYOUT */}
      {showWithdrawModal && (
        <div className="backdrop-blur-xs animate-in fade-in fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 duration-150">
          <div className="w-full max-w-md space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl md:p-7">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="flex items-center gap-2 text-base font-black text-slate-900">
                <ArrowUpRight size={20} className="text-emerald-600" />
                <span>Withdraw to Commercial Bank</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowWithdrawModal(false)}
                className="cursor-pointer p-1 text-slate-400 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleWithdrawWallet} className="space-y-4 text-xs font-semibold">
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <label className="font-bold text-slate-700">Withdrawal Amount (₦)</label>
                  <button
                    type="button"
                    onClick={() => setWithdrawAmount(String(balance))}
                    className="cursor-pointer text-[11px] font-black text-emerald-700 hover:text-emerald-900"
                  >
                    Max (₦{balance.toLocaleString()})
                  </button>
                </div>
                <input
                  type="number"
                  required
                  min="500"
                  max={balance}
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-mono text-lg font-black text-emerald-700 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>

              {/* Quick Amount Chips */}
              <div className="grid grid-cols-4 gap-2">
                {[5000, 10000, 25000, 50000].map((amt) => (
                  <button
                    type="button"
                    key={amt}
                    onClick={() => setWithdrawAmount(String(Math.min(amt, balance)))}
                    className="cursor-pointer rounded-xl border border-slate-200 bg-slate-100 py-2 text-[11px] font-extrabold transition-all hover:bg-emerald-50 hover:text-emerald-700"
                  >
                    ₦{amt.toLocaleString()}
                  </button>
                ))}
              </div>

              {/* Active Shift Lockout Notice */}
              {isInProgress && (
                <div className="rounded-2xl border border-amber-300 bg-amber-50 p-3.5 text-xs text-amber-900 space-y-2">
                  <div className="flex items-center gap-2 font-black">
                    <AlertTriangle size={16} className="text-amber-700 shrink-0" />
                    <span>Withdrawal Locked: Shift Currently In Progress</span>
                  </div>
                  <p className="text-[11px] text-amber-800 leading-relaxed">
                    Per platform compensation rules, daily earnings unlock for withdrawal after the close of work. You can mark today&apos;s shift closed once all student trips are completed.
                  </p>
                  <button
                    type="button"
                    onClick={async () => {
                      await handleCloseWork();
                    }}
                    disabled={isSubmitting}
                    className="w-full cursor-pointer rounded-xl bg-amber-800 hover:bg-amber-900 text-white font-black py-2.5 text-xs transition-all shadow-xs"
                  >
                    {isSubmitting ? 'Closing Work...' : 'Close Work for Today Now'}
                  </button>
                </div>
              )}

              {/* Settlement Account Preview */}
              <div className="space-y-1 rounded-2xl border border-slate-200/80 bg-slate-50 p-3.5 text-[11px]">
                <span className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                  Payout Destination:
                </span>
                <p className="font-black text-slate-900">
                  {payoutBank.bank_name || 'Commercial Bank on file'} •{' '}
                  {payoutBank.account_number || 'Direct Wire Transfer'}
                </p>
                <p className="text-slate-500">
                  Instant commercial bank wire via Nigeria Inter-Bank Settlement System (NIBSS).
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowWithdrawModal(false)}
                  className="flex-1 cursor-pointer rounded-2xl border border-slate-300 py-3 font-extrabold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || balance < 500 || isInProgress}
                  className="flex-1 cursor-pointer rounded-2xl bg-[#00A859] py-3 font-black text-white shadow-md shadow-emerald-600/25 hover:bg-emerald-600 disabled:opacity-50"
                >
                  {isSubmitting ? 'Processing Payout...' : isInProgress ? 'Shift In Progress' : 'Authorize Payout'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: LINK / UPDATE BANK DETAILS */}
      {showBankModal && (
        <div className="backdrop-blur-xs animate-in fade-in fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 duration-150">
          <div className="w-full max-w-md space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl md:p-7">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="flex items-center gap-2 text-base font-black text-slate-900">
                <Building2 size={20} className="text-emerald-600" />
                <span>Commercial Bank Details</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowBankModal(false)}
                className="cursor-pointer p-1 text-slate-400 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleUpdateBank} className="space-y-4 text-xs font-semibold">
              <div>
                <label className="mb-1 block font-bold text-slate-700">
                  Commercial Bank Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Access Bank, GTBank, Zenith Bank, First Bank"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-bold text-slate-900 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>

              <div>
                <label className="mb-1 block font-bold text-slate-700">
                  10-Digit NUBAN Account Number *
                </label>
                <input
                  type="text"
                  required
                  maxLength={10}
                  placeholder="0123456789"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ''))}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-mono text-sm font-black tracking-wider text-slate-900 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>

              <div>
                <label className="mb-1 block font-bold text-slate-700">
                  Account Holder Full Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Davwaro Ebor"
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-bold text-slate-900 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowBankModal(false)}
                  className="flex-1 cursor-pointer rounded-2xl border border-slate-300 py-3 font-extrabold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 cursor-pointer rounded-2xl bg-slate-900 py-3 font-black text-white shadow-md hover:bg-slate-800 disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : 'Save Bank Details'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: TRANSACTION RECEIPT */}
      {activeReceipt && (
        <div className="backdrop-blur-xs animate-in fade-in fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 duration-150">
          <div className="w-full max-w-md space-y-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl md:p-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-100 font-black text-emerald-800">
                  <CheckCircle2 size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">Official Ledger Receipt</h3>
                  <span className="font-mono text-[10px] text-slate-400">
                    MyEduRide FinTech Vault
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveReceipt(null)}
                className="cursor-pointer p-1 text-slate-400 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-1 py-2 text-center">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                Transaction Amount
              </span>
              <p className="font-mono text-3xl font-black text-emerald-700">
                {activeReceipt.type === 'credit' ? '+' : '-'}₦
                {Number(activeReceipt.amount).toLocaleString('en-NG', { minimumFractionDigits: 2 })}
              </p>
              <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-black text-emerald-800">
                ✓ COMPLETED &amp; AUDITED
              </span>
            </div>

            <div className="space-y-2.5 rounded-2xl border border-slate-200/80 bg-slate-50 p-4 text-xs">
              <div className="flex justify-between">
                <span className="font-medium text-slate-500">Description:</span>
                <span className="max-w-[200px] truncate text-right font-bold text-slate-900">
                  {activeReceipt.description || activeReceipt.title}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium text-slate-500">Channel:</span>
                <span className="font-mono font-bold text-slate-800">
                  {activeReceipt.channel || 'SCHOOL_STIPEND'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium text-slate-500">Audit Reference:</span>
                <span className="font-mono text-[11px] font-bold text-slate-800">
                  {activeReceipt.reference}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium text-slate-500">Date &amp; Time:</span>
                <span className="font-medium text-slate-800">
                  {activeReceipt.created_at
                    ? new Date(activeReceipt.created_at).toLocaleString('en-NG')
                    : 'N/A'}
                </span>
              </div>
            </div>

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={() => window.print()}
                className="flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-slate-200 py-2.5 text-xs font-black text-slate-700 transition-colors hover:bg-slate-50"
              >
                <Printer size={14} /> Print Receipt
              </button>
              <button
                type="button"
                onClick={() => setActiveReceipt(null)}
                className="flex-1 cursor-pointer rounded-xl bg-slate-900 py-2.5 text-xs font-black text-white transition-colors hover:bg-slate-800"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
