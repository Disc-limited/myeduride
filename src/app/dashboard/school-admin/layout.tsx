'use client';

import { useState } from 'react';
import { AdminSidebar } from '@/components/shared/AdminSidebar';
import { AdminHeader } from '@/components/shared/AdminHeader';
import { RouteGuard } from '@/components/shared/RouteGuard';

export default function SchoolAdminLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <RouteGuard requiredRole="school_admin">
      <div className="min-h-screen bg-slate-50 flex flex-col">
        {/* Sidebar */}
        <AdminSidebar
          mobileOpen={sidebarOpen}
          onMobileClose={() => setSidebarOpen(false)}
        />

        {/* Main Content Area */}
        <div className="lg:pl-64 flex-1 flex flex-col min-w-0">
          {/* Top Header */}
          <AdminHeader onMenuClick={() => setSidebarOpen((prev) => !prev)} />

          {/* Page Shell */}
          <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
            {children}
          </main>
        </div>
      </div>
    </RouteGuard>
  );
}
