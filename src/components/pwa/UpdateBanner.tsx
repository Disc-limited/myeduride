'use client';

import { RefreshCw, Sparkles } from 'lucide-react';

interface UpdateBannerProps {
  onUpdate: () => void;
}

export function UpdateBanner({ onUpdate }: UpdateBannerProps) {
  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 bg-slate-900 text-white rounded-2xl p-4 shadow-2xl border border-slate-700 z-[9999] animate-in slide-in-from-bottom duration-300">
      <div className="flex items-start gap-3">
        <div className="p-2.5 bg-sky-500/20 text-sky-400 rounded-xl shrink-0">
          <Sparkles size={22} />
        </div>
        <div className="flex-1">
          <h4 className="font-semibold text-sm text-white">New Version Available!</h4>
          <p className="text-xs text-slate-300 mt-1 leading-relaxed">
            An update to MyEduRide has been installed in the background. Reload to apply improvements.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              onClick={onUpdate}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs rounded-lg transition active:scale-95 shadow"
            >
              <RefreshCw size={14} className="animate-spin-slow" />
              Update Now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
