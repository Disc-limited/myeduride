'use client';

import { CalendarDays, Clock } from 'lucide-react';

export interface EventItem {
  id: string;
  month: string;
  day: string;
  title: string;
  timeRange: string;
  tag: string;
  tagColor: 'blue' | 'purple' | 'orange';
}

interface UpcomingEventsCardProps {
  events?: EventItem[];
  onViewAll?: () => void;
}

export default function UpcomingEventsCard({
  events = [
    {
      id: '1',
      month: 'JUN',
      day: '25',
      title: 'PTA Meeting',
      timeRange: '2:00 PM - 3:30 PM',
      tag: 'Meeting',
      tagColor: 'blue',
    },
    {
      id: '2',
      month: 'JUN',
      day: '30',
      title: 'End of Term Exams',
      timeRange: 'All Day',
      tag: 'Academic',
      tagColor: 'purple',
    },
    {
      id: '3',
      month: 'JUL',
      day: '05',
      title: "Children's Day Celebration",
      timeRange: '10:00 AM - 2:00 PM',
      tag: 'Event',
      tagColor: 'orange',
    },
  ],
  onViewAll,
}: UpcomingEventsCardProps) {
  const getTagBadgeClass = (color: string) => {
    switch (color) {
      case 'blue':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'purple':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'orange':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs hover:shadow-md transition-all">
      {/* Header */}
      <div className="flex items-center justify-between mb-3.5">
        <h2 className="text-sm font-extrabold text-slate-900 tracking-tight">Upcoming Events</h2>
        <button
          type="button"
          onClick={onViewAll}
          className="text-xs font-bold text-emerald-600 hover:text-emerald-700 transition-colors"
        >
          View All
        </button>
      </div>

      {/* Events List */}
      <div className="space-y-2.5">
        {events && events.length > 0 ? (
          events.map((evt) => (
            <div
              key={evt.id}
              className="p-2.5 rounded-2xl bg-slate-50/80 border border-slate-100 flex items-center justify-between transition-all hover:bg-slate-100/60"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                {/* Date Block */}
                <div className="w-11 h-11 rounded-xl bg-white border border-slate-200 shadow-2xs flex flex-col items-center justify-center shrink-0">
                  <span className="text-[9px] font-extrabold text-emerald-700 uppercase tracking-wider leading-none">
                    {evt.month}
                  </span>
                  <span className="text-base font-black text-slate-900 leading-none mt-0.5">
                    {evt.day}
                  </span>
                </div>

                <div className="min-w-0 flex-1">
                  <h3 className="text-xs font-extrabold text-slate-900 leading-tight truncate">
                    {evt.title}
                  </h3>
                  <div className="flex items-center gap-1 mt-0.5 text-[10px] text-slate-400 font-medium">
                    <Clock className="w-3 h-3 text-slate-400" />
                    <span className="truncate">{evt.timeRange}</span>
                  </div>
                </div>
              </div>

              <span
                className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full border shrink-0 ${getTagBadgeClass(
                  evt.tagColor
                )}`}
              >
                {evt.tag}
              </span>
            </div>
          ))
        ) : (
          <div className="py-6 text-center text-slate-400 text-xs">No upcoming events</div>
        )}
      </div>
    </div>
  );
}
