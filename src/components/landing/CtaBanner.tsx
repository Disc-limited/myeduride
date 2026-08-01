'use client';

import Link from 'next/link';
import { ArrowRight, Calendar, Shield } from 'lucide-react';

interface CtaBannerProps {
  onOpenDemo: () => void;
}

export default function CtaBanner({ onOpenDemo }: CtaBannerProps) {
  return (
    <section className="py-16 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative rounded-3xl bg-gradient-to-r from-navy-950 via-navy-900 to-navy-800 text-white p-8 sm:p-10 lg:p-12 shadow-2xl overflow-hidden border border-navy-700">
          
          {/* Decorative Background Shield Watermark */}
          <Shield className="absolute -right-10 -bottom-10 w-96 h-96 text-white/5 pointer-events-none" />

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center relative z-10">
            
            {/* Text & CTAs */}
            <div className="lg:col-span-8 space-y-4 text-left">
              <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight font-poppins text-white leading-tight">
                Ready to Experience<br />Smarter Student Transport?
              </h2>

              <p className="text-sm sm:text-base text-slate-300 font-medium max-w-xl">
                Join thousands of parents and schools who choose safety every day.
              </p>

              <div className="flex flex-wrap items-center gap-4 pt-2">
                <Link
                  href="/auth/register"
                  className="inline-flex items-center gap-2.5 px-7 py-3.5 rounded-xl bg-brand-green text-white font-bold text-base hover:bg-brand-green-dark transition-all shadow-lg shadow-brand-green/30 hover:scale-102"
                >
                  <span>Get Started Now</span>
                  <ArrowRight className="w-5 h-5" />
                </Link>

                <button
                  onClick={onOpenDemo}
                  className="inline-flex items-center gap-2.5 px-7 py-3.5 rounded-xl bg-white text-navy-900 font-bold text-base hover:bg-slate-100 transition-all shadow-md hover:scale-102"
                >
                  <span>Book a Demo</span>
                  <Calendar className="w-5 h-5 text-navy-900" />
                </button>
              </div>
            </div>

            {/* Custom Generated African Female Student Profile Photo */}
            <div className="lg:col-span-4 flex justify-center lg:justify-end">
              <div className="relative w-44 h-44 sm:w-52 sm:h-52 rounded-full overflow-hidden border-4 border-emerald-400/40 shadow-2xl bg-slate-800 group">
                <img
                  src="/images/landing/cta_student_profile.png"
                  alt="MyEduRide African Female Student Profile"
                  className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-navy-950/40 to-transparent pointer-events-none" />
              </div>
            </div>

          </div>

        </div>
      </div>
    </section>
  );
}
