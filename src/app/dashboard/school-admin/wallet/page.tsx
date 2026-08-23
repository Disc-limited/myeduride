// @ts-nocheck
'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  ArrowRightLeft,
  CreditCard,
  Gift,
  TrendingUp,
  Eye,
  EyeOff,
  History,
  ShieldCheck,
  CheckCircle2,
  Clock
} from 'lucide-react';
import { toast } from 'sonner';

export default function SchoolWalletOverviewPage() {
  const [showBalance, setShowBalance] = useState(true);
  const [balance, setBalance] = useState(1485000);
  const [escrowBalance, setEscrowBalance] = useState(320000);

  const transactions = [
    {
      id: 'TXN-881920',
      type: 'credit',
      title: 'Term 3 Transport Fee Collection (Lekki Route)',
      date: '2026-08-22 09:14 AM',
      amount: '+₦180,000',
      status: 'completed',
    },
    {
      id: 'TXN-881919',
      type: 'debit',
      title: 'Escort Weekly Service Payout (Babajide A.)',
      date: '2026-08-21 04:30 PM',
      amount: '-₦45,000',
      status: 'completed',
    },
    {
      id: 'TXN-881918',
      type: 'credit',
      title: 'Parent Shared-Ride Booking Deposit',
      date: '2026-08-20 11:20 AM',
      amount: '+₦25,000',
      status: 'completed',
    },
    {
      id: 'TXN-881917',
      type: 'debit',
      title: 'EduRide Premium School Platform Fee',
      date: '2026-08-15 08:00 AM',
      amount: '-₦50,000',
      status: 'completed',
    },
  ];

  return (
    <div className="space-y-6 font-sans text-slate-800 p-4 md:p-6 max-w-7xl mx-auto">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-[#07132B] via-[#0B1E36] to-[#0A1633] rounded-3xl p-6 text-white shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-5 border border-slate-800">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 font-black text-[11px] border border-emerald-400/30 uppercase tracking-wider flex items-center gap-1.5">
              <Wallet size={13} /> School Financial Hub
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">
            School Wallet & Revenue Control
          </h1>
          <p className="text-slate-300 text-xs md:text-sm max-w-2xl font-medium">
            Manage transport collections, driver and escort automated payouts, bank withdrawals, and mobility platform subscriptions.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/dashboard/school-admin/wallet/transfer"
            className="px-4 py-2.5 rounded-2xl bg-[#00A859] hover:bg-emerald-600 text-white font-extrabold text-xs transition-all shadow-md shadow-emerald-600/20 flex items-center gap-2 cursor-pointer"
          >
            <ArrowRightLeft size={15} />
            <span>Transfer Funds</span>
          </Link>
          <Link
            href="/dashboard/school-admin/wallet/withdrawal"
            className="px-4 py-2.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-extrabold text-xs transition-all border border-white/20 flex items-center gap-2 cursor-pointer"
          >
            <ArrowDownLeft size={15} />
            <span>Withdraw to Bank</span>
          </Link>
        </div>
      </div>

      {/* Balance Cards Matrix */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-gradient-to-br from-emerald-600 to-teal-800 rounded-3xl p-6 text-white shadow-lg space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase text-emerald-100 tracking-wider">Available Balance</span>
            <button onClick={() => setShowBalance(!showBalance)} className="text-emerald-100 hover:text-white cursor-pointer">
              {showBalance ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <div>
            <h2 className="text-3xl font-black tracking-tight">
              {showBalance ? `₦${balance.toLocaleString()}` : '••••••••'}
            </h2>
            <span className="text-xs text-emerald-100 font-medium">Ready for payout or withdrawal</span>
          </div>
        </div>

        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase text-slate-400 tracking-wider">Escrow Transit Pool</span>
            <ShieldCheck size={18} className="text-cyan-600" />
          </div>
          <div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">
              {showBalance ? `₦${escrowBalance.toLocaleString()}` : '••••••••'}
            </h2>
            <span className="text-xs text-slate-500 font-medium">Protected transit completion pool</span>
          </div>
        </div>

        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase text-slate-400 tracking-wider">Platform Subscription</span>
            <CreditCard size={18} className="text-purple-600" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">Enterprise Safety</h2>
            <span className="text-xs text-purple-700 font-bold">Active · Renews in 42 days</span>
          </div>
        </div>
      </div>

      {/* Quick Navigation Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Link
          href="/dashboard/school-admin/wallet/transfer"
          className="p-4 rounded-2xl bg-white border border-slate-200 hover:border-emerald-500 hover:shadow-md transition-all group"
        >
          <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold mb-2 group-hover:scale-105 transition-all">
            <ArrowRightLeft size={18} />
          </div>
          <h4 className="font-black text-slate-900 text-xs group-hover:text-emerald-600">Fund Transfers</h4>
          <p className="text-[10px] text-slate-500 mt-0.5">Pay escorts & drivers</p>
        </Link>

        <Link
          href="/dashboard/school-admin/wallet/withdrawal"
          className="p-4 rounded-2xl bg-white border border-slate-200 hover:border-blue-500 hover:shadow-md transition-all group"
        >
          <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold mb-2 group-hover:scale-105 transition-all">
            <ArrowDownLeft size={18} />
          </div>
          <h4 className="font-black text-slate-900 text-xs group-hover:text-blue-600">Withdrawals</h4>
          <p className="text-[10px] text-slate-500 mt-0.5">Direct bank settlements</p>
        </Link>

        <Link
          href="/dashboard/school-admin/wallet/subscription"
          className="p-4 rounded-2xl bg-white border border-slate-200 hover:border-purple-500 hover:shadow-md transition-all group"
        >
          <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold mb-2 group-hover:scale-105 transition-all">
            <CreditCard size={18} />
          </div>
          <h4 className="font-black text-slate-900 text-xs group-hover:text-purple-600">Subscriptions</h4>
          <p className="text-[10px] text-slate-500 mt-0.5">Manage school plan</p>
        </Link>

        <Link
          href="/dashboard/school-admin/wallet/rewards"
          className="p-4 rounded-2xl bg-white border border-slate-200 hover:border-amber-500 hover:shadow-md transition-all group"
        >
          <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold mb-2 group-hover:scale-105 transition-all">
            <Gift size={18} />
          </div>
          <h4 className="font-black text-slate-900 text-xs group-hover:text-amber-600">Reward Wallet</h4>
          <p className="text-[10px] text-slate-500 mt-0.5">Safety bonuses & perks</p>
        </Link>
      </div>

      {/* Recent Transactions Ledger */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="font-black text-slate-900 text-base">Recent Wallet Transactions</h3>
          <span className="text-xs font-bold text-slate-500">{transactions.length} Records</span>
        </div>

        <div className="space-y-3">
          {transactions.map((t) => (
            <div key={t.id} className="p-4 rounded-2xl border border-slate-100 bg-slate-50/50 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold ${
                    t.type === 'credit' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                  }`}
                >
                  {t.type === 'credit' ? <ArrowDownLeft size={18} /> : <ArrowUpRight size={18} />}
                </div>
                <div>
                  <h4 className="font-black text-slate-900 text-xs">{t.title}</h4>
                  <span className="text-[10px] text-slate-400 font-mono">{t.id} · {t.date}</span>
                </div>
              </div>

              <div className="text-right">
                <span
                  className={`font-black text-sm block ${
                    t.type === 'credit' ? 'text-emerald-600' : 'text-slate-900'
                  }`}
                >
                  {t.amount}
                </span>
                <span className="text-[9px] font-black text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded-md uppercase">
                  {t.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
