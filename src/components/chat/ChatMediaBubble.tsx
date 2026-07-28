import React from 'react';
import { FileText, Download } from 'lucide-react';
import { AudioPlayer } from './AudioPlayer';

interface ChatMediaBubbleProps {
  mediaUrl: string;
  mediaType: 'image' | 'audio' | 'document' | string | null;
  photoSrc: (path: string | null | undefined) => string | null;
  isDark?: boolean;
}

export function ChatMediaBubble({ mediaUrl, mediaType, photoSrc, isDark = false }: ChatMediaBubbleProps) {
  if (!mediaUrl) return null;

  const fullUrl = photoSrc(mediaUrl) || mediaUrl;
  const normalizedType = (mediaType || '').toLowerCase();

  // Auto-detect type if generic or missing
  const isImg = normalizedType === 'image' || /\.(jpg|jpeg|png|webp|gif)$/i.test(mediaUrl);
  const isAud = normalizedType === 'audio' || /\.(webm|mp3|wav|m4a|ogg)$/i.test(mediaUrl);

  if (isImg) {
    return (
      <div className={`mb-2 rounded-xl overflow-hidden border max-w-[260px] shadow-sm ${
        isDark ? 'border-slate-800 bg-slate-900' : 'border-slate-200/60 bg-slate-50'
      }`}>
        <a href={fullUrl} target="_blank" rel="noopener noreferrer">
          <img
            src={fullUrl}
            alt="Chat attachment"
            className="w-full max-h-[220px] object-cover hover:scale-105 transition-transform duration-200 cursor-pointer"
          />
        </a>
      </div>
    );
  }

  if (isAud) {
    return (
      <div className="mb-2 max-w-[280px]">
        <AudioPlayer src={fullUrl} />
      </div>
    );
  }

  // Document / Attachment handling (PDF, Word, Excel, etc.)
  const parts = mediaUrl.split('/');
  const rawName = parts[parts.length - 1] || 'attachment';
  const fileName = rawName.replace(/^\d+_/, '');
  const lowerName = fileName.toLowerCase();

  const isWord = lowerName.endsWith('.doc') || lowerName.endsWith('.docx');
  const isPdf = lowerName.endsWith('.pdf');

  return (
    <a
      href={fullUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={`flex items-center gap-2.5 p-3 rounded-xl border transition-all mb-2 text-xs font-medium max-w-[260px] ${
        isDark
          ? 'bg-slate-800/90 hover:bg-slate-800 border-slate-700/80 text-slate-100 shadow-sm'
          : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-800'
      }`}
    >
      {isWord ? (
        <FileText size={20} className="text-blue-400 shrink-0" />
      ) : isPdf ? (
        <FileText size={20} className="text-red-500 shrink-0" />
      ) : (
        <FileText size={20} className="text-emerald-500 shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <p className="truncate font-semibold text-xs leading-tight">{fileName}</p>
        <p className={`text-[10px] mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
          {isWord ? 'Word Document' : isPdf ? 'PDF Document' : 'Attachment'} • Click to view
        </p>
      </div>
      <Download size={15} className={`shrink-0 ${isDark ? 'text-slate-400' : 'text-slate-400'}`} />
    </a>
  );
}
