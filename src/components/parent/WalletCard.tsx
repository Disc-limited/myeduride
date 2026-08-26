'use client';

import { useState } from 'react';
import { Wallet, Eye, EyeOff, Plus, ArrowRight } from 'lucide-react';

interface WalletCardProps {
  balanceAmount?: number;
  currencySymbol?: string;
  onFundWallet: () => void;
  onViewWalletHistory: () => void;
}

export default function WalletCard({
  balanceAmount = 0,
  currencySymbol = '₦',
  onFundWallet,
  onViewWalletHistory,
}: WalletCardProps) {
  const [showBalance, setShowBalance] = useState(true);

  const formattedAmount = new Intl.NumberFormat('en-NG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(balanceAmount);

  return (
    <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs hover:shadow-md transition-all">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600">
            <Wallet className="w-4 h-4" />
          </div>
          <h2 className="text-sm font-extrabold text-slate-900 tracking-tight">Wallet Balance</h2>
        </div>
        <button
          type="button"
          onClick={() => setShowBalance(!showBalance)}
          className="text-slate-400 hover:text-slate-600 transition-colors p-1.5 rounded-lg hover:bg-slate-100"
          title={showBalance ? 'Hide Balance' : 'Show Balance'}
        >
          {showBalance ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>

      {/* Main Balance Display */}
      <div className="my-3.5 bg-slate-50/80 p-3.5 rounded-2xl border border-slate-100">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
          Available Balance
        </span>
        <div className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
          {showBalance ? (
            <span>
              {currencySymbol}
              {formattedAmount}
            </span>
          ) : (
            <span className="tracking-widest text-slate-400">••••••••</span>
          )}
        </div>
      </div>

      {/* Buttons */}
      <div className="space-y-2">
        <button
          type="button"
          onClick={onFundWallet}
          className="w-full bg-emerald-50 hover:bg-emerald-100/80 border border-emerald-200/80 text-emerald-800 text-xs font-extrabold py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-2xs"
        >
          <Plus className="w-4 h-4 text-emerald-600 stroke-[3]" />
          <span>+ Fund Wallet</span>
        </button>

        <button
          type="button"
          onClick={onViewWalletHistory}
          className="w-full text-center text-xs font-bold text-slate-500 hover:text-slate-900 py-1 transition-colors flex items-center justify-center gap-1"
        >
          <span>View Wallet History</span>
          <ArrowRight className="w-3 h-3 text-slate-400" />
        </button>
      </div>
    </div>
  );
}
