'use client';

import { MapPin, ShieldCheck, BellRing, Wallet, MessageSquare, Gift } from 'lucide-react';

export default function FeaturesSection() {
  const features = [
    {
      icon: MapPin,
      title: 'Real-time Tracking',
      description: "Track your child's ride in real-time from pickup to drop-off.",
      badgeColor: 'bg-emerald-50 text-emerald-600 border-emerald-200',
      iconColor: 'text-brand-green',
    },
    {
      icon: ShieldCheck,
      title: 'Verified & Trusted',
      description: 'All drivers and escorts are verified, trained and background checked.',
      badgeColor: 'bg-blue-50 text-blue-600 border-blue-200',
      iconColor: 'text-blue-600',
    },
    {
      icon: BellRing,
      title: 'Smart Notifications',
      description: 'Get instant alerts for pickups, drop-offs and important updates.',
      badgeColor: 'bg-amber-50 text-amber-600 border-amber-200',
      iconColor: 'text-amber-500',
    },
    {
      icon: Wallet,
      title: 'Cashless Payments',
      description: 'Secure wallet, easy payments and transparent transaction history.',
      badgeColor: 'bg-emerald-50 text-emerald-600 border-emerald-200',
      iconColor: 'text-emerald-600',
    },
    {
      icon: MessageSquare,
      title: 'EduChat',
      description: 'Communicate with schools, teachers and transport staff easily.',
      badgeColor: 'bg-sky-50 text-sky-600 border-sky-200',
      iconColor: 'text-sky-500',
    },
    {
      icon: Gift,
      title: 'Rewards & Benefits',
      description: 'Earn rewards, enjoy discounts and exclusive special offers.',
      badgeColor: 'bg-amber-50 text-amber-600 border-amber-200',
      iconColor: 'text-brand-yellow-dark',
    },
  ];

  return (
    <section id="features" className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        
        {/* Section Header */}
        <div className="max-w-3xl mx-auto space-y-3 mb-16">
          <span className="text-xs font-extrabold uppercase tracking-widest text-brand-green bg-emerald-50 px-3.5 py-1.5 rounded-full border border-emerald-100">
            Platform Capabilities
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-navy-900 tracking-tight font-poppins">
            Everything You Need in One Platform
          </h2>
          <p className="text-base text-slate-600 font-medium">
            Designed specifically for school transportation safety, parent peace of mind, and streamlined school administration.
          </p>
        </div>

        {/* 6 Features Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <div
                key={index}
                className="group relative bg-slate-50/80 hover:bg-white rounded-3xl p-8 border border-slate-200/80 hover:border-emerald-200 shadow-sm hover:shadow-xl transition-all duration-300 text-left flex flex-col justify-between"
              >
                <div>
                  <div className={`w-14 h-14 rounded-2xl ${feature.badgeColor} border flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}>
                    <Icon className={`w-7 h-7 ${feature.iconColor}`} />
                  </div>

                  <h3 className="text-xl font-bold text-navy-900 font-poppins mb-2 group-hover:text-brand-green transition-colors">
                    {feature.title}
                  </h3>

                  <p className="text-sm text-slate-600 leading-relaxed font-medium">
                    {feature.description}
                  </p>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-200/60 flex items-center text-xs font-bold text-brand-green group-hover:translate-x-1 transition-transform">
                  <span>Learn more</span>
                  <span className="ml-1">→</span>
                </div>
              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
}
