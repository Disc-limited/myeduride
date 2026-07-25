'use client';

import { UserPlus, Bus, MapPin, ShieldCheck } from 'lucide-react';

export default function HowItWorksSection() {
  const steps = [
    {
      number: 1,
      icon: UserPlus,
      title: 'Sign Up',
      description: 'Create your account in minutes.',
      bgColor: 'bg-emerald-500 text-white',
    },
    {
      number: 2,
      icon: Bus,
      title: 'Book or Join a Ride',
      description: 'Choose a ride option that suits you.',
      bgColor: 'bg-navy-900 text-white',
    },
    {
      number: 3,
      icon: MapPin,
      title: 'Track in Real-time',
      description: "Track your child's journey live on the map across cities in Nigeria.",
      bgColor: 'bg-brand-yellow-dark text-white',
    },
    {
      number: 4,
      icon: ShieldCheck,
      title: 'Safe Arrival',
      description: 'Get notified when your child arrives safely at school.',
      bgColor: 'bg-emerald-600 text-white',
    },
  ];

  return (
    <section id="how-it-works" className="py-20 bg-slate-50 relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto space-y-3 mb-16">
          <span className="text-xs font-extrabold uppercase tracking-widest text-brand-green bg-emerald-50 px-3.5 py-1.5 rounded-full border border-emerald-100">
            Real-Time Transport Intelligence
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-navy-900 tracking-tight font-poppins">
            How MyEduRide Works
          </h2>
          <p className="text-base text-slate-600 font-medium">
            Live route tracking across cities in Nigeria with automated gate verification.
          </p>
        </div>

        {/* Workflow & Lagos GPS Map Display Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          
          {/* 4 Steps Column */}
          <div className="lg:col-span-6 grid grid-cols-1 sm:grid-cols-2 gap-6">
            {steps.map((step) => {
              const Icon = step.icon;
              return (
                <div
                  key={step.number}
                  className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm hover:shadow-lg transition-all duration-300 group flex items-start gap-4"
                >
                  <div className={`w-12 h-12 rounded-2xl ${step.bgColor} flex items-center justify-center font-bold text-lg shadow-md flex-shrink-0 group-hover:scale-105 transition-transform`}>
                    <Icon className="w-6 h-6" />
                  </div>

                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="w-6 h-6 rounded-full bg-slate-100 border border-slate-300 text-navy-900 font-extrabold text-xs flex items-center justify-center">
                        {step.number}
                      </span>
                      <h3 className="text-lg font-bold text-navy-900 font-poppins">
                        {step.title}
                      </h3>
                    </div>
                    <p className="text-xs text-slate-600 font-medium leading-relaxed">
                      {step.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Real-time Lagos GPS Tracking Smartphone Interface */}
          <div className="lg:col-span-6 flex justify-center">
            <div className="relative w-full max-w-[340px] rounded-[40px] overflow-hidden shadow-2xl border-4 border-white bg-slate-900 hover:scale-102 transition-transform duration-300">
              <img
                src="/images/landing/gps_tracking_map.png"
                alt="MyEduRide Live GPS Tracking Map Ikeja to Surulere Lagos"
                className="w-full h-auto object-cover rounded-[34px]"
              />
            </div>
          </div>

        </div>

      </div>
    </section>
  );
}
