// @ts-nocheck
'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import ParentRegistrationWizard from '@/components/auth/ParentRegistrationWizard';
import EscortRegistrationWizard from '@/components/auth/EscortRegistrationWizard';
import SchoolRegistrationWizard from '@/components/auth/SchoolRegistrationWizard';

export const dynamic = 'force-dynamic';

function RegisterContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialRole = searchParams.get('role');
  const mode = searchParams.get('mode');

  const [mounted, setMounted] = useState(false);
  const [role, setRole] = useState<'parent' | 'school' | 'driver'>('parent');

  useEffect(() => {
    setMounted(true);
    if (mode === 'correction' || initialRole === 'driver' || initialRole === 'escort' || initialRole === 'fleet') {
      setRole('driver');
    } else if (initialRole === 'school') {
      setRole('school');
    } else {
      setRole('parent');
    }
  }, [initialRole, mode]);

  const handleRoleChange = (newRole: any) => {
    const targetRole = newRole === 'fleet' ? 'driver' : newRole;
    setRole(targetRole);
    router.replace(`/auth/register?role=${newRole}`, { scroll: false });
  };

  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white font-poppins">
        <div className="text-center space-y-2">
          <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-slate-300">Loading Registration...</p>
        </div>
      </div>
    );
  }

  if (role === 'driver' || role === 'escort') {
    return <EscortRegistrationWizard onSwitchRole={handleRoleChange} />;
  }

  if (role === 'school') {
    return <SchoolRegistrationWizard onSwitchRole={handleRoleChange} />;
  }

  return <ParentRegistrationWizard onSwitchRole={handleRoleChange} />;
}

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white font-poppins">
          <div className="text-center space-y-2">
            <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-sm text-slate-300">Loading Registration...</p>
          </div>
        </div>
      }
    >
      <RegisterContent />
    </Suspense>
  );
}
