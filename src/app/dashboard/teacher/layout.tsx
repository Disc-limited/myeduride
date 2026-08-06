'use client';

import { useState, useEffect } from 'react';
import { RouteGuard } from '@/components/shared/RouteGuard';
import { TeacherSidebar } from '@/components/teacher/TeacherSidebar';
import { TeacherHeader } from '@/components/teacher/TeacherHeader';
import { MigoChatModal } from '@/components/teacher/MigoChatModal';
import { getSession } from '@/lib/api';

export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [migoOpen, setMigoOpen] = useState(false);
  const [session, setSession] = useState<any>(null);

  useEffect(() => {
    setSession(getSession());
  }, []);

  return (
    <RouteGuard requiredRole="teacher">
      <div className="min-h-screen bg-slate-100 flex flex-col font-sans antialiased text-slate-800">
        {/* Dedicated Teacher Navigation Sidebar */}
        <TeacherSidebar
          mobileOpen={sidebarOpen}
          onMobileClose={() => setSidebarOpen(false)}
          user={session}
          onOpenMigo={() => setMigoOpen(true)}
        />

        {/* Main Content Area (offset left by 64 = 16rem for lg viewports) */}
        <div className="lg:pl-64 flex-1 flex flex-col min-w-0">
          {/* Dedicated Header Bar */}
          <TeacherHeader
            onMenuClick={() => setSidebarOpen((prev) => !prev)}
            user={session}
          />

          {/* Teacher Page Shell */}
          <main className="flex-1 p-3 sm:p-5 lg:p-6 max-w-[1600px] w-full mx-auto">
            {children}
          </main>
        </div>

        {/* Migo AI Assistant Modal */}
        <MigoChatModal
          isOpen={migoOpen}
          onClose={() => setMigoOpen(false)}
        />
      </div>
    </RouteGuard>
  );
}
