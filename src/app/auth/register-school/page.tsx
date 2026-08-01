'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function RegisterSchoolRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/auth/register?role=school');
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white font-poppins">
      <div className="text-center space-y-2">
        <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm text-slate-300">Redirecting to Sign Up...</p>
      </div>
    </div>
  );
}
