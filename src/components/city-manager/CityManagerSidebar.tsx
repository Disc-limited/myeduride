'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  LayoutDashboard,
  Radio,
  School,
  UserCheck,
  Car,
  DoorOpen,
  Navigation,
  AlertTriangle,
  ClipboardList,
  MessageSquare,
  BarChart3,
  CheckSquare,
  Award,
  Settings,
  Shield,
  X,
  ChevronLeft,
  ChevronRight,
  Bot,
  Sparkles,
  Phone,
  LogOut,
  ChevronDown,
} from 'lucide-react';
import { logout } from '@/lib/api';

interface CityManagerSidebarProps {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  activeSection?: string;
  onSelectSection?: (sectionId: string) => void;
}

export function CityManagerSidebar({
  mobileOpen = false,
  onMobileClose,
  isCollapsed = false,
  onToggleCollapse,
  activeSection = 'dashboard',
  onSelectSection,
}: CityManagerSidebarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  const [pendingCount, setPendingCount] = useState<number>(0);
  const [openSubmenus, setOpenSubmenus] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetch('/api/escorts/applications')
      .then((res) => res.json())
      .then((data) => {
        if (data?.applications && Array.isArray(data.applications)) {
          const pending = data.applications.filter(
            (a: any) => a.status === 'PENDING_CITY_MANAGER_REVIEW' || !a.status || a.status === 'PENDING'
          ).length;
          setPendingCount(pending);
        }
      })
      .catch(() => {});
  }, []);

  const sectionParam = searchParams?.get('section') || searchParams?.get('tab');
  const currentActiveSection = sectionParam || (pathname?.includes('tasks-approvals') ? 'tasks-approvals' : activeSection || 'dashboard');

  const toggleSubmenu = (key: string) => {
    setOpenSubmenus((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'live-operations', label: 'Live Operations', icon: Radio },
    { id: 'schools', label: 'Schools', icon: School, hasChildren: true },
    { id: 'escorts', label: 'Escorts', icon: UserCheck, hasChildren: true },
    { id: 'vehicles', label: 'Vehicles', icon: Car, hasChildren: true },
    { id: 'gate-monitor', label: 'Gate Monitor', icon: DoorOpen, hasChildren: true },
    { id: 'trips-management', label: 'Trips Management', icon: Navigation },
    { id: 'safety-incidents', label: 'Safety & Incidents', icon: AlertTriangle, badge: '2', badgeColor: 'bg-red-500 text-white' },
    { id: 'assignments', label: 'Assignments', icon: ClipboardList },
    { id: 'communication', label: 'Communication', icon: MessageSquare, badge: 'NEW', badgeColor: 'bg-emerald-500 text-white font-black' },
    { id: 'reports-analytics', label: 'Reports & Analytics', icon: BarChart3 },
    { id: 'tasks-approvals', label: 'Tasks & Approvals', icon: CheckSquare, badge: String(pendingCount), badgeColor: 'bg-amber-500 text-slate-950 font-extrabold' },
    { id: 'performance', label: 'Performance', icon: Award },
    { id: 'settings-access', label: 'Settings & Access', icon: Settings },
    { id: 'audit-logs', label: 'Audit Logs', icon: Shield },
  ];

  const handleNavClick = (id: string) => {
    if (onSelectSection) onSelectSection(id);
    router.push(`/dashboard/city-manager?section=${id}`);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('section', id);
      window.history.pushState({}, '', url.toString());
      window.dispatchEvent(new Event('popstate'));
    }
    if (onMobileClose) onMobileClose();
  };

  return (
    <>
      {/* Mobile Drawer Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-slate-950/70 z-40 lg:hidden backdrop-blur-sm transition-opacity"
          onClick={onMobileClose}
        />
      )}

      {/* Sidebar Outer Shell */}
      <aside
        className={`fixed top-0 left-0 bottom-0 z-50 ${
          isCollapsed ? 'w-20' : 'w-64'
        } bg-[#061426] text-slate-200 flex flex-col transition-all duration-300 ease-in-out border-r border-slate-800/80 shadow-2xl ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Floating Toggle Button */}
        {onToggleCollapse && (
          <button
            type="button"
            onClick={onToggleCollapse}
            className="hidden lg:flex absolute -right-3.5 top-14 z-50 w-7 h-7 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 hover:bg-slate-700 hover:text-white items-center justify-center shadow-lg transition-transform hover:scale-110"
            title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          >
            {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        )}

        {/* Brand Header */}
        <div className="p-4 flex items-center justify-between border-b border-slate-800/70 bg-[#040e1c]">
          <Link href="/dashboard/city-manager" className="flex items-center gap-2 group">
            <img
              src="/images/eduride_logo.png"
              alt="MyEduRide Logo"
              className={`w-auto object-contain transition-all ${isCollapsed ? 'h-7' : 'h-10 max-w-[170px]'}`}
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

        {/* Navigation Body */}
        <nav className="flex-1 overflow-y-auto px-2.5 py-4 space-y-1 custom-scrollbar text-xs font-semibold">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentActiveSection === item.id;
            return (
              <div key={item.id}>
                <button
                  type="button"
                  onClick={() => handleNavClick(item.id)}
                  className={`w-full flex items-center ${
                    isCollapsed ? 'justify-center px-0 py-2.5' : 'justify-between px-3 py-2.5'
                  } rounded-xl font-semibold text-xs transition-all group ${
                    isActive
                      ? 'bg-emerald-600 text-white font-bold shadow-md shadow-emerald-950/40'
                      : 'text-slate-300 hover:bg-slate-850 hover:text-white'
                  }`}
                  title={isCollapsed ? item.label : undefined}
                >
                  <div className={`flex items-center gap-3 min-w-0 ${isCollapsed ? 'justify-center' : ''}`}>
                    <Icon size={18} className={`shrink-0 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-white'}`} />
                    {!isCollapsed && <span className="truncate">{item.label}</span>}
                  </div>

                  {!isCollapsed && (
                    <div className="flex items-center gap-1 shrink-0">
                      {item.badge && (
                        <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${item.badgeColor}`}>
                          {item.badge}
                        </span>
                      )}
                      {item.hasChildren && <ChevronDown size={14} className="text-slate-400" />}
                    </div>
                  )}
                </button>
              </div>
            );
          })}
        </nav>

        {/* Bottom Widgets */}
        <div className="p-3 border-t border-slate-800/80 bg-[#040e1c] space-y-3 shrink-0">
          {!isCollapsed ? (
            <>
              {/* Migo AI Assistant Box */}
              <div className="p-3 rounded-2xl bg-gradient-to-br from-slate-900 via-[#092238] to-slate-950 border border-slate-700/60 shadow-md relative overflow-hidden">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-6 h-6 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center shrink-0">
                    <Bot size={14} className="text-emerald-400" />
                  </div>
                  <span className="text-xs font-bold text-white flex items-center gap-1">
                    MIGO AI ASSISTANT <Sparkles size={10} className="text-amber-400" />
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 leading-none">Powered by SAVI</p>
              </div>

              {/* DISC Operations Support Card */}
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2.5 min-w-0">
                  <Phone size={18} className="text-amber-400 shrink-0" />
                  <div className="min-w-0">
                    <span className="text-[9px] font-extrabold text-slate-400 uppercase block leading-none">
                      DISC OPERATIONS
                    </span>
                    <span className="text-xs font-black text-amber-400 block mt-0.5 tracking-wider">
                      0809 123 4567
                    </span>
                    <span className="text-[9px] font-bold text-slate-400 leading-none">
                      24/7 Support Line
                    </span>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-slate-800 text-amber-400 flex items-center justify-center shadow-xs" title="DISC Support: 0809 123 4567">
                <Phone size={16} />
              </div>
            </div>
          )}

          {/* Sign Out Button */}
          <button
            type="button"
            onClick={async () => {
              await logout();
              window.location.href = '/auth/login';
            }}
            className={`w-full flex items-center ${isCollapsed ? 'justify-center' : 'gap-2 px-3'} py-2 rounded-xl text-slate-400 hover:text-red-400 hover:bg-slate-850 transition-colors text-xs font-bold`}
            title="Sign Out"
          >
            <LogOut size={16} />
            {!isCollapsed && <span>Sign Out</span>}
          </button>
        </div>
      </aside>
    </>
  );
}
