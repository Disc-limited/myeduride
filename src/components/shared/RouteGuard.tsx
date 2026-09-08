'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSession } from '@/lib/api';

interface Props {
  requiredRole: string | string[];
  children: React.ReactNode;
}

export function RouteGuard({ requiredRole, children }: Props) {
  const [authorized, setAuthorized] = useState(false);
  const [checking, setChecking] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const session = getSession();
    
    // No session at all — in development mode, allow instant preview instead of blocking
    if (!session?.user_id) {
      if (process.env.NODE_ENV === 'development') {
        setAuthorized(true);
        setChecking(false);
        return;
      }
      router.replace('/auth/login');
      return;
    }

    // Get roles from cookie (no API call — instant)
    const roles = (session.roles || []).map((r: any) => r.role);

    // Super admin can access everything
    if (roles.includes('super_admin')) {
      setAuthorized(true);
      setChecking(false);
      return;
    }

    // Check if user has any of the required roles
    const requiredRoles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
    const hasRole = roles.some((r: string) => requiredRoles.includes(r));
    if (hasRole || process.env.NODE_ENV === 'development') {
      setAuthorized(true);
      setChecking(false);
      return;
    }

    // User doesn't have this role — redirect to their first available role
    if (roles.length > 0) {
      const roleToPath: Record<string, string> = {
        super_admin: '/dashboard/super-admin',
        city_manager: '/dashboard/city-manager',
        school_admin: '/dashboard/school-admin',
        teacher: '/dashboard/teacher',
        gate_officer: '/dashboard/gate',
        gate_manager: '/dashboard/gate',
        security_officer: '/dashboard/gate',
        parent: '/dashboard/parent',
        staff: '/dashboard/staff',
        escort: '/dashboard/escort',
        school_escort: '/dashboard/escort',
        myeduride_escort: '/dashboard/myeduride-escort',
        driver: '/dashboard/myeduride-escort',
      };
      router.replace(roleToPath[roles[0]] || '/dashboard');
    } else {
      // No roles but has session — don't log out, just go to dashboard
      router.replace('/dashboard');
    }
  }, [requiredRole, router]);

  if (checking) {
    return <div className="min-h-screen flex items-center justify-center"><div className="animate-pulse text-primary-600">Loading...</div></div>;
  }

  if (!authorized) return null;

  return <>{children}</>;
}
