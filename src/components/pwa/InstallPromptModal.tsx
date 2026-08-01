'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { Download, Share, PlusSquare, X, CheckCircle2, Smartphone } from 'lucide-react';

export function InstallPromptModal() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isIos, setIsIos] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    // Check if already in standalone app mode
    const inStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;

    if (inStandalone) {
      setIsStandalone(true);
      return;
    }

    // Check if user previously dismissed prompt in this session
    const dismissed = sessionStorage.getItem('myeduride_pwa_prompt_dismissed');
    if (dismissed) return;

    // Detect iOS Safari
    const ua = window.navigator.userAgent;
    const iosDevice = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
    setIsIos(iosDevice);

    if (iosDevice) {
      // Show prompt for iOS after short delay
      const timer = setTimeout(() => setShowModal(true), 3000);
      return () => clearTimeout(timer);
    }

    // Listen for beforeinstallprompt on Android / Chrome
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setTimeout(() => setShowModal(true), 3000);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShowModal(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowModal(false);
    sessionStorage.setItem('myeduride_pwa_prompt_dismissed', 'true');
  };

  if (isStandalone || !showModal) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-300">
      <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-100 p-6 relative overflow-hidden animate-in slide-in-from-bottom duration-300">
        
        {/* Close Button */}
        <button
          onClick={handleDismiss}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1.5 rounded-full hover:bg-slate-100 transition"
          aria-label="Close"
        >
          <X size={20} />
        </button>

        {/* Header */}
        <div className="flex items-center gap-4 mb-4">
          <div className="relative w-14 h-14 bg-sky-50 rounded-2xl p-2 border border-sky-100 flex items-center justify-center shrink-0 shadow-sm">
            <Image
              src="/images/eduride_logo.png"
              alt="MyEduRide Logo"
              width={48}
              height={48}
              className="object-contain"
            />
          </div>
          <div>
            <h3 className="font-bold text-lg text-slate-900 leading-snug">Install MyEduRide App</h3>
            <p className="text-xs text-sky-600 font-medium">Fast • Offline Ready • Direct Alerts</p>
          </div>
        </div>

        <p className="text-slate-600 text-sm mb-5 leading-relaxed">
          Install MyEduRide to your phone home screen for quick access, real-time pickup updates, and push notifications.
        </p>

        {/* Feature Highlights */}
        <div className="space-y-2 mb-6 bg-slate-50 p-3.5 rounded-xl text-xs text-slate-700 font-medium">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
            <span>Instant launch from Home Screen</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
            <span>Real-time push notifications for gate pickups</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
            <span>Works offline with cached student records</span>
          </div>
        </div>

        {/* Action / Instructions */}
        {isIos ? (
          <div className="bg-sky-50 border border-sky-200/80 rounded-2xl p-4 text-xs text-slate-800 space-y-2.5">
            <div className="font-semibold text-sky-900 flex items-center gap-1.5 text-sm">
              <Smartphone size={16} className="text-sky-600" />
              How to install on iPhone (iOS):
            </div>
            <div className="flex items-center gap-2 text-slate-700">
              <span className="w-5 h-5 rounded-full bg-sky-600 text-white font-bold flex items-center justify-center text-[10px] shrink-0">1</span>
              <span>Tap the <strong className="inline-flex items-center gap-1 text-slate-900"><Share size={13} className="text-sky-600" /> Share button</strong> in Safari navigation bar.</span>
            </div>
            <div className="flex items-center gap-2 text-slate-700">
              <span className="w-5 h-5 rounded-full bg-sky-600 text-white font-bold flex items-center justify-center text-[10px] shrink-0">2</span>
              <span>Scroll down and tap <strong className="inline-flex items-center gap-1 text-slate-900"><PlusSquare size={13} className="text-sky-600" /> Add to Home Screen</strong>.</span>
            </div>
          </div>
        ) : (
          <div className="flex gap-3">
            <button
              onClick={handleDismiss}
              className="flex-1 py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-sm rounded-xl transition"
            >
              Maybe Later
            </button>
            <button
              onClick={handleInstallClick}
              disabled={!deferredPrompt}
              className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white font-bold text-sm rounded-xl transition shadow-lg shadow-sky-600/30 active:scale-95"
            >
              <Download size={18} />
              Install Now
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
