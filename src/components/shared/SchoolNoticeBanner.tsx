// @ts-nocheck
'use client';

import { useEffect, useState } from 'react';
import {
  Megaphone,
  Calendar,
  AlertTriangle,
  Sparkles,
  ShieldAlert,
  X,
  ChevronRight,
  ChevronLeft,
  Paperclip,
  ExternalLink,
  Info
} from 'lucide-react';

interface SchoolNoticeBannerProps {
  role?: string;
  schoolId?: string;
  className?: string;
}

const CATEGORY_STYLES: Record<string, { label: string; bg: string; text: string; border: string; icon: any }> = {
  public_holiday: {
    label: 'Public Holiday Announcement',
    bg: 'bg-amber-500/10',
    text: 'text-amber-700',
    border: 'border-amber-400/40',
    icon: Calendar,
  },
  urgent: {
    label: 'Urgent Advisory',
    bg: 'bg-rose-500/10',
    text: 'text-rose-700',
    border: 'border-rose-400/40',
    icon: AlertTriangle,
  },
  event: {
    label: 'School Event',
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-700',
    border: 'border-emerald-400/40',
    icon: Sparkles,
  },
  emergency: {
    label: 'Emergency Safety Alert',
    bg: 'bg-purple-500/10',
    text: 'text-purple-700',
    border: 'border-purple-400/40',
    icon: ShieldAlert,
  },
  general: {
    label: 'School Notice',
    bg: 'bg-sky-500/10',
    text: 'text-sky-700',
    border: 'border-sky-400/40',
    icon: Megaphone,
  },
};

export default function SchoolNoticeBanner({
  role = 'parents',
  schoolId,
  className = '',
}: SchoolNoticeBannerProps) {
  const [notices, setNotices] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchActiveNotices();
    const interval = setInterval(fetchActiveNotices, 8000);
    return () => clearInterval(interval);
  }, [schoolId, role]);

  const fetchActiveNotices = async () => {
    try {
      const url = `/api/school-notices/active?user_role=${encodeURIComponent(role)}${
        schoolId ? `&school_id=${encodeURIComponent(schoolId)}` : ''
      }&_t=${Date.now()}`;
      const res = await fetch(url, { credentials: 'include', cache: 'no-store' });
      const data = await res.json();
      if (res.ok && data.notices) {
        setNotices((prev) => {
          if (data.notices.length > prev.length) {
            // New notice arrived! Reset index to 0 so the fresh notice pops up on top
            setCurrentIndex(0);
          }
          return data.notices;
        });
      }
    } catch (err) {
      console.warn('[SchoolNoticeBanner] fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const activeNotices = notices.filter((n) => !dismissedIds.includes(n.id));

  if (loading || activeNotices.length === 0) return null;

  const currentNotice = activeNotices[currentIndex] || activeNotices[0];
  const catConfig = CATEGORY_STYLES[currentNotice.category] || CATEGORY_STYLES.general;
  const CategoryIcon = catConfig.icon;

  const handleDismiss = (id: string) => {
    setDismissedIds((prev) => [...prev, id]);
    if (currentIndex >= activeNotices.length - 1) {
      setCurrentIndex(Math.max(0, activeNotices.length - 2));
    }
  };

  return (
    <div
      className={`rounded-3xl border ${catConfig.border} ${catConfig.bg} p-5 md:p-6 shadow-sm transition-all relative overflow-hidden ${className}`}
    >
      {/* Decorative Accent Glow */}
      <div className="absolute top-0 right-0 -mt-8 -mr-8 w-32 h-32 rounded-full bg-current opacity-[0.03] pointer-events-none" />

      <div className="flex items-start justify-between gap-4">
        
        {/* LEFT: Category Icon & Content */}
        <div className="flex items-start gap-4 flex-1 min-w-0">
          <div
            className={`w-11 h-11 rounded-2xl ${catConfig.bg} ${catConfig.text} border ${catConfig.border} flex items-center justify-center shrink-0 shadow-xs mt-0.5`}
          >
            <CategoryIcon size={22} />
          </div>

          <div className="flex-1 min-w-0 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${catConfig.border} ${catConfig.bg} ${catConfig.text}`}
              >
                {catConfig.label}
              </span>
              <span className="text-[11px] text-slate-500 font-mono font-medium">
                {new Date(currentNotice.created_at).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>

            <h3 className="text-sm md:text-base font-extrabold text-slate-900 leading-tight">
              {currentNotice.title}
            </h3>

            <p className="text-xs md:text-sm text-slate-700 font-medium leading-relaxed whitespace-pre-line break-words">
              {currentNotice.message}
            </p>

            {currentNotice.media_url && (
              <div className="pt-2">
                <a
                  href={currentNotice.media_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 hover:text-emerald-800 underline bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200"
                >
                  <Paperclip size={14} />
                  <span>View Notice Attachment / Document</span>
                  <ExternalLink size={12} />
                </a>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: Navigation & Dismiss Controls */}
        <div className="flex items-center gap-2 shrink-0 pt-0.5">
          {activeNotices.length > 1 && (
            <div className="flex items-center gap-1 bg-white/80 backdrop-blur rounded-xl p-1 border border-slate-200 text-xs font-bold text-slate-700">
              <button
                type="button"
                onClick={() => setCurrentIndex((prev) => (prev > 0 ? prev - 1 : activeNotices.length - 1))}
                className="p-1 hover:bg-slate-100 rounded-lg transition-colors"
                title="Previous Notice"
              >
                <ChevronLeft size={14} />
              </button>
              <span className="px-1 text-[11px] font-mono">
                {currentIndex + 1}/{activeNotices.length}
              </span>
              <button
                type="button"
                onClick={() => setCurrentIndex((prev) => (prev < activeNotices.length - 1 ? prev + 1 : 0))}
                className="p-1 hover:bg-slate-100 rounded-lg transition-colors"
                title="Next Notice"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={() => handleDismiss(currentNotice.id)}
            className="w-7 h-7 rounded-full bg-white/80 hover:bg-white text-slate-400 hover:text-slate-700 border border-slate-200 flex items-center justify-center transition-colors"
            title="Dismiss notice"
          >
            <X size={14} />
          </button>
        </div>

      </div>
    </div>
  );
}
