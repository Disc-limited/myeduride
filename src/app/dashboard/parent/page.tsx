// @ts-nocheck
'use client';

import { useEffect, useState, useRef } from 'react';
import { fetchData, getSession, logout } from '@/lib/api';
import StudentAvatar from '@/components/shared/StudentAvatar';
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
  Image,
  X,
  Paperclip,
} from 'lucide-react';
import { toast } from 'sonner';
import { formatTimeLagos, formatDateTimeLagos, todayInLagos } from '@/lib/timezone';
import { photoSrc } from '@/lib/photo';
import { DAY_STATUS_LABELS } from '@/lib/attendance/status';
import PickupPersonsManager from '@/components/pickup/PickupPersonsManager';
import { useFileUpload } from '@/hooks/useFileUpload';
import { ChatAttachmentPreview } from '@/components/chat/ChatAttachmentPreview';
import { ChatMediaBubble } from '@/components/chat/ChatMediaBubble';
import { VoiceRecordButton } from '@/components/chat/VoiceRecordButton';

const ADVERT_SERVICES = [
  {
    title: "Safe Student Pickups",
    desc: "Only registered guardians with valid security badges can authorize student releases at the gate.",
    icon: "🔒",
    gradient: "from-teal-600 to-emerald-500",
  },
  {
    title: "Live Attendance Tracking",
    desc: "Receive instant notifications and logs when your child checks in or checks out of the school gate.",
    icon: "📡",
    gradient: "from-blue-600 to-indigo-500",
  },
  {
    title: "EduChart – Direct Messaging",
    desc: "Reach out to your child's class teacher or the school administration office instantly via EduChart.",
    icon: "✉️",
    gradient: "from-pink-600 to-rose-500",
  },
  {
    title: "Smart Dismissal Queues",
    desc: "Notify class teachers automatically as soon as your vehicle approaches the gate area for pickup.",
    icon: "🚗",
    gradient: "from-amber-600 to-orange-500",
  }
];

export default function ParentDashboard() {
  const [children, setChildren] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState('');
  const [tab, setTab] = useState('children');
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
  const [selectedChild, setSelectedChild] = useState('');
  const [historyType, setHistoryType] = useState('daily');
  const [historyDate, setHistoryDate] = useState(todayInLagos());
  const [historyYear, setHistoryYear] = useState(String(new Date().getFullYear()));
  const [historyTerm, setHistoryTerm] = useState('1');
  const [historyData, setHistoryData] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [notifyMessage, setNotifyMessage] = useState('');

  const [messageForm, setMessageForm] = useState({
    student_id: '',
    recipient_type: 'teacher', // 'teacher' | 'school'
    message_text: '',
  });
  const [sendingMessage, setSendingMessage] = useState(false);
  const [chatHistory, setChatHistory] = useState([]);
  const [attachPhoto, setAttachPhoto] = useState(false);
  const [loadingChat, setLoadingChat] = useState(false);
  const [activeAdIndex, setActiveAdIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  // Phase 2 states
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { uploadFile, uploading: uploadingFile } = useFileUpload();
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);

  const [unreadEduChartCount, setUnreadEduChartCount] = useState(0);

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
        setUnreadEduChartCount(data.unread_total);
      }
    } catch (e) {
      console.error('Failed to fetch unread chat count:', e);
    }
  };

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

  // Listen for real-time chat messages when viewing chat
  useEffect(() => {
    const studentId = messageForm.student_id || (children[0]?.id || '');
    if (tab !== 'messages' || !studentId) return;

    // Load initial history
    loadChatHistory(studentId);

    const session = getSession();
    if (!session?.user_id) return;

    const supabase = createClient();

    // Subscribe to Postgres changes on chat_messages table for this student thread
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

          // Format new message (mapping content to message for UI compatibility)
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
            is_read: newMsg.is_read,
            title: newMsg.title || null,
          };

          // Append if not duplicate
          setChatHistory((prev) => {
            if (prev.some((m) => m.id === formatted.id)) return prev;
            return [...prev, formatted];
          });

          // Mark thread as read
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
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [messageForm.student_id, tab, children]);

  // Global realtime listener for unread EduChart messages count
  useEffect(() => {
    fetchUnreadChatTotal();
    const supabase = createClient();
    const channel = supabase
      .channel('parent-global-chat-unread')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chat_messages',
        },
        () => {
          fetchUnreadChatTotal();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setIsFlipped(true);
      setTimeout(() => {
        setActiveAdIndex((prev) => (prev + 1) % ADVERT_SERVICES.length);
        setIsFlipped(false);
      }, 2200);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleSendMessage = async () => {
    const studentId = messageForm.student_id || (children[0]?.id || '');
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

  const [session, setSession] = useState(null);

  useEffect(() => {
    const sess = getSession();
    setSession(sess);
    if (sess) {
      setUserName(sess.full_name || 'Parent');
      loadData();
    } else {
      setLoading(false);
    }
  }, []);

  const submitPickupNotice = async () => {
    if (!pickupForm.student_id || !pickupForm.pickup_person_name.trim()) {
      toast.error('Select a child and who will pick them up');
      return;
    }
    setSubmittingPickup(true);
    try {
      const res = await fetch('/api/parents/pickup-notice', {
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
      const data = await res.json();
      if (data.success) {
        toast.success('School and gate have been notified');
        setPickupForm((f) => ({ ...f, notes: '', relationship: '' }));
        const noticeRes = await fetch('/api/parents/pickup-notice', { credentials: 'include' });
        const noticeData = await noticeRes.json();
        setRecentNotices(noticeData.notices || []);
      } else {
        toast.error(data.error || 'Could not send');
      }
    } catch {
      toast.error('Failed to send notice');
    }
    setSubmittingPickup(false);
  };

  const loadData = async () => {
    try {
      const [kidsRes, notifRes] = await Promise.all([
        fetchData('get_parent_children'),
        fetchData('get_parent_notifications'),
      ]);
      setChildren(kidsRes.children || []);
      setNotifications(notifRes.notifications || []);
      const sess = getSession();
      if (kidsRes.children?.[0]) {
        const firstId = kidsRes.children[0].id;
        setSelectedChild((c) => c || firstId);
        setMessageForm((f) => ({ ...f, student_id: f.student_id || firstId }));
        setPickupForm((f) => ({
          ...f,
          student_id: f.student_id || firstId,
          pickup_person_name: f.is_self ? (sess?.full_name || '') : f.pickup_person_name,
        }));
      }
      const noticeRes = await fetch('/api/parents/pickup-notice', { credentials: 'include' });
      const noticeData = await noticeRes.json();
      setRecentNotices(noticeData.notices || []);
    } catch (err) {
      console.error(err);
      toast.error('Could not load your dashboard');
    }
    setLoading(false);
  };

  const markRead = async (id) => {
    await fetchData('mark_notification_read', { notification_id: id });
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

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
    } catch (e) {
      toast.error(e.message || 'Could not load history');
      setHistoryData(null);
    }
    setHistoryLoading(false);
  };

  useEffect(() => {
    if (tab === 'attendance' && selectedChild) loadAttendanceHistory();
  }, [tab, selectedChild, historyType, historyDate, historyYear, historyTerm]);

  const submitNotifySchool = async () => {
    if (!pickupForm.student_id || !pickupForm.pickup_person_name.trim()) {
      toast.error('Select child and pickup person');
      return;
    }
    setSubmittingPickup(true);
    const msg =
      notifyMessage.trim() ||
      `Today, ${pickupForm.pickup_person_name.trim()} will pick up my child.${pickupForm.pickup_person_phone ? ` Phone: ${pickupForm.pickup_person_phone}` : ''}`;
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

      toast.success('School admin and gate notified');
      setNotifyMessage('');
      const noticeRes = await fetch('/api/parents/pickup-notice', { credentials: 'include' });
      const noticeData = await noticeRes.json();
      setRecentNotices(noticeData.notices || []);
    } catch (e) {
      toast.error(e.message || 'Failed to notify school');
    }
    setSubmittingPickup(false);
  };

  const notifIcon = (type) => {
    if (type === 'late') return <Clock size={18} className="text-amber-500" />;
    if (type === 'departure') return <AlertTriangle size={18} className="text-orange-500" />;
    return <CheckCircle size={18} className="text-emerald-500" />;
  };

  const getSchoolNames = () => {
    if (children.length === 0) return 'MyEduRide';
    const names = Array.from(new Set(children.map((c: any) => c.school?.name).filter(Boolean)));
    if (names.length === 0) return 'MyEduRide';
    if (names.length === 1) return names[0];
    if (names.length === 2) return `${names[0]} & ${names[1]}`;
    return `${names[0]} & others`;
  };

  const totalKidsCount = children.length;
  const presentCount = children.filter((c: any) => c.present_today).length;
  const absentCount = children.filter((c: any) => !c.present_today).length;

  return (
    <div className="min-h-screen flex flex-col">
      <style>{`
        .flip-card-container {
          perspective: 1000px;
          height: 160px;
        }
        .flip-card-inner {
          position: relative;
          width: 100%;
          height: 100%;
          text-align: center;
          transition: transform 0.6s cubic-bezier(0.4, 0, 0.2, 1);
          transform-style: preserve-3d;
        }
        .flip-card-flipped {
          transform: rotateY(180deg);
        }
        .flip-card-front, .flip-card-back {
          position: absolute;
          width: 100%;
          height: 100%;
          -webkit-backface-visibility: hidden;
          backface-visibility: hidden;
          border-radius: 1rem;
          overflow: hidden;
        }
        .flip-card-back {
          transform: rotateY(180deg);
        }
      `}</style>

      {/* Slim header — no role switcher overlap */}
      <header className="bg-white border-b border-gray-100 px-4 pt-12 pb-3 safe-top">
        <div className="max-w-lg mx-auto flex items-center justify-between gap-2 pr-28">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold text-primary-600 uppercase tracking-wide truncate">
              {getSchoolNames()}
            </p>
            <h1 className="text-base font-bold text-gray-900 truncate">
              Hi, {userName || 'Parent'}
            </h1>
          </div>
          <button
            type="button"
            onClick={logout}
            className="p-2.5 rounded-full bg-gray-50 text-gray-500 hover:bg-red-50 hover:text-red-600 shrink-0"
            aria-label="Sign out"
            title="Sign out"
          >
            <LogOut size={18} />
          </button>
        </div>
      </header>

      {/* Content — room for bottom nav */}
      <main className="flex-1 overflow-y-auto px-4 py-4 pb-28 max-w-lg mx-auto w-full">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : tab === 'pickup' ? (
          children.length === 0 ? (
            <div className="bg-white rounded-2xl p-10 text-center shadow-sm border border-gray-100">
              <Car size={36} className="mx-auto text-gray-300 mb-3" />
              <p className="font-medium text-gray-700">Link a child first</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                <PickupPersonsManager
                  mode="parent"
                  students={children}
                  schoolId={children[0]?.school_id}
                />
              </div>
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                <h2 className="font-semibold text-gray-900 mb-1">Different person today?</h2>
                <p className="text-xs text-gray-500 mb-4 leading-relaxed">
                  If someone not on your authorised list will pick up today, notify the school and gate below.
                </p>
                <label className="text-xs font-medium text-gray-500 block mb-1">Child</label>
                <select
                  className="input mb-3"
                  value={pickupForm.student_id}
                  onChange={(e) => setPickupForm((f) => ({ ...f, student_id: e.target.value }))}
                >
                  {children.map((c) => (
                    <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>
                  ))}
                </select>
                <label className="flex items-center gap-2 mb-3 text-sm">
                  <input
                    type="checkbox"
                    checked={pickupForm.is_self}
                    onChange={(e) =>
                      setPickupForm((f) => ({
                        ...f,
                        is_self: e.target.checked,
                        pickup_person_name: e.target.checked ? (userName || '') : '',
                        relationship: e.target.checked ? 'parent (self)' : '',
                      }))
                    }
                  />
                  I am picking up myself
                </label>
                {!pickupForm.is_self && (
                  <>
                    <label className="text-xs font-medium text-gray-500 block mb-1">Pickup person name *</label>
                    <input
                      className="input mb-3"
                      value={pickupForm.pickup_person_name}
                      onChange={(e) => setPickupForm((f) => ({ ...f, pickup_person_name: e.target.value }))}
                      placeholder="Full name of person picking up"
                    />
                    <label className="text-xs font-medium text-gray-500 block mb-1">Their phone</label>
                    <input
                      className="input mb-3"
                      value={pickupForm.pickup_person_phone}
                      onChange={(e) => setPickupForm((f) => ({ ...f, pickup_person_phone: e.target.value }))}
                      placeholder="Phone number"
                    />
                    <label className="text-xs font-medium text-gray-500 block mb-1">Relationship</label>
                    <input
                      className="input mb-3"
                      value={pickupForm.relationship}
                      onChange={(e) => setPickupForm((f) => ({ ...f, relationship: e.target.value }))}
                      placeholder="e.g. Aunt, Driver, Family friend"
                    />
                  </>
                )}
                {pickupForm.is_self && (
                  <>
                    <label className="text-xs font-medium text-gray-500 block mb-1">Your name</label>
                    <input
                      className="input mb-3"
                      value={pickupForm.pickup_person_name}
                      onChange={(e) => setPickupForm((f) => ({ ...f, pickup_person_name: e.target.value }))}
                    />
                  </>
                )}
                <label className="text-xs font-medium text-gray-500 block mb-1">Note to school (optional)</label>
                <textarea
                  className="input mb-4 min-h-[80px]"
                  value={pickupForm.notes}
                  onChange={(e) => setPickupForm((f) => ({ ...f, notes: e.target.value }))}
                  placeholder="e.g. Black Toyota, ID at reception…"
                />
                <button
                  type="button"
                  onClick={submitNotifySchool}
                  disabled={submittingPickup}
                  className="btn-primary w-full flex items-center justify-center gap-2 py-3"
                >
                  <Send size={18} />
                  {submittingPickup ? 'Sending…' : 'Notify School'}
                </button>
                <p className="text-[10px] text-gray-400 mt-2 text-center">
                  Also alerts gate officers. Message appears under Pickup Requests on admin dashboard.
                </p>
              </div>
              {recentNotices.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-500 px-1 mb-2">Sent today / recently</p>
                  {recentNotices.map((n) => (
                    <div key={n.id} className="bg-white rounded-xl p-3 border border-gray-100 mb-2 text-sm">
                      <p className="font-medium">{n.pickup_person_name}</p>
                      <p className="text-xs text-gray-500">{formatDateTimeLagos(n.created_at)}</p>
                      {n.notes && <p className="text-xs text-gray-600 mt-1">{n.notes}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        ) : tab === 'attendance' ? (
          children.length === 0 ? (
            <div className="bg-white rounded-2xl p-10 text-center shadow-sm border border-gray-100">
              <Calendar size={36} className="mx-auto text-gray-300 mb-3" />
              <p className="font-medium text-gray-700">No children linked</p>
            </div>
          ) : (
            <div className="space-y-4">
              <select className="input" value={selectedChild} onChange={(e) => setSelectedChild(e.target.value)}>
                {children.map((c) => (
                  <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>
                ))}
              </select>
              <div className="pill-tabs">
                {['daily', 'weekly', 'monthly', 'yearly'].map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setHistoryType(t)}
                    className={historyType === t ? 'pill-tab-active' : 'pill-tab-inactive'}
                  >
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </button>
                ))}
              </div>
              {historyType !== 'yearly' ? (
                <input type="date" className="input" value={historyDate} onChange={(e) => setHistoryDate(e.target.value)} />
              ) : (
                <div className="flex gap-2">
                  <input type="number" className="input flex-1" value={historyYear} onChange={(e) => setHistoryYear(e.target.value)} placeholder="Year" />
                  <select className="input flex-1" value={historyTerm} onChange={(e) => setHistoryTerm(e.target.value)}>
                    <option value="">Full year</option>
                    <option value="1">Term 1</option>
                    <option value="2">Term 2</option>
                    <option value="3">Term 3</option>
                  </select>
                </div>
              )}
              {historyLoading && <p className="text-sm text-gray-400 animate-pulse">Loading…</p>}
              {!historyLoading && historyData?.type === 'daily' && (
                <div className="bg-white rounded-2xl p-4 border border-gray-100">
                  <p className="text-xs text-gray-500 mb-2">
                    {children.find((c) => c.id === selectedChild)?.first_name}{' '}
                    {children.find((c) => c.id === selectedChild)?.last_name} · {historyData.date}
                  </p>
                  <p className={`text-lg font-bold ${
                    historyData.status === 'absent' ? 'text-red-600' :
                    historyData.status === 'late' ? 'text-amber-600' :
                    historyData.status === 'upcoming' ? 'text-gray-400' : 'text-emerald-600'
                  }`}>
                    {DAY_STATUS_LABELS[historyData.status] || historyData.status}
                  </p>
                  <p className="text-sm mt-2">Check-in: {formatTimeLagos(historyData.check_in_time)}</p>
                  <p className="text-sm">Check-out: {formatTimeLagos(historyData.check_out_time)}</p>
                  {historyData.minutes_late && (
                    <p className="text-sm text-amber-700">{historyData.minutes_late} minutes late</p>
                  )}
                </div>
              )}
              {!historyLoading && historyData?.calendar && (
                <>
                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="bg-emerald-50 rounded-lg p-2"><p className="font-bold text-emerald-700">{historyData.summary?.present}</p><p>On time</p></div>
                    <div className="bg-amber-50 rounded-lg p-2"><p className="font-bold text-amber-700">{historyData.summary?.late}</p><p>Late</p></div>
                    <div className="bg-red-50 rounded-lg p-2"><p className="font-bold text-red-700">{historyData.summary?.absent}</p><p>Absent</p></div>
                  </div>
                  {historyType === 'monthly' || historyType === 'yearly' ? (
                    <div className="grid grid-cols-7 gap-1">
                      {(historyData.calendar || []).map((d) => (
                        <div
                          key={d.date}
                          title={`${d.date}: ${DAY_STATUS_LABELS[d.status] || d.status}`}
                          className={`aspect-square rounded text-[8px] flex items-center justify-center font-medium ${
                            d.status === 'weekend' || d.status === 'excluded' ? 'bg-gray-100 text-gray-400' :
                            d.color === 'green' ? 'bg-emerald-400 text-white' :
                            d.color === 'yellow' ? 'bg-amber-400 text-white' :
                            d.color === 'red' ? 'bg-red-400 text-white' : 'bg-gray-100 text-gray-400'
                          }`}
                        >
                          {d.status === 'weekend' ? '·' : d.date.split('-')[2]}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {(historyData.calendar || []).filter((d) => !d.is_weekend).map((d) => (
                        <div key={d.date} className="flex justify-between text-sm bg-white rounded-lg px-3 py-2 border border-gray-100">
                          <span>{d.date}</span>
                          <span className={
                            d.status === 'late' ? 'text-amber-600 font-medium' :
                            d.status === 'absent' ? 'text-red-600' :
                            d.status === 'upcoming' ? 'text-gray-400' : 'text-emerald-600'
                          }>
                            {DAY_STATUS_LABELS[d.status] || d.status}
                            {d.status === 'late' && d.minutes_late ? ` (${d.minutes_late}m)` : ''}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )
        ) : tab === 'children' ? (
          children.length === 0 ? (
            <div className="bg-white rounded-2xl p-10 text-center shadow-sm border border-gray-100">
              <Users size={36} className="mx-auto text-gray-300 mb-3" />
              <p className="font-medium text-gray-700">No children linked yet</p>
              <p className="text-sm text-gray-400 mt-2 leading-relaxed">
                Ask your school to register your child using your parent email address.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Stats Summary Grid */}
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-blue-50 border border-blue-100 rounded-2xl p-3 text-center shadow-xs">
                  <span className="text-[10px] font-bold text-blue-500 uppercase tracking-wider block">Kids</span>
                  <span className="text-xl font-extrabold text-blue-800 block mt-0.5">{totalKidsCount}</span>
                </div>
                <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-3 text-center shadow-xs">
                  <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider block">Present</span>
                  <span className="text-xl font-extrabold text-emerald-800 block mt-0.5">{presentCount}</span>
                </div>
                <div className="bg-red-50 border border-red-100 rounded-2xl p-3 text-center shadow-xs">
                  <span className="text-[10px] font-bold text-red-500 uppercase tracking-wider block">Absent</span>
                  <span className="text-xl font-extrabold text-red-800 block mt-0.5">{absentCount}</span>
                </div>
              </div>

              {/* Flip Advertisement Banner */}
              <div className="flip-card-container w-full cursor-pointer relative" onClick={() => setIsFlipped(!isFlipped)}>
                <div className={`flip-card-inner w-full h-full ${isFlipped ? 'flip-card-flipped' : ''}`}>
                  {/* Front Side */}
                  <div className={`flip-card-front bg-gradient-to-br ${ADVERT_SERVICES[activeAdIndex].gradient} text-white p-4 flex flex-col justify-between text-left shadow-md`}>
                    <div className="flex justify-between items-start">
                      <span className="text-3xl">{ADVERT_SERVICES[activeAdIndex].icon}</span>
                      <span className="text-[9px] font-extrabold bg-white/20 px-2 py-0.5 rounded-full uppercase tracking-wider">EduRide Service</span>
                    </div>
                    <div>
                      <h3 className="text-base font-bold leading-tight">{ADVERT_SERVICES[activeAdIndex].title}</h3>
                      <p className="text-[10px] text-white/80 mt-1">Tap to flip & learn more</p>
                    </div>
                  </div>

                  {/* Back Side */}
                  <div className="flip-card-back bg-slate-900 border border-slate-800 text-white p-4 flex flex-col justify-between text-left shadow-md">
                    <div>
                      <span className="text-[9px] font-bold text-primary-400 uppercase tracking-wide block">Description</span>
                      <p className="text-xs text-slate-300 mt-2 leading-normal">{ADVERT_SERVICES[activeAdIndex].desc}</p>
                    </div>
                    <div className="flex justify-between items-center text-[10px] text-slate-400 border-t border-slate-800 pt-2">
                      <span>MyEduRide Protection</span>
                      <span>Safe & Secure</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-xs font-bold text-gray-500 px-1 uppercase tracking-wider">Your children</p>
                {children.map((child) => (
                  <article
                    key={child.id}
                    className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 relative overflow-hidden"
                  >
                    <div className="flex gap-4">
                      <StudentAvatar
                        photoUrl={child.photo_url}
                        firstName={child.first_name}
                        lastName={child.last_name}
                        size="lg"
                        accentColor={child.school?.primary_color || '#1B4D3E'}
                      />
                      <div className="flex-1 min-w-0 pt-0.5">
                        <h2 className="text-lg font-bold text-gray-900 leading-tight">
                          {child.first_name} {child.last_name}
                        </h2>
                        <p className="text-sm text-gray-500 mt-0.5">{child.school?.name}</p>
                        <p className="text-sm text-gray-500">{child.class?.name || 'Class not set'}</p>
                        
                        <div className="mt-3 flex flex-wrap gap-2 items-center">
                          <div className="inline-flex items-center gap-1.5 bg-gray-50 border border-gray-100 rounded-lg px-2.5 py-1">
                            <span className="text-[10px] font-semibold text-gray-400 uppercase">ID</span>
                            <span className="text-xs font-mono font-medium text-gray-800">
                              {child.student_id_number}
                            </span>
                          </div>
                          
                          {/* Live Attendance Badge */}
                          {child.present_today ? (
                            <span className="inline-flex items-center bg-emerald-50 text-emerald-700 text-[10px] font-bold px-2.5 py-1 rounded-lg border border-emerald-200">
                              🟢 Present Today {child.arrival_time ? `(${formatTimeLagos(child.arrival_time)})` : ''}
                            </span>
                          ) : (
                            <span className="inline-flex items-center bg-rose-50 text-rose-700 text-[10px] font-bold px-2.5 py-1 rounded-lg border border-rose-200">
                              🔴 Absent Today
                            </span>
                          )}
                        </div>

                        <p className="text-[10px] text-gray-400 mt-2.5 capitalize font-medium">
                          Role: {child.relationship || 'Parent'}
                        </p>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          )
        ) : tab === 'messages' ? (
          children.length === 0 ? (
            <div className="bg-white rounded-2xl p-10 text-center shadow-sm border border-gray-100">
              <MessageSquare size={36} className="mx-auto text-gray-300 mb-3" />
              <p className="font-medium text-gray-700">Link a child first</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                <h2 className="font-bold text-gray-900 text-base mb-1">EduChart – Secure School & Teacher Chat</h2>
                <p className="text-xs text-gray-500 mb-4 leading-relaxed">
                  Chat directly and securely with your child's class teacher or the school administration office via EduChart. Phone numbers are hidden for your privacy.
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 block mb-1 uppercase tracking-wide">Select Child</label>
                    <select
                      className="input min-h-[42px]"
                      value={messageForm.student_id || (children[0]?.id || '')}
                      onChange={(e) => setMessageForm((f) => ({ ...f, student_id: e.target.value }))}
                    >
                      {children.map((c) => (
                        <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 block mb-1 uppercase tracking-wide">Chat Channel</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setMessageForm((f) => ({ ...f, recipient_type: 'teacher' }))}
                        className={`py-2.5 px-3 text-xs font-semibold rounded-xl border transition-all ${
                          messageForm.recipient_type === 'teacher'
                            ? 'bg-primary-50 border-primary-500 text-primary-700 shadow-xs'
                            : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
                        }`}
                      >
                        🏫 Class Teacher
                      </button>
                      <button
                        type="button"
                        onClick={() => setMessageForm((f) => ({ ...f, recipient_type: 'school' }))}
                        className={`py-2.5 px-3 text-xs font-semibold rounded-xl border transition-all ${
                          messageForm.recipient_type === 'school'
                            ? 'bg-primary-50 border-primary-500 text-primary-700 shadow-xs'
                            : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
                        }`}
                      >
                        🏢 School Office
                      </button>
                    </div>
                  </div>
                </div>

                {/* Conversation Box */}
                <div className="border border-gray-100 rounded-2xl bg-slate-50 p-4 mb-4 min-h-[280px] max-h-[380px] overflow-y-auto flex flex-col gap-3">
                  {(() => {
                    const activeChildId = messageForm.student_id || (children[0]?.id || '');
                    const activeChild = children.find((c) => c.id === activeChildId);
                    const activeChildName = activeChild ? `${activeChild.first_name} ${activeChild.last_name}` : '';
                    
                    const filteredChat = chatHistory.filter((m: any) => {
                      if (messageForm.recipient_type === 'teacher') {
                        return m.title.includes('Teacher') || m.title === `Parent Message: ${activeChildName}`;
                      } else {
                        return m.title.includes('School') || m.title.includes('Admin');
                      }
                    });

                    if (filteredChat.length === 0) {
                      return (
                        <div className="my-auto text-center py-8">
                          <MessageSquare size={32} className="mx-auto text-gray-300 mb-2" />
                          <p className="text-xs text-gray-400 font-medium">No EduChart messages yet</p>
                          <p className="text-[10px] text-gray-400 mt-1 max-w-[200px] mx-auto">
                            Send a secure message using the box below to start the conversation.
                          </p>
                        </div>
                      );
                    }

                    return filteredChat.map((m: any) => {
                      const isOutbound = m.sender_id === session?.user_id || m.title?.includes('Parent to') || m.title?.startsWith('Parent Message:');
                      const avatarSrc = isOutbound
                        ? (session?.avatar_url ? photoSrc(session.avatar_url) : null)
                        : (m.sender_avatar ? photoSrc(m.sender_avatar) : null);
                      const senderInitial = (isOutbound
                        ? (session?.full_name?.[0] || 'P')
                        : (m.sender_name?.[0] || 'S')
                      ).toUpperCase();

                      return (
                        <div
                          key={m.id}
                          className={`flex items-start gap-2 max-w-[90%] ${isOutbound ? 'ml-auto flex-row-reverse' : 'mr-auto'}`}
                        >
                          <div className="shrink-0 mt-1">
                            {avatarSrc ? (
                              <img
                                src={avatarSrc}
                                alt="avatar"
                                className="w-8 h-8 rounded-full object-cover border border-slate-200 shadow-sm"
                              />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-xs font-bold border border-slate-300">
                                {senderInitial}
                              </div>
                            )}
                          </div>

                          <div
                            className={`flex flex-col rounded-2xl p-3 shadow-xs ${
                              isOutbound
                                ? 'bg-primary-600 text-white rounded-tr-none'
                                : 'bg-white text-gray-800 border border-gray-100 rounded-tl-none'
                            }`}
                          >
                            {!isOutbound && (
                              <span className="text-[9px] font-bold text-primary-700 uppercase mb-1">
                                {m.sender_name}
                              </span>
                            )}
                            <ChatMediaBubble mediaUrl={m.media_url} mediaType={m.media_type} photoSrc={photoSrc} />
                            <p className="text-xs leading-relaxed whitespace-pre-line break-words">{m.message}</p>
                            <span className={`text-[8px] mt-1 text-right block ${isOutbound ? 'text-white/70' : 'text-gray-400'}`}>
                              {formatDateTimeLagos(m.created_at)}
                            </span>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>

                {/* Message Input Box */}
                <div>
                  {selectedFile && (
                    <ChatAttachmentPreview
                      file={selectedFile}
                      onCancel={() => {
                        setSelectedFile(null);
                        if (fileInputRef.current) fileInputRef.current.value = '';
                      }}
                    />
                  )}
                  {attachPhoto && (
                    <div className="flex items-center gap-3 bg-slate-100 border border-slate-200 p-2 rounded-xl mb-2 relative">
                      <div className="relative w-12 h-12 shrink-0 rounded-lg overflow-hidden border border-slate-300 bg-white">
                        <img
                          src={
                            session?.avatar_url
                              ? photoSrc(session.avatar_url)
                              : 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" fill="none"><rect width="100%" height="100%" rx="12" fill="%23E8F5E9"/><circle cx="200" cy="110" r="50" fill="%231B4D3E"/><path d="M130,210 C130,170 170,160 200,160 C230,160 270,170 270,210" fill="%231B4D3E"/><text x="200" y="240" font-family="sans-serif" font-size="16" font-weight="bold" fill="%231B4D3E" text-anchor="middle">MyEduRide User</text><text x="200" y="265" font-family="sans-serif" font-size="12" fill="%234CAF50" font-weight="bold" text-anchor="middle">Click to set your photo in Settings</text></svg>'
                          }
                          alt="Attachment preview"
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => setAttachPhoto(false)}
                          className="absolute top-0 right-0 p-0.5 bg-black/60 hover:bg-black/80 text-white rounded-bl"
                          title="Remove attachment"
                        >
                          <X size={10} />
                        </button>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-bold text-slate-700">Profile Photo Attached</p>
                        <p className="text-[9px] text-slate-400">
                          {session?.avatar_url ? 'Your uploaded profile picture' : 'Default profile card (set photo in settings!)'}
                        </p>
                      </div>
                    </div>
                  )}
                  <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept="image/jpeg,image/png,image/webp,application/pdf,audio/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setSelectedFile(file);
                      }
                    }}
                  />
                  <div className="flex gap-2 items-end">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="p-3 h-[50px] w-[50px] flex items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-all shrink-0"
                      title="Attach File (Image/PDF)"
                    >
                      <Paperclip size={18} />
                    </button>
                    
                    <div className="shrink-0 mb-1">
                      <VoiceRecordButton
                        onRecordComplete={(blob) => {
                          const file = new File([blob], `voice-note-${Date.now()}.webm`, { type: blob.type });
                          setSelectedFile(file);
                        }}
                        onRecordingStateChange={setIsRecordingVoice}
                      />
                    </div>

                    <textarea
                      rows={2}
                      className="input py-2.5 px-3.5 text-xs flex-1 min-h-[50px] resize-none"
                      value={messageForm.message_text}
                      onChange={(e) => setMessageForm((f) => ({ ...f, message_text: e.target.value }))}
                      placeholder={
                        isRecordingVoice 
                          ? "Recording voice note..."
                          : messageForm.recipient_type === 'teacher'
                            ? "Write a message to the class teacher..."
                            : "Write a message to the school office..."
                      }
                      disabled={isRecordingVoice}
                      maxLength={500}
                    />
                    <button
                      type="button"
                      onClick={handleSendMessage}
                      disabled={sendingMessage || uploadingFile || (!messageForm.message_text.trim() && !selectedFile)}
                      className="btn-primary px-4 h-[50px] flex items-center justify-center rounded-xl shrink-0"
                      aria-label="Send message"
                    >
                      <Send size={16} />
                    </button>
                  </div>
                  <div className="flex justify-between items-center text-[9px] text-gray-400 mt-1 px-1">
                    <span>Max 500 characters</span>
                    <span>{messageForm.message_text.length}/500</span>
                  </div>
                </div>
              </div>
            </div>
          )
        ) : tab === 'notifications' ? (
          notifications.length === 0 ? (
            <div className="bg-white rounded-2xl p-10 text-center shadow-sm border border-gray-100">
              <Bell size={36} className="mx-auto text-gray-300 mb-3" />
              <p className="font-medium text-gray-700">No notifications yet</p>
              <p className="text-sm text-gray-400 mt-2">
                When your child arrives or leaves school, alerts will appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs font-medium text-gray-500 px-1">
                {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
              </p>
              {notifications.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => !n.is_read && markRead(n.id)}
                  className={`w-full text-left bg-white rounded-2xl p-4 border transition-colors ${
                    !n.is_read ? 'border-primary-200 shadow-sm' : 'border-gray-100 opacity-90'
                  }`}
                >
                  <div className="flex gap-3 items-start">
                    <div className="mt-0.5 shrink-0">{notifIcon(n.type)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-semibold text-sm text-gray-900">{n.title}</p>
                        {!n.is_read && (
                          <span className="text-[10px] font-bold text-primary-600 bg-primary-50 px-1.5 py-0.5 rounded shrink-0">
                            NEW
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 mt-1 leading-snug">{n.message}</p>
                      {n.student && (
                        <p className="text-xs text-gray-400 mt-1.5">
                          {n.student.first_name} {n.student.last_name}
                        </p>
                      )}
                      <p className="text-[11px] text-gray-400 mt-2">
                        {formatDateTimeLagos(n.created_at)}
                      </p>
                    </div>
                    <ChevronRight size={16} className="text-gray-300 shrink-0 mt-1" />
                  </div>
                </button>
              ))}
            </div>
          )
        ) : null}
      </main>

      {/* Bottom navigation — mobile friendly, not clustered at top */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 safe-bottom z-20">
        <div className="max-w-lg mx-auto flex">
          <button
            type="button"
            onClick={() => setTab('children')}
            className={`flex-1 flex flex-col items-center gap-1 py-3 text-xs font-medium transition-colors ${
              tab === 'children' ? 'text-primary-700' : 'text-gray-400'
            }`}
          >
            <Users size={22} strokeWidth={tab === 'children' ? 2.5 : 2} />
            <span>My Kids</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('attendance')}
            className={`flex-1 flex flex-col items-center gap-1 py-3 text-xs font-medium transition-colors ${
              tab === 'attendance' ? 'text-primary-700' : 'text-gray-400'
            }`}
          >
            <Calendar size={22} strokeWidth={tab === 'attendance' ? 2.5 : 2} />
            <span>History</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('pickup')}
            className={`flex-1 flex flex-col items-center gap-1 py-3 text-xs font-medium transition-colors ${
              tab === 'pickup' ? 'text-primary-700' : 'text-gray-400'
            }`}
          >
            <Car size={22} strokeWidth={tab === 'pickup' ? 2.5 : 2} />
            <span>Pickup</span>
          </button>
          {/* EduChart Tab */}
          <button
            type="button"
            onClick={() => {
              setTab('messages');
              fetchUnreadChatTotal();
            }}
            className={`flex-1 flex flex-col items-center gap-1 py-3 text-xs font-medium transition-colors relative ${
              tab === 'messages' ? 'text-primary-700' : 'text-gray-400'
            }`}
          >
            <MessageSquare size={22} strokeWidth={tab === 'messages' ? 2.5 : 2} />
            <span>EduChart</span>
            {unreadEduChartCount > 0 && (
              <span className="absolute top-2 right-1/4 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 animate-pulse">
                {unreadEduChartCount > 9 ? '9+' : unreadEduChartCount}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setTab('notifications')}
            className={`flex-1 flex flex-col items-center gap-1 py-3 text-xs font-medium transition-colors relative ${
              tab === 'notifications' ? 'text-primary-700' : 'text-gray-400'
            }`}
          >
            <Bell size={22} strokeWidth={tab === 'notifications' ? 2.5 : 2} />
            <span>Alerts</span>
            {unreadCount > 0 && (
              <span className="absolute top-2 right-1/4 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
        </div>
      </nav>
    </div>
  );
}
