'use client';

import { MessageSquare, ShieldCheck, UserCheck, MessageCircle } from 'lucide-react';

export interface ChatThreadItem {
  id: string;
  name: string;
  role: string;
  lastMessage: string;
  time: string;
  unreadCount?: number;
  avatarUrl?: string | null;
}

interface EduChatPreviewCardProps {
  threads?: ChatThreadItem[];
  onOpenChat: (threadId?: string) => void;
  onSeeAll?: () => void;
}

export default function EduChatPreviewCard({
  threads = [
    {
      id: 'school',
      name: 'Greenfield International School',
      role: 'School Office',
      lastMessage: 'New announcement posted',
      time: '10:14 AM',
      unreadCount: 2,
    },
    {
      id: 'teacher',
      name: 'Mrs. Smith',
      role: 'Class Teacher',
      lastMessage: 'Science assignment uploaded',
      time: '9:30 AM',
      unreadCount: 1,
    },
    {
      id: 'escort',
      name: 'John Okafor',
      role: 'Escort',
      lastMessage: "I have arrived at David's stop.",
      time: '2:40 PM',
      unreadCount: 0,
    },
    {
      id: 'support',
      name: 'Customer Care',
      role: 'Support',
      lastMessage: 'How can we help you today?',
      time: 'Yesterday',
      unreadCount: 0,
    },
  ],
  onOpenChat,
  onSeeAll,
}: EduChatPreviewCardProps) {
  return (
    <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs hover:shadow-md transition-all">
      {/* Header */}
      <div className="flex items-center justify-between mb-3.5">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
            <MessageSquare className="w-4 h-4" />
          </div>
          <h2 className="text-sm font-extrabold text-slate-900 tracking-tight">EduChat</h2>
        </div>
        <button
          type="button"
          onClick={onSeeAll}
          className="text-xs font-bold text-emerald-600 hover:text-emerald-700 transition-colors"
        >
          See All
        </button>
      </div>

      {/* Threads List */}
      <div className="space-y-2">
        {threads && threads.length > 0 ? (
          threads.map((item) => (
            <div
              key={item.id}
              onClick={() => onOpenChat(item.id)}
              className="p-2.5 rounded-2xl bg-slate-50/80 hover:bg-slate-100/80 border border-slate-100 flex items-center justify-between cursor-pointer transition-all group"
            >
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <div className="w-9 h-9 rounded-full bg-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center shrink-0 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                  {item.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <p className="text-xs font-extrabold text-slate-900 truncate">{item.name}</p>
                    <span className="text-[9px] font-bold text-slate-400 font-mono shrink-0">
                      {item.time}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 truncate leading-snug">
                    {item.lastMessage}
                  </p>
                </div>
              </div>

              {item.unreadCount && item.unreadCount > 0 ? (
                <span className="ml-2 bg-emerald-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full shrink-0">
                  {item.unreadCount}
                </span>
              ) : null}
            </div>
          ))
        ) : (
          <div className="py-6 text-center text-slate-400 text-xs">No active chats</div>
        )}
      </div>
    </div>
  );
}
