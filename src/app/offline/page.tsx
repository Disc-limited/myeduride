'use client';

import Link from 'next/link';
import { WifiOff, RefreshCw, Home } from 'lucide-react';

export default function OfflinePage() {
  const handleReload = () => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-100 p-8 text-center animate-in fade-in zoom-in duration-300">
        <div className="w-20 h-20 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-6 text-amber-600 shadow-inner">
          <WifiOff size={40} />
        </div>

        <h1 className="text-2xl font-bold text-slate-900 mb-2">You are Offline</h1>
        <p className="text-slate-600 text-sm mb-6 leading-relaxed">
          It looks like your internet connection is unavailable. MyEduRide requires a network connection for real-time pickup status and gate updates, but your cached screens remain saved.
        </p>

        <div className="space-y-3">
          <button
            onClick={handleReload}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded-xl transition shadow-md hover:shadow-lg active:scale-[0.98]"
          >
            <RefreshCw size={18} />
            Try Reconnecting
          </button>

          <Link
            href="/dashboard"
            className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl transition active:scale-[0.98]"
          >
            <Home size={18} />
            Return to Dashboard
          </Link>
        </div>

        <div className="mt-8 pt-6 border-t border-slate-100 text-xs text-slate-400">
          MyEduRide PWA • Offline Support Active
        </div>
      </div>
    </div>
  );
}
