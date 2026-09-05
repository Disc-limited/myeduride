'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { getSession, saveSession } from '@/lib/api';
import { ChevronDown, Shield, GraduationCap, DoorOpen, Users, User, Check, KeyRound, UserCheck, Navigation, LayoutGrid } from 'lucide-react';
import Link from 'next/link';
import StudentAvatar from '@/components/shared/StudentAvatar';
import { photoSrc } from '@/lib/photo';

const ROLE_CONFIG: Record<string, { label: string; href: string; icon: React.ReactNode }> = {
  super_admin: { label: 'Super Admin', href: '/dashboard/super-admin', icon: <Shield size={14} /> },
  city_manager: { label: 'City Manager', href: '/dashboard/city-manager', icon: <Navigation size={14} /> },
  school_admin: { label: 'School Admin', href: '/dashboard/school-admin', icon: <GraduationCap size={14} /> },
  teacher: { label: 'Teacher', href: '/dashboard/teacher', icon: <Users size={14} /> },
  gate_officer: { label: 'Gate Officer', href: '/dashboard/gate', icon: <DoorOpen size={14} /> },
  parent: { label: 'Parent', href: '/dashboard/parent', icon: <User size={14} /> },
  staff: { label: 'Staff', href: '/dashboard/staff', icon: <User size={14} /> },
  escort: { label: 'Escort Officer', href: '/dashboard/escort', icon: <UserCheck size={14} /> },
};

type RoleSwitcherProps = {
  /** When false, sign out is not shown in the menu (use a separate logout control). */
  showLogout?: boolean;
  className?: string;
};

export function RoleSwitcher({ showLogout = true, className = '' }: RoleSwitcherProps) {
  const [open, setOpen] = useState(false);
  const [userRoles, setUserRoles] = useState<string[]>([]);
  const [mounted, setMounted] = useState(false);
  const [session, setSessionData] = useState<any>(null);
  const pathname = usePathname();

  useEffect(() => {
    setMounted(true);
    const s = getSession();
    setSessionData(s);
    if (!s?.user_id) return;
    if (s.roles?.length) {
      setUserRoles([...new Set(s.roles.map((r: any) => r.role))] as string[]);
    }

    const onSessionUpdated = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail) setSessionData(detail);
    };
    window.addEventListener('myeduride:session-updated', onSessionUpdated);
    return () => window.removeEventListener('myeduride:session-updated', onSessionUpdated);
  }, []);

  if (!mounted) return <div className={`w-9 h-9 rounded-full bg-gray-200 animate-pulse ${className}`} />;

  const currentRole =
    Object.keys(ROLE_CONFIG).find((r) => pathname.startsWith(ROLE_CONFIG[r].href)) || '';

  // Filter ROLE_CONFIG to show ONLY the roles that this user account actually possesses
  const rawRoles = (session?.roles || [])
    .map((r: any) => (typeof r === 'string' ? r : r?.role))
    .filter(Boolean);

  const assignedRoleSet = new Set(userRoles.length > 0 ? userRoles : rawRoles);
  if (assignedRoleSet.has('driver')) assignedRoleSet.add('escort');

  // Super Admin accounts or development mode have full platform access to switch to any dashboard
  if (assignedRoleSet.has('super_admin') || process.env.NODE_ENV === 'development') {
    Object.keys(ROLE_CONFIG).forEach((r) => assignedRoleSet.add(r));
  }

  const displayRoles = Object.keys(ROLE_CONFIG).filter((r) => assignedRoleSet.has(r));

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 p-0.5 rounded-full hover:bg-gray-100 transition-colors"
        aria-label="Switch account"
      >
        <StudentAvatar
          photoUrl={session?.avatar_url || session?.photo_url}
          fullName={session?.full_name}
          size="xs"
          className="w-9 h-9 text-xs ring-2 ring-emerald-500/30"
        />
        <ChevronDown size={14} className="text-gray-500 hidden sm:block" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-2 w-60 bg-white rounded-xl shadow-xl border border-slate-200 z-50 overflow-hidden">
            <div className="p-3 border-b bg-gray-50 flex items-center gap-3">
              <StudentAvatar
                photoUrl={session?.avatar_url || session?.photo_url}
                fullName={session?.full_name}
                size="sm"
              />
              <div className="min-w-0 flex-1">
                <p className="font-bold text-sm text-slate-900 truncate">{session?.full_name || 'Authorized User'}</p>
                <p className="text-xs text-slate-500 truncate">@{session?.username || session?.email || 'myeduride'}</p>
              </div>
            </div>

            <div className="p-2 space-y-0.5 max-h-64 overflow-y-auto custom-scrollbar">
              <p className="px-2 py-1 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                Switch Dashboard
              </p>
              {displayRoles.map((role) => {
                const config = ROLE_CONFIG[role];
                if (!config) return null;
                const isCurrent = role === currentRole;
                return (
                  <Link
                    key={role}
                    href={config.href}
                    onClick={() => {
                      setOpen(false);
                      if (session && typeof session === 'object') {
                        const currentRoles = Array.isArray(session.roles) ? [...session.roles] : [];
                        const hasThisRole = currentRoles.some((r: any) =>
                          typeof r === 'string' ? r === role : r?.role === role
                        );
                        if (!hasThisRole) {
                          currentRoles.unshift({ role, school_id: session.primary_school?.id || 'all' });
                          saveSession({ ...session, roles: currentRoles });
                        }
                      }
                    }}
                    className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-semibold transition-all ${
                      isCurrent
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200/80 shadow-xs'
                        : 'hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <span className={isCurrent ? 'text-emerald-600' : 'text-slate-400'}>
                      {config.icon}
                    </span>
                    <span className="flex-1">{config.label}</span>
                    {isCurrent && <Check size={14} className="text-emerald-600" />}
                  </Link>
                );
              })}
            </div>

            <div className="p-2 border-t border-slate-100 space-y-0.5">
              {displayRoles.length > 1 && (
                <Link
                  href="/dashboard"
                  onClick={() => setOpen(false)}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  <LayoutGrid size={14} className="text-emerald-600" />
                  <span>All Accounts & Roles</span>
                </Link>
              )}
              <Link
                href="/dashboard/account"
                onClick={() => setOpen(false)}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                <KeyRound size={14} className="text-slate-400" />
                <span>Account Settings</span>
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
