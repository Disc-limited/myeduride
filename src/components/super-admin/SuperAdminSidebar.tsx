'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  Building2,
  Shield,
  Car,
  Truck,
  GraduationCap,
  Briefcase,
  UserCheck,
  Building,
  KeyRound,
  ShieldAlert,
  CreditCard,
  Wallet,
  Receipt,
  PiggyBank,
  HeartHandshake,
  MessageSquare,
  Headphones,
  MapPin,
  BarChart3,
  GitPullRequest,
  Lock,
  FileText,
  Settings,
  ChevronDown,
  ChevronRight,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  Menu,
  X,
} from 'lucide-react';

interface SidebarItem {
  id: string;
  label: string;
  icon: any;
  href?: string;
  viewKey?: string;
  badge?: string;
  isUnderDev?: boolean;
}

const USER_MANAGEMENT_ITEMS: SidebarItem[] = [
  { id: 'parents', label: 'Parents', icon: Users, viewKey: 'parents' },
  { id: 'schools', label: 'Schools', icon: Building2, href: '/dashboard/super-admin' },
  { id: 'school-escorts', label: 'School Escorts', icon: Shield, viewKey: 'school-escorts', isUnderDev: true },
  { id: 'shared-ride-escorts', label: 'Shared Ride Escorts', icon: Car, viewKey: 'shared-ride-escorts', isUnderDev: true },
  { id: 'executive-ride-escorts', label: 'Executive Ride Escorts', icon: Truck, viewKey: 'executive-ride-escorts', isUnderDev: true },
  { id: 'fleet-owners', label: 'Fleet Owners', icon: Briefcase, viewKey: 'fleet-owners', isUnderDev: true },
  { id: 'students', label: 'Students', icon: GraduationCap, viewKey: 'students' },
  { id: 'school-staff', label: 'School Staff', icon: UserCheck, viewKey: 'school-staff', isUnderDev: true },
  { id: 'city-managers', label: 'City Managers', icon: Building, viewKey: 'city-managers', isUnderDev: true },
  { id: 'general-city-managers', label: 'General City Managers', icon: Building, viewKey: 'general-city-managers', isUnderDev: true },
  { id: 'disc-staff', label: 'DISC Staff', icon: ShieldCheck, viewKey: 'disc-staff', isUnderDev: true },
];

const MAIN_NAV_ITEMS: SidebarItem[] = [
  { id: 'staff-admin', label: 'Staff Administration', icon: Briefcase, viewKey: 'staff-admin', isUnderDev: true },
  { id: 'role-permissions', label: 'Role & Permission Centre', icon: KeyRound, viewKey: 'role-permissions', isUnderDev: true },
  { id: 'operations-centre', label: 'Operations Centre', icon: ShieldAlert, viewKey: 'operations-centre', isUnderDev: true },
  { id: 'id-cards', label: 'DISC ID Card Centre', icon: CreditCard, href: '/dashboard/super-admin/id-cards' },
  { id: 'financial-centre', label: 'Financial Centre', icon: Wallet, viewKey: 'financial-centre', isUnderDev: true },
  { id: 'invoice-management', label: 'Invoice Management', icon: Receipt, viewKey: 'invoice-management', isUnderDev: true },
  { id: 'wallet-admin', label: 'Wallet Administration', icon: Wallet, viewKey: 'wallet-admin', isUnderDev: true },
  { id: 'edusave-admin', label: 'EduSave Administration', icon: PiggyBank, viewKey: 'edusave-admin', isUnderDev: true },
  { id: 'eduinsured-admin', label: 'EduInsured Administration', icon: HeartHandshake, viewKey: 'eduinsured-admin', isUnderDev: true },
  { id: 'communication-centre', label: 'Communication Centre', icon: MessageSquare, viewKey: 'communication-centre', isUnderDev: true },
  { id: 'customer-support', label: 'Customer Support Centre', icon: Headphones, viewKey: 'customer-support', isUnderDev: true },
  { id: 'city-management', label: 'City Management', icon: MapPin, viewKey: 'city-management', isUnderDev: true },
  { id: 'reports', label: 'Reports & Analytics', icon: BarChart3, href: '/dashboard/super-admin/reports' },
  { id: 'workflow-approval', label: 'Workflow & Approval Centre', icon: GitPullRequest, viewKey: 'workflow-approval', badge: 'New', isUnderDev: true },
  { id: 'security-centre', label: 'Security Centre', icon: Lock, viewKey: 'security-centre', isUnderDev: true },
  { id: 'document-centre', label: 'Document Centre', icon: FileText, viewKey: 'document-centre', isUnderDev: true },
  { id: 'system-settings', label: 'System Settings', icon: Settings, href: '/dashboard/super-admin/passwords' },
];

export default function SuperAdminSidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const currentView = searchParams.get('view');
  
  const [userMgmtOpen, setUserMgmtOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);

  const isExecutiveDashboard = pathname === '/dashboard/super-admin' && !currentView;

  const handleNavClick = (item: SidebarItem) => {
    setMobileOpen(false);
    if (item.href) {
      router.push(item.href);
    } else if (item.viewKey) {
      router.push(`/dashboard/super-admin?view=${item.viewKey}`);
    }
  };

  const renderNavButton = (item: SidebarItem, isSubItem = false) => {
    const Icon = item.icon;
    const isActive = item.href
      ? (pathname === item.href || (item.href !== '/dashboard/super-admin' && pathname.startsWith(item.href))) && !currentView
      : currentView === item.viewKey;

    return (
      <button
        key={item.id}
        type="button"
        onClick={() => handleNavClick(item)}
        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-[12px] font-medium transition-all ${
          isSubItem ? 'pl-8' : ''
        } ${
          isActive
            ? 'bg-emerald-600 text-white font-semibold shadow-xs'
            : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
        }`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <Icon size={isSubItem ? 15 : 17} className={isActive ? 'text-white' : 'text-slate-400'} />
          <span className="truncate">{item.label}</span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {item.badge && (
            <span className="bg-purple-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider">
              {item.badge}
            </span>
          )}
          {item.isUnderDev && !isActive && (
            <span className="w-1.5 h-1.5 rounded-full bg-slate-600" />
          )}
        </div>
      </button>
    );
  };

  const sidebarContent = (
    <div className="flex flex-col h-full bg-[#0b1928] text-white">
      {/* Top Logo & Platform Name */}
      <div className="p-4 border-b border-slate-800/80 bg-[#071324] flex items-center justify-between">
        <Link href="/dashboard/super-admin" className="flex items-center group">
          <img
            src="/images/eduride_logo.png"
            alt="MyEduRide"
            className="h-9 sm:h-10 w-auto object-contain max-w-[160px]"
          />
        </Link>
        <button
          type="button"
          className="md:hidden text-slate-400 hover:text-white"
          onClick={() => setMobileOpen(false)}
        >
          <X size={20} />
        </button>
      </div>

      {/* Navigation Links Scroll Container */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1.5 custom-scrollbar">
        {/* Executive Dashboard Header Pill */}
        <button
          type="button"
          onClick={() => {
            setMobileOpen(false);
            router.push('/dashboard/super-admin');
          }}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
            isExecutiveDashboard
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'bg-emerald-950/40 text-emerald-300 hover:bg-emerald-900/40 border border-emerald-800/40'
          }`}
        >
          <LayoutDashboard size={18} />
          <span>Executive Dashboard</span>
        </button>

        {/* User Management Section Accordion */}
        <div className="pt-2">
          <button
            type="button"
            onClick={() => setUserMgmtOpen(!userMgmtOpen)}
            className="w-full flex items-center justify-between px-3 py-2 text-[12px] font-semibold text-slate-300 hover:text-white transition-colors"
          >
            <div className="flex items-center gap-2.5">
              <Users size={17} className="text-slate-400" />
              <span>User Management</span>
            </div>
            {userMgmtOpen ? <ChevronDown size={15} className="text-slate-400" /> : <ChevronRight size={15} className="text-slate-400" />}
          </button>

          {userMgmtOpen && (
            <div className="mt-1 space-y-0.5">
              {USER_MANAGEMENT_ITEMS.map((item) => renderNavButton(item, true))}
            </div>
          )}
        </div>

        {/* Main Navigation Items */}
        <div className="pt-2 space-y-0.5 border-t border-slate-800/80">
          {MAIN_NAV_ITEMS.map((item) => renderNavButton(item))}
        </div>
      </div>

      {/* Bottom Company Branding Box */}
      <div className="p-3 border-t border-slate-800 bg-[#08121d]">
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-2.5 flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center shrink-0">
            <span className="text-[10px] font-bold text-emerald-400">DISC</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold text-slate-200 truncate leading-tight">
              DAISAF INDUSTRIAL SERVICES
            </p>
            <p className="text-[9px] text-slate-400 truncate leading-tight">
              COMPANY LIMITED (DISC)
            </p>
            <p className="text-[9px] text-emerald-400 font-mono leading-none mt-0.5">
              RC: 9561582
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Drawer Button */}
      <div className="md:hidden fixed bottom-4 right-4 z-40">
        <button
          type="button"
          onClick={() => setMobileOpen(!mobileOpen)}
          className="w-12 h-12 rounded-full bg-slate-900 text-white shadow-xl flex items-center justify-center border border-slate-700 active:scale-95 transition-transform"
        >
          <Menu size={22} />
        </button>
      </div>

      {/* Mobile Overlay */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/60 z-40 backdrop-blur-xs"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Desktop Fixed Sidebar */}
      <aside className="hidden md:block fixed left-0 top-0 bottom-0 w-60 z-30 shadow-xl">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer Sidebar */}
      <aside
        className={`md:hidden fixed left-0 top-0 bottom-0 w-64 z-50 transition-transform duration-300 ease-in-out ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {sidebarContent}
      </aside>
    </>
  );
}
