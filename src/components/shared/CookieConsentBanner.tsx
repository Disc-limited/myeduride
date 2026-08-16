'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Cookie, ShieldCheck, Check, X, ChevronDown, ChevronUp, Lock } from 'lucide-react';
import { toast } from 'sonner';

export default function CookieConsentBanner() {
  const [isVisible, setIsVisible] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  
  // Customizable preferences state
  const [preferences, setPreferences] = useState({
    essential: true, // Always true and locked
    analytics: true,
    safetyLocation: true,
  });

  useEffect(() => {
    // Check if user has already given cookie consent
    const consent = localStorage.getItem('myeduride_cookie_consent');
    if (!consent) {
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, 800); // Smooth 800ms entrance delay
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAcceptAll = () => {
    localStorage.setItem('myeduride_cookie_consent', JSON.stringify({
      status: 'accepted_all',
      timestamp: new Date().toISOString(),
      preferences: { essential: true, analytics: true, safetyLocation: true }
    }));
    setIsVisible(false);
    toast.success('Cookie preferences saved! Thank you for helping us keep student transit safe.');
  };

  const handleAcceptEssential = () => {
    localStorage.setItem('myeduride_cookie_consent', JSON.stringify({
      status: 'essential_only',
      timestamp: new Date().toISOString(),
      preferences: { essential: true, analytics: false, safetyLocation: true }
    }));
    setIsVisible(false);
    toast.info('Essential cookie preferences saved.');
  };

  const handleSaveCustom = () => {
    localStorage.setItem('myeduride_cookie_consent', JSON.stringify({
      status: 'custom',
      timestamp: new Date().toISOString(),
      preferences
    }));
    setIsVisible(false);
    toast.success('Custom cookie settings saved.');
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-6 sm:right-auto sm:max-w-lg z-50 animate-in slide-in-from-bottom duration-500 font-poppins">
      <div className="bg-[#0A1128]/95 backdrop-blur-xl border border-slate-700/80 rounded-3xl p-5 shadow-2xl text-white space-y-4">
        
        {/* Header Row */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0 shadow-inner">
              <Cookie className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h3 className="font-extrabold text-white text-sm sm:text-base tracking-tight flex items-center gap-2">
                We Value Your Privacy & Safety 🍪
              </h3>
              <span className="text-[10px] text-emerald-400 font-mono font-bold uppercase tracking-wider">
                MyEduRide Cookie Notice
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleAcceptEssential}
            className="p-1 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            title="Dismiss & Accept Essential"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Notice Message */}
        <p className="text-xs text-slate-300 leading-relaxed font-medium">
          MyEduRide uses essential cookies and secure local storage to authenticate users, safeguard student transit tracking, and optimize route security. By clicking <strong>"Accept All"</strong>, you consent to our security and performance cookie usage.
        </p>

        {/* Expandable Preferences Section */}
        {showDetails && (
          <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3 text-xs animate-in fade-in duration-300">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="space-y-0.5">
                <span className="font-bold text-white flex items-center gap-1">
                  <Lock className="w-3.5 h-3.5 text-emerald-400" /> Essential & Authentication Cookies
                </span>
                <p className="text-[10px] text-slate-400">Required for secure login, gate verification, and session persistence.</p>
              </div>
              <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-mono font-bold">Always Active</span>
            </div>

            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="space-y-0.5">
                <span className="font-bold text-white flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Safety & Location Encryption
                </span>
                <p className="text-[10px] text-slate-400">Enables live GPS transit tracking and real-time parent alerts.</p>
              </div>
              <input
                type="checkbox"
                checked={preferences.safetyLocation}
                onChange={(e) => setPreferences((prev) => ({ ...prev, safetyLocation: e.target.checked }))}
                className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-emerald-500 focus:ring-emerald-500/30 cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <span className="font-bold text-white">Performance & Analytics</span>
                <p className="text-[10px] text-slate-400">Helps us optimize transit routes and app speed.</p>
              </div>
              <input
                type="checkbox"
                checked={preferences.analytics}
                onChange={(e) => setPreferences((prev) => ({ ...prev, analytics: e.target.checked }))}
                className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-emerald-500 focus:ring-emerald-500/30 cursor-pointer"
              />
            </div>
          </div>
        )}

        {/* Action Buttons Row */}
        <div className="space-y-2.5 pt-1">
          <div className="grid grid-cols-2 sm:grid-cols-2 gap-2 text-xs font-bold">
            <button
              type="button"
              onClick={handleAcceptAll}
              className="py-2.5 px-4 rounded-xl bg-[#00A859] hover:bg-emerald-600 text-white transition-all shadow-lg shadow-emerald-900/40 flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
            >
              <Check className="w-4 h-4" /> Accept All
            </button>

            <button
              type="button"
              onClick={showDetails ? handleSaveCustom : handleAcceptEssential}
              className="py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all text-center cursor-pointer active:scale-95"
            >
              {showDetails ? 'Save Preference' : 'Essential Only'}
            </button>
          </div>

          {/* Footer Links & Preferences Toggle */}
          <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800/80 font-medium">
            <button
              type="button"
              onClick={() => setShowDetails(!showDetails)}
              className="hover:text-emerald-400 transition-colors flex items-center gap-1"
            >
              <span>{showDetails ? 'Hide Preferences' : 'Customize Preferences'}</span>
              {showDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>

            <Link href="/privacy" className="hover:text-emerald-400 underline transition-colors">
              Privacy Policy
            </Link>
          </div>
        </div>

      </div>
    </div>
  );
}
