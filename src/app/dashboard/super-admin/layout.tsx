'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { RouteGuard } from '@/components/shared/RouteGuard';
import SuperAdminSidebar from '@/components/super-admin/SuperAdminSidebar';
import SuperAdminHeader from '@/components/super-admin/SuperAdminHeader';
import UnderDevelopment from '@/components/super-admin/UnderDevelopment';
import ParentsManagementView from '@/components/super-admin/ParentsManagementView';
import StudentsDirectoryView from '@/components/super-admin/StudentsDirectoryView';

const VIEW_TITLES: Record<string, string> = {
  'school-escorts': 'School Escorts',
  'shared-ride-escorts': 'Shared Ride Escorts',
  'executive-ride-escorts': 'Executive Ride Escorts',
  'fleet-owners': 'Fleet Owners',
  'school-staff': 'School Staff Management',
  'city-managers': 'City Managers',
  'general-city-managers': 'General City Managers',
  'disc-staff': 'DISC Staff Administration',
  'staff-admin': 'Staff Administration',
  'role-permissions': 'Role & Permission Centre',
  'operations-centre': 'Operations Centre',
  'financial-centre': 'Financial Centre',
  'invoice-management': 'Invoice Management',
  'wallet-admin': 'Wallet Administration',
  'edusave-admin': 'EduSave Administration',
  'eduinsured-admin': 'EduInsured Administration',
  'communication-centre': 'Communication Centre',
  'customer-support': 'Customer Support Centre',
  'city-management': 'City Management',
  'workflow-approval': 'Workflow & Approval Centre',
  'security-centre': 'Security Centre',
  'document-centre': 'Document Centre',
};

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const currentView = searchParams.get('view');

  const isUnderDevView = currentView && VIEW_TITLES[currentView];

  return (
    <RouteGuard requiredRole="super_admin">
      <div className="flex min-h-screen bg-slate-50 font-sans antialiased text-slate-900">
        {/* Left Sidebar */}
        <SuperAdminSidebar />

        {/* Main Content Area */}
        <div className="flex-1 md:ml-60 flex flex-col min-h-screen">
          <SuperAdminHeader />
          <main className="flex-1 p-4 sm:p-6 lg:p-8 w-full max-w-full mx-auto">
            {currentView === 'parents' ? (
              <ParentsManagementView />
            ) : currentView === 'students' ? (
              <StudentsDirectoryView />
            ) : isUnderDevView ? (
              <UnderDevelopment
                title={VIEW_TITLES[currentView] || 'Module'}
                onBack={() => router.push('/dashboard/super-admin')}
              />
            ) : (
              children
            )}
          </main>
        </div>
      </div>
    </RouteGuard>
  );
}
