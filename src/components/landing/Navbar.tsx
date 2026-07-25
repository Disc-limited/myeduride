'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronDown, Menu, X, Shield, Sparkles } from 'lucide-react';

interface NavbarProps {
  onOpenDemo: () => void;
  onOpenMigo: () => void;
}

export default function Navbar({ onOpenDemo, onOpenMigo }: NavbarProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);

  const toggleDropdown = (name: string) => {
    setActiveDropdown(activeDropdown === name ? null : name);
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-100 shadow-sm transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          
          {/* Brand Logo */}
          <Link href="/" className="flex items-center group">
            <img
              src="/images/eduride_logo.png"
              alt="MyEduRide Logo"
              className="h-11 sm:h-14 w-auto object-contain group-hover:scale-105 transition-transform"
            />
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden lg:flex items-center gap-7">
            <Link href="#home" className="text-sm font-semibold text-brand-green hover:text-brand-green-dark transition-colors">
              Home
            </Link>
            <Link href="#about" className="text-sm font-medium text-slate-700 hover:text-navy-900 transition-colors">
              About Us
            </Link>

            {/* Features Dropdown */}
            <div className="relative">
              <button
                onClick={() => toggleDropdown('features')}
                className="flex items-center gap-1 text-sm font-medium text-slate-700 hover:text-navy-900 transition-colors py-2"
              >
                <span>Features</span>
                <ChevronDown className={`w-4 h-4 transition-transform ${activeDropdown === 'features' ? 'rotate-180 text-brand-green' : 'text-slate-400'}`} />
              </button>
              {activeDropdown === 'features' && (
                <div className="absolute top-full left-0 w-64 mt-2 bg-white rounded-2xl shadow-xl border border-slate-100 py-3 px-2 z-50 animate-in fade-in slide-in-from-top-2">
                  <Link href="#features" onClick={() => setActiveDropdown(null)} className="block px-3 py-2 rounded-xl text-xs font-semibold text-slate-800 hover:bg-slate-50">
                    Real-time Tracking
                  </Link>
                  <Link href="#features" onClick={() => setActiveDropdown(null)} className="block px-3 py-2 rounded-xl text-xs font-semibold text-slate-800 hover:bg-slate-50">
                    Verified Drivers & Escorts
                  </Link>
                  <Link href="#features" onClick={() => setActiveDropdown(null)} className="block px-3 py-2 rounded-xl text-xs font-semibold text-slate-800 hover:bg-slate-50">
                    Smart Notifications & EduChat
                  </Link>
                  <Link href="#features" onClick={() => setActiveDropdown(null)} className="block px-3 py-2 rounded-xl text-xs font-semibold text-slate-800 hover:bg-slate-50">
                    Cashless Wallet Payments
                  </Link>
                </div>
              )}
            </div>

            {/* Solutions Dropdown */}
            <div className="relative">
              <button
                onClick={() => toggleDropdown('solutions')}
                className="flex items-center gap-1 text-sm font-medium text-slate-700 hover:text-navy-900 transition-colors py-2"
              >
                <span>Solutions</span>
                <ChevronDown className={`w-4 h-4 transition-transform ${activeDropdown === 'solutions' ? 'rotate-180 text-brand-green' : 'text-slate-400'}`} />
              </button>
              {activeDropdown === 'solutions' && (
                <div className="absolute top-full left-0 w-56 mt-2 bg-white rounded-2xl shadow-xl border border-slate-100 py-3 px-2 z-50 animate-in fade-in slide-in-from-top-2">
                  <Link href="#roles" onClick={() => setActiveDropdown(null)} className="block px-3 py-2 rounded-xl text-xs font-semibold text-slate-800 hover:bg-slate-50">
                    For Parents
                  </Link>
                  <Link href="#roles" onClick={() => setActiveDropdown(null)} className="block px-3 py-2 rounded-xl text-xs font-semibold text-slate-800 hover:bg-slate-50">
                    For Schools
                  </Link>
                  <Link href="#roles" onClick={() => setActiveDropdown(null)} className="block px-3 py-2 rounded-xl text-xs font-semibold text-slate-800 hover:bg-slate-50">
                    For Drivers & Fleet Owners
                  </Link>
                </div>
              )}
            </div>

            <Link href="#pricing" className="text-sm font-medium text-slate-700 hover:text-navy-900 transition-colors">
              Pricing
            </Link>

            {/* Resources Dropdown */}
            <div className="relative">
              <button
                onClick={() => toggleDropdown('resources')}
                className="flex items-center gap-1 text-sm font-medium text-slate-700 hover:text-navy-900 transition-colors py-2"
              >
                <span>Resources</span>
                <ChevronDown className={`w-4 h-4 transition-transform ${activeDropdown === 'resources' ? 'rotate-180 text-brand-green' : 'text-slate-400'}`} />
              </button>
              {activeDropdown === 'resources' && (
                <div className="absolute top-full left-0 w-52 mt-2 bg-white rounded-2xl shadow-xl border border-slate-100 py-3 px-2 z-50 animate-in fade-in slide-in-from-top-2">
                  <Link href="#footer" onClick={() => setActiveDropdown(null)} className="block px-3 py-2 rounded-xl text-xs font-semibold text-slate-800 hover:bg-slate-50">
                    Help Center & FAQs
                  </Link>
                  <button onClick={() => { setActiveDropdown(null); onOpenMigo(); }} className="w-full text-left flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold text-brand-green hover:bg-emerald-50">
                    <span>Ask Migo AI</span>
                    <Sparkles className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>

            <Link href="#contact" className="text-sm font-medium text-slate-700 hover:text-navy-900 transition-colors">
              Contact
            </Link>
          </nav>

          {/* Desktop Right CTA Actions */}
          <div className="hidden lg:flex items-center gap-3">
            <Link
              href="/auth/login"
              className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-semibold text-sm hover:bg-slate-50 hover:border-slate-300 transition-all"
            >
              Login
            </Link>
            <Link
              href="/auth/register-school"
              className="px-6 py-2.5 rounded-xl bg-brand-green text-white font-semibold text-sm hover:bg-brand-green-dark transition-all shadow-md shadow-brand-green/25 active:scale-95"
            >
              Get Started
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <div className="flex lg:hidden items-center gap-2">
            <button
              onClick={onOpenMigo}
              className="p-2 rounded-xl bg-emerald-50 text-brand-green font-semibold text-xs flex items-center gap-1 border border-emerald-100"
            >
              <Sparkles className="w-4 h-4" />
              <span>Migo</span>
            </button>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-xl text-slate-700 hover:bg-slate-100 focus:outline-none"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>

        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-white border-b border-slate-200 px-4 pt-3 pb-6 space-y-3 animate-in fade-in slide-in-from-top-4">
          <Link
            href="#home"
            onClick={() => setMobileMenuOpen(false)}
            className="block py-2 text-base font-semibold text-brand-green"
          >
            Home
          </Link>
          <Link
            href="#features"
            onClick={() => setMobileMenuOpen(false)}
            className="block py-2 text-base font-medium text-slate-700 border-t border-slate-100"
          >
            Features
          </Link>
          <Link
            href="#how-it-works"
            onClick={() => setMobileMenuOpen(false)}
            className="block py-2 text-base font-medium text-slate-700 border-t border-slate-100"
          >
            How It Works
          </Link>
          <Link
            href="#roles"
            onClick={() => setMobileMenuOpen(false)}
            className="block py-2 text-base font-medium text-slate-700 border-t border-slate-100"
          >
            Parents & Schools
          </Link>
          <div className="pt-4 flex flex-col gap-2.5">
            <Link
              href="/auth/login"
              className="w-full text-center py-3 rounded-xl border border-slate-200 text-slate-800 font-semibold"
            >
              Login
            </Link>
            <Link
              href="/auth/register-school"
              className="w-full text-center py-3 rounded-xl bg-brand-green text-white font-semibold shadow-md"
            >
              Get Started Now
            </Link>
            <button
              onClick={() => { setMobileMenuOpen(false); onOpenDemo(); }}
              className="w-full py-3 rounded-xl bg-navy-900 text-white font-semibold"
            >
              Book a Demo
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
