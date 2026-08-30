'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Megaphone,
  Search,
  Calendar,
  AlertTriangle,
  Sparkles,
  ShieldAlert,
  FileText,
  CheckCircle2,
  Clock,
  ExternalLink,
  Bell,
  Inbox,
  Filter,
  RefreshCw,
  Tag,
  Share2
} from 'lucide-react';
import { formatTimeLagos } from '@/lib/utils/time';
import { toast } from 'sonner';

interface SchoolNoticesInboxViewProps {
  role?: string;
  schoolId?: string;
  className?: string;
}

const CATEGORY_MAP: Record<
  string,
  { label: string; icon: any; bg: string; text: string; border: string; pillBg: string }
> = {
  public_holiday: {
    label: 'Public Holiday',
    icon: Calendar,
    bg: 'bg-amber-500/10',
    text: 'text-amber-600 dark:text-amber-400',
    border: 'border-amber-500/20',
    pillBg: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  },
  urgent: {
    label: 'Urgent Advisory',
    icon: AlertTriangle,
    bg: 'bg-rose-500/10',
    text: 'text-rose-600 dark:text-rose-400',
    border: 'border-rose-500/20',
    pillBg: 'bg-rose-500/15 text-rose-700 dark:text-rose-300',
  },
  event: {
    label: 'School Event',
    icon: Sparkles,
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-600 dark:text-emerald-400',
    border: 'border-emerald-500/20',
    pillBg: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  },
  emergency: {
    label: 'Emergency Alert',
    icon: ShieldAlert,
    bg: 'bg-purple-500/10',
    text: 'text-purple-600 dark:text-purple-400',
    border: 'border-purple-500/20',
    pillBg: 'bg-purple-500/15 text-purple-700 dark:text-purple-300',
  },
  general: {
    label: 'General Notice',
    icon: Megaphone,
    bg: 'bg-sky-500/10',
    text: 'text-sky-600 dark:text-sky-400',
    border: 'border-sky-500/20',
    pillBg: 'bg-sky-500/15 text-sky-700 dark:text-sky-300',
  },
};

export default function SchoolNoticesInboxView({
  role = 'parents',
  schoolId,
  className = '',
}: SchoolNoticesInboxViewProps) {
  const [notices, setNotices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [readIds, setReadIds] = useState<string[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchNotices(true);
    const interval = setInterval(() => fetchNotices(false), 8000);
    return () => clearInterval(interval);
  }, [role, schoolId]);

  const fetchNotices = async (showLoadingSpinner = false) => {
    if (showLoadingSpinner) setLoading(true);
    try {
      const url = `/api/school-notices/active?user_role=${encodeURIComponent(role)}${
        schoolId ? `&school_id=${encodeURIComponent(schoolId)}` : ''
      }&_t=${Date.now()}`;
      const res = await fetch(url, { credentials: 'include', cache: 'no-store' });
      const data = await res.json();
      if (res.ok && data.notices) {
        setNotices(data.notices);
      }
    } catch (err) {
      console.warn('[SchoolNoticesInboxView] fetch error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchNotices();
  };

  const toggleReadStatus = (id: string) => {
    setReadIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const markAllRead = () => {
    setReadIds(notices.map((n) => n.id));
    toast.success('All school notices marked as read');
  };

  // Filtered notices
  const filteredNotices = useMemo(() => {
    return notices.filter((item) => {
      const matchesCategory =
        selectedCategory === 'all' || item.category === selectedCategory;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        (item.title || '').toLowerCase().includes(q) ||
        (item.message || '').toLowerCase().includes(q);
      return matchesCategory && matchesSearch;
    });
  }, [notices, selectedCategory, searchQuery]);

  const unreadCount = notices.filter((n) => !readIds.includes(n.id)).length;

  return (
    <div className={`space-y-6 ${className}`}>
      {/* HEADER BANNER CONSOLE */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 text-white rounded-3xl p-6 md:p-8 shadow-xl relative overflow-hidden border border-slate-800">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-48 h-48 rounded-full bg-emerald-500/10 blur-2xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-10 w-48 h-48 rounded-full bg-sky-500/10 blur-2xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-300 text-xs font-bold border border-emerald-500/30">
              <Bell size={13} className="animate-pulse" />
              <span>Official Communications Console</span>
            </div>
            <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
              School Notices & Announcements
            </h2>
            <p className="text-slate-300 text-sm max-w-2xl leading-relaxed">
              All official circulars, public holiday advisories, and emergency safety updates issued by School Administration pile up here for instant access.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="px-4 py-2.5 rounded-2xl bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50"
            >
              <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
              <span>Refresh</span>
            </button>

            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-emerald-900/30 transition-all active:scale-95"
              >
                <CheckCircle2 size={14} />
                <span>Mark All Read ({unreadCount})</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* FILTER & SEARCH CONTROL BAR */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Category Pills */}
        <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto pb-1 md:pb-0 scrollbar-none">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
              selectedCategory === 'all'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Inbox size={14} />
            <span>All Notices</span>
            <span className="ml-1 px-1.5 py-0.5 rounded-full bg-white/20 text-[10px]">
              {notices.length}
            </span>
          </button>

          {Object.entries(CATEGORY_MAP).map(([key, cfg]) => {
            const Icon = cfg.icon;
            const isSelected = selectedCategory === key;
            const count = notices.filter((n) => n.category === key).length;
            return (
              <button
                key={key}
                onClick={() => setSelectedCategory(key)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                  isSelected
                    ? `${cfg.bg} ${cfg.text} border ${cfg.border} shadow-sm`
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <Icon size={14} />
                <span>{cfg.label}</span>
                {count > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 rounded-full bg-slate-200 text-slate-700 text-[10px]">
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Search Bar Input */}
        <div className="relative w-full md:w-72">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search notices by keyword..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 font-bold"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* NOTICES PILE-UP FEED */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3">
          <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Loading official school notice archive...
          </p>
        </div>
      ) : filteredNotices.length === 0 ? (
        <div className="bg-white rounded-3xl border border-dashed border-slate-300 p-12 text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
            <Inbox size={28} />
          </div>
          <h3 className="font-bold text-slate-800 text-lg">No School Notices Found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {searchQuery || selectedCategory !== 'all'
              ? 'No announcements match your search query or selected category filter.'
              : 'Your school administration has not posted any broadcast notices yet.'}
          </p>
          {(searchQuery || selectedCategory !== 'all') && (
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('all');
              }}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all"
            >
              Reset Filters
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredNotices.map((item) => {
            const catConfig = CATEGORY_MAP[item.category] || CATEGORY_MAP.general;
            const CategoryIcon = catConfig.icon;
            const isRead = readIds.includes(item.id);

            return (
              <div
                key={item.id}
                className={`bg-white rounded-3xl border transition-all relative overflow-hidden ${
                  isRead
                    ? 'border-slate-200 opacity-90'
                    : 'border-slate-300 shadow-md ring-1 ring-emerald-500/20'
                }`}
              >
                {/* Status Bar Indicator */}
                {!isRead && (
                  <div className="absolute top-0 left-0 bottom-0 w-1.5 bg-emerald-500" />
                )}

                <div className="p-5 md:p-6 space-y-4">
                  {/* TOP CARD HEADER */}
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2.5">
                      <div className={`p-2.5 rounded-xl ${catConfig.bg} ${catConfig.text}`}>
                        <CategoryIcon size={18} />
                      </div>
                      <div>
                        <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider ${catConfig.pillBg}`}>
                          {catConfig.label}
                        </span>
                        <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                          Issued by School Administration
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium">
                        <Clock size={13} />
                        <span>
                          {item.created_at
                            ? formatTimeLagos(item.created_at)
                            : 'Recent'}
                        </span>
                      </div>

                      <button
                        onClick={() => toggleReadStatus(item.id)}
                        className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                          isRead
                            ? 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                            : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                        }`}
                      >
                        {isRead ? 'Mark Unread' : 'Mark Read'}
                      </button>
                    </div>
                  </div>

                  {/* CARD TITLE & BODY MESSAGE */}
                  <div className="space-y-2 pl-2">
                    <h3 className="font-extrabold text-lg md:text-xl text-slate-900">
                      {item.title}
                    </h3>
                    <div className="text-slate-700 text-sm leading-relaxed whitespace-pre-wrap font-sans">
                      {item.message}
                    </div>
                  </div>

                  {/* MEDIA ATTACHMENT / DOCUMENT DOWNLOAD IF PRESENT */}
                  {item.media_url && (
                    <div className="pt-2">
                      <a
                        href={item.media_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-sky-50 hover:bg-sky-100 border border-sky-200 text-sky-700 font-bold text-xs transition-all"
                      >
                        <FileText size={16} />
                        <span>View Attachment / Document</span>
                        <ExternalLink size={13} className="ml-1" />
                      </a>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
