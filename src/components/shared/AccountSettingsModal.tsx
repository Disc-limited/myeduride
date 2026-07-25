'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { AccountSettingsCard } from '@/components/shared/AccountSettingsCard';
import { ProfileSettingsCard } from '@/components/shared/ProfileSettingsCard';

type Tab = 'profile' | 'security';

type AccountSettingsModalProps = {
  onClose: () => void;
};

export function AccountSettingsModal({ onClose }: AccountSettingsModalProps) {
  const [activeTab, setActiveTab] = useState<Tab>('profile');

  return (
    <div className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md relative max-h-[90vh] overflow-y-auto">
        {/* ── Header ─────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-900">Account settings</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* ── Tab strip ──────────────────────────────────────────────── */}
        <div className="flex gap-1 px-6 pt-4 pb-0">
          {(['profile', 'security'] as Tab[]).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={[
                'flex-1 py-1.5 text-sm font-medium rounded-lg transition-colors capitalize',
                activeTab === tab
                  ? 'bg-primary-50 text-primary-700'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50',
              ].join(' ')}
            >
              {tab === 'profile' ? 'Profile' : 'Security'}
            </button>
          ))}
        </div>

        {/* ── Tab content ────────────────────────────────────────────── */}
        <div className="px-6 py-5">
          {activeTab === 'profile' ? (
            <ProfileSettingsCard onSuccess={onClose} />
          ) : (
            <AccountSettingsCard onSuccess={onClose} />
          )}
        </div>
      </div>
    </div>
  );
}
