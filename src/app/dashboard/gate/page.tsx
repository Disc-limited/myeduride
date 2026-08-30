'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { fetchData, logout } from '@/lib/api';
import StudentAvatar from '@/components/shared/StudentAvatar';
import {
  ShieldCheck,
  Calendar,
  Clock,
  Bell,
  User,
  Users,
  Car,
  Search,
  UserCheck,
  AlertCircle,
  Phone,
  MessageSquare,
  Megaphone,
  Settings,
  CheckCircle2,
  RotateCcw,
  Lock,
  Shield,
  Plus,
  ChevronDown,
  X,
  ExternalLink,
  Bot,
  QrCode,
  CreditCard,
  UserPlus,
  AlertTriangle,
  FileText,
  BarChart3,
  CheckSquare,
  Square,
  LogOut,
  RefreshCw,
  Camera,
  Menu,
} from 'lucide-react';
import NotificationsInbox from '@/components/notifications/NotificationsInbox';
import SchoolNoticeBanner from '@/components/shared/SchoolNoticeBanner';
import SchoolNoticesInboxView from '@/components/shared/SchoolNoticesInboxView';
import StudentPickupVerify from '@/components/pickup/StudentPickupVerify';
import StudentIdScanPanel from '@/components/gate/StudentIdScanPanel';
import StaffIdScanPanel from '@/components/gate/StaffIdScanPanel';
import VisitorIdScanPanel from '@/components/gate/VisitorIdScanPanel';
import GateActivitiesReport from '@/components/gate/GateActivitiesReport';
import AttendanceSignLog from '@/components/attendance/AttendanceSignLog';
import ReadyForPickupList from '@/components/gate/ReadyForPickupList';
import DigitalVisitorPassModal from '@/components/gate/DigitalVisitorPassModal';
import UnderDevelopment from '@/components/super-admin/UnderDevelopment';
import { toast } from 'sonner';
import { photoSrc } from '@/lib/photo';

const GATE_UNDER_DEV_TITLES: Record<string, string> = {
  escalations: 'Escalations Management',
  announcements: 'Announcements',
  advertisements: 'Advertisements',
  settings: 'Gate Settings',
};

function splitName(fullName: string) {
  const parts = (fullName || '').trim().split(/\s+/).filter(Boolean);
  return { first: parts[0] || '', last: parts.slice(1).join(' ') || '' };
}

export default function GateOfficerDashboard() {
  const [activeNav, setActiveNav] = useState('dashboard');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState<Date | null>(null);
  const [schoolId, setSchoolId] = useState('');
  const [schoolInfo, setSchoolInfo] = useState({ name: 'School Campus', address: 'Campus Location', logo_url: '', primary_color: '#1B4D3E' });
  const [officerInfo, setOfficerInfo] = useState({ name: 'Gate Officer', role: 'Gate Officer', gate: 'Main Security Gate' });

  // Data States
  const [allStudents, setAllStudents] = useState<any[]>([]);
  const [pickupQueue, setPickupQueue] = useState<any[]>([]);
  const [pickupNotices, setPickupNotices] = useState<any[]>([]);
  const [pickupPersonsByStudent, setPickupPersonsByStudent] = useState<Record<string, any>>({});
  const [pickupRequestsByStudent, setPickupRequestsByStudent] = useState<Record<string, any>>({});

  // Live Metrics & Aggregations
  const [metrics, setMetrics] = useState({
    students_checked_in: 0,
    staff_checked_in: 0,
    students_released: 0,
    students_waiting: 0,
    visitors_today: 0,
    visitors_on_campus: 0,
    pending_pickups: 0,
    incident_count: 0,
  });
  const [recentReleases, setRecentReleases] = useState<any[]>([]);
  const [officerActivity, setOfficerActivity] = useState({
    students_scanned_in: 0,
    staff_scanned_in: 0,
    visitors_registered: 0,
    students_released: 0,
    override_releases: 0,
    incidents_reported: 0,
    avg_process_time: '12 sec',
    attendance_captured: 0,
  });
  const [incidentSummary, setIncidentSummary] = useState({
    security: 0,
    visitor: 0,
    traffic: 0,
    medical: 0,
    other: 0,
  });

  // Action Loading States
  const [isReleasing, setIsReleasing] = useState(false);
  const [isRegisteringVisitor, setIsRegisteringVisitor] = useState(false);
  const [isReportingIncident, setIsReportingIncident] = useState(false);

  // Selection & Filters
  const [selectedClass, setSelectedClass] = useState('all');
  const [selectedQueueIds, setSelectedQueueIds] = useState<string[]>([]);
  const [chatTab, setChatTab] = useState<'chats' | 'groups' | 'broadcast'>('chats');

  // Modals
  const [releaseStudent, setReleaseStudent] = useState<any | null>(null);
  const [showScanModal, setShowScanModal] = useState(false);
  const [scanType, setScanType] = useState<'student' | 'staff'>('student');
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [showVisitorModal, setShowVisitorModal] = useState(false);
  const [showIncidentModal, setShowIncidentModal] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [createdVisitorPass, setCreatedVisitorPass] = useState<any | null>(null);
  const [studentSearchQuery, setStudentSearchQuery] = useState('');

  // Live Clock
  useEffect(() => {
    setCurrentTime(new Date());
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    loadSchoolData();
    return () => clearInterval(timer);
  }, []);

  // Poll Gate Dashboard API
  const loadGateData = useCallback(async () => {
    if (!schoolId) return;
    try {
      const res = await fetch(`/api/gate/dashboard?school_id=${schoolId}&t=${Date.now()}`, {
        credentials: 'include',
        cache: 'no-store',
      });
      const data = await res.json();
      if (res.ok) {
        if (data.students) setAllStudents(data.students);
        if (data.pickup_queue) setPickupQueue(data.pickup_queue);
        if (data.pickup_notices) setPickupNotices(data.pickup_notices);
        if (data.pickup_persons_by_student) setPickupPersonsByStudent(data.pickup_persons_by_student);
        if (data.pickup_requests_by_student) setPickupRequestsByStudent(data.pickup_requests_by_student);
        if (data.metrics) setMetrics(data.metrics);
        if (data.recent_releases) setRecentReleases(data.recent_releases);
        if (data.officer_activity) setOfficerActivity(data.officer_activity);
        if (data.incident_summary) setIncidentSummary(data.incident_summary);
        if (data.school) {
          setSchoolInfo((prev) => ({
            ...prev,
            name: data.school.name || prev.name,
            address: data.school.address || prev.address,
            logo_url: data.school.logo_url || prev.logo_url,
          }));
        }
      }
    } catch (e) {
      console.error(e);
    }
  }, [schoolId]);

  useEffect(() => {
    if (!schoolId) return undefined;
    loadGateData();
    const poll = setInterval(loadGateData, 12000);
    return () => clearInterval(poll);
  }, [schoolId, loadGateData]);

  const loadSchoolData = async () => {
    try {
      const data = await fetchData('get_school_admin_data', { role: 'gate_officer' });
      if (data.school_id) {
        setSchoolId(data.school_id);
      }
      if (data.school) {
        setSchoolInfo({
          name: data.school.name || 'School Campus',
          address: data.school.address || 'Campus Location',
          logo_url: data.school.logo_url || '',
          primary_color: data.school.primary_color || '#1B4D3E',
        });
      }
      if (data.user?.full_name) {
        setOfficerInfo((prev) => ({ ...prev, name: data.user.full_name }));
      }
    } catch {
      // Fallback defaults
    }
  };

  const handleReleaseClick = (student: any, queueItem?: any) => {
    const studentId = student.id || student.student_id;
    const notice = pickupNotices.find((n) => n.student_id === studentId);
    const request = pickupRequestsByStudent[studentId];
    const persons = pickupPersonsByStudent[studentId] || notice?.authorised_pickup_persons || request?.authorised_pickup_persons || [];

    setReleaseStudent({
      student,
      queueItem,
      pickup_notice: notice || null,
      pickup_request: request || null,
      pickup_persons: persons,
    });
  };

  const toggleSelectQueue = (id: string) => {
    setSelectedQueueIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
  };

  const filteredQueue = useMemo(() => {
    return pickupQueue.filter((item) => {
      const s = Array.isArray(item.student) ? item.student[0] : item.student;
      if (!s) return false;
      const matchesClass = selectedClass === 'all' || s.class_id === selectedClass || s.class?.name?.toLowerCase().includes(selectedClass.toLowerCase());
      return matchesClass;
    });
  }, [pickupQueue, selectedClass]);

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans antialiased text-slate-900">
      {/* TOP HEADER NAV BAR */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 px-4 sm:px-6 py-2.5 flex items-center justify-between shadow-xs">
        {/* Left Brand Logo & Mobile Toggle */}
        <div className="flex items-center gap-2 sm:gap-4">
          <button
            type="button"
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden p-2 rounded-xl text-slate-700 hover:bg-slate-100 transition-colors"
            title="Toggle Navigation Menu"
          >
            <Menu size={20} />
          </button>

          <Link href="/dashboard/gate" className="flex items-center gap-2">
            <img src="/images/eduride_logo.png" alt="MyEduRide" className="h-9 w-auto object-contain" />
          </Link>

          {/* Divider */}
          <div className="h-7 w-px bg-slate-200 hidden md:block" />

          {/* School Selector Dropdown */}
          <div className="hidden md:flex items-center gap-2.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors">
            <div className="w-7 h-7 rounded-lg bg-emerald-700 flex items-center justify-center text-white font-bold text-xs">
              <ShieldCheck size={16} />
            </div>
            <div>
              <div className="flex items-center gap-1">
                <span className="font-extrabold text-xs text-slate-900 leading-none">{schoolInfo.name}</span>
                <ChevronDown size={14} className="text-slate-400" />
              </div>
              <span className="text-[10px] text-slate-500 font-medium leading-tight block">{schoolInfo.address}</span>
            </div>
          </div>
        </div>

        {/* Right Actions & Profile */}
        <div className="flex items-center gap-3">
          {/* Live Date Pill */}
          <div className="hidden lg:flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-700">
            <Calendar size={14} className="text-emerald-600" />
            <span>
              {currentTime
                ? currentTime.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })
                : 'Wed, 21 May 2026'}
            </span>
          </div>

          {/* Live Time Pill */}
          <div className="hidden sm:flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-900">
            <Clock size={14} className="text-emerald-600" />
            <span>
              {currentTime
                ? currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })
                : '10:24 AM'}
            </span>
          </div>

          {/* Notifications Bell */}
          <button
            type="button"
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative p-2 rounded-xl text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <Bell size={18} />
            <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-extrabold rounded-full flex items-center justify-center border border-white">
              12
            </span>
          </button>

          {/* User Profile */}
          <div className="flex items-center gap-2.5 pl-2 border-l border-slate-200">
            <div className="relative">
              <div className="w-9 h-9 rounded-full bg-slate-800 text-white flex items-center justify-center font-bold text-xs overflow-hidden ring-2 ring-emerald-500/20">
                <User size={18} />
              </div>
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-white rounded-full" />
            </div>
            <div className="hidden md:block text-left">
              <p className="text-xs font-extrabold text-slate-900 leading-none">{officerInfo.name}</p>
              <div className="flex items-center gap-1 mt-0.5">
                <span className="text-[10px] text-slate-500 font-medium">{officerInfo.role}</span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                <span className="text-[9px] text-emerald-700 font-bold">Online</span>
              </div>
            </div>
          </div>

          {/* Logout Button */}
          <button
            type="button"
            onClick={() => logout()}
            className="p-2 rounded-xl text-slate-500 hover:text-red-600 hover:bg-red-50 border border-transparent hover:border-red-100 transition-colors flex items-center gap-1.5 font-bold text-xs"
            title="Sign Out"
            aria-label="Sign Out"
          >
            <LogOut size={16} />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </header>

      {/* Mobile Drawer Overlay */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 bg-slate-950/60 z-40 backdrop-blur-xs"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* BODY CONTENT CONTAINER */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* LEFT SIDEBAR NAVIGATION */}
        <aside
          className={`w-60 bg-[#0b1928] text-white flex flex-col justify-between shrink-0 shadow-xl transition-transform duration-300 md:translate-x-0 ${mobileOpen ? 'fixed left-0 top-[57px] bottom-0 z-50 translate-x-0' : 'hidden md:flex'
            }`}
        >
          <div className="p-3 space-y-3 overflow-y-auto">
            {/* Gate Officer Badge */}
            <div className="bg-[#1b804d] rounded-2xl p-3.5 flex items-center gap-3 shadow-md">
              <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center text-white shrink-0">
                <ShieldCheck size={20} />
              </div>
              <div>
                <h2 className="text-xs font-extrabold text-white uppercase tracking-wider leading-tight">
                  GATE OFFICER
                </h2>
                <p className="text-[10px] text-emerald-100 font-medium leading-tight mt-0.5">
                  {officerInfo.gate}
                </p>
              </div>
            </div>

            {/* Nav List */}
            <nav className="space-y-1 text-xs font-medium pt-1">
              {[
                { id: 'dashboard', label: 'Gate Dashboard', icon: LayoutDashboardIcon, action: () => setActiveNav('dashboard') },
                { id: 'student-scan', label: 'Student Scan', icon: QrCode, action: () => setActiveNav('student-scan') },
                { id: 'staff-scan', label: 'Staff Scan', icon: UserCheck, action: () => setActiveNav('staff-scan') },
                { id: 'visitor-scan', label: 'Visitor Scan', icon: Users, action: () => setActiveNav('visitor-scan') },
                { id: 'ready-queue', label: 'Ready for Pickup', icon: Car, action: () => setActiveNav('ready-queue') },
                { id: 'my-reports', label: 'Gate Activity Log', icon: BarChart3, action: () => setActiveNav('my-reports') },
                { id: 'audit-log', label: 'Attendance Audit', icon: FileText, action: () => setActiveNav('audit-log') },
                { id: 'school-notices', label: 'School Notices', icon: Megaphone, action: () => setActiveNav('school-notices') },
                { id: 'incident-reports', label: 'Incident Reports', icon: AlertCircle, action: () => setShowIncidentModal(true) },
                { id: 'educhat', label: 'EduChat', icon: MessageSquare, badge: '7', action: () => { setActiveNav('dashboard'); setTimeout(() => document.getElementById('educhat-widget')?.scrollIntoView({ behavior: 'smooth' }), 50); } },
                { id: 'settings', label: 'Settings', icon: Settings },
              ].map((item) => {
                const Icon = item.icon;
                const isActive = activeNav === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setActiveNav(item.id);
                      setMobileOpen(false);
                      if (item.action) item.action();
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all ${isActive
                        ? 'bg-[#1b804d] text-white font-bold shadow-xs'
                        : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                      }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon size={16} className={isActive ? 'text-white' : 'text-slate-400'} />
                      <span>{item.label}</span>
                    </div>
                    {item.badge && (
                      <span className="bg-emerald-500 text-white text-[10px] font-extrabold px-1.5 py-0.2 rounded-full">
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Bottom Help Box & Logout */}
          <div className="p-3 border-t border-slate-800/80 bg-[#08121d] space-y-2">
            <div className="bg-[#0f243a] border border-slate-800 rounded-xl p-3 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center text-white shrink-0">
                <Phone size={16} />
              </div>
              <div>
                <p className="text-[11px] font-extrabold text-white">Need Help?</p>
                <p className="text-[10px] text-slate-400 font-medium">Contact City Manager</p>
                <p className="text-[10px] text-emerald-400 font-bold font-mono">0809 123 4567</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => logout()}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 font-bold text-xs transition-colors"
            >
              <LogOut size={15} />
              <span>Sign Out</span>
            </button>
          </div>
        </aside>

        {/* MAIN DASHBOARD CONTENT AREA */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 max-w-[1700px]">
          {activeNav === 'student-scan' ? (
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-black">
                    <QrCode size={20} />
                  </div>
                  <div>
                    <h2 className="text-base font-extrabold text-slate-900">Student Scan Station</h2>
                    <p className="text-xs text-slate-500">Scan student ID card for arrival check-in or gate departure release.</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveNav('dashboard')}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs"
                >
                  ← Back to Dashboard
                </button>
              </div>
              <StudentIdScanPanel
                schoolId={schoolId}
                mode="arrival"
                onModeChange={() => { }}
                onSuccess={() => loadGateData()}
              />
            </div>
          ) : activeNav === 'staff-scan' ? (
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-blue-100 text-blue-800 flex items-center justify-center font-black">
                    <UserCheck size={20} />
                  </div>
                  <div>
                    <h2 className="text-base font-extrabold text-slate-900">Staff Scan Station</h2>
                    <p className="text-xs text-slate-500">Scan teacher and administrative staff badges for gate attendance.</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveNav('dashboard')}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs"
                >
                  ← Back to Dashboard
                </button>
              </div>
              <StaffIdScanPanel
                schoolId={schoolId}
                mode="arrival"
                onModeChange={() => { }}
                onSuccess={() => loadGateData()}
              />
            </div>
          ) : activeNav === 'visitor-scan' || activeNav === 'visitors' ? (
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-purple-100 text-purple-800 flex items-center justify-center font-black">
                    <Users size={20} />
                  </div>
                  <div>
                    <h2 className="text-base font-extrabold text-slate-900">Visitor Scan &amp; Digital Management</h2>
                    <p className="text-xs text-slate-500">Scan smartphone digital visitor passes and register visitor entries.</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveNav('dashboard')}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs"
                >
                  ← Back to Dashboard
                </button>
              </div>
              <VisitorIdScanPanel schoolId={schoolId} />
            </div>
          ) : activeNav === 'my-reports' ? (
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h2 className="text-base font-extrabold text-slate-900">Gate Officer Activity &amp; Release Reports</h2>
                  <p className="text-xs text-slate-500">Live logs from gate_activity_logs database table</p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveNav('dashboard')}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs"
                >
                  ← Back to Dashboard
                </button>
              </div>
              <GateActivitiesReport schoolId={schoolId} title="Live Gate Activity Logs" />
            </div>
          ) : activeNav === 'audit-log' ? (
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h2 className="text-base font-extrabold text-slate-900">Attendance &amp; Gate Audit Log</h2>
                  <p className="text-xs text-slate-500">Audit trail of all sign-ins and sign-outs for students &amp; staff</p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveNav('dashboard')}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs"
                >
                  ← Back to Dashboard
                </button>
              </div>
              <AttendanceSignLog schoolId={schoolId} title="Sign In / Out Audit Log" searchable={true} />
            </div>
          ) : activeNav === 'school-notices' ? (
            <SchoolNoticesInboxView role="gate_officers" schoolId={schoolId} />
          ) : activeNav === 'ready-queue' ? (
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h2 className="text-base font-extrabold text-slate-900">Ready for Pickup Management</h2>
                  <p className="text-xs text-slate-500">Live queue of students marked ready by teachers for gate dismissal</p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveNav('dashboard')}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs"
                >
                  ← Back to Dashboard
                </button>
              </div>
              <ReadyForPickupList schoolId={schoolId} onRelease={handleReleaseClick} showReleaseButton={true} />
            </div>
          ) : GATE_UNDER_DEV_TITLES[activeNav] ? (
            <UnderDevelopment
              title={GATE_UNDER_DEV_TITLES[activeNav]}
              message="OOps!! this page is undergoing development"
              onBack={() => setActiveNav('dashboard')}
              backText="Return to Gate Dashboard"
            />
          ) : (
            <>
              {/* PRIMARY SCANNING WORKSTATION BAR */}
              <div className="bg-gradient-to-r from-[#07132B] via-[#0B1E36] to-[#0A1633] rounded-3xl p-5 text-white shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border border-slate-800">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-black text-[10px] border border-emerald-400/30 uppercase tracking-wider flex items-center gap-1">
                      <ShieldCheck size={12} /> Gate Workstation &amp; Admin Terminal
                    </span>
                  </div>
                  <h2 className="text-xl md:text-2xl font-black text-white tracking-tight">
                    Fast Gate Scanning &amp; Access Control
                  </h2>
                  <p className="text-slate-300 text-xs font-medium">
                    Select a dedicated scan station to process arrivals, staff attendance, and digital visitor passes.
                  </p>
                </div>

                <div className="flex items-center flex-wrap gap-2.5 w-full md:w-auto">
                  <button
                    type="button"
                    onClick={() => setActiveNav('student-scan')}
                    className="flex-1 md:flex-initial px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30 transition-all cursor-pointer"
                  >
                    <QrCode size={16} />
                    <span>Student Scan</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveNav('staff-scan')}
                    className="flex-1 md:flex-initial px-4 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-blue-600/30 transition-all cursor-pointer"
                  >
                    <UserCheck size={16} />
                    <span>Staff Scan</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveNav('visitor-scan')}
                    className="flex-1 md:flex-initial px-4 py-2.5 rounded-2xl bg-purple-600 hover:bg-purple-700 text-white font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-purple-600/30 transition-all cursor-pointer"
                  >
                    <Users size={16} />
                    <span>Visitor Scan</span>
                  </button>
                </div>
              </div>

              {/* OFFICIAL SCHOOL NOTICES & PUBLIC HOLIDAY ADVISORIES */}
              <SchoolNoticeBanner role="gate_officers" schoolId={schoolId} className="mb-4" />

              {/* ROW 1: 7 KPI STAT CARDS */}
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
                {/* 1. Students Checked In */}
                <div className="bg-white rounded-2xl p-3.5 border border-slate-200 shadow-xs flex flex-col justify-between hover:shadow-md transition-all">
                  <div className="flex items-center justify-between">
                    <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                      <Users size={18} />
                    </div>
                  </div>
                  <div className="mt-2">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Students Checked In</p>
                    <p className="text-xl font-black text-slate-900 leading-none mt-1">{metrics.students_checked_in}</p>
                    <p className="text-[9px] text-emerald-600 font-bold mt-1">Arrivals today</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveNav('student-scan')}
                    className="text-[10px] font-bold text-emerald-700 hover:underline text-left mt-2 cursor-pointer"
                  >
                    Scan / Check In →
                  </button>
                </div>

                {/* 2. Staff Checked In */}
                <div className="bg-white rounded-2xl p-3.5 border border-slate-200 shadow-xs flex flex-col justify-between hover:shadow-md transition-all">
                  <div className="flex items-center justify-between">
                    <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                      <UserCheck size={18} />
                    </div>
                  </div>
                  <div className="mt-2">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Staff Signed In</p>
                    <p className="text-xl font-black text-slate-900 leading-none mt-1">{metrics.staff_checked_in}</p>
                    <p className="text-[9px] text-blue-600 font-bold mt-1">Signed in today</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveNav('staff-scan')}
                    className="text-[10px] font-bold text-blue-700 hover:underline text-left mt-2 cursor-pointer"
                  >
                    Staff Scan →
                  </button>
                </div>

                {/* 3. Students Released */}
                <div className="bg-white rounded-2xl p-3.5 border border-slate-200 shadow-xs flex flex-col justify-between hover:shadow-md transition-all">
                  <div className="flex items-center justify-between">
                    <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
                      <RotateCcw size={18} />
                    </div>
                  </div>
                  <div className="mt-2">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Students Released</p>
                    <p className="text-xl font-black text-slate-900 leading-none mt-1">{metrics.students_released}</p>
                    <p className="text-[9px] text-emerald-600 font-bold mt-1">Gate departures</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveNav('my-reports')}
                    className="text-[10px] font-bold text-teal-700 hover:underline text-left mt-2 cursor-pointer"
                  >
                    View Activity Log →
                  </button>
                </div>

                {/* 4. Students Waiting */}
                <div className="bg-white rounded-2xl p-3.5 border border-slate-200 shadow-xs flex flex-col justify-between hover:shadow-md transition-all">
                  <div className="flex items-center justify-between">
                    <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                      <Users size={18} />
                    </div>
                  </div>
                  <div className="mt-2">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Students Waiting</p>
                    <p className="text-xl font-black text-slate-900 leading-none mt-1">{pickupQueue.length}</p>
                    <p className="text-[9px] text-amber-700 font-bold mt-1">Ready for pickup</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveNav('ready-queue')}
                    className="text-[10px] font-bold text-amber-700 hover:underline text-left mt-2 cursor-pointer"
                  >
                    Open Queue →
                  </button>
                </div>

                {/* 5. Visitors Today */}
                <div className="bg-white rounded-2xl p-3.5 border border-slate-200 shadow-xs flex flex-col justify-between hover:shadow-md transition-all">
                  <div className="flex items-center justify-between">
                    <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                      <UserPlus size={18} />
                    </div>
                  </div>
                  <div className="mt-2">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Visitors Today</p>
                    <p className="text-xl font-black text-slate-900 leading-none mt-1">{metrics.visitors_today}</p>
                    <p className="text-[9px] text-slate-500 font-medium mt-1">{metrics.visitors_on_campus} on campus</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveNav('visitor-scan')}
                    className="text-[10px] font-bold text-purple-700 hover:underline text-left mt-2 cursor-pointer"
                  >
                    Visitor Passes →
                  </button>
                </div>

                {/* 6. Pending Pickups */}
                <div className="bg-white rounded-2xl p-3.5 border border-slate-200 shadow-xs flex flex-col justify-between hover:shadow-md transition-all">
                  <div className="flex items-center justify-between">
                    <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
                      <Car size={18} />
                    </div>
                  </div>
                  <div className="mt-2">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Pending Pickups</p>
                    <p className="text-xl font-black text-slate-900 leading-none mt-1">{pickupQueue.length}</p>
                    <p className="text-[9px] text-amber-700 font-bold mt-1">In queue</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveNav('ready-queue')}
                    className="text-[10px] font-bold text-amber-800 hover:underline text-left mt-2 cursor-pointer"
                  >
                    Manage Queue →
                  </button>
                </div>

                {/* 7. Incident Reports */}
                <div className="bg-white rounded-2xl p-3.5 border border-slate-200 shadow-xs flex flex-col justify-between hover:shadow-md transition-all">
                  <div className="flex items-center justify-between">
                    <div className="w-9 h-9 rounded-xl bg-red-50 text-red-600 flex items-center justify-center">
                      <AlertTriangle size={18} />
                    </div>
                  </div>
                  <div className="mt-2">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Incident Reports</p>
                    <p className="text-xl font-black text-slate-900 leading-none mt-1">{metrics.incident_count}</p>
                    <p className="text-[9px] text-red-600 font-bold mt-1">Logged today</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowIncidentModal(true)}
                    className="text-[10px] font-bold text-red-700 hover:underline text-left mt-2 cursor-pointer"
                  >
                    Log Incident →
                  </button>
                </div>
              </div>

              {/* ROW 2: READY QUEUE, QUICK ACTIONS, EDUCHAT */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                {/* COLUMN 1 (5 Cols): READY FOR PICKUP QUEUE */}
                <div id="ready-pickup-queue" className="lg:col-span-5 bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs flex flex-col justify-between">
                  <div>
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                      <div className="flex items-center gap-2">
                        <h2 className="font-extrabold text-sm text-slate-900">Ready for Pickup Queue</h2>
                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[11px]">
                          {pickupQueue.length} Students
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <select
                          value={selectedClass}
                          onChange={(e) => setSelectedClass(e.target.value)}
                          className="bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold px-2.5 py-1 text-slate-700 focus:outline-none"
                        >
                          <option value="all">All Classes</option>
                          {Array.from(new Set(allStudents.map((st) => st.class?.name || '').filter(Boolean))).map((clsName) => (
                            <option key={clsName} value={clsName}>{clsName}</option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={loadGateData}
                          className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-1 cursor-pointer"
                        >
                          <RefreshCw size={12} /> Refresh
                        </button>
                      </div>
                    </div>

                    {/* Queue Table */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs min-w-[550px]">
                        <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-[10px] border-y border-slate-100">
                          <tr>
                            <th className="py-2 px-2 w-6">
                              <Square size={14} className="text-slate-300 cursor-pointer" />
                            </th>
                            <th className="py-2 px-3">Student</th>
                            <th className="py-2 px-3">Class</th>
                            <th className="py-2 px-3">Ready Since</th>
                            <th className="py-2 px-3">Escort / Pickup Person</th>
                            <th className="py-2 px-3">Status</th>
                            <th className="py-2 px-3 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {filteredQueue.map((item, idx) => {
                            const s = item.student || {};
                            const isSelected = selectedQueueIds.includes(item.id);
                            return (
                              <tr key={item.id || idx} className="hover:bg-slate-50/80 transition-colors">
                                <td className="py-3 px-2">
                                  <button type="button" onClick={() => toggleSelectQueue(item.id)}>
                                    {isSelected ? (
                                      <CheckSquare size={16} className="text-emerald-600" />
                                    ) : (
                                      <Square size={16} className="text-slate-300" />
                                    )}
                                  </button>
                                </td>
                                <td className="py-3 px-3">
                                  <div className="flex items-center gap-2.5">
                                    <StudentAvatar
                                      photoUrl={s.photo_url}
                                      firstName={s.first_name}
                                      lastName={s.last_name}
                                      size="sm"
                                    />
                                    <div>
                                      <p className="font-bold text-slate-900 leading-tight">
                                        {s.first_name} {s.last_name}
                                      </p>
                                      <p className="text-[10px] text-slate-400 font-mono">
                                        S/ID: {s.student_id_number}
                                      </p>
                                    </div>
                                  </div>
                                </td>
                                <td className="py-3 px-3 font-medium text-slate-700">
                                  {s.class?.name || 'Class'}
                                </td>
                                <td className="py-3 px-3 font-semibold text-slate-600">
                                  {item.ready_since || (item.created_at ? new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Now')}
                                </td>
                                <td className="py-3 px-3">
                                  <div className="flex items-center gap-2">
                                    <div className="w-7 h-7 rounded-full bg-slate-200 text-slate-600 font-bold text-[10px] flex items-center justify-center shrink-0">
                                      {item.is_official_escort ? <Shield size={14} className="text-emerald-600" /> : <User size={14} />}
                                    </div>
                                    <div>
                                      <p className="font-bold text-slate-900 text-[11px] leading-tight">
                                        {item.pickup_person_name || 'Authorized Parent/Escort'}
                                      </p>
                                      <p className="text-[10px] text-slate-500 font-medium">
                                        {item.pickup_person_phone || 'On file'}
                                      </p>
                                    </div>
                                  </div>
                                </td>
                                <td className="py-3 px-3">
                                  <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold">
                                    Ready for Pickup
                                  </span>
                                </td>
                                <td className="py-3 px-3 text-right">
                                  <button
                                    type="button"
                                    onClick={() => handleReleaseClick(s, item)}
                                    className="px-2.5 py-1 rounded-lg border border-emerald-600 hover:bg-emerald-50 text-emerald-700 font-extrabold text-[10px] shadow-2xs cursor-pointer"
                                  >
                                    Verify &amp; Release
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                          {filteredQueue.length === 0 && (
                            <tr>
                              <td colSpan={7} className="py-8 text-center text-slate-400 text-xs">
                                {pickupQueue.length === 0 ? 'No students currently waiting in the ready queue.' : 'No students found matching the selected class filter.'}
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-emerald-700">
                    <button
                      type="button"
                      onClick={() => setActiveNav('ready-queue')}
                      className="hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      View Full Ready Queue ({pickupQueue.length}) <ChevronDown size={14} />
                    </button>
                  </div>
                </div>

                {/* COLUMN 2 (3 Cols): QUICK ACTIONS */}
                <div className="lg:col-span-3 bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs flex flex-col justify-between">
                  <div>
                    <h2 className="font-extrabold text-sm text-slate-900 mb-4">Quick Actions</h2>

                    <div className="grid grid-cols-3 gap-2.5">
                      {/* Action 1 */}
                      <button
                        type="button"
                        onClick={() => { setScanType('student'); setShowScanModal(true); }}
                        className="p-3 bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-200 rounded-xl flex flex-col items-center justify-center text-center transition-all group shadow-2xs"
                      >
                        <QrCode size={22} className="text-emerald-600 mb-1 group-hover:scale-110 transition-transform" />
                        <span className="text-[11px] font-extrabold text-slate-800 leading-tight">Scan Student</span>
                      </button>

                      {/* Action 2 */}
                      <button
                        type="button"
                        onClick={() => { setScanType('staff'); setShowScanModal(true); }}
                        className="p-3 bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-200 rounded-xl flex flex-col items-center justify-center text-center transition-all group shadow-2xs"
                      >
                        <CreditCard size={22} className="text-blue-600 mb-1 group-hover:scale-110 transition-transform" />
                        <span className="text-[11px] font-extrabold text-slate-800 leading-tight">Scan Staff</span>
                      </button>

                      {/* Action 3 */}
                      <button
                        type="button"
                        onClick={() => setShowSearchModal(true)}
                        className="p-3 bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-200 rounded-xl flex flex-col items-center justify-center text-center transition-all group shadow-2xs"
                      >
                        <Search size={22} className="text-emerald-600 mb-1 group-hover:scale-110 transition-transform" />
                        <span className="text-[11px] font-extrabold text-slate-800 leading-tight">Search Student</span>
                      </button>

                      {/* Action 4 */}
                      <button
                        type="button"
                        onClick={() => setActiveNav('ready-queue')}
                        className="p-3 bg-slate-50 hover:bg-amber-50 border border-slate-200 hover:border-amber-200 rounded-xl flex flex-col items-center justify-center text-center transition-all group shadow-2xs"
                      >
                        <Users size={22} className="text-amber-600 mb-1 group-hover:scale-110 transition-transform" />
                        <span className="text-[11px] font-extrabold text-slate-800 leading-tight">Ready Queue</span>
                      </button>

                      {/* Action 5 */}
                      <button
                        type="button"
                        onClick={() => setShowVisitorModal(true)}
                        className="p-3 bg-slate-50 hover:bg-purple-50 border border-slate-200 hover:border-purple-200 rounded-xl flex flex-col items-center justify-center text-center transition-all group shadow-2xs"
                      >
                        <UserPlus size={22} className="text-purple-600 mb-1 group-hover:scale-110 transition-transform" />
                        <span className="text-[11px] font-extrabold text-slate-800 leading-tight">Register Visitor</span>
                      </button>

                      {/* Action 6 */}
                      <button
                        type="button"
                        onClick={() => { setScanType('student'); setShowScanModal(true); }}
                        className="p-3 bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-200 rounded-xl flex flex-col items-center justify-center text-center transition-all group shadow-2xs cursor-pointer"
                      >
                        <ShieldCheck size={22} className="text-blue-600 mb-1 group-hover:scale-110 transition-transform" />
                        <span className="text-[11px] font-extrabold text-slate-800 leading-tight">Quick Verify</span>
                      </button>

                      {/* Action 7 */}
                      <button
                        type="button"
                        onClick={() => setShowSearchModal(true)}
                        className="p-3 bg-slate-50 hover:bg-amber-50 border border-slate-200 hover:border-amber-200 rounded-xl flex flex-col items-center justify-center text-center transition-all group shadow-2xs cursor-pointer"
                      >
                        <Lock size={22} className="text-amber-600 mb-1 group-hover:scale-110 transition-transform" />
                        <span className="text-[11px] font-extrabold text-slate-800 leading-tight">Override Release</span>
                      </button>

                      {/* Action 8 */}
                      <button
                        type="button"
                        onClick={() => setShowIncidentModal(true)}
                        className="p-3 bg-slate-50 hover:bg-red-50 border border-slate-200 hover:border-red-200 rounded-xl flex flex-col items-center justify-center text-center transition-all group shadow-2xs"
                      >
                        <AlertTriangle size={22} className="text-red-600 mb-1 group-hover:scale-110 transition-transform" />
                        <span className="text-[11px] font-extrabold text-slate-800 leading-tight">Incident Report</span>
                      </button>

                      {/* Action 9 */}
                      <button
                        type="button"
                        onClick={() => toast.info('Connecting to City Manager...')}
                        className="p-3 bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-200 rounded-xl flex flex-col items-center justify-center text-center transition-all group shadow-2xs"
                      >
                        <Phone size={22} className="text-emerald-600 mb-1 group-hover:scale-110 transition-transform" />
                        <span className="text-[11px] font-extrabold text-slate-800 leading-tight">Escalate / Call</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* COLUMN 3 (4 Cols): EDUCHAT */}
                <div id="educhat-widget" className="lg:col-span-4 bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <h2 className="font-extrabold text-sm text-slate-900">EduChat</h2>
                        <span className="w-5 h-5 rounded-full bg-emerald-600 text-white font-extrabold text-[10px] flex items-center justify-center">
                          7
                        </span>
                      </div>
                    </div>

                    {/* Tabs */}
                    <div className="flex gap-1 bg-slate-100 p-1 rounded-xl mb-3 text-xs font-bold">
                      <button
                        type="button"
                        onClick={() => setChatTab('chats')}
                        className={`flex-1 py-1.5 rounded-lg text-center transition-all ${chatTab === 'chats' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-900'
                          }`}
                      >
                        Chats
                      </button>
                      <button
                        type="button"
                        onClick={() => setChatTab('groups')}
                        className={`flex-1 py-1.5 rounded-lg text-center transition-all ${chatTab === 'groups' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-900'
                          }`}
                      >
                        Groups
                      </button>
                      <button
                        type="button"
                        onClick={() => setChatTab('broadcast')}
                        className={`flex-1 py-1.5 rounded-lg text-center transition-all ${chatTab === 'broadcast' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-900'
                          }`}
                      >
                        Broadcast
                      </button>
                    </div>

                    {/* Chat items list */}
                    <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                      {[
                        {
                          name: 'Transport Coordinator',
                          msg: 'Pickup at Gate A is heavy, please support.',
                          time: '10:20 AM',
                          unread: 2,
                        },
                        {
                          name: 'School Admin',
                          msg: 'Please ensure all pending pickups are verified.',
                          time: '10:18 AM',
                          unread: 0,
                        },
                        {
                          name: 'Mr. Peter Johnson',
                          msg: "I'm here to pick David.",
                          time: '10:15 AM',
                          unread: 1,
                        },
                        {
                          name: 'Security Team',
                          msg: 'Suspicious vehicle reported outside gate.',
                          time: '10:10 AM',
                          unread: 3,
                        },
                        {
                          name: 'City Manager',
                          msg: 'Monitoring gate activities. Keep it up.',
                          time: '09:55 AM',
                          unread: 0,
                        },
                      ].map((chat, i) => (
                        <div
                          key={i}
                          className="p-2.5 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-100 flex items-center justify-between cursor-pointer transition-colors"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-8 h-8 rounded-full bg-slate-800 text-white font-bold text-xs flex items-center justify-center shrink-0">
                              {chat.name.slice(0, 2).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold text-xs text-slate-900 leading-tight truncate">{chat.name}</p>
                              <p className="text-[10px] text-slate-500 truncate mt-0.5">{chat.msg}</p>
                            </div>
                          </div>
                          <div className="text-right shrink-0 ml-2">
                            <span className="text-[9px] font-semibold text-slate-400 block">{chat.time}</span>
                            {chat.unread > 0 && (
                              <span className="inline-flex w-4 h-4 rounded-full bg-emerald-600 text-white font-bold text-[9px] items-center justify-center mt-0.5">
                                {chat.unread}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                    <button type="button" className="text-xs font-bold text-emerald-700 hover:underline">
                      View All Chats &gt;
                    </button>
                    <button
                      type="button"
                      onClick={() => toast.info('New chat conversation opened')}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm transition-all flex items-center gap-1.5"
                    >
                      <Plus size={14} /> New Chat
                    </button>
                  </div>
                </div>
              </div>

              {/* ROW 3: RECENT RELEASES, TODAY'S ACTIVITY, INCIDENT SUMMARY & ADVERTS */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                {/* Box 1 (4 Cols): RECENT RELEASES */}
                <div className="lg:col-span-4 bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h2 className="font-extrabold text-sm text-slate-900">Recent Releases</h2>
                      <button
                        type="button"
                        onClick={() => setActiveNav('my-reports')}
                        className="text-xs font-bold text-emerald-700 hover:underline cursor-pointer"
                      >
                        View All
                      </button>
                    </div>

                    <div className="space-y-2 text-xs">
                      {recentReleases.map((rel, i) => (
                        <div key={rel.id || i} className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                            <div className="min-w-0">
                              <p className="font-extrabold text-slate-900 text-xs truncate">{rel.name}</p>
                              <p className="text-[10px] text-slate-500 truncate">Released to {rel.released_to}</p>
                            </div>
                          </div>
                          <div className="text-right shrink-0 ml-2">
                            <span className="text-[10px] font-bold text-slate-700">{rel.time}</span>
                            <span className="text-[9px] text-slate-400 block">{rel.class_name}</span>
                          </div>
                        </div>
                      ))}
                      {recentReleases.length === 0 && (
                        <div className="py-8 text-center text-slate-400 text-xs">
                          No student releases recorded yet today.
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Box 2 (4 Cols): TODAY'S ACTIVITY (YOU) */}
                <div className="lg:col-span-4 bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="font-extrabold text-sm text-slate-900">Today&apos;s Activity (You)</h2>
                      <button
                        type="button"
                        onClick={() => setActiveNav('my-reports')}
                        className="text-xs font-bold text-emerald-700 hover:underline cursor-pointer"
                      >
                        View Full Report
                      </button>
                    </div>

                    <div className="grid grid-cols-4 gap-2 text-center">
                      <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                        <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 mx-auto flex items-center justify-center mb-1">
                          <Users size={16} />
                        </div>
                        <p className="text-[9px] font-bold text-slate-400">Students Scanned In</p>
                        <p className="text-base font-black text-slate-900 mt-0.5">{officerActivity.students_scanned_in}</p>
                      </div>

                      <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                        <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 mx-auto flex items-center justify-center mb-1">
                          <UserCheck size={16} />
                        </div>
                        <p className="text-[9px] font-bold text-slate-400">Staff Scanned In</p>
                        <p className="text-base font-black text-slate-900 mt-0.5">{officerActivity.staff_scanned_in}</p>
                      </div>

                      <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                        <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-600 mx-auto flex items-center justify-center mb-1">
                          <UserPlus size={16} />
                        </div>
                        <p className="text-[9px] font-bold text-slate-400">Visitors Registered</p>
                        <p className="text-base font-black text-slate-900 mt-0.5">{officerActivity.visitors_registered}</p>
                      </div>

                      <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                        <div className="w-7 h-7 rounded-lg bg-teal-50 text-teal-600 mx-auto flex items-center justify-center mb-1">
                          <RotateCcw size={16} />
                        </div>
                        <p className="text-[9px] font-bold text-slate-400">Students Released</p>
                        <p className="text-base font-black text-slate-900 mt-0.5">{officerActivity.students_released}</p>
                      </div>

                      <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                        <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 mx-auto flex items-center justify-center mb-1">
                          <Lock size={16} />
                        </div>
                        <p className="text-[9px] font-bold text-slate-400">Override Releases</p>
                        <p className="text-base font-black text-slate-900 mt-0.5">{officerActivity.override_releases}</p>
                      </div>

                      <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                        <div className="w-7 h-7 rounded-lg bg-red-50 text-red-600 mx-auto flex items-center justify-center mb-1">
                          <AlertTriangle size={16} />
                        </div>
                        <p className="text-[9px] font-bold text-slate-400">Incidents Reported</p>
                        <p className="text-base font-black text-slate-900 mt-0.5">{officerActivity.incidents_reported}</p>
                      </div>

                      <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                        <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 mx-auto flex items-center justify-center mb-1">
                          <Clock size={16} />
                        </div>
                        <p className="text-[9px] font-bold text-slate-400">Avg. Process Time</p>
                        <p className="text-base font-black text-slate-900 mt-0.5">{officerActivity.avg_process_time}</p>
                      </div>

                      <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                        <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 mx-auto flex items-center justify-center mb-1">
                          <CheckCircle2 size={16} />
                        </div>
                        <p className="text-[9px] font-bold text-slate-400">Attendance Captured</p>
                        <p className="text-base font-black text-slate-900 mt-0.5">{officerActivity.attendance_captured}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Box 3 (4 Cols): INCIDENT SUMMARY & ADVERTISEMENTS */}
                <div className="lg:col-span-4 space-y-5">
                  {/* Incident Summary */}
                  <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs">
                    <div className="flex items-center justify-between mb-3">
                      <h2 className="font-extrabold text-sm text-slate-900">Incident Summary</h2>
                      <button
                        type="button"
                        onClick={() => setShowIncidentModal(true)}
                        className="text-xs font-bold text-emerald-700 hover:underline cursor-pointer"
                      >
                        + Report
                      </button>
                    </div>

                    <div className="space-y-2 text-xs font-semibold">
                      <div className="flex items-center justify-between p-2 bg-slate-50 rounded-xl border border-slate-100">
                        <span className="flex items-center gap-2 text-slate-800">
                          <span className="w-2.5 h-2.5 rounded-full bg-red-600" /> Security Incident
                        </span>
                        <span className="font-extrabold text-slate-900">{incidentSummary.security}</span>
                      </div>

                      <div className="flex items-center justify-between p-2 bg-slate-50 rounded-xl border border-slate-100">
                        <span className="flex items-center gap-2 text-slate-800">
                          <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Visitor Incident
                        </span>
                        <span className="font-extrabold text-slate-900">{incidentSummary.visitor}</span>
                      </div>

                      <div className="flex items-center justify-between p-2 bg-slate-50 rounded-xl border border-slate-100">
                        <span className="flex items-center gap-2 text-slate-800">
                          <span className="w-2.5 h-2.5 rounded-full bg-purple-600" /> Traffic Incident
                        </span>
                        <span className="font-extrabold text-slate-900">{incidentSummary.traffic}</span>
                      </div>

                      <div className="flex items-center justify-between p-2 bg-slate-50 rounded-xl border border-slate-100">
                        <span className="flex items-center gap-2 text-slate-800">
                          <span className="w-2.5 h-2.5 rounded-full bg-blue-600" /> Medical Incident
                        </span>
                        <span className="font-extrabold text-slate-900">{incidentSummary.medical}</span>
                      </div>

                      <div className="flex items-center justify-between p-2 bg-slate-50 rounded-xl border border-slate-100">
                        <span className="flex items-center gap-2 text-slate-800">
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" /> Other Incident
                        </span>
                        <span className="font-extrabold text-slate-900">{incidentSummary.other}</span>
                      </div>
                    </div>
                  </div>

                  {/* Advertisements */}
                  <div className="bg-gradient-to-tr from-slate-900 to-slate-800 rounded-2xl p-4 text-white shadow-md relative overflow-hidden">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Advertisements
                      </span>
                      <button className="text-[10px] text-emerald-400 font-bold hover:underline">
                        View All
                      </button>
                    </div>
                    <h3 className="font-black text-lg leading-tight text-white">DISCL</h3>
                    <p className="text-xs text-slate-300 font-medium mt-1">
                      Daisaf Industrial Services Integrated Solutions for a Safer Tomorrow
                    </p>
                    <button
                      type="button"
                      className="mt-3 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-colors shadow-2xs"
                    >
                      Learn More
                    </button>
                  </div>
                </div>
              </div>

              {/* BOTTOM MIGO SMART ASSISTANT BANNER */}
              <div className="bg-slate-900 rounded-2xl p-4 sm:p-5 border border-slate-800 text-white shadow-xl flex flex-col md:flex-row items-center justify-between gap-4">
                {/* Left Immediate Assistance */}
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex items-center gap-3 w-full md:w-auto">
                  <div className="w-10 h-10 rounded-full bg-slate-800 border border-emerald-500/40 flex items-center justify-center overflow-hidden shrink-0">
                    <User size={20} className="text-emerald-400" />
                  </div>
                  <div className="pr-2">
                    <p className="text-xs font-bold text-white leading-tight">Need Immediate Assistance?</p>
                    <p className="text-[10px] text-slate-400 font-medium">Contact your City Manager now</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => toast.info('Calling City Manager...')}
                    className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all shrink-0"
                  >
                    <Phone size={14} /> Call City Manager
                  </button>
                </div>

                {/* Migo Pill */}
                <div className="flex-1 flex flex-wrap items-center justify-between gap-3 bg-slate-950/80 border border-slate-800 rounded-xl p-3 w-full">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-emerald-500 flex items-center justify-center text-white shadow-md shrink-0">
                      <Bot size={20} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-black text-xs text-white">MIGO</h4>
                        <span className="text-[9px] text-slate-400 font-medium">Powered by SAVI</span>
                      </div>
                      <p className="text-xs text-slate-300 font-medium mt-0.5">
                        Hi David! I&apos;m MIGO, your smart assistant. How can I help you today?
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowIncidentModal(true)}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[11px] font-bold text-slate-200 flex items-center gap-1"
                    >
                      <AlertTriangle size={12} className="text-red-500" /> Report Issue
                    </button>
                    <button
                      type="button"
                      onClick={() => toast.info('Checking pickup status...')}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[11px] font-bold text-slate-200 flex items-center gap-1"
                    >
                      <Users size={12} className="text-emerald-500" /> Check Pickup
                    </button>
                    <button
                      type="button"
                      onClick={() => toast.info('System status: 100% Operational')}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[11px] font-bold text-slate-200 flex items-center gap-1"
                    >
                      <CheckCircle2 size={12} className="text-blue-500" /> System Status
                    </button>
                  </div>
                </div>
              </div>

              {/* Legal Footer */}
              <footer className="pt-2 text-center text-[10px] text-slate-400 font-medium flex flex-col sm:flex-row items-center justify-between gap-2 border-t border-slate-200">
                <p>© 2026 Daisaf Industrial Services Company Limited (DISCL). All rights reserved.</p>
                <div className="flex items-center gap-3">
                  <button className="hover:underline">Privacy Policy</button>
                  <span>|</span>
                  <button className="hover:underline">Terms of Use</button>
                </div>
              </footer>
            </>
          )}
        </main>
      </div>

      {/* MODAL: VERIFY AND RELEASE STUDENT */}
      {releaseStudent && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto border border-slate-200 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
                <ShieldCheck size={22} className="text-emerald-600" /> Verify &amp; Release Student
              </h3>
              <button
                type="button"
                onClick={() => setReleaseStudent(null)}
                disabled={isReleasing}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <StudentPickupVerify
              pickupNotice={releaseStudent.pickup_notice}
              pickupRequest={releaseStudent.pickup_request}
              pickupPersons={releaseStudent.pickup_persons}
              readyForPickup={true}
            />

            <div className="flex gap-3 pt-5 border-t border-slate-100 mt-4">
              <button
                type="button"
                onClick={() => setReleaseStudent(null)}
                disabled={isReleasing}
                className="flex-1 py-2.5 border border-slate-300 rounded-xl font-bold text-xs text-slate-700 hover:bg-slate-50 cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isReleasing}
                onClick={async () => {
                  if (!releaseStudent?.student || !schoolId) return;
                  setIsReleasing(true);
                  try {
                    const studentId = releaseStudent.student.id || releaseStudent.student.student_id;
                    const pickupName =
                      releaseStudent.pickup_notice?.pickup_person_name ||
                      releaseStudent.pickup_request?.pickup_person_name ||
                      releaseStudent.pickup_persons?.[0]?.name ||
                      releaseStudent.queueItem?.pickup_person_name ||
                      'Authorized Parent / Escort';

                    const pickupPhone =
                      releaseStudent.pickup_notice?.pickup_person_phone ||
                      releaseStudent.pickup_request?.pickup_person_phone ||
                      releaseStudent.pickup_persons?.[0]?.phone ||
                      releaseStudent.queueItem?.pickup_person_phone ||
                      null;

                    const res = await fetch('/api/gate/accept', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      credentials: 'include',
                      body: JSON.stringify({
                        school_id: schoolId,
                        student_id: studentId,
                        type: 'departure',
                        verification_method: 'gate_officer_verified',
                        person_type: 'student',
                        from_ready_queue: true,
                        pickup_person_name: pickupName,
                        pickup_person_phone: pickupPhone,
                      }),
                    });

                    const data = await res.json();
                    if (!res.ok) {
                      throw new Error(data.error || 'Failed to release student');
                    }

                    toast.success(
                      `Student ${releaseStudent.student?.first_name || 'Student'} successfully released to ${pickupName}!`
                    );
                    setReleaseStudent(null);
                    loadGateData();
                  } catch (err: any) {
                    toast.error(err.message || 'Release failed');
                  } finally {
                    setIsReleasing(false);
                  }
                }}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {isReleasing ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" /> Releasing...
                  </>
                ) : (
                  'Confirm Release'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: QR SCANNER */}
      {showScanModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto border border-slate-200 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
                <QrCode size={22} className="text-emerald-600" />
                Scan {scanType === 'student' ? 'Student' : 'Staff'} ID Card
              </h3>
              <button onClick={() => setShowScanModal(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X size={20} />
              </button>
            </div>

            {scanType === 'student' ? (
              <StudentIdScanPanel
                schoolId={schoolId}
                mode="arrival"
                onModeChange={() => { }}
                onSuccess={() => {
                  loadGateData();
                  setShowScanModal(false);
                }}
              />
            ) : (
              <StaffIdScanPanel
                schoolId={schoolId}
                mode="arrival"
                onModeChange={() => { }}
                onSuccess={() => {
                  loadGateData();
                  setShowScanModal(false);
                }}
              />
            )}
          </div>
        </div>
      )}

      {/* MODAL: NOTIFICATIONS DRAWER */}
      {showNotifications && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 flex justify-end">
          <div className="bg-white w-full max-w-md h-full shadow-2xl p-5 overflow-y-auto flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="font-extrabold text-base text-slate-900">Gate Notifications</h3>
              <button onClick={() => setShowNotifications(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X size={20} />
              </button>
            </div>
            <NotificationsInbox schoolId={schoolId} />
          </div>
        </div>
      )}

      {/* MODAL: SEARCH STUDENT */}
      {showSearchModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto border border-slate-200 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
                <Search size={22} className="text-emerald-600" /> Search Student Directory
              </h3>
              <button onClick={() => setShowSearchModal(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X size={20} />
              </button>
            </div>

            <div className="relative mb-4">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="search"
                value={studentSearchQuery}
                onChange={(e) => setStudentSearchQuery(e.target.value)}
                placeholder="Search by student name, ID number, or class..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>

            <div className="space-y-2 max-h-72 overflow-y-auto">
              {allStudents
                .filter((s) => {
                  if (!studentSearchQuery.trim()) return true;
                  const q = studentSearchQuery.toLowerCase();
                  return `${s.first_name} ${s.last_name} ${s.student_id_number} ${s.class?.name || ''}`
                    .toLowerCase()
                    .includes(q);
                })
                .slice(0, 10)
                .map((s) => (
                  <div key={s.id} className="p-3 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <StudentAvatar photoUrl={s.photo_url} firstName={s.first_name} lastName={s.last_name} size="sm" />
                      <div>
                        <p className="font-bold text-xs text-slate-900">{s.first_name} {s.last_name}</p>
                        <p className="text-[10px] text-slate-500 font-mono">S/ID: {s.student_id_number} · {s.class?.name || 'No Class'}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setShowSearchModal(false);
                        handleReleaseClick(s);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs cursor-pointer"
                    >
                      Select / Release
                    </button>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: REGISTER VISITOR */}
      {showVisitorModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto border border-slate-200 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
                <UserPlus size={22} className="text-purple-600" /> Register Visitor Entry
              </h3>
              <button
                type="button"
                onClick={() => setShowVisitorModal(false)}
                disabled={isRegisteringVisitor}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!schoolId) return;
                const form = e.currentTarget;
                const name = (form.elements.namedItem('visitorName') as HTMLInputElement).value;
                const phone = (form.elements.namedItem('visitorPhone') as HTMLInputElement).value;
                const purpose = (form.elements.namedItem('visitPurpose') as HTMLInputElement).value;
                const vehicle = (form.elements.namedItem('vehiclePlate') as HTMLInputElement)?.value || '';

                setIsRegisteringVisitor(true);
                try {
                  const res = await fetch('/api/gate/visitors', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({
                      action: 'register_visitor',
                      school_id: schoolId,
                      visitor_data: {
                        full_name: name,
                        phone,
                        purpose_of_visit: purpose,
                        vehicle_plate: vehicle,
                        person_to_see: 'School Admin / Staff',
                        visitor_type: 'Visitor / Guardian',
                      },
                    }),
                  });

                  const json = await res.json();
                  if (!res.ok || !json.success) {
                    throw new Error(json.error || 'Registration failed');
                  }

                  toast.success(`Visitor ${json.visitor?.full_name || name} registered successfully!`);
                  setShowVisitorModal(false);
                  if (json.visitor) {
                    setCreatedVisitorPass(json.visitor);
                  }
                  loadGateData();
                } catch (err: any) {
                  toast.error(err.message || 'Failed to register visitor');
                } finally {
                  setIsRegisteringVisitor(false);
                }
              }}
              className="space-y-4 text-xs font-semibold"
            >
              <div>
                <label className="block text-slate-700 mb-1">Visitor Full Name</label>
                <input
                  required
                  name="visitorName"
                  type="text"
                  placeholder="e.g. Mr. Chidi Okafor"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                />
              </div>
              <div>
                <label className="block text-slate-700 mb-1">Phone Number</label>
                <input
                  required
                  name="visitorPhone"
                  type="tel"
                  placeholder="e.g. 0803 123 4567"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                />
              </div>
              <div>
                <label className="block text-slate-700 mb-1">Vehicle Plate (Optional)</label>
                <input
                  name="vehiclePlate"
                  type="text"
                  placeholder="e.g. LAG-458-XY"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs uppercase font-mono text-slate-900 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-slate-700 mb-1">Purpose of Visit / Person to See</label>
                <input
                  required
                  name="visitPurpose"
                  type="text"
                  placeholder="e.g. Meeting with Principal"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                />
              </div>
              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowVisitorModal(false)}
                  disabled={isRegisteringVisitor}
                  className="flex-1 py-2.5 border border-slate-300 rounded-xl font-bold text-slate-700 hover:bg-slate-50 cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isRegisteringVisitor}
                  className="flex-1 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold shadow-md cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  {isRegisteringVisitor ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" /> Registering...
                    </>
                  ) : (
                    'Register Entry & Generate Pass'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: DIGITAL VISITOR PASS */}
      {createdVisitorPass && (
        <DigitalVisitorPassModal
          visitor={createdVisitorPass}
          schoolName={schoolInfo.name}
          onClose={() => setCreatedVisitorPass(null)}
        />
      )}

      {/* MODAL: INCIDENT REPORT */}
      {showIncidentModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto border border-slate-200 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
                <AlertTriangle size={22} className="text-red-600" /> Log Incident Report
              </h3>
              <button
                type="button"
                onClick={() => setShowIncidentModal(false)}
                disabled={isReportingIncident}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!schoolId) return;
                const form = e.currentTarget;
                const category = (form.elements.namedItem('category') as HTMLSelectElement).value;
                const description = (form.elements.namedItem('description') as HTMLTextAreaElement).value;

                setIsReportingIncident(true);
                try {
                  const res = await fetch('/api/gate/activity-log', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({
                      action: 'report_incident',
                      school_id: schoolId,
                      category,
                      description,
                    }),
                  });

                  const json = await res.json();
                  if (!res.ok || !json.success) {
                    throw new Error(json.error || 'Failed to log incident');
                  }

                  toast.success(`Incident report (${category}) logged successfully.`);
                  setShowIncidentModal(false);
                  loadGateData();
                } catch (err: any) {
                  toast.error(err.message || 'Failed to log incident');
                } finally {
                  setIsReportingIncident(false);
                }
              }}
              className="space-y-4 text-xs font-semibold"
            >
              <div>
                <label className="block text-slate-700 mb-1">Incident Category</label>
                <select
                  name="category"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                >
                  <option value="Security">Security Incident</option>
                  <option value="Traffic">Traffic / Vehicle Incident</option>
                  <option value="Visitor">Visitor Dispute</option>
                  <option value="Medical">Medical Emergency</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-slate-700 mb-1">Detailed Description</label>
                <textarea
                  required
                  name="description"
                  rows={3}
                  placeholder="Describe what happened at the gate..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                />
              </div>
              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowIncidentModal(false)}
                  disabled={isReportingIncident}
                  className="flex-1 py-2.5 border border-slate-300 rounded-xl font-bold text-slate-700 hover:bg-slate-50 cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isReportingIncident}
                  className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold shadow-md cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  {isReportingIncident ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" /> Submitting...
                    </>
                  ) : (
                    'Submit Incident Report'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function LayoutDashboardIcon(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect width="7" height="9" x="3" y="3" rx="1" />
      <rect width="7" height="5" x="14" y="3" rx="1" />
      <rect width="7" height="9" x="14" y="12" rx="1" />
      <rect width="7" height="5" x="3" y="16" rx="1" />
    </svg>
  );
}
