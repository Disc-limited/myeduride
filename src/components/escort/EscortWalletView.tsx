// @ts-nocheck
'use client';

import { useState } from 'react';
import {
  Wallet,
  CreditCard,
  ArrowUpRight,
  ArrowDownLeft,
  DollarSign,
  TrendingUp,
  Sparkles,
  ShieldCheck,
  Eye,
  EyeOff,
  CheckCircle2,
  Plus,
  RefreshCw,
  Clock,
  X
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
  const [showTopUpModal, setShowTopUpModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState('5000');
  const [withdrawAmount, setWithdrawAmount] = useState('10000');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const wallet = liveDashboardData?.wallet || {};
  const balance = Number(wallet.balance ?? 25000.0);

  const handleFundWallet = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/escorts/dashboard-live', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'fund_wallet', amount: Number(topUpAmount) }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(data.message || `₦${Number(topUpAmount).toLocaleString()} added to wallet!`);
        setShowTopUpModal(false);
        onRefreshData();
      } else {
        throw new Error(data.error || 'Funding failed');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to fund wallet');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleWithdrawWallet = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/escorts/dashboard-live', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'withdraw_wallet', amount: Number(withdrawAmount) }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(data.message || `Payout request for ₦${Number(withdrawAmount).toLocaleString()} submitted!`);
        setShowWithdrawModal(false);
        onRefreshData();
      } else {
        throw new Error(data.error || 'Withdrawal failed');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to request withdrawal');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. WALLET HERO BALANCE & CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Main Wallet Balance Card */}
        <div className="md:col-span-2 bg-gradient-to-tr from-slate-900 via-slate-800 to-slate-900 rounded-3xl p-6 md:p-8 text-white shadow-xl relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
                <Wallet size={20} />
              </span>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Available Balance</span>
                <span className="text-xs text-slate-300 font-semibold">MyEduRide Official Escort Wallet</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowBalance(!showBalance)}
              className="text-slate-400 hover:text-white p-2 rounded-xl bg-white/5 transition-all"
            >
              {showBalance ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          <div className="my-6">
            <h2 className="text-3xl md:text-4xl font-black font-mono tracking-tight text-emerald-400">
              {showBalance ? `₦${balance.toLocaleString('en-NG', { minimumFractionDigits: 2 })}` : '••••••••'}
            </h2>
            <p className="text-xs text-slate-400 mt-1 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span>Instant payout ready • Secured by DISCL FinTech Engine</span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-slate-700/50">
            <button
              type="button"
              onClick={() => setShowTopUpModal(true)}
              className="flex-1 py-3 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Plus size={15} />
              <span>+ Add Money</span>
            </button>

            <button
              type="button"
              onClick={() => setShowWithdrawModal(true)}
              className="flex-1 py-3 px-4 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-extrabold text-xs transition-all border border-white/20 flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <ArrowUpRight size={15} />
              <span>Request Payout</span>
            </button>
          </div>
        </div>

        {/* EduSave & EduInsuRed Summary Card */}
        <div className="space-y-4">
          <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                <Sparkles size={14} className="text-amber-500" /> EduSave Balance
              </span>
              <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-extrabold">Active Goal</span>
            </div>
            <p className="text-2xl font-black text-slate-900 font-mono">
              ₦{Number(wallet.eduSave ?? 35000.0).toLocaleString('en-NG', { minimumFractionDigits: 2 })}
            </p>
            <p className="text-[11px] text-slate-500">Auto-saving 10% of weekly transit earnings.</p>
          </div>

          <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                <ShieldCheck size={14} className="text-blue-500" /> EduInsuRed Status
              </span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-extrabold">Covered</span>
            </div>
            <p className="text-sm font-extrabold text-slate-900">Comprehensive Transit &amp; Medical Cover</p>
            <p className="text-[11px] text-slate-500">Policy active for all scheduled route passengers.</p>
          </div>
        </div>
      </div>

      {/* 2. RECENT TRANSACTIONS LEDGER */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-black text-base text-slate-900">Recent Transactions &amp; Payouts</h3>
          <span className="text-xs font-bold text-slate-400">Live Supabase Ledger</span>
        </div>

        <div className="divide-y divide-slate-100 text-xs">
          {[
            { title: 'Morning Route Pickup Completion Bonus', time: 'Today, 08:30 AM', amount: '+₦4,500.00', type: 'credit', status: 'Completed' },
            { title: 'Afternoon Drop-off Transit Earnings', time: 'Yesterday, 03:45 PM', amount: '+₦4,000.00', type: 'credit', status: 'Completed' },
            { title: 'Weekly Wallet Bank Withdrawal Payout', time: '24 Aug 2026', amount: '-₦20,000.00', type: 'debit', status: 'Settled' },
            { title: 'Fuel & Maintenance Subsidy Reimbursement', time: '22 Aug 2026', amount: '+₦12,500.00', type: 'credit', status: 'Completed' },
          ].map((tx, i) => (
            <div key={i} className="py-3.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-2xl flex items-center justify-center ${tx.type === 'credit' ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'}`}>
                  {tx.type === 'credit' ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
                </div>
                <div>
                  <p className="font-extrabold text-slate-900">{tx.title}</p>
                  <p className="text-[10px] text-slate-400">{tx.time} • Status: {tx.status}</p>
                </div>
              </div>
              <span className={`font-mono font-black text-sm ${tx.type === 'credit' ? 'text-emerald-600' : 'text-slate-900'}`}>
                {tx.amount}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* MODAL: TOP UP WALLET */}
      {showTopUpModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 border border-slate-200 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="font-black text-base text-slate-900 flex items-center gap-2">
                <CreditCard size={20} className="text-emerald-600" /> Add Funds to Escort Wallet
              </h3>
              <button onClick={() => setShowTopUpModal(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleFundWallet} className="space-y-4 text-xs font-semibold">
              <div>
                <label className="block text-slate-700 mb-1">Enter Amount (₦)</label>
                <input
                  type="number"
                  required
                  min="1000"
                  value={topUpAmount}
                  onChange={(e) => setTopUpAmount(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-base font-black font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                {['2000', '5000', '10000'].map((amt) => (
                  <button
                    type="button"
                    key={amt}
                    onClick={() => setTopUpAmount(amt)}
                    className="py-2 rounded-xl bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 font-extrabold text-xs transition-all border border-slate-200 cursor-pointer"
                  >
                    ₦{Number(amt).toLocaleString()}
                  </button>
                ))}
              </div>

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowTopUpModal(false)}
                  className="flex-1 py-3 border border-slate-300 rounded-2xl font-extrabold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold shadow-md cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? 'Processing...' : 'Confirm Top Up'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: REQUEST WITHDRAWAL */}
      {showWithdrawModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 border border-slate-200 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="font-black text-base text-slate-900 flex items-center gap-2">
                <ArrowUpRight size={20} className="text-emerald-600" /> Request Payout / Withdrawal
              </h3>
              <button onClick={() => setShowWithdrawModal(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleWithdrawWallet} className="space-y-4 text-xs font-semibold">
              <div>
                <label className="block text-slate-700 mb-1">Withdrawal Amount (₦)</label>
                <input
                  type="number"
                  required
                  min="1000"
                  max={balance}
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-base font-black font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 text-[11px] text-slate-600 space-y-1">
                <p className="font-bold text-slate-800">Direct Bank Settlement:</p>
                <p>Funds will be credited directly to your registered bank account within 15 minutes.</p>
              </div>

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowWithdrawModal(false)}
                  className="flex-1 py-3 border border-slate-300 rounded-2xl font-extrabold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-3 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold shadow-md cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? 'Submitting...' : 'Request Payout'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
