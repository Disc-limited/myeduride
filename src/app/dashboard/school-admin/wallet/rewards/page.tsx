// @ts-nocheck
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Gift, ArrowLeft, Award, Sparkles, CheckCircle2, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';

export default function WalletRewardsPage() {
  const [rewardPoints, setRewardPoints] = useState(8450);
  const [rewardsList, setRewardsList] = useState([
    {
      id: '1',
      title: 'Zero Incident Safety Milestone (Q2)',
      points: '+2,500 pts',
      date: '2026-08-15',
      badge: 'Safety Excellence',
    },
    {
      id: '2',
      title: 'Escort On-Time Arrival Performance Bonus',
      points: '+1,200 pts',
      date: '2026-08-10',
      badge: 'Transit Reliability',
    },
    {
      id: '3',
      title: 'New Parent Onboarding Referral Bonus',
      points: '+750 pts',
      date: '2026-08-01',
      badge: 'Community Growth',
    },
  ]);

  return (
    <div className="space-y-6 font-sans text-slate-800 p-4 md:p-6 max-w-4xl mx-auto">
      <Link
        href="/dashboard/school-admin/wallet"
        className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-900 cursor-pointer"
      >
        <ArrowLeft size={14} /> Back to Wallet Overview
      </Link>

      <div className="bg-white rounded-3xl p-6 md:p-8 border border-slate-200 shadow-xs space-y-6">
        <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center font-black">
            <Gift size={22} />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-900">Safety Reward Wallet & Incentives</h2>
            <p className="text-xs text-slate-500 font-medium">Earn safety merit points, reward top-performing school escorts and drivers, and unlock platform fee discounts.</p>
          </div>
        </div>

        {/* Reward Points Banner */}
        <div className="bg-gradient-to-r from-amber-500 to-orange-600 rounded-3xl p-6 text-white flex items-center justify-between shadow-lg">
          <div>
            <span className="text-xs font-black uppercase text-amber-100 tracking-wider">Accumulated Safety Merit Balance</span>
            <h3 className="text-3xl md:text-4xl font-black mt-1">{rewardPoints.toLocaleString()} PTS</h3>
            <span className="text-xs text-amber-100 font-medium">Equivalent to ₦{(rewardPoints * 10).toLocaleString()} in platform credits</span>
          </div>
          <Award size={48} className="text-amber-200/60 hidden sm:block" />
        </div>

        {/* Rewards History */}
        <div className="space-y-3 pt-2">
          <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider">Merit Accrual History</h4>
          {rewardsList.map((r) => (
            <div key={r.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between gap-3 text-xs">
              <div className="space-y-0.5">
                <p className="font-bold text-slate-900">{r.title}</p>
                <span className="text-[10px] text-slate-400 font-mono">{r.date} · {r.badge}</span>
              </div>
              <span className="font-black text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-lg">
                {r.points}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
