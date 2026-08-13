'use client';

import { useState } from 'react';
import { RouteGuard } from '@/components/shared/RouteGuard';
import { CityManagerSidebar } from '@/components/city-manager/CityManagerSidebar';
import { CityManagerHeader } from '@/components/city-manager/CityManagerHeader';

export default function CityManagerLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <RouteGuard requiredRole="city_manager">
      <div className="min-h-screen bg-[#071322] flex flex-col font-sans antialiased text-slate-100">
        {/* City Manager Sidebar */}
        <CityManagerSidebar
          mobileOpen={sidebarOpen}
          onMobileClose={() => setSidebarOpen(false)}
          isCollapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed((prev) => !prev)}
        />

        {/* Main Content Area */}
        <div className={`${sidebarCollapsed ? 'lg:pl-20' : 'lg:pl-64'} flex-1 flex flex-col min-w-0 transition-all duration-300`}>
          {/* Header */}
          <CityManagerHeader
            onMenuClick={() => setSidebarOpen((prev) => !prev)}
            isFullSize={sidebarCollapsed}
            onToggleFullSize={() => setSidebarCollapsed((prev) => !prev)}
          />

          {/* Page Shell */}
          <main className="flex-1 p-3 sm:p-5 lg:p-6 w-full max-w-full mx-auto">
            {children}
          </main>
        </div>
      </div>
    </RouteGuard>
  );
}
