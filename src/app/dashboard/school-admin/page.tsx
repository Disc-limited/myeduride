// @ts-nocheck
'use client';

import { useEffect, useState, useMemo } from 'react';
import { fetchData, getSession } from '@/lib/api';
import {
  Users,
  GraduationCap,
  UserCheck,
  Shield,
  Car,
  CheckCircle2,
  Eye,
  EyeOff,
  ArrowRight,
  TrendingUp,
  Plus,
  Bell,
  Navigation,
  Sparkles,
  Search,
  ChevronRight,
  Calendar as CalendarIcon,
  MessageSquare,
  Send,
  FileText,
  Wallet as WalletIcon,
  DoorOpen,
  Bot,
  Megaphone,
  ChevronLeft,
  ChevronRight as ChevronRightIcon,
  PlusCircle,
  TrendingDown,
  Gift,
  CreditCard,
  BarChart,
  Check,
} from 'lucide-react';
import Link from 'next/link';
import StudentAvatar from '@/components/shared/StudentAvatar';

export default function SchoolAdminDashboard() {
  const [schoolName, setSchoolName] = useState('Greenfield International School');
  const [userName, setUserName] = useState('Admin');
  const [showWalletBalance, setShowWalletBalance] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());

  const [dbActivities, setDbActivities] = useState<any[]>([]);
  const [dbNotifications, setDbNotifications] = useState<any[]>([]);

  const [stats, setStats] = useState({
    total_students: 0,
    total_teachers: 0,
    total_parents: 0,
    total_escorts: 0,
    vehicles_online: 0,
    safety_alerts: 0,
    student_stats: { present: 0, absent: 0, late: 0, total: 0 },
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setInterval(() => setCurrentDate(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const session = getSession();
    if (session) {
      if (session.full_name) {
        const parts = session.full_name.trim().split(/\s+/);
        // Exclude generic prefixes like "Mr" or "Mrs" to extract proper admin name
        const namePart = parts.find((p) => p.length > 2 && !['mr', 'mrs', 'dr', 'prof', 'ms'].includes(p.toLowerCase())) || parts[0];
        setUserName(namePart);
      }
      if (session.primary_school?.name) {
        setSchoolName(session.primary_school.name);
      }
    }
    loadDashboard();
  }, []);

  const greetingPrefix = useMemo(() => {
    const hour = currentDate.getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }, [currentDate]);

  const formattedDateStr = useMemo(() => {
    return currentDate.toLocaleDateString('en-US', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }, [currentDate]);

  const formattedTimeStr = useMemo(() => {
    return currentDate.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }, [currentDate]);

  const calendarData = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const monthName = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const todayNum = currentDate.getDate();

    const firstDayIndex = new Date(year, month, 1).getDay();
    const startOffset = (firstDayIndex + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const prevMonthDays = new Date(year, month, 0).getDate();

    const cells = [];
    for (let i = startOffset - 1; i >= 0; i--) {
      cells.push({ num: prevMonthDays - i, currentMonth: false });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({ num: d, currentMonth: true, isToday: d === todayNum });
    }
    const remaining = 35 - cells.length;
    for (let i = 1; i <= (remaining > 0 ? remaining : 0); i++) {
      cells.push({ num: i, currentMonth: false });
    }

    return { monthName, cells };
  }, [currentDate]);

  const loadDashboard = async () => {
    try {
      const schoolData = await fetchData('get_school_admin_data', { role: 'school_admin' });
      if (schoolData.school?.name) {
        setSchoolName(schoolData.school.name);
      }
      const dashboard = await fetchData('get_school_dashboard', { school_id: schoolData.school_id });
      if (dashboard) {
        setStats({
          total_students: dashboard.total_students ?? 0,
          total_teachers: dashboard.total_teachers ?? 0,
          total_parents: dashboard.total_parents ?? 0,
          total_escorts: 0,
          vehicles_online: 0,
          safety_alerts: 0,
          student_stats: dashboard.student_stats || { present: 0, absent: 0, late: 0, total: 0 },
        });
        if (Array.isArray(dashboard.recent_activity)) {
          setDbActivities(dashboard.recent_activity);
        }
      }

      // Fetch real notifications from inbox endpoint
      try {
        const notifRes = await fetchData(`notifications/inbox?school_id=${schoolData.school_id}&limit=10`);
        if (notifRes?.notifications && Array.isArray(notifRes.notifications)) {
          setDbNotifications(notifRes.notifications);
        }
      } catch {
        /* ignore */
      }
    } catch {
      /* ignore */
    }
    setLoading(false);
  };

  const metricCards = useMemo(
    () => [
      {
        title: 'Students',
        value: stats.total_students,
        change: 'Active',
        bgColor: 'bg-emerald-50 text-emerald-600',
        icon: <Users size={20} />,
      },
      {
        title: 'Staff',
        value: stats.total_teachers,
        change: 'Active',
        bgColor: 'bg-amber-50 text-amber-600',
        icon: <GraduationCap size={20} />,
      },
      {
        title: 'Parents',
        value: stats.total_parents,
        change: 'Active',
        bgColor: 'bg-blue-50 text-blue-600',
        icon: <UserCheck size={20} />,
      },
      {
        title: 'Active Escorts',
        value: 0,
        change: 'Not Configured',
        bgColor: 'bg-rose-50 text-rose-600',
        icon: <Shield size={20} />,
      },
      {
        title: 'Vehicles Online',
        value: 0,
        change: 'Offline',
        bgColor: 'bg-sky-50 text-sky-600',
        icon: <Car size={20} />,
      },
      {
        title: 'Safety Alerts',
        value: 0,
        change: 'All Clear',
        bgColor: 'bg-emerald-50 text-emerald-600',
        icon: <CheckCircle2 size={20} />,
      },
    ],
    [stats.total_students, stats.total_teachers, stats.total_parents]
  );

  const quickActions = [
    { label: 'Add Student', icon: <Plus size={18} />, color: 'bg-emerald-100 text-emerald-700', href: '/dashboard/school-admin/students/new' },
    { label: 'Add Staff', icon: <Plus size={18} />, color: 'bg-purple-100 text-purple-700', href: '/dashboard/school-admin/staff/new' },
    { label: 'Add School Escort', icon: <Shield size={18} />, color: 'bg-[#00A859] text-white font-extrabold shadow-sm', href: '/dashboard/school-admin/transport/escorts/add' },
    { label: 'School Escorts', icon: <Users size={18} />, color: 'bg-teal-100 text-teal-700', href: '/dashboard/school-admin/transport/escorts' },
    { label: 'Pickup List', icon: <Car size={18} />, color: 'bg-blue-100 text-blue-700', href: '/dashboard/school-admin/pickup-persons' },
    { label: 'Add Vehicle', icon: <Car size={18} />, color: 'bg-emerald-100 text-emerald-700', href: '/dashboard/school-admin/vehicles' },
    { label: 'Send Notice', icon: <Send size={18} />, color: 'bg-sky-100 text-sky-700', href: '/dashboard/school-admin/messages' },
    { label: 'View Reports', icon: <FileText size={18} />, color: 'bg-cyan-100 text-cyan-700', href: '/dashboard/school-admin/reports' },
    { label: 'Wallet', icon: <WalletIcon size={18} />, color: 'bg-amber-100 text-amber-700', href: '/dashboard/school-admin/wallet' },
    { label: 'Gate Manager', icon: <DoorOpen size={18} />, color: 'bg-rose-100 text-rose-700', href: '/dashboard/gate' },
    { label: 'Ask Migo', icon: <Bot size={18} />, color: 'bg-emerald-600 text-white shadow-md shadow-emerald-900/30', href: '#migo', isMigo: true },
  ];

  const activityLogs = useMemo(() => {
    if (!dbActivities || dbActivities.length === 0) return [];
    return dbActivities.slice(0, 5).map((item) => {
      const time = item.timestamp
        ? new Date(item.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
        : 'Today';
      const actionText =
        item.type === 'clock_in' || item.type === 'arrival'
          ? 'checked in'
          : item.type === 'dismissal'
          ? 'dismissed'
          : 'checked out';
      return {
        time,
        text: `${item.name || 'Member'} ${actionText}`,
        location: item.entity_type === 'staff' ? 'Gate 1 / Staff' : item.role_or_class || 'Gate 1',
        color:
          item.status === 'late'
            ? 'bg-amber-500'
            : item.type === 'arrival' || item.type === 'clock_in'
            ? 'bg-emerald-500'
            : 'bg-blue-500',
      };
    });
  }, [dbActivities]);

  const recentNotifications = useMemo(() => {
    if (!dbNotifications || dbNotifications.length === 0) return [];
    return dbNotifications.slice(0, 4).map((n) => {
      const time = n.created_at
        ? new Date(n.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
        : 'Today';
      const msg = n.title || n.message || 'Notification';
      const statusTag = n.type || (msg.toLowerCase().includes('check') ? 'Activity' : 'Notice');
      const statusColor = n.is_read
        ? 'bg-slate-100 text-slate-600'
        : 'bg-emerald-100 text-emerald-800 font-bold';

      return {
        id: n.id,
        text: msg,
        time: `${time} • ${n.type || 'Gate Manager'}`,
        status: statusTag,
        statusColor,
      };
    });
  }, [dbNotifications]);

  const upcomingEvents = [
    { title: 'PTA Meeting', date: 'Tue, 16 Jul 2026 • 10:00 AM', color: 'bg-purple-500' },
    { title: 'Mid-Term Break', date: 'Jul 28 - Aug 3, 2026', color: 'bg-emerald-500' },
    { title: 'End of Term', date: 'Aug 30, 2026', color: 'bg-rose-500' },
  ];

  const attendanceStats = useMemo(() => {
    const sStats = stats.student_stats || { present: 0, absent: 0, late: 0, total: 0 };
    const total = stats.total_students || sStats.total || 0;
    const present = sStats.present || 0;
    const absent = sStats.absent || 0;
    const late = sStats.late || 0;

    const presentPct = total > 0 ? ((present / total) * 100).toFixed(1) : '0.0';
    const absentPct = total > 0 ? ((absent / total) * 100).toFixed(1) : '0.0';
    const latePct = total > 0 ? ((late / total) * 100).toFixed(1) : '0.0';
    const overallPct = presentPct;

    const C = 251.2;
    const presentDash = total > 0 ? (present / total) * C : 0;
    const absentDash = total > 0 ? (absent / total) * C : 0;
    const lateDash = total > 0 ? (late / total) * C : 0;

    return {
      total,
      present,
      absent,
      late,
      presentPct,
      absentPct,
      latePct,
      overallPct,
      presentDash,
      absentDash,
      lateDash,
    };
  }, [stats.student_stats, stats.total_students]);

  return (
    <div className="space-y-6 text-slate-800 pb-16">
      {/* 1. TOP SECTION: HERO BANNER & DISC ANNOUNCEMENT CARD */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Hero Green Banner */}
        <div className="lg:col-span-8 rounded-3xl bg-gradient-to-r from-[#023E21] via-[#045930] to-[#0A7340] text-white p-6 sm:p-8 relative overflow-hidden shadow-xl flex flex-col justify-between min-h-[220px]">
          {/* Background Bus Illustration Graphic */}
          <div className="absolute right-0 top-0 bottom-0 w-1/2 opacity-25 pointer-events-none mix-blend-overlay hidden sm:block">
            <img src="/images/landing/hero_main.png" alt="" className="w-full h-full object-cover object-right" />
          </div>

          <div className="relative z-10 space-y-2 max-w-xl">
            <p className="text-emerald-200 text-xs sm:text-sm font-semibold tracking-wide flex items-center gap-1.5">
              {greetingPrefix}, <span className="text-white font-bold">{userName}</span> 👋
            </p>

            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-white leading-tight">
              {schoolName}
            </h1>

            <p className="text-xs sm:text-sm text-emerald-100/90 font-medium">
              Powered by MyEduRide — The Complete Student Safety Platform.
            </p>
          </div>

          {/* Banner Footer Info Bar & Wallet Inset */}
          <div className="relative z-10 pt-6 mt-4 border-t border-emerald-500/30 flex flex-wrap items-end justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3 text-xs font-semibold text-emerald-100 bg-black/20 backdrop-blur-md px-3.5 py-2 rounded-2xl border border-white/10">
              <span className="flex items-center gap-1">
                📅 {formattedDateStr}
              </span>
              <span className="opacity-40">•</span>
              <span className="flex items-center gap-1">
                ⏰ {formattedTimeStr}
              </span>
              <span className="opacity-40">•</span>
              <span className="flex items-center gap-1">
                ⛅ Partly Cloudy 28°C
              </span>
            </div>

            {/* School Wallet Balance Inset Card */}
            <div className="bg-black/30 backdrop-blur-md p-3.5 rounded-2xl border border-white/15 min-w-[200px] shrink-0">
              <div className="flex items-center justify-between gap-2 text-[11px] text-emerald-200 font-semibold mb-1">
                <span>School Wallet Balance</span>
                <button
                  type="button"
                  onClick={() => setShowWalletBalance(!showWalletBalance)}
                  className="text-emerald-300 hover:text-white"
                >
                  {showWalletBalance ? <Eye size={14} /> : <EyeOff size={14} />}
                </button>
              </div>
              <p className="text-xl font-black text-white tracking-tight mb-2">
                {showWalletBalance ? '₦0.00' : '••••••••'}
              </p>
              <button
                type="button"
                disabled
                className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/50 text-slate-900 font-extrabold text-xs rounded-xl cursor-not-allowed opacity-75 shadow-sm"
                title="Wallet system not connected yet"
              >
                <span>Wallet Overview</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        </div>

        {/* Right DISC Announcement Card */}
        <div className="lg:col-span-4 rounded-3xl bg-[#09182D] text-white p-6 shadow-xl relative overflow-hidden flex flex-col justify-between border border-slate-800">
          <div className="flex items-center justify-between text-xs font-black tracking-wider uppercase text-amber-400">
            <span className="flex items-center gap-1.5">
              <Sparkles size={14} /> DISC ANNOUNCEMENT
            </span>
            <span className="px-2 py-0.5 bg-amber-400/20 text-amber-300 rounded text-[10px]">NEW</span>
          </div>

          <div className="my-4 space-y-2 relative z-10">
            <h3 className="text-lg sm:text-xl font-black leading-tight text-white">
              Get 20% off on escort verification this term.
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed font-medium">
              Upgrade your school transport security with instant real-time escort ID checks.
            </p>
          </div>

          {/* Megaphone Graphic Illustration */}
          <div className="absolute right-3 bottom-12 opacity-80 pointer-events-none">
            <Megaphone size={72} className="text-amber-400/30 transform -rotate-12" />
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-slate-800 relative z-10">
            <button
              type="button"
              disabled
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600/50 text-white/80 font-bold text-xs rounded-xl cursor-not-allowed opacity-75 shadow"
            >
              <span>Learn More</span>
              <ArrowRight size={14} />
            </button>

            {/* Slider dots */}
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
              <span className="w-2 h-2 rounded-full bg-slate-700"></span>
              <span className="w-2 h-2 rounded-full bg-slate-700"></span>
              <span className="w-2 h-2 rounded-full bg-slate-700"></span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. METRIC STAT CARDS GRID (6 CARDS) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        {metricCards.map((card) => (
          <div
            key={card.title}
            className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
          >
            <div className="flex items-center justify-between mb-3">
              <div className={`p-2.5 rounded-xl ${card.bgColor}`}>{card.icon}</div>
            </div>
            <div>
              <p className="text-2xl font-black text-slate-900 tracking-tight">{card.value}</p>
              <p className="text-xs font-bold text-slate-800 mt-0.5">{card.title}</p>
              <p className="text-[11px] font-semibold text-emerald-600 mt-1">{card.change}</p>
            </div>
          </div>
        ))}
      </div>

      {/* 3. MIDDLE SECTION GRID (3 COLUMNS: ATTENDANCE, LIVE TRACKER, SAFETY SCORE) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Attendance Donut Chart Card */}
        <div className="lg:col-span-4 bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-extrabold text-slate-900">Today's Attendance</h3>
          </div>

          {/* SVG Donut Chart */}
          <div className="relative flex items-center justify-center my-4">
            <svg className="w-44 h-44 transform -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="40" stroke="#f1f5f9" strokeWidth="12" fill="transparent" />
              {/* Present Circle */}
              {attendanceStats.presentDash > 0 && (
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  stroke="#10B981"
                  strokeWidth="12"
                  fill="transparent"
                  strokeDasharray={`${attendanceStats.presentDash} 251.2`}
                  strokeDashoffset="0"
                  strokeLinecap="round"
                />
              )}
              {/* Absent Circle */}
              {attendanceStats.absentDash > 0 && (
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  stroke="#EF4444"
                  strokeWidth="12"
                  fill="transparent"
                  strokeDasharray={`${attendanceStats.absentDash} 251.2`}
                  strokeDashoffset={`-${attendanceStats.presentDash}`}
                  strokeLinecap="round"
                />
              )}
              {/* Late Circle */}
              {attendanceStats.lateDash > 0 && (
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  stroke="#F59E0B"
                  strokeWidth="12"
                  fill="transparent"
                  strokeDasharray={`${attendanceStats.lateDash} 251.2`}
                  strokeDashoffset={`-${attendanceStats.presentDash + attendanceStats.absentDash}`}
                  strokeLinecap="round"
                />
              )}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="text-2xl font-black text-slate-900">{attendanceStats.overallPct}%</span>
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Overall</span>
            </div>
          </div>

          {/* Breakdown Legend */}
          <div className="space-y-2 text-xs font-semibold pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-slate-700">
                <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" /> Present
              </span>
              <span className="font-bold text-slate-900">
                {attendanceStats.present} <span className="text-slate-400 font-normal">({attendanceStats.presentPct}%)</span>
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-slate-700">
                <span className="w-3 h-3 rounded-full bg-rose-500 inline-block" /> Absent
              </span>
              <span className="font-bold text-slate-900">
                {attendanceStats.absent} <span className="text-slate-400 font-normal">({attendanceStats.absentPct}%)</span>
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-slate-700">
                <span className="w-3 h-3 rounded-full bg-amber-500 inline-block" /> Late
              </span>
              <span className="font-bold text-slate-900">
                {attendanceStats.late} <span className="text-slate-400 font-normal">({attendanceStats.latePct}%)</span>
              </span>
            </div>
          </div>

          <Link
            href="/dashboard/school-admin/reports"
            className="mt-4 pt-3 border-t border-slate-100 text-xs font-bold text-emerald-700 hover:text-emerald-800 flex items-center justify-center gap-1"
          >
            <span>View Attendance Report</span>
            <ArrowRight size={14} />
          </Link>
        </div>

        {/* Live Vehicle Movement Tracker Card */}
        <div className="lg:col-span-5 bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-extrabold text-slate-900">Vehicle Movement (Live Tracker)</h3>
          </div>

          {/* Interactive Route Map Simulation */}
          <div className="relative h-48 bg-slate-100 rounded-2xl overflow-hidden border border-slate-200 my-2">
            <div className="absolute inset-0 opacity-40 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:16px_16px]" />

            {/* Map Roads Simulation */}
            <svg className="absolute inset-0 w-full h-full text-slate-300 stroke-current" strokeWidth="3" fill="none">
              <path d="M 20,40 Q 120,20 220,70 T 420,110" />
              <path d="M 60,160 Q 180,100 320,120 T 450,50" strokeDasharray="6 4" />
            </svg>

            {/* Vehicle Pins */}
            <div className="absolute top-8 left-12 bg-emerald-600 text-white p-1.5 rounded-full shadow-lg border-2 border-white ring-2 ring-emerald-400/50 flex items-center justify-center">
              <Car size={14} />
            </div>
            <div className="absolute top-16 left-48 bg-amber-500 text-white p-1.5 rounded-full shadow-lg border-2 border-white ring-2 ring-amber-400/50 flex items-center justify-center animate-bounce">
              <Car size={14} />
            </div>
            <div className="absolute bottom-10 right-20 bg-emerald-600 text-white p-1.5 rounded-full shadow-lg border-2 border-white ring-2 ring-emerald-400/50 flex items-center justify-center">
              <Car size={14} />
            </div>

            {/* Map Controls */}
            <div className="absolute right-3 top-3 bg-white/90 backdrop-blur rounded-xl shadow border border-slate-200 p-1 flex flex-col gap-1 text-slate-700">
              <button type="button" className="p-1 hover:bg-slate-100 rounded"><Plus size={14} /></button>
              <button type="button" className="p-1 hover:bg-slate-100 rounded"><Navigation size={14} /></button>
            </div>
          </div>

          {/* Status Bar */}
          <div className="grid grid-cols-5 gap-1 text-center py-2.5 bg-slate-50 rounded-2xl border border-slate-100 text-[11px] font-bold">
            <div>
              <p className="text-slate-400 text-[9px] uppercase">On Route</p>
              <p className="text-emerald-700 font-black text-sm">0</p>
            </div>
            <div>
              <p className="text-slate-400 text-[9px] uppercase">Picked Up</p>
              <p className="text-blue-700 font-black text-sm">0</p>
            </div>
            <div>
              <p className="text-slate-400 text-[9px] uppercase">At School</p>
              <p className="text-slate-800 font-black text-sm">0</p>
            </div>
            <div>
              <p className="text-slate-400 text-[9px] uppercase">Arrived</p>
              <p className="text-emerald-700 font-black text-sm">0</p>
            </div>
            <div>
              <p className="text-slate-400 text-[9px] uppercase">Delayed</p>
              <p className="text-rose-600 font-black text-sm">0</p>
            </div>
          </div>

          <button
            type="button"
            disabled
            className="mt-3 text-xs font-bold text-slate-400 flex items-center justify-center gap-1 cursor-not-allowed opacity-60 w-full"
            title="Live tracker under development"
          >
            <span>View Full Tracker</span>
            <ArrowRight size={14} />
          </button>
        </div>

        {/* School Safety Score Card */}
        <div className="lg:col-span-3 bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-extrabold text-slate-900">School Safety Score</h3>
          </div>

          {/* Radial Score Gauge */}
          <div className="flex items-center justify-center my-3">
            <div className="relative w-36 h-36 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="40" stroke="#f1f5f9" strokeWidth="10" fill="transparent" />
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  stroke="#10B981"
                  strokeWidth="10"
                  fill="transparent"
                  strokeDasharray="251.2"
                  strokeDashoffset="24"
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute flex flex-col items-center justify-center text-center">
                <span className="text-3xl font-black text-slate-900">96</span>
                <span className="text-[10px] text-slate-400 font-bold">/100</span>
                <span className="text-[10px] font-bold text-emerald-600">Excellent</span>
              </div>
            </div>
          </div>

          {/* Safety Verification Checklist */}
          <div className="space-y-2 text-xs font-semibold pt-2 border-t border-slate-100">
            {[
              'Gate Compliance',
              'Escort Verification',
              'Driver Verification',
              'Vehicle Inspection',
              'Attendance Rate',
            ].map((item) => (
              <div key={item} className="flex items-center gap-2 text-slate-700">
                <span className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-[10px] font-bold shrink-0">✓</span>
                <span>{item}</span>
              </div>
            ))}
          </div>

          <Link
            href="/dashboard/school-admin/audit"
            className="mt-4 pt-3 border-t border-slate-100 text-xs font-bold text-emerald-700 hover:text-emerald-800 flex items-center justify-center gap-1"
          >
            <span>View Full Report</span>
            <ArrowRight size={14} />
          </Link>
        </div>
      </div>

      {/* 4. LOWER MIDDLE SECTION: QUICK ACTIONS & ACTIVITY TIMELINE & NOTIFICATIONS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Quick Actions Panel */}
        <div className="lg:col-span-5 bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <h3 className="text-base font-extrabold text-slate-900 mb-4">Quick Actions</h3>
          <div className="grid grid-cols-5 gap-3">
            {quickActions.map((action) => (
              <Link
                key={action.label}
                href={action.href}
                className="flex flex-col items-center text-center group cursor-pointer"
              >
                <div
                  className={`w-12 h-12 rounded-2xl ${action.color} flex items-center justify-center mb-1.5 transition-transform group-hover:scale-110 shadow-sm`}
                >
                  {action.icon}
                </div>
                <span className="text-[11px] font-bold text-slate-700 group-hover:text-emerald-700 leading-tight">
                  {action.label}
                </span>
              </Link>
            ))}
          </div>
        </div>

        {/* Activity Timeline */}
        <div className="lg:col-span-4 bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-extrabold text-slate-900">Today's Activity Timeline</h3>
            <span className="text-xs font-bold text-emerald-700 cursor-pointer">View all</span>
          </div>
          <div className="space-y-3">
            {activityLogs.length > 0 ? (
              activityLogs.map((log, idx) => (
                <div key={idx} className="flex items-start gap-3 text-xs">
                  <span className="font-mono font-bold text-slate-400 w-14 shrink-0 pt-0.5">{log.time}</span>
                  <span className={`w-2 h-2 rounded-full ${log.color} mt-1.5 shrink-0`} />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-800 truncate">{log.text}</p>
                    <p className="text-[10px] text-slate-400">{log.location}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-6 text-center text-slate-400 text-xs font-medium bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                No activity recorded yet today.
              </div>
            )}
          </div>
        </div>

        {/* Recent Notifications */}
        <div className="lg:col-span-3 bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-extrabold text-slate-900">Recent Notifications</h3>
            <Link href="/dashboard/school-admin/notifications" className="text-xs font-bold text-emerald-700">View all</Link>
          </div>
          <div className="space-y-3">
            {recentNotifications.length > 0 ? (
              recentNotifications.map((notif) => (
                <div key={notif.id} className="p-2.5 rounded-2xl bg-slate-50 border border-slate-100 space-y-1">
                  <div className="flex items-center justify-between gap-1">
                    <p className="text-xs font-bold text-slate-900 truncate">{notif.text}</p>
                    <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full shrink-0 ${notif.statusColor}`}>
                      {notif.status}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 font-mono">{notif.time}</p>
                </div>
              ))
            ) : (
              <div className="py-6 text-center text-slate-400 text-xs font-medium bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                No recent notifications.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 5. BOTTOM ROW SECTION: WALLET SUMMARY & UPCOMING EVENTS & CALENDAR */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Wallet Summary */}
        <div className="lg:col-span-5 bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/80 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-extrabold text-slate-900">Wallet Summary</h3>
            <span className="text-xs font-bold text-slate-400">System Offline</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-100">
              <p className="text-[10px] font-bold text-emerald-800 uppercase">Current Balance</p>
              <p className="text-lg font-black text-emerald-950 mt-1">₦0.00</p>
            </div>
            <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-100">
              <p className="text-[10px] font-bold text-amber-800 uppercase">Reward Balance</p>
              <p className="text-lg font-black text-amber-950 mt-1">₦0.00</p>
            </div>
            <div className="p-3.5 rounded-2xl bg-sky-50 border border-sky-100">
              <p className="text-[10px] font-bold text-sky-800 uppercase">Pending Top-up</p>
              <p className="text-lg font-black text-sky-950 mt-1">₦0.00</p>
            </div>
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-100">
              <p className="text-[10px] font-bold text-rose-800 uppercase">This Month Spent</p>
              <p className="text-lg font-black text-rose-950 mt-1">₦0.00</p>
            </div>
          </div>
        </div>

        {/* Upcoming Events */}
        <div className="lg:col-span-4 bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/80 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-extrabold text-slate-900">Upcoming Events</h3>
            <Link href="/dashboard/school-admin/calendar" className="text-xs font-bold text-emerald-700">View all</Link>
          </div>
          <div className="space-y-3">
            {upcomingEvents.map((evt, idx) => (
              <div key={idx} className="flex items-center gap-3 p-2.5 rounded-2xl bg-slate-50 border border-slate-100">
                <span className={`w-3 h-3 rounded-full ${evt.color} shrink-0`} />
                <div>
                  <p className="text-xs font-bold text-slate-900">{evt.title}</p>
                  <p className="text-[10px] text-slate-500 font-mono">{evt.date}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Mini Calendar Widget */}
        <div className="lg:col-span-3 bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/80 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-slate-900">{calendarData.monthName}</h3>
            <div className="flex items-center gap-1 text-slate-400">
              <button type="button" className="p-1 hover:text-slate-700"><ChevronLeft size={14} /></button>
              <button type="button" className="p-1 hover:text-slate-700"><ChevronRightIcon size={14} /></button>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-slate-400">
            <span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-slate-700">
            {calendarData.cells.map((c, idx) => (
              <span
                key={idx}
                className={
                  c.isToday
                    ? 'bg-emerald-600 text-white font-bold rounded-lg py-0.5'
                    : c.currentMonth
                    ? 'text-slate-700'
                    : 'text-slate-300'
                }
              >
                {c.num}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* FLOATING MIGO AI ASSISTANT BUTTON */}
      <div className="fixed bottom-6 right-6 z-40">
        <Link
          href="/dashboard/school-admin/messages"
          className="relative group p-3.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-full shadow-2xl transition-all duration-300 active:scale-95 flex items-center justify-center border-2 border-white ring-4 ring-emerald-500/20"
          title="Ask Migo AI Assistant"
        >
          <Bot size={28} />
          <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-400 border-2 border-white"></span>
          </span>
          <span className="absolute right-full mr-3 bg-slate-900 text-white text-xs font-bold px-3 py-1.5 rounded-xl whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity shadow-lg pointer-events-none">
            Ask Migo AI 🤖
          </span>
        </Link>
      </div>

      {/* FOOTER BAR */}
      <footer className="pt-8 border-t border-slate-200/80 text-xs font-semibold text-slate-500 flex flex-wrap items-center justify-between gap-4">
        <p>© 2025 MyEduRide. All rights reserved.</p>
        <div className="flex items-center gap-4">
          <a href="#" className="hover:text-slate-900">Privacy Policy</a>
          <span>•</span>
          <a href="#" className="hover:text-slate-900">Terms of Service</a>
          <span>•</span>
          <span className="text-emerald-700 font-bold">Powered by DISC</span>
        </div>
      </footer>
    </div>
  );
}
