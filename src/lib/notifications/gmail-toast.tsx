'use client';

import { toast } from 'sonner';
import { Mail, Bell, ArrowRight, X, Sparkles } from 'lucide-react';
import { photoSrc } from '@/lib/photo';
import { playNotificationChime } from './sound';

export interface GmailToastParams {
  id?: string;
  title: string;
  message: string;
  senderName?: string;
  avatarUrl?: string | null;
  tag?: string;
  timeStr?: string;
  playSound?: boolean;
  onOpen?: () => void;
  onDismiss?: () => void;
}

export function showGmailNotificationToast({
  id,
  title,
  message,
  senderName = 'EduRide Alert',
  avatarUrl,
  tag = 'Notification',
  timeStr = 'Just now',
  playSound = true,
  onOpen,
  onDismiss,
}: GmailToastParams) {
  if (playSound) {
    playNotificationChime();
  }

  const src = avatarUrl ? photoSrc(avatarUrl) : null;
  const initial = (senderName?.[0] || 'E').toUpperCase();

  toast.custom(
    (t) => (
      <div className="bg-slate-900/95 border border-slate-700/80 text-white rounded-2xl p-4 shadow-2xl backdrop-blur-md flex items-start gap-3.5 min-w-[320px] max-w-[420px] font-sans antialiased animate-in slide-in-from-top-3 duration-300 ring-1 ring-emerald-500/20 hover:border-emerald-500/50 transition-all">
        {/* Gmail / Alert Avatar with Pulsing Online Badge */}
        <div className="relative shrink-0 mt-0.5">
          {src ? (
            <img
              src={src}
              alt={senderName}
              className="w-10 h-10 rounded-xl object-cover border border-slate-700 bg-slate-800"
            />
          ) : (
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-800 text-white font-black flex items-center justify-center text-sm shadow-inner">
              <Mail className="w-5 h-5 text-white" />
            </div>
          )}
          <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-slate-900 animate-ping" />
          <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-slate-900" />
        </div>

        {/* Content Body */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1.5 mb-1">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-400 bg-emerald-950/70 border border-emerald-800/40 px-1.5 py-0.5 rounded">
              {tag}
            </span>
            <span className="text-[10px] text-slate-400 font-mono shrink-0">{timeStr}</span>
          </div>

          <h4 className="text-xs font-black text-slate-100 leading-snug line-clamp-1">
            {title}
          </h4>
          <p className="text-[11px] text-slate-300 line-clamp-2 mt-0.5 leading-snug">
            {message}
          </p>

          {/* Action Row */}
          <div className="flex items-center justify-end gap-2 mt-2.5 pt-2 border-t border-slate-800/80">
            <button
              type="button"
              onClick={() => {
                toast.dismiss(t);
                if (onDismiss) onDismiss();
              }}
              className="text-[11px] font-bold text-slate-400 hover:text-slate-200 px-2.5 py-1 rounded-lg hover:bg-slate-800 transition-colors"
            >
              Dismiss
            </button>
            <button
              type="button"
              onClick={() => {
                toast.dismiss(t);
                if (onOpen) onOpen();
              }}
              className="text-[11px] font-black bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1 rounded-lg transition-all flex items-center gap-1 shadow-md shadow-emerald-950/40 active:scale-95 cursor-pointer"
            >
              <span>Open & Read</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Close Icon */}
        <button
          type="button"
          onClick={() => {
            toast.dismiss(t);
            if (onDismiss) onDismiss();
          }}
          className="text-slate-500 hover:text-slate-300 shrink-0 p-1 -mr-1 -mt-1 rounded-md"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    ),
    {
      id: id ? `gmail-notif-${id}` : undefined,
      duration: 8000,
      position: 'top-right',
    }
  );
}
