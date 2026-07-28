'use client';

import { useState, useEffect } from 'react';
import { getSession } from '@/lib/api';
import {
  Menu,
  Search,
  Bell,
  Mail,
  HelpCircle,
  ChevronDown,
} from 'lucide-react';
import Link from 'next/link';

interface AdminHeaderProps {
  onMenuClick?: () => void;
}

export function AdminHeader({ onMenuClick }: AdminHeaderProps) {
  const [userName, setUserName] = useState('School Admin');
  const [schoolName, setSchoolName] = useState('Greenfield International School');
  const [unreadNotifications, setUnreadNotifications] = useState(8);
  const [unreadMessages, setUnreadMessages] = useState(15);
  const [userInitials, setUserInitials] = useState('GI');

  useEffect(() => {
    const session = getSession();
    if (session) {
      if (session.full_name) {
        setUserName(session.full_name);
        const parts = session.full_name.trim().split(/\s+/);
        if (parts.length >= 2) {
          setUserInitials((parts[0][0] + parts[1][0]).toUpperCase());
        } else if (parts[0]) {
          setUserInitials(parts[0].slice(0, 2).toUpperCase());
        }
      }
      if (session.primary_school?.name) {
        setSchoolName(session.primary_school.name);
      }
    }
  }, []);

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-slate-200/80 px-4 sm:px-6 py-2.5 flex items-center justify-between gap-4 shadow-sm">
      {/* Left Area: Mobile Menu Toggle & School Selector */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onMenuClick}
          className="lg:hidden p-2 rounded-xl text-slate-600 hover:bg-slate-100 transition-colors"
          aria-label="Toggle Navigation"
        >
          <Menu size={20} />
        </button>

        {/* School Dropdown Selector */}
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <div className="relative group flex items-center gap-1.5 font-extrabold text-slate-900 text-sm sm:text-base cursor-pointer hover:text-emerald-700 transition-colors">
            <span className="truncate max-w-[180px] sm:max-w-[260px]">{schoolName}</span>
            <ChevronDown size={16} className="text-slate-400 shrink-0" />
          </div>

          <span className="px-2.5 py-0.5 rounded-full bg-emerald-500 text-white text-[11px] font-bold shrink-0">
            Active
          </span>

          <span className="hidden sm:inline-block px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 text-xs font-medium border border-slate-200/60 shrink-0">
            2024/2025 Session
          </span>
        </div>
      </div>

      {/* Center/Right Area: Search & Actions */}
      <div className="flex items-center gap-3 sm:gap-4 shrink-0">
        {/* Global Search Input */}
        <div className="relative hidden md:block w-64 lg:w-80">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search students, staff, vehicles, etc..."
            className="w-full pl-10 pr-4 py-1.5 bg-slate-50 border border-slate-200/90 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
          />
        </div>

        {/* Notifications Icon with Badge */}
        <Link
          href="/dashboard/school-admin/notifications"
          className="relative p-2 rounded-xl text-slate-600 hover:text-emerald-600 hover:bg-slate-100 transition-colors"
          title="Notifications"
        >
          <Bell size={20} />
          {unreadNotifications > 0 && (
            <span className="absolute top-1 right-1 h-4 min-w-[16px] px-1 bg-emerald-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white">
              {unreadNotifications}
            </span>
          )}
        </Link>

        {/* Messages / EduChat Icon with Badge */}
        <Link
          href="/dashboard/school-admin/messages"
          className="relative p-2 rounded-xl text-slate-600 hover:text-emerald-600 hover:bg-slate-100 transition-colors"
          title="Messages"
        >
          <Mail size={20} />
          {unreadMessages > 0 && (
            <span className="absolute top-1 right-1 h-4 min-w-[16px] px-1 bg-emerald-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white">
              {unreadMessages}
            </span>
          )}
        </Link>

        {/* Help / FAQ Icon */}
        <button
          type="button"
          className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors hidden sm:block"
          title="Help & Support"
        >
          <HelpCircle size={20} />
        </button>

        {/* Admin User Profile Pill */}
        <Link
          href="/dashboard/account"
          className="flex items-center gap-2.5 pl-1.5 pr-3 py-1 rounded-full bg-slate-50 hover:bg-slate-100 border border-slate-200/80 transition-all cursor-pointer"
        >
          <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center font-black text-xs shadow-sm shrink-0">
            {userInitials}
          </div>
          <div className="hidden sm:flex flex-col text-left">
            <span className="text-xs font-bold text-slate-900 leading-tight truncate max-w-[120px]">
              {userName}
            </span>
            <span className="text-[10px] font-medium text-slate-500 leading-tight">
              School Admin
            </span>
          </div>
        </Link>
      </div>
    </header>
  );
}
