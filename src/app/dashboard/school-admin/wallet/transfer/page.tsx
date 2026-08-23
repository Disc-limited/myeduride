// @ts-nocheck
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRightLeft, ArrowLeft, Send, CheckCircle2, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

export default function WalletTransferPage() {
  const [recipientType, setRecipientType] = useState('escort');
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [narrative, setNarrative] = useState('');
  const [loading, setLoading] = useState(false);

  const handleTransfer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !recipient) {
      toast.error('Recipient and amount are required');
      return;
    }
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      toast.success(`Successfully transferred ₦${parseInt(amount).toLocaleString()} to ${recipient}!`);
      setAmount('');
      setRecipient('');
      setNarrative('');
    }, 1000);
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
          <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-black">
            <ArrowRightLeft size={22} />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-900">Wallet Fund Transfer</h2>
            <p className="text-xs text-slate-500 font-medium">Disburse payments to school escorts, drivers, and safety service personnel.</p>
          </div>
        </div>

        <form onSubmit={handleTransfer} className="space-y-4 text-xs">
          <div>
            <label className="font-bold text-slate-700 block mb-1.5">Recipient Classification</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setRecipientType('escort')}
                className={`py-2 px-3 rounded-xl font-bold cursor-pointer transition-all ${
                  recipientType === 'escort' ? 'bg-slate-900 text-white' : 'bg-slate-50 border text-slate-600'
                }`}
              >
                School / Platform Escort
              </button>
              <button
                type="button"
                onClick={() => setRecipientType('driver')}
                className={`py-2 px-3 rounded-xl font-bold cursor-pointer transition-all ${
                  recipientType === 'driver' ? 'bg-slate-900 text-white' : 'bg-slate-50 border text-slate-600'
                }`}
              >
                Transport Driver / Staff
              </button>
            </div>
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">Recipient Name or Phone / Escort Code *</label>
            <input
              type="text"
              required
              placeholder="e.g. Babajide Adeleke (ESC-8821)"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold"
            />
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">Amount to Disburse (₦) *</label>
            <input
              type="number"
              required
              placeholder="50,000"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-black text-sm text-emerald-700"
            />
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">Payment Narrative / Reference</label>
            <input
              type="text"
              placeholder="e.g. Week 4 Transport Service Stipend"
              value={narrative}
              onChange={(e) => setNarrative(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-[#00A859] hover:bg-emerald-600 text-white font-black text-xs transition-all shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 cursor-pointer mt-4"
          >
            <Send size={15} />
            <span>{loading ? 'Processing Transfer...' : 'Authorize Fund Transfer'}</span>
          </button>
        </form>
      </div>
    </div>
  );
}
