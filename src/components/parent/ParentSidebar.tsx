import { useState } from 'react';
import {
  LayoutDashboard,
  Users,
  ShieldAlert,
  Car,
  Wallet,
  BarChart3,
  MessageSquare,
  Bot,
  Settings,
  Phone,
  Gift,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  X,
  UserCheck,
  Sparkles,
  Navigation,
  Megaphone,
  CheckCircle2,
  MapPin,
  Clock,
  Camera,
  ArrowDownRight,
  CalendarCheck,
} from 'lucide-react';
import { toast } from 'sonner';

export type ParentTabType =
  | 'dashboard'
  | 'notices'
  | 'children'
  | 'attendance'
  | 'safety'
  | 'edrive'
  | 'wallet'
  | 'reports'
  | 'educhat'
  | 'migoai'
  | 'settings';

export type SafetyPillarTab = 'school_escort' | 'myeduride_escort' | 'shared_ride_escort' | 'edrive';

interface ParentSidebarProps {
  activeTab: ParentTabType;
  setActiveTab: (tab: ParentTabType) => void;
  activeSafetyPillar?: SafetyPillarTab;
  onSelectSafetyPillar?: (pillar: SafetyPillarTab) => void;
  unreadChatCount?: number;
  unreadNoticesCount?: number;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  isMobileDrawer?: boolean;
  onCloseMobileDrawer?: () => void;
}

export default function ParentSidebar({
  activeTab,
  setActiveTab,
  activeSafetyPillar = 'school_escort',
  onSelectSafetyPillar,
  unreadChatCount = 0,
  unreadNoticesCount = 1,
  isCollapsed = false,
  onToggleCollapse,
  isMobileDrawer = false,
  onCloseMobileDrawer,
}: ParentSidebarProps) {
  const [safetySubmenuOpen, setSafetySubmenuOpen] = useState(true);
  const [reportsSubmenuOpen, setReportsSubmenuOpen] = useState(true);

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    {
      id: 'safety',
      label: 'Safety Connect',
      icon: ShieldAlert,
      badge: 'Live',
      children: [
        { id: 'safety_hub', label: 'Safety Hub', pillar: 'school_escort' as SafetyPillarTab, icon: ShieldAlert },
        { id: 'school_escort', label: 'School Escort', pillar: 'school_escort' as SafetyPillarTab, icon: UserCheck },
        { id: 'escort_assigned', label: 'Escort Assigned', pillar: 'school_escort' as SafetyPillarTab, icon: CheckCircle2 },
        { id: 'live_location', label: 'Live Location', pillar: 'school_escort' as SafetyPillarTab, icon: MapPin },
        { id: 'history', label: 'History', pillar: 'school_escort' as SafetyPillarTab, icon: Clock },
        { id: 'myeduride_escort', label: 'MyEduRide Escort', pillar: 'myeduride_escort' as SafetyPillarTab, icon: Sparkles },
        { id: 'shared_ride_escort', label: 'Shared Ride Escort', pillar: 'shared_ride_escort' as SafetyPillarTab, icon: Car },
        { id: 'edrive', label: 'E-Drive Tracking', pillar: 'edrive' as SafetyPillarTab, icon: Navigation },
      ],
    },
    { id: 'notices', label: 'School Notices', icon: Megaphone, badge: unreadNoticesCount > 0 ? unreadNoticesCount : undefined },
    { id: 'children', label: 'My Children', icon: Users },
    { id: 'attendance', label: 'Attendance', icon: CalendarCheck },
    { id: 'wallet', label: 'Wallet', icon: Wallet },
    {
      id: 'reports',
      label: 'Reports',
      icon: BarChart3,
      children: [
        { id: 'gate_activity_report', label: 'Gate Activity Report', icon: Camera },
        { id: 'escort_movement_report', label: 'Escort Movement Report', icon: Car },
        { id: 'financial_report', label: 'Financial Report', icon: Wallet },
        { id: 'wallet_report', label: 'Wallet Report', icon: Wallet },
        { id: 'withdrawal_report', label: 'Withdrawal Report', icon: ArrowDownRight },
        { id: 'referral_report', label: 'Referral & Bonus Report', icon: Gift },
        { id: 'notifications_report', label: 'Notification Report', icon: Megaphone },
      ],
    },
    { id: 'educhat', label: 'EduChat', icon: MessageSquare, badge: unreadChatCount },
    { id: 'migoai', label: 'Migo AI', icon: Bot },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const handleItemClick = (id: string, label: string) => {
    if (id === 'wallet') {
      toast.info(`${label} is currently undergoing development`, {
        description: 'Stay tuned! Full functionality will be available in the upcoming release.',
        duration: 4000,
      });
      return;
    }
    if (id === 'safety') {
      setActiveTab('safety');
      setSafetySubmenuOpen(!safetySubmenuOpen);
      if (isMobileDrawer && onCloseMobileDrawer) onCloseMobileDrawer();
      return;
    }
    if (id === 'reports') {
      setActiveTab('reports');
      setReportsSubmenuOpen(!reportsSubmenuOpen);
      if (isMobileDrawer && onCloseMobileDrawer) onCloseMobileDrawer();
      return;
    }
    setActiveTab(id as ParentTabType);
    if (isMobileDrawer && onCloseMobileDrawer) onCloseMobileDrawer();
  };

  const handlePillarClick = (pillar: SafetyPillarTab) => {
    setActiveTab('safety');
    if (onSelectSafetyPillar) {
      onSelectSafetyPillar(pillar);
    }
    if (isMobileDrawer && onCloseMobileDrawer) onCloseMobileDrawer();
  };

  const content = (
    <aside
      className={`bg-[#061121] text-slate-300 h-screen max-h-screen overflow-y-auto sticky top-0 flex flex-col justify-between p-3 border-r border-slate-800/80 transition-all duration-300 relative z-30 shrink-0 ${
        isCollapsed ? 'w-20' : 'w-64'
      }`}
    >
      {/* Sidebar Top: Official Brand Logo Header */}
      <div>
        <div className="pb-3 mb-1.5 border-b border-slate-800/80">
          {!isCollapsed ? (
            <div className="flex items-center gap-2 px-1">
              <img
                src="/images/eduride_logo.png"
                alt="MyEduRide Brand Logo"
                className="h-9 sm:h-10 w-auto object-contain shrink-0 filter drop-shadow-sm"
              />
            </div>
          ) : (
            <div className="flex items-center justify-center">
              <img
                src="/images/eduride_logo.png"
                alt="MyEduRide Brand Logo"
                className="h-7 w-7 object-contain filter drop-shadow-sm"
              />
            </div>
          )}
        </div>

        {/* Floating Collapse Toggle Button */}
        {onToggleCollapse && !isMobileDrawer && (
          <button
            type="button"
            onClick={onToggleCollapse}
            className="absolute -right-3.5 top-14 z-40 w-7 h-7 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 hover:bg-slate-700 hover:text-white flex items-center justify-center shadow-lg transition-transform hover:scale-110"
            title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          >
            {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        )}

        {/* Mobile Drawer Close Button */}
        {isMobileDrawer && (
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800/80">
            <span className="text-xs font-extrabold text-white">Menu Navigation</span>
            <button
              type="button"
              onClick={onCloseMobileDrawer}
              className="p-1 rounded-lg text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Navigation Links */}
        <div className="space-y-1 pt-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            const hasChildren = Boolean(item.children && item.children.length > 0);
            const isSubOpen = item.id === 'safety' ? safetySubmenuOpen : item.id === 'reports' ? reportsSubmenuOpen : false;

            return (
              <div key={item.id} className="space-y-1">
                <button
                  type="button"
                  onClick={() => handleItemClick(item.id, item.label)}
                  className={`w-full flex items-center ${
                    isCollapsed ? 'justify-center px-0 py-2.5' : 'justify-between px-3 py-2'
                  } rounded-xl font-medium text-xs transition-all group ${
                    isActive
                      ? 'bg-emerald-600 text-white font-bold shadow-md shadow-emerald-900/40'
                      : 'hover:bg-slate-800/80 hover:text-white text-slate-400'
                  }`}
                  title={isCollapsed ? item.label : undefined}
                >
                  <div className={`flex items-center gap-2.5 ${isCollapsed ? 'justify-center' : ''}`}>
                    <Icon
                      className={`w-4 h-4 shrink-0 ${
                        isActive ? 'text-white' : 'text-slate-400 group-hover:text-white'
                      }`}
                    />
                    {!isCollapsed && <span>{item.label}</span>}
                  </div>
                  {!isCollapsed && (
                    <div className="flex items-center gap-1.5">
                      {item.badge ? (
                        typeof item.badge === 'number' ? (
                          item.badge > 0 ? (
                            <span className="bg-red-500 text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded-full">
                              {item.badge}
                            </span>
                          ) : null
                        ) : (
                          <span className="bg-emerald-500/20 text-emerald-300 text-[9px] font-black uppercase px-2 py-0.5 rounded-full border border-emerald-400/30">
                            {item.badge}
                          </span>
                        )
                      ) : null}
                      {hasChildren && (
                        isSubOpen ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                      )}
                    </div>
                  )}
                  {isCollapsed && item.badge ? (
                    <span className="absolute top-1 right-2 w-2 h-2 rounded-full bg-emerald-400" />
                  ) : null}
                </button>

                {/* Submenu for Safety Connect */}
                {hasChildren && isSubOpen && !isCollapsed && (
                  <div className="ml-5 pl-2.5 border-l border-slate-800 space-y-0.5 py-1">
                    {item.children?.map((child: any) => {
                      const ChildIcon = child.icon;
                      const isPillarSelected = child.pillar
                        ? activeTab === 'safety' && activeSafetyPillar === child.pillar
                        : activeTab === item.id;

                      return (
                        <button
                          key={child.id}
                          type="button"
                          onClick={() => {
                            if (child.pillar) {
                              handlePillarClick(child.pillar);
                            } else {
                              setActiveTab(item.id as ParentTabType);
                              if (onCloseMobileDrawer) onCloseMobileDrawer();
                              const el = document.getElementById(child.id);
                              if (el) el.scrollIntoView({ behavior: 'smooth' });
                            }
                          }}
                          className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all cursor-pointer ${
                            isPillarSelected
                              ? 'bg-slate-800/90 text-emerald-400 font-bold'
                              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850'
                          }`}
                        >
                          <ChildIcon className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">{child.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Sidebar Bottom Widgets */}
      <div className="space-y-2 pt-3 pb-1">
        {!isCollapsed ? (
          <>
            {/* Refer & Earn Banner Box */}
            <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950/80 border border-slate-800 rounded-2xl p-3 relative overflow-hidden shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block">
                    Refer & Earn
                  </span>
                  <p className="text-[10px] text-slate-300 font-medium mt-0.5 leading-snug">
                    Invite another family and earn ₦1,000 wallet credit.
                  </p>
                </div>
                <Gift className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              </div>
              <button
                type="button"
                onClick={() => {
                  toast.info('Refer & Earn Wallet feature is currently undergoing development');
                }}
                className="mt-2.5 w-full bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold py-1.5 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-sm"
              >
                <span>Invite Now</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            {/* 24/7 Support Box */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-2.5 flex items-center justify-between">
              <div>
                <p className="text-[9px] font-bold text-slate-400 uppercase">Need Help?</p>
                <p className="text-[10px] font-bold text-slate-200 mt-0.5">24/7 Support</p>
                <p className="text-[10px] font-extrabold text-emerald-400">0700 123 4567</p>
              </div>
              <a
                href="tel:07001234567"
                className="w-7 h-7 rounded-full bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white flex items-center justify-center transition-all"
                title="Call Support"
              >
                <Phone className="w-3.5 h-3.5" />
              </a>
            </div>
          </>
        ) : (
          /* Collapsed Mini Icons */
          <div className="space-y-2 flex flex-col items-center">
            <button
              type="button"
              onClick={() => {
                toast.info('Refer & Earn Wallet feature is currently undergoing development');
              }}
              className="w-9 h-9 rounded-xl bg-slate-800 text-emerald-400 flex items-center justify-center hover:bg-slate-700 transition-colors"
              title="Refer & Earn (₦1,000 Credit)"
            >
              <Gift className="w-4 h-4" />
            </button>
            <a
              href="tel:07001234567"
              className="w-9 h-9 rounded-xl bg-slate-800 text-emerald-400 flex items-center justify-center hover:bg-slate-700 transition-colors"
              title="Support: 0700 123 4567"
            >
              <Phone className="w-3.5 h-3.5" />
            </a>
          </div>
        )}
      </div>
    </aside>
  );

  // If Mobile Drawer, wrap with Dark Backdrop Overlay!
  if (isMobileDrawer) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex animate-in fade-in duration-200">
        <div className="relative w-64 max-w-[80vw] h-full shadow-2xl animate-in slide-in-from-left duration-200">
          {content}
        </div>
        <div className="flex-1" onClick={onCloseMobileDrawer} />
      </div>
    );
  }

  return content;
}
