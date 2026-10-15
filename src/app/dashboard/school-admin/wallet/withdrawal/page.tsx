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
      toast.success(
        `Withdrawal request of ₦${parseInt(amount).toLocaleString()} initiated to ${bank}! Settlement within 15 minutes.`
      );
      setAmount('');
    }, 1200);
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 font-sans text-slate-800 md:p-6">
      <Link
        href="/dashboard/school-admin/wallet"
        className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-900"
      >
        <ArrowLeft size={14} /> Back to Wallet Overview
      </Link>

      <div className="shadow-xs space-y-6 rounded-3xl border border-slate-200 bg-white p-6 md:p-8">
        <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-100 font-black text-blue-800">
            <Building2 size={22} />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-900">Withdraw to Bank Account</h2>
            <p className="text-xs font-medium text-slate-500">
              Transfer available school wallet funds directly to your verified commercial bank
              account.
            </p>
          </div>
        </div>

        <form onSubmit={handleWithdrawal} className="space-y-4 text-xs">
          <div className="space-y-2 rounded-2xl border border-slate-100 bg-slate-50 p-4">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
              Settlement Bank Account
            </span>
            <p className="text-sm font-black text-slate-900">{accountName}</p>
            <p className="font-mono text-xs font-bold text-slate-600">
              {bank} · {accountNumber}
            </p>
            <span className="inline-block rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
              ✓ NUBAN Verified & Linked
            </span>
          </div>

          <div>
            <label className="mb-1 block font-bold text-slate-700">Amount to Withdraw (₦) *</label>
            <input
              type="number"
              required
              placeholder="100,000"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm font-black text-slate-900"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-4 flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-slate-900 py-3 text-xs font-black text-white shadow-md transition-all hover:bg-slate-800"
          >
            <ArrowDownLeft size={15} />
            <span>{loading ? 'Processing Settlement...' : 'Authorize Bank Withdrawal'}</span>
          </button>
        </form>
      </div>
    </div>
  );
}
