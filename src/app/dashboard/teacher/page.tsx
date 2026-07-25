// @ts-nocheck
'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { fetchData, getSession } from '@/lib/api';
import StudentAvatar from '@/components/shared/StudentAvatar';
import { createClient } from '@/lib/supabase/client';
import { PageHeader } from '@/components/ui/PageHeader';
import {
  Users, UserCheck, AlertTriangle, GraduationCap, Clock, Download,
  BookOpen, Car, CheckCircle2, ScanLine, Search, MessageSquare, Send, ChevronLeft,
  Image, X, Paperclip
} from 'lucide-react';
import TeacherScanModal from '@/components/teacher/TeacherScanModal';
import Link from 'next/link';
import { ATTENDANCE_UI_NOTE } from '@/lib/attendance/window';
import { formatTimeLagos, formatDateTimeLagos } from '@/lib/timezone';
import { toast } from 'sonner';
import { photoSrc } from '@/lib/photo';
import { useFileUpload } from '@/hooks/useFileUpload';
import { ChatAttachmentPreview } from '@/components/chat/ChatAttachmentPreview';
import { ChatMediaBubble } from '@/components/chat/ChatMediaBubble';
import { VoiceRecordButton } from '@/components/chat/VoiceRecordButton';

export default function TeacherDashboard() {
  const [students, setStudents] = useState([]);
  const [stats, setStats] = useState({ present: 0, absent: 0, late: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [schoolId, setSchoolId] = useState('');
  const [schoolName, setSchoolName] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [dismissAllBusy, setDismissAllBusy] = useState(false);
  const [showScan, setShowScan] = useState(false);
  const [readySearch, setReadySearch] = useState('');

  // Messaging / Chat States
  const [activeTab, setActiveTab] = useState('class'); // 'class' | 'messages'
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [chatHistory, setChatHistory] = useState([]);
  const [chatText, setChatText] = useState('');
  const [attachPhoto, setAttachPhoto] = useState(false);
  const [sendingChat, setSendingChat] = useState(false);
  const [mobileShowThread, setMobileShowThread] = useState(false);
  const [chatSearch, setChatSearch] = useState('');

  // Phase 2 states
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { uploadFile, uploading: uploadingFile } = useFileUpload();
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [recipientType, setRecipientType] = useState('parent'); // 'parent' | 'teacher' | 'school'

  const loadChatHistory = async (studentId) => {
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

  // Listen for real-time chat messages
  useEffect(() => {
    if (!schoolId) return;

    const session = getSession();
    if (!session?.user_id) return;

    const supabase = createClient();

    // Subscribe to all chat message inserts in this school (RLS ensures only permitted rows are received)
    const channel = supabase
      .channel(`teacher-school-chat:${schoolId}`)
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

          // Format new message (mapping content to message for UI compatibility)
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

          // If message belongs to the currently active chat thread
          if (selectedStudent?.id && newMsg.student_id === selectedStudent.id) {
            setChatHistory((prev) => {
              if (prev.some((m) => m.id === formatted.id)) return prev;
              return [...prev, formatted];
            });

            // Mark as read
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
            // Update unread count for other students in the list
            setStudents((prev) =>
              prev.map((s) => {
                if (s.id === newMsg.student_id) {
                  const isIncoming = newMsg.sender_id !== session.user_id;
                  const isVisible = newMsg.recipient_type === 'parent' || newMsg.recipient_type === 'teacher';
                  if (isIncoming && isVisible) {
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

  // Load chat history when selectedStudent changes
  useEffect(() => {
    if (activeTab === 'messages' && selectedStudent?.id) {
      loadChatHistory(selectedStudent.id);
    }
  }, [selectedStudent, activeTab]);

  const handleSendChat = async () => {
    if (!selectedStudent?.id) return;
    if (!chatText.trim() && !selectedFile) return;
    setSendingChat(true);
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
            student_id: selectedStudent.id,
            recipient_type: recipientType,
            message_text: chatText,
            attach_profile_photo: attachPhoto,
            media_url: mediaUrl,
            media_type: mediaType,
          },
        }),
      });
      const data = await res.json();
      if (res.ok && !data.error) {
        setChatText('');
        setAttachPhoto(false);
        setSelectedFile(null);
        await loadChatHistory(selectedStudent.id);
      } else {
        toast.error(data.error || 'Failed to send message');
      }
    } catch (e: any) {
      toast.error(e?.message || 'Failed to send message');
    }
    setSendingChat(false);
  };

  const [session, setSession] = useState(null);

  useEffect(() => {
    setSession(getSession());
    loadClass();
    const interval = setInterval(loadClass, 60000);
    return () => clearInterval(interval);
  }, []);

  const loadClass = async () => {
    try {
      const data = await fetchData('get_teacher_dashboard_full');
      setSchoolId(data.school_id || '');
      setSchoolName(data.school?.name || '');
      setStudents(data.students || []);
      setStats({
        present: data.present_count || 0,
        absent: data.absent_count || 0,
        late: data.late_count || 0,
        total: (data.students || []).length,
      });
    } catch (err) {
      console.error(err);
      toast.error('Could not load class');
    }
    setLoading(false);
  };

  const activeStudents = useMemo(
    () => students.filter((s) => !s.ready_for_pickup && !s.in_extra_lesson),
    [students]
  );
  const readyStudents = useMemo(() => students.filter((s) => s.ready_for_pickup), [students]);
  const extraStudents = useMemo(() => students.filter((s) => s.in_extra_lesson), [students]);

  const filteredReadyStudents = useMemo(() => {
    const q = readySearch.trim().toLowerCase();
    if (!q) return readyStudents;
    return readyStudents.filter((s) =>
      `${s.first_name} ${s.last_name} ${s.student_id_number || ''}`.toLowerCase().includes(q)
    );
  }, [readyStudents, readySearch]);

  const markReady = async (studentId, studentName) => {
    setBusyId(studentId);
    try {
      if (!schoolId) {
        toast.error('School not loaded — refresh the page');
        return;
      }
      const res = await fetch('/api/teacher/ready-for-pickup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ student_id: studentId, school_id: schoolId }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Already marked ready today');
        await loadClass();
        return;
      }
      toast.success(`${studentName} — ready for pickup`);
      await loadClass();
    } catch {
      toast.error('Failed to mark ready');
    }
    setBusyId(null);
  };

  const markExtraLesson = async (studentId, studentName) => {
    setBusyId(studentId);
    try {
      const res = await fetch('/api/teacher/extra-lesson', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ student_id: studentId, school_id: schoolId, action: 'add' }),
      });
      if (!res.ok) throw new Error();
      toast.success(`${studentName} — extra lesson`);
      await loadClass();
    } catch {
      toast.error('Failed');
    }
    setBusyId(null);
  };

  const releaseExtraLesson = async (studentId, studentName) => {
    setBusyId(studentId);
    try {
      await fetch('/api/teacher/extra-lesson', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ student_id: studentId, school_id: schoolId, action: 'release' }),
      });
      toast.success(`${studentName} — extra lesson ended`);
      await loadClass();
    } catch {
      toast.error('Failed');
    }
    setBusyId(null);
  };

  const dismissAllReady = async () => {
    const eligible = activeStudents.filter((s) => s.present);
    if (eligible.length === 0) {
      toast.error('No present students to mark ready (extra lesson students are skipped)');
      return;
    }
    if (!confirm(`Mark ${eligible.length} present student(s) ready for pickup?`)) return;
    setDismissAllBusy(true);
    let ok = 0;
    for (const s of eligible) {
      try {
        const res = await fetch('/api/teacher/ready-for-pickup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ student_id: s.id, school_id: schoolId }),
        });
        if (res.ok) ok++;
      } catch { /* skip */ }
    }
    toast.success(`${ok} student(s) marked ready for pickup`);
    await loadClass();
    setDismissAllBusy(false);
  };

  const renderRow = (s, actions) => (
    <div key={s.id} className="list-row">
      <StudentAvatar photoUrl={s.photo_url} firstName={s.first_name} lastName={s.last_name} size="sm" />
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-slate-900 truncate">{s.first_name} {s.last_name}</p>
        <p className="text-xs text-slate-500">{s.class?.name || 'No class'}</p>
        {s.present && (
          <p className="text-[10px] text-emerald-600 mt-0.5 flex items-center gap-1">
            <Clock size={10} />
            {s.late ? `Late · ${formatTimeLagos(s.arrival_time)}` : `Present · ${formatTimeLagos(s.arrival_time)}`}
          </p>
        )}
      </div>
      <span
        className={`text-[10px] font-bold uppercase px-2 py-1 rounded-lg shrink-0 ${
          s.present ? (s.late ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800') : 'bg-red-50 text-red-600'
        }`}
      >
        {s.present ? (s.late ? 'Late' : 'In') : 'Out'}
      </span>
      {actions}
    </div>
  );

  if (loading) {
    return (
      <div className="page-shell flex items-center justify-center min-h-[60vh]">
        <div className="animate-pulse text-primary-600 font-medium">Loading class...</div>
      </div>
    );
  }

  return (
    <div className="page-shell">
      <div className="hero-banner">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-white/15 flex items-center justify-center">
            <GraduationCap size={24} />
          </div>
          <div>
            <p className="text-white/70 text-xs font-medium uppercase tracking-wide">Teacher</p>
            <h1 className="text-xl font-bold">{schoolName || 'My class'}</h1>
            <p className="text-white/80 text-sm">{stats.total} students · {readyStudents.length} ready for pickup</p>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-gray-100 mb-4 bg-white p-1 rounded-xl shadow-xs">
        <button
          type="button"
          onClick={() => setActiveTab('class')}
          className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${
            activeTab === 'class'
              ? 'bg-primary-50 text-primary-700 shadow-2xs'
              : 'text-gray-500 hover:text-gray-800'
          }`}
        >
          <GraduationCap size={16} />
          Class List
        </button>
        <button
          type="button"
          onClick={() => {
            setActiveTab('messages');
            // Auto-select first student if none selected
            if (!selectedStudent && students.length > 0) {
              setSelectedStudent(students[0]);
            }
          }}
          className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${
            activeTab === 'messages'
              ? 'bg-primary-50 text-primary-700 shadow-2xs'
              : 'text-gray-500 hover:text-gray-800'
          }`}
        >
          <MessageSquare size={16} />
          <span>EduChart</span>
          {students.reduce((acc, s) => acc + (s.unread_count || 0), 0) > 0 && (
            <span className="min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 animate-pulse">
              {students.reduce((acc, s) => acc + (s.unread_count || 0), 0) > 9
                ? '9+'
                : students.reduce((acc, s) => acc + (s.unread_count || 0), 0)}
            </span>
          )}
        </button>
      </div>

      {activeTab === 'class' ? (
        <>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="dash-stat">
              <div><p className="text-[11px] font-medium text-slate-500 uppercase">Total</p><p className="text-2xl font-bold">{stats.total}</p></div>
              <Users size={20} className="text-primary-600" />
            </div>
            <div className="dash-stat">
              <div><p className="text-[11px] font-medium text-slate-500 uppercase">Present</p><p className="text-2xl font-bold text-emerald-600">{stats.present}</p></div>
              <UserCheck size={20} className="text-emerald-500" />
            </div>
            <div className="dash-stat">
              <div><p className="text-[11px] font-medium text-slate-500 uppercase">Absent</p><p className="text-2xl font-bold text-red-500">{stats.absent}</p></div>
              <AlertTriangle size={20} className="text-red-400" />
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mb-4">
            <button
              type="button"
              onClick={dismissAllReady}
              disabled={dismissAllBusy}
              className="btn-primary text-sm flex items-center gap-2"
            >
              <Car size={16} />
              {dismissAllBusy ? 'Marking…' : 'Dismiss all (ready only)'}
            </button>
            <button
              type="button"
              onClick={() => setShowScan(true)}
              className="btn-secondary text-sm flex items-center gap-2"
            >
              <ScanLine size={16} /> Scan ID (mark present)
            </button>
            <Link href="/dashboard/teacher/reports" className="btn-secondary text-sm flex items-center gap-2">
              <Download size={16} /> Reports
            </Link>
          </div>

          {showScan && (
            <TeacherScanModal
              schoolId={schoolId}
              onClose={() => setShowScan(false)}
              onSuccess={loadClass}
            />
          )}

          <PageHeader title="Active students" subtitle="Gate marks present — you mark Ready for Pickup or Extra Lesson (once per day)" />
          <p className="text-xs text-slate-500 mb-3">{ATTENDANCE_UI_NOTE}</p>

          <div className="card-elevated divide-y divide-slate-100 mb-6">
            {activeStudents.map((s) =>
              renderRow(s, (
                <div className="flex flex-col gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => markReady(s.id, `${s.first_name} ${s.last_name}`)}
                    disabled={busyId === s.id}
                    className="text-xs px-3 py-2 rounded-xl bg-orange-500 text-white font-semibold disabled:opacity-50"
                  >
                    {busyId === s.id ? '…' : 'Ready for Pickup'}
                  </button>
                  <button
                    type="button"
                    onClick={() => markExtraLesson(s.id, `${s.first_name} ${s.last_name}`)}
                    disabled={busyId === s.id}
                    className="text-[10px] px-2 py-1.5 rounded-lg border border-violet-200 text-violet-700 font-semibold flex items-center gap-1"
                  >
                    <BookOpen size={10} /> Extra lesson
                  </button>
                </div>
              ))
            )}
            {activeStudents.length === 0 && (
              <p className="py-8 text-center text-slate-400 text-sm">No active students — all ready or in extra lesson</p>
            )}
          </div>

          {extraStudents.length > 0 && (
            <>
              <PageHeader title="Extra lesson" subtitle="Not ready for pickup until you release them" />
              <div className="card-elevated divide-y mb-6">
                {extraStudents.map((s) =>
                  renderRow(s, (
                    <button
                      type="button"
                      onClick={() => releaseExtraLesson(s.id, `${s.first_name} ${s.last_name}`)}
                      disabled={busyId === s.id}
                      className="text-xs px-3 py-2 rounded-xl bg-violet-600 text-white font-semibold shrink-0"
                    >
                      End extra lesson
                    </button>
                  ))
                )}
              </div>
            </>
          )}

          {readyStudents.length > 0 && (
            <>
              <PageHeader title="Ready for pickup" subtitle="Sent to gate — cannot mark again today" />
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                  type="search"
                  value={readySearch}
                  onChange={(e) => setReadySearch(e.target.value)}
                  placeholder="Search ready students…"
                  className="input pl-9 min-h-[44px]"
                />
              </div>
              <div className="card-elevated divide-y">
                {filteredReadyStudents.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-6">No matches for your search</p>
                ) : (
                  filteredReadyStudents.map((s) =>
                    renderRow(s, (
                      <span className="text-xs text-emerald-700 font-semibold flex items-center gap-1 shrink-0">
                        <CheckCircle2 size={14} /> Ready
                      </span>
                    ))
                  )
                )}
              </div>
            </>
          )}
        </>
      ) : (
        /* Messages tab: Side-by-side WhatsApp-style chat interface */
        <div className="flex bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden min-h-[500px] max-h-[70vh]">
          {/* Left panel: student/parent thread list */}
          <div className={`w-full md:w-80 border-r border-gray-100 flex flex-col ${mobileShowThread ? 'hidden md:flex' : 'flex'}`}>
            <div className="p-4 border-b border-gray-100 bg-slate-50/50">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                  type="search"
                  value={chatSearch}
                  onChange={(e) => setChatSearch(e.target.value)}
                  placeholder="Search students/parents…"
                  className="input pl-9 min-h-[40px] text-xs"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
              {(() => {
                const query = chatSearch.trim().toLowerCase();
                const filteredList = students.filter((s: any) => {
                  const studentName = `${s.first_name} ${s.last_name}`.toLowerCase();
                  const parentNames = (s.parents || []).map((p: any) => p.full_name.toLowerCase()).join(' ');
                  return studentName.includes(query) || parentNames.includes(query);
                });

                if (filteredList.length === 0) {
                  return <p className="text-xs text-slate-400 text-center py-8">No matching students found</p>;
                }

                return filteredList.map((s: any) => {
                  const isSelected = selectedStudent?.id === s.id;
                  const parentNames = (s.parents || []).map((p: any) => p.full_name).join(', ') || 'No linked parent';
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => {
                        setSelectedStudent(s);
                        setMobileShowThread(true);
                      }}
                      className={`w-full text-left p-3.5 flex items-center gap-3 transition-all ${
                        isSelected ? 'bg-primary-50/50 border-l-4 border-primary-500' : 'hover:bg-gray-50/50'
                      }`}
                    >
                      <StudentAvatar photoUrl={s.photo_url} firstName={s.first_name} lastName={s.last_name} size="sm" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <p className="text-xs font-bold text-slate-900 truncate">{s.first_name} {s.last_name}</p>
                          {s.unread_count > 0 && (
                            <span className="shrink-0 bg-emerald-500 text-white font-bold text-[9px] px-1.5 py-0.5 rounded-full">
                              {s.unread_count}
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-500 truncate mt-0.5">Parent: {parentNames}</p>
                        {s.last_message && (
                          <p className="text-[10px] text-slate-400 truncate mt-1 italic">
                            {s.last_message.message}
                          </p>
                        )}
                      </div>
                    </button>
                  );
                });
              })()}
            </div>
          </div>

          {/* Right panel: Active chat thread */}
          <div className={`flex-1 flex flex-col bg-slate-50/40 ${mobileShowThread ? 'flex' : 'hidden md:flex'}`}>
            {selectedStudent ? (
              <>
                {/* Chat Header */}
                <div className="bg-white border-b border-gray-100 p-4 flex items-center justify-between shadow-xs">
                  <div className="flex items-center gap-3 min-w-0">
                    <button
                      type="button"
                      onClick={() => setMobileShowThread(false)}
                      className="p-2 text-slate-500 hover:text-slate-700 md:hidden"
                      aria-label="Back"
                    >
                      <ChevronLeft size={20} />
                    </button>
                    <div>
                      <h3 className="text-xs font-bold text-slate-900">
                        {(selectedStudent.parents || []).map((p: any) => p.full_name).join(', ') || 'Parent'}
                      </h3>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        Parent of {selectedStudent.first_name} {selectedStudent.last_name} ({selectedStudent.class?.name || 'No Class'})
                      </p>
                    </div>
                  </div>
                </div>

                {/* Messages Stream */}
                <div className="flex-1 p-4 overflow-y-auto flex flex-col gap-3 bg-slate-50">
                  {chatHistory.length === 0 ? (
                    <div className="my-auto text-center py-8">
                      <MessageSquare size={36} className="mx-auto text-slate-300 mb-2" />
                      <p className="text-xs text-slate-400 font-medium">No EduChart messages with this parent yet</p>
                    </div>
                  ) : (
                    chatHistory.map((m: any) => {
                      const isParentSender = (selectedStudent.parents || []).some((p: any) => p.id === m.sender_id || p.full_name === m.sender_name);
                      const isTeacherOutbound = !isParentSender;
                      
                      const avatarSrc = isTeacherOutbound
                        ? (session?.avatar_url ? photoSrc(session.avatar_url) : null)
                        : (m.sender_avatar ? photoSrc(m.sender_avatar) : null);
                      const senderInitial = (isTeacherOutbound
                        ? (session?.full_name?.[0] || 'T')
                        : (m.sender_name?.[0] || 'P')
                      ).toUpperCase();

                      return (
                        <div
                          key={m.id}
                          className={`flex items-start gap-2 max-w-[90%] ${isTeacherOutbound ? 'ml-auto flex-row-reverse' : 'mr-auto'}`}
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
                              isTeacherOutbound
                                ? 'bg-primary-600 text-white rounded-tr-none'
                                : 'bg-white text-gray-800 border border-gray-100 rounded-tl-none'
                            }`}
                          >
                            {!isTeacherOutbound ? (
                              <span className="text-[9px] font-bold text-primary-700 uppercase mb-1">
                                {m.sender_name}
                                {m.recipient_type === 'teacher' && (
                                  <span className="bg-amber-100 text-amber-800 text-[8px] font-extrabold px-1.5 py-0.5 rounded ml-1.5">
                                    Class Teachers
                                  </span>
                                )}
                                {m.recipient_type === 'school' && (
                                  <span className="bg-blue-100 text-blue-800 text-[8px] font-extrabold px-1.5 py-0.5 rounded ml-1.5">
                                    To Admin
                                  </span>
                                )}
                              </span>
                            ) : (
                              <span className="text-[9px] font-bold text-white/80 uppercase mb-1">
                                {m.sender_name}
                                {m.recipient_type === 'teacher' && (
                                  <span className="bg-amber-500/35 text-white text-[8px] font-extrabold px-1.5 py-0.5 rounded ml-1.5">
                                    Class Teachers
                                  </span>
                                )}
                                {m.recipient_type === 'school' && (
                                  <span className="bg-blue-500/35 text-white text-[8px] font-extrabold px-1.5 py-0.5 rounded ml-1.5">
                                    To Admin
                                  </span>
                                )}
                              </span>
                            )}
                            <ChatMediaBubble mediaUrl={m.media_url} mediaType={m.media_type} photoSrc={photoSrc} />
                            <p className="text-xs leading-relaxed whitespace-pre-line break-words">{m.message}</p>
                            <span className={`text-[8px] mt-1 text-right block ${isTeacherOutbound ? 'text-white/70' : 'text-gray-400'}`}>
                              {formatDateTimeLagos(m.created_at)}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Message Input Box */}
                <div className="bg-white border-t border-gray-100 p-3">
                  {/* Recipient Selector Pills */}
                  <div className="flex gap-2 mb-2 bg-slate-100 p-1 rounded-xl w-fit">
                    <button
                      type="button"
                      onClick={() => setRecipientType('parent')}
                      className={`px-3 py-1 text-[10px] font-bold rounded-lg transition-all ${
                        recipientType === 'parent'
                          ? 'bg-white text-slate-800 shadow-2xs'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      Parent
                    </button>
                    <button
                      type="button"
                      onClick={() => setRecipientType('teacher')}
                      className={`px-3 py-1 text-[10px] font-bold rounded-lg transition-all ${
                        recipientType === 'teacher'
                          ? 'bg-white text-slate-800 shadow-2xs'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      Class Teachers
                    </button>
                    <button
                      type="button"
                      onClick={() => setRecipientType('school')}
                      className={`px-3 py-1 text-[10px] font-bold rounded-lg transition-all ${
                        recipientType === 'school'
                          ? 'bg-white text-slate-800 shadow-2xs'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      Admin
                    </button>
                  </div>

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
                    disabled={recipientType === 'parent' && (!selectedStudent.parents || selectedStudent.parents.length === 0)}
                  />
                  <div className="flex gap-2 items-end">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={recipientType === 'parent' && (!selectedStudent.parents || selectedStudent.parents.length === 0)}
                      className="p-3 h-[46px] w-[46px] flex items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-all shrink-0"
                      title="Attach File (Image/PDF)"
                    >
                      <Paperclip size={18} />
                    </button>
                    
                    {!(recipientType === 'parent' && (!selectedStudent.parents || selectedStudent.parents.length === 0)) && (
                      <div className="shrink-0 mb-0.5">
                        <VoiceRecordButton
                          onRecordComplete={(blob) => {
                            const file = new File([blob], `voice-note-${Date.now()}.webm`, { type: blob.type });
                            setSelectedFile(file);
                          }}
                          onRecordingStateChange={setIsRecordingVoice}
                        />
                      </div>
                    )}

                    <textarea
                      rows={2}
                      className="input py-2 px-3 text-xs flex-1 min-h-[46px] resize-none"
                      value={chatText}
                      onChange={(e) => setChatText(e.target.value)}
                      placeholder={
                        recipientType === 'parent' && (!selectedStudent.parents || selectedStudent.parents.length === 0)
                          ? "No parents linked to this student"
                          : isRecordingVoice 
                            ? "Recording voice note..."
                            : recipientType === 'teacher'
                              ? "Type your message to class teachers..."
                              : recipientType === 'school'
                                ? "Type your message to school administration..."
                                : "Type your message to the parent..."
                      }
                      disabled={isRecordingVoice || (recipientType === 'parent' && (!selectedStudent.parents || selectedStudent.parents.length === 0))}
                      maxLength={500}
                    />
                    <button
                      type="button"
                      onClick={handleSendChat}
                      disabled={sendingChat || uploadingFile || (!chatText.trim() && !selectedFile) || (recipientType === 'parent' && (!selectedStudent.parents || selectedStudent.parents.length === 0))}
                      className="btn-primary px-4 h-[46px] flex items-center justify-center rounded-xl shrink-0"
                      aria-label="Send"
                    >
                      <Send size={16} />
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="m-auto text-center py-8">
                <MessageSquare size={36} className="mx-auto text-slate-300 mb-2" />
                <p className="text-xs text-slate-400 font-medium">Select a student/parent to start EduChart</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
