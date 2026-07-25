import React from 'react';
import { FileText, Download } from 'lucide-react';
import { AudioPlayer } from './AudioPlayer';

interface ChatMediaBubbleProps {
  mediaUrl: string;
  mediaType: 'image' | 'audio' | 'document' | string | null;
  photoSrc: (path: string) => string;
}

export function ChatMediaBubble({ mediaUrl, mediaType, photoSrc }: ChatMediaBubbleProps) {
  if (!mediaUrl) return null;

  const fullUrl = photoSrc(mediaUrl);

  if (mediaType === 'image') {
    return (
      <div className="mb-2 rounded-lg overflow-hidden border border-slate-200/50 max-w-[240px] bg-slate-50 shadow-xs">
        <a href={fullUrl} target="_blank" rel="noopener noreferrer">
          <img
            src={fullUrl}
            alt="Chat attachment"
            className="w-full max-h-[180px] object-cover hover:scale-105 transition-transform duration-200 cursor-pointer"
          />
        </a>
      </div>
    );
  }

  if (mediaType === 'audio') {
    return (
      <div className="mb-2 max-w-[280px]">
        <AudioPlayer src={fullUrl} />
      </div>
    );
  }

  if (mediaType === 'document') {
    // Attempt to extract clean filename
    const parts = mediaUrl.split('/');
    const rawName = parts[parts.length - 1] || 'document.pdf';
    // Remove timestamp prefix from safename (e.g. 1718293849_filename.pdf -> filename.pdf)
    const fileName = rawName.replace(/^\d+_/, '');

    return (
      <a
        href={fullUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 hover:text-slate-800 transition-colors mb-2 text-xs font-medium max-w-[240px]"
      >
        <FileText size={18} className="text-red-500 shrink-0" />
        <span className="truncate flex-1 font-semibold">{fileName}</span>
        <Download size={14} className="text-slate-400 shrink-0" />
      </a>
    );
  }

  // Fallback for legacy system image attachments
  return (
    <div className="mb-2 rounded-lg overflow-hidden border border-slate-200/50 max-w-[240px] bg-slate-50">
      <a href={fullUrl} target="_blank" rel="noopener noreferrer">
        <img
          src={fullUrl}
          alt="Chat attachment"
          className="w-full max-h-[180px] object-cover hover:scale-105 transition-transform duration-200 cursor-pointer"
        />
      </a>
    </div>
  );
}
