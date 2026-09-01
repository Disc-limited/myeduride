'use client';

import { useState } from 'react';
import {
  MapPinOff,
  Navigation,
  Smartphone,
  CheckCircle2,
  X,
  RefreshCw,
  HelpCircle,
  ExternalLink,
  ShieldAlert,
  Compass
} from 'lucide-react';

interface LocationPermissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRetry?: () => void;
  onEnableManualMode?: () => void;
}

export default function LocationPermissionModal({
  isOpen,
  onClose,
  onRetry,
  onEnableManualMode,
}: LocationPermissionModalProps) {
  const [activeTab, setActiveTab] = useState<'ios' | 'android'>('ios');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-200 font-sans">
      <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl border border-slate-200 overflow-hidden text-slate-800 text-xs">
        
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-amber-50/60">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-md shadow-amber-500/20 shrink-0">
              <MapPinOff className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 text-sm md:text-base">
                Enable Location for Live Tracking
              </h3>
              <p className="text-[11px] text-slate-500 font-medium">
                Live GPS broadcasting requires browser location permission
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-500 flex items-center justify-center cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Switcher: iOS Safari vs Android Chrome */}
        <div className="p-4 sm:p-5 space-y-4">
          <div className="flex bg-slate-100 p-1 rounded-2xl">
            <button
              type="button"
              onClick={() => setActiveTab('ios')}
              className={`flex-1 py-2 rounded-xl font-extrabold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'ios'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Smartphone className="w-4 h-4 text-slate-700" />
              <span>iPhone / Safari Guide</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('android')}
              className={`flex-1 py-2 rounded-xl font-extrabold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'android'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Navigation className="w-4 h-4 text-slate-700" />
              <span>Android / Chrome Guide</span>
            </button>
          </div>

          {/* iOS Safari Instructions */}
          {activeTab === 'ios' && (
            <div className="space-y-3 bg-slate-50 rounded-2xl p-4 border border-slate-200/80">
              <div className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-emerald-600 text-white font-black text-xs flex items-center justify-center shrink-0">
                  1
                </span>
                <p className="text-slate-700 leading-relaxed">
                  Tap the <strong className="text-slate-900 bg-white px-1.5 py-0.5 rounded border border-slate-200">aA</strong> icon on the left side of the Safari address bar.
                </p>
              </div>

              <div className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-emerald-600 text-white font-black text-xs flex items-center justify-center shrink-0">
                  2
                </span>
                <p className="text-slate-700 leading-relaxed">
                  Tap <strong className="text-slate-900 bg-white px-1.5 py-0.5 rounded border border-slate-200">Website Settings</strong>.
                </p>
              </div>

              <div className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-emerald-600 text-white font-black text-xs flex items-center justify-center shrink-0">
                  3
                </span>
                <p className="text-slate-700 leading-relaxed">
                  Under <strong>Location</strong>, change the setting to <strong className="text-emerald-700 font-bold">Allow</strong>.
                </p>
              </div>

              <div className="pt-2 border-t border-slate-200 text-[10px] text-slate-500">
                💡 If still blocked: Open <strong>iPhone Settings</strong> → <strong>Privacy & Security</strong> → <strong>Location Services</strong> → <strong>Safari Websites</strong> → Select <em>While Using the App</em>.
              </div>
            </div>
          )}

          {/* Android Chrome Instructions */}
          {activeTab === 'android' && (
            <div className="space-y-3 bg-slate-50 rounded-2xl p-4 border border-slate-200/80">
              <div className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-emerald-600 text-white font-black text-xs flex items-center justify-center shrink-0">
                  1
                </span>
                <p className="text-slate-700 leading-relaxed">
                  Tap the <strong className="text-slate-900 bg-white px-1.5 py-0.5 rounded border border-slate-200">Lock / Tune</strong> icon on the left of the Chrome address bar.
                </p>
              </div>

              <div className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-emerald-600 text-white font-black text-xs flex items-center justify-center shrink-0">
                  2
                </span>
                <p className="text-slate-700 leading-relaxed">
                  Tap <strong className="text-slate-900 bg-white px-1.5 py-0.5 rounded border border-slate-200">Permissions</strong> or <strong>Site Settings</strong>.
                </p>
              </div>

              <div className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-emerald-600 text-white font-black text-xs flex items-center justify-center shrink-0">
                  3
                </span>
                <p className="text-slate-700 leading-relaxed">
                  Toggle <strong className="text-emerald-700 font-bold">Location</strong> to <strong className="text-emerald-700 font-bold">Allow</strong> and refresh.
                </p>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
            <button
              type="button"
              onClick={() => {
                onRetry?.();
                onClose();
              }}
              className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs flex items-center justify-center gap-2 transition-all shadow-md shadow-emerald-600/20 cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Retry GPS Connection</span>
            </button>

            <button
              type="button"
              onClick={() => {
                onEnableManualMode?.();
                onClose();
              }}
              className="w-full py-3 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <Compass className="w-4 h-4 text-slate-500" />
              <span>Continue in Manual Mode</span>
            </button>
          </div>
        </div>

        {/* Modal Footer Note */}
        <div className="p-3 bg-slate-50 border-t border-slate-100 text-[11px] text-slate-500 text-center">
          Manual mode allows you to check off stops and scan students even if GPS is turned off.
        </div>

      </div>
    </div>
  );
}
