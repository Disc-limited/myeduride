'use client';

import React, { useState, useEffect, useCallback } from 'react';
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
}

export default function ParentWalletView({
  onBalanceUpdated,
  openFundOnMount = false,
}: ParentWalletViewProps) {
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const [escrowHolds, setEscrowHolds] = useState<EscrowHoldItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showBalance, setShowBalance] = useState(true);
  const [copiedAccount, setCopiedAccount] = useState(false);

  // Fund Modal state
  const [showFundModal, setShowFundModal] = useState(openFundOnMount);
  const [depositAmount, setDepositAmount] = useState<string>('5000');
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
        setWallet(data.wallet);
        setTransactions(data.transactions || []);
        setEscrowHolds(data.escrow_holds || []);
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
            const cleanUrl = window.location.pathname + window.location.search.replace(/[?&]reference=[^&]+/, '').replace(/[?&]ref=[^&]+/, '');
            window.history.replaceState({}, document.title, cleanUrl);
          });
      }
    }
  }, [fetchWallet, verifyingRef]);

  useEffect(() => {
    fetchWallet(false);
  }, [fetchWallet]);

  const handleCopyAccount = (accountNum: string) => {
    if (!accountNum) return;
    navigator.clipboard.writeText(accountNum);
    setCopiedAccount(true);
    toast.success('Virtual account number copied to clipboard!');
    setTimeout(() => setCopiedAccount(false), 2500);
  };

  const handleStartDeposit = async () => {
    const finalAmount = Number(customAmount || depositAmount);
    if (!finalAmount || isNaN(finalAmount) || finalAmount < 500) {
      toast.error('Minimum deposit amount is ₦500');
      return;
    }
    if (finalAmount > 500000) {
      toast.error('Maximum deposit amount per transaction is ₦500,000');
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

  const quickAmounts = ['2000', '5000', '10000', '20000', '50000'];

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
                    {wallet?.virtual_account.bank_name || 'Wema Bank (SeerBit)'}
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

              {wallet?.virtual_account.account_name && (
                <div className="text-[11px] font-medium text-emerald-200 truncate pt-1 border-t border-white/10">
                  Beneficiary: {wallet.virtual_account.account_name}
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-white/10 flex items-center gap-1.5 text-[10px] text-emerald-300/90 font-medium">
            <Sparkles className="w-3 h-3 text-emerald-400 shrink-0" />
            <span>Instant webhook credit with tamper-evident cryptographic hash.</span>
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
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-2">
                  Select Quick Amount:
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {quickAmounts.map((amt) => {
                    const isSelected = depositAmount === amt && !customAmount;
                    return (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => {
                          setDepositAmount(amt);
                          setCustomAmount('');
                        }}
                        className={`py-2.5 rounded-xl text-xs font-extrabold border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                            : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                        }`}
                      >
                        ₦{Number(amt).toLocaleString()}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-2">
                  Or Custom Amount (₦500 - ₦500,000):
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-sm">
                    ₦
                  </span>
                  <input
                    type="number"
                    min="500"
                    max="500000"
                    value={customAmount}
                    onChange={(e) => {
                      setCustomAmount(e.target.value);
                      if (e.target.value) setDepositAmount(e.target.value);
                    }}
                    placeholder="Enter amount (e.g. 7500)"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-4 py-3 text-sm font-extrabold text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white transition-all"
                  />
                </div>
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

      {/* Digital Receipt Modal (Phase 3 Requirement) */}
      {selectedReceiptTx && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-100 space-y-5 animate-in fade-in zoom-in duration-200">
            {/* Receipt Header */}
            <div className="flex items-start justify-between pb-4 border-b border-slate-100">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 text-[10px] font-black border border-emerald-200/80">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>OFFICIAL TRANSACTION RECEIPT</span>
                </div>
                <h2 className="text-xl font-black text-slate-900 tracking-tight">
                  MyEduRide Transit Vault
                </h2>
                <p className="text-[11px] text-slate-400">
                  CBN-Compliant Electronic Ledger Voucher
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedReceiptTx(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Receipt Amount Box */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-center space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
                Total Transaction Amount
              </span>
              <div className="text-3xl font-black text-slate-900">
                ₦{selectedReceiptTx.amount_ngn.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-extrabold">
                <CheckCircle2 className="w-3 h-3" />
                <span>{selectedReceiptTx.status}</span>
              </div>
            </div>

            {/* Details Table */}
            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between py-1 border-b border-slate-100">
                <span className="text-slate-400 font-medium">Transaction Type</span>
                <span className="font-extrabold text-slate-900">{selectedReceiptTx.transaction_type}</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-slate-100">
                <span className="text-slate-400 font-medium">Payment Channel</span>
                <span className="font-extrabold text-slate-900">{selectedReceiptTx.channel}</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-slate-100">
                <span className="text-slate-400 font-medium">Payment Reference</span>
                <span className="font-mono font-bold text-slate-700">{selectedReceiptTx.reference}</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-slate-100">
                <span className="text-slate-400 font-medium">Date &amp; Time</span>
                <span className="font-medium text-slate-900">
                  {new Date(selectedReceiptTx.created_at).toLocaleString('en-NG')}
                </span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-slate-100">
                <span className="text-slate-400 font-medium">Balance Before</span>
                <span className="font-medium text-slate-700">
                  ₦{selectedReceiptTx.balance_before_ngn.toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-slate-100">
                <span className="text-slate-400 font-medium">Balance After</span>
                <span className="font-black text-slate-900">
                  ₦{selectedReceiptTx.balance_after_ngn.toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                </span>
              </div>

              {/* SHA-256 Ledger Integrity Proof */}
              {selectedReceiptTx.row_integrity_hash && (
                <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-100 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-extrabold text-emerald-800 uppercase tracking-wider flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                      Cryptographic Ledger Hash (SHA-256)
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(selectedReceiptTx.row_integrity_hash || '');
                        setCopiedHash(true);
                        toast.success('SHA-256 hash copied to clipboard');
                        setTimeout(() => setCopiedHash(false), 2000);
                      }}
                      className="text-[10px] font-bold text-emerald-700 hover:text-emerald-900 cursor-pointer"
                    >
                      {copiedHash ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                  <div className="font-mono text-[10px] text-slate-700 break-all bg-white/80 p-2 rounded-lg border border-emerald-100/60 select-all">
                    {selectedReceiptTx.row_integrity_hash}
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="flex-1 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm"
              >
                <Printer className="w-4 h-4" />
                <span>Print / Save Receipt</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedReceiptTx(null)}
                className="px-5 py-3 rounded-xl border border-slate-200 text-slate-600 hover:text-slate-900 font-bold text-xs transition-all cursor-pointer"
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
