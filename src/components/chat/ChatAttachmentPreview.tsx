import React from 'react';
import { X, FileText, Headphones } from 'lucide-react';

interface ChatAttachmentPreviewProps {
  file: File;
  onCancel: () => void;
}

export function ChatAttachmentPreview({ file, onCancel }: ChatAttachmentPreviewProps) {
  const isImage = file.type.startsWith('image/');
  const isAudio = file.type.startsWith('audio/');

  // Use URL.createObjectURL safely for client-side rendering
  const previewUrl = isImage ? URL.createObjectURL(file) : '';

  // Clean up object URL when component unmounts
  React.useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  return (
    <div className="flex items-center gap-3 bg-slate-100 border border-slate-200 p-2 rounded-xl mb-2 relative animate-in fade-in slide-in-from-bottom-2 duration-200">
      <div className="relative w-12 h-12 shrink-0 rounded-lg overflow-hidden border border-slate-300 bg-white flex items-center justify-center">
        {isImage ? (
          <img
            src={previewUrl}
            alt="Upload preview"
            className="w-full h-full object-cover"
          />
        ) : isAudio ? (
          <Headphones size={20} className="text-primary-600" />
        ) : (
          <FileText size={20} className="text-blue-500" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-slate-700 truncate">{file.name}</p>
        <p className="text-[10px] text-slate-400">
          {(file.size / 1024).toFixed(1)} KB • Ready to send
        </p>
      </div>

      <button
        onClick={onCancel}
        type="button"
        className="p-1.5 rounded-full hover:bg-slate-200 text-slate-500 hover:text-slate-700 transition-colors"
        title="Remove attachment"
      >
        <X size={16} />
      </button>
    </div>
  );
}
