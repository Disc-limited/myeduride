import React from 'react';
import { Mic, Square, Trash2, Check, Play, Pause } from 'lucide-react';
import { useVoiceRecorder } from '@/hooks/useVoiceRecorder';

interface VoiceRecordButtonProps {
  onRecordComplete: (blob: Blob) => void;
  onRecordingStateChange?: (isRecording: boolean) => void;
}

export function VoiceRecordButton({ onRecordComplete, onRecordingStateChange }: VoiceRecordButtonProps) {
  const {
    isRecording,
    duration,
    audioBlob,
    startRecording,
    stopRecording,
    cancelRecording,
    clearAudio,
  } = useVoiceRecorder();

  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [isPlayingPreview, setIsPlayingPreview] = React.useState(false);
  const audioPreviewRef = React.useRef<HTMLAudioElement | null>(null);

  React.useEffect(() => {
    if (onRecordingStateChange) {
      onRecordingStateChange(isRecording);
    }
  }, [isRecording, onRecordingStateChange]);

  React.useEffect(() => {
    if (audioBlob) {
      const url = URL.createObjectURL(audioBlob);
      setPreviewUrl(url);
      return () => {
        URL.revokeObjectURL(url);
        setPreviewUrl(null);
      };
    } else {
      setPreviewUrl(null);
    }
  }, [audioBlob]);

  const handleTogglePlayPreview = () => {
    if (!audioPreviewRef.current) return;
    if (isPlayingPreview) {
      audioPreviewRef.current.pause();
    } else {
      audioPreviewRef.current.play().catch((err) => console.error(err));
    }
  };

  const handleSend = () => {
    if (audioBlob) {
      onRecordComplete(audioBlob);
      clearAudio();
    }
  };

  const handleDiscard = () => {
    cancelRecording();
    clearAudio();
  };

  if (isRecording) {
    return (
      <div className="flex items-center gap-2 bg-red-50 border border-red-200 px-3 py-1.5 rounded-full animate-pulse">
        <div className="w-2 h-2 rounded-full bg-red-600 animate-ping shrink-0" />
        <span className="text-xs font-semibold text-red-600 min-w-[30px]">
          {Math.floor(duration / 60)}:{String(duration % 60).padStart(2, '0')}
        </span>
        <button
          onClick={stopRecording}
          type="button"
          className="p-1 rounded-full hover:bg-red-100 text-red-600 focus:outline-none"
          title="Stop recording"
        >
          <Square size={12} fill="currentColor" />
        </button>
        <button
          onClick={handleDiscard}
          type="button"
          className="p-1 rounded-full hover:bg-red-100 text-red-600 focus:outline-none"
          title="Cancel recording"
        >
          <Trash2 size={12} />
        </button>
      </div>
    );
  }

  if (audioBlob && previewUrl) {
    return (
      <div className="flex items-center gap-2 bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-full animate-in fade-in zoom-in-95 duration-150">
        <audio
          ref={audioPreviewRef}
          src={previewUrl}
          onPlay={() => setIsPlayingPreview(true)}
          onPause={() => setIsPlayingPreview(false)}
          onEnded={() => setIsPlayingPreview(false)}
          className="hidden"
        />
        <button
          onClick={handleTogglePlayPreview}
          type="button"
          className="p-1 rounded-full hover:bg-slate-200 text-slate-700 focus:outline-none"
          title={isPlayingPreview ? 'Pause' : 'Play preview'}
        >
          {isPlayingPreview ? <Pause size={12} fill="currentColor" /> : <Play size={12} fill="currentColor" className="ml-0.5" />}
        </button>
        <span className="text-[10px] text-slate-500 font-medium">Voice note ready</span>
        <button
          onClick={handleSend}
          type="button"
          className="p-1 rounded-full hover:bg-green-200 text-green-700 focus:outline-none"
          title="Confirm attachment"
        >
          <Check size={12} />
        </button>
        <button
          onClick={handleDiscard}
          type="button"
          className="p-1 rounded-full hover:bg-red-100 text-red-600 focus:outline-none"
          title="Discard recording"
        >
          <Trash2 size={12} />
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={startRecording}
      type="button"
      className="p-2 rounded-full hover:bg-slate-100 text-slate-500 hover:text-primary-600 transition-colors focus:outline-none"
      title="Record voice note"
    >
      <Mic size={20} />
    </button>
  );
}
