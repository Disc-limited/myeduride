'use client';

import { Megaphone, Calendar } from 'lucide-react';

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
  onViewAll?: () => void;
}

export default function SchoolAnnouncementsCard({
  announcements = [
    {
      id: '1',
      title: 'End of Term Exams',
      desc: 'The second term examination will commence on June 30th, 2026.',
      tag: 'Academic',
      tagColor: 'purple',
      timeAgo: '2 hours ago',
      imgUrl:
        'https://images.unsplash.com/photo-1427504494785-3a9ca7044f45?auto=format&fit=crop&q=80',
    },
    {
      id: '2',
      title: "Children's Day Celebration",
      desc: 'Join us on May 27th as we celebrate our wonderful children.',
      tag: 'Event',
      tagColor: 'orange',
      timeAgo: '1 day ago',
      imgUrl:
        'https://images.unsplash.com/photo-1509062522246-3755977927d7?auto=format&fit=crop&q=80',
    },
  ],
  onViewAll,
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

  return (
    <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs hover:shadow-md transition-all">
      {/* Header */}
      <div className="flex items-center justify-between mb-3.5">
        <h2 className="text-sm font-extrabold text-slate-900 tracking-tight">
          School Announcements
        </h2>
        <button
          type="button"
          onClick={onViewAll}
          className="text-xs font-bold text-emerald-600 hover:text-emerald-700 transition-colors"
        >
          View All
        </button>
      </div>

      {/* Announcements List */}
      <div className="space-y-3">
        {announcements && announcements.length > 0 ? (
          announcements.map((item) => (
            <div
              key={item.id}
              className="p-3 rounded-2xl bg-slate-50/80 border border-slate-100 flex items-start gap-3 transition-all hover:bg-slate-100/60"
            >
              {item.imgUrl ? (
                <div
                  className="w-11 h-11 rounded-xl bg-cover bg-center shrink-0 border border-slate-200"
                  style={{ backgroundImage: `url("${item.imgUrl}")` }}
                />
              ) : (
                <div className="w-11 h-11 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 shrink-0">
                  <Megaphone className="w-4 h-4" />
                </div>
              )}

              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-xs font-extrabold text-slate-900 truncate">{item.title}</h3>
                  <span
                    className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full border shrink-0 ${getTagBadgeClass(
                      item.tagColor
                    )}`}
                  >
                    {item.tag}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 line-clamp-2 mt-0.5 leading-snug">
                  {item.desc}
                </p>
                <span className="text-[9px] font-bold text-slate-400 font-mono block mt-1">
                  {item.timeAgo}
                </span>
              </div>
            </div>
          ))
        ) : (
          <div className="py-6 text-center text-slate-400 text-xs">No announcements yet</div>
        )}
      </div>
    </div>
  );
}
