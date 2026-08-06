'use client';

import Link from 'next/link';
import { Hammer, ArrowLeft, Clock, AlertTriangle } from 'lucide-react';

interface UnderDevelopmentProps {
  title?: string;
  message?: string;
  onBack?: () => void;
  backText?: string;
}

export default function UnderDevelopment({
  title = 'This Page',
  message = 'OOps!! this page is undergoing development',
  onBack,
  backText = 'Return to Dashboard',
}: UnderDevelopmentProps) {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center">
      <div className="w-full max-w-md bg-white rounded-2xl p-8 border border-slate-200 shadow-xl relative overflow-hidden">
        {/* Background glow */}
        <div className="absolute -top-12 -right-12 w-32 h-32 bg-emerald-100 rounded-full blur-2xl opacity-60 pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 w-32 h-32 bg-amber-100 rounded-full blur-2xl opacity-60 pointer-events-none" />

        <div className="relative z-10 flex flex-col items-center">
          <div className="w-20 h-20 bg-gradient-to-tr from-amber-500 to-amber-400 rounded-2xl flex items-center justify-center text-white mb-6 shadow-lg shadow-amber-500/20 transform -rotate-3 hover:rotate-0 transition-transform">
            <Hammer size={38} className="animate-bounce" />
          </div>

          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 mb-3">
            <Clock size={12} className="animate-spin text-amber-600" />
            Under Active Development
          </span>

          <h2 className="text-xl font-extrabold text-slate-900 mb-2">
            {title}
          </h2>

          <div className="bg-amber-50/90 border border-amber-200 rounded-xl p-4 my-4 text-amber-900 text-sm font-medium leading-relaxed w-full">
            <p className="font-extrabold text-base text-amber-800 flex items-center justify-center gap-2 mb-1">
              <AlertTriangle size={18} className="text-amber-600 shrink-0" />
              {message}
            </p>
            <p className="text-xs text-amber-700 font-normal">
              Our engineering team is actively building this module to ensure safety and performance.
            </p>
          </div>

          <p className="text-xs text-slate-400 mb-6">
            Please check back soon for live updates and feature releases.
          </p>

          {onBack ? (
            <button
              onClick={onBack}
              className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 transition-all shadow-md active:scale-[0.98]"
            >
              <ArrowLeft size={16} />
              {backText}
            </button>
          ) : (
            <Link
              href="/dashboard/gate"
              className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 transition-all shadow-md active:scale-[0.98]"
            >
              <ArrowLeft size={16} />
              {backText}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
