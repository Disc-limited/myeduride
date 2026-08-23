'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  School,
  UserCheck,
  Shield,
  Car,
  Navigation,
  MapPin,
  DoorOpen,
  FileCheck,
  AlertTriangle,
  Wallet,
  ArrowRightLeft,
  ArrowDownLeft,
  CreditCard,
  Gift,
  BarChart3,
  Settings,
  Sliders,
  UserPlus,
  Layers,
  Code2,
  LogOut,
  X,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Sparkles,
} from 'lucide-react';
import { logout } from '@/lib/api';

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  badge?: string;
  badgeColor?: string;
}

interface NavSection {
  title: string;
  items: (NavItem & { children?: NavItem[] })[];
}

export function AdminSidebar({
  mobileOpen = false,
  onMobileClose,
  isCollapsed = false,
  onToggleCollapse,
}: {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}) {
  const pathname = usePathname();
  const [openSubmenus, setOpenSubmenus] = useState<Record<string, boolean>>({
    Students: false,
    Staff: false,
    Reports: false,
  });

  const toggleSubmenu = (label: string) => {
    setOpenSubmenus((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  const navSections: NavSection[] = [
    {
      title: 'SCHOOL MANAGEMENT',
      items: [
        {
          label: 'Students',
          href: '/dashboard/school-admin/students',
          icon: <Users size={18} />,
          children: [
            { label: 'Student List', href: '/dashboard/school-admin/students', icon: <Users size={16} /> },
            { label: 'Add Student', href: '/dashboard/school-admin/students/new', icon: <Users size={16} /> },
          ],
        },
        { label: 'Classes', href: '/dashboard/school-admin/classes', icon: <School size={18} /> },
        {
          label: 'Staff',
          href: '/dashboard/school-admin/staff',
          icon: <GraduationCap size={18} />,
          children: [
            { label: 'Staff List', href: '/dashboard/school-admin/staff', icon: <GraduationCap size={16} /> },
            { label: 'Add Staff', href: '/dashboard/school-admin/staff/new', icon: <GraduationCap size={16} /> },
          ],
        },
      ],
    },
    {
      title: 'TRANSPORT & SAFETY',
      items: [
        { label: 'School Escort', href: '/dashboard/school-admin/escort/school-escort', icon: <UserCheck size={18} /> },
        { label: 'MyEduRide Escort', href: '/dashboard/school-admin/escort/myeduride-escort', icon: <Shield size={18} /> },
        { label: 'Live Vehicle Movement', href: '/dashboard/school-admin/live-tracking', icon: <Navigation size={18} /> },
        { label: 'Pickup List', href: '/dashboard/school-admin/pickup-persons', icon: <Car size={18} /> },
        { label: 'Vehicles', href: '/dashboard/school-admin/vehicles', icon: <Car size={18} /> },
        { label: 'Routes', href: '/dashboard/school-admin/routes', icon: <MapPin size={18} /> },
        { label: 'Gate Manager', href: '/dashboard/gate', icon: <DoorOpen size={18} /> },
        {
          label: 'Escort Verification Reports',
          href: '/dashboard/school-admin/reports/escort-verification',
          icon: <FileCheck size={18} />,
          badge: 'New',
          badgeColor: 'bg-emerald-500 text-white',
        },
        { label: 'Safety Incidents', href: '/dashboard/school-admin/incidents', icon: <AlertTriangle size={18} /> },
      ],
    },
    {
      title: 'WALLET',
      items: [
        { label: 'Wallet Overview', href: '/dashboard/school-admin/wallet', icon: <Wallet size={18} /> },
        { label: 'Transfer', href: '/dashboard/school-admin/wallet/transfer', icon: <ArrowRightLeft size={18} /> },
        { label: 'Withdrawal', href: '/dashboard/school-admin/wallet/withdrawal', icon: <ArrowDownLeft size={18} /> },
        { label: 'Subscription', href: '/dashboard/school-admin/wallet/subscription', icon: <CreditCard size={18} /> },
        { label: 'Reward Wallet', href: '/dashboard/school-admin/wallet/rewards', icon: <Gift size={18} /> },
      ],
    },
    {
      title: 'REPORTS',
      items: [
        {
          label: 'Reports',
          href: '/dashboard/school-admin/reports',
          icon: <BarChart3 size={18} />,
          children: [
            { label: 'Attendance Report', href: '/dashboard/school-admin/reports', icon: <BarChart3 size={16} /> },
            { label: 'Gate Activity Log', href: '/dashboard/school-admin/reports/gate-activities', icon: <DoorOpen size={16} /> },
            { label: 'Audit Log', href: '/dashboard/school-admin/audit', icon: <Shield size={16} /> },
          ],
        },
      ],
    },
    {
      title: 'SETTINGS',
      items: [
        { label: 'School Settings', href: '/dashboard/school-admin/settings', icon: <Settings size={18} /> },
        { label: 'Gate Settings', href: '/dashboard/school-admin/settings/gate-setup', icon: <Sliders size={18} /> },
        { label: 'Users & Roles', href: '/dashboard/school-admin/users', icon: <UserPlus size={18} /> },
        { label: 'Integrations', href: '/dashboard/school-admin/integrations', icon: <Layers size={18} /> },
        {
          label: 'API Settings',
          href: '/dashboard/school-admin/api-settings',
          icon: <Code2 size={18} />,
          badge: 'DISC Only',
          badgeColor: 'bg-amber-500 text-slate-950 font-bold',
        },
      ],
    },
  ];

  const [devNotice, setDevNotice] = useState<string | null>(null);

  const handleLinkClick = (_e: React.MouseEvent, _href: string, _label: string) => {
    onMobileClose?.();
  };

  const isLinkActive = (href: string) => {
    if (href === '/dashboard/school-admin') return pathname === href;
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <>
      {/* Dev Notice Banner */}
      {devNotice && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] bg-slate-900 text-amber-400 px-5 py-3 rounded-2xl shadow-2xl border border-amber-500/50 flex items-center gap-3 animate-bounce">
          <AlertTriangle size={18} className="shrink-0 text-amber-400" />
          <span className="text-xs font-black text-white">{devNotice}</span>
          <button
            type="button"
            onClick={() => setDevNotice(null)}
            className="ml-2 text-slate-400 hover:text-white"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-slate-950/70 z-40 lg:hidden backdrop-blur-sm transition-opacity"
          onClick={onMobileClose}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 left-0 bottom-0 z-50 ${isCollapsed ? 'w-20' : 'w-64'} bg-[#0B192C] text-slate-300 flex flex-col transition-all duration-300 ease-in-out border-r border-slate-800/80 shadow-2xl ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Floating Collapse Toggle Button */}
        {onToggleCollapse && (
          <button
            type="button"
            onClick={onToggleCollapse}
            className="hidden lg:flex absolute -right-3.5 top-16 z-50 w-7 h-7 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 hover:bg-slate-700 hover:text-white items-center justify-center shadow-lg transition-transform hover:scale-110"
            title={isCollapsed ? 'Expand Full View' : 'Collapse Sidebar'}
          >
            {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        )}
        {/* Top Logo & Brand Area */}
        <div className="p-4 sm:p-5 flex items-center justify-between border-b border-slate-800/70 bg-[#071324]">
          <Link href="/dashboard/school-admin" className="flex flex-col gap-1 group">
            <img
              src="/images/eduride_logo.png"
              alt="MyEduRide"
              className="h-10 sm:h-11 w-auto object-contain max-w-[170px]"
            />
            <span className="text-[9px] font-bold tracking-widest text-slate-400 uppercase">
              THE STUDENT SAFETY PLATFORM
            </span>
            <div className="mt-0.5 flex items-center gap-1 text-[10px] font-bold text-slate-300 bg-slate-800/90 px-2 py-0.5 rounded-md border border-slate-750 max-w-max">
              <span>Powered by</span>
              <span className="text-amber-400 font-extrabold tracking-wider">DISC</span>
            </div>
          </Link>

          {/* Close button for mobile drawer */}
          <button
            type="button"
            onClick={onMobileClose}
            className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Navigation Items */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6 custom-scrollbar text-xs font-semibold">
          {/* Main Dashboard Link */}
          <div>
            <Link
              href="/dashboard/school-admin"
              onClick={onMobileClose}
              className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all font-bold ${
                isLinkActive('/dashboard/school-admin')
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-950/40'
                  : 'text-slate-300 hover:bg-slate-850 hover:text-white'
              }`}
            >
              <LayoutDashboard size={18} className="shrink-0" />
              <span className="flex-1">Dashboard</span>
            </Link>
          </div>

          {/* Grouped Section Links */}
          {navSections.map((section) => (
            <div key={section.title} className="space-y-1">
              <p className="px-3 text-[10px] font-black tracking-widest text-slate-500 uppercase">
                {section.title}
              </p>

              <div className="space-y-0.5 mt-1.5">
                {section.items.map((item) => {
                  const active = isLinkActive(item.href);
                  const hasChildren = item.children && item.children.length > 0;
                  const isSubOpen = openSubmenus[item.label];

                  return (
                    <div key={item.label}>
                      {hasChildren ? (
                        <div>
                          <button
                            type="button"
                            onClick={() => toggleSubmenu(item.label)}
                            className={`w-full flex items-center justify-between gap-2.5 px-3 py-2 rounded-xl transition-colors ${
                              active
                                ? 'bg-slate-800/90 text-emerald-400'
                                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span className="shrink-0">{item.icon}</span>
                              <span className="truncate">{item.label}</span>
                            </div>
                            {isSubOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          </button>

                          {isSubOpen && (
                            <div className="ml-7 mt-1 pl-2 border-l border-slate-800 space-y-1">
                              {item.children?.map((child) => (
                                <Link
                                  key={child.label}
                                  href={child.href}
                                  onClick={(e) => handleLinkClick(e, child.href, child.label)}
                                  className={`block px-3 py-1.5 rounded-lg text-[11px] transition-colors ${
                                    pathname === child.href
                                      ? 'text-emerald-400 font-bold bg-slate-800/60'
                                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850'
                                  }`}
                                >
                                  {child.label}
                                </Link>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : (
                        <Link
                          href={item.href}
                          onClick={(e) => handleLinkClick(e, item.href, item.label)}
                          className={`flex items-center justify-between gap-2.5 px-3 py-2 rounded-xl transition-colors ${
                            active
                              ? 'bg-slate-800/90 text-emerald-400 font-bold border-l-2 border-emerald-500 pl-2.5'
                              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="shrink-0">{item.icon}</span>
                            <span className="truncate">{item.label}</span>
                          </div>
                          {item.badge && (
                            <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${item.badgeColor}`}>
                              {item.badge}
                            </span>
                          )}
                        </Link>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Bottom Section: DISC Premium Services Card & Sign Out */}
        <div className="p-3 border-t border-slate-800/80 bg-[#071324] space-y-3">
          {/* DISC Premium Card */}
          <div className="p-3.5 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 shadow-md">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-extrabold text-amber-400 uppercase tracking-wide">
                DISC Premium Services
              </span>
              <Sparkles size={14} className="text-amber-400" />
            </div>
            <p className="text-[10px] text-slate-400 leading-snug mb-3">
              Smart solutions for safer schools
            </p>
            <button
              type="button"
              className="w-full py-1.5 px-3 bg-[#0B192C] hover:bg-slate-800 text-white border border-slate-700 rounded-xl text-[11px] font-bold flex items-center justify-between transition-colors shadow-sm"
            >
              <span>Learn More</span>
              <span className="px-1.5 py-0.5 bg-amber-400 text-slate-950 text-[9px] font-black rounded">
                DISC
              </span>
            </button>
          </div>

          {/* Sign Out Button */}
          <button
            type="button"
            onClick={async () => {
              await logout();
              window.location.href = '/auth/login';
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-400 hover:text-red-400 hover:bg-slate-850 transition-colors text-xs font-bold"
          >
            <LogOut size={16} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>
    </>
  );
}
