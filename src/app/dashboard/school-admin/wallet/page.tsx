'use client';

import { useState, useEffect, useCallback, useTransition } from 'react';
import Link from 'next/link';
import {
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  ArrowRightLeft,
  CreditCard,
  Gift,
  Eye,
  EyeOff,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Copy,
  Check,
  RefreshCw,
  Plus,
  X,
  Receipt,
  Building,
  AlertCircle,
  ExternalLink,
  Printer,
  ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';

interface WalletOverviewData {
  wallet: {
    id: string;
    school_id: string;
    school_name: string;
    currency: string;
    available_balance_kobo: number;
    available_balance_ngn: number;
    reserved_balance_kobo: number;
    reserved_balance_ngn: number;
    escrow_balance_kobo: number;
    escrow_balance_ngn: number;
    daily_gate_fee_kobo: number;
    daily_gate_fee_ngn: number;
    status: string;
    virtual_account: {
      account_number: string | null;
      bank_name: string;
      account_name: string | null;
    };
  };
  transactions: Array<{
    id: string;
    type: string;
    channel: string;
    amount_kobo: number;
    amount_ngn: number;
    balance_before_kobo: number;
    balance_before_ngn: number;
    balance_after_kobo: number;
    balance_after_ngn: number;
    reference: string;
    description: string;
    status: string;
    created_at: string;
    metadata?: any;
  }>;
  stats: {
    monthly_gate_deductions_kobo: number;
    monthly_gate_deductions_ngn: number;
    total_deposits_kobo: number;
    total_deposits_ngn: number;
  };
}

export default function SchoolWalletOverviewPage() {
  const [data, setData] = useState<WalletOverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showBalance, setShowBalance] = useState(true);
  const [copiedNuban, setCopiedNuban] = useState(false);

  // Fund Wallet Modal State
  const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);
  const [depositAmount, setDepositAmount] = useState<number | ''>(50000);
  const [isDepositing, setIsDepositing] = useState(false);

  // Filter & Search
  const [filterType, setFilterType] = useState<'ALL' | 'CREDIT' | 'DEBIT'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Receipt Modal State
  const [activeReceipt, setActiveReceipt] = useState<any | null>(null);

  // Fetch Wallet Overview
  const fetchWallet = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setIsRefreshing(true);

    try {
      const res = await fetch('/api/schools/wallet', { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Failed to load school wallet');
      }
      setData(json);
    } catch (err: any) {
      console.error('[SchoolWalletPage] Error loading wallet:', err);
      toast.error(err.message || 'Error fetching wallet balance');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  // Handle SeerBit Checkout Return / Verification
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const reference = searchParams.get('reference');

    if (reference) {
      const verifyDeposit = async () => {
        const verifyToastId = toast.loading('Verifying deposit with payment network...');
        try {
          const res = await fetch('/api/schools/wallet/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reference }),
          });
          const json = await res.json();
          if (json.success && (json.status === 'SUCCESS' || json.credited)) {
            toast.success('School wallet credited successfully! 🏫💳', { id: verifyToastId });
          } else {
            toast.info(json.message || 'Payment is being processed by the gateway.', {
              id: verifyToastId,
            });
          }
        } catch (err) {
          toast.error('Could not verify deposit automatically. Please refresh shortly.', {
            id: verifyToastId,
          });
        } finally {
          // Remove reference query parameter to clean URL
          const newUrl = window.location.pathname;
          window.history.replaceState({}, '', newUrl);
          fetchWallet(true);
        }
      };

      verifyDeposit();
    } else {
      fetchWallet();
    }
  }, [fetchWallet]);

  // Copy NUBAN Handler
  const handleCopyNuban = (nuban: string) => {
    if (!nuban) return;
    navigator.clipboard.writeText(nuban);
    setCopiedNuban(true);
    toast.success('Dedicated NUBAN copied to clipboard!');
    setTimeout(() => setCopiedNuban(false), 2500);
  };

  // Initiate SeerBit Checkout Deposit
  const handleInitiateDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = Number(depositAmount);
    if (!amountNum || amountNum < 1000) {
      toast.error('Minimum deposit amount is ₦1,000');
      return;
    }
    if (amountNum > 5000000) {
      toast.error('Maximum institutional deposit is ₦5,000,000 per transaction');
      return;
    }

    setIsDepositing(true);
    const toastId = toast.loading('Initializing secure SeerBit institutional checkout...');
    try {
      const res = await fetch('/api/schools/wallet/deposit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount_ngn: amountNum }),
      });
      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to initialize payment gateway');
      }

      toast.success('Checkout ready. Redirecting to payment portal...', { id: toastId });
      setIsDepositModalOpen(false);

      if (json.checkout_url) {
        window.location.href = json.checkout_url;
      }
    } catch (err: any) {
      console.error('[SchoolDeposit] error:', err);
      toast.error(err.message || 'Deposit initiation failed', { id: toastId });
    } finally {
      setIsDepositing(false);
    }
  };

  const wallet = data?.wallet;
  const nubanAccount = wallet?.virtual_account?.account_number;
  const filteredTransactions = (data?.transactions || []).filter((tx) => {
    if (filterType === 'CREDIT' && tx.type !== 'CREDIT') return false;
    if (filterType === 'DEBIT' && tx.type !== 'DEBIT') return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchRef = tx.reference?.toLowerCase().includes(q);
      const matchDesc = tx.description?.toLowerCase().includes(q);
      const matchChan = tx.channel?.toLowerCase().includes(q);
      if (!matchRef && !matchDesc && !matchChan) return false;
    }
    return true;
  });

  const presetAmounts = [25000, 50000, 100000, 250000, 500000, 1000000];

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 font-sans text-slate-800 md:p-6">
      {/* Top Banner */}
      <div className="flex flex-col items-start justify-between gap-5 rounded-3xl border border-slate-800 bg-gradient-to-r from-[#07132B] via-[#0B1E36] to-[#0A1633] p-6 text-white shadow-xl md:flex-row md:items-center">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-500/20 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-emerald-300">
              <ShieldCheck size={13} /> Institutional Financial Vault
            </span>
            {wallet && (
              <span className="rounded-full border border-slate-700 bg-slate-800/80 px-2.5 py-0.5 font-mono text-[10px] text-slate-300">
                {wallet.school_name}
              </span>
            )}
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white md:text-3xl">
            School Wallet & Revenue Control
          </h1>
          <p className="max-w-2xl text-xs font-medium text-slate-300 md:text-sm">
            Live institutional ledger for gate security subscriptions, transport collections, escort
            automated releases, and dedicated NUBAN funding.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setIsDepositModalOpen(true)}
            className="flex cursor-pointer items-center gap-2 rounded-2xl bg-[#00A859] px-4 py-2.5 text-xs font-extrabold text-white shadow-md shadow-emerald-600/20 transition-all hover:bg-emerald-600 active:scale-95"
          >
            <Plus size={15} />
            <span>Fund School Wallet</span>
          </button>

          <Link
            href="/dashboard/school-admin/wallet/withdrawal"
            className="flex cursor-pointer items-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-4 py-2.5 text-xs font-extrabold text-white transition-all hover:bg-white/20"
          >
            <ArrowDownLeft size={15} />
            <span>Withdraw to Bank</span>
          </Link>

          <button
            onClick={() => fetchWallet(true)}
            disabled={isRefreshing}
            className="cursor-pointer rounded-2xl border border-white/10 bg-white/10 p-2.5 text-slate-300 transition-all hover:bg-white/20 hover:text-white disabled:opacity-50"
            title="Refresh Ledger"
          >
            <RefreshCw size={15} className={isRefreshing ? 'animate-spin text-emerald-400' : ''} />
          </button>
        </div>
      </div>

      {/* Balance Cards Matrix */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        {/* Card 1: Operating Available Balance */}
        <div className="relative space-y-4 overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-800 p-6 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-emerald-100">
              <Wallet size={15} /> Available Operating Balance
            </span>
            <button
              onClick={() => setShowBalance(!showBalance)}
              className="cursor-pointer rounded-lg p-1 text-emerald-100 transition-colors hover:bg-white/10 hover:text-white"
              title={showBalance ? 'Hide balance' : 'Show balance'}
            >
              {showBalance ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          <div>
            <div className="flex items-baseline gap-2">
              <h2 className="text-3xl font-black tracking-tight">
                {loading ? (
                  <span className="animate-pulse">₦••••••••</span>
                ) : showBalance ? (
                  `₦${(wallet?.available_balance_ngn ?? 0).toLocaleString('en-NG', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}`
                ) : (
                  '••••••••'
                )}
              </h2>
            </div>
            <div className="mt-1 flex items-center gap-2">
              <span className="inline-block h-2 w-2 animate-ping rounded-full bg-emerald-300" />
              <span className="text-xs font-medium text-emerald-100">
                {(wallet?.available_balance_ngn ?? 0) > 10000
                  ? 'Active · Ready for gate fees & payouts'
                  : 'Low balance · Top-up recommended'}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-emerald-500/30 pt-2 text-xs">
            <span className="text-emerald-200">Escrow Hold:</span>
            <span className="font-bold">
              ₦
              {(wallet?.escrow_balance_ngn ?? 0).toLocaleString('en-NG', {
                minimumFractionDigits: 2,
              })}
            </span>
          </div>
        </div>

        {/* Card 2: Dedicated Institutional NUBAN */}
        <div className="shadow-xs flex flex-col justify-between space-y-4 rounded-3xl border border-slate-200 bg-white p-6">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-slate-500">
              <Building size={15} className="text-blue-600" /> Dedicated Wire Transfer (NUBAN)
            </span>
            <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-extrabold text-blue-700">
              0% Transfer Fee
            </span>
          </div>

          <div className="space-y-1">
            <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-400">
              {wallet?.virtual_account?.bank_name || 'Wema Bank (SeerBit)'}
            </span>
            <div className="flex items-center justify-between gap-2 rounded-2xl border border-slate-100 bg-slate-50 p-2.5">
              <span className="font-mono text-xl font-black tracking-wider text-slate-900">
                {nubanAccount || 'Generating NUBAN...'}
              </span>
              {nubanAccount && (
                <button
                  onClick={() => handleCopyNuban(nubanAccount)}
                  className="cursor-pointer rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-blue-50 hover:text-blue-600"
                  title="Copy Account Number"
                >
                  {copiedNuban ? (
                    <Check size={16} className="text-emerald-600" />
                  ) : (
                    <Copy size={16} />
                  )}
                </button>
              )}
            </div>
            <p className="truncate pt-1 text-[11px] font-medium text-slate-500">
              Account Name:{' '}
              <span className="font-bold text-slate-700">
                {wallet?.virtual_account?.account_name || wallet?.school_name}
              </span>
            </p>
          </div>

          <p className="border-t border-slate-100 pt-2 text-[10px] font-medium text-slate-400">
            Bank transfers to this dedicated NUBAN reflect instantly in your operating ledger.
          </p>
        </div>

        {/* Card 3: Gate Platform Security & Daily Billing */}
        <div className="shadow-xs flex flex-col justify-between space-y-4 rounded-3xl border border-slate-200 bg-white p-6">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-slate-500">
              <CreditCard size={15} className="text-purple-600" /> Daily Gate Platform Fee
            </span>
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-extrabold text-emerald-700">
              Active Security
            </span>
          </div>

          <div>
            <div className="flex items-baseline gap-1">
              <h2 className="text-2xl font-black tracking-tight text-slate-900">
                ₦
                {(wallet?.daily_gate_fee_ngn ?? 2500).toLocaleString('en-NG', {
                  minimumFractionDigits: 2,
                })}
              </h2>
              <span className="text-xs font-bold text-slate-400">/ operational day</span>
            </div>
            <p className="mt-1 text-xs font-bold text-purple-700">
              Automated daily attendance & security roll-call billing
            </p>
          </div>

          <div className="flex items-center justify-between border-t border-slate-100 pt-2 text-xs text-slate-500">
            <span>This Month's Gate Incurred:</span>
            <span className="font-black text-slate-900">
              ₦
              {(data?.stats?.monthly_gate_deductions_ngn ?? 0).toLocaleString('en-NG', {
                minimumFractionDigits: 2,
              })}
            </span>
          </div>
        </div>
      </div>

      {/* Quick Navigation Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Link
          href="/dashboard/school-admin/wallet/transfer"
          className="group rounded-2xl border border-slate-200 bg-white p-4 transition-all hover:border-emerald-500 hover:shadow-md"
        >
          <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 font-bold text-emerald-700 transition-all group-hover:scale-105">
            <ArrowRightLeft size={18} />
          </div>
          <h4 className="text-xs font-black text-slate-900 group-hover:text-emerald-600">
            Fund Transfers
          </h4>
          <p className="mt-0.5 text-[10px] text-slate-500">Pay escorts & drivers</p>
        </Link>

        <Link
          href="/dashboard/school-admin/wallet/withdrawal"
          className="group rounded-2xl border border-slate-200 bg-white p-4 transition-all hover:border-blue-500 hover:shadow-md"
        >
          <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 font-bold text-blue-700 transition-all group-hover:scale-105">
            <ArrowDownLeft size={18} />
          </div>
          <h4 className="text-xs font-black text-slate-900 group-hover:text-blue-600">
            Withdrawals
          </h4>
          <p className="mt-0.5 text-[10px] text-slate-500">Direct bank settlements</p>
        </Link>

        <Link
          href="/dashboard/school-admin/wallet/subscription"
          className="group rounded-2xl border border-slate-200 bg-white p-4 transition-all hover:border-purple-500 hover:shadow-md"
        >
          <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-purple-100 font-bold text-purple-700 transition-all group-hover:scale-105">
            <CreditCard size={18} />
          </div>
          <h4 className="text-xs font-black text-slate-900 group-hover:text-purple-600">
            Subscriptions
          </h4>
          <p className="mt-0.5 text-[10px] text-slate-500">Manage school plan</p>
        </Link>

        <Link
          href="/dashboard/school-admin/wallet/rewards"
          className="group rounded-2xl border border-slate-200 bg-white p-4 transition-all hover:border-amber-500 hover:shadow-md"
        >
          <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 font-bold text-amber-700 transition-all group-hover:scale-105">
            <Gift size={18} />
          </div>
          <h4 className="text-xs font-black text-slate-900 group-hover:text-amber-600">
            Reward Wallet
          </h4>
          <p className="mt-0.5 text-[10px] text-slate-500">Safety bonuses & perks</p>
        </Link>
      </div>

      {/* Recent Transactions Ledger */}
      <div className="shadow-xs space-y-4 rounded-3xl border border-slate-200 bg-white p-5">
        <div className="flex flex-col justify-between gap-3 border-b border-slate-100 pb-3 sm:flex-row sm:items-center">
          <div>
            <h3 className="text-base font-black text-slate-900">Live Ledger Transactions</h3>
            <p className="text-xs text-slate-400">
              Cryptographically tracked institutional entries
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center rounded-xl bg-slate-100 p-1 text-xs font-bold">
              <button
                onClick={() => setFilterType('ALL')}
                className={`cursor-pointer rounded-lg px-3 py-1 transition-all ${
                  filterType === 'ALL'
                    ? 'shadow-xs bg-white text-slate-900'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                All ({(data?.transactions || []).length})
              </button>
              <button
                onClick={() => setFilterType('CREDIT')}
                className={`cursor-pointer rounded-lg px-3 py-1 transition-all ${
                  filterType === 'CREDIT'
                    ? 'shadow-xs bg-white text-emerald-700'
                    : 'text-slate-500 hover:text-emerald-700'
                }`}
              >
                Deposits
              </button>
              <button
                onClick={() => setFilterType('DEBIT')}
                className={`cursor-pointer rounded-lg px-3 py-1 transition-all ${
                  filterType === 'DEBIT'
                    ? 'shadow-xs bg-white text-rose-700'
                    : 'text-slate-500 hover:text-rose-700'
                }`}
              >
                Charges & Fees
              </button>
            </div>

            <input
              type="text"
              placeholder="Search reference or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-1.5 text-xs focus:outline-emerald-500"
            />
          </div>
        </div>

        {loading ? (
          <div className="space-y-2 p-8 text-center text-slate-400">
            <RefreshCw className="mx-auto h-6 w-6 animate-spin text-emerald-500" />
            <p className="text-xs font-medium">Loading ledger transactions...</p>
          </div>
        ) : filteredTransactions.length === 0 ? (
          <div className="space-y-2 rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-10 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
              <Receipt size={22} />
            </div>
            <h4 className="text-sm font-bold text-slate-700">No ledger records found</h4>
            <p className="mx-auto max-w-sm text-xs text-slate-400">
              Transactions will automatically populate as your school deposits funds, pays escorts,
              or settles daily gate platform fees.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredTransactions.map((t) => {
              const isCredit = t.type === 'CREDIT';
              return (
                <div
                  key={t.id}
                  onClick={() => setActiveReceipt(t)}
                  className="group flex cursor-pointer items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50/40 p-4 transition-all hover:border-slate-300 hover:bg-slate-50"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-bold ${
                        isCredit ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                      }`}
                    >
                      {isCredit ? <ArrowDownLeft size={18} /> : <ArrowUpRight size={18} />}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="truncate text-xs font-black text-slate-900 transition-colors group-hover:text-emerald-700">
                          {t.description || (isCredit ? 'Deposit Credit' : 'Platform Fee Debit')}
                        </h4>
                        <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-600">
                          {t.channel}
                        </span>
                      </div>
                      <span className="block truncate font-mono text-[10px] text-slate-400">
                        {t.reference || t.id} · {new Date(t.created_at).toLocaleString('en-NG')}
                      </span>
                    </div>
                  </div>

                  <div className="shrink-0 text-right">
                    <span
                      className={`block text-sm font-black ${
                        isCredit ? 'text-emerald-600' : 'text-slate-900'
                      }`}
                    >
                      {isCredit ? '+' : '-'}₦
                      {t.amount_ngn.toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                    </span>
                    <div className="mt-0.5 flex items-center justify-end gap-1.5">
                      <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[9px] font-black uppercase text-emerald-800">
                        {t.status}
                      </span>
                      <span className="flex items-center text-[10px] font-semibold text-slate-400 hover:text-emerald-600">
                        Receipt <ChevronRight size={12} />
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Fund Wallet Modal */}
      {isDepositModalOpen && (
        <div className="backdrop-blur-xs animate-in fade-in fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 duration-200">
          <div className="w-full max-w-md space-y-5 rounded-3xl border border-slate-100 bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-100 font-black text-emerald-700">
                  <Wallet size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">Top-Up School Wallet</h3>
                  <p className="text-[11px] font-medium text-slate-400">
                    Instant SeerBit card, USSD, or direct debit
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsDepositModalOpen(false)}
                className="cursor-pointer rounded-xl p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleInitiateDeposit} className="space-y-4">
              <div>
                <label className="mb-2 block text-xs font-black uppercase tracking-wider text-slate-700">
                  Select Preset Amount
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {presetAmounts.map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setDepositAmount(amt)}
                      className={`cursor-pointer rounded-xl border px-1 py-2 text-xs font-bold transition-all ${
                        depositAmount === amt
                          ? 'shadow-xs border-emerald-600 bg-emerald-600 text-white'
                          : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-emerald-300'
                      }`}
                    >
                      ₦{amt.toLocaleString()}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-black uppercase tracking-wider text-slate-700">
                  Or Enter Custom Amount (₦)
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-black text-slate-400">
                    ₦
                  </span>
                  <input
                    type="number"
                    min="1000"
                    max="5000000"
                    step="500"
                    value={depositAmount}
                    onChange={(e) =>
                      setDepositAmount(e.target.value === '' ? '' : Number(e.target.value))
                    }
                    required
                    placeholder="e.g. 150000"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2.5 pl-8 pr-4 text-base font-black text-slate-900 focus:outline-emerald-500"
                  />
                </div>
                <span className="mt-1 block text-[10px] text-slate-400">
                  Min ₦1,000 · Max ₦5,000,000 per institutional checkout.
                </span>
              </div>

              <div className="flex items-start gap-2.5 rounded-2xl border border-emerald-200 bg-emerald-50 p-3">
                <ShieldCheck size={18} className="mt-0.5 shrink-0 text-emerald-700" />
                <p className="text-[11px] font-medium text-emerald-800">
                  Payments are processed via SeerBit PCI-DSS Level 1 certified gateway. Once
                  complete, your institutional ledger updates instantaneously.
                </p>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsDepositModalOpen(false)}
                  className="flex-1 cursor-pointer rounded-xl border border-slate-200 py-2.5 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isDepositing}
                  className="flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-[#00A859] py-2.5 text-xs font-black text-white shadow-md shadow-emerald-600/20 transition-all hover:bg-emerald-600 disabled:opacity-50"
                >
                  {isDepositing ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      <span>Connecting...</span>
                    </>
                  ) : (
                    <>
                      <span>Proceed to Pay</span>
                      <ExternalLink size={14} />
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Transaction Receipt Modal */}
      {activeReceipt && (
        <div className="backdrop-blur-xs animate-in fade-in fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 duration-200">
          <div className="w-full max-w-lg space-y-5 rounded-3xl border border-slate-100 bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Receipt className="text-emerald-600" size={20} />
                <h3 className="text-base font-black text-slate-900">
                  Institutional Transaction Receipt
                </h3>
              </div>
              <button
                onClick={() => setActiveReceipt(null)}
                className="cursor-pointer rounded-xl p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500">Receipt ID:</span>
                <span className="font-mono text-xs font-bold text-slate-900">
                  {activeReceipt.id}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500">Reference:</span>
                <span className="font-mono text-xs font-bold text-slate-900">
                  {activeReceipt.reference}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500">Date & Time:</span>
                <span className="text-xs font-bold text-slate-900">
                  {new Date(activeReceipt.created_at).toLocaleString('en-NG')}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500">Channel:</span>
                <span className="font-mono text-xs font-bold text-slate-900">
                  {activeReceipt.channel}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500">Status:</span>
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-black uppercase text-emerald-800">
                  {activeReceipt.status}
                </span>
              </div>
              <div className="flex items-center justify-between border-t border-slate-200 pt-2">
                <span className="text-sm font-black text-slate-800">Amount:</span>
                <span
                  className={`text-lg font-black ${
                    activeReceipt.type === 'CREDIT' ? 'text-emerald-600' : 'text-slate-900'
                  }`}
                >
                  {activeReceipt.type === 'CREDIT' ? '+' : '-'}₦
                  {activeReceipt.amount_ngn.toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Balance After:</span>
                <span className="font-bold text-slate-700">
                  ₦
                  {activeReceipt.balance_after_ngn.toLocaleString('en-NG', {
                    minimumFractionDigits: 2,
                  })}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => window.print()}
                className="flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-slate-200 py-2.5 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-50"
              >
                <Printer size={15} />
                <span>Print Receipt</span>
              </button>
              <button
                onClick={() => setActiveReceipt(null)}
                className="flex-1 cursor-pointer rounded-xl bg-slate-900 py-2.5 text-xs font-bold text-white transition-colors hover:bg-slate-800"
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
