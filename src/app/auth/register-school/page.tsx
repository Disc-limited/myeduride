import { Suspense } from 'react';
import SchoolRegistrationWizard from '@/components/auth/SchoolRegistrationWizard';

export const dynamic = 'force-dynamic';

export default function RegisterSchoolPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white font-poppins">
          <div className="text-center space-y-2">
            <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-sm text-slate-300">Loading School Registration...</p>
          </div>
        </div>
      }
    >
      <SchoolRegistrationWizard />
    </Suspense>
  );
}
