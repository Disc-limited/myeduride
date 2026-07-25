// @ts-nocheck
'use client';

import { useEffect, useState, useRef } from 'react';
import { fetchData, getSession } from '@/lib/api';
import { createClient } from '@/lib/supabase/client';
import StudentAvatar from '@/components/shared/StudentAvatar';
import { PageHeader } from '@/components/ui/PageHeader';
import {
  MessageSquare, Send, ChevronLeft, Search, Phone, Image, X, Paperclip
} from 'lucide-react';
import { formatDateTimeLagos } from '@/lib/timezone';
import { toast } from 'sonner';
import { photoSrc } from '@/lib/photo';
import { useFileUpload } from '@/hooks/useFileUpload';
import { ChatAttachmentPreview } from '@/components/chat/ChatAttachmentPreview';
import { ChatMediaBubble } from '@/components/chat/ChatMediaBubble';
import { VoiceRecordButton } from '@/components/chat/VoiceRecordButton';

export default function SchoolAdminMessages() {
  const [students, setStudents] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [chatHistory, setChatHistory] = useState([]);
  const [chatText, setChatText] = useState('');
  const [attachPhoto, setAttachPhoto] = useState(false);
  const [sendingChat, setSendingChat] = useState(false);
  const [loading, setLoading] = useState(true);
  const [schoolId, setSchoolId] = useState('');
  const [schoolName, setSchoolName] = useState('');
  const [chatSearch, setChatSearch] = useState('');
  const [mobileShowThread, setMobileShowThread] = useState(false);

  // Phase 2 states
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { uploadFile, uploading: uploadingFile } = useFileUpload();
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [recipientType, setRecipientType] = useState('parent'); // 'parent' | 'teacher'

  const [session, setSession] = useState(null);

  useEffect(() => {
    setSession(getSession());
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const schoolData = await fetchData('get_school_admin_data', { role: 'school_admin' });
      if (!schoolData.school) {
        setLoading(false);
        return;
      }
      setSchoolId(schoolData.school_id);
      setSchoolName(schoolData.school.name);
      
      const res = await fetchData('get_admin_chat_students', { school_id: schoolData.school_id });
      setStudents(res.students || []);
      
      // Auto-select first student if available
      if (res.students && res.students.length > 0) {
        setSelectedStudent(res.students[0]);
      }
    } catch (err) {
      console.error(err);
      toast.error('Could not load students');
    }
    setLoading(false);
  };

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

    // Subscribe to all chat message inserts in this school
    const channel = supabase
      .channel(`admin-school-chat:${schoolId}`)
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

  // Load chat history when selectedStudent changes
  useEffect(() => {
    if (selectedStudent?.id) {
      loadChatHistory(selectedStudent.id);
    }
  }, [selectedStudent]);

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

  if (loading) {
    return (
      <div className="page-shell flex items-center justify-center min-h-[60vh]">
        <div className="animate-pulse text-primary-600 font-medium">Loading EduChart...</div>
      </div>
    );
  }

  const query = chatSearch.trim().toLowerCase();
  const filteredStudents = students.filter((s) => {
    const studentName = `${s.first_name} ${s.last_name}`.toLowerCase();
    const parentNames = (s.parents || []).map((p) => p.full_name.toLowerCase()).join(' ');
    return studentName.includes(query) || parentNames.includes(query);
  });

  return (
    <div className="page-shell">
      <div className="hero-banner mb-6">
        <p className="text-white/80 text-sm font-medium uppercase tracking-wide">Administration</p>
        <h1 className="text-2xl font-bold">{schoolName || 'School Office'} EduChart</h1>
        <p className="text-white/80 text-xs">Full communication oversight and secure parent response console — powered by EduChart</p>
      </div>

      <div className="flex bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden min-h-[550px] max-h-[75vh]">
        {/* Left panel: student/parent list */}
        <div className={`w-full md:w-80 border-r border-gray-100 flex flex-col ${mobileShowThread ? 'hidden md:flex' : 'flex'}`}>
          <div className="p-4 border-b border-gray-100 bg-slate-50/50">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="search"
                value={chatSearch}
                onChange={(e) => setChatSearch(e.target.value)}
                placeholder="Search student or parent…"
                className="input pl-9 min-h-[40px] text-xs"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
            {filteredStudents.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-8">No students found</p>
            ) : (
              filteredStudents.map((s) => {
                const isSelected = selectedStudent?.id === s.id;
                const parentNames = (s.parents || []).map((p) => p.full_name).join(', ') || 'No parents linked';
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
                      <p className="text-[10px] text-slate-500 truncate mt-0.5">{parentNames}</p>
                      {s.last_message ? (
                        <p className="text-[10px] text-slate-400 truncate mt-1 italic">
                          {s.last_message.message}
                        </p>
                      ) : (
                        s.class && <p className="text-[9px] text-primary-600 font-medium mt-0.5">{s.class.name}</p>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right panel: Active chat thread */}
        <div className={`flex-1 flex flex-col bg-slate-50/40 ${mobileShowThread ? 'flex' : 'hidden md:flex'}`}>
          {selectedStudent ? (
            <>
              {/* Chat Header */}
              <div className="bg-white border-b border-gray-100 p-4 flex items-start justify-between shadow-xs gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <button
                    type="button"
                    onClick={() => setMobileShowThread(false)}
                    className="p-2 text-slate-500 hover:text-slate-700 md:hidden"
                    aria-label="Back"
                  >
                    <ChevronLeft size={20} />
                  </button>
                  <div className="min-w-0">
                    <h3 className="text-xs font-bold text-slate-900 truncate">
                      Parents of {selectedStudent.first_name} {selectedStudent.last_name}
                    </h3>
                    <div className="flex flex-col gap-1 mt-1 text-[10px] text-slate-500">
                      {selectedStudent.parents && selectedStudent.parents.map((p) => (
                        <div key={p.id} className="flex items-center gap-1.5 font-medium text-slate-600">
                          <span>• {p.full_name} ({p.relationship || 'parent'})</span>
                          {p.phone && (
                            <span className="flex items-center gap-0.5 text-primary-700 bg-primary-50 px-1 py-0.5 rounded">
                              <Phone size={10} /> {p.phone}
                            </span>
                          )}
                        </div>
                      ))}
                      {(!selectedStudent.parents || selectedStudent.parents.length === 0) && (
                        <span className="text-red-500 italic">No registered parents linked to this student</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex-1 p-4 overflow-y-auto flex flex-col gap-3 bg-slate-50">
                {chatHistory.length === 0 ? (
                  <div className="my-auto text-center py-8">
                    <MessageSquare size={36} className="mx-auto text-slate-300 mb-2" />
                    <p className="text-xs text-slate-400 font-medium">No EduChart history yet</p>
                    <p className="text-[10px] text-slate-400 mt-1 max-w-[220px] mx-auto">
                      Send a message below to reach the parent directly in their dashboard.
                    </p>
                  </div>
                ) : (
                  chatHistory.map((m: any) => {
                    const isParentSender = (selectedStudent.parents || []).some((p) => p.id === m.sender_id || p.full_name === m.sender_name);
                    const isOutbound = !isParentSender;

                    const avatarSrc = isOutbound
                      ? (session?.avatar_url ? photoSrc(session.avatar_url) : null)
                      : (m.sender_avatar ? photoSrc(m.sender_avatar) : null);
                    const senderInitial = (isOutbound
                      ? (session?.full_name?.[0] || 'A')
                      : (m.sender_name?.[0] || 'P')
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
                              ? 'ml-auto bg-primary-600 text-white rounded-tr-none'
                              : 'mr-auto bg-white text-gray-800 border border-gray-100 rounded-tl-none'
                          }`}
                        >
                          <span className={`text-[9px] font-bold uppercase mb-1 ${isOutbound ? 'text-white/80' : 'text-primary-700'}`}>
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
                          <ChatMediaBubble mediaUrl={m.media_url} mediaType={m.media_type} photoSrc={photoSrc} />
                          <p className="text-xs leading-relaxed whitespace-pre-line break-words">{m.message}</p>
                          <span className={`text-[8px] mt-1 text-right block ${isOutbound ? 'text-white/70' : 'text-gray-400'}`}>
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
                            : "Type your message to the parent..."
                    }
                    maxLength={500}
                    disabled={isRecordingVoice || (recipientType === 'parent' && (!selectedStudent.parents || selectedStudent.parents.length === 0))}
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
              <p className="text-xs text-slate-400 font-medium">Select a student/parent to view EduChart history</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
