'use client';

import {
  LayoutDashboard,
  Radio,
  ShieldCheck,
  BarChart3,
  Menu,
  MessageSquare,
  Users,
} from 'lucide-react';
import { ParentTabType } from './ParentSidebar';

interface ParentMobileBottomNavProps {
  activeTab: ParentTabType;
  setActiveTab: (tab: ParentTabType) => void;
  onOpenMobileMenu: () => void;
  unreadChatCount?: number;
}

export default function ParentMobileBottomNav({
  activeTab,
  setActiveTab,
  onOpenMobileMenu,
  unreadChatCount = 0,
}: ParentMobileBottomNavProps) {
  const navItems = [
    {
      id: 'dashboard' as ParentTabType,
      label: 'Dashboard',
      icon: LayoutDashboard,
    },
    {
      id: 'live' as ParentTabType,
      label: 'Live',
      icon: Radio,
      badge: 'LIVE',
    },
    {
      id: 'safety' as ParentTabType,
      label: 'Safety',
      icon: ShieldCheck,
    },
    {
      id: 'reports' as ParentTabType,
      label: 'Reports',
      icon: BarChart3,
    },
    {
      id: 'more',
      label: 'Menu',
      icon: Menu,
    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/90 px-3 py-1.5 lg:hidden shadow-[0_-4px_20px_rgba(0,0,0,0.06)]">
      <div className="flex items-center justify-around max-w-lg mx-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = item.id === 'more' ? false : activeTab === item.id;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                if (item.id === 'more') {
                  onOpenMobileMenu();
                } else {
                  setActiveTab(item.id as ParentTabType);
                }
              }}
              className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-2xl transition-all cursor-pointer relative min-w-[56px] ${
                isActive
                  ? 'text-emerald-700 font-black scale-105'
                  : 'text-slate-500 hover:text-slate-900 font-semibold'
              }`}
            >
              {/* Badge for Live or Chat */}
              {item.badge && (
                <span className="absolute -top-1 right-2 bg-emerald-500 text-white text-[8px] font-black px-1.5 py-0.2 rounded-full animate-pulse shadow-xs">
                  {item.badge}
                </span>
              )}

              <div
                className={`p-1 rounded-xl transition-all ${
                  isActive ? 'bg-emerald-50 text-emerald-700' : ''
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5]' : 'stroke-[1.8]'}`} />
              </div>
              <span className="text-[10px] tracking-tight mt-0.5">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
