'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function CityManagerTasksApprovalsPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/dashboard/city-manager?section=tasks-approvals');
  }, [router]);

  return (
    <div className="p-8 text-center text-slate-400 font-medium animate-pulse">
      Loading Tasks & Approvals Portal...
    </div>
  );
}
