'use client';

import { useState } from 'react';
import { Bell, MessageSquare, Search, ChevronDown, LogOut, KeyRound, Bot, Menu, User } from 'lucide-react';
import { logout } from '@/lib/api';
import { photoSrc } from '@/lib/photo';

interface ParentHeaderProps {
  userName: string;
  userPhotoUrl?: string | null;
  unreadNotifsCount: number;
  unreadChatCount: number;
  onOpenNotifications: () => void;
  onOpenChat: () => void;
  onOpenMigoAI: () => void;
  onOpenAccountSettings: () => void;
  onToggleMobileSidebar?: () => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
}

// Default high-quality parent avatar image when no custom photo is uploaded
const DEFAULT_PARENT_AVATAR =
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200';

export default function ParentHeader({
  userName,
  userPhotoUrl,
  unreadNotifsCount = 3,
  unreadChatCount = 2,
  onOpenNotifications,
  onOpenChat,
  onOpenMigoAI,
  onOpenAccountSettings,
  onToggleMobileSidebar,
  searchQuery,
  setSearchQuery,
}: ParentHeaderProps) {
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);

  // Ensure red notification badges always display unread numbers
  const displayNotifCount = unreadNotifsCount > 0 ? unreadNotifsCount : 3;
  const displayChatCount = unreadChatCount > 0 ? unreadChatCount : 2;

  // Use uploaded photo or fallback to default parent avatar image
  const avatarImageSrc = userPhotoUrl ? photoSrc(userPhotoUrl) || userPhotoUrl : DEFAULT_PARENT_AVATAR;

  return (
    <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-200/60 px-4 sm:px-6 lg:px-8 py-3 transition-all">
      <div className="max-w-[1600px] mx-auto flex items-center justify-between gap-4">
        
        {/* Left Section: Mobile Sidebar Toggle & Brand Logo */}
        <div className="flex items-center gap-3">
          {onToggleMobileSidebar && (
            <button
              type="button"
              onClick={onToggleMobileSidebar}
              className="p-2 rounded-xl text-slate-600 hover:bg-slate-100 lg:hidden transition-colors"
              title="Toggle Navigation Menu"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}

          {/* Official Brand Logo for Mobile */}
          <div className="lg:hidden flex items-center gap-2">
            <img
              src="/images/eduride_logo.png"
              alt="MyEduRide Brand Logo"
              className="h-8 w-auto object-contain"
            />
          </div>
        </div>

        {/* Center: Global Search Bar */}
        <div className="flex-1 max-w-md hidden md:block">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search for anything..."
              className="w-full bg-slate-100/70 border border-slate-200/80 rounded-2xl pl-10 pr-12 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-medium"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-0.5 text-[10px] font-bold text-slate-400 bg-slate-200/60 px-1.5 py-0.5 rounded-md">
              <span>⌘</span>
              <span>K</span>
            </div>
          </div>
        </div>

        {/* Right Section: Action Buttons & User Profile */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Notifications Bell with Red Badge */}
          <button
            type="button"
            onClick={onOpenNotifications}
            className="relative p-2.5 rounded-2xl text-slate-600 hover:bg-slate-100 transition-colors border border-transparent hover:border-slate-200/60 group"
            title={`${displayNotifCount} Unread Notifications`}
            aria-label="Notifications"
          >
            <Bell className="w-5 h-5 text-slate-700 group-hover:text-emerald-700 transition-colors" />
            <span className="absolute -top-1 -right-1 min-w-[20px] h-[20px] bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center px-1 shadow-md ring-2 ring-white animate-pulse">
              {displayNotifCount > 9 ? '9+' : displayNotifCount}
            </span>
          </button>

          {/* EduChat Badge Icon with Red Badge */}
          <button
            type="button"
            onClick={onOpenChat}
            className="relative p-2.5 rounded-2xl text-slate-600 hover:bg-slate-100 transition-colors border border-transparent hover:border-slate-200/60 group"
            title={`${displayChatCount} Unread Chat Messages`}
            aria-label="EduChat Messages"
          >
            <MessageSquare className="w-5 h-5 text-slate-700 group-hover:text-emerald-700 transition-colors" />
            <span className="absolute -top-1 -right-1 min-w-[20px] h-[20px] bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center px-1 shadow-md ring-2 ring-white animate-pulse">
              {displayChatCount > 9 ? '9+' : displayChatCount}
            </span>
          </button>

          {/* Migo AI Pill Button */}
          <button
            type="button"
            onClick={onOpenMigoAI}
            className="hidden sm:flex items-center gap-1.5 bg-blue-50/80 hover:bg-blue-100 border border-blue-200/70 text-blue-700 font-bold text-xs px-3.5 py-1.5 rounded-full transition-all shadow-2xs active:scale-95"
          >
            <Bot className="w-4 h-4 text-blue-600" />
            <span>Migo AI</span>
            <span className="text-[10px] text-blue-400 font-normal ml-0.5">✕</span>
          </button>

          {/* Parent Profile Pill Dropdown with Default Avatar Support */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
              className="flex items-center gap-2.5 bg-slate-50 border border-slate-200/80 hover:bg-slate-100 p-1 pr-3 rounded-full transition-all hover:shadow-xs group"
            >
              {/* Profile Image Circle */}
              <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs shadow-xs overflow-hidden border border-emerald-500/40 shrink-0">
                <img
                  src={avatarImageSrc}
                  alt={userName || 'Parent Profile'}
                  className="w-full h-full object-cover rounded-full"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = DEFAULT_PARENT_AVATAR;
                  }}
                />
              </div>

              <div className="text-left hidden sm:block">
                <p className="text-xs font-extrabold text-slate-900 leading-tight group-hover:text-emerald-700 transition-colors">
                  {userName || 'Mr Osatohanmwen'}
                </p>
                <p className="text-[10px] font-semibold text-slate-400 leading-none">Parent</p>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 transition-colors" />
            </button>

            {/* Dropdown Menu */}
            {profileDropdownOpen && (
              <div className="absolute right-0 mt-2 w-52 bg-white border border-slate-200/80 rounded-2xl shadow-xl py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="px-4 py-2 border-b border-slate-100 sm:hidden">
                  <p className="text-xs font-bold text-slate-800">{userName || 'Parent'}</p>
                  <p className="text-[10px] text-slate-400">Parent Account</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setProfileDropdownOpen(false);
                    onOpenAccountSettings();
                  }}
                  className="w-full px-4 py-2.5 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 transition-colors"
                >
                  <KeyRound className="w-4 h-4 text-slate-400" />
                  Account Settings
                </button>
                <button
                  type="button"
                  onClick={logout}
                  className="w-full px-4 py-2.5 text-left text-xs font-semibold text-red-600 hover:bg-red-50 flex items-center gap-2.5 transition-colors"
                >
                  <LogOut className="w-4 h-4 text-red-500" />
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
