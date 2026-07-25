'use client';

import { CheckCircle2, Users, Building, Sparkles } from 'lucide-react';

interface RolesSectionProps {
  onOpenMigo: () => void;
}

export default function RolesSection({ onOpenMigo }: RolesSectionProps) {
  const parentChecklist = [
    'Peace of mind, always',
    'Real-time journey updates',
    'Easy communication',
    'Secure & cashless',
    'One app for all your children',
  ];

  const schoolChecklist = [
    'Digital attendance',
    'Transport management',
    'Better parent engagement',
    'Data-driven insights',
    'Improved student safety',
  ];

  return (
    <section id="roles" className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* 3-Column Split Layout matching UI Design */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          
          {/* For Parents Card */}
          <div className="lg:col-span-4 bg-slate-50/80 rounded-3xl p-8 border border-slate-200 shadow-sm flex flex-col justify-between hover:border-emerald-300 transition-all">
            <div>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-navy-900 text-white flex items-center justify-center shadow-md">
                  <Users className="w-5 h-5 text-brand-green" />
                </div>
                <h3 className="text-2xl font-extrabold text-navy-900 font-poppins">For Parents</h3>
              </div>

              {/* African Parent Portrait */}
              <div className="relative rounded-2xl overflow-hidden mb-6 h-52 shadow-md bg-slate-100 flex items-center justify-center">
                <img
                  src="/images/landing/parent_portrait.png"
                  alt="MyEduRide Parent"
                  className="w-full h-full object-cover object-top hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-navy-950/30 to-transparent pointer-events-none" />
              </div>

              {/* Checklists */}
              <ul className="space-y-3">
                {parentChecklist.map((item, i) => (
                  <li key={i} className="flex items-center gap-2.5 text-sm font-semibold text-slate-700">
                    <CheckCircle2 className="w-5 h-5 text-brand-green flex-shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Center Migo AI Spotlight Card featuring Replicated 3D Migo Robot Image */}
          <div className="lg:col-span-4 bg-slate-50/80 rounded-3xl p-8 border border-slate-200 shadow-sm text-center flex flex-col justify-between items-center relative overflow-hidden group hover:border-emerald-300 transition-all">
            
            <div className="space-y-4 pt-2">
              {/* Replicated 3D Migo Robot Mascot Image */}
              <div className="w-32 h-32 mx-auto rounded-3xl bg-emerald-50/80 p-2 shadow-md flex items-center justify-center border border-emerald-100 group-hover:scale-105 transition-transform">
                <img
                  src="/images/landing/migo_robot.png"
                  alt="Migo 3D Robot Mascot"
                  className="w-full h-full object-contain"
                />
              </div>

              <h3 className="text-2xl font-extrabold font-poppins text-navy-900">
                Just Ask Migo
              </h3>

              <p className="text-xs text-slate-600 font-semibold leading-relaxed max-w-xs mx-auto">
                Your intelligent assistant for a safer school journey.
              </p>
            </div>

            <div className="w-full pt-6">
              <button
                onClick={onOpenMigo}
                className="w-full py-3 rounded-2xl bg-white border border-slate-300 hover:border-emerald-400 text-navy-900 font-bold text-sm shadow-sm flex items-center justify-center gap-2 transition-all hover:bg-emerald-50 hover:text-brand-green"
              >
                <span>Just Ask Migo</span>
                <Sparkles className="w-4 h-4 text-brand-green" />
              </button>
            </div>

          </div>

          {/* For Schools Card */}
          <div className="lg:col-span-4 bg-slate-50/80 rounded-3xl p-8 border border-slate-200 shadow-sm flex flex-col justify-between hover:border-emerald-300 transition-all">
            <div>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-navy-900 text-white flex items-center justify-center shadow-md">
                  <Building className="w-5 h-5 text-brand-yellow" />
                </div>
                <h3 className="text-2xl font-extrabold text-navy-900 font-poppins">For Schools</h3>
              </div>

              {/* African Students Assembly Ground Photo */}
              <div className="relative rounded-2xl overflow-hidden mb-6 h-52 shadow-md bg-slate-100 flex items-center justify-center">
                <img
                  src="/images/landing/school_assembly.png"
                  alt="MyEduRide School Assembly Ground Students"
                  className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-navy-950/30 to-transparent pointer-events-none" />
              </div>

              {/* Checklists */}
              <ul className="space-y-3">
                {schoolChecklist.map((item, i) => (
                  <li key={i} className="flex items-center gap-2.5 text-sm font-semibold text-slate-700">
                    <CheckCircle2 className="w-5 h-5 text-brand-green flex-shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

        </div>

      </div>
    </section>
  );
}
