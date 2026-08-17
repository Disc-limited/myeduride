'use client';

import { Suspense } from 'react';
import EscortRegistrationWizard from '@/components/auth/EscortRegistrationWizard';

export const dynamic = 'force-dynamic';

export default function RegisterEscortPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 text-slate-200 text-sm font-semibold">
          Loading Escort Registration...
        </div>
      }
    >
      <EscortRegistrationWizard />
    </Suspense>
  );
}
