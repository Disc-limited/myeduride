'use client';

import { useState } from 'react';
import { AdminSidebar } from '@/components/shared/AdminSidebar';
import { AdminHeader } from '@/components/shared/AdminHeader';
import { RouteGuard } from '@/components/shared/RouteGuard';

export default function SchoolAdminLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <RouteGuard requiredRole="school_admin">
      <div className="min-h-screen bg-slate-50 flex flex-col">
        {/* Sidebar */}
        <AdminSidebar
          mobileOpen={sidebarOpen}
          onMobileClose={() => setSidebarOpen(false)}
          isCollapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed((prev) => !prev)}
        />

        {/* Main Content Area */}
        <div className={`${sidebarCollapsed ? 'lg:pl-20' : 'lg:pl-64'} flex-1 flex flex-col min-w-0 transition-all duration-300`}>
          {/* Top Header */}
          <AdminHeader
            onMenuClick={() => setSidebarOpen((prev) => !prev)}
            isFullSize={sidebarCollapsed}
            onToggleFullSize={() => setSidebarCollapsed((prev) => !prev)}
          />

          {/* Page Shell */}
          <main className="flex-1 p-4 sm:p-6 lg:p-8 w-full max-w-full mx-auto">
            {children}
          </main>
        </div>
      </div>
    </RouteGuard>
  );
}

