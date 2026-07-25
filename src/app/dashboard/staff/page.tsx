// @ts-nocheck
'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { fetchData, logout, getSession } from '@/lib/api';
import { formatTimeLagos, todayInLagos } from '@/lib/timezone';
import { createClient } from '@/lib/supabase/client';
import StudentAvatar from '@/components/shared/StudentAvatar';
import {
  LogOut,
  ClipboardList,
  Clock,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  MessageSquare,
  Send,
  ChevronLeft,
  Search
} from 'lucide-react';
import { toast } from 'sonner';

export default function StaffDashboardPage() {
  const [session, setSession] = useState<any>(null);
  const [schoolId, setSchoolId] = useState('');
  const [schoolName, setSchoolName] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [loading, setLoading] = useState(true);

  // Time & Live Clock State
  const [currentTime, setCurrentTime] = useState<Date | null>(null);

  // Attendance stats for the current month
  const [stats, setStats] = useState({ present: 0, absent: 0, rate: 0, schoolDays: 0 });

  // History filtering states
  const [filter, setFilter] = useState<'daily' | 'weekly' | 'monthly' | 'custom'>('daily');
  const [selectedDate, setSelectedDate] = useState(todayInLagos());
  const [historyData, setHistoryData] = useState<any>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);

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

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatHistory]);

  // Initialize live ticking clock
  useEffect(() => {
    setCurrentTime(new Date());
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Split date and time for digital clock layout
  const clockDisplay = useMemo(() => {
    if (!currentTime) return { dateStr: 'Loading...', timeStr: '--:--:--' };
    
    const timeStr = currentTime.toLocaleTimeString('en-NG', {
      timeZone: 'Africa/Lagos',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });

    const dateStr = currentTime.toLocaleDateString('en-NG', {
      timeZone: 'Africa/Lagos',
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric'
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
        setSchoolName(data.school_name || '');
        setJobTitle(data.job_title || 'Staff');
        
        if (data.school_id) {
          await loadMonthStats(data.school_id);
        }
      } catch (err) {
        console.error('Failed to load staff details:', err);
      }
      setLoading(false);
    })();
  }, []);

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

  // Real-time message listener
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

  // Fetch month summary metrics (Present, Absent, Rate)
  const loadMonthStats = async (sId: string) => {
    try {
      const currentMonth = todayInLagos().slice(0, 7); // YYYY-MM
      const params = new URLSearchParams({
        school_id: sId,
        type: 'monthly',
        view: 'staff',
        month: currentMonth
      });
      const res = await fetch(`/api/attendance/reports?${params}`, { credentials: 'include' });
      const json = await res.json();
      if (res.ok && json.staff_report && json.staff_report.length > 0) {
        const myRecord = json.staff_report[0];
        const present = myRecord.days_present || 0;
        const schoolDays = myRecord.school_days || 0;
        const absent = Math.max(0, schoolDays - present);
        const rate = schoolDays > 0 ? Math.round((present / schoolDays) * 100) : 100;
        setStats({ present, absent, rate, schoolDays });
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

  // Re-run history fetch on state change
  useEffect(() => {
    if (schoolId) {
      loadHistory(schoolId, filter, selectedDate);
    }
  }, [schoolId, filter, selectedDate]);

  const handleLogout = () => {
    logout();
  };

  // Safe helper to format YYYY-MM-DD string to user-friendly local date
  const formatHistoryDate = (dateStr: string) => {
    try {
      const [year, month, day] = dateStr.split('-').map(Number);
      const date = new Date(year, month - 1, day);
      return date.toLocaleDateString('en-NG', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

  // Dynamic status pill renderer
  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'present':
      case 'on_time':
        return (
          <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 text-xs px-2.5 py-1 rounded-full font-bold border border-emerald-100">
            <CheckCircle2 size={12} /> Present
          </span>
        );
      case 'late':
        return (
          <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 text-xs px-2.5 py-1 rounded-full font-bold border border-amber-100">
            <Clock size={12} /> Late
          </span>
        );
      case 'absent':
        return (
          <span className="inline-flex items-center gap-1 bg-red-50 text-red-700 text-xs px-2.5 py-1 rounded-full font-bold border border-red-100">
            <XCircle size={12} /> Absent
          </span>
        );
      case 'weekend':
        return (
          <span className="inline-flex items-center bg-slate-100 text-slate-500 text-xs px-2.5 py-1 rounded-full font-medium">
            Weekend
          </span>
        );
      case 'excluded':
        return (
          <span className="inline-flex items-center bg-slate-100 text-slate-400 text-xs px-2.5 py-1 rounded-full font-medium">
            Holiday
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center bg-slate-50 text-slate-500 text-xs px-2.5 py-1 rounded-full font-medium">
            {status}
          </span>
        );
    }
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
      <div className="min-h-screen flex items-center justify-center bg-slate-50/50">
        <div className="animate-pulse text-primary-600 font-semibold text-lg">Loading Staff Dashboard...</div>
      </div>
    );
  }

  // Extract records array from response (for weekly/monthly reports)
  const rangeDays = historyData?.staff_report?.[0]?.days || [];

  // Extract record object (for daily/custom date reports)
  const dailyRecord = historyData?.staff_report?.[0];

  return (
    <div className="page-shell max-w-xl mx-auto pt-6 pb-12 px-4">
      {/* Header Banner Section */}
      <div className="hero-banner relative overflow-hidden flex flex-col md:flex-row md:items-center md:justify-between gap-4 p-6 rounded-3xl mb-6">
        <div>
          <p className="text-emerald-100/80 text-xs font-semibold uppercase tracking-wider mb-1">
            {jobTitle}
          </p>
          <h1 className="text-xl md:text-2xl font-extrabold text-white tracking-tight leading-tight">
            {schoolName || 'My School'}
          </h1>
          <p className="text-white/90 text-sm mt-1.5 font-medium">
            Welcome, {session?.full_name || 'Staff Member'}
          </p>
        </div>

        {/* Live Digital Clock */}
        <div className="bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl px-4 py-2.5 shrink-0 flex flex-col items-start md:items-end">
          <div className="flex items-center gap-1.5 text-white/90 text-xs font-semibold">
            <Clock size={14} className="text-emerald-300 animate-pulse" />
            <span>WAT (Lagos)</span>
          </div>
          <p className="text-base font-bold text-white mt-1">
            {clockDisplay.timeStr}
          </p>
          <p className="text-[10px] text-emerald-200 mt-0.5">
            {clockDisplay.dateStr}
          </p>
        </div>
      </div>

      {/* Dashboard Summary Stats Section */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="card hover:shadow-md hover:scale-[1.01] transition-all flex flex-col justify-between py-4">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Present</p>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
              <CheckCircle2 size={16} />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-bold text-slate-900">{stats.present}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">Days this month</p>
          </div>
        </div>

        <div className="card hover:shadow-md hover:scale-[1.01] transition-all flex flex-col justify-between py-4">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Absent</p>
            <div className="w-7 h-7 rounded-lg bg-red-50 flex items-center justify-center text-red-500">
              <XCircle size={16} />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-bold text-slate-900">{stats.absent}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">Days missed</p>
          </div>
        </div>

        <div className="card hover:shadow-md hover:scale-[1.01] transition-all flex flex-col justify-between py-4">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Rate</p>
            <div className="w-7 h-7 rounded-lg bg-primary-50 flex items-center justify-center text-primary-700">
              <span className="text-xs font-bold">%</span>
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-bold text-primary-700">{stats.rate}%</p>
            <p className="text-[10px] text-slate-400 mt-0.5">Monthly rate</p>
          </div>
        </div>
      </div>

      {/* Attendance History Filters Section */}
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <ClipboardList size={18} className="text-slate-500" />
            Attendance History
          </h2>
          
          <button
            type="button"
            onClick={handleLogout}
            className="btn-secondary px-3 py-1.5 flex items-center gap-1.5 text-xs text-red-600 hover:text-red-700 hover:bg-red-50/50 border-red-100 shadow-none"
          >
            <LogOut size={14} />
            Sign out
          </button>
        </div>

        {/* Quick Filter Pill Tabs & Date Picker */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-white p-2 rounded-2xl shadow-xs border border-slate-100">
          <div className="col-span-1 sm:col-span-3 flex gap-1 bg-slate-100/70 p-1 rounded-xl">
            {(['daily', 'weekly', 'monthly'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setFilter(t)}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all text-center ${
                  filter === t
                    ? 'bg-white text-primary-700 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {t === 'daily' ? 'Today' : t === 'weekly' ? 'Weekly' : 'Monthly'}
              </button>
            ))}
          </div>
          
          <div className="relative">
            <input
              type="date"
              value={selectedDate}
              max={todayInLagos()}
              onChange={(e) => {
                setSelectedDate(e.target.value);
                setFilter('custom');
              }}
              className={`w-full px-3 py-2 rounded-xl border text-xs font-bold outline-none transition-all ${
                filter === 'custom'
                  ? 'border-primary-400 bg-primary-50/10 text-primary-700 ring-2 ring-primary-200/50'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            />
          </div>
        </div>
      </div>

      {/* History Detail Logs List */}
      <div className="mb-6">
        {loadingHistory ? (
          <div className="space-y-3">
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-16 rounded-2xl bg-white border border-slate-100 animate-pulse" />
            ))}
          </div>
        ) : (
          <>
            {/* Daily or Custom date view */}
            {(filter === 'daily' || filter === 'custom') && (
              <>
                {historyData?.excluded ? (
                  <div className="card p-6 text-center border-dashed border-2 border-slate-200/80 bg-slate-50/50">
                    <Calendar className="mx-auto text-slate-300 mb-2" size={32} />
                    <p className="font-semibold text-slate-700">Non-school Day</p>
                    <p className="text-xs text-slate-500 mt-1">
                      {historyData.excluded_title || 'No expectations for this day.'}
                    </p>
                  </div>
                ) : !dailyRecord ? (
                  <div className="card p-6 text-center border-dashed border-2 border-slate-200/80 bg-slate-50/50">
                    <XCircle className="mx-auto text-red-300 mb-2" size={32} />
                    <p className="font-semibold text-slate-700">No Record Found</p>
                    <p className="text-xs text-slate-500 mt-1">
                      No sign-in activity recorded for {filter === 'daily' ? 'today' : formatHistoryDate(selectedDate)}.
                    </p>
                  </div>
                ) : (
                  <div className="card-elevated divide-y divide-slate-100 bg-white">
                    <div className="p-5 flex items-center justify-between">
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Date</p>
                        <p className="text-sm font-bold text-slate-800 mt-1">
                          {formatHistoryDate(filter === 'daily' ? todayInLagos() : selectedDate)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider text-right">Status</p>
                        <div className="mt-1 text-right">{renderStatusBadge(dailyRecord.status)}</div>
                      </div>
                    </div>

                    <div className="p-5 grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Clock in</p>
                        <p className="text-base font-extrabold text-slate-800 mt-1 select-all">
                          {formatTimeLagos(dailyRecord.clock_in_time)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Clock out</p>
                        <p className="text-base font-extrabold text-slate-800 mt-1 select-all">
                          {formatTimeLagos(dailyRecord.clock_out_time)}
                        </p>
                      </div>
                    </div>

                    {dailyRecord.minutes_late !== null && dailyRecord.minutes_late > 0 && (
                      <div className="p-4 bg-amber-50/50 flex items-center gap-2 border-t border-amber-100/50 text-amber-900 text-xs px-5">
                        <AlertTriangle size={14} className="text-amber-600 shrink-0" />
                        <span>
                          Scanned in <strong>{dailyRecord.minutes_late} minutes late</strong> past the school arrival threshold.
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {/* Weekly or Monthly range view */}
            {(filter === 'weekly' || filter === 'monthly') && (
              <div className="card-elevated divide-y divide-slate-100 bg-white">
                {rangeDays.slice().reverse().map((day: any) => (
                  <div key={day.date} className="list-row flex items-center justify-between py-3.5 px-5">
                    <div className="flex items-center gap-3">
                      <Calendar size={16} className="text-slate-400 shrink-0" />
                      <div>
                        <p className="text-sm font-semibold text-slate-800">
                          {formatHistoryDate(day.date)}
                        </p>
                        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">{day.date}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      {day.minutes_late != null && day.minutes_late > 0 && (
                        <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded-lg">
                          {day.minutes_late}m late
                        </span>
                      )}
                      {renderStatusBadge(day.status)}
                    </div>
                  </div>
                ))}
                {rangeDays.length === 0 && (
                  <div className="p-8 text-center text-slate-400 text-sm">
                    No sign-in records found for this period.
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* EduChat Quick Access Card */}
      <div className="card-elevated p-0 overflow-hidden mb-6 bg-white border border-slate-100 shadow-sm">
        {/* Card Header */}
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="relative w-8 h-8 rounded-lg bg-primary-50 flex items-center justify-center text-primary-700">
              <MessageSquare size={16} />
              {students.reduce((acc, s) => acc + (s.unread_count || 0), 0) > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[16px] h-[16px] bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-0.5 animate-pulse">
                  {students.reduce((acc, s) => acc + (s.unread_count || 0), 0) > 9
                    ? '9+'
                    : students.reduce((acc, s) => acc + (s.unread_count || 0), 0)}
                </span>
              )}
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-800">EduChat Quick Access</h2>
              <p className="text-[10px] text-slate-500">Private staff and school office channels</p>
            </div>
          </div>
          {selectedStudent && (
            <button
              type="button"
              onClick={() => setSelectedStudent(null)}
              className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1 font-bold"
            >
              <ChevronLeft size={14} /> Back to list
            </button>
          )}
        </div>

        {/* Card Body */}
        {loadingStudents ? (
          <div className="p-6 text-center text-xs text-slate-400 animate-pulse font-medium">
            Loading channels...
          </div>
        ) : !selectedStudent ? (
          /* Student Thread List View */
          <div className="flex flex-col">
            <div className="p-3 border-b border-slate-100">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                <input
                  type="search"
                  value={chatSearch}
                  onChange={(e) => setChatSearch(e.target.value)}
                  placeholder="Search students or classes..."
                  className="w-full pl-8 pr-3 py-1.5 border border-slate-200 rounded-xl text-xs outline-none focus:ring-1 focus:ring-primary-500 focus:border-transparent bg-slate-50"
                />
              </div>
            </div>

            <div className="max-h-[300px] overflow-y-auto divide-y divide-slate-50">
              {(() => {
                const query = chatSearch.trim().toLowerCase();
                const filtered = students.filter((s: any) => {
                  const name = `${s.first_name} ${s.last_name}`.toLowerCase();
                  const className = (s.class?.name || '').toLowerCase();
                  return name.includes(query) || className.includes(query);
                });

                if (filtered.length === 0) {
                  return (
                    <p className="text-xs text-slate-400 text-center py-6">
                      No student threads available.
                    </p>
                  );
                }

                return filtered.map((s: any) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSelectedStudent(s)}
                    className="w-full text-left p-3 hover:bg-slate-50/70 transition-all flex items-center gap-3"
                  >
                    <StudentAvatar photoUrl={s.photo_url} firstName={s.first_name} lastName={s.last_name} size="sm" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-bold text-slate-800 truncate">
                          {s.first_name} {s.last_name}
                        </p>
                        {s.unread_count > 0 && (
                          <span className="bg-emerald-500 text-white font-extrabold text-[8px] px-1.5 py-0.5 rounded-full">
                            {s.unread_count}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between mt-0.5">
                        <p className="text-[10px] text-slate-500 truncate">
                          {s.class?.name || 'No Class'}
                        </p>
                        {s.last_message && (
                          <p className="text-[9px] text-slate-400 truncate max-w-[150px] italic">
                            {s.last_message.message}
                          </p>
                        )}
                      </div>
                    </div>
                  </button>
                ));
              })()}
            </div>
          </div>
        ) : (
          /* Active Chat Thread View */
          <div className="flex flex-col bg-slate-50/40">
            {/* Sub-header with Recipient Pills */}
            <div className="p-3 border-b border-slate-100 bg-white flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <StudentAvatar
                  photoUrl={selectedStudent.photo_url}
                  firstName={selectedStudent.first_name}
                  lastName={selectedStudent.last_name}
                  size="xs"
                />
                <p className="text-xs font-bold text-slate-800 truncate">
                  {selectedStudent.first_name} {selectedStudent.last_name}
                </p>
              </div>

              {/* Selector */}
              <div className="flex gap-1 bg-slate-100 p-0.5 rounded-lg shrink-0">
                <button
                  key="teacher"
                  type="button"
                  onClick={() => setChatRecipientType('teacher')}
                  className={`px-2 py-1 text-[9px] font-bold rounded transition-all ${
                    chatRecipientType === 'teacher'
                      ? 'bg-white text-slate-800 shadow-2xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Class Teachers
                </button>
                <button
                  key="school"
                  type="button"
                  onClick={() => setChatRecipientType('school')}
                  className={`px-2 py-1 text-[9px] font-bold rounded transition-all ${
                    chatRecipientType === 'school'
                      ? 'bg-white text-slate-800 shadow-2xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Admin
                </button>
              </div>
            </div>

            {/* Messages Thread Container */}
            <div className="h-[220px] overflow-y-auto p-3 flex flex-col gap-2.5 bg-slate-50/60">
              {chatHistory.length === 0 ? (
                <div className="my-auto text-center py-4">
                  <MessageSquare size={24} className="mx-auto text-slate-300 mb-1" />
                  <p className="text-[10px] text-slate-400 font-medium">No history in this thread</p>
                  <p className="text-[9px] text-slate-400 mt-0.5">
                    Send a private message to begin staff chat.
                  </p>
                </div>
              ) : (
                chatHistory.map((m: any) => {
                  const isOutbound = m.sender_id === session?.user_id;
                  const senderInitial = (m.sender_name?.[0] || 'S').toUpperCase();

                  return (
                    <div
                      key={m.id}
                      className={`flex items-start gap-1.5 max-w-[85%] ${
                        isOutbound ? 'ml-auto flex-row-reverse' : 'mr-auto'
                      }`}
                    >
                      <div className="w-6 h-6 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-[10px] font-bold border border-slate-300 shrink-0">
                        {senderInitial}
                      </div>

                      <div
                        className={`flex flex-col rounded-xl p-2.5 shadow-3xs ${
                          isOutbound
                            ? 'bg-primary-600 text-white rounded-tr-none'
                            : 'bg-white text-slate-800 border border-slate-100 rounded-tl-none'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className={`text-[8px] font-bold uppercase ${
                            isOutbound ? 'text-white/80' : 'text-primary-700'
                          }`}>
                            {m.sender_name}
                          </span>
                          {m.recipient_type === 'teacher' && (
                            <span className="bg-amber-100/90 text-amber-800 text-[7px] font-extrabold px-1 rounded-sm shrink-0">
                              Staff
                            </span>
                          )}
                          {m.recipient_type === 'school' && (
                            <span className="bg-blue-100/90 text-blue-800 text-[7px] font-extrabold px-1 rounded-sm shrink-0">
                              Admin
                            </span>
                          )}
                        </div>
                        <p className="text-xs leading-normal break-words whitespace-pre-line">
                          {m.content}
                        </p>
                        <span className={`text-[7px] mt-1 text-right block ${
                          isOutbound ? 'text-white/60' : 'text-slate-400'
                        }`}>
                          {m.created_at ? new Date(m.created_at).toLocaleTimeString('en-NG', {
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: true
                          }) : ''}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input Form */}
            <div className="p-2 bg-white border-t border-slate-100 flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={chatText}
                  onChange={(e) => setChatText(e.target.value)}
                  placeholder={
                    chatRecipientType === 'teacher'
                      ? "Send message to class teachers..."
                      : "Send message to school admin..."
                  }
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && chatText.trim() && !sendingChat) {
                      handleSendChat();
                    }
                  }}
                  className="flex-1 px-3 py-1.5 border border-slate-200 rounded-lg text-xs outline-none focus:ring-1 focus:ring-primary-500"
                  disabled={sendingChat}
                />
                <button
                  type="button"
                  onClick={handleSendChat}
                  disabled={sendingChat || !chatText.trim()}
                  className="btn-primary p-2 h-8 w-8 rounded-lg flex items-center justify-center shrink-0"
                >
                  <Send size={12} />
                </button>
              </div>

              {/* Profile attachment toggle */}
              <label className="inline-flex items-center gap-1.5 text-[9px] text-slate-500 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={attachPhoto}
                  onChange={(e) => setAttachPhoto(e.target.checked)}
                  className="rounded border-slate-300 text-primary-600 focus:ring-primary-500 h-3 w-3"
                />
                <span>Attach my profile photo card</span>
              </label>
            </div>
          </div>
        )}
      </div>

      {/* footer note */}
      <p className="text-[10px] text-slate-400 text-center mt-6 leading-relaxed">
        Clock-in records are automatically logged via gate scanner or admin override. Time values displayed are localized in West Africa Time (Lagos).
      </p>
    </div>
  );
}
