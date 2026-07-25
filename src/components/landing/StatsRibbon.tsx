'use client';

import { MapPin, Building2, ShieldCheck, Navigation, ThumbsUp } from 'lucide-react';

export default function StatsRibbon() {
  const stats = [
    {
      icon: MapPin,
      number: '10,000+',
      label: 'Students Safely Transported',
      color: 'text-emerald-400',
    },
    {
      icon: Building2,
      number: '200+',
      label: 'Schools Trust MyEduRide',
      color: 'text-brand-yellow',
    },
    {
      icon: ShieldCheck,
      number: '1,500+',
      label: 'Verified Drivers & Escorts',
      color: 'text-emerald-400',
    },
    {
      icon: Navigation,
      number: '50,000+',
      label: 'Safe Journeys Completed',
      color: 'text-blue-400',
    },
    {
      icon: ThumbsUp,
      number: '98%',
      label: 'Parent Satisfaction Rate',
      color: 'text-amber-400',
    },
  ];

  return (
    <section className="relative z-20 -mt-8 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="bg-navy-900 rounded-3xl p-6 sm:p-8 shadow-2xl border border-navy-700 backdrop-blur-lg">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6 sm:gap-8 divide-y md:divide-y-0 md:divide-x divide-navy-700/60">
          {stats.map((stat, idx) => {
            const Icon = stat.icon;
            return (
              <div
                key={idx}
                className={`flex flex-col items-center text-center px-3 ${
                  idx > 0 ? 'pt-4 md:pt-0' : ''
                }`}
              >
                <div className="w-12 h-12 rounded-2xl bg-navy-800 border border-navy-700 flex items-center justify-center mb-3 shadow-inner group hover:scale-110 transition-transform">
                  <Icon className={`w-6 h-6 ${stat.color}`} />
                </div>
                <div className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight font-poppins">
                  {stat.number}
                </div>
                <div className="text-xs font-semibold text-slate-300 mt-1 max-w-[140px] leading-tight">
                  {stat.label}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
