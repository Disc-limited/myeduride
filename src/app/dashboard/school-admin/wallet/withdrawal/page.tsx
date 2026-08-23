// @ts-nocheck
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowDownLeft, ArrowLeft, Building2, CheckCircle2, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

export default function WalletWithdrawalPage() {
  const [bank, setBank] = useState('Zenith Bank');
  const [accountNumber, setAccountNumber] = useState('1019283741');
  const [accountName, setAccountName] = useState('GREENFIELD INT SCHOOL REVENUE');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);

  const handleWithdrawal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || parseInt(amount) < 5000) {
      toast.error('Minimum withdrawal is ₦5,000');
      return;
    }
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      toast.success(`Withdrawal request of ₦${parseInt(amount).toLocaleString()} initiated to ${bank}! Settlement within 15 minutes.`);
      setAmount('');
    }, 1200);
  };

  return (
    <div className="space-y-6 font-sans text-slate-800 p-4 md:p-6 max-w-3xl mx-auto">
      <Link
        href="/dashboard/school-admin/wallet"
        className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-900 cursor-pointer"
      >
        <ArrowLeft size={14} /> Back to Wallet Overview
      </Link>

      <div className="bg-white rounded-3xl p-6 md:p-8 border border-slate-200 shadow-xs space-y-6">
        <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-800 flex items-center justify-center font-black">
            <Building2 size={22} />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-900">Withdraw to Bank Account</h2>
            <p className="text-xs text-slate-500 font-medium">Transfer available school wallet funds directly to your verified commercial bank account.</p>
          </div>
        </div>

        <form onSubmit={handleWithdrawal} className="space-y-4 text-xs">
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-2">
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Settlement Bank Account</span>
            <p className="text-sm font-black text-slate-900">{accountName}</p>
            <p className="text-xs font-mono text-slate-600 font-bold">{bank} · {accountNumber}</p>
            <span className="inline-block text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md">
              ✓ NUBAN Verified & Linked
            </span>
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">Amount to Withdraw (₦) *</label>
            <input
              type="number"
              required
              placeholder="100,000"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-black text-sm text-slate-900"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-black text-xs transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer mt-4"
          >
            <ArrowDownLeft size={15} />
            <span>{loading ? 'Processing Settlement...' : 'Authorize Bank Withdrawal'}</span>
          </button>
        </form>
      </div>
    </div>
  );
}
