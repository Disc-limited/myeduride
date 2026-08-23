// @ts-nocheck
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { CreditCard, ArrowLeft, CheckCircle2, Zap, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

export default function WalletSubscriptionPage() {
  const [selectedPlan, setSelectedPlan] = useState('enterprise');

  const plans = [
    {
      id: 'basic',
      name: 'Essential Safety',
      price: '₦25,000 / month',
      features: ['Up to 100 Students', 'Basic Gate Check-in Scan', 'Daily Parent SMS Notices', 'Standard Support'],
    },
    {
      id: 'enterprise',
      name: 'Enterprise Safety & Fleet',
      price: '₦50,000 / month',
      popular: true,
      features: [
        'Unlimited Students & Classes',
        'Central Control Pickup List Hub',
        'Live Telemetry Vehicle Tracking',
        'City Manager Approved Escort Access',
        'Multi-Tier Regulatory Audit Ledger',
        'Dedicated Safety Account Executive',
      ],
    },
  ];

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
          <div className="w-12 h-12 rounded-2xl bg-purple-100 text-purple-800 flex items-center justify-center font-black">
            <CreditCard size={22} />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-900">School Platform Subscriptions</h2>
            <p className="text-xs text-slate-500 font-medium">Manage your institution's MyEduRide software tier, active safety modules, and renewal schedules.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {plans.map((p) => (
            <div
              key={p.id}
              onClick={() => setSelectedPlan(p.id)}
              className={`p-6 rounded-3xl border transition-all cursor-pointer space-y-4 relative ${
                selectedPlan === p.id
                  ? 'border-purple-500 bg-purple-50/40 ring-2 ring-purple-500/20 shadow-md'
                  : 'border-slate-200 hover:border-slate-300 bg-white'
              }`}
            >
              {p.popular && (
                <span className="absolute -top-3 right-6 bg-purple-600 text-white text-[10px] font-black px-3 py-0.5 rounded-full uppercase tracking-wider shadow-sm">
                  Active Tier
                </span>
              )}
              <div>
                <h3 className="font-black text-slate-900 text-base">{p.name}</h3>
                <p className="text-xl font-black text-purple-700 mt-1">{p.price}</p>
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-100">
                {p.features.map((f, i) => (
                  <p key={i} className="text-xs text-slate-700 font-medium flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-purple-600 shrink-0" />
                    <span>{f}</span>
                  </p>
                ))}
              </div>

              <button
                type="button"
                onClick={() => toast.success(`Active plan is ${p.name}`)}
                className={`w-full py-2.5 rounded-xl font-black text-xs transition-all cursor-pointer ${
                  selectedPlan === p.id
                    ? 'bg-purple-600 text-white shadow-md'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {selectedPlan === p.id ? 'Current Plan (Active)' : 'Select Plan'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
