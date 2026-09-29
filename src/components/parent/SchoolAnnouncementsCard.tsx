'use client';

import { Megaphone, Calendar, Sparkles, CheckCheck } from 'lucide-react';

export interface AnnouncementItem {
  id: string;
  title: string;
  desc: string;
  tag: string;
  tagColor: 'purple' | 'orange' | 'emerald' | 'blue';
  timeAgo: string;
  imgUrl?: string;
}

interface SchoolAnnouncementsCardProps {
  announcements?: AnnouncementItem[];
  readNoticeIds?: string[];
  onViewAll?: () => void;
  onSelectAnnouncement?: (item: AnnouncementItem) => void;
}

export default function SchoolAnnouncementsCard({
  announcements = [],
  readNoticeIds = [],
  onViewAll,
  onSelectAnnouncement,
}: SchoolAnnouncementsCardProps) {
  const getTagBadgeClass = (color: string) => {
    switch (color) {
      case 'purple':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'orange':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'emerald':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      default:
        return 'bg-blue-50 text-blue-700 border-blue-200';
    }
  };

  const isRead = (id: string) => readNoticeIds.includes(id);

  return (
    <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs hover:shadow-md transition-all">
      {/* Header */}
      <div className="flex items-center justify-between mb-3.5">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-extrabold text-slate-900 tracking-tight">
            School Announcements
          </h2>
          {announcements.some((a) => !isRead(a.id)) && (
            <span className="text-[9px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
              New
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onViewAll}
          className="text-xs font-bold text-emerald-600 hover:text-emerald-700 transition-colors cursor-pointer"
        >
          View All
        </button>
      </div>

      {/* Announcements List */}
      <div className="space-y-3">
        {announcements && announcements.length > 0 ? (
          announcements.map((item) => {
            const read = isRead(item.id);
            return (
              <div
                key={item.id}
                onClick={() => onSelectAnnouncement && onSelectAnnouncement(item)}
                className={`p-3 rounded-2xl border flex items-start gap-3 transition-all cursor-pointer ${
                  !read
                    ? 'bg-emerald-50/40 border-emerald-200/80 hover:bg-emerald-50/80 shadow-2xs'
                    : 'bg-slate-50/80 border-slate-100 hover:bg-slate-100/60 opacity-85'
                }`}
                title="Click to read full announcement"
              >
                {item.imgUrl ? (
                  <div
                    className="w-11 h-11 rounded-xl bg-cover bg-center shrink-0 border border-slate-200 relative"
                    style={{ backgroundImage: `url("${item.imgUrl}")` }}
                  >
                    {!read && (
                      <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-white animate-pulse" />
                    )}
                  </div>
                ) : (
                  <div
                    className={`w-11 h-11 rounded-xl border flex items-center justify-center shrink-0 relative ${
                      !read
                        ? 'bg-emerald-100 border-emerald-200 text-emerald-700'
                        : 'bg-amber-50 border-amber-100 text-amber-600'
                    }`}
                  >
                    <Megaphone className="w-4 h-4" />
                    {!read && (
                      <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-white animate-pulse" />
                    )}
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className={`text-xs truncate ${!read ? 'font-black text-slate-900' : 'font-bold text-slate-700'}`}>
                      {item.title}
                    </h3>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {!read ? (
                        <span className="text-[9px] font-black uppercase text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">
                          Unread
                        </span>
                      ) : (
                        <span className="text-[9px] font-medium text-slate-400 flex items-center gap-0.5">
                          <CheckCheck size={11} className="text-emerald-500" />
                          <span>Read</span>
                        </span>
                      )}
                      <span
                        className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full border ${getTagBadgeClass(
                          item.tagColor
                        )}`}
                      >
                        {item.tag}
                      </span>
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-500 line-clamp-2 mt-0.5 leading-snug">
                    {item.desc}
                  </p>
                  <span className="text-[9px] font-bold text-slate-400 font-mono block mt-1">
                    {item.timeAgo}
                  </span>
                </div>
              </div>
            );
          })
        ) : (
          <div className="py-6 text-center text-slate-400 text-xs">No announcements yet</div>
        )}
      </div>
    </div>
  );
}
