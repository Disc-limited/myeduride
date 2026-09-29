'use client';

import { X, Megaphone, Calendar, Clock, CheckCircle2, Share2, Tag } from 'lucide-react';
import { formatDateTimeLagos } from '@/lib/timezone';

interface SchoolAnnouncementDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  announcement: any;
}

export default function SchoolAnnouncementDetailModal({
  isOpen,
  onClose,
  announcement,
}: SchoolAnnouncementDetailModalProps) {
  if (!isOpen || !announcement) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 overflow-hidden flex flex-col space-y-4 animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0 shadow-2xs">
              <Megaphone className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                {announcement.tag || 'School Notice'}
              </span>
              <p className="text-[11px] text-slate-400 mt-1">
                {announcement.timeAgo || 'Recent'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Title */}
        <div>
          <h2 className="text-base sm:text-lg font-black text-slate-900 leading-snug">
            {announcement.title}
          </h2>
        </div>

        {/* Image if available */}
        {announcement.imgUrl && (
          <div className="w-full h-44 rounded-2xl overflow-hidden border border-slate-200 bg-slate-100">
            <img
              src={announcement.imgUrl}
              alt={announcement.title}
              className="w-full h-full object-cover"
            />
          </div>
        )}

        {/* Content Body */}
        <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-100 text-xs text-slate-700 leading-relaxed max-h-60 overflow-y-auto whitespace-pre-wrap">
          {announcement.desc || 'No further description provided.'}
        </div>

        {/* Read confirmation badge */}
        <div className="flex items-center justify-between pt-2">
          <span className="text-[11px] font-bold text-emerald-600 flex items-center gap-1.5">
            <CheckCircle2 size={14} />
            <span>Marked as read</span>
          </span>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
}
