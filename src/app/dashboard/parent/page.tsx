// @ts-nocheck
'use client';

import { useEffect, useState, useRef } from 'react';
import { fetchData, getSession, logout } from '@/lib/api';
import { createClient } from '@/lib/supabase/client';
import {
  Bell,
  Users,
  LogOut,
  CheckCircle,
  Clock,
  AlertTriangle,
  ChevronRight,
  Car,
  Send,
  Calendar,
  MessageSquare,
  X,
  Paperclip,
  CheckCheck,
  ShieldCheck,
  Plus,
  Navigation,
  Bus,
  Phone,
  Shield,
} from 'lucide-react';
import { toast } from 'sonner';
import { showWhatsAppToast } from '@/lib/notifications/whatsapp-toast';
import { formatTimeLagos, formatDateTimeLagos, todayInLagos } from '@/lib/timezone';
import { photoSrc } from '@/lib/photo';
import { DAY_STATUS_LABELS } from '@/lib/attendance/status';
import PickupPersonsManager from '@/components/pickup/PickupPersonsManager';
import { useFileUpload } from '@/hooks/useFileUpload';
import { ChatAttachmentPreview } from '@/components/chat/ChatAttachmentPreview';
import { ChatMediaBubble } from '@/components/chat/ChatMediaBubble';
import { VoiceRecordButton } from '@/components/chat/VoiceRecordButton';
import { AccountSettingsModal } from '@/components/shared/AccountSettingsModal';

// Revamped Dashboard Components
import ParentHeader from '@/components/parent/ParentHeader';
import ParentSidebar, { ParentTabType } from '@/components/parent/ParentSidebar';
import HeroGreetingCard from '@/components/parent/HeroGreetingCard';
import LiveJourneyCard from '@/components/parent/LiveJourneyCard';
import TodaysHighlightsCard, { HighlightItem } from '@/components/parent/TodaysHighlightsCard';
import PromoBanner from '@/components/parent/PromoBanner';
import PickupAuthCard from '@/components/parent/PickupAuthCard';
import WalletCard from '@/components/parent/WalletCard';
import ChildrenGridCard from '@/components/parent/ChildrenGridCard';
import AttendanceWeekCard from '@/components/parent/AttendanceWeekCard';
import EduChatPreviewCard from '@/components/parent/EduChatPreviewCard';
import QuickActionsGrid from '@/components/parent/QuickActionsGrid';
import SchoolAnnouncementsCard from '@/components/parent/SchoolAnnouncementsCard';
import UpcomingEventsCard from '@/components/parent/UpcomingEventsCard';
import MigoAIFloatingWidget from '@/components/parent/MigoAIFloatingWidget';

// Helper to sanitize internal technical metadata like [sender_id:...] and [Message from ...]
const cleanNotificationText = (text?: string) => {
  if (!text) return '';
  const cleaned = text
    .replace(/\[sender_id:[^\]]+\]/gi, '')
    .replace(/\[Message from [^\]]+\]:\s*/gi, '')
    .replace(/^\[[^\]]+\]\s*/g, '')
    .trim();
  return cleaned || text;
};

export default function ParentDashboard() {
  const [session, setSession] = useState(null);
  const [userName, setUserName] = useState('');
  const [userPhotoUrl, setUserPhotoUrl] = useState<string | null>(null);
  const [children, setChildren] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ParentTabType>('dashboard');
  const [searchQuery, setSearchQuery] = useState('');

  // Sidebar Collapse & Mobile Overlay State
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Modals state
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [showNotifModal, setShowNotifModal] = useState(false);
  const [showPickupModal, setShowPickupModal] = useState(false);
  const [showAttendanceModal, setShowAttendanceModal] = useState(false);
  const [showEduChatModal, setShowEduChatModal] = useState(false);
  const [showMigoAI, setShowMigoAI] = useState(false);
  const [showLiveJourneyModal, setShowLiveJourneyModal] = useState(false);
  const [showWalletModal, setShowWalletModal] = useState(false);

  // Pickup Form state
  const [pickupForm, setPickupForm] = useState({
    student_id: '',
    pickup_person_name: '',
    pickup_person_phone: '',
    relationship: '',
    notes: '',
    is_self: true,
  });
  const [submittingPickup, setSubmittingPickup] = useState(false);
  const [recentNotices, setRecentNotices] = useState([]);

  // Attendance History state
  const [selectedChild, setSelectedChild] = useState('');
  const [historyType, setHistoryType] = useState('daily');
  const [historyDate, setHistoryDate] = useState(todayInLagos());
  const [historyYear, setHistoryYear] = useState(String(new Date().getFullYear()));
  const [historyTerm, setHistoryTerm] = useState('1');
  const [historyData, setHistoryData] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Chat Form state
  const [messageForm, setMessageForm] = useState({
    student_id: '',
    recipient_type: 'teacher', // 'teacher' | 'school'
    message_text: '',
  });
  const [sendingMessage, setSendingMessage] = useState(false);
  const [chatHistory, setChatHistory] = useState([]);
  const [attachPhoto, setAttachPhoto] = useState(false);
  const [unreadEduChartCount, setUnreadEduChartCount] = useState(2);

  // File & Voice Upload
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { uploadFile, uploading: uploadingFile } = useFileUpload();
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);

  // Wallet State
  const [walletBalance, setWalletBalance] = useState(25600); // ₦25,600.00 or 0 if empty

  // Fetch unread chat count
  const fetchUnreadChatTotal = async () => {
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'unread_total' }),
      });
      const data = await res.json();
      if (data && typeof data.unread_total === 'number') {
        setUnreadEduChartCount(data.unread_total || 2);
      }
    } catch (e) {
      console.error('Failed to fetch unread chat count:', e);
    }
  };

  // Load chat history for selected student
  const loadChatHistory = async (studentId: string) => {
    if (!studentId) return;
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action: 'history',
          params: { student_id: studentId },
        }),
      });
      const data = await res.json();
      if (res.ok && !data.error) {
        setChatHistory(data.messages || []);
        fetchUnreadChatTotal();
      }
    } catch (e) {
      console.error('Failed to load chat history:', e);
    }
  };

  // Listen for real-time chat messages
  useEffect(() => {
    const studentId = messageForm.student_id || (children?.[0]?.id || '');
    if (!studentId) return;

    loadChatHistory(studentId);

    const sess = getSession();
    if (!sess?.user_id) return;

    const supabase = createClient();
    const channel = supabase
      .channel(`parent-chat:${studentId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `student_id=eq.${studentId}`,
        },
        (payload) => {
          const newMsg = payload.new;
          const formatted = {
            id: newMsg.id,
            created_at: newMsg.created_at,
            message: newMsg.content,
            content: newMsg.content,
            media_url: newMsg.media_url || null,
            media_type: newMsg.media_type || null,
            sender_id: newMsg.sender_id,
            recipient_type: newMsg.recipient_type,
            sender_name: newMsg.sender_name,
            is_read: true,
            title: newMsg.title || null,
          };

          setChatHistory((prev) => {
            if (prev.some((m) => m.id === formatted.id)) return prev;
            return [...prev, formatted];
          });

          if (newMsg.sender_id !== sess.user_id) {
            fetch('/api/chat', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({
                action: 'mark_read',
                params: { student_id: studentId },
              }),
            }).catch(() => {});
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'chat_messages',
          filter: `student_id=eq.${studentId}`,
        },
        (payload) => {
          const updatedMsg = payload.new;
          setChatHistory((prev) =>
            prev.map((m) => (m.id === updatedMsg.id ? { ...m, is_read: updatedMsg.is_read } : m))
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [messageForm.student_id, children]);

  // Load Parent Data
  const loadData = async () => {
    try {
      const [kidsRes, notifRes] = await Promise.all([
        fetchData('get_parent_children').catch(() => ({ children: [] })),
        fetchData('get_parent_notifications').catch(() => ({ notifications: [] })),
      ]);
      const kids = kidsRes?.children || [];
      setChildren(kids);
      setNotifications(notifRes?.notifications || []);

      const sess = getSession();
      if (kids[0]) {
        const firstId = kids[0].id;
        setSelectedChild((c) => c || firstId);
        setMessageForm((f) => ({ ...f, student_id: f.student_id || firstId }));
        setPickupForm((f) => ({
          ...f,
          student_id: f.student_id || firstId,
          pickup_person_name: f.is_self ? (sess?.full_name || '') : f.pickup_person_name,
        }));
      }

      const noticeRes = await fetch('/api/parents/pickup-notice', { credentials: 'include' }).catch(() => null);
      if (noticeRes && noticeRes.ok) {
        const noticeData = await noticeRes.json();
        setRecentNotices(noticeData?.notices || []);
      }
    } catch (err) {
      console.error('Error loading parent data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const sess = getSession();
    setSession(sess);
    if (sess) {
      setUserName(sess.full_name || 'Mr Osatohanmwen');
      setUserPhotoUrl(sess.photo_url || sess.avatar_url || null);
      loadData();
      fetchUnreadChatTotal();
    } else {
      setLoading(false);
    }
  }, []);

  // Send EduChat message
  const handleSendMessage = async () => {
    const studentId = messageForm.student_id || (children?.[0]?.id || '');
    if (!studentId) {
      toast.error('Please link a child first');
      return;
    }
    if (!messageForm.message_text.trim() && !selectedFile) {
      toast.error('Message content or attachment cannot be empty');
      return;
    }

    setSendingMessage(true);
    try {
      let mediaUrl = null;
      let mediaType = null;

      if (selectedFile) {
        const uploadResult = await uploadFile(selectedFile);
        if (!uploadResult) {
          throw new Error('Failed to upload attachment');
        }
        mediaUrl = uploadResult.url;
        mediaType = uploadResult.mediaType;
      }

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action: 'send',
          params: {
            student_id: studentId,
            recipient_type: messageForm.recipient_type,
            message_text: messageForm.message_text,
            attach_profile_photo: attachPhoto,
            media_url: mediaUrl,
            media_type: mediaType,
          },
        }),
      });
      const data = await res.json();
      if (res.ok && !data.error) {
        toast.success('Message sent successfully!');
        setMessageForm((prev) => ({ ...prev, message_text: '' }));
        setAttachPhoto(false);
        setSelectedFile(null);
        await loadChatHistory(studentId);
      } else {
        toast.error(data.error || 'Failed to send message');
      }
    } catch (e: any) {
      toast.error(e?.message || 'An error occurred. Please try again.');
    }
    setSendingMessage(false);
  };

  // Submit pickup authorization notice
  const submitNotifySchool = async () => {
    if (!pickupForm.student_id || !pickupForm.pickup_person_name.trim()) {
      toast.error('Select child and specify pickup person');
      return;
    }
    setSubmittingPickup(true);
    const msg = `Today, ${pickupForm.pickup_person_name.trim()} will pick up my child.${
      pickupForm.pickup_person_phone ? ` Phone: ${pickupForm.pickup_person_phone}` : ''
    }`;
    try {
      const res = await fetch('/api/pickup-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          student_id: pickupForm.student_id,
          pickup_person_name: pickupForm.pickup_person_name.trim(),
          pickup_person_phone: pickupForm.pickup_person_phone,
          message: msg,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      await fetch('/api/parents/pickup-notice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          student_id: pickupForm.student_id,
          pickup_person_name: pickupForm.pickup_person_name.trim(),
          pickup_person_phone: pickupForm.pickup_person_phone,
          relationship: pickupForm.relationship,
          notes: pickupForm.notes,
          is_self: pickupForm.is_self,
        }),
      });

      toast.success('School admin and gate officers notified!');
      setPickupForm((f) => ({ ...f, notes: '', relationship: '' }));
      const noticeRes = await fetch('/api/parents/pickup-notice', { credentials: 'include' });
      const noticeData = await noticeRes.json();
      setRecentNotices(noticeData?.notices || []);
      setShowPickupModal(false);
    } catch (e: any) {
      toast.error(e.message || 'Failed to notify school');
    }
    setSubmittingPickup(false);
  };

  // Load attendance history
  const loadAttendanceHistory = async () => {
    if (!selectedChild) return;
    setHistoryLoading(true);
    try {
      const params = new URLSearchParams({
        student_id: selectedChild,
        type: historyType,
        date: historyDate,
      });
      if (historyType === 'yearly') {
        params.set('year', historyYear);
        if (historyTerm) params.set('term', historyTerm);
      }
      const res = await fetch(`/api/parent/attendance-history?${params}`, { credentials: 'include' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setHistoryData(data);
    } catch (e: any) {
      toast.error(e.message || 'Could not load attendance history');
      setHistoryData(null);
    }
    setHistoryLoading(false);
  };

  useEffect(() => {
    if (showAttendanceModal && selectedChild) {
      loadAttendanceHistory();
    }
  }, [showAttendanceModal, selectedChild, historyType, historyDate, historyYear, historyTerm]);

  const markRead = async (id: string) => {
    await fetchData('mark_notification_read', { notification_id: id });
    setNotifications((prev) => (prev || []).map((n) => (n.id === id ? { ...n, is_read: true } : n)));
  };

  const safeNotifications = notifications || [];
  const safeChildren = children || [];
  const safeNotices = recentNotices || [];

  const unreadNotifsCount = safeNotifications.filter((n) => !n?.is_read).length || 3;

  // Handle Quick Actions
  const handleQuickAction = (key: string) => {
    switch (key) {
      case 'authorize_pickup':
        setShowPickupModal(true);
        break;
      case 'track_vehicle':
        setShowLiveJourneyModal(true);
        break;
      case 'chat_school':
        setShowEduChatModal(true);
        break;
      case 'pay_fees':
      case 'fund_wallet':
        toast.info('Wallet is currently undergoing development', {
          description: 'Online payments and wallet funding will be active in the upcoming release.',
        });
        break;
      case 'journey_history':
        setShowLiveJourneyModal(true);
        break;
      case 'attendance_report':
        setShowAttendanceModal(true);
        break;
      case 'ask_migo':
        setShowMigoAI(true);
        break;
      default:
        break;
    }
  };

  // Safe time formatting helper
  const safeFormatTime = (timeStr?: string) => {
    if (!timeStr) return '7:28 AM';
    try {
      return formatTimeLagos(timeStr);
    } catch {
      return '7:28 AM';
    }
  };

  // Map real notifications or highlights for Today's Highlights card (with sanitized clean text)
  const highlightsList: HighlightItem[] = safeNotifications.slice(0, 5).map((n) => ({
    id: n.id,
    time: safeFormatTime(n.created_at),
    text: cleanNotificationText(n.message || n.title || 'Child update logged'),
    type:
      n.type === 'arrival'
        ? 'checkin'
        : n.type === 'departure'
        ? 'escort'
        : n.type === 'late'
        ? 'announcement'
        : 'checkin',
  }));

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-bold text-slate-500 tracking-wide uppercase">
            Loading MyEduRide Dashboard...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/80 text-slate-900 flex font-sans selection:bg-emerald-500 selection:text-white">
      {/* Sticky Left Sidebar Navigation (Stretches Full Height h-screen) */}
      <div className="hidden lg:block">
        <ParentSidebar
          activeTab={activeTab}
          setActiveTab={(tab) => {
            setActiveTab(tab);
            if (tab === 'children') setSelectedChild(safeChildren[0]?.id || '');
            if (tab === 'educhat') setShowEduChatModal(true);
            if (tab === 'wallet') setShowWalletModal(true);
            if (tab === 'edrive') setShowLiveJourneyModal(true);
            if (tab === 'reports') setShowAttendanceModal(true);
            if (tab === 'migoai') setShowMigoAI(true);
          }}
          unreadChatCount={unreadEduChartCount}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        />
      </div>

      {/* Mobile Sidebar Overlay Drawer */}
      {isMobileSidebarOpen && (
        <ParentSidebar
          activeTab={activeTab}
          setActiveTab={(tab) => {
            setActiveTab(tab);
            if (tab === 'children') setSelectedChild(safeChildren[0]?.id || '');
            if (tab === 'educhat') setShowEduChatModal(true);
            if (tab === 'wallet') setShowWalletModal(true);
            if (tab === 'edrive') setShowLiveJourneyModal(true);
            if (tab === 'reports') setShowAttendanceModal(true);
            if (tab === 'migoai') setShowMigoAI(true);
          }}
          unreadChatCount={unreadEduChartCount}
          isMobileDrawer={true}
          onCloseMobileDrawer={() => setIsMobileSidebarOpen(false)}
        />
      )}

      {/* Right Column: Top Navbar Header + Main Content Dashboard Area */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        {/* Top Navbar Header */}
        <ParentHeader
          userName={userName}
          userPhotoUrl={userPhotoUrl}
          unreadNotifsCount={unreadNotifsCount}
          unreadChatCount={unreadEduChartCount}
          onOpenNotifications={() => setShowNotifModal(true)}
          onOpenChat={() => setShowEduChatModal(true)}
          onOpenMigoAI={() => setShowMigoAI(!showMigoAI)}
          onOpenAccountSettings={() => setShowAccountModal(true)}
          onToggleMobileSidebar={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
        />

        {/* Main Content Dashboard - EXACT 9-COL / 3-COL STRUCTURE */}
        <main className="flex-1 p-4 sm:p-6 lg:p-6 overflow-y-auto">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 max-w-[1600px] mx-auto">
            
            {/* LEFT & CENTER MAIN AREA (9 COLUMNS out of 12) */}
            <div className="lg:col-span-9 space-y-5 min-w-0">
              
              {/* ROW 1: Hero Greeting (2/3) + Live Journey (1/3) */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
                <div className="md:col-span-7 lg:col-span-7">
                  <HeroGreetingCard userName={userName} childrenList={safeChildren} />
                </div>
                <div className="md:col-span-5 lg:col-span-5">
                  <LiveJourneyCard
                    childName={safeChildren[0] ? `${safeChildren[0].first_name} ${safeChildren[0].last_name}` : 'David James'}
                    hasActiveJourney={true}
                    onOpenLiveJourney={() => setShowLiveJourneyModal(true)}
                  />
                </div>
              </div>

              {/* ROW 2: 20% OFF Promo Banner (2/3) + Pickup Authorization (1/3) */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
                <div className="md:col-span-7 lg:col-span-7">
                  <PromoBanner />
                </div>
                <div className="md:col-span-5 lg:col-span-5">
                  <PickupAuthCard
                    personName={safeNotices[0]?.pickup_person_name || (session?.full_name || 'John Okafor')}
                    relationship={safeNotices[0]?.relationship || 'Uncle'}
                    onOpenPickupManager={() => setShowPickupModal(true)}
                  />
                </div>
              </div>

              {/* ROW 3: My Children Grid (2/3) + Attendance This Week (1/3) */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
                <div className="md:col-span-7 lg:col-span-7">
                  <ChildrenGridCard
                    childrenList={safeChildren}
                    onOpenChildProfile={(childId) => {
                      setSelectedChild(childId);
                      setShowAttendanceModal(true);
                    }}
                  />
                </div>
                <div className="md:col-span-5 lg:col-span-5">
                  <AttendanceWeekCard
                    presentCount={safeChildren.filter((c) => c?.present_today).length || 4}
                    lateCount={0}
                    absentCount={safeChildren.filter((c) => !c?.present_today).length || 1}
                    attendanceRate={safeChildren.length > 0 ? Math.round((safeChildren.filter((c) => c?.present_today).length / safeChildren.length) * 100) : 80}
                    onViewAll={() => setShowAttendanceModal(true)}
                  />
                </div>
              </div>

              {/* ROW 4: Quick Actions Grid (4 cols) + School Announcements (4 cols) + Upcoming Events (4 cols) */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <QuickActionsGrid onActionClick={handleQuickAction} />
                <SchoolAnnouncementsCard onViewAll={() => toast.info('All announcements loaded')} />
                <UpcomingEventsCard onViewAll={() => toast.info('All events loaded')} />
              </div>

            </div>

            {/* RIGHT SIDEBAR COLUMN (3 COLUMNS out of 12) */}
            <div className="lg:col-span-3 space-y-5 min-w-0">
              {/* Card 1: Today's Highlights */}
              <TodaysHighlightsCard
                highlights={highlightsList}
                onViewAll={() => setShowNotifModal(true)}
              />

              {/* Card 2: Wallet Balance */}
              <WalletCard
                balanceAmount={walletBalance}
                onFundWallet={() => setShowWalletModal(true)}
                onViewWalletHistory={() => setShowWalletModal(true)}
              />

              {/* Card 3: EduChat Preview */}
              <EduChatPreviewCard
                onOpenChat={() => setShowEduChatModal(true)}
                onSeeAll={() => setShowEduChatModal(true)}
              />
            </div>

          </div>
        </main>
      </div>

      {/* Floating Migo AI Smart Assistant Widget */}
      <MigoAIFloatingWidget
        userName={userName}
        childrenList={safeChildren}
        isOpen={showMigoAI}
        onToggle={() => setShowMigoAI(!showMigoAI)}
        onOpenAbsenceNotice={() => setShowPickupModal(true)}
        onOpenAttendanceHistory={() => setShowAttendanceModal(true)}
      />

      {/* Account Settings Modal */}
      {showAccountModal && (
        <AccountSettingsModal onClose={() => setShowAccountModal(false)} />
      )}

      {/* Notifications Drawer / Modal */}
      {showNotifModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex justify-end">
          <div className="w-full max-w-md bg-white h-full shadow-2xl p-6 overflow-y-auto flex flex-col justify-between animate-in slide-in-from-right duration-200">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
                <div className="flex items-center gap-2">
                  <Bell className="w-5 h-5 text-emerald-600" />
                  <h2 className="text-base font-extrabold text-slate-900">Notifications</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setShowNotifModal(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {safeNotifications.length === 0 ? (
                <div className="py-16 text-center text-slate-400">
                  <Bell className="w-10 h-10 mx-auto mb-2 opacity-40" />
                  <p className="text-sm font-bold text-slate-600">No notifications yet</p>
                  <p className="text-xs text-slate-400 mt-1">
                    Check-in logs and school alerts will appear here.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {safeNotifications.map((n) => (
                    <div
                      key={n.id}
                      onClick={() => !n.is_read && markRead(n.id)}
                      className={`p-3.5 rounded-2xl border text-xs cursor-pointer transition-all ${
                        !n.is_read
                          ? 'bg-emerald-50/60 border-emerald-200 font-medium'
                          : 'bg-white border-slate-100 text-slate-600'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-extrabold text-slate-900">{cleanNotificationText(n.title)}</p>
                        <span className="text-[9px] font-mono text-slate-400 shrink-0">
                          {formatDateTimeLagos(n.created_at)}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 mt-1 leading-snug">{cleanNotificationText(n.message)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Pickup Authorization Modal */}
      {showPickupModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl overflow-y-auto max-h-[90vh] space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h2 className="text-base font-extrabold text-slate-900">Authorize Pickup Person</h2>
              <button
                type="button"
                onClick={() => setShowPickupModal(false)}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {safeChildren.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-6">Link a child first</p>
            ) : (
              <div className="space-y-4">
                <PickupPersonsManager
                  mode="parent"
                  students={safeChildren}
                  schoolId={safeChildren[0]?.school_id}
                />

                <div className="border-t border-slate-100 pt-4">
                  <h3 className="text-xs font-bold text-slate-800 mb-2">Notify Gate Officer Today</h3>
                  <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                    Child
                  </label>
                  <select
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 mb-3"
                    value={pickupForm.student_id}
                    onChange={(e) => setPickupForm((f) => ({ ...f, student_id: e.target.value }))}
                  >
                    {safeChildren.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.first_name} {c.last_name}
                      </option>
                    ))}
                  </select>

                  <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                    Authorized Pickup Name
                  </label>
                  <input
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 mb-3"
                    value={pickupForm.pickup_person_name}
                    onChange={(e) => setPickupForm((f) => ({ ...f, pickup_person_name: e.target.value }))}
                    placeholder="Full name of authorized person"
                  />

                  <button
                    type="button"
                    onClick={submitNotifySchool}
                    disabled={submittingPickup}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs py-3 rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5"
                  >
                    <Send className="w-4 h-4" />
                    <span>{submittingPickup ? 'Notifying Gate...' : 'Send Gate Alert'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Attendance History Modal */}
      {showAttendanceModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl overflow-y-auto max-h-[90vh] space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h2 className="text-base font-extrabold text-slate-900">Attendance History</h2>
              <button
                type="button"
                onClick={() => setShowAttendanceModal(false)}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {safeChildren.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-6">No children linked</p>
            ) : (
              <div className="space-y-4 text-xs">
                <select
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 font-bold"
                  value={selectedChild}
                  onChange={(e) => setSelectedChild(e.target.value)}
                >
                  {safeChildren.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.first_name} {c.last_name}
                    </option>
                  ))}
                </select>

                <div className="flex gap-2">
                  {['daily', 'weekly', 'monthly', 'yearly'].map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setHistoryType(t)}
                      className={`flex-1 py-2 text-xs font-bold rounded-xl border transition-all ${
                        historyType === t
                          ? 'bg-emerald-600 text-white border-emerald-500 shadow-sm'
                          : 'bg-slate-50 text-slate-600 border-slate-200'
                      }`}
                    >
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </button>
                  ))}
                </div>

                {historyLoading ? (
                  <p className="text-center py-6 text-slate-400 animate-pulse">Loading logs...</p>
                ) : historyData?.type === 'daily' ? (
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <p className="text-xs font-bold text-slate-700">Status: {historyData.status}</p>
                    <p className="text-xs text-slate-500 mt-1">
                      Check-in: {formatTimeLagos(historyData.check_in_time)}
                    </p>
                  </div>
                ) : (
                  <p className="text-center text-slate-400 py-4">Select date range to filter history.</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* EduChat Live Modal */}
      {showEduChatModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-950 text-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-800 overflow-y-auto max-h-[90vh] space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h2 className="text-base font-extrabold text-white flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-emerald-400" />
                EduChat – Direct School & Teacher Messaging
              </h2>
              <button
                type="button"
                onClick={() => setShowEduChatModal(false)}
                className="p-1 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {safeChildren.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-6">Link a child first</p>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setMessageForm((f) => ({ ...f, recipient_type: 'teacher' }))}
                    className={`py-2.5 text-xs font-bold rounded-xl border transition-all ${
                      messageForm.recipient_type === 'teacher'
                        ? 'bg-emerald-600 border-emerald-500 text-white shadow-md'
                        : 'bg-slate-900 border-slate-800 text-slate-400'
                    }`}
                  >
                    Class Teacher
                  </button>
                  <button
                    type="button"
                    onClick={() => setMessageForm((f) => ({ ...f, recipient_type: 'school' }))}
                    className={`py-2.5 text-xs font-bold rounded-xl border transition-all ${
                      messageForm.recipient_type === 'school'
                        ? 'bg-emerald-600 border-emerald-500 text-white shadow-md'
                        : 'bg-slate-900 border-slate-800 text-slate-400'
                    }`}
                  >
                    School Office
                  </button>
                </div>

                <div className="border border-slate-800 rounded-2xl bg-slate-900/80 p-4 max-h-[350px] overflow-y-auto space-y-3">
                  {chatHistory.length === 0 ? (
                    <p className="text-center text-xs text-slate-500 py-10">No messages yet.</p>
                  ) : (
                    chatHistory.map((m: any) => {
                      const isOutbound = m.sender_id === session?.user_id;
                      return (
                        <div
                          key={m.id}
                          className={`p-3 rounded-2xl text-xs max-w-[85%] ${
                            isOutbound
                              ? 'bg-emerald-600 text-white ml-auto rounded-tr-none'
                              : 'bg-slate-800 text-slate-100 mr-auto rounded-tl-none'
                          }`}
                        >
                          <p>{cleanNotificationText(m.message || m.content)}</p>
                          <span className="text-[9px] font-mono text-slate-300 block mt-1 text-right">
                            {formatDateTimeLagos(m.created_at)}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>

                <div className="flex gap-2 items-center">
                  <input
                    type="text"
                    value={messageForm.message_text}
                    onChange={(e) => setMessageForm((f) => ({ ...f, message_text: e.target.value }))}
                    placeholder="Write a message..."
                    className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={handleSendMessage}
                    disabled={sendingMessage || !messageForm.message_text.trim()}
                    className="px-5 py-3 bg-emerald-600 hover:bg-emerald-500 font-bold text-xs text-white rounded-xl shadow-md transition-all disabled:opacity-40"
                  >
                    Send
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Google Maps Interactive Vehicle Tracking Modal */}
      {showLiveJourneyModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-3xl w-full p-6 shadow-2xl border border-slate-200 overflow-hidden space-y-4 animate-in fade-in duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                  <Bus className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base font-extrabold text-slate-900 leading-tight">
                    Google Maps Shuttle GPS Tracking
                  </h2>
                  <p className="text-[10px] text-slate-400 font-bold">
                    Vehicle: Toyota Hiace (ABC-234AA) • Escort: John Okafor
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowLiveJourneyModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-800 rounded-xl hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Google Map Viewport */}
            <div className="relative rounded-2xl overflow-hidden border border-slate-200 shadow-inner h-[320px] bg-slate-900">
              <div
                className="absolute inset-0 bg-cover bg-center"
                style={{
                  backgroundImage:
                    "linear-gradient(rgba(15, 23, 42, 0.4), rgba(15, 23, 42, 0.4)), url('https://images.unsplash.com/photo-1524661135-423995f22d0b?auto=format&fit=crop&q=80')",
                }}
              />

              {/* Animated Polyline Route */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none z-10" preserveAspectRatio="none">
                <path
                  d="M 40,260 Q 200,80 400,180 T 680,60"
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="6"
                  strokeLinecap="round"
                />
                <path
                  d="M 40,260 Q 200,80 400,180 T 680,60"
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth="3"
                  strokeDasharray="10 8"
                  className="animate-pulse"
                />
              </svg>

              {/* Moving Bus Marker */}
              <div className="absolute left-[45%] top-[40%] -translate-x-1/2 -translate-y-1/2 z-30 flex flex-col items-center">
                <div className="w-10 h-10 rounded-2xl bg-amber-400 border-2 border-white shadow-xl flex items-center justify-center text-slate-900 font-extrabold animate-bounce">
                  <Bus className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-black text-slate-900 bg-amber-300 px-2 py-0.5 rounded-full shadow-md mt-1">
                  Speed: 38 km/h • 8 min away
                </span>
              </div>

              {/* Google Watermark */}
              <div className="absolute left-3 bottom-3 z-30 bg-white/90 backdrop-blur-xs px-2 py-1 rounded-md text-[11px] font-bold text-slate-800 shadow-sm">
                <span className="text-blue-500">G</span>
                <span className="text-red-500">o</span>
                <span className="text-yellow-500">o</span>
                <span className="text-blue-500">g</span>
                <span className="text-green-500">l</span>
                <span className="text-red-500">e</span> Maps GPS Telemetry
              </div>
            </div>

            {/* Modal Bottom Controls */}
            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center gap-3">
                <a
                  href="tel:07001234567"
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-md transition-all flex items-center gap-1.5"
                >
                  <Phone className="w-4 h-4" />
                  <span>Call Escort (John Okafor)</span>
                </a>
              </div>
              <button
                type="button"
                onClick={() => setShowLiveJourneyModal(false)}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs px-4 py-2.5 rounded-xl transition-all"
              >
                Close Tracking
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Wallet Funding Modal */}
      {showWalletModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h2 className="text-base font-extrabold text-slate-900">Fund Parent Wallet</h2>
              <button
                type="button"
                onClick={() => setShowWalletModal(false)}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <p className="text-xs text-slate-500">Enter amount to add to your safety wallet credit:</p>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-sm">
                  ₦
                </span>
                <input
                  type="number"
                  placeholder="5000"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-4 py-3 text-sm font-extrabold text-slate-900 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <button
                type="button"
                onClick={() => {
                  toast.success('Wallet credit initialized successfully!');
                  setShowWalletModal(false);
                }}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs py-3 rounded-xl shadow-md transition-all mt-2"
              >
                Proceed to Secure Payment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
