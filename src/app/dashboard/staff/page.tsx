// @ts-nocheck
'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { fetchData, logout, getSession } from '@/lib/api';
import { formatTimeLagos, todayInLagos } from '@/lib/timezone';
import { createClient } from '@/lib/supabase/client';
import StudentAvatar from '@/components/shared/StudentAvatar';
import {
  Home,
  Calendar,
  Clock,
  Car,
  MessageSquare,
  Megaphone,
  User,
  Settings,
  HelpCircle,
  LogOut,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Send,
  ChevronLeft,
  Search,
  Bell,
  ShieldCheck,
  MapPin,
  Sparkles,
  RefreshCw,
  FileText,
  Download,
  ExternalLink,
  Menu,
  X,
  ChevronRight,
  Info,
  Check,
  Lock,
  Shield,
  ArrowRight,
  Navigation,
  CheckCircle,
  Radio,
  Sliders,
  LifeBuoy
} from 'lucide-react';
import { toast } from 'sonner';

export default function StaffDashboardPage() {
  // Main session & school state
  const [session, setSession] = useState<any>(null);
  const [schoolId, setSchoolId] = useState('');
  const [schoolName, setSchoolName] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [loading, setLoading] = useState(true);

  // Active navigation tab state
  const [activeTab, setActiveTab] = useState<
    'dashboard' | 'attendance' | 'history' | 'ride' | 'chat' | 'announcements' | 'profile' | 'settings' | 'help'
  >('dashboard');

  // Mobile sidebar open state
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Live Clock State
  const [currentTime, setCurrentTime] = useState<Date | null>(null);

  // Attendance stats for the current month
  const [stats, setStats] = useState({ present: 18, late: 1, absent: 0, rate: 94, schoolDays: 19 });

  // Today's attendance details state
  const [todayAttendance, setTodayAttendance] = useState({
    status: 'present',
    clockIn: '07:43 AM',
    clockOut: '04:18 PM',
    dateStr: '23 May 2026',
    locationIn: 'Main Gate, Fortune Springs Montessori',
    locationOut: 'Main Gate, Fortune Springs Montessori',
    scannedBy: 'Mr. Peter John (Gate Officer)',
    verification: 'Verified (Inside School Geofence)',
    gpsCoords: '6.3350° N, 5.6037° E',
    address: '12 Education Drive, Benin City, Edo State',
  });

  // History filtering states
  const [filter, setFilter] = useState<'daily' | 'weekly' | 'monthly' | 'custom'>('daily');
  const [selectedDate, setSelectedDate] = useState(todayInLagos());
  const [historyData, setHistoryData] = useState<any>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Modals state
  const [underDevModal, setUnderDevModal] = useState<{ open: boolean; feature: string }>({
    open: false,
    feature: '',
  });
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<any>(null);

  // EduChat States
  const [students, setStudents] = useState<any[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [chatHistory, setChatHistory] = useState<any[]>([]);
  const [chatText, setChatText] = useState('');
  const [attachPhoto, setAttachPhoto] = useState(false);
  const [sendingChat, setSendingChat] = useState(false);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [chatSearch, setChatSearch] = useState('');
  const [chatRecipientType, setChatRecipientType] = useState<'teacher' | 'school'>('teacher');

  // Password Settings state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [updatingPassword, setUpdatingPassword] = useState(false);

  // MIGO AI Assistant states
  const [migoMessages, setMigoMessages] = useState<Array<{ sender: 'bot' | 'user'; text: string }>>([
    { sender: 'bot', text: 'Hello Sarah! 👋 How can I help you today?' },
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (activeTab === 'chat') {
      scrollToBottom();
    }
  }, [chatHistory, activeTab]);

  // Live Ticking Clock (Africa/Lagos)
  useEffect(() => {
    setCurrentTime(new Date());
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const clockDisplay = useMemo(() => {
    if (!currentTime) return { dateStr: 'Loading...', timeStr: '--:--:--' };

    const timeStr = currentTime.toLocaleTimeString('en-NG', {
      timeZone: 'Africa/Lagos',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });

    const dateStr = currentTime.toLocaleDateString('en-NG', {
      timeZone: 'Africa/Lagos',
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    return { dateStr, timeStr };
  }, [currentTime]);

  // Load basic staff details on mount
  useEffect(() => {
    const currentSession = getSession();
    setSession(currentSession);

    (async () => {
      try {
        const data = await fetchData('get_staff_dashboard');
        setSchoolId(data.school_id || '');
        setSchoolName(data.school_name || 'Fortune Springs Montessori');
        setJobTitle(data.job_title || 'Administrative Officer');

        if (data.school_id) {
          await loadMonthStats(data.school_id);
        }
      } catch (err) {
        console.error('Failed to load staff details:', err);
      }
      setLoading(false);
    })();
  }, []);

  // Fetch month summary metrics
  const loadMonthStats = async (sId: string) => {
    try {
      const currentMonth = todayInLagos().slice(0, 7);
      const params = new URLSearchParams({
        school_id: sId,
        type: 'monthly',
        view: 'staff',
        month: currentMonth,
      });
      const res = await fetch(`/api/attendance/reports?${params}`, { credentials: 'include' });
      const json = await res.json();
      if (res.ok && json.staff_report && json.staff_report.length > 0) {
        const myRecord = json.staff_report[0];
        const present = myRecord.days_present || 18;
        const schoolDays = myRecord.school_days || 19;
        const absent = Math.max(0, schoolDays - present);
        const rate = schoolDays > 0 ? Math.round((present / schoolDays) * 100) : 94;
        setStats({ present, absent, late: 1, rate, schoolDays });
      }
    } catch (err) {
      console.error('Failed to load monthly statistics:', err);
    }
  };

  // Fetch detailed attendance history log
  const loadHistory = async (sId: string, filterType: string, dateVal: string) => {
    setLoadingHistory(true);
    try {
      const params = new URLSearchParams({
        school_id: sId,
        view: 'staff',
      });

      if (filterType === 'daily') {
        params.set('type', 'daily');
        params.set('date', todayInLagos());
      } else if (filterType === 'custom') {
        params.set('type', 'daily');
        params.set('date', dateVal);
      } else if (filterType === 'weekly') {
        params.set('type', 'weekly');
        params.set('date', todayInLagos());
      } else if (filterType === 'monthly') {
        params.set('type', 'monthly');
        params.set('month', todayInLagos().slice(0, 7));
      }

      const res = await fetch(`/api/attendance/reports?${params}`, { credentials: 'include' });
      const json = await res.json();
      if (res.ok) {
        setHistoryData(json);
      } else {
        setHistoryData(null);
      }
    } catch (err) {
      console.error('Failed to load history list:', err);
      setHistoryData(null);
    }
    setLoadingHistory(false);
  };

  useEffect(() => {
    if (schoolId) {
      loadHistory(schoolId, filter, selectedDate);
    }
  }, [schoolId, filter, selectedDate]);

  // Load chat students
  const loadChatStudents = async (sId: string) => {
    setLoadingStudents(true);
    try {
      const res = await fetchData('get_admin_chat_students', { school_id: sId });
      setStudents(res.students || []);
    } catch (err) {
      console.error('Failed to load chat students:', err);
    }
    setLoadingStudents(false);
  };

  useEffect(() => {
    if (schoolId) {
      loadChatStudents(schoolId);
    }
  }, [schoolId]);

  // Load chat history
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
        setStudents((prev) =>
          prev.map((s) => (s.id === studentId ? { ...s, unread_count: 0 } : s))
        );
      }
    } catch (e) {
      console.error('Failed to load chat history:', e);
    }
  };

  useEffect(() => {
    if (selectedStudent?.id) {
      loadChatHistory(selectedStudent.id);
    }
  }, [selectedStudent]);

  // Real-time chat listener
  useEffect(() => {
    if (!schoolId) return;

    const currentSession = getSession();
    if (!currentSession?.user_id) return;

    const supabase = createClient();

    const channel = supabase
      .channel(`staff-school-chat:${schoolId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `school_id=eq.${schoolId}`,
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
            sender_name: newMsg.sender_name,
            recipient_type: newMsg.recipient_type,
            is_read: newMsg.is_read,
          };

          if (selectedStudent?.id && newMsg.student_id === selectedStudent.id) {
            setChatHistory((prev) => {
              if (prev.some((m) => m.id === formatted.id)) return prev;
              return [...prev, formatted];
            });

            fetch('/api/chat', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({
                action: 'mark_read',
                params: { student_id: selectedStudent.id },
              }),
            }).catch(() => {});
          } else {
            setStudents((prev) =>
              prev.map((s) => {
                if (s.id === newMsg.student_id) {
                  const isIncoming = newMsg.sender_id !== currentSession.user_id;
                  if (isIncoming) {
                    return {
                      ...s,
                      unread_count: (s.unread_count || 0) + 1,
                      last_message: {
                        message: newMsg.content,
                        created_at: newMsg.created_at,
                      },
                    };
                  }
                }
                return s;
              })
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [schoolId, selectedStudent]);

  const handleLogout = () => {
    logout();
  };

  const openUnderDev = (featureName: string) => {
    setUnderDevModal({ open: true, feature: featureName });
  };

  const handleMigoPrompt = (promptText: string) => {
    setMigoMessages((prev) => [...prev, { sender: 'user', text: promptText }]);

    let botResponse = 'I can help you with that!';
    if (promptText.includes('Attendance')) {
      botResponse = `Your attendance status today is PRESENT (Clocked in at ${todayAttendance.clockIn}). Your overall monthly attendance rate is ${stats.rate}%.`;
    } else if (promptText.includes('Ride')) {
      botResponse = 'The Ride Booking service is currently undergoing integration with our transit partners. You will receive an update once ride scheduling goes live!';
    } else if (promptText.includes('Schedule')) {
      botResponse = `Today's schedule: Campus hours 07:30 AM - 04:30 PM. Gate check-in verified at ${todayAttendance.clockIn}.`;
    } else if (promptText.includes('Help')) {
      botResponse = 'Need assistance? You can reach MyEduRide Support at support@myeduride.com or call our helpline.';
    }

    setTimeout(() => {
      setMigoMessages((prev) => [...prev, { sender: 'bot', text: botResponse }]);
    }, 400);
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword !== confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }
    setUpdatingPassword(true);
    try {
      const res = await fetch('/api/dashboard/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success('Password updated successfully!');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        toast.error(data.error || 'Failed to update password');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Error updating password');
    }
    setUpdatingPassword(false);
  };

  const handleSendChat = async () => {
    if (!selectedStudent?.id || !chatText.trim()) return;
    setSendingChat(true);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action: 'send',
          params: {
            student_id: selectedStudent.id,
            recipient_type: chatRecipientType,
            message_text: chatText,
            attach_profile_photo: attachPhoto,
          },
        }),
      });

      const data = await res.json();
      if (res.ok && !data.error) {
        setChatText('');
        setAttachPhoto(false);
        await loadChatHistory(selectedStudent.id);
      } else {
        toast.error(data.error || 'Failed to send message');
      }
    } catch (e: any) {
      toast.error(e?.message || 'Failed to send message');
    }
    setSendingChat(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#0D1527] text-white">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full border-4 border-emerald-400 border-t-transparent animate-spin" />
          <span className="font-semibold text-lg tracking-wide text-slate-200">Loading Staff Dashboard...</span>
        </div>
      </div>
    );
  }

  // Sample static announcements
  const announcementsList = [
    {
      id: 1,
      title: 'Staff Meeting',
      category: 'Meeting',
      icon: Megaphone,
      iconBg: 'bg-blue-50 text-blue-600',
      description: 'There will be a staff meeting on Monday, 26th May 2026 at 10:00 AM.',
      time: '2h ago',
      date: '26th May 2026',
    },
    {
      id: 2,
      title: 'Safety Update',
      category: 'Security',
      icon: ShieldCheck,
      iconBg: 'bg-emerald-50 text-emerald-600',
      description: 'Please ensure you adhere to all safety protocols while on campus.',
      time: 'Yesterday',
      date: '22nd May 2026',
    },
    {
      id: 3,
      title: 'Public Holiday',
      category: 'Calendar',
      icon: Calendar,
      iconBg: 'bg-amber-50 text-amber-600',
      description: 'School will be closed on Thursday, 29th May 2026 for Public Holiday.',
      time: '2d ago',
      date: '29th May 2026',
    },
  ];

  // Sidebar Items Definition
  const sidebarItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Home, available: true },
    { id: 'attendance', label: 'Attendance', icon: Calendar, available: true },
    { id: 'history', label: 'Attendance History', icon: Clock, available: true },
    { id: 'ride', label: 'My Ride', icon: Car, available: false },
    { id: 'chat', label: 'EduChat', icon: MessageSquare, available: true, badge: 3 },
    { id: 'announcements', label: 'Announcements', icon: Megaphone, available: true },
    { id: 'profile', label: 'My Profile', icon: User, available: true },
    { id: 'settings', label: 'Settings', icon: Settings, available: true },
  ];

  const handleNavClick = (itemId: string, available: boolean, label: string) => {
    if (!available) {
      openUnderDev(label);
    } else {
      setActiveTab(itemId as any);
      setMobileSidebarOpen(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F4F6F9] text-slate-800 font-sans flex flex-col justify-between">
      {/* Top Mobile Nav Bar */}
      <div className="lg:hidden bg-[#0A1128] text-white px-4 py-2.5 flex items-center justify-between sticky top-0 z-40 shadow-md">
        <div className="flex items-center gap-2">
          <img
            src="/images/eduride_logo.png"
            alt="MyEduRide"
            className="h-7 w-auto object-contain"
          />
        </div>

        {/* Right Tools on Mobile: Bell, Profile, Logout, Menu Toggle */}
        <div className="flex items-center gap-2">
          {/* Notification Bell */}
          <button
            onClick={() => setNotificationsOpen(!notificationsOpen)}
            className="relative p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-all"
          >
            <Bell size={18} />
            <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 text-white font-bold text-[9px] rounded-full flex items-center justify-center border border-[#0A1128]">
              3
            </span>
          </button>

          {/* Profile Avatar */}
          <div
            onClick={() => setActiveTab('profile')}
            className="relative cursor-pointer"
          >
            <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-800 border-2 border-emerald-400 overflow-hidden flex items-center justify-center font-bold text-xs">
              {session?.full_name ? session.full_name.charAt(0) : 'S'}
            </div>
            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-400 border border-[#0A1128] rounded-full" />
          </div>

          {/* Logout Button */}
          <button
            onClick={handleLogout}
            title="Sign Out"
            className="p-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30 transition-all"
          >
            <LogOut size={16} />
          </button>

          {/* Mobile Menu Toggle */}
          <button
            onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
            className="p-1.5 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-all ml-1"
          >
            {mobileSidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      <div className="flex flex-1 relative">
        {/* LEFT SIDEBAR - Deep Navy (#0A1128 / #0D1527) */}
        <aside
          className={`
            fixed lg:static inset-y-0 left-0 z-50 w-64 bg-[#0A1128] text-white flex flex-col justify-between p-4 transition-transform duration-300 ease-in-out shrink-0
            ${mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          `}
        >
          <div>
            {/* Logo & Header */}
            <div className="flex items-center justify-between pb-6 border-b border-white/10 px-2 pt-2">
              <div className="flex items-center gap-3">
                <img
                  src="/images/eduride_logo.png"
                  alt="MyEduRide Logo"
                  className="h-10 w-auto object-contain"
                />
              </div>
            </div>

            {/* Navigation Links */}
            <nav className="mt-6 space-y-1.5">
              {sidebarItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleNavClick(item.id, item.available, item.label)}
                    className={`
                      w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl font-medium text-sm transition-all duration-150 group
                      ${
                        isActive
                          ? 'bg-[#1D294D] text-white font-semibold shadow-inner border border-white/10'
                          : 'text-slate-300 hover:bg-white/5 hover:text-white'
                      }
                    `}
                  >
                    <div className="flex items-center gap-3">
                      <Icon
                        size={18}
                        className={isActive ? 'text-emerald-400' : 'text-slate-400 group-hover:text-slate-200'}
                      />
                      <span>{item.label}</span>
                    </div>
                    {item.badge && (
                      <span className="w-5 h-5 rounded-full bg-emerald-500 text-white text-[11px] font-bold flex items-center justify-center">
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}

              <div className="pt-3 pb-1">
                <div className="border-t border-white/10" />
              </div>

              <button
                onClick={() => handleNavClick('help', false, 'Help & Support')}
                className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium text-sm text-slate-300 hover:bg-white/5 hover:text-white transition-all"
              >
                <HelpCircle size={18} className="text-slate-400" />
                <span>Help & Support</span>
              </button>

              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium text-sm text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-all"
              >
                <LogOut size={18} className="text-red-400" />
                <span>Sign Out</span>
              </button>
            </nav>
          </div>

          {/* Bottom Sidebar Elements */}
          <div className="space-y-4 pt-4">
            {/* Promo Card - Need a Ride? */}
            <div className="relative overflow-hidden bg-gradient-to-br from-[#121E42] to-[#1A2A5A] rounded-2xl p-4 border border-white/10 shadow-lg">
              <div className="relative z-10">
                <h4 className="text-sm font-bold text-white mb-1">Need a Ride?</h4>
                <p className="text-[11px] text-slate-300 leading-snug mb-3">
                  Book a safe, reliable ride for your daily commute.
                </p>
                <button
                  onClick={() => openUnderDev('Ride Booking')}
                  className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 shadow-md shadow-emerald-500/20 transition-all"
                >
                  <span>Book a Ride Now</span>
                  <ArrowRight size={13} />
                </button>
              </div>

              {/* Decorative Van Illustration */}
              <div className="mt-3 flex justify-end">
                <div className="bg-emerald-500/10 p-2 rounded-xl border border-emerald-500/20">
                  <Car size={36} className="text-emerald-400" />
                </div>
              </div>
            </div>

            {/* Sidebar Version Footer */}
            <div className="px-2 pt-1 flex items-center justify-between text-[11px] text-slate-400">
              <span className="font-semibold text-slate-400">MyEduRide SSP</span>
              <span className="font-mono bg-white/10 text-slate-300 px-1.5 py-0.5 rounded text-[10px]">v2.6.0</span>
            </div>
          </div>
        </aside>

        {/* MAIN CONTENT CONTAINER */}
        <main className="flex-1 flex flex-col min-w-0 pb-16">
          {/* TOP HEADER */}
          <header className="bg-white border-b border-slate-200/80 px-4 md:px-6 py-3.5 md:py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3 md:gap-4 sticky top-0 md:static z-30 shadow-sm">
            {/* Left: School Name & Location */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 md:w-11 md:h-11 rounded-2xl bg-[#0A1128] text-white flex items-center justify-center shadow-md shrink-0 border border-slate-700">
                <Shield size={20} className="text-emerald-400" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h2 className="font-extrabold text-sm md:text-lg text-slate-900 leading-tight">
                    {schoolName || 'Fortune Springs Montessori'}
                  </h2>
                  <CheckCircle2 size={16} className="text-emerald-500 fill-emerald-50 shrink-0" />
                </div>
                <p className="text-xs text-slate-500 font-medium">Benin City, Edo State</p>
              </div>
            </div>

            {/* Center/Right Greeting & Info */}
            <div className="flex flex-wrap items-center justify-between md:justify-end gap-3 md:gap-6">
              {/* User greeting */}
              <div className="text-left md:text-right">
                <div className="flex flex-wrap items-center md:justify-end gap-1.5 md:gap-2">
                  <span className="text-xs text-slate-500 font-medium">Welcome back,</span>
                  <span className="font-bold text-xs md:text-sm text-slate-900">
                    {session?.full_name || 'Sarah Johnson'}
                  </span>
                  <span className="bg-emerald-50 text-emerald-700 font-bold text-[10px] md:text-[11px] px-2 py-0.5 rounded-full border border-emerald-200">
                    {jobTitle || 'Administrative Officer'}
                  </span>
                </div>
                <p className="text-[11px] md:text-xs text-slate-500 font-medium mt-0.5">
                  Staff ID: <span className="font-mono font-semibold text-slate-700">FSM-1428</span> • Department:{' '}
                  <span className="font-semibold text-slate-700">Administration</span>
                </p>
              </div>

              {/* Right tools (Desktop only view since mobile has them in sticky top navbar) */}
              <div className="hidden md:flex items-center gap-3 pl-2 border-l border-slate-200">
                {/* Notification Bell */}
                <button
                  onClick={() => setNotificationsOpen(!notificationsOpen)}
                  className="relative p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-all"
                >
                  <Bell size={18} />
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white font-bold text-[10px] rounded-full flex items-center justify-center border-2 border-white">
                    3
                  </span>
                </button>

                {/* Live Lagos Clock */}
                <div className="bg-slate-100/90 border border-slate-200/80 rounded-xl px-3 py-1.5 text-right">
                  <div className="font-extrabold text-sm text-slate-900 leading-none">
                    {clockDisplay.timeStr}
                  </div>
                  <div className="text-[10px] font-semibold text-slate-500 mt-0.5">
                    {clockDisplay.dateStr}
                  </div>
                </div>

                {/* Profile Avatar */}
                <div
                  onClick={() => setActiveTab('profile')}
                  className="relative cursor-pointer group"
                >
                  <div className="w-10 h-10 rounded-full bg-slate-300 overflow-hidden border-2 border-emerald-500 shadow-sm flex items-center justify-center font-bold text-slate-700">
                    {session?.full_name ? session.full_name.charAt(0) : 'S'}
                  </div>
                  <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full" />
                </div>

                {/* Logout Header Button */}
                <button
                  onClick={handleLogout}
                  title="Sign Out"
                  className="p-2.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 border border-red-100 transition-all flex items-center gap-1.5 text-xs font-bold shadow-sm active:scale-95"
                >
                  <LogOut size={16} />
                  <span>Logout</span>
                </button>
              </div>
            </div>
          </header>

          {/* MAIN TAB CONTENT CONTAINER */}
          <div className="p-4 md:p-6 w-full max-w-full mx-auto space-y-6">
            {/* NOTIFICATIONS DROPDOWN POPUP */}
            {notificationsOpen && (
              <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-4 max-w-sm w-full absolute right-6 top-20 z-50 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <h4 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                    <Bell size={16} className="text-emerald-600" /> Notifications
                  </h4>
                  <button
                    onClick={() => setNotificationsOpen(false)}
                    className="text-slate-400 hover:text-slate-600 p-1"
                  >
                    <X size={14} />
                  </button>
                </div>
                <div className="space-y-2 text-xs">
                  <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-100">
                    <p className="font-semibold text-emerald-900">Attendance Recorded</p>
                    <p className="text-emerald-700 mt-0.5">Gate officer verified your clock-in at 07:43 AM.</p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-blue-50 border border-blue-100">
                    <p className="font-semibold text-blue-900">Staff Meeting Reminder</p>
                    <p className="text-blue-700 mt-0.5">Monday meeting scheduled for 10:00 AM.</p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                    <p className="font-semibold text-slate-800">EduChat Message</p>
                    <p className="text-slate-600 mt-0.5">HR posted an update regarding monthly reports.</p>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 1: MAIN DASHBOARD */}
            {activeTab === 'dashboard' && (
              <div className="space-y-6">
                {/* INFO BANNER: Gate Clock-In Notice */}
                <div className="bg-gradient-to-r from-blue-500/10 via-blue-50 to-indigo-50 border border-blue-200/90 rounded-2xl p-4 md:p-5 flex flex-col md:flex-row items-center justify-between gap-4 shadow-sm">
                  <div className="flex items-start gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-md">
                      <Info size={22} />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm md:text-base text-blue-950">
                        You cannot clock in or out by yourself.
                      </h4>
                      <p className="text-xs md:text-sm text-blue-800/90 mt-0.5 leading-snug">
                        Attendance is captured through the Gate Manager System by School Admin or Gate Officers.
                      </p>
                    </div>
                  </div>

                  {/* Decorative Scan Graphic */}
                  <div className="bg-white/80 backdrop-blur-sm border border-blue-200 px-4 py-2 rounded-xl flex items-center gap-2.5 text-xs font-semibold text-blue-900 shrink-0 shadow-sm">
                    <ShieldCheck size={18} className="text-emerald-500 animate-pulse" />
                    <span>Gate Scan Terminal Online</span>
                  </div>
                </div>

                {/* MAIN GRID LAYOUT: Left (8 Cols) vs Right (4 Cols) */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  {/* LEFT COLUMN (8 Cols) */}
                  <div className="lg:col-span-8 space-y-6">
                    {/* TODAY'S ATTENDANCE OVERVIEW CARD */}
                    <div className="bg-white rounded-2xl border border-slate-200/80 p-5 md:p-6 shadow-sm space-y-5">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <h3 className="font-extrabold text-base md:text-lg text-slate-900 flex items-center gap-2">
                          <CheckCircle2 className="text-emerald-500" size={20} />
                          <span>Today's Attendance Overview</span>
                        </h3>
                        <span className="text-xs font-medium text-slate-400">
                          {clockDisplay.dateStr}
                        </span>
                      </div>

                      {/* Top Row Stat Badges */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {/* Status Pill */}
                        <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-2xl p-4 flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold shadow-md shadow-emerald-500/20">
                            <Check size={22} />
                          </div>
                          <div>
                            <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-800 block">
                              STATUS
                            </span>
                            <span className="font-extrabold text-base text-emerald-700 block">
                              Present
                            </span>
                            <span className="text-[11px] font-semibold text-emerald-600">On Time</span>
                          </div>
                        </div>

                        {/* Clock-In Card */}
                        <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold">
                            <Clock size={20} />
                          </div>
                          <div>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                              CLOCK-IN
                            </span>
                            <span className="font-extrabold text-base text-slate-900 block">
                              {todayAttendance.clockIn}
                            </span>
                            <span className="text-[11px] text-slate-500">{todayAttendance.dateStr}</span>
                          </div>
                        </div>

                        {/* Clock-Out Card */}
                        <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold">
                            <Clock size={20} />
                          </div>
                          <div>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                              CLOCK-OUT
                            </span>
                            <span className="font-extrabold text-base text-slate-900 block">
                              {todayAttendance.clockOut}
                            </span>
                            <span className="text-[11px] text-slate-500">{todayAttendance.dateStr}</span>
                          </div>
                        </div>
                      </div>

                      {/* Attendance Detail Metadata Grid */}
                      <div className="bg-slate-50/70 border border-slate-100 rounded-2xl p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                        <div>
                          <span className="text-slate-400 font-medium block mb-0.5">Clock-In Location</span>
                          <span className="font-bold text-slate-800 block">Main Gate</span>
                          <span className="text-slate-500 text-[11px]">{schoolName}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 font-medium block mb-0.5">Clock-Out Location</span>
                          <span className="font-bold text-slate-800 block">Main Gate</span>
                          <span className="text-slate-500 text-[11px]">{schoolName}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 font-medium block mb-0.5">Scanned By</span>
                          <span className="font-bold text-slate-800 block">Mr. Peter John</span>
                          <span className="text-slate-500 text-[11px]">Gate Officer</span>
                        </div>
                        <div>
                          <span className="text-slate-400 font-medium block mb-0.5">Verification</span>
                          <span className="font-bold text-emerald-700 block">Verified</span>
                          <span className="text-slate-500 text-[11px]">Inside School Geofence</span>
                        </div>
                      </div>

                      {/* Bottom Verification Banner Link */}
                      <div className="flex items-center justify-between pt-2 text-xs">
                        <div className="flex items-center gap-1.5 text-emerald-700 font-semibold">
                          <CheckCircle2 size={15} />
                          <span>Attendance recorded and verified by Gate Manager System</span>
                        </div>
                        <button
                          onClick={() => setActiveTab('attendance')}
                          className="font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 transition-all hover:underline"
                        >
                          <span>View Full Details</span>
                          <ArrowRight size={13} />
                        </button>
                      </div>
                    </div>

                    {/* SUB-GRID: Monthly Summary & Quick Actions */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      {/* Attendance Summary (This Month) */}
                      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm space-y-4">
                        <h4 className="font-bold text-sm text-slate-900">Attendance Summary (This Month)</h4>

                        <div className="grid grid-cols-4 gap-2 text-center">
                          {/* Present Days */}
                          <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-2.5">
                            <Calendar size={16} className="text-emerald-600 mx-auto mb-1" />
                            <span className="font-extrabold text-lg text-emerald-900 block leading-none">
                              {stats.present}
                            </span>
                            <span className="text-[10px] text-emerald-700 font-semibold block mt-1">Present</span>
                          </div>

                          {/* Late Days */}
                          <div className="bg-amber-50 border border-amber-100 rounded-xl p-2.5">
                            <Clock size={16} className="text-amber-600 mx-auto mb-1" />
                            <span className="font-extrabold text-lg text-amber-900 block leading-none">
                              {stats.late}
                            </span>
                            <span className="text-[10px] text-amber-700 font-semibold block mt-1">Late</span>
                          </div>

                          {/* Absent Days */}
                          <div className="bg-red-50 border border-red-100 rounded-xl p-2.5">
                            <XCircle size={16} className="text-red-600 mx-auto mb-1" />
                            <span className="font-extrabold text-lg text-red-900 block leading-none">
                              {stats.absent}
                            </span>
                            <span className="text-[10px] text-red-700 font-semibold block mt-1">Absent</span>
                          </div>

                          {/* Attendance Rate */}
                          <div className="bg-blue-50 border border-blue-100 rounded-xl p-2.5">
                            <Sparkles size={16} className="text-blue-600 mx-auto mb-1" />
                            <span className="font-extrabold text-lg text-blue-900 block leading-none">
                              {stats.rate}%
                            </span>
                            <span className="text-[10px] text-blue-700 font-semibold block mt-1">Rate</span>
                          </div>
                        </div>

                        {/* Progress Bar */}
                        <div>
                          <div className="flex justify-between text-xs font-semibold text-slate-500 mb-1">
                            <span>Attendance Progress</span>
                            <span className="text-emerald-600 font-bold">{stats.rate}%</span>
                          </div>
                          <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                              style={{ width: `${stats.rate}%` }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Quick Actions */}
                      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm space-y-3">
                        <h4 className="font-bold text-sm text-slate-900">Quick Actions</h4>

                        <button
                          onClick={() => setActiveTab('history')}
                          className="w-full bg-[#0A1128] hover:bg-[#121E42] text-white text-xs font-semibold py-2.5 px-3.5 rounded-xl flex items-center justify-between transition-all"
                        >
                          <span className="flex items-center gap-2">
                            <Clock size={15} className="text-emerald-400" /> View Attendance History
                          </span>
                          <ChevronRight size={15} />
                        </button>

                        <button
                          onClick={() => openUnderDev('Attendance Review Request')}
                          className="w-full bg-[#0A1128] hover:bg-[#121E42] text-white text-xs font-semibold py-2.5 px-3.5 rounded-xl flex items-center justify-between transition-all"
                        >
                          <span className="flex items-center gap-2">
                            <FileText size={15} className="text-emerald-400" /> Request Attendance Review
                          </span>
                          <ChevronRight size={15} />
                        </button>

                        <button
                          onClick={() => openUnderDev('Attendance Report Download')}
                          className="w-full bg-[#0A1128] hover:bg-[#121E42] text-white text-xs font-semibold py-2.5 px-3.5 rounded-xl flex items-center justify-between transition-all"
                        >
                          <span className="flex items-center gap-2">
                            <Download size={15} className="text-emerald-400" /> Download Attendance Report
                          </span>
                          <ChevronRight size={15} />
                        </button>
                      </div>
                    </div>

                    {/* SUB-GRID 2: EduChat & Announcements Widgets */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      {/* EduChat Widget */}
                      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm space-y-3">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                          <h4 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                            <MessageSquare size={16} className="text-emerald-600" /> EduChat
                          </h4>
                          <button
                            onClick={() => setActiveTab('chat')}
                            className="text-xs font-bold text-emerald-600 hover:underline flex items-center gap-0.5"
                          >
                            <span>View All</span>
                            <ArrowRight size={12} />
                          </button>
                        </div>

                        <div className="space-y-2 text-xs">
                          <div
                            onClick={() => setActiveTab('chat')}
                            className="p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 cursor-pointer transition-all flex items-center justify-between"
                          >
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 font-bold flex items-center justify-center">
                                SA
                              </div>
                              <div>
                                <span className="font-bold text-slate-900 block">School Administration</span>
                                <span className="text-slate-500 text-[11px] truncate max-w-[140px] block">
                                  Good morning everyone, staff meeting...
                                </span>
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <span className="text-[10px] text-slate-400">08:45 AM</span>
                              <span className="w-4 h-4 rounded-full bg-emerald-500 text-white text-[10px] font-bold flex items-center justify-center mt-0.5 ml-auto">
                                2
                              </span>
                            </div>
                          </div>

                          <div
                            onClick={() => setActiveTab('chat')}
                            className="p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 cursor-pointer transition-all flex items-center justify-between"
                          >
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center">
                                HR
                              </div>
                              <div>
                                <span className="font-bold text-slate-900 block">Human Resources</span>
                                <span className="text-slate-500 text-[11px] truncate max-w-[140px] block">
                                  Please submit your attendance report...
                                </span>
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <span className="text-[10px] text-slate-400">Yesterday</span>
                              <span className="w-4 h-4 rounded-full bg-emerald-500 text-white text-[10px] font-bold flex items-center justify-center mt-0.5 ml-auto">
                                1
                              </span>
                            </div>
                          </div>

                          <div
                            onClick={() => setActiveTab('chat')}
                            className="p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 cursor-pointer transition-all flex items-center justify-between"
                          >
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-700 font-bold flex items-center justify-center">
                                AD
                              </div>
                              <div>
                                <span className="font-bold text-slate-900 block">Accounts Department</span>
                                <span className="text-slate-500 text-[11px] truncate max-w-[140px] block">
                                  Reminder: Salary advance requests...
                                </span>
                              </div>
                            </div>
                            <span className="text-[10px] text-slate-400">Yesterday</span>
                          </div>
                        </div>
                      </div>

                      {/* Announcements Widget */}
                      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm space-y-3">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                          <h4 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                            <Megaphone size={16} className="text-emerald-600" /> Announcements
                          </h4>
                          <button
                            onClick={() => setActiveTab('announcements')}
                            className="text-xs font-bold text-emerald-600 hover:underline flex items-center gap-0.5"
                          >
                            <span>View All</span>
                            <ArrowRight size={12} />
                          </button>
                        </div>

                        <div className="space-y-2.5 text-xs">
                          {announcementsList.map((item) => {
                            const Icon = item.icon;
                            return (
                              <div
                                key={item.id}
                                onClick={() => setSelectedAnnouncement(item)}
                                className="p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 cursor-pointer transition-all flex items-start gap-2.5"
                              >
                                <div className={`p-2 rounded-lg ${item.iconBg} shrink-0`}>
                                  <Icon size={15} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between">
                                    <span className="font-bold text-slate-900 truncate">{item.title}</span>
                                    <span className="text-[10px] text-slate-400 shrink-0">{item.time}</span>
                                  </div>
                                  <p className="text-slate-500 text-[11px] line-clamp-1 mt-0.5">
                                    {item.description}
                                  </p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* RIGHT COLUMN (4 Cols) */}
                  <div className="lg:col-span-4 space-y-6">
                    {/* LOCATION CARD (Last Clocked In) */}
                    <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm space-y-4">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                        <h4 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                          <MapPin size={16} className="text-emerald-600" /> Your Location
                        </h4>
                        <button
                          onClick={() => openUnderDev('Live GPS Map')}
                          className="text-xs font-bold text-emerald-600 hover:underline flex items-center gap-0.5"
                        >
                          <span>View Full Map</span>
                          <ArrowRight size={12} />
                        </button>
                      </div>

                      {/* Map Box Simulation */}
                      <div className="relative h-36 bg-slate-200 rounded-xl overflow-hidden border border-slate-200 flex items-center justify-center">
                        <div
                          className="absolute inset-0 bg-cover bg-center opacity-70"
                          style={{
                            backgroundImage:
                              'radial-gradient(circle, #00000010 1px, transparent 1px)',
                            backgroundSize: '16px 16px',
                          }}
                        />

                        {/* Location Pin Badge */}
                        <div className="relative z-10 bg-white border border-slate-300 rounded-xl p-2 shadow-lg flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold text-xs shadow-md">
                            <ShieldCheck size={16} />
                          </div>
                          <div>
                            <span className="font-bold text-xs text-slate-900 block leading-tight">
                              Main Gate
                            </span>
                            <span className="text-[10px] text-slate-500 block">{schoolName}</span>
                          </div>
                        </div>
                      </div>

                      {/* Address & GPS Details */}
                      <div className="space-y-2 text-xs">
                        <div className="flex items-center gap-2 text-slate-600">
                          <MapPin size={14} className="text-slate-400 shrink-0" />
                          <span>{todayAttendance.address}</span>
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100">
                          <span>Coords: {todayAttendance.gpsCoords}</span>
                          <span>Time: {todayAttendance.clockIn}</span>
                        </div>
                        <div className="bg-emerald-50 border border-emerald-100 text-emerald-700 text-[11px] font-bold p-2 rounded-lg flex items-center gap-1.5">
                          <CheckCircle2 size={13} />
                          <span>GPS Verified • Inside School Geofence</span>
                        </div>
                      </div>
                    </div>

                    {/* MY RIDE CARD */}
                    <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm space-y-4">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                        <h4 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                          <Car size={16} className="text-emerald-600" /> My Ride
                        </h4>
                        <button
                          onClick={() => openUnderDev('My Ride Management')}
                          className="text-xs font-bold text-emerald-600 hover:underline flex items-center gap-0.5"
                        >
                          <span>View All Rides</span>
                          <ArrowRight size={12} />
                        </button>
                      </div>

                      {/* Ride Choices */}
                      <div className="grid grid-cols-2 gap-3">
                        {/* Shared Ride */}
                        <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 flex flex-col justify-between">
                          <div>
                            <span className="font-bold text-xs text-slate-900 block mb-0.5">Shared Ride</span>
                            <p className="text-[10px] text-slate-500 leading-tight">
                              Affordable & comfortable rides with trusted escorts.
                            </p>
                          </div>
                          <button
                            onClick={() => openUnderDev('Shared Ride Booking')}
                            className="mt-3 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-[11px] py-1.5 px-2 rounded-lg transition-all"
                          >
                            Book Now
                          </button>
                        </div>

                        {/* Executive Ride */}
                        <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 flex flex-col justify-between">
                          <div>
                            <span className="font-bold text-xs text-slate-900 block mb-0.5">
                              Executive Ride
                            </span>
                            <p className="text-[10px] text-slate-500 leading-tight">
                              Premium rides for extra comfort.
                            </p>
                          </div>
                          <button
                            onClick={() => openUnderDev('Executive Ride Booking')}
                            className="mt-3 bg-[#0A1128] hover:bg-[#121E42] text-white font-bold text-[11px] py-1.5 px-2 rounded-lg transition-all"
                          >
                            Book Now
                          </button>
                        </div>
                      </div>

                      {/* Quick Icons Strip */}
                      <div className="grid grid-cols-4 gap-2 text-center pt-2 border-t border-slate-100 text-[10px] font-semibold text-slate-600">
                        <button
                          onClick={() => openUnderDev('Ride History')}
                          className="p-2 rounded-lg hover:bg-slate-50 flex flex-col items-center gap-1"
                        >
                          <Clock size={16} className="text-slate-500" />
                          <span>Ride History</span>
                        </button>
                        <button
                          onClick={() => openUnderDev('Saved Places')}
                          className="p-2 rounded-lg hover:bg-slate-50 flex flex-col items-center gap-1"
                        >
                          <MapPin size={16} className="text-slate-500" />
                          <span>Saved Places</span>
                        </button>
                        <button
                          onClick={() => openUnderDev('Payment Methods')}
                          className="p-2 rounded-lg hover:bg-slate-50 flex flex-col items-center gap-1"
                        >
                          <Sliders size={16} className="text-slate-500" />
                          <span>Payments</span>
                        </button>
                        <button
                          onClick={() => openUnderDev('Ride Notifications')}
                          className="p-2 rounded-lg hover:bg-slate-50 flex flex-col items-center gap-1"
                        >
                          <Bell size={16} className="text-slate-500" />
                          <span>Alerts</span>
                        </button>
                      </div>
                    </div>

                    {/* RIDE SMART PROMO BANNER */}
                    <div className="bg-[#0A1128] rounded-2xl p-5 text-white shadow-md relative overflow-hidden space-y-3">
                      <div className="relative z-10">
                        <h4 className="font-extrabold text-base mb-1">Ride Smart. Ride Safe.</h4>
                        <p className="text-xs text-slate-300 mb-3">Book your ride today with MyEduRide</p>
                        <button
                          onClick={() => openUnderDev('Ride Booking')}
                          className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs py-2 px-4 rounded-xl flex items-center gap-2 transition-all shadow-md shadow-emerald-500/20"
                        >
                          <span>Book a Ride Now</span>
                          <ArrowRight size={14} />
                        </button>
                      </div>
                    </div>

                    {/* MIGO AI ASSISTANT WIDGET */}
                    <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm space-y-3">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center font-black text-xs shadow-md">
                            <Sparkles size={16} />
                          </div>
                          <div>
                            <span className="font-extrabold text-xs text-slate-900 block">MIGO</span>
                            <span className="text-[10px] text-emerald-600 font-semibold block">Your AI Assistant</span>
                          </div>
                        </div>
                        <button
                          onClick={() => setMigoMessages([{ sender: 'bot', text: 'Hello Sarah! 👋 How can I help you today?' }])}
                          className="text-slate-400 hover:text-slate-600 p-1"
                        >
                          <RefreshCw size={14} />
                        </button>
                      </div>

                      {/* Chat Messages */}
                      <div className="space-y-2 max-h-36 overflow-y-auto text-xs p-1">
                        {migoMessages.map((msg, index) => (
                          <div
                            key={index}
                            className={`p-2.5 rounded-xl ${
                              msg.sender === 'user'
                                ? 'bg-[#0A1128] text-white ml-auto max-w-[80%]'
                                : 'bg-slate-100 text-slate-800 mr-auto max-w-[90%]'
                            }`}
                          >
                            {msg.text}
                          </div>
                        ))}
                      </div>

                      {/* Quick Prompt Pills */}
                      <div className="flex flex-wrap gap-1.5 pt-2 border-t border-slate-100 text-[10px] font-semibold">
                        <button
                          onClick={() => handleMigoPrompt('My Attendance')}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-full transition-all"
                        >
                          My Attendance
                        </button>
                        <button
                          onClick={() => handleMigoPrompt('Book a Ride')}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-full transition-all"
                        >
                          Book a Ride
                        </button>
                        <button
                          onClick={() => handleMigoPrompt("Today's Schedule")}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-full transition-all"
                        >
                          Today's Schedule
                        </button>
                        <button
                          onClick={() => handleMigoPrompt('Help')}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-full transition-all"
                        >
                          Help
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: DETAILED ATTENDANCE */}
            {activeTab === 'attendance' && (
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <div>
                    <h3 className="font-extrabold text-xl text-slate-900">Today's Attendance Detail</h3>
                    <p className="text-xs text-slate-500">
                      Captured via Gate Manager System Terminal at {schoolName}
                    </p>
                  </div>
                  <button
                    onClick={() => setActiveTab('dashboard')}
                    className="text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 px-3 py-1.5 rounded-lg flex items-center gap-1"
                  >
                    <ChevronLeft size={14} /> Back to Dashboard
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Left Box: Status */}
                  <div className="space-y-4">
                    <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold shadow-md">
                        <CheckCircle2 size={24} />
                      </div>
                      <div>
                        <span className="text-xs font-bold uppercase text-emerald-800 block">
                          ATTENDANCE VERIFIED
                        </span>
                        <span className="font-extrabold text-xl text-emerald-900 block">
                          Present (On Time)
                        </span>
                        <span className="text-xs text-emerald-700">Clocked in at {todayAttendance.clockIn}</span>
                      </div>
                    </div>

                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3 text-xs">
                      <div className="flex justify-between py-1 border-b border-slate-200/60">
                        <span className="text-slate-500">Date</span>
                        <span className="font-bold text-slate-900">{todayAttendance.dateStr}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-200/60">
                        <span className="text-slate-500">Clock-In Time</span>
                        <span className="font-bold text-slate-900">{todayAttendance.clockIn}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-200/60">
                        <span className="text-slate-500">Clock-Out Time</span>
                        <span className="font-bold text-slate-900">{todayAttendance.clockOut}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-200/60">
                        <span className="text-slate-500">Scanned By Officer</span>
                        <span className="font-bold text-slate-900">{todayAttendance.scannedBy}</span>
                      </div>
                    </div>
                  </div>

                  {/* Right Box: Geofence & Location */}
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-4">
                    <h4 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                      <MapPin size={16} className="text-emerald-600" /> Geofence & Location Verification
                    </h4>
                    <div className="space-y-2 text-xs">
                      <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-1">
                        <span className="text-slate-400 font-medium">Terminal Address</span>
                        <span className="font-bold text-slate-800 block">{todayAttendance.address}</span>
                      </div>
                      <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-1">
                        <span className="text-slate-400 font-medium">GPS Coordinates</span>
                        <span className="font-mono font-bold text-slate-800 block">
                          {todayAttendance.gpsCoords}
                        </span>
                      </div>
                      <div className="bg-emerald-100/70 border border-emerald-200 text-emerald-800 font-bold p-3 rounded-xl flex items-center gap-2">
                        <ShieldCheck size={18} className="text-emerald-600" />
                        <span>Attendance Terminal Gate Scan Active & Verified</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: ATTENDANCE HISTORY */}
            {activeTab === 'history' && (
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                  <div>
                    <h3 className="font-extrabold text-xl text-slate-900">Attendance History Logs</h3>
                    <p className="text-xs text-slate-500">Filter and view past attendance records</p>
                  </div>

                  {/* Filter Pills */}
                  <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
                    <button
                      onClick={() => setFilter('daily')}
                      className={`px-3 py-1.5 rounded-lg transition-all ${
                        filter === 'daily' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                      }`}
                    >
                      Daily
                    </button>
                    <button
                      onClick={() => setFilter('weekly')}
                      className={`px-3 py-1.5 rounded-lg transition-all ${
                        filter === 'weekly' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                      }`}
                    >
                      Weekly
                    </button>
                    <button
                      onClick={() => setFilter('monthly')}
                      className={`px-3 py-1.5 rounded-lg transition-all ${
                        filter === 'monthly' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                      }`}
                    >
                      Monthly
                    </button>
                  </div>
                </div>

                {loadingHistory ? (
                  <div className="py-12 text-center text-slate-400 text-sm font-medium">
                    Loading attendance history logs...
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                          <th className="py-3 px-3">Date</th>
                          <th className="py-3 px-3">Status</th>
                          <th className="py-3 px-3">Clock-In</th>
                          <th className="py-3 px-3">Clock-Out</th>
                          <th className="py-3 px-3">Gate Terminal</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        <tr className="hover:bg-slate-50">
                          <td className="py-3.5 px-3 font-bold text-slate-900">Today ({clockDisplay.dateStr})</td>
                          <td className="py-3.5 px-3">
                            <span className="bg-emerald-100 text-emerald-800 text-[11px] font-bold px-2.5 py-1 rounded-full border border-emerald-200">
                              Present (On Time)
                            </span>
                          </td>
                          <td className="py-3.5 px-3 font-semibold text-slate-800">{todayAttendance.clockIn}</td>
                          <td className="py-3.5 px-3 font-semibold text-slate-800">{todayAttendance.clockOut}</td>
                          <td className="py-3.5 px-3 text-slate-600">Main Gate - Fortune Springs</td>
                        </tr>
                        <tr className="hover:bg-slate-50">
                          <td className="py-3.5 px-3 font-bold text-slate-900">Yesterday (22 May 2026)</td>
                          <td className="py-3.5 px-3">
                            <span className="bg-emerald-100 text-emerald-800 text-[11px] font-bold px-2.5 py-1 rounded-full border border-emerald-200">
                              Present (On Time)
                            </span>
                          </td>
                          <td className="py-3.5 px-3 font-semibold text-slate-800">07:35 AM</td>
                          <td className="py-3.5 px-3 font-semibold text-slate-800">04:30 PM</td>
                          <td className="py-3.5 px-3 text-slate-600">Main Gate - Fortune Springs</td>
                        </tr>
                        <tr className="hover:bg-slate-50">
                          <td className="py-3.5 px-3 font-bold text-slate-900">21 May 2026</td>
                          <td className="py-3.5 px-3">
                            <span className="bg-amber-100 text-amber-800 text-[11px] font-bold px-2.5 py-1 rounded-full border border-amber-200">
                              Late
                            </span>
                          </td>
                          <td className="py-3.5 px-3 font-semibold text-slate-800">08:12 AM</td>
                          <td className="py-3.5 px-3 font-semibold text-slate-800">04:20 PM</td>
                          <td className="py-3.5 px-3 text-slate-600">Main Gate - Fortune Springs</td>
                        </tr>
                        <tr className="hover:bg-slate-50">
                          <td className="py-3.5 px-3 font-bold text-slate-900">20 May 2026</td>
                          <td className="py-3.5 px-3">
                            <span className="bg-emerald-100 text-emerald-800 text-[11px] font-bold px-2.5 py-1 rounded-full border border-emerald-200">
                              Present (On Time)
                            </span>
                          </td>
                          <td className="py-3.5 px-3 font-semibold text-slate-800">07:40 AM</td>
                          <td className="py-3.5 px-3 font-semibold text-slate-800">04:25 PM</td>
                          <td className="py-3.5 px-3 text-slate-600">Main Gate - Fortune Springs</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* TAB 4: EDUCHAT */}
            {activeTab === 'chat' && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col md:flex-row h-[600px]">
                {/* Conversations Sidebar */}
                <div className="w-full md:w-80 border-r border-slate-200 bg-slate-50 p-4 flex flex-col justify-between shrink-0">
                  <div className="space-y-4">
                    <h3 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
                      <MessageSquare className="text-emerald-600" size={18} /> EduChat
                    </h3>

                    {/* Recipient Type Segmented Control */}
                    <div className="grid grid-cols-2 gap-1 bg-slate-200 p-1 rounded-xl text-xs font-bold">
                      <button
                        onClick={() => setChatRecipientType('teacher')}
                        className={`py-1.5 rounded-lg transition-all ${
                          chatRecipientType === 'teacher'
                            ? 'bg-white text-slate-900 shadow-sm'
                            : 'text-slate-600'
                        }`}
                      >
                        Staff / Teacher
                      </button>
                      <button
                        onClick={() => setChatRecipientType('school')}
                        className={`py-1.5 rounded-lg transition-all ${
                          chatRecipientType === 'school'
                            ? 'bg-white text-slate-900 shadow-sm'
                            : 'text-slate-600'
                        }`}
                      >
                        School Admin
                      </button>
                    </div>

                    {/* Search */}
                    <div className="relative">
                      <Search size={14} className="absolute left-3 top-3 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Search conversations..."
                        value={chatSearch}
                        onChange={(e) => setChatSearch(e.target.value)}
                        className="w-full pl-8 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-emerald-300"
                      />
                    </div>

                    {/* Conversation List */}
                    <div className="space-y-2 overflow-y-auto max-h-[360px] pr-1">
                      {students
                        .filter((s) => s.full_name?.toLowerCase().includes(chatSearch.toLowerCase()))
                        .map((stud) => (
                          <div
                            key={stud.id}
                            onClick={() => setSelectedStudent(stud)}
                            className={`p-3 rounded-xl cursor-pointer transition-all flex items-center gap-3 ${
                              selectedStudent?.id === stud.id
                                ? 'bg-emerald-500 text-white font-semibold shadow-md'
                                : 'bg-white hover:bg-slate-100 text-slate-800 border border-slate-200/80'
                            }`}
                          >
                            <StudentAvatar name={stud.full_name || 'Student'} size={36} />
                            <div className="flex-1 min-w-0">
                              <span className="font-bold text-xs block truncate">{stud.full_name}</span>
                              <span
                                className={`text-[11px] block truncate ${
                                  selectedStudent?.id === stud.id ? 'text-emerald-100' : 'text-slate-400'
                                }`}
                              >
                                {stud.last_message?.message || 'Tap to chat'}
                              </span>
                            </div>
                          </div>
                        ))}
                      {students.length === 0 && (
                        <div className="py-8 text-center text-slate-400 text-xs">
                          No active chat recipients found.
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Chat Window */}
                <div className="flex-1 flex flex-col justify-between bg-white p-4">
                  {selectedStudent ? (
                    <>
                      {/* Chat Header */}
                      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                        <div className="flex items-center gap-3">
                          <StudentAvatar name={selectedStudent.full_name} size={40} />
                          <div>
                            <h4 className="font-bold text-sm text-slate-900">{selectedStudent.full_name}</h4>
                            <span className="text-[11px] text-emerald-600 font-semibold">Online • EduChat</span>
                          </div>
                        </div>
                      </div>

                      {/* Chat Messages Log */}
                      <div className="flex-1 overflow-y-auto py-4 space-y-3 px-2">
                        {chatHistory.map((m, idx) => {
                          const isMe = m.sender_id === session?.user_id;
                          return (
                            <div
                              key={m.id || idx}
                              className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                            >
                              <div
                                className={`max-w-[75%] p-3 rounded-2xl text-xs font-medium ${
                                  isMe
                                    ? 'bg-[#0A1128] text-white rounded-br-none'
                                    : 'bg-slate-100 text-slate-800 rounded-bl-none'
                                }`}
                              >
                                {m.content || m.message}
                              </div>
                              <span className="text-[10px] text-slate-400 mt-1 px-1">
                                {m.created_at
                                  ? new Date(m.created_at).toLocaleTimeString([], {
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    })
                                  : 'Just now'}
                              </span>
                            </div>
                          );
                        })}
                        <div ref={messagesEndRef} />
                      </div>

                      {/* Message Input Box */}
                      <div className="pt-3 border-t border-slate-100 flex items-center gap-2">
                        <input
                          type="text"
                          placeholder="Type your message..."
                          value={chatText}
                          onChange={(e) => setChatText(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleSendChat()}
                          className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-emerald-400"
                        />
                        <button
                          onClick={handleSendChat}
                          disabled={sendingChat || !chatText.trim()}
                          className="bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white p-2.5 rounded-xl transition-all shadow-md"
                        >
                          <Send size={16} />
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-2">
                      <MessageSquare size={40} className="text-slate-300" />
                      <p className="text-sm font-semibold">Select a conversation to start chatting</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 5: ANNOUNCEMENTS */}
            {activeTab === 'announcements' && (
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <div>
                    <h3 className="font-extrabold text-xl text-slate-900">Staff Announcements</h3>
                    <p className="text-xs text-slate-500">Official circulars and school updates</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {announcementsList.map((item) => {
                    const Icon = item.icon;
                    return (
                      <div
                        key={item.id}
                        onClick={() => setSelectedAnnouncement(item)}
                        className="bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-2xl p-5 cursor-pointer transition-all space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <div className={`p-2.5 rounded-xl ${item.iconBg}`}>
                            <Icon size={20} />
                          </div>
                          <span className="text-xs text-slate-400 font-medium">{item.time}</span>
                        </div>
                        <div>
                          <h4 className="font-bold text-base text-slate-900">{item.title}</h4>
                          <p className="text-xs text-slate-600 mt-1 line-clamp-3 leading-relaxed">
                            {item.description}
                          </p>
                        </div>
                        <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between text-xs text-emerald-600 font-bold">
                          <span>{item.date}</span>
                          <ArrowRight size={14} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* TAB 6: MY PROFILE */}
            {activeTab === 'profile' && (
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <div>
                    <h3 className="font-extrabold text-xl text-slate-900">My Staff Profile</h3>
                    <p className="text-xs text-slate-500">Verified Employee Information</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Left Photo & ID Card Badge */}
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 flex flex-col items-center text-center space-y-4">
                    <div className="w-24 h-24 rounded-full bg-[#0A1128] text-white text-3xl font-extrabold flex items-center justify-center border-4 border-emerald-500 shadow-lg">
                      {session?.full_name ? session.full_name.charAt(0) : 'S'}
                    </div>
                    <div>
                      <h4 className="font-extrabold text-lg text-slate-900">
                        {session?.full_name || 'Sarah Johnson'}
                      </h4>
                      <p className="text-xs text-emerald-600 font-bold mt-0.5">
                        {jobTitle || 'Administrative Officer'}
                      </p>
                    </div>
                    <div className="bg-white px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-mono text-slate-700">
                      Staff ID: FSM-1428
                    </div>
                  </div>

                  {/* Right Details Grid */}
                  <div className="md:col-span-2 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                      <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                        <span className="text-slate-400 font-medium block">Full Name</span>
                        <span className="font-bold text-slate-900 text-sm">
                          {session?.full_name || 'Sarah Johnson'}
                        </span>
                      </div>
                      <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                        <span className="text-slate-400 font-medium block">Email Address</span>
                        <span className="font-bold text-slate-900 text-sm">
                          {session?.email || 'sarah.johnson@eduride.com'}
                        </span>
                      </div>
                      <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                        <span className="text-slate-400 font-medium block">Assigned School</span>
                        <span className="font-bold text-slate-900 text-sm">{schoolName}</span>
                      </div>
                      <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                        <span className="text-slate-400 font-medium block">Department</span>
                        <span className="font-bold text-slate-900 text-sm">Administration</span>
                      </div>
                      <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                        <span className="text-slate-400 font-medium block">Account Role</span>
                        <span className="font-bold text-slate-900 text-sm uppercase">Staff Member</span>
                      </div>
                      <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                        <span className="text-slate-400 font-medium block">System Status</span>
                        <span className="font-bold text-emerald-600 text-sm">Active & Verified</span>
                      </div>
                    </div>

                    <div className="pt-4 border-t border-slate-100 flex justify-end">
                      <button
                        onClick={handleLogout}
                        className="bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 font-bold text-xs px-4 py-2.5 rounded-xl flex items-center gap-2 transition-all"
                      >
                        <LogOut size={16} /> Sign Out of Account
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 7: SETTINGS */}
            {activeTab === 'settings' && (
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6 max-w-2xl">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <div>
                    <h3 className="font-extrabold text-xl text-slate-900">Account Settings</h3>
                    <p className="text-xs text-slate-500">Manage security and password</p>
                  </div>
                </div>

                <form onSubmit={handlePasswordChange} className="space-y-4 text-xs">
                  <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                    <Lock size={16} className="text-emerald-600" /> Change Password
                  </h4>

                  <div className="space-y-1">
                    <label className="font-semibold text-slate-700">Current Password</label>
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Enter current password"
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-400"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-semibold text-slate-700">New Password</label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Enter new password"
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-400"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-semibold text-slate-700">Confirm New Password</label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm new password"
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-400"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={updatingPassword}
                    className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-2.5 px-5 rounded-xl transition-all shadow-md disabled:opacity-50"
                  >
                    {updatingPassword ? 'Updating...' : 'Save New Password'}
                  </button>
                </form>
              </div>
            )}
          </div>

          {/* ANNOUNCEMENT DETAIL MODAL */}
          {selectedAnnouncement && (
            <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <Megaphone className="text-emerald-600" size={20} />
                    <h3 className="font-extrabold text-base text-slate-900">{selectedAnnouncement.title}</h3>
                  </div>
                  <button
                    onClick={() => setSelectedAnnouncement(null)}
                    className="text-slate-400 hover:text-slate-600 p-1"
                  >
                    <X size={18} />
                  </button>
                </div>
                <div className="space-y-2 text-xs text-slate-700">
                  <p className="font-semibold text-slate-500">Date: {selectedAnnouncement.date}</p>
                  <p className="leading-relaxed text-slate-800 text-sm bg-slate-50 p-4 rounded-xl border border-slate-200">
                    {selectedAnnouncement.description}
                  </p>
                </div>
                <div className="flex justify-end pt-2">
                  <button
                    onClick={() => setSelectedAnnouncement(null)}
                    className="bg-[#0A1128] text-white font-bold text-xs py-2 px-4 rounded-xl"
                  >
                    Close Notice
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* UNDER DEVELOPMENT MODAL */}
          {underDevModal.open && (
            <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl text-center space-y-5 border border-slate-100">
                <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
                  <Sparkles size={32} className="animate-bounce" />
                </div>
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                    COMING SOON
                  </span>
                  <h3 className="font-extrabold text-xl text-slate-900 mt-2">
                    {underDevModal.feature} Under Development
                  </h3>
                  <p className="text-xs text-slate-500 mt-2 leading-relaxed px-2">
                    This page or feature is currently undergoing active development by the MyEduRide product team. Check back soon for full functionality!
                  </p>
                </div>
                <button
                  onClick={() => setUnderDevModal({ open: false, feature: '' })}
                  className="w-full bg-[#0A1128] hover:bg-[#121E42] text-white font-bold text-xs py-3 px-5 rounded-xl shadow-lg transition-all"
                >
                  Return to Dashboard
                </button>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* FIXED BOTTOM FOOTER BAR (Dark Navy #0A1128) */}
      <footer className="bg-[#0A1128] border-t border-white/10 text-white py-3 px-6 text-xs flex flex-col md:flex-row items-center justify-between gap-3 z-40">
        <div className="flex items-center gap-4 text-slate-300">
          <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
            <ShieldCheck size={16} />
            <span>Gate Manager Verified</span>
          </div>
          <span className="text-slate-600">•</span>
          <div className="flex items-center gap-1.5 text-slate-300">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Live GPS Active</span>
          </div>
        </div>

        <div className="flex items-center gap-6 text-slate-400 text-[11px]">
          <span>Support: support@myeduride.com</span>
          <span className="text-slate-600">|</span>
          <div className="flex items-center gap-1 font-semibold text-slate-200">
            <span>Powered by DISC Limited</span>
            <span className="bg-white/10 px-1.5 py-0.5 rounded text-[10px] text-emerald-400 font-mono">
              DISC
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
