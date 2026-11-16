'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  ShieldCheck,
  Building2,
  Copy,
  Check,
  RefreshCw,
  Plus,
  CreditCard,
  Lock,
  History,
  AlertCircle,
  ExternalLink,
  ChevronRight,
  Eye,
  EyeOff,
  Sparkles,
  CheckCircle2,
  Printer,
  FileText,
  Download,
} from 'lucide-react';
import { toast } from 'sonner';
import { DigitalReceiptModal } from '@/components/shared/DigitalReceiptModal';

interface WalletData {
  id: string;
  currency: string;
  available_balance_kobo: number;
  available_balance_ngn: number;
  escrow_balance_kobo: number;
  escrow_balance_ngn: number;
  reserved_balance_kobo: number;
  reserved_balance_ngn: number;
  status: string;
  virtual_account: {
    account_number: string | null;
    bank_name: string;
    account_name: string | null;
  };
}

interface TransactionItem {
  id: string;
  transaction_type: 'CREDIT' | 'DEBIT';
  channel: string;
  amount_kobo: number;
  amount_ngn: number;
  balance_before_ngn: number;
  balance_after_ngn: number;
  reference: string;
  status: string;
  description: string;
  created_at: string;
  row_integrity_hash?: string;
}

interface EscrowHoldItem {
  id: string;
  gross_amount_kobo: number;
  status: string;
  student_id: string;
  trip_id: string;
  created_at: string;
}

interface ParentWalletViewProps {
  onBalanceUpdated?: (newBalanceNgn: number) => void;
  openFundOnMount?: boolean;
  agreedDailyFee?: number;
}

export default function ParentWalletView({
  onBalanceUpdated,
  openFundOnMount = false,
  agreedDailyFee = 1060,
}: ParentWalletViewProps) {
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const [escrowHolds, setEscrowHolds] = useState<EscrowHoldItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showBalance, setShowBalance] = useState(true);
  const [copiedAccount, setCopiedAccount] = useState(false);
  const [syncingTransfer, setSyncingTransfer] = useState(false);
  const prevBalanceRef = useRef<number | null>(null);

  const handleSyncTransfer = async (manualRef?: string) => {
    setSyncingTransfer(true);
    const toastId = toast.loading('Reconciling wallet with payment gateway...');
    try {
      const res = await fetch('/api/parent/wallet/sync-transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ reference: manualRef || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to sync');

      if (data.credited) {
        toast.success(data.message || `Deposit of ₦${data.amount_ngn} verified and credited!`, { id: toastId });
      } else if (data.already_credited) {
        toast.info(data.message, { id: toastId });
      } else {
        toast.success('Wallet is up to date and active.', { id: toastId });
      }
      fetchWallet(true);
    } catch (err: any) {
      toast.error(err.message || 'Could not sync transfer status', { id: toastId });
    } finally {
      setSyncingTransfer(false);
    }
  };

  // Dynamic Agreed Transit Fee (starts with agreed daily fee, capped at 1 school month = 20 days)
  const [dailyFee, setDailyFee] = useState<number>(agreedDailyFee || 1060);
  const [selectedDays, setSelectedDays] = useState<number>(1);

  // Fund Modal state
  const [showFundModal, setShowFundModal] = useState(openFundOnMount);
  const [depositAmount, setDepositAmount] = useState<string>(String(agreedDailyFee || 1060));
  const [customAmount, setCustomAmount] = useState<string>('');
  const [isDepositing, setIsDepositing] = useState(false);
  const [verifyingRef, setVerifyingRef] = useState<string | null>(null);

  // Digital Receipt state
  const [selectedReceiptTx, setSelectedReceiptTx] = useState<TransactionItem | null>(null);
  const [copiedHash, setCopiedHash] = useState(false);

  const fetchWallet = useCallback(async (isSilent = false) => {
    if (!isSilent) setRefreshing(true);
    try {
      const res = await fetch('/api/parent/wallet', {
        credentials: 'include',
        cache: 'no-store',
      });
      if (!res.ok) {
        throw new Error('Failed to load wallet data');
      }
      const data = await res.json();
      if (data.success && data.wallet) {
        const newBal = data.wallet.available_balance_ngn;
        if (prevBalanceRef.current !== null && newBal > prevBalanceRef.current) {
          const diff = newBal - prevBalanceRef.current;
          toast.success(`₦${diff.toLocaleString()} received! Wallet updated to ₦${newBal.toLocaleString()}`, {
            duration: 6000,
          });
        }
        prevBalanceRef.current = newBal;
        setWallet(data.wallet);
        setTransactions(data.transactions || []);
        setEscrowHolds(data.escrow_holds || []);
        if (data.agreed_daily_fee && Number(data.agreed_daily_fee) > 0) {
          const fee = Number(data.agreed_daily_fee);
          setDailyFee(fee);
          setDepositAmount((prev) => (prev === '5000' || prev === '1060' ? String(fee) : prev));
        }
        if (onBalanceUpdated) {
          onBalanceUpdated(data.wallet.available_balance_ngn);
        }
      }
    } catch (err: any) {
      console.error('Wallet fetch error:', err);
      if (!isSilent) toast.error('Could not refresh wallet details');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [onBalanceUpdated]);

  // Handle return redirect from SeerBit if reference in URL
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const ref =
        params.get('reference') ||
        params.get('ref') ||
        params.get('paymentReference') ||
        params.get('linkingreference');
      if (ref && !verifyingRef) {
        setVerifyingRef(ref);
        toast.loading('Verifying payment with SeerBit...', { id: 'seerbit-verify' });
        fetch('/api/parent/wallet/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ reference: ref }),
        })
          .then((res) => res.json())
          .then((data) => {
            if (data.success) {
              toast.success(`Payment verified! ₦${(data.amount_kobo / 100).toLocaleString()} credited to your wallet.`, {
                id: 'seerbit-verify',
              });
              if (data.receipt) {
                setSelectedReceiptTx(data.receipt);
              }
              fetchWallet(true);
            } else {
              toast.error(data.error || 'Payment verification pending. Your wallet will update once confirmed.', {
                id: 'seerbit-verify',
              });
            }
          })
          .catch(() => {
            toast.dismiss('seerbit-verify');
          })
          .finally(() => {
            try {
              const currentUrl = new URL(window.location.href);
              currentUrl.searchParams.delete('reference');
              currentUrl.searchParams.delete('ref');
              currentUrl.searchParams.delete('paymentReference');
              currentUrl.searchParams.delete('linkingreference');
              currentUrl.searchParams.set('tab', 'wallet');
              window.history.replaceState({}, document.title, currentUrl.pathname + currentUrl.search);
            } catch {
              // fallback
            }
          });
      }
    }
  }, [fetchWallet, verifyingRef]);

  // Automated background polling & visibility re-sync (Zero user interaction required)
  useEffect(() => {
    fetchWallet(false);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchWallet(true);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Poll silently every 8 seconds to reflect newly arrived bank transfers
    const pollInterval = setInterval(() => {
      fetchWallet(true);
    }, 8000);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(pollInterval);
    };
  }, [fetchWallet]);

  const handleCopyAccount = (accountNum: string) => {
    if (!accountNum) return;
    if (!wallet?.virtual_account?.bank_name || !wallet?.virtual_account?.account_name) {
      toast.info('Virtual account details are generated by SeerBit, please try again or be patient...');
    }
    navigator.clipboard.writeText(accountNum);
    setCopiedAccount(true);
    toast.success('Virtual account number copied to clipboard!');
    setTimeout(() => setCopiedAccount(false), 2500);
  };

  const minPayment = dailyFee;
  const maxMonthlyPayment = dailyFee * 20; // Maximum payment is 1 school month (20 school days)

  // Progression options starting with agreed daily fee (1 Day) up to 1 Month (20 Days Max)
  const quickDayMultiples = [
    { days: 1, label: '1 Day (Least)', amount: dailyFee * 1 },
    { days: 2, label: '2 Days', amount: dailyFee * 2 },
    { days: 3, label: '3 Days', amount: dailyFee * 3 },
    { days: 4, label: '4 Days', amount: dailyFee * 4 },
    { days: 5, label: '5 Days (1 Wk)', amount: dailyFee * 5 },
    { days: 10, label: '10 Days (2 Wks)', amount: dailyFee * 10 },
    { days: 15, label: '15 Days (3 Wks)', amount: dailyFee * 15 },
    { days: 20, label: '20 Days (1 Mo Max)', amount: dailyFee * 20 },
  ];

  const handleStartDeposit = async () => {
    const finalAmount = Number(customAmount || depositAmount);
    if (!finalAmount || isNaN(finalAmount) || finalAmount < minPayment) {
      toast.error(`The least amount to be paid is ₦${minPayment.toLocaleString()} (the agreed daily transit fee for 1 day).`);
      return;
    }
    if (finalAmount > maxMonthlyPayment) {
      toast.error(`Parents are only expected to pay for a maximum of 1 month (20 school days: ₦${maxMonthlyPayment.toLocaleString()}).`);
      return;
    }

    setIsDepositing(true);
    try {
      const res = await fetch('/api/parent/wallet/deposit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ amount_ngn: finalAmount }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Could not initiate payment');
      }

      if (data.checkout_url) {
        toast.info('Redirecting to secure SeerBit checkout...');
        window.location.href = data.checkout_url;
      } else {
        toast.success('Deposit order created! Reference: ' + data.reference);
        setShowFundModal(false);
        fetchWallet(true);
      }
    } catch (err: any) {
      console.error('Deposit error:', err);
      toast.error(err.message || 'Payment initiation failed. Please try again.');
    } finally {
      setIsDepositing(false);
    }
  };

  return (
    <div className="max-w-[1600px] mx-auto space-y-6 pb-12">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-xs font-bold tracking-wide">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>CBN-Aligned Financial Vault &bull; Tamper-Evident Ledger</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              Parent Safety Wallet
            </h1>
            <p className="text-xs sm:text-sm text-emerald-100/80 max-w-xl font-medium">
              Manage pre-funded transit credits for school commutes, track automated escrow releases, and fund seamlessly via card or your dedicated virtual bank account.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => fetchWallet(false)}
              disabled={refreshing}
              className="px-4 py-2.5 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs font-bold flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              <span>{refreshing ? 'Updating...' : 'Refresh'}</span>
            </button>
            <button
              type="button"
              onClick={() => setShowFundModal(true)}
              className="px-5 py-2.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs flex items-center gap-2 shadow-lg shadow-emerald-500/30 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>Fund Wallet</span>
            </button>
          </div>
        </div>
      </div>

      {/* Pre-Trip Transport Authorization Banner (Phase 3 Regulatory Rule) */}
      {wallet && (
        wallet.available_balance_ngn < 1060 ? (
          <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/30 rounded-3xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start sm:items-center gap-3.5">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-700 flex items-center justify-center shrink-0">
                <AlertCircle className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-slate-900">
                  Daily Transport Balance Alert
                </h3>
                <p className="text-xs text-slate-600 font-medium mt-0.5">
                  Your MyEduRide wallet balance (₦{wallet.available_balance_ngn.toLocaleString('en-NG', { minimumFractionDigits: 2 })}) is below the required ₦1,060 daily fee for scheduled transport. Please fund your wallet to authorize today&apos;s pickup and drop-off.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowFundModal(true)}
              className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-extrabold text-xs shrink-0 transition-all cursor-pointer shadow-xs"
            >
              + Fund Now
            </button>
          </div>
        ) : (
          <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-2xl px-5 py-3.5 flex items-center justify-between gap-3 text-xs text-emerald-900 font-medium">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                <strong>Pre-Trip Balance Secured:</strong> ₦1,060 transit credit available for today&apos;s scheduled school morning pickup &amp; afternoon drop-off.
              </span>
            </div>
            <span className="hidden sm:inline-block px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase tracking-wider">
              Authorized
            </span>
          </div>
        )
      )}

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Card 1: Available Balance */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs relative overflow-hidden flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Wallet className="w-4 h-4 text-emerald-600" />
                Available Balance
              </span>
              <button
                type="button"
                onClick={() => setShowBalance(!showBalance)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
                title={showBalance ? 'Hide Balance' : 'Show Balance'}
              >
                {showBalance ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            <div className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
              {loading ? (
                <div className="h-10 w-36 bg-slate-100 animate-pulse rounded-xl" />
              ) : showBalance ? (
                `₦${(wallet?.available_balance_ngn ?? 0).toLocaleString('en-NG', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}`
              ) : (
                '••••••••'
              )}
            </div>

            <p className="text-[11px] text-slate-500 font-medium mt-2">
              Ready for daily morning and afternoon school ride bookings.
            </p>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 flex items-center gap-3">
            <button
              type="button"
              onClick={() => setShowFundModal(true)}
              className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-50 hover:bg-emerald-100/80 border border-emerald-200/80 text-emerald-800 text-xs font-extrabold flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <CreditCard className="w-3.5 h-3.5 text-emerald-600" />
              <span>+ Add Money</span>
            </button>
          </div>
        </div>

        {/* Card 2: Escrow & Protected Holds */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Lock className="w-4 h-4 text-amber-600" />
                Ride Escrow Holds
              </span>
              <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 text-[10px] font-extrabold border border-amber-200/60">
                Safe Buffer
              </span>
            </div>

            <div className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
              {loading ? (
                <div className="h-10 w-36 bg-slate-100 animate-pulse rounded-xl" />
              ) : showBalance ? (
                `₦${(wallet?.escrow_balance_ngn ?? 0).toLocaleString('en-NG', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}`
              ) : (
                '••••••••'
              )}
            </div>

            <p className="text-[11px] text-slate-500 font-medium mt-2">
              Held safely in escrow during in-transit trips. Automatically released to the school escort upon confirmed safe arrival.
            </p>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Active Holds:</span>
            <span className="font-extrabold text-slate-900">{escrowHolds.length} trips</span>
          </div>
        </div>

        {/* Card 3: Dedicated Virtual Bank Account */}
        <div className="bg-gradient-to-br from-slate-900 to-teal-950 text-white rounded-3xl p-6 shadow-md border border-slate-800 flex flex-col justify-between relative overflow-hidden">
          <div className="absolute right-[-20px] bottom-[-20px] opacity-10 pointer-events-none">
            <Building2 size={140} />
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-bold text-emerald-300 uppercase tracking-wider">
                  Dedicated Bank Transfer
                </span>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-[10px] font-bold">
                Instant 24/7
              </span>
            </div>

            <p className="text-[11px] text-slate-300 font-medium mb-3">
              Transfer funds from any Nigerian banking app directly to your personal MyEduRide account:
            </p>

            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3.5 border border-white/10 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    {wallet?.virtual_account.bank_name ? (
                      wallet.virtual_account.bank_name
                    ) : (
                      <span className="text-amber-300 normal-case font-medium italic">
                        Bank name is generated by SeerBit, please try again or be patient...
                      </span>
                    )}
                  </span>
                  <span className="text-lg font-black tracking-wider text-white">
                    {wallet?.virtual_account.account_number || 'Generating...'}
                  </span>
                </div>

                {wallet?.virtual_account.account_number && (
                  <button
                    type="button"
                    onClick={() => handleCopyAccount(wallet.virtual_account.account_number!)}
                    className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer"
                    title="Copy Account Number"
                  >
                    {copiedAccount ? (
                      <Check className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                )}
              </div>

              <div className="text-[11px] font-medium text-emerald-200 truncate pt-1 border-t border-white/10">
                Beneficiary:{' '}
                {wallet?.virtual_account.account_name ? (
                  <span className="font-bold text-white">{wallet.virtual_account.account_name}</span>
                ) : (
                  <span className="text-amber-300 font-medium italic">
                    Account name is generated by SeerBit, please try again or be patient...
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between gap-1.5 text-[10px] text-emerald-300/90 font-medium">
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-3 h-3 text-emerald-400 shrink-0" />
              <span>Instant webhook credit with cryptographic hash.</span>
            </div>
            <button
              type="button"
              onClick={() => handleSyncTransfer()}
              disabled={syncingTransfer}
              className="text-[10px] font-bold text-emerald-300 hover:text-white underline cursor-pointer flex items-center gap-1 disabled:opacity-50"
              title="Check SeerBit gateway for newly arrived bank transfers"
            >
              <RefreshCw size={11} className={syncingTransfer ? 'animate-spin' : ''} />
              <span>{syncingTransfer ? 'Checking...' : 'Check Status'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Cryptographic Ledger & Transaction History */}
      <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/80 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
              <History className="w-5 h-5 text-emerald-600" />
              Cryptographic Audit Ledger
            </h2>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Every balance update is permanently chained with SHA-256 cryptographic hashes for complete transparency.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>Double-Entry Protected</span>
          </div>
        </div>

        {loading ? (
          <div className="space-y-3 py-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-slate-50 animate-pulse rounded-2xl" />
            ))}
          </div>
        ) : transactions.length === 0 ? (
          <div className="text-center py-12 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-50 text-slate-400 flex items-center justify-center mx-auto">
              <Wallet className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-700">No Transactions Yet</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Fund your parent safety wallet to initialize your cryptographic ledger record.
            </p>
            <button
              type="button"
              onClick={() => setShowFundModal(true)}
              className="mt-2 px-4 py-2 rounded-xl bg-emerald-600 text-white font-bold text-xs hover:bg-emerald-500 transition-all cursor-pointer"
            >
              + Fund Wallet
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {transactions.map((tx) => {
              const isCredit = tx.transaction_type === 'CREDIT';
              return (
                <div
                  key={tx.id}
                  onClick={() => setSelectedReceiptTx(tx)}
                  className="p-4 rounded-2xl border border-slate-100 hover:border-emerald-200 hover:bg-slate-50/70 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 cursor-pointer group"
                >
                  <div className="flex items-center gap-3.5">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        isCredit
                          ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                          : 'bg-amber-50 text-amber-600 border border-amber-100'
                      }`}
                    >
                      {isCredit ? (
                        <ArrowDownLeft className="w-5 h-5 stroke-[2.5]" />
                      ) : (
                        <ArrowUpRight className="w-5 h-5 stroke-[2.5]" />
                      )}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-extrabold text-slate-900 group-hover:text-emerald-700 transition-colors">
                          {tx.description || (isCredit ? 'Wallet Deposit' : 'Ride Escrow Hold')}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                            isCredit
                              ? 'bg-emerald-100/70 text-emerald-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {tx.channel}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 mt-1 text-[11px] text-slate-400 font-medium">
                        <span>Ref: {tx.reference}</span>
                        <span>&bull;</span>
                        <span>{new Date(tx.created_at).toLocaleString('en-NG')}</span>
                        {tx.row_integrity_hash && (
                          <>
                            <span>&bull;</span>
                            <span
                              className="font-mono text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-md flex items-center gap-1"
                              title={`SHA-256 Hash: ${tx.row_integrity_hash}`}
                            >
                              <ShieldCheck className="w-3 h-3 text-emerald-600" />
                              Hash: {tx.row_integrity_hash.slice(0, 8)}...
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="sm:text-right shrink-0">
                    <div
                      className={`text-base font-black ${
                        isCredit ? 'text-emerald-600' : 'text-slate-900'
                      }`}
                    >
                      {isCredit ? '+' : '-'}₦{(tx.amount_ngn ?? 0).toLocaleString('en-NG', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </div>
                    <div className="text-[11px] text-slate-400 font-medium">
                      Balance: ₦{(tx.balance_after_ngn ?? 0).toLocaleString('en-NG', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </div>
                    <div className="text-[10px] font-bold text-emerald-700 opacity-80 group-hover:opacity-100 flex items-center justify-end gap-1 mt-1 transition-opacity">
                      <FileText className="w-3 h-3" />
                      <span>View Receipt</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Fund Wallet Modal */}
      {showFundModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl border border-slate-100 space-y-5 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-black">
                  <CreditCard className="w-4 h-4" />
                </div>
                <h2 className="text-base font-extrabold text-slate-900">Fund Parent Wallet</h2>
              </div>
              <button
                type="button"
                onClick={() => setShowFundModal(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              {/* AGREED FEE & SCHOOL MONTH CAP HEADER */}
              <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-200/80 space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-extrabold text-slate-700">Agreed Daily Transit Fee:</span>
                  <span className="font-mono font-black text-emerald-700 text-sm">
                    ₦{dailyFee.toLocaleString()} / day
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-500 pt-0.5 border-t border-emerald-100">
                  <span>Least Payment: <strong>₦{minPayment.toLocaleString()} (1 Day)</strong></span>
                  <span>1 Month Limit: <strong>₦{maxMonthlyPayment.toLocaleString()} (20 Days)</strong></span>
                </div>
              </div>

              {/* PAYMENT PROGRESSION OPTIONS (1060, 2120, 3180, 4240, 5300, etc.) */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1.5">
                  Select Days of Transit to Pay:
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {quickDayMultiples.map((opt) => {
                    const isSelected = Number(customAmount || depositAmount) === opt.amount;
                    return (
                      <button
                        key={opt.days}
                        type="button"
                        onClick={() => {
                          setDepositAmount(String(opt.amount));
                          setCustomAmount('');
                          setSelectedDays(opt.days);
                        }}
                        className={`p-2.5 rounded-xl text-center border transition-all cursor-pointer flex flex-col items-center justify-center gap-0.5 ${
                          isSelected
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-md ring-2 ring-emerald-400 font-black'
                            : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200 font-bold'
                        }`}
                      >
                        <span className={`text-[10px] ${isSelected ? 'text-emerald-100' : 'text-slate-500'}`}>
                          {opt.label}
                        </span>
                        <span className="font-mono text-xs">
                          ₦{opt.amount.toLocaleString()}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* INTERACTIVE DAYS STEPPER */}
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-700 block">Custom Days Selector:</span>
                  <span className="text-[10px] text-slate-500">Choose between 1 and 20 school days</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const next = Math.max(1, selectedDays - 1);
                      setSelectedDays(next);
                      setDepositAmount(String(next * dailyFee));
                      setCustomAmount('');
                    }}
                    className="w-8 h-8 rounded-lg bg-white border border-slate-300 text-slate-700 font-black text-sm flex items-center justify-center hover:bg-slate-100 cursor-pointer"
                  >
                    -
                  </button>
                  <span className="font-mono font-black text-xs text-slate-900 w-12 text-center">
                    {selectedDays} {selectedDays === 1 ? 'day' : 'days'}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const next = Math.min(20, selectedDays + 1);
                      setSelectedDays(next);
                      setDepositAmount(String(next * dailyFee));
                      setCustomAmount('');
                    }}
                    className="w-8 h-8 rounded-lg bg-white border border-slate-300 text-slate-700 font-black text-sm flex items-center justify-center hover:bg-slate-100 cursor-pointer"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* CUSTOM AMOUNT WITH STRICT BOUNDS */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-700">
                    Or Enter Exact Amount:
                  </label>
                  <span className="text-[10px] text-slate-400 font-mono">
                    ₦{minPayment.toLocaleString()} - ₦{maxMonthlyPayment.toLocaleString()}
                  </span>
                </div>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-sm">
                    ₦
                  </span>
                  <input
                    type="number"
                    min={minPayment}
                    max={maxMonthlyPayment}
                    value={customAmount}
                    onChange={(e) => {
                      const val = e.target.value;
                      setCustomAmount(val);
                      if (val) setDepositAmount(val);
                    }}
                    placeholder={`Enter amount (min ₦${minPayment.toLocaleString()}, max ₦${maxMonthlyPayment.toLocaleString()})`}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-4 py-3 text-sm font-extrabold text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white transition-all font-mono"
                  />
                </div>
                {Number(customAmount || depositAmount) > maxMonthlyPayment && (
                  <p className="text-[10px] text-amber-600 font-bold mt-1">
                    ⚠️ Maximum payment allowed is 1 school month (20 days: ₦{maxMonthlyPayment.toLocaleString()}).
                  </p>
                )}
                {Number(customAmount || depositAmount) < minPayment && (
                  <p className="text-[10px] text-amber-600 font-bold mt-1">
                    ⚠️ The least payment is ₦{minPayment.toLocaleString()} (agreed daily fee for 1 day).
                  </p>
                )}
              </div>

              <div className="p-3 bg-emerald-50/60 rounded-2xl border border-emerald-100 text-[11px] text-emerald-900 flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>
                  Payments are processed via <strong>SeerBit CBN-Licensed Gateway</strong> with 256-bit encryption. Supports debit cards, USSD, and instant bank transfer.
                </span>
              </div>

              <button
                type="button"
                onClick={handleStartDeposit}
                disabled={isDepositing}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs py-3.5 rounded-xl shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                {isDepositing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Connecting to SeerBit...</span>
                  </>
                ) : (
                  <>
                    <span>Proceed to Pay ₦{Number(customAmount || depositAmount).toLocaleString()}</span>
                    <ChevronRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Instant Digital Receipt Modal */}
      <DigitalReceiptModal
        isOpen={!!selectedReceiptTx}
        onClose={() => setSelectedReceiptTx(null)}
        transaction={selectedReceiptTx}
        entityDetails={{
          name: 'Parent / Guardian',
          type: 'PARENT',
        }}
      />
    </div>
  );
}
