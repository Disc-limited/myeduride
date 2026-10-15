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
    <div className="mx-auto max-w-4xl space-y-6 p-4 font-sans text-slate-800 md:p-6">
      <Link
        href="/dashboard/school-admin/wallet"
        className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-900"
      >
        <ArrowLeft size={14} /> Back to Wallet Overview
      </Link>

      <div className="shadow-xs space-y-6 rounded-3xl border border-slate-200 bg-white p-6 md:p-8">
        <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 font-black text-amber-800">
            <Gift size={22} />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-900">Safety Reward Wallet & Incentives</h2>
            <p className="text-xs font-medium text-slate-500">
              Earn safety merit points, reward top-performing school escorts and drivers, and unlock
              platform fee discounts.
            </p>
          </div>
        </div>

        {/* Reward Points Banner */}
        <div className="flex items-center justify-between rounded-3xl bg-gradient-to-r from-amber-500 to-orange-600 p-6 text-white shadow-lg">
          <div>
            <span className="text-xs font-black uppercase tracking-wider text-amber-100">
              Accumulated Safety Merit Balance
            </span>
            <h3 className="mt-1 text-3xl font-black md:text-4xl">
              {rewardPoints.toLocaleString()} PTS
            </h3>
            <span className="text-xs font-medium text-amber-100">
              Equivalent to ₦{(rewardPoints * 10).toLocaleString()} in platform credits
            </span>
          </div>
          <Award size={48} className="hidden text-amber-200/60 sm:block" />
        </div>

        {/* Rewards History */}
        <div className="space-y-3 pt-2">
          <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">
            Merit Accrual History
          </h4>
          {rewardsList.map((r) => (
            <div
              key={r.id}
              className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-4 text-xs"
            >
              <div className="space-y-0.5">
                <p className="font-bold text-slate-900">{r.title}</p>
                <span className="font-mono text-[10px] text-slate-400">
                  {r.date} · {r.badge}
                </span>
              </div>
              <span className="rounded-lg bg-emerald-100 px-2.5 py-1 font-black text-emerald-700">
                {r.points}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
