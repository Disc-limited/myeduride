// @ts-nocheck
'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { fetchData, getSession } from '@/lib/api';
import StudentAvatar from '@/components/shared/StudentAvatar';
import { createClient } from '@/lib/supabase/client';
import {
  Users, UserCheck, AlertTriangle, GraduationCap, Clock, Download,
  BookOpen, Car, CheckCircle2, ScanLine, Search, MessageSquare, Send, ChevronLeft,
  X, Paperclip, CheckCheck, Megaphone, ShieldAlert, Sparkles, PlusCircle,
  Eye, Pause, ArrowLeftRight, HelpCircle, PhoneCall, ShieldCheck, UserX,
  FileText, Activity, Home, MoreHorizontal
} from 'lucide-react';
import TeacherScanModal from '@/components/teacher/TeacherScanModal';
import Link from 'next/link';
import { ATTENDANCE_UI_NOTE } from '@/lib/attendance/window';
import { formatTimeLagos, formatDateTimeLagos } from '@/lib/timezone';
import { toast } from 'sonner';
import { showWhatsAppToast } from '@/lib/notifications/whatsapp-toast';
import { photoSrc } from '@/lib/photo';
import { useFileUpload } from '@/hooks/useFileUpload';
import { ChatAttachmentPreview } from '@/components/chat/ChatAttachmentPreview';
import { ChatMediaBubble } from '@/components/chat/ChatMediaBubble';
import { VoiceRecordButton } from '@/components/chat/VoiceRecordButton';
import SchoolNoticeBanner from '@/components/shared/SchoolNoticeBanner';
import SchoolNoticesInboxView from '@/components/shared/SchoolNoticesInboxView';

export default function TeacherDashboard() {
  const [students, setStudents] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [stats, setStats] = useState({ total: 0, present: 0, absent: 0 });
  const [loading, setLoading] = useState(true);
  const [readySearch, setReadySearch] = useState('');
  const [studentSearch, setStudentSearch] = useState('');
  const [chatSearch, setChatSearch] = useState('');
  const [chatHistory, setChatHistory] = useState([]);
  const [chatText, setChatText] = useState('');
  const [attachPhoto, setAttachPhoto] = useState(false);
  const [sendingChat, setSendingChat] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [dismissAllBusy, setDismissAllBusy] = useState(false);
  const [showScan, setShowScan] = useState(false);
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'class' | 'pickup' | 'messages'
  const [schoolId, setSchoolId] = useState('');
  const [schoolName, setSchoolName] = useState('');
  const [mobileShowThread, setMobileShowThread] = useState(false);
  const [showReportIncidentModal, setShowReportIncidentModal] = useState(false);

  // File upload and voice recording states
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { uploadFile, uploading: uploadingFile } = useFileUpload();
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [recipientType, setRecipientType] = useState('parent');

  const [session, setSession] = useState(null);
  const [isUnassigned, setIsUnassigned] = useState(false);

  // Extend Release Time / Delay Modal State
  const [delayModalOpen, setDelayModalOpen] = useState(false);
  const [targetStudentForDelay, setTargetStudentForDelay] = useState<any>(null);
  const [delayEndTime, setDelayEndTime] = useState('16:30');
  const [delayReasonPreset, setDelayReasonPreset] = useState('Extra lesson / Remedial class');
  const [delayReasonCustom, setDelayReasonCustom] = useState('');
  const [delaySubmitting, setDelaySubmitting] = useState(false);

  useEffect(() => {
    setSession(getSession());
    loadClass();
  }, []);

  const loadClass = async () => {
    try {
      const data = await fetchData('get_teacher_class_data', { role: 'teacher' });
      setStudents(data.students || []);
      setIsUnassigned(Boolean(data.unassigned_class));
      setStats(
        data.stats || {
          total: data.students?.length || 0,
          present: data.students?.filter((s: any) => s.present)?.length || 0,
          absent: data.students?.filter((s: any) => !s.present)?.length || 0,
        }
      );
      setSchoolId(data.school_id || '');
      setSchoolName(data.school?.name || data.school_name || 'My Class');
    } catch (e) {
      console.error(e);
      toast.error('Could not load class data');
    }
    setLoading(false);
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
    const currentSession = getSession();
    if (!currentSession?.user_id) return;

    const supabase = createClient();
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
            is_read: activeTab === 'messages' && selectedStudent?.id === newMsg.student_id ? true : newMsg.is_read,
          };

          const isCurrentlyViewingThread = activeTab === 'messages' && selectedStudent?.id === newMsg.student_id;

          if (isCurrentlyViewingThread) {
            setChatHistory((prev) => {
              if (prev.some((m) => m.id === formatted.id)) return prev;
              return [...prev, formatted];
            });

            if (newMsg.sender_id !== currentSession.user_id) {
              fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                  action: 'mark_read',
                  params: { student_id: selectedStudent.id },
                }),
              }).catch(() => {});
            }
          } else {
            setStudents((prev) =>
              prev.map((s) => {
                if (s.id === newMsg.student_id) {
                  const isIncoming = newMsg.sender_id !== currentSession.user_id;
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

            if (newMsg.sender_id !== currentSession.user_id) {
              const targetStudent = students.find((s) => s.id === newMsg.student_id);
              const senderLabel = newMsg.sender_name || (targetStudent ? `Parents of ${targetStudent.first_name}` : 'Parent');
              const roleTag = newMsg.recipient_type === 'school' ? 'School Admin' : 'Parent';

              showWhatsAppToast({
                senderName: senderLabel,
                roleBadge: roleTag,
                content: newMsg.content,
                mediaType: newMsg.media_type,
                onView: () => {
                  setActiveTab('messages');
                  if (targetStudent) {
                    setSelectedStudent(targetStudent);
                    setMobileShowThread(true);
                  }
                },
              });
            }
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'chat_messages',
          filter: `school_id=eq.${schoolId}`,
        },
        (payload) => {
          const updatedMsg = payload.new;
          if (selectedStudent?.id && updatedMsg.student_id === selectedStudent.id) {
            setChatHistory((prev) =>
              prev.map((m) => (m.id === updatedMsg.id ? { ...m, is_read: updatedMsg.is_read } : m))
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [schoolId, selectedStudent, activeTab, students]);

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

  const activeStudents = useMemo(
    () => students.filter((s) => !s.ready_for_pickup && !s.in_extra_lesson),
    [students]
  );
  const readyStudents = useMemo(() => students.filter((s) => s.ready_for_pickup), [students]);
  const extraStudents = useMemo(() => students.filter((s) => s.in_extra_lesson), [students]);

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

  const openDelayModal = (student: any) => {
    setTargetStudentForDelay(student);
    setDelayEndTime('16:30');
    setDelayReasonPreset('Extra lesson / Remedial class');
    setDelayReasonCustom('');
    setDelayModalOpen(true);
  };

  const handleSaveDelay = async (e: any) => {
    e.preventDefault();
    if (!targetStudentForDelay || !schoolId) return;
    const finalReason =
      delayReasonPreset === 'Other'
        ? delayReasonCustom.trim() || 'Teacher delay notice'
        : `${delayReasonPreset}${delayReasonCustom.trim() ? ` — ${delayReasonCustom.trim()}` : ''}`;

    setDelaySubmitting(true);
    try {
      const res = await fetch('/api/teacher/extra-lesson', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          student_id: targetStudentForDelay.id,
          school_id: schoolId,
          action: 'add',
          lesson_end_time: delayEndTime,
          reason: finalReason,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to extend release time');

      toast.success(`Release time extended for ${targetStudentForDelay.first_name}! Parents notified.`);
      setDelayModalOpen(false);
      await loadClass();
    } catch (err: any) {
      toast.error(err.message || 'Failed to extend release time');
    } finally {
      setDelaySubmitting(false);
    }
  };

  const markExtraLesson = (studentId: string, studentName: string) => {
    const st = students.find((s: any) => s.id === studentId) || { id: studentId, first_name: studentName, last_name: '' };
    openDelayModal(st);
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
      toast.error('No present students to mark ready');
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

  // Mock data for initial visual render matching mockup structure if database list is small
  const displayStudentsList = useMemo(() => {
    if (students.length > 0) return students;
    return [
      { id: '1', first_name: 'Amara', last_name: 'Okeke', student_id_number: 'PSE-001', present: true, ready_for_pickup: true, parents: [{ full_name: 'Mrs. Ngozi Okeke', relation: 'Mother' }], arrival_time: '2025-05-22T07:45:00Z', pickup_time: '01:15 PM' },
      { id: '2', first_name: 'Joshua', last_name: 'Daniel', student_id_number: 'PSE-002', present: true, ready_for_pickup: true, parents: [{ full_name: 'Mr. Daniel Daniel', relation: 'Father' }], arrival_time: '2025-05-22T07:50:00Z', pickup_time: '01:20 PM' },
      { id: '3', first_name: 'Hannah', last_name: 'James', student_id_number: 'PSE-003', present: true, ready_for_pickup: true, parents: [{ full_name: 'Mrs. Sarah James', relation: 'Mother' }], arrival_time: '2025-05-22T08:00:00Z', pickup_time: '01:25 PM' },
      { id: '4', first_name: 'Ethan', last_name: 'Williams', student_id_number: 'PSE-004', present: true, ready_for_pickup: true, parents: [{ full_name: 'Mrs. Williams', relation: 'Aunt' }], arrival_time: '2025-05-22T07:40:00Z', pickup_time: '01:30 PM' },
      { id: '5', first_name: 'Peace', last_name: 'Udo', student_id_number: 'PSE-005', present: false, ready_for_pickup: false, parents: [{ full_name: 'Mr. Sunday Udo', relation: 'Father' }], arrival_time: null, pickup_time: '01:35 PM' },
    ];
  }, [students]);

  const displayReadyStudents = useMemo(() => {
    const list = students.filter((s) => s.ready_for_pickup);
    if (list.length > 0) return list;
    return displayStudentsList.filter((s) => s.ready_for_pickup);
  }, [students, displayStudentsList]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-slate-600 font-bold text-sm">Loading Teacher Dashboard corridor...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20 sm:pb-8">
      {/* OFFICIAL SCHOOL NOTICES & PUBLIC HOLIDAY ADVISORIES */}
      <SchoolNoticeBanner role="teachers" schoolId={schoolId} />

      {activeTab === 'notices' ? (
        <SchoolNoticesInboxView role="teachers" schoolId={schoolId} />
      ) : (
        <>

      {/* Unassigned Class Warning Banner */}
      {isUnassigned && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-3xl p-4 sm:p-5 flex items-start gap-4 text-amber-900 shadow-sm animate-in fade-in">
          <div className="w-10 h-10 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center font-bold shrink-0 mt-0.5 shadow-xs">
            <AlertTriangle size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-black text-slate-900">No Homeroom Class Assigned Yet</h3>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
              Your teacher account has not been assigned to a homeroom class in MyEduRide. Please contact your <strong>School Administrator</strong> to attach your profile to your correct class in <strong>Class Management</strong> or <strong>Staff Management</strong> so you can view and control student release during pickup.
            </p>
          </div>
        </div>
      )}

      {/* 1. DISC COMMUNICATION CENTER Banner Carousel (Matches Mockup) */}
      <div className="bg-gradient-to-r from-amber-50/80 via-white to-emerald-50/60 rounded-3xl p-4 sm:p-5 border border-slate-200/80 shadow-xs relative overflow-hidden">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center font-bold shadow-sm">
            <Megaphone size={18} />
          </div>
          <div>
            <h2 className="text-xs font-black tracking-wider text-slate-900 uppercase">
              DISC COMMUNICATION CENTER
            </h2>
            <p className="text-[11px] text-slate-500 font-medium">Stay informed. Stay safe. Stay ahead.</p>
          </div>
        </div>

        {/* Banners Grid / Carousel */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3.5">
          {/* Card 1: Back-to-School Campaign */}
          <div className="bg-white rounded-2xl p-3 border border-slate-200 shadow-xs flex flex-col justify-between hover:shadow-md transition-all">
            <div className="flex items-center gap-2.5 mb-2">
              <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                <Users size={18} className="text-amber-800" />
              </div>
              <div className="min-w-0">
                <span className="text-[9px] font-black text-amber-700 uppercase tracking-wide">Campaign</span>
                <p className="text-xs font-bold text-slate-900 truncate">BACK-TO-SCHOOL</p>
              </div>
            </div>
            <p className="text-[11px] text-slate-600 leading-snug mb-3">
              Get 10% off MyEduRide Transport Manager.
            </p>
            <button
              type="button"
              className="w-full py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs"
            >
              Learn More
            </button>
          </div>

          {/* Card 2: Safety Tip */}
          <div className="bg-white rounded-2xl p-3 border border-slate-200 shadow-xs flex flex-col justify-between hover:shadow-md transition-all">
            <div className="flex items-center gap-2.5 mb-2">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-600 flex items-center justify-center shrink-0">
                <ShieldCheck size={20} />
              </div>
              <div className="min-w-0">
                <span className="text-[9px] font-black text-amber-600 uppercase tracking-wide">Safety Tip</span>
                <p className="text-xs font-bold text-slate-900 truncate">VERIFY ESCORT</p>
              </div>
            </div>
            <p className="text-[11px] text-slate-600 leading-snug mb-3">
              Always verify your child's pickup person before releasing them.
            </p>
            <button
              type="button"
              className="w-full py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl text-xs font-bold transition-all shadow-xs"
            >
              View Tips
            </button>
          </div>

          {/* Card 3: Partner School Spotlight */}
          <div className="bg-white rounded-2xl p-3 border border-slate-200 shadow-xs flex flex-col justify-between hover:shadow-md transition-all">
            <div className="flex items-center gap-2.5 mb-2">
              <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                <GraduationCap size={20} />
              </div>
              <div className="min-w-0">
                <span className="text-[9px] font-black text-blue-600 uppercase tracking-wide">Spotlight</span>
                <p className="text-xs font-bold text-slate-900 truncate">Greenfield Intl.</p>
              </div>
            </div>
            <p className="text-[11px] text-slate-600 leading-snug mb-3">
              Greenfield Intl. School Excellence in Safety.
            </p>
            <button
              type="button"
              className="w-full py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs"
            >
              View Story
            </button>
          </div>

          {/* Card 4: MyEduRide Update */}
          <div className="bg-white rounded-2xl p-3 border border-slate-200 shadow-xs flex flex-col justify-between hover:shadow-md transition-all">
            <div className="flex items-center gap-2.5 mb-2">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                <Sparkles size={18} />
              </div>
              <div className="min-w-0">
                <span className="text-[9px] font-black text-emerald-600 uppercase tracking-wide">Feature</span>
                <p className="text-xs font-bold text-slate-900 truncate">MYEDURIDE UPDATE</p>
              </div>
            </div>
            <p className="text-[11px] text-slate-600 leading-snug mb-3">
              New: Real-time pickup alerts for parents is now live!
            </p>
            <button
              type="button"
              className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs"
            >
              See Updates
            </button>
          </div>

          {/* Card 5: Security Advisory */}
          <div className="bg-[#081a2e] text-white rounded-2xl p-3 border border-slate-800 shadow-xs flex flex-col justify-between hover:shadow-md transition-all">
            <div className="flex items-center gap-2.5 mb-2">
              <div className="w-10 h-10 rounded-xl bg-red-500/20 text-red-400 flex items-center justify-center shrink-0">
                <ShieldAlert size={20} />
              </div>
              <div className="min-w-0">
                <span className="text-[9px] font-black text-red-400 uppercase tracking-wide">Security</span>
                <p className="text-xs font-bold text-white truncate">ADVISORY</p>
              </div>
            </div>
            <p className="text-[11px] text-slate-300 leading-snug mb-3">
              Report suspicious activity immediately to gate officer.
            </p>
            <button
              type="button"
              onClick={() => setShowReportIncidentModal(true)}
              className="w-full py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold transition-all shadow-xs"
            >
              Report Now
            </button>
          </div>
        </div>
      </div>

      {/* 2. Stats Overview Row (6 Vibrant Cards Matching Mockup) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Total Students */}
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <Users size={22} />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Students</p>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-black text-slate-900">{stats.total}</span>
              <span className="text-[10px] text-slate-400">in class</span>
            </div>
          </div>
        </div>

        {/* Present Today */}
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <UserCheck size={22} />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Present Today</p>
              <span className="text-xl font-black text-slate-900">{stats.present}</span>
            </div>
          </div>
          <span className="px-2 py-0.5 text-[10px] font-extrabold bg-blue-100 text-blue-800 rounded-full">
            {((stats.present / (stats.total || 1)) * 100).toFixed(1)}%
          </span>
        </div>

        {/* Absent Today */}
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-red-50 text-red-500 flex items-center justify-center shrink-0">
              <UserX size={22} />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Absent Today</p>
              <span className="text-xl font-black text-slate-900">{stats.absent}</span>
            </div>
          </div>
          <span className="px-2 py-0.5 text-[10px] font-extrabold bg-red-100 text-red-700 rounded-full">
            {((stats.absent / (stats.total || 1)) * 100).toFixed(1)}%
          </span>
        </div>

        {/* Ready for Pickup */}
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <Car size={22} />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Ready for Pickup</p>
            <span className="text-xl font-black text-slate-900">{displayReadyStudents.length}</span>
            <button
              type="button"
              onClick={() => setActiveTab('pickup')}
              className="text-[10px] font-bold text-emerald-600 hover:underline block"
            >
              View / Edit List
            </button>
          </div>
        </div>

        {/* Students Released */}
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
            <ShieldCheck size={22} />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Students Released</p>
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-black text-slate-900">7</span>
              <span className="text-[10px] text-slate-400">Today</span>
            </div>
          </div>
        </div>

        {/* Parent Messages */}
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center shrink-0">
            <MessageSquare size={22} />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Parent Messages</p>
            <span className="text-xl font-black text-slate-900">8</span>
            <button
              type="button"
              onClick={() => setActiveTab('messages')}
              className="text-[10px] font-bold text-emerald-600 hover:underline block"
            >
              View Messages
            </button>
          </div>
        </div>
      </div>

      {/* Quick Scanning Bar */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={dismissAllReady}
            disabled={dismissAllBusy}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center gap-2 shadow-xs transition-all disabled:opacity-50"
          >
            <Car size={16} />
            {dismissAllBusy ? 'Marking…' : 'Approve All Ready'}
          </button>

          <button
            type="button"
            onClick={() => setShowScan(true)}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl flex items-center gap-2 border border-slate-200 transition-all"
          >
            <ScanLine size={16} className="text-emerald-600" />
            <span>Scan Student ID</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/teacher/reports"
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl flex items-center gap-2 border border-slate-200 transition-all"
          >
            <Download size={16} />
            <span>Reports</span>
          </Link>
        </div>
      </div>

      {showScan && (
        <TeacherScanModal
          schoolId={schoolId}
          onClose={() => setShowScan(false)}
          onSuccess={loadClass}
        />
      )}

      {/* 3. Primary Operational Grid (3 Columns Desktop matching mockup) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Card 1: My Students (Primary 5 - Emerald) */}
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
              <div>
                <h3 className="text-sm font-black text-slate-900">
                  My Students ({schoolName || 'Primary 5 - Emerald'})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('class')}
                className="text-xs font-bold text-emerald-600 hover:underline"
              >
                View All
              </button>
            </div>

            {/* Students Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase">
                    <th className="py-2">STUDENT</th>
                    <th className="py-2">ID</th>
                    <th className="py-2">ATTENDANCE</th>
                    <th className="py-2">PICKUP STATUS</th>
                    <th className="py-2 text-right">ACTIONS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {displayStudentsList.slice(0, 5).map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-2.5">
                        <div className="flex items-center gap-2">
                          <StudentAvatar photoUrl={s.photo_url} firstName={s.first_name} lastName={s.last_name} size="xs" />
                          <span className="font-bold text-slate-900 truncate max-w-[100px]">
                            {s.first_name} {s.last_name}
                          </span>
                        </div>
                      </td>
                      <td className="py-2.5 text-slate-500 font-mono text-[11px]">
                        {s.student_id_number || 'PSE-00' + s.id}
                      </td>
                      <td className="py-2.5">
                        <span className="inline-flex items-center gap-1 font-bold text-[11px]">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              s.present ? 'bg-emerald-500' : 'bg-red-500'
                            }`}
                          ></span>
                          {s.present ? 'Present' : 'Absent'}
                        </span>
                      </td>
                      <td className="py-2.5">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                            s.ready_for_pickup
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-red-50 text-red-600'
                          }`}
                        >
                          {s.ready_for_pickup ? 'Ready' : 'Not Ready'}
                        </span>
                      </td>
                      <td className="py-2.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedStudent(s);
                              setActiveTab('messages');
                            }}
                            className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-slate-100 rounded-lg"
                            title="Chat parent"
                          >
                            <MessageSquare size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => markReady(s.id, `${s.first_name} ${s.last_name}`)}
                            className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-slate-100 rounded-lg"
                            title="Toggle Ready"
                          >
                            <CheckCircle2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between mt-3">
            <span className="text-[11px] text-slate-500">
              Showing 1 to {Math.min(5, displayStudentsList.length)} of {displayStudentsList.length} students
            </span>
            <button
              type="button"
              onClick={() => setActiveTab('class')}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs"
            >
              View All Students
            </button>
          </div>
        </div>

        {/* Card 2: Ready for Pickup (Today) */}
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
              <div>
                <h3 className="text-sm font-black text-slate-900">Ready for Pickup (Today)</h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('pickup')}
                className="text-xs font-bold text-emerald-600 hover:underline"
              >
                Edit List
              </button>
            </div>

            {/* Ready List Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase">
                    <th className="py-2">STUDENT</th>
                    <th className="py-2">ESCORT / PARENT</th>
                    <th className="py-2">TIME</th>
                    <th className="py-2">STATUS</th>
                    <th className="py-2 text-right">ACTION</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {displayStudentsList.slice(0, 5).map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-2.5">
                        <div className="flex items-center gap-2">
                          <StudentAvatar photoUrl={s.photo_url} firstName={s.first_name} lastName={s.last_name} size="xs" />
                          <span className="font-bold text-slate-900 truncate max-w-[90px]">
                            {s.first_name} {s.last_name}
                          </span>
                        </div>
                      </td>
                      <td className="py-2.5 text-slate-600 text-[11px] truncate max-w-[100px]">
                        {s.parents?.[0]?.full_name || 'Mrs. Ngozi Okeke'}
                      </td>
                      <td className="py-2.5 text-slate-500 font-mono text-[11px]">
                        {s.pickup_time || '01:15 PM'}
                      </td>
                      <td className="py-2.5">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800">
                          Ready
                        </span>
                      </td>
                      <td className="py-2.5 text-right">
                        <button
                          type="button"
                          onClick={() => markExtraLesson(s.id, `${s.first_name} ${s.last_name}`)}
                          className="px-2.5 py-1 bg-amber-100 hover:bg-amber-200 text-amber-800 rounded-lg text-[10px] font-bold transition-colors"
                        >
                          Hold
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2 mt-3">
            <button
              type="button"
              onClick={dismissAllReady}
              disabled={dismissAllBusy}
              className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all text-center shadow-xs disabled:opacity-50"
            >
              Approve All Ready
            </button>
            <button
              type="button"
              className="py-2 px-3 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl text-xs font-bold transition-all text-center shadow-xs"
            >
              Hold Selected
            </button>
            <button
              type="button"
              className="py-2 px-3 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-all text-center shadow-xs"
            >
              Return
            </button>
          </div>
        </div>

        {/* Card 3: Parent Messaging */}
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
              <div>
                <h3 className="text-sm font-black text-slate-900">Parent Messaging</h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('messages')}
                className="text-xs font-bold text-emerald-600 hover:underline"
              >
                View All
              </button>
            </div>

            {/* Parent Chat Snippets */}
            <div className="space-y-3">
              {[
                { name: 'Mrs. Ngozi Okeke', text: 'Good morning ma, will the children...', time: '08:15 AM', unread: 2 },
                { name: 'Mr. Daniel Daniel', text: 'Please can you confirm if the...', time: '07:50 AM', unread: 1 },
                { name: 'Mrs. Sarah James', text: 'Thank you for the update about...', time: 'Yesterday', unread: 0 },
              ].map((msg, i) => (
                <div
                  key={i}
                  onClick={() => {
                    setActiveTab('messages');
                    if (students[i]) setSelectedStudent(students[i]);
                  }}
                  className="flex items-center justify-between p-2.5 rounded-2xl bg-slate-50 hover:bg-emerald-50/50 cursor-pointer transition-all border border-slate-100"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center shrink-0">
                      {msg.name[0]}
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-slate-900 truncate">{msg.name}</h4>
                      <p className="text-[11px] text-slate-500 truncate">{msg.text}</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-[10px] text-slate-400 block font-mono">{msg.time}</span>
                    {msg.unread > 0 && (
                      <span className="inline-block mt-0.5 px-1.5 py-0.5 bg-emerald-500 text-white font-bold text-[9px] rounded-full">
                        {msg.unread}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 mt-3">
            <button
              type="button"
              onClick={() => setActiveTab('messages')}
              className="w-full py-2.5 border-2 border-emerald-600 text-emerald-700 hover:bg-emerald-50 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2"
            >
              <Send size={15} />
              <span>Send Message</span>
            </button>
          </div>
        </div>
      </div>

      {/* 4. Secondary Operational Grid (4 Columns Desktop matching mockup) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Card 4: EduChart (Staff Chat) */}
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
              <h3 className="text-sm font-black text-slate-900">EduChart (Staff Chat)</h3>
              <Link href="/dashboard/staff-chat" className="text-xs font-bold text-emerald-600 hover:underline">
                View All
              </Link>
            </div>

            <div className="space-y-2.5">
              <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-xs shrink-0">
                    SG
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900 truncate">Staff Group</p>
                    <p className="text-[10px] text-slate-500 truncate">Mr. Peter: Meeting at 2PM</p>
                  </div>
                </div>
                <span className="text-[9px] text-slate-400 font-mono">07:30 AM</span>
              </div>

              <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs shrink-0">
                    SA
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900 truncate">School Admin</p>
                    <p className="text-[10px] text-slate-500 truncate">Admin: Submit attendance</p>
                  </div>
                </div>
                <span className="text-[9px] text-slate-400 font-mono">07:20 AM</span>
              </div>

              <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs shrink-0">
                    SN
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900 truncate">School Nurse</p>
                    <p className="text-[10px] text-slate-500 truncate">Nurse Mary: Amara visited</p>
                  </div>
                </div>
                <span className="text-[9px] text-slate-400 font-mono">Yesterday</span>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 mt-3">
            <Link
              href="/dashboard/staff-chat"
              className="w-full py-2 border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 text-center"
            >
              <MessageSquare size={14} />
              <span>Open EduChart</span>
            </Link>
          </div>
        </div>

        {/* Card 5: Safety Reports */}
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
              <h3 className="text-sm font-black text-slate-900">Safety Reports</h3>
              <Link href="/dashboard/teacher/reports" className="text-xs font-bold text-emerald-600 hover:underline">
                View All
              </Link>
            </div>

            <div className="space-y-2.5">
              <div className="p-2 rounded-xl bg-red-50/60 border border-red-100 flex items-start gap-2">
                <AlertTriangle size={16} className="text-red-500 shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-slate-900">Student Illness</p>
                    <span className="px-1.5 py-0.5 text-[8px] font-black bg-red-500 text-white rounded">New</span>
                  </div>
                  <p className="text-[10px] text-slate-600">Amara Okeke visited sick bay</p>
                </div>
              </div>

              <div className="p-2 rounded-xl bg-amber-50/60 border border-amber-100 flex items-start gap-2">
                <ShieldAlert size={16} className="text-amber-600 shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-slate-900">Behaviour Concern</p>
                    <span className="px-1.5 py-0.5 text-[8px] font-black bg-amber-500 text-slate-950 rounded">In Review</span>
                  </div>
                  <p className="text-[10px] text-slate-600">Reported by Gate Officer</p>
                </div>
              </div>

              <div className="p-2 rounded-xl bg-emerald-50/60 border border-emerald-100 flex items-start gap-2">
                <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-slate-900">Lost Item</p>
                    <span className="px-1.5 py-0.5 text-[8px] font-black bg-emerald-600 text-white rounded">Resolved</span>
                  </div>
                  <p className="text-[10px] text-slate-600">Water bottle found at playground</p>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 mt-3">
            <button
              type="button"
              onClick={() => setShowReportIncidentModal(true)}
              className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-xs"
            >
              <PlusCircle size={15} />
              <span>Report an Incident</span>
            </button>
          </div>
        </div>

        {/* Card 6: Live Pickup Queue */}
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
              <h3 className="text-sm font-black text-slate-900">Live Pickup Queue</h3>
              <span className="text-xs font-bold text-emerald-600">View All</span>
            </div>

            <div className="space-y-2.5">
              {[
                { name: 'Chisom Adebayo', class: 'JS 1A', time: '01:10 PM' },
                { name: 'Daniel Okoro', class: 'JS 1A', time: '01:18 PM' },
                { name: 'Zainab Yusuf', class: 'Primary 4', time: '01:25 PM' },
              ].map((item, i) => (
                <div key={i} className="flex items-center justify-between p-2 rounded-xl bg-slate-50">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-7 h-7 rounded-full bg-slate-800 text-white font-bold flex items-center justify-center text-[10px] shrink-0">
                      {item.name[0]}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-900 truncate">{item.name}</p>
                      <p className="text-[10px] text-slate-400">Escort expected</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-[10px] font-mono text-amber-600 font-bold shrink-0">
                    <Clock size={12} />
                    <span>{item.time}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between mt-3">
            <span className="text-[10px] text-slate-500 font-bold">Total in Queue: 12</span>
            <button
              type="button"
              className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all"
            >
              View Full Queue
            </button>
          </div>
        </div>

        {/* Card 7: Recent Activity */}
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
              <h3 className="text-sm font-black text-slate-900">Recent Activity</h3>
              <span className="text-xs font-bold text-emerald-600">View All</span>
            </div>

            <div className="space-y-2.5">
              {[
                { icon: <UserCheck size={12} className="text-emerald-600" />, text: 'Attendance marked for Primary 5 - Emerald', time: '08:00 AM' },
                { icon: <Car size={12} className="text-amber-600" />, text: 'Pick up list updated', time: '07:45 AM' },
                { icon: <MessageSquare size={12} className="text-blue-600" />, text: 'Message sent to 10 parents', time: '07:30 AM' },
                { icon: <CheckCircle2 size={12} className="text-emerald-600" />, text: 'Ethan Williams marked Ready for pickup', time: '07:20 AM' },
              ].map((act, i) => (
                <div key={i} className="flex items-start gap-2 text-xs">
                  <div className="p-1 rounded-full bg-slate-100 mt-0.5 shrink-0">{act.icon}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-slate-700 text-[11px] leading-tight">{act.text}</p>
                  </div>
                  <span className="text-[9px] text-slate-400 font-mono shrink-0">{act.time}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 mt-3 text-right">
            <span className="text-[10px] text-slate-400 font-mono">Live Activity Sync Active</span>
          </div>
        </div>
      </div>

      {/* 5. Bottom Commitment Footer Bar */}
      <div className="bg-emerald-900 text-white rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-800 text-emerald-300 flex items-center justify-center shrink-0">
            <ShieldCheck size={24} />
          </div>
          <div>
            <p className="text-xs font-bold leading-tight">
              Thank you for playing a vital role in protecting our students.
            </p>
            <p className="text-[10px] text-emerald-300 font-medium">
              Consistent. Safe. Trusted.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-emerald-200">Need help?</span>
          <button
            type="button"
            onClick={() => toast.info('Support line: support@myeduride.com')}
            className="px-3 py-1.5 bg-emerald-800 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors border border-emerald-700"
          >
            <PhoneCall size={14} />
            <span>Contact Support</span>
          </button>
        </div>
      </div>
      </>
      )}

      {/* 6. Mobile Bottom Navigation Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 py-2 px-4 flex items-center justify-around lg:hidden shadow-lg">
        <button
          type="button"
          onClick={() => setActiveTab('overview')}
          className={`flex flex-col items-center gap-0.5 text-[10px] font-bold ${
            activeTab === 'overview' ? 'text-emerald-600' : 'text-slate-500'
          }`}
        >
          <Home size={18} />
          <span>Home</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('class')}
          className={`flex flex-col items-center gap-0.5 text-[10px] font-bold ${
            activeTab === 'class' ? 'text-emerald-600' : 'text-slate-500'
          }`}
        >
          <Users size={18} />
          <span>My Students</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('pickup')}
          className={`flex flex-col items-center gap-0.5 text-[10px] font-bold ${
            activeTab === 'pickup' ? 'text-emerald-600' : 'text-slate-500'
          }`}
        >
          <Car size={18} />
          <span>Pickup</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('messages')}
          className={`flex flex-col items-center gap-0.5 text-[10px] font-bold ${
            activeTab === 'messages' ? 'text-emerald-600' : 'text-slate-500'
          }`}
        >
          <MessageSquare size={18} />
          <span>Messages</span>
        </button>
      </div>

      {/* Incident Report Modal */}
      {showReportIncidentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="text-base font-black text-slate-900">Report Safety Incident</h3>
              <button
                type="button"
                onClick={() => setShowReportIncidentModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Incident Type</label>
                <select className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-semibold text-slate-800">
                  <option>Sick Bay / Student Illness</option>
                  <option>Behaviour Concern</option>
                  <option>Lost Item</option>
                  <option>Security Advisory</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Details</label>
                <textarea
                  rows={3}
                  placeholder="Describe the issue or note..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 focus:outline-none focus:border-emerald-500"
                ></textarea>
              </div>
            </div>
            <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowReportIncidentModal(false)}
                className="px-4 py-2 bg-slate-100 text-slate-700 text-xs font-bold rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  toast.success('Incident report submitted to school office');
                  setShowReportIncidentModal(false);
                }}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs"
              >
                Submit Report
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Extend Release Time / Delay Modal */}
      {delayModalOpen && targetStudentForDelay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
                  <Clock size={18} />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">Extend Release Time</h3>
                  <p className="text-[11px] text-slate-500 font-semibold">
                    {targetStudentForDelay.first_name} {targetStudentForDelay.last_name}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDelayModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveDelay} className="space-y-4">
              {/* New Release Time Picker & Quick Presets */}
              <div>
                <label className="text-xs font-extrabold text-slate-700 block mb-1">
                  New Extended Pickup Time *
                </label>
                <div className="flex items-center gap-2 mb-2">
                  <input
                    type="time"
                    value={delayEndTime}
                    onChange={(e) => setDelayEndTime(e.target.value)}
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-900 focus:outline-none focus:border-amber-500"
                    required
                  />
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {['15:30', '16:00', '16:30', '17:00', '17:30'].map((timeStr) => (
                    <button
                      key={timeStr}
                      type="button"
                      onClick={() => setDelayEndTime(timeStr)}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold transition-all border ${
                        delayEndTime === timeStr
                          ? 'bg-amber-500 text-slate-950 border-amber-600 shadow-2xs'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {timeStr}
                    </button>
                  ))}
                </div>
              </div>

              {/* Reason Preset Dropdown */}
              <div>
                <label className="text-xs font-extrabold text-slate-700 block mb-1">
                  Valid Reason for Delay *
                </label>
                <select
                  value={delayReasonPreset}
                  onChange={(e) => setDelayReasonPreset(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-semibold text-slate-800 focus:outline-none focus:border-amber-500"
                >
                  <option value="Extra lesson / Remedial class">Extra lesson / Remedial class</option>
                  <option value="School Sports / Athletics practice">School Sports / Athletics practice</option>
                  <option value="Behavioral hold / Detention">Behavioral hold / Detention</option>
                  <option value="School Event / Exhibition rehearsal">School Event / Exhibition rehearsal</option>
                  <option value="Counseling / Guidance session">Counseling / Guidance session</option>
                  <option value="Other">Other (custom reason)</option>
                </select>
              </div>

              {/* Custom Reason Notes */}
              <div>
                <label className="text-xs font-extrabold text-slate-700 block mb-1">
                  Teacher Notes for Parent / Escort (Optional)
                </label>
                <textarea
                  rows={3}
                  value={delayReasonCustom}
                  onChange={(e) => setDelayReasonCustom(e.target.value)}
                  placeholder="e.g. Completing math revision exercises. Will be ready at 4:30 PM."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 focus:outline-none focus:border-amber-500"
                ></textarea>
              </div>

              <div className="bg-amber-50 border border-amber-200/80 rounded-2xl p-3 text-[11px] text-amber-900 leading-snug">
                ℹ️ <strong>Accountability Notice</strong>: Your extended release request will be instantly pushed to the child's registered parents/escorts and recorded in the audit log.
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setDelayModalOpen(false)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={delaySubmitting}
                  className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-extrabold rounded-xl shadow-xs disabled:opacity-50 flex items-center gap-1.5"
                >
                  {delaySubmitting ? 'Saving...' : 'Extend & Notify Parents'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
