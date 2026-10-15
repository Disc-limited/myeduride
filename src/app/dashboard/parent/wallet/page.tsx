'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ParentWalletPage() {
  const router = useRouter();

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const search = window.location.search || '';
      const params = new URLSearchParams(search);
      params.set('tab', 'wallet');
      router.replace(`/dashboard/parent?${params.toString()}`);
    }
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-semibold text-slate-500">Opening Parent Wallet...</p>
      </div>
    </div>
  );
}
