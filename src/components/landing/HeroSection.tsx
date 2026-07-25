'use client';

import Link from 'next/link';
import { ArrowRight, Calendar, Sparkles, ShieldCheck } from 'lucide-react';
import AppStoreBadges from '@/components/landing/AppStoreBadges';

interface HeroSectionProps {
  onOpenDemo: () => void;
  onOpenMigo: () => void;
}

export default function HeroSection({ onOpenDemo, onOpenMigo }: HeroSectionProps) {
  return (
    <section id="home" className="relative overflow-hidden bg-gradient-to-b from-white via-slate-50/60 to-slate-100/80 pt-8 pb-16 lg:pt-12 lg:pb-20">
      
      {/* Background Decorative Blur Orbs */}
      <div className="absolute top-10 left-1/4 w-96 h-96 bg-brand-green/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-40 right-10 w-80 h-80 bg-brand-yellow/15 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          
          {/* Left Hero Text Content */}
          <div className="lg:col-span-6 space-y-6 text-left">
            
            {/* Top Pill Tag */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-brand-green text-xs font-semibold tracking-wide">
              <ShieldCheck className="w-4 h-4 text-brand-green" />
              <span>The Student Safety Platform</span>
            </div>

            {/* Main Headline */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-navy-900 tracking-tight leading-[1.12] font-poppins">
              Safe Journeys.<br />
              <span className="text-brand-green">Happy Families.</span><br />
              Smarter Schools.
            </h1>

            {/* Subheadline Description */}
            <p className="text-base sm:text-lg text-slate-600 font-medium max-w-xl leading-relaxed">
              MyEduRide connects parents, schools, drivers and communities to ensure every child travels safely to and from school.
            </p>

            {/* Primary Action Buttons */}
            <div className="flex flex-wrap items-center gap-4 pt-1">
              <Link
                href="/auth/register-school"
                className="inline-flex items-center gap-2.5 px-7 py-3.5 rounded-xl bg-brand-green text-white font-bold text-base hover:bg-brand-green-dark transition-all shadow-lg shadow-brand-green/30 hover:-translate-y-0.5 active:translate-y-0"
              >
                <span>Get Started Now</span>
                <ArrowRight className="w-5 h-5" />
              </Link>

              <button
                onClick={onOpenDemo}
                className="inline-flex items-center gap-2.5 px-7 py-3.5 rounded-xl bg-white border border-slate-300 text-navy-900 font-bold text-base hover:bg-slate-50 hover:border-slate-400 transition-all shadow-sm hover:-translate-y-0.5 active:translate-y-0"
              >
                <span>Book a Demo</span>
                <Calendar className="w-5 h-5 text-navy-900" />
              </button>
            </div>

            {/* Official App Store Download Badges */}
            <div className="pt-3 border-t border-slate-200/80 max-w-md">
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2.5">
                Download the App
              </p>
              <AppStoreBadges size="md" />
            </div>

          </div>

          {/* Right Hero Image Section featuring Custom Recreated Photo & Migo 3D Widget */}
          <div className="lg:col-span-6 relative flex justify-center items-center">
            
            <div className="relative w-full rounded-3xl overflow-hidden shadow-2xl border-4 border-white bg-slate-100 group">
              
              {/* Custom Recreated High-Res Hero Photo */}
              <img
                src="/images/landing/hero_main.png"
                alt="MyEduRide School Shuttle Van & Family"
                className="w-full h-auto object-cover group-hover:scale-102 transition-transform duration-500"
              />

              {/* Interactive Floating Migo AI Widget Overlay with Replicated 3D Migo Image */}
              <div className="absolute bottom-4 right-4 sm:bottom-6 sm:right-6 w-64 bg-white/95 backdrop-blur-md rounded-2xl p-3.5 shadow-2xl border border-slate-200/90 z-20 hover:scale-105 transition-transform duration-300">
                <div className="flex items-center gap-3">
                  <img
                    src="/images/landing/migo_robot.png"
                    alt="Migo AI Avatar"
                    className="w-11 h-11 rounded-full object-contain bg-emerald-50 border-2 border-emerald-400 shadow-md flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-extrabold text-navy-900">Hi, I'm Migo 🖐️</div>
                    <div className="text-[9px] font-semibold text-brand-green">Powered by Savi Intelligence</div>
                    <p className="text-[10px] text-slate-600 font-medium leading-tight mt-0.5">
                      Your smart assistant for all things MyEduRide
                    </p>
                  </div>
                </div>

                <button
                  onClick={onOpenMigo}
                  className="mt-2.5 w-full py-1.5 px-3 rounded-xl bg-white border border-emerald-300 text-brand-green hover:bg-emerald-50 font-bold text-[11px] flex items-center justify-center gap-1.5 transition-colors shadow-sm"
                >
                  <span>Just Ask Migo</span>
                  <Sparkles className="w-3.5 h-3.5 text-brand-green" />
                </button>
              </div>

            </div>

          </div>

        </div>
      </div>
    </section>
  );
}
