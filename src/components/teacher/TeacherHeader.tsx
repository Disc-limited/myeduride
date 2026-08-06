'use client';

import { useState, useEffect } from 'react';
import { Bell, Menu, Clock, Calendar, Check, X, ShieldAlert, MessageSquare } from 'lucide-react';
import { RoleSwitcher } from '@/components/shared/RoleSwitcher';
import { KeyRound } from 'lucide-react';
import { AccountSettingsModal } from '@/components/shared/AccountSettingsModal';

interface TeacherHeaderProps {
  onMenuClick: () => void;
  user?: any;
  unreadNotificationsCount?: number;
}

export function TeacherHeader({
  onMenuClick,
  user,
  unreadNotificationsCount = 5,
}: TeacherHeaderProps) {
  const [currentTime, setCurrentTime] = useState<string>('');
  const [showNotifications, setShowNotifications] = useState(false);
  const [showAccountModal, setShowAccountModal] = useState(false);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      // Format: Thursday, 22 May 2025 | 08:24 AM
      const options: Intl.DateTimeFormatOptions = {
        weekday: 'long',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
        timeZone: 'Africa/Lagos',
      };
      const formatted = new Intl.DateTimeFormat('en-GB', options).format(now);
      // Replace time separator string format to match design "Thursday, 22 May 2025 | 08:24 AM"
      const datePart = new Intl.DateTimeFormat('en-GB', {
        weekday: 'long',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        timeZone: 'Africa/Lagos',
      }).format(now);
      
      const timePart = new Intl.DateTimeFormat('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
        timeZone: 'Africa/Lagos',
      }).format(now);

      setCurrentTime(`${datePart} | ${timePart}`);
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const sampleNotifications = [
    {
      id: '1',
      title: 'Gate Alert: Chisom Adebayo Arrived',
      time: '2 mins ago',
      type: 'gate',
      unread: true,
    },
    {
      id: '2',
      title: 'New Message from Parent (Mrs. Okeke)',
      time: '15 mins ago',
      type: 'message',
      unread: true,
    },
    {
      id: '3',
      title: 'School Admin: Submit Attendance',
      time: '1 hour ago',
      type: 'admin',
      unread: true,
    },
    {
      id: '4',
      title: 'Safety Tip: Verify escort photo',
      time: '3 hours ago',
      type: 'safety',
      unread: false,
    },
    {
      id: '5',
      title: 'Sick Bay Update: Amara Okeke',
      time: 'Yesterday',
      type: 'medical',
      unread: false,
    },
  ];

  const teacherName = user?.full_name || 'Mrs. Grace!';

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-4 sm:px-6 lg:px-8 py-3 transition-all">
      <div className="flex items-center justify-between gap-4">
        {/* Left: Mobile Menu & Greeting */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onMenuClick}
            className="lg:hidden p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
            aria-label="Open sidebar"
          >
            <Menu size={22} />
          </button>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                Welcome back, {teacherName}
              </h1>
              <span className="text-xl">👋</span>
            </div>
            <p className="text-xs text-slate-500 font-medium hidden sm:block">
              Here's what's happening in your class today.
            </p>
          </div>
        </div>

        {/* Right: Date & Time Clock + Notifications + Role Switcher */}
        <div className="flex items-center gap-3 sm:gap-4">
          {/* Dynamic Live Date & Time Display (Matches Mockup) */}
          <div className="hidden md:flex flex-col items-end text-right">
            <span className="text-xs text-slate-400 font-medium">
              {currentTime.split('|')[0] || 'Lagos Time'}
            </span>
            <div className="flex items-center gap-1.5 text-base font-black text-slate-900 tracking-wide font-mono">
              <Clock size={15} className="text-emerald-600" />
              <span>{currentTime.split('|')[1] || '08:24 AM'}</span>
            </div>
          </div>

          {/* Notifications Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative p-2.5 rounded-full bg-slate-100/80 hover:bg-slate-200/80 text-slate-700 transition-all border border-slate-200/60"
              title="Notifications"
            >
              <Bell size={20} />
              {unreadNotificationsCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-extrabold rounded-full flex items-center justify-center px-1 shadow-sm animate-pulse">
                  {unreadNotificationsCount}
                </span>
              )}
            </button>

            {/* Notification Drawer Popover */}
            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="p-3.5 bg-slate-900 text-white flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Bell size={16} className="text-emerald-400" />
                    <h3 className="text-xs font-bold">Notifications ({unreadNotificationsCount})</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowNotifications(false)}
                    className="p-1 rounded-lg text-slate-400 hover:text-white"
                  >
                    <X size={16} />
                  </button>
                </div>

                <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
                  {sampleNotifications.map((notif) => (
                    <div
                      key={notif.id}
                      className={`p-3 text-xs flex items-start gap-3 transition-colors ${
                        notif.unread ? 'bg-emerald-50/50 font-medium' : 'bg-white'
                      }`}
                    >
                      <div className="p-2 rounded-xl bg-slate-100 text-slate-600 shrink-0 mt-0.5">
                        {notif.type === 'message' ? (
                          <MessageSquare size={14} className="text-emerald-600" />
                        ) : notif.type === 'gate' ? (
                          <ShieldAlert size={14} className="text-amber-600" />
                        ) : (
                          <Bell size={14} className="text-blue-600" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-slate-800 font-semibold leading-tight">{notif.title}</p>
                        <span className="text-[10px] text-slate-400 mt-1 block">{notif.time}</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="p-2 bg-slate-50 border-t border-slate-100 text-center">
                  <button
                    type="button"
                    onClick={() => setShowNotifications(false)}
                    className="text-[11px] font-bold text-emerald-700 hover:text-emerald-800"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Account Settings Trigger */}
          <button
            type="button"
            onClick={() => setShowAccountModal(true)}
            className="p-2.5 rounded-full bg-slate-100/80 hover:bg-slate-200/80 text-slate-700 transition-all border border-slate-200/60"
            title="Account Settings"
          >
            <KeyRound size={18} />
          </button>

          {/* Role Switcher */}
          <RoleSwitcher showLogout={false} />
        </div>
      </div>

      {showAccountModal && (
        <AccountSettingsModal onClose={() => setShowAccountModal(false)} />
      )}
    </header>
  );
}
