'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { navigateBack } from '@/lib/navigation/smart-back';
import { ArrowLeft } from 'lucide-react';
import { getSession } from '@/lib/api';
import { AccountSettingsCard } from '@/components/shared/AccountSettingsCard';

export default function AccountSettingsPage() {
  const router = useRouter();

  useEffect(() => {
    if (!getSession()?.user_id) {
      router.replace('/auth/login');
    }
  }, [router]);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="w-full max-w-lg mx-auto">
        <button
          type="button"
          onClick={() => navigateBack(router, '/dashboard')}
          className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-4 cursor-pointer"
        >
          <ArrowLeft size={16} />
          Back
        </button>
        <div className="card">
          <AccountSettingsCard />
        </div>
      </div>
    </div>
  );
}
