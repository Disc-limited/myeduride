// @ts-nocheck
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSession } from '@/lib/api';
import { Shield, GraduationCap, Users, DoorOpen, User, ArrowRight, Bus } from 'lucide-react';

const LOGO_URL = '/images/eduride_logo.png';

export const dynamic = 'force-dynamic';

const ROLE_CONFIG: Record<string, { label: string; desc: string; href: string; icon: any; gradient: string }> = {
  super_admin: { label: 'Super Admin', desc: 'Manage all schools, students, and platform settings', href: '/dashboard/super-admin', icon: Shield, gradient: 'from-purple-500 to-indigo-600' },
  city_manager: { label: 'City Manager', desc: 'Approve escort applications and monitor city transit', href: '/dashboard/city-manager', icon: Shield, gradient: 'from-emerald-600 to-teal-700' },
  school_admin: { label: 'School Admin', desc: 'Manage your school, students, teachers, and reports', href: '/dashboard/school-admin', icon: GraduationCap, gradient: 'from-blue-500 to-cyan-600' },
  school_escort: { label: 'School Escort', desc: 'Manage school bus routes, student pickup manifest, and gate clearance', href: '/dashboard/escort', icon: Bus, gradient: 'from-blue-600 to-indigo-600' },
  escort: { label: 'School Escort', desc: 'Manage school bus routes, student pickup manifest, and gate clearance', href: '/dashboard/escort', icon: Bus, gradient: 'from-blue-600 to-indigo-600' },
  driver: { label: 'School Escort', desc: 'Manage school bus routes, student pickup manifest, and gate clearance', href: '/dashboard/escort', icon: Bus, gradient: 'from-blue-600 to-indigo-600' },
  portal_user: { label: 'School Escort', desc: 'Manage school bus routes, student pickup manifest, and gate clearance', href: '/dashboard/escort', icon: Bus, gradient: 'from-blue-600 to-indigo-600' },
  myeduride_escort: { label: 'MyEduRide Escort', desc: 'On-demand backup escort and emergency safety pool', href: '/dashboard/escort', icon: Shield, gradient: 'from-emerald-600 to-teal-700' },
  teacher: { label: 'Teacher', desc: 'View class attendance and manage student dismissals', href: '/dashboard/teacher', icon: Users, gradient: 'from-green-500 to-emerald-600' },
  gate_officer: { label: 'Gate Officer', desc: 'Scan and verify students at the school gate', href: '/dashboard/gate', icon: DoorOpen, gradient: 'from-orange-500 to-amber-600' },
  parent: { label: 'Parent', desc: 'View your children attendance and notifications', href: '/dashboard/parent', icon: User, gradient: 'from-pink-500 to-rose-600' },
  staff: { label: 'Staff', desc: 'View your sign-in history and attendance', href: '/dashboard/staff', icon: User, gradient: 'from-slate-500 to-slate-700' },
};

const FALLBACK_CONFIG = {
  label: 'School Escort',
  desc: 'Manage school bus routes, student pickup manifest, and gate clearance',
  href: '/dashboard/escort',
  icon: Bus,
  gradient: 'from-blue-600 to-indigo-600'
};

export default function DashboardRouter() {
  const [roles, setRoles] = useState<string[]>([]);
  const [mounted, setMounted] = useState(false);
  const [userName, setUserName] = useState('');
  const router = useRouter();
  const [schoolWelcome, setSchoolWelcome] = useState('');

  useEffect(() => {
    setMounted(true);
    const session = getSession();
    if (!session?.user_id) { 
      router.push('/auth/login'); 
      return; 
    }
    
    setUserName(session.full_name || '');
    const ps = session.primary_school;
    if (ps?.name) {
      let welcomeMsg = ps.welcome_message || `Welcome to ${ps.name}`;
      if (welcomeMsg.trim().startsWith('{') && welcomeMsg.trim().endsWith('}')) {
        try {
          const parsed = JSON.parse(welcomeMsg);
          welcomeMsg = parsed.welcomeText || parsed.welcome_message || welcomeMsg;
        } catch {}
      }
      setSchoolWelcome(welcomeMsg);
    }

    // Filter out undefined, empty, or unmapped array types safely (string or object format)
    let userRoles = [...new Set((session.roles || [])
      .map((r: any) => (typeof r === 'string' ? r : r?.role))
      .filter(Boolean)
    )] as string[];

    // Normalize escort/driver roles to school_escort for clear school transit identification
    userRoles = userRoles.map((r) => (r === 'driver' || r === 'escort' ? 'school_escort' : r));
    userRoles = [...new Set(userRoles)];

    // Super Admin accounts get access to all platform role dashboards
    if (userRoles.includes('super_admin')) {
      const allRoles = Object.keys(ROLE_CONFIG);
      userRoles = [...new Set(['super_admin', ...allRoles])];
    }

    if (userRoles.length === 0 || (userRoles.length === 1 && (userRoles.includes('school_escort') || userRoles.includes('portal_user')))) {
      router.push('/dashboard/escort');
      return;
    }

    if (userRoles.length === 1) {
      const singleRole = userRoles[0];
      const targetHref = ROLE_CONFIG[singleRole]?.href || '/dashboard/escort';
      router.push(targetHref);
      return;
    } else if (userRoles.includes('city_manager') && userRoles.length === 1) {
      router.push('/dashboard/city-manager');
      return;
    }

    setRoles(userRoles);
  }, [router]);

  if (!mounted || roles.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-primary-600">Loading your profile configuration...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 px-4 py-12">
      <div className="w-full max-w-lg">
        {/* Logo + greeting */}
        <div className="text-center mb-8">
          <img src={LOGO_URL} alt="MyEduRide" className="h-12 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900">Welcome back, {userName.split(' ')[0]}</h1>
          {schoolWelcome ? (
            <p className="text-primary-700 font-medium mt-1">{schoolWelcome}</p>
          ) : null}
          <p className="text-gray-500 mt-1">Choose how you want to continue</p>
        </div>

        {/* Role cards */}
        <div className="space-y-3">
          {roles.map((role) => {
            const config = ROLE_CONFIG[role] || FALLBACK_CONFIG;
            const IconComponent = config.icon || User;
            
            return (
              <button 
                key={role} 
                onClick={() => router.push(config.href)}
                className="w-full flex items-center gap-4 p-4 bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-primary-200 transition-all text-left group"
              >
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${config.gradient} flex items-center justify-center text-white shadow-sm`}>
                  <IconComponent size={22} />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-gray-900">{config.label}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{config.desc}</p>
                </div>
                <ArrowRight size={16} className="text-gray-300 group-hover:text-primary-500 transition-colors" />
              </button>
            );
          })}
        </div>

        <p className="text-center text-xs text-gray-400 mt-8">MyEduRide — The Student Safety Platform</p>
      </div>
    </div>
  );
}
