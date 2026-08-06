'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  UserCheck,
  Car,
  MessageSquare,
  MessageCircle,
  Megaphone,
  FileText,
  ShieldCheck,
  Settings,
  Bot,
  ChevronDown,
  X,
  Sparkles,
  LogOut
} from 'lucide-react';
import StudentAvatar from '@/components/shared/StudentAvatar';
import { logout } from '@/lib/api';

interface TeacherSidebarProps {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
  user?: any;
  classNameName?: string;
  readyCount?: number;
  unreadMessagesCount?: number;
  announcementsCount?: number;
  activeSection?: string;
  onSelectSection?: (sectionId: string) => void;
  onOpenMigo?: () => void;
}

interface NavItem {
  id: string;
  label: string;
  href?: string;
  icon: React.ReactNode;
  badge?: number | string;
  badgeColor?: string;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

export function TeacherSidebar({
  mobileOpen = false,
  onMobileClose,
  user,
  classNameName = 'Primary 5 - Emerald',
  readyCount = 12,
  unreadMessagesCount = 8,
  announcementsCount = 3,
  activeSection = 'dashboard',
  onSelectSection,
  onOpenMigo,
}: TeacherSidebarProps) {
  const pathname = usePathname();
  const [classDropdownOpen, setClassDropdownOpen] = useState(false);

  const availableClasses = [
    'Primary 5 - Emerald',
    'Primary 5 - Diamond',
    'Primary 4 - Ruby',
  ];

  const handleNavClick = (sectionId: string, href?: string) => {
    if (onSelectSection) {
      onSelectSection(sectionId);
    }
    if (onMobileClose) {
      onMobileClose();
    }
  };

  const isNavActive = (sectionId: string, href?: string) => {
    if (href && href.startsWith('/dashboard/') && href !== '/dashboard/teacher') {
      return pathname === href || pathname.startsWith(href);
    }
    return activeSection === sectionId;
  };

  const navSections: NavSection[] = [
    {
      title: 'STUDENT SAFETY',
      items: [
        {
          id: 'my-students',
          label: 'My Students',
          icon: <Users size={18} />,
        },
        {
          id: 'attendance',
          label: 'Student Attendance',
          icon: <UserCheck size={18} />,
        },
        {
          id: 'ready-for-pickup',
          label: 'Ready for Pickup',
          icon: <Car size={18} />,
          badge: readyCount > 0 ? readyCount : undefined,
          badgeColor: 'bg-emerald-500 text-white',
        },
      ],
    },
    {
      title: 'COMMUNICATION',
      items: [
        {
          id: 'parent-messages',
          label: 'Parent Messages',
          icon: <MessageSquare size={18} />,
          badge: unreadMessagesCount > 0 ? unreadMessagesCount : undefined,
          badgeColor: 'bg-emerald-500 text-white',
        },
        {
          id: 'educhart',
          label: 'EduChart (Staff Chat)',
          href: '/dashboard/staff-chat',
          icon: <MessageCircle size={18} />,
        },
        {
          id: 'announcements',
          label: 'School Announcements',
          icon: <Megaphone size={18} />,
          badge: announcementsCount > 0 ? announcementsCount : undefined,
          badgeColor: 'bg-red-500 text-white',
        },
      ],
    },
    {
      title: 'REPORTS & SAFETY',
      items: [
        {
          id: 'safety-reports',
          label: 'Safety Reports',
          href: '/dashboard/teacher/reports',
          icon: <FileText size={18} />,
        },
        {
          id: 'students-released',
          label: 'Students Released',
          icon: <ShieldCheck size={18} />,
        },
      ],
    },
    {
      title: 'ACCOUNT',
      items: [
        {
          id: 'profile-settings',
          label: 'Profile Settings',
          href: '/dashboard/account',
          icon: <Settings size={18} />,
        },
      ],
    },
  ];

  return (
    <>
      {/* Mobile Drawer Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-slate-950/70 z-40 lg:hidden backdrop-blur-sm transition-opacity"
          onClick={onMobileClose}
        />
      )}

      {/* Sidebar Navigation Outer Shell */}
      <aside
        className={`fixed top-0 left-0 bottom-0 z-50 w-64 bg-[#061626] text-slate-200 flex flex-col transition-transform duration-300 ease-in-out border-r border-slate-800/80 shadow-2xl ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Brand Header */}
        <div className="p-4 flex items-center justify-between border-b border-slate-800/70 bg-[#040f1c]">
          <Link href="/dashboard/teacher" className="flex items-center group">
            <img
              src="/images/eduride_logo.png"
              alt="MyEduRide Logo"
              className="h-10 w-auto object-contain max-w-[180px]"
            />
          </Link>

          <button
            type="button"
            onClick={onMobileClose}
            className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X size={18} />
          </button>
        </div>

        {/* User Card & Class Selector */}
        <div className="p-3 border-b border-slate-800/60 bg-[#07192b]">
          <div className="flex items-center gap-3 mb-2.5">
            <StudentAvatar
              photoUrl={user?.avatar_url}
              firstName={user?.full_name?.split(' ')[0] || 'Mrs. Grace'}
              lastName={user?.full_name?.split(' ')[1] || 'Johnson'}
              size="md"
            />
            <div className="flex-1 min-w-0">
              <h4 className="text-xs font-bold text-white truncate">
                {user?.full_name || 'Mrs. Grace Johnson'}
              </h4>
              <span className="inline-block mt-0.5 px-2 py-0.5 text-[9px] font-extrabold bg-emerald-600/90 text-white rounded-full">
                Class Teacher
              </span>
            </div>
          </div>

          {/* Class Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setClassDropdownOpen(!classDropdownOpen)}
              className="w-full flex items-center justify-between px-3 py-1.5 bg-slate-900/90 border border-slate-700/70 rounded-xl text-xs font-semibold text-slate-200 hover:bg-slate-800 transition-colors"
            >
              <div className="flex items-center gap-2 truncate">
                <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0"></span>
                <span className="truncate">{classNameName}</span>
              </div>
              <ChevronDown size={14} className="text-slate-400 shrink-0" />
            </button>

            {classDropdownOpen && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-slate-900 border border-slate-700 rounded-xl shadow-xl z-20 overflow-hidden py-1">
                {availableClasses.map((cls) => (
                  <button
                    key={cls}
                    type="button"
                    onClick={() => {
                      setClassDropdownOpen(false);
                    }}
                    className={`w-full text-left px-3 py-1.5 text-xs font-medium transition-colors ${
                      cls === classNameName
                        ? 'bg-emerald-600/20 text-emerald-300 font-bold'
                        : 'text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    {cls}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Scrollable Navigation Body */}
        <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-4 custom-scrollbar text-xs font-semibold">
          {/* Main Dashboard Link */}
          <div>
            <button
              type="button"
              onClick={() => handleNavClick('dashboard')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all font-bold ${
                isNavActive('dashboard')
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-950/40'
                  : 'text-slate-300 hover:bg-slate-850 hover:text-white'
              }`}
            >
              <LayoutDashboard size={18} className="shrink-0" />
              <span>Dashboard</span>
            </button>
          </div>

          {/* Nav Sections */}
          {navSections.map((section) => (
            <div key={section.title} className="space-y-1">
              <p className="px-3 text-[10px] font-black tracking-widest text-slate-500 uppercase">
                {section.title}
              </p>
              <div className="space-y-0.5 mt-1">
                {section.items.map((item) => {
                  const active = isNavActive(item.id, item.href);

                  if (item.href) {
                    return (
                      <Link
                        key={item.id}
                        href={item.href}
                        onClick={onMobileClose}
                        className={`flex items-center justify-between gap-2.5 px-3 py-2 rounded-xl transition-colors ${
                          active
                            ? 'bg-slate-800 text-emerald-400 font-bold border-l-2 border-emerald-500 pl-2.5'
                            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="shrink-0">{item.icon}</span>
                          <span className="truncate">{item.label}</span>
                        </div>
                        {item.badge !== undefined && (
                          <span
                            className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded-full shrink-0 ${item.badgeColor}`}
                          >
                            {item.badge}
                          </span>
                        )}
                      </Link>
                    );
                  }

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleNavClick(item.id)}
                      className={`w-full flex items-center justify-between gap-2.5 px-3 py-2 rounded-xl transition-colors ${
                        active
                          ? 'bg-slate-800 text-emerald-400 font-bold border-l-2 border-emerald-500 pl-2.5'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="shrink-0">{item.icon}</span>
                        <span className="truncate">{item.label}</span>
                      </div>
                      {item.badge !== undefined && (
                        <span
                          className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded-full shrink-0 ${item.badgeColor}`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Bottom Section: Migo AI Card & Sign Out */}
        <div className="p-3 border-t border-slate-800/80 bg-[#040f1c] space-y-2.5">
          {/* Migo AI Card */}
          <div className="p-3 rounded-2xl bg-gradient-to-br from-slate-900 via-[#0a233c] to-slate-950 border border-slate-700/60 shadow-lg relative overflow-hidden group">
            <div className="flex items-center gap-2.5 mb-1.5">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center shrink-0">
                <Bot size={18} className="text-emerald-400" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1">
                  <span className="text-xs font-bold text-white">Migo</span>
                  <Sparkles size={11} className="text-amber-400" />
                </div>
                <span className="text-[9px] text-slate-400 block font-medium">
                  powered by SAVI Intelligence
                </span>
              </div>
            </div>
            <p className="text-[11px] text-slate-300 mb-2.5 leading-tight">
              Hi Grace! How can I assist you today?
            </p>
            <button
              type="button"
              onClick={onOpenMigo}
              className="w-full py-1.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-md active:scale-95"
            >
              <MessageCircle size={14} />
              <span>Chat with Migo</span>
            </button>
          </div>

          {/* Sign Out Button */}
          <button
            type="button"
            onClick={async () => {
              await logout();
              window.location.href = '/auth/login';
            }}
            className="w-full flex items-center gap-2 px-3 py-1.5 rounded-xl text-slate-400 hover:text-red-400 hover:bg-slate-850 transition-colors text-xs font-bold"
          >
            <LogOut size={15} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>
    </>
  );
}
