'use client';

import { CheckCircle2, Bus, FileText, Megaphone, Clock } from 'lucide-react';

export interface HighlightItem {
  id: string;
  time: string;
  text: string;
  type: 'checkin' | 'escort' | 'assignment' | 'announcement' | 'other';
}

interface TodaysHighlightsCardProps {
  highlights: HighlightItem[];
  onViewAll?: () => void;
}

// Clean internal technical metadata like [sender_id:...] and [Message from ...]
function cleanMessageText(text: string): string {
  if (!text) return '';
  const cleaned = text
    .replace(/\[sender_id:[^\]]+\]/gi, '')
    .replace(/\[Message from [^\]]+\]:\s*/gi, '')
    .replace(/^\[[^\]]+\]\s*/g, '')
    .trim();
  return cleaned || text;
}

export default function TodaysHighlightsCard({
  highlights = [],
  onViewAll,
}: TodaysHighlightsCardProps) {
  const getIcon = (type: string) => {
    switch (type) {
      case 'checkin':
        return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
      case 'escort':
        return <Bus className="w-4 h-4 text-blue-500" />;
      case 'assignment':
        return <FileText className="w-4 h-4 text-indigo-500" />;
      case 'announcement':
        return <Megaphone className="w-4 h-4 text-amber-500" />;
      default:
        return <Clock className="w-4 h-4 text-slate-400" />;
    }
  };

  const getBgClass = (type: string) => {
    switch (type) {
      case 'checkin':
        return 'bg-emerald-50 border-emerald-100';
      case 'escort':
        return 'bg-blue-50 border-blue-100';
      case 'assignment':
        return 'bg-indigo-50 border-indigo-100';
      case 'announcement':
        return 'bg-amber-50 border-amber-100';
      default:
        return 'bg-slate-50 border-slate-100';
    }
  };

  return (
    <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs hover:shadow-md transition-all">
      {/* Header */}
      <div className="flex items-center justify-between mb-3.5">
        <h2 className="text-sm font-extrabold text-slate-900 tracking-tight">Today's Highlights</h2>
        <button
          type="button"
          onClick={onViewAll}
          className="text-xs font-bold text-emerald-600 hover:text-emerald-700 transition-colors"
        >
          View All
        </button>
      </div>

      {/* Timeline list */}
      <div className="space-y-3">
        {highlights && highlights.length > 0 ? (
          highlights.map((item) => {
            const displayMessage = cleanMessageText(item.text);
            return (
              <div key={item.id} className="flex items-start gap-3 text-xs">
                <div
                  className={`w-7 h-7 rounded-xl flex items-center justify-center border shrink-0 mt-0.5 ${getBgClass(
                    item.type
                  )}`}
                >
                  {getIcon(item.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-[10px] font-extrabold text-slate-400 block font-mono">
                    {item.time}
                  </span>
                  <p className="font-semibold text-slate-800 leading-snug">{displayMessage}</p>
                </div>
              </div>
            );
          })
        ) : (
          <div className="py-6 text-center">
            <Clock className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-xs font-bold text-slate-600">No Highlights Today</p>
            <p className="text-[11px] text-slate-400 mt-1">
              Events and check-in logs will appear here as they occur.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
