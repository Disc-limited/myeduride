'use client';

import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { RoleSwitcher } from '@/components/shared/RoleSwitcher';
import { AccountSettingsModal } from '@/components/shared/AccountSettingsModal';
import { SessionIdleGuard } from '@/components/shared/SessionIdleGuard';
import { PresenceGuard } from '@/components/shared/PresenceGuard';
import { logout, getSession } from '@/lib/api';
import { KeyRound, LogOut, MessageSquare } from 'lucide-react';
import Link from 'next/link';

import { createClient } from '@/lib/supabase/client';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isSchoolAdmin = pathname?.startsWith('/dashboard/school-admin');
  const isParent = pathname?.startsWith('/dashboard/parent');
  
  const [showAccount, setShowAccount] = useState(false);
  const [isSessionValid, setIsSessionValid] = useState(false);
  const [hasCheckedSession, setHasCheckedSession] = useState(false);
  const [showChatButton, setShowChatButton] = useState(false);
  const [unreadChatCount, setUnreadChatCount] = useState(0);

  // Fetch unread count & listen to realtime updates
  useEffect(() => {
    if (!showChatButton) return;
    const fetchUnread = async () => {
      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ action: 'unread_total' }),
        });
        const data = await res.json();
        if (data && typeof data.unread_total === 'number') {
          setUnreadChatCount(data.unread_total);
        }
      } catch (e) {
        console.error(e);
      }
    };

    fetchUnread();
    const supabase = createClient();
    const channel = supabase
      .channel('layout-chat-unread')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_messages' }, () => fetchUnread())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'staff_private_messages' }, () => fetchUnread())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [showChatButton]);

  // SAFE GUARD: Validate the user profile state before allowing the nested layout elements to load
  useEffect(() => {
    try {
      const session = getSession();
      if (!session || !session.user_id) {
        logout();
        router.push('/auth/login');
        return;
      }
      setIsSessionValid(true);
      
      // Determine if user has any active staff roles
      const isStaff = session.roles.some((r: any) =>
        ['super_admin', 'school_admin', 'teacher', 'gate_officer', 'staff'].includes(r.role)
      );
      setShowChatButton(isStaff);
    } catch (error) {
      console.error("Layout Session verification crash caught:", error);
      logout();
      router.push('/auth/login');
    } finally {
      setHasCheckedSession(true);
    }
  }, [router]);

  // While checking session validity, render a clean loading state to avoid eager component rendering crashes
  if (!hasCheckedSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-pulse text-gray-400 text-sm font-medium">Securing session corridor...</div>
      </div>
    );
  }

  // Fallback view if session validation fails
  if (!isSessionValid) {
    return null;
  }

  // Hide fixed floating header controls on dashboards that provide their own custom headers
  const hasCustomHeader = [
    '/dashboard/escort',
    '/dashboard/school-admin',
    '/dashboard/super-admin',
    '/dashboard/staff',
    '/dashboard/teacher',
    '/dashboard/parent',
    '/dashboard/gate',
  ].some((prefix) => pathname.startsWith(prefix));

  return (
    <div className="min-h-screen bg-transparent">
      {/* Wrapped in a try/catch architecture implicitly using conditional rendering states */}
      <SessionIdleGuard />
      <PresenceGuard />
      
      {!hasCustomHeader && (
        <div className="fixed top-3 right-3 z-30 flex items-center gap-1">
          {/* RoleSwitcher handles dropdown rendering; safely mounted now */}
          <RoleSwitcher showLogout={false} />

          {showChatButton && (
            <Link
              href="/dashboard/staff-chat"
              className="relative p-2 rounded-full bg-white border shadow-sm text-gray-500 hover:text-primary-700 hover:border-primary-100 flex items-center justify-center transition-colors"
              title="Staff Private Chat & EduChart"
              aria-label="Staff Private Chat & EduChart"
            >
              <MessageSquare size={18} />
              {unreadChatCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[16px] h-[16px] bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-0.5 animate-pulse">
                  {unreadChatCount > 9 ? '9+' : unreadChatCount}
                </span>
              )}
            </Link>
          )}
          
          <button
            type="button"
            onClick={() => setShowAccount(true)}
            className="p-2 rounded-full bg-white border shadow-sm text-gray-500 hover:text-primary-700 hover:border-primary-100"
            title="Account settings"
            aria-label="Account settings"
          >
            <KeyRound size={18} />
          </button>
          
          {!isSchoolAdmin && !isParent && (
            <button
              type="button"
              onClick={logout}
              className="p-2 rounded-full bg-white border shadow-sm text-gray-500 hover:text-red-600 hover:border-red-100"
              title="Sign out"
              aria-label="Sign out"
            >
              <LogOut size={18} />
            </button>
          )}
        </div>
      )}

      {showAccount && (
        <AccountSettingsModal onClose={() => setShowAccount(false)} />
      )}

      {children}
    </div>
  );
}
