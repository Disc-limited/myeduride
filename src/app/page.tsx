'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowRight, Shield, Sparkles } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

import Navbar from '@/components/landing/Navbar';
import HeroSection from '@/components/landing/HeroSection';
import StatsRibbon from '@/components/landing/StatsRibbon';
import FeaturesSection from '@/components/landing/FeaturesSection';
import HowItWorksSection from '@/components/landing/HowItWorksSection';
import RolesSection from '@/components/landing/RolesSection';
import TestimonialsAndPartners from '@/components/landing/TestimonialsAndPartners';
import CtaBanner from '@/components/landing/CtaBanner';
import Footer from '@/components/landing/Footer';
import BookDemoModal from '@/components/landing/BookDemoModal';
import MigoChatModal from '@/components/landing/MigoChatModal';

export default function Home() {
  const [isDemoOpen, setIsDemoOpen] = useState(false);
  const [isMigoOpen, setIsMigoOpen] = useState(false);
  const [sessionUser, setSessionUser] = useState<any>(null);

  useEffect(() => {
    const checkSession = async () => {
      try {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          setSessionUser(session.user);
        }
      } catch (err) {
        console.error('Session check error:', err);
      }
    };
    checkSession();
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 font-poppins selection:bg-brand-green selection:text-white">
      
      {/* Top Banner if user is currently logged in */}
      {sessionUser && (
        <div className="bg-navy-900 text-white px-4 py-2 text-xs font-semibold flex items-center justify-between z-50 relative border-b border-navy-700">
          <div className="flex items-center gap-2 max-w-7xl mx-auto w-full justify-between">
            <span className="flex items-center gap-1.5 text-slate-300">
              <Shield className="w-4 h-4 text-brand-green" />
              <span>Logged in as <strong className="text-white">{sessionUser.email}</strong></span>
            </span>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1 bg-brand-green hover:bg-brand-green-dark px-3 py-1 rounded-lg text-white font-bold transition-all text-xs shadow"
            >
              <span>Go to Dashboard</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      )}

      {/* Main Sticky Header */}
      <Navbar
        onOpenDemo={() => setIsDemoOpen(true)}
        onOpenMigo={() => setIsMigoOpen(true)}
      />

      {/* Landing Page Content Sections */}
      <main>
        {/* 1. Hero Section with Migo Widget Preview */}
        <HeroSection
          onOpenDemo={() => setIsDemoOpen(true)}
          onOpenMigo={() => setIsMigoOpen(true)}
        />

        {/* 2. Key Stats Ribbon */}
        <StatsRibbon />

        {/* 3. Features Section (6 Cards Grid) */}
        <FeaturesSection />

        {/* 4. How MyEduRide Works (4 Steps + Interactive Mobile Tracking Screen) */}
        <HowItWorksSection />

        {/* 5. For Parents, For Schools & Just Ask Migo Role Breakdown */}
        <RolesSection onOpenMigo={() => setIsMigoOpen(true)} />

        {/* 6. Testimonials Carousel & School Partners */}
        <TestimonialsAndPartners />

        {/* 7. Bottom CTA Highlight Banner */}
        <CtaBanner onOpenDemo={() => setIsDemoOpen(true)} />
      </main>

      {/* Footer */}
      <Footer />

      {/* Floating Action Button for Migo AI Assistant featuring 3D Migo Image */}
      <button
        onClick={() => setIsMigoOpen(true)}
        className="fixed bottom-6 right-6 z-40 bg-gradient-to-r from-brand-green to-emerald-600 hover:from-brand-green-dark hover:to-emerald-700 text-white p-3 rounded-full shadow-2xl flex items-center gap-2 border-2 border-white transition-all hover:scale-105 group"
        title="Ask Migo AI Assistant"
      >
        <div className="relative w-9 h-9 bg-white rounded-full p-0.5 shadow flex items-center justify-center">
          <img
            src="/images/landing/migo_robot.png"
            alt="Migo Robot"
            className="w-full h-full object-contain"
          />
          <span className="absolute -top-0.5 -right-0.5 flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-300 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-yellow-400"></span>
          </span>
        </div>
        <span className="hidden sm:inline font-bold text-xs pr-1">Just Ask Migo</span>
        <Sparkles className="w-4 h-4 text-brand-yellow group-hover:rotate-12 transition-transform" />
      </button>

      {/* Interactive Book Demo Modal */}
      <BookDemoModal
        isOpen={isDemoOpen}
        onClose={() => setIsDemoOpen(false)}
      />

      {/* Interactive Migo AI Drawer Widget */}
      <MigoChatModal
        isOpen={isMigoOpen}
        onClose={() => setIsMigoOpen(false)}
      />

    </div>
  );
}
