'use client';

import { toast } from 'sonner';
import { MessageSquare, ArrowRight } from 'lucide-react';
import { photoSrc } from '@/lib/photo';

export interface WhatsAppToastParams {
  senderName: string;
  senderAvatar?: string | null;
  roleBadge?: string; // 'Parent' | 'Teacher' | 'School Admin' | 'Staff'
  content: string;
  mediaType?: string | null;
  onView?: () => void;
}

export function showWhatsAppToast({
  senderName,
  senderAvatar,
  roleBadge = 'Message',
  content,
  mediaType,
  onView,
}: WhatsAppToastParams) {
  let snippet = content;
  if (!snippet || snippet.trim() === '') {
    if (mediaType?.startsWith('image/')) snippet = '📷 Photo attachment';
    else if (mediaType?.startsWith('audio/')) snippet = '🎙️ Voice note';
    else if (mediaType) snippet = '📄 File attachment';
    else snippet = 'Sent a message';
  }

  const avatarUrl = senderAvatar ? photoSrc(senderAvatar) : null;
  const initial = (senderName?.[0] || 'M').toUpperCase();

  toast.custom(
    (t) => (
      <div className="bg-slate-900 border border-slate-750 text-white rounded-2xl p-3.5 shadow-2xl flex items-center gap-3 min-w-[300px] max-w-[380px] font-sans antialiased border-emerald-500/30">
        {/* Avatar */}
        <div className="relative shrink-0">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={senderName}
              className="w-10 h-10 rounded-xl object-cover border border-slate-700 bg-slate-800"
            />
          ) : (
            <div className="w-10 h-10 rounded-xl bg-emerald-950 border border-emerald-800/40 text-emerald-400 font-bold flex items-center justify-center text-sm">
              {initial}
            </div>
          )}
          <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-slate-900 animate-pulse" />
        </div>

        {/* Content Details */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1 mb-0.5">
            <h4 className="text-xs font-bold text-white truncate">{senderName}</h4>
            <span className="text-[9px] font-mono bg-emerald-950/80 border border-emerald-800/40 text-emerald-400 px-1.5 py-0.5 rounded shrink-0">
              {roleBadge}
            </span>
          </div>
          <p className="text-[11px] text-slate-300 truncate leading-snug">
            {snippet}
          </p>
        </div>

        {/* View Action Button */}
        {onView && (
          <button
            type="button"
            onClick={() => {
              toast.dismiss(t);
              onView();
            }}
            className="p-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs shrink-0 transition-all flex items-center gap-1 shadow-md shadow-emerald-950/30 active:scale-95"
            title="View message"
          >
            <span>View</span>
            <ArrowRight size={12} />
          </button>
        )}
      </div>
    ),
    {
      duration: 5000,
      position: 'top-right',
    }
  );
}
