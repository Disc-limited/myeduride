// @ts-nocheck
'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import {
  MessageSquare,
  Users,
  Shield,
  Building2,
  Send,
  Paperclip,
  Check,
  CheckCheck,
  Clock,
  MapPin,
  Phone,
  AlertTriangle,
  RefreshCw,
  Search,
  ChevronRight,
  ArrowLeft,
  Sparkles,
  Zap,
  Camera,
  X,
  Radio,
  ExternalLink
} from 'lucide-react';
import { toast } from 'sonner';

interface EscortEduChatViewProps {
  initialStudentId?: string | null;
  onBackToRoster?: () => void;
}

export default function EscortEduChatView({
  initialStudentId,
  onBackToRoster,
}: EscortEduChatViewProps) {
  // Navigation tabs: 'parents' | 'gate_officers' | 'city_manager'
  const [activeChannel, setActiveChannel] = useState<'parents' | 'gate_officers' | 'city_manager'>('parents');
  
  // Selected thread identifiers
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(initialStudentId || null);
  const [selectedSchoolId, setSelectedSchoolId] = useState<string | null>(null);

  // Chat Data from API
  const [channelsData, setChannelsData] = useState<{
    parents: any[];
    gate_officers: any[];
    city_manager: any;
  }>({
    parents: [],
    gate_officers: [],
    city_manager: null,
  });
  const [unreadTotals, setUnreadTotals] = useState({ parents: 0, gate: 0, city_manager: 0, total: 0 });
  const [quickPresets, setQuickPresets] = useState<any[]>([]);
  const [escortInfo, setEscortInfo] = useState<any>(null);

  // Active Thread Message Stream
  const [messages, setMessages] = useState<any[]>([]);
  const [isLoadingChannels, setIsLoadingChannels] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [messageInput, setMessageInput] = useState('');
  const [mediaFileUrl, setMediaFileUrl] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Mobile responsive view state: On mobile, viewing either 'list' or 'chat'
  const [mobileView, setMobileView] = useState<'list' | 'chat'>('list');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Scroll to bottom helper
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // 1. Fetch channels overview
  const loadChannels = async (silent = false) => {
    if (!silent) setIsLoadingChannels(true);
    try {
      const res = await fetch('/api/escorts/chat');
      const data = await res.json();
      if (data?.success) {
        setChannelsData(data.channels || { parents: [], gate_officers: [], city_manager: null });
        setUnreadTotals(data.unread_totals || { parents: 0, gate: 0, city_manager: 0, total: 0 });
        setQuickPresets(data.quick_presets || []);
        setEscortInfo(data.escort || null);

        // Preselect initial student or first available parent thread
        if (!selectedStudentId && data.channels?.parents?.length > 0) {
          setSelectedStudentId(data.channels.parents[0].id);
          setSelectedSchoolId(data.channels.parents[0].school_id);
        }
      }
    } catch (err) {
      console.warn('[EscortEduChatView] loadChannels error:', err);
    } finally {
      if (!silent) setIsLoadingChannels(false);
    }
  };

  // 2. Fetch conversation history for active selected thread
  const loadMessages = async (silent = false) => {
    if (!silent) setIsLoadingMessages(true);
    try {
      let params: any = { channel: activeChannel };
      if (activeChannel === 'parents' && selectedStudentId) {
        params.student_id = selectedStudentId;
      } else if (activeChannel === 'gate_officers' && selectedSchoolId) {
        params.school_id = selectedSchoolId;
      }

      const res = await fetch('/api/escorts/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'history', params }),
      });
      const data = await res.json();
      if (data?.success && Array.isArray(data.messages)) {
        setMessages(data.messages);
      }
    } catch (err) {
      console.warn('[EscortEduChatView] loadMessages error:', err);
    } finally {
      if (!silent) setIsLoadingMessages(false);
    }
  };

  // Initial load
  useEffect(() => {
    loadChannels();
  }, []);

  // Sync initialStudentId prop if changed
  useEffect(() => {
    if (initialStudentId) {
      setSelectedStudentId(initialStudentId);
      setActiveChannel('parents');
      setMobileView('chat');
    }
  }, [initialStudentId]);

  // Load messages when selected thread or active channel changes
  useEffect(() => {
    if (activeChannel === 'city_manager') {
      loadMessages();
    } else if (activeChannel === 'parents' && selectedStudentId) {
      loadMessages();
    } else if (activeChannel === 'gate_officers' && selectedSchoolId) {
      loadMessages();
    }
  }, [activeChannel, selectedStudentId, selectedSchoolId]);

  // Auto-scroll on new messages
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Periodic polling every 5s for real-time thread synchronization
  useEffect(() => {
    const interval = setInterval(() => {
      loadChannels(true);
      if (
        activeChannel === 'city_manager' ||
        (activeChannel === 'parents' && selectedStudentId) ||
        (activeChannel === 'gate_officers' && selectedSchoolId)
      ) {
        loadMessages(true);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [activeChannel, selectedStudentId, selectedSchoolId]);

  // Send message
  const handleSendMessage = async (customContent?: string) => {
    const contentToSend = (customContent !== undefined ? customContent : messageInput).trim();
    if (!contentToSend && !mediaFileUrl) return;

    setIsSending(true);
    try {
      const payload: any = {
        channel: activeChannel,
        content: contentToSend,
        media_url: mediaFileUrl,
        media_type: mediaFileUrl ? 'image' : null,
      };

      if (activeChannel === 'parents') {
        payload.student_id = selectedStudentId;
        payload.school_id = selectedSchoolId;
      } else if (activeChannel === 'gate_officers') {
        payload.school_id = selectedSchoolId;
        payload.student_id = selectedStudentId || undefined;
      } else if (activeChannel === 'city_manager') {
        payload.student_id = selectedStudentId || undefined;
        payload.school_id = selectedSchoolId || undefined;
      }

      const res = await fetch('/api/escorts/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'send', params: payload }),
      });

      const data = await res.json();
      if (data?.success) {
        setMessageInput('');
        setMediaFileUrl(null);
        toast.success('Message delivered successfully');
        // Instantly refresh thread
        loadMessages(true);
        loadChannels(true);
      } else {
        toast.error(data?.error || 'Failed to send message');
      }
    } catch (err: any) {
      toast.error('Network error sending message');
    } finally {
      setIsSending(false);
    }
  };

  // Quick preset click
  const handleSelectPreset = (preset: any) => {
    handleSendMessage(preset.text);
  };

  // Image attachment upload simulation
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size must be under 5MB');
      return;
    }

    // In a full implementation, this uploads via /api/upload. Here we create an object URL or base64 preview
    const reader = new FileReader();
    reader.onload = () => {
      setMediaFileUrl(reader.result as string);
      toast.success('Image attached');
    };
    reader.readAsDataURL(file);
  };

  // Find current thread entity
  const currentParentThread = useMemo(() => {
    return channelsData.parents.find((p) => p.student_id === selectedStudentId) || channelsData.parents[0];
  }, [channelsData.parents, selectedStudentId]);

  const currentGateThread = useMemo(() => {
    return channelsData.gate_officers.find((g) => g.school_id === selectedSchoolId) || channelsData.gate_officers[0];
  }, [channelsData.gate_officers, selectedSchoolId]);

  // Filtered contacts list
  const filteredParents = useMemo(() => {
    if (!searchQuery.trim()) return channelsData.parents;
    const q = searchQuery.toLowerCase();
    return channelsData.parents.filter(
      (p) =>
        p.student_name.toLowerCase().includes(q) ||
        p.parent_name.toLowerCase().includes(q) ||
        p.school_name.toLowerCase().includes(q) ||
        p.pickup_address.toLowerCase().includes(q)
    );
  }, [channelsData.parents, searchQuery]);

  const filteredGates = useMemo(() => {
    if (!searchQuery.trim()) return channelsData.gate_officers;
    const q = searchQuery.toLowerCase();
    return channelsData.gate_officers.filter(
      (g) =>
        g.gate_name.toLowerCase().includes(q) ||
        g.officer_names.toLowerCase().includes(q)
    );
  }, [channelsData.gate_officers, searchQuery]);

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[760px] max-h-[88vh]">
      {/* 1. TOP HEADER: BRANDING & CHANNEL NAVIGATION */}
      <div className="bg-[#0A1128] text-white p-4 border-b border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-400 shrink-0">
            <MessageSquare size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-black text-base tracking-tight text-white">EduChat Operations Mesh</h3>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                LIVE
              </span>
            </div>
            <p className="text-xs text-slate-400 font-medium">
              Multi-channel transit communications: Parents · School Gates · City Operations
            </p>
          </div>
        </div>

        {/* CHANNEL SWITCHER PILLS */}
        <div className="flex items-center gap-1.5 bg-slate-900/90 p-1.5 rounded-2xl border border-slate-700/60 self-start md:self-auto overflow-x-auto max-w-full">
          {/* PARENTS */}
          <button
            type="button"
            onClick={() => {
              setActiveChannel('parents');
              setMobileView('list');
              if (channelsData.parents.length > 0 && !selectedStudentId) {
                setSelectedStudentId(channelsData.parents[0].id);
                setSelectedSchoolId(channelsData.parents[0].school_id);
              }
            }}
            className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
              activeChannel === 'parents'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Users size={14} />
            <span>Parents</span>
            {unreadTotals.parents > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-rose-500 text-white animate-pulse">
                {unreadTotals.parents}
              </span>
            )}
          </button>

          {/* GATE OFFICERS */}
          <button
            type="button"
            onClick={() => {
              setActiveChannel('gate_officers');
              setMobileView('list');
              if (channelsData.gate_officers.length > 0 && !selectedSchoolId) {
                setSelectedSchoolId(channelsData.gate_officers[0].school_id);
              }
            }}
            className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
              activeChannel === 'gate_officers'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Building2 size={14} />
            <span>School Gates</span>
            {unreadTotals.gate > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-rose-500 text-white animate-pulse">
                {unreadTotals.gate}
              </span>
            )}
          </button>

          {/* CITY MANAGER */}
          <button
            type="button"
            onClick={() => {
              setActiveChannel('city_manager');
              setMobileView('chat'); // Single channel, direct to chat
            }}
            className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
              activeChannel === 'city_manager'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Shield size={14} />
            <span>City Manager</span>
            {unreadTotals.city_manager > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-rose-500 text-white animate-pulse">
                {unreadTotals.city_manager}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* 2. CHAT WORKSPACE (SPLIT VIEW: CONTACTS ON LEFT, STREAM ON RIGHT) */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* LEFT COLUMN: CONTACTS LIST (Hidden on mobile if in 'chat' mode) */}
        <div
          className={`w-full md:w-80 lg:w-96 border-r border-slate-200 bg-slate-50 flex flex-col shrink-0 transition-all ${
            mobileView === 'chat' && activeChannel !== 'city_manager' ? 'hidden md:flex' : 'flex'
          }`}
        >
          {/* SEARCH & FILTERS */}
          <div className="p-3 border-b border-slate-200 bg-white">
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={
                  activeChannel === 'parents'
                    ? 'Search student or parent...'
                    : activeChannel === 'gate_officers'
                    ? 'Search campus gates...'
                    : 'City Control Tower...'
                }
                className="w-full pl-9 pr-4 py-2 bg-slate-100 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* CONTACTS LIST */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {/* PARENTS LIST */}
            {activeChannel === 'parents' && (
              <>
                {filteredParents.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-xs">
                    <Users size={32} className="mx-auto mb-2 text-slate-300" />
                    <p className="font-bold text-slate-700">No student passengers found</p>
                    <p className="mt-1">Students assigned to you by the school or City Manager will appear here.</p>
                  </div>
                ) : (
                  filteredParents.map((parentItem) => {
                    const isSelected = selectedStudentId === parentItem.student_id;
                    return (
                      <button
                        key={parentItem.student_id}
                        type="button"
                        onClick={() => {
                          setSelectedStudentId(parentItem.student_id);
                          setSelectedSchoolId(parentItem.school_id);
                          setMobileView('chat');
                        }}
                        className={`w-full p-3.5 text-left transition-all flex items-start gap-3 cursor-pointer ${
                          isSelected
                            ? 'bg-blue-50/90 border-l-4 border-blue-600'
                            : 'hover:bg-slate-100/80 bg-white'
                        }`}
                      >
                        {/* Student Avatar */}
                        <div className="relative shrink-0">
                          {parentItem.student_photo ? (
                            <img
                              src={parentItem.student_photo}
                              alt={parentItem.student_name}
                              className="w-11 h-11 rounded-2xl object-cover border border-slate-200 shadow-2xs"
                            />
                          ) : (
                            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-black text-sm flex items-center justify-center shadow-2xs">
                              {parentItem.student_name.slice(0, 2).toUpperCase()}
                            </div>
                          )}
                          <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-white"></span>
                        </div>

                        {/* Student / Parent Details */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1">
                            <h4 className="font-bold text-xs text-slate-900 truncate">
                              {parentItem.student_name}
                            </h4>
                            {parentItem.last_message && (
                              <span className="text-[10px] text-slate-400 font-mono shrink-0">
                                {new Date(parentItem.last_message.created_at).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                            )}
                          </div>

                          <p className="text-[11px] text-blue-700 font-semibold truncate mt-0.5">
                            {parentItem.parent_name} ({parentItem.student_class})
                          </p>

                          <div className="flex items-center justify-between gap-2 mt-1">
                            <p className="text-[11px] text-slate-500 truncate flex items-center gap-1">
                              <MapPin size={11} className="text-slate-400 shrink-0" />
                              <span className="truncate">{parentItem.pickup_address}</span>
                            </p>
                            {parentItem.unread_count > 0 && (
                              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-black bg-blue-600 text-white shrink-0">
                                {parentItem.unread_count}
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })
                )}
              </>
            )}

            {/* GATE OFFICERS LIST */}
            {activeChannel === 'gate_officers' && (
              <>
                {filteredGates.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-xs">
                    <Building2 size={32} className="mx-auto mb-2 text-slate-300" />
                    <p className="font-bold text-slate-700">No school gates linked</p>
                    <p className="mt-1">Schools along your route will appear here.</p>
                  </div>
                ) : (
                  filteredGates.map((gateItem) => {
                    const isSelected = selectedSchoolId === gateItem.school_id;
                    return (
                      <button
                        key={gateItem.id}
                        type="button"
                        onClick={() => {
                          setSelectedSchoolId(gateItem.school_id);
                          setMobileView('chat');
                        }}
                        className={`w-full p-3.5 text-left transition-all flex items-start gap-3 cursor-pointer ${
                          isSelected
                            ? 'bg-amber-50/90 border-l-4 border-amber-600'
                            : 'hover:bg-slate-100/80 bg-white'
                        }`}
                      >
                        <div className="w-11 h-11 rounded-2xl bg-amber-100 text-amber-900 font-black text-sm flex items-center justify-center shrink-0 border border-amber-200">
                          <Building2 size={20} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1">
                            <h4 className="font-bold text-xs text-slate-900 truncate">
                              {gateItem.gate_name}
                            </h4>
                            {gateItem.last_message && (
                              <span className="text-[10px] text-slate-400 font-mono shrink-0">
                                {new Date(gateItem.last_message.created_at).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                            )}
                          </div>

                          <p className="text-[11px] text-amber-800 font-semibold truncate mt-0.5">
                            👮 {gateItem.officer_names}
                          </p>

                          <div className="flex items-center justify-between gap-2 mt-1">
                            <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                              {gateItem.status}
                            </span>
                            {gateItem.unread_count > 0 && (
                              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-black bg-amber-600 text-white shrink-0">
                                {gateItem.unread_count}
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })
                )}
              </>
            )}

            {/* CITY MANAGER CONTACT CARD (Summary info) */}
            {activeChannel === 'city_manager' && (
              <div className="p-4 bg-white space-y-4">
                <div className="p-4 rounded-2xl bg-purple-50 border border-purple-200">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-purple-600 text-white flex items-center justify-center font-black shrink-0 shadow-xs">
                      <Shield size={20} />
                    </div>
                    <div>
                      <h4 className="font-black text-xs text-purple-950">
                        {channelsData.city_manager?.name || 'City Operations Tower'}
                      </h4>
                      <p className="text-[11px] text-purple-800 font-medium">
                        {channelsData.city_manager?.operating_zone || 'Lagos Metropolitan'}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-purple-200/60 text-[11px] text-purple-900 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Status:</span>
                      <span className="font-bold text-emerald-700">● 24/7 Monitoring Active</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Emergency Pool:</span>
                      <span className="font-bold text-purple-900">Enrolled & Ready</span>
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-600 space-y-1.5">
                  <span className="font-bold text-slate-900 block">Emergency Dispatch Protocol:</span>
                  <p className="text-[11px] leading-relaxed">
                    Direct channel for transit incidents, vehicle roadside assistance, rerouting approvals, and emergency standby escort dispatch. All communications are logged to the metropolitan audit ledger.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: ACTIVE THREAD & MESSAGE STREAM */}
        <div
          className={`flex-1 flex flex-col bg-slate-100 overflow-hidden ${
            mobileView === 'list' && activeChannel !== 'city_manager' ? 'hidden md:flex' : 'flex'
          }`}
        >
          {/* THREAD ACTIVE HEADER */}
          <div className="p-3 sm:p-4 bg-white border-b border-slate-200 flex items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              {/* Back to list button (mobile only) */}
              <button
                type="button"
                onClick={() => setMobileView('list')}
                className="md:hidden p-2 -ml-1 text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-100"
              >
                <ArrowLeft size={18} />
              </button>

              {activeChannel === 'parents' && currentParentThread && (
                <>
                  <div className="relative shrink-0">
                    {currentParentThread.student_photo ? (
                      <img
                        src={currentParentThread.student_photo}
                        alt={currentParentThread.student_name}
                        className="w-10 h-10 rounded-2xl object-cover border border-slate-200"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white font-bold flex items-center justify-center text-xs">
                        {currentParentThread.student_name.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-black text-sm text-slate-900 truncate">
                      {currentParentThread.student_name}
                    </h4>
                    <p className="text-xs text-slate-500 truncate flex items-center gap-1">
                      <span>Parent: <strong className="text-blue-700 font-bold">{currentParentThread.parent_name}</strong></span>
                      <span>·</span>
                      <span>{currentParentThread.school_name}</span>
                    </p>
                  </div>
                </>
              )}

              {activeChannel === 'gate_officers' && currentGateThread && (
                <>
                  <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-900 flex items-center justify-center shrink-0 border border-amber-200">
                    <Building2 size={20} />
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-black text-sm text-slate-900 truncate">
                      {currentGateThread.gate_name}
                    </h4>
                    <p className="text-xs text-slate-500 truncate">
                      Security Station: <strong className="text-amber-800 font-bold">{currentGateThread.officer_names}</strong>
                    </p>
                  </div>
                </>
              )}

              {activeChannel === 'city_manager' && (
                <>
                  <div className="w-10 h-10 rounded-2xl bg-purple-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                    <Shield size={20} />
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-black text-sm text-slate-900 truncate">
                      City Operations Control Tower
                    </h4>
                    <p className="text-xs text-slate-500 truncate">
                      Emergency Metropolitan Pool & Dispatch Controller
                    </p>
                  </div>
                </>
              )}
            </div>

            {/* ACTION BUTTONS IN THREAD HEADER */}
            <div className="flex items-center gap-2 shrink-0">
              {activeChannel === 'parents' && currentParentThread?.parent_phone && (
                <a
                  href={`tel:${currentParentThread.parent_phone}`}
                  className="px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold flex items-center gap-1.5 transition-all"
                >
                  <Phone size={13} />
                  <span className="hidden sm:inline">Call Parent</span>
                </a>
              )}

              <button
                type="button"
                onClick={() => {
                  loadMessages();
                  loadChannels(true);
                }}
                className="p-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-all cursor-pointer"
                title="Refresh messages"
              >
                <RefreshCw size={15} className={isLoadingMessages ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>

          {/* QUICK-ACTION TRANSIT PRESETS BAR */}
          <div className="bg-white/80 backdrop-blur-xs px-3 py-2 border-b border-slate-200 flex items-center gap-2 overflow-x-auto shrink-0 scrollbar-none">
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider shrink-0 flex items-center gap-1">
              <Zap size={11} className="text-amber-500" /> Quick Transit:
            </span>
            {quickPresets.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => handleSelectPreset(preset)}
                className="px-2.5 py-1 rounded-full bg-slate-100 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300 border border-slate-200 text-[11px] font-bold text-slate-700 whitespace-nowrap transition-all cursor-pointer shrink-0"
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* MESSAGE STREAM BUBBLES */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3.5">
            {isLoadingMessages && messages.length === 0 ? (
              <div className="flex items-center justify-center h-full text-slate-400 text-xs gap-2">
                <RefreshCw size={18} className="animate-spin text-blue-600" />
                <span>Loading live thread...</span>
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center p-6 text-slate-400">
                <div className="w-12 h-12 rounded-full bg-slate-200 flex items-center justify-center text-slate-400 mb-2">
                  <MessageSquare size={22} />
                </div>
                <h5 className="font-bold text-slate-700 text-sm">No messages yet</h5>
                <p className="text-xs text-slate-500 max-w-xs mt-1">
                  Send a message or tap one of the Quick Transit buttons above to update the{' '}
                  {activeChannel === 'parents' ? 'parent' : activeChannel === 'gate_officers' ? 'gate officer' : 'City Manager'}.
                </p>
              </div>
            ) : (
              messages.map((msg) => {
                const isEscortSender =
                  msg.sender_id === escortInfo?.id ||
                  msg.sender_name?.toLowerCase().includes('escort') ||
                  msg.sender_id === 'escort-operator';

                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isEscortSender ? 'items-end' : 'items-start'}`}
                  >
                    <div className="flex items-end gap-2 max-w-[85%] sm:max-w-[70%]">
                      {/* Avatar on left for received */}
                      {!isEscortSender && (
                        <div className="w-7 h-7 rounded-xl bg-slate-300 text-slate-700 font-black text-[10px] flex items-center justify-center shrink-0 mb-1">
                          {msg.sender_name?.slice(0, 1) || 'U'}
                        </div>
                      )}

                      <div
                        className={`p-3.5 rounded-3xl text-xs leading-relaxed shadow-2xs ${
                          isEscortSender
                            ? 'bg-[#0A1128] text-white rounded-br-xs'
                            : 'bg-white text-slate-900 border border-slate-200/80 rounded-bl-xs'
                        }`}
                      >
                        {/* Sender Label */}
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span
                            className={`font-black text-[10px] ${
                              isEscortSender ? 'text-blue-300' : 'text-blue-700'
                            }`}
                          >
                            {isEscortSender ? 'You (Escort)' : msg.sender_name || 'Contact'}
                          </span>
                        </div>

                        {/* Message Media Photo if present */}
                        {msg.media_url && (
                          <div className="mb-2 rounded-2xl overflow-hidden border border-white/20 max-w-xs">
                            <img
                              src={msg.media_url}
                              alt="Attached photo"
                              className="w-full h-auto object-cover max-h-48 cursor-pointer hover:opacity-95"
                              onClick={() => window.open(msg.media_url, '_blank')}
                            />
                          </div>
                        )}

                        {/* Content text */}
                        <p className="whitespace-pre-wrap font-medium">{msg.content}</p>

                        {/* Timestamp and Read Status */}
                        <div
                          className={`flex items-center justify-end gap-1 mt-1 text-[9px] ${
                            isEscortSender ? 'text-slate-400' : 'text-slate-400'
                          }`}
                        >
                          <span>
                            {new Date(msg.created_at).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                          {isEscortSender && (
                            <span>
                              {msg.is_read ? (
                                <CheckCheck size={12} className="text-emerald-400" />
                              ) : (
                                <Check size={12} className="text-slate-400" />
                              )}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* ATTACHED IMAGE PREVIEW BAR */}
          {mediaFileUrl && (
            <div className="px-4 py-2 bg-slate-200/80 border-t border-slate-300 flex items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-2">
                <img
                  src={mediaFileUrl}
                  alt="Attachment preview"
                  className="w-10 h-10 rounded-xl object-cover border border-white"
                />
                <span className="text-xs font-bold text-slate-800">Photo attached ready to send</span>
              </div>
              <button
                type="button"
                onClick={() => setMediaFileUrl(null)}
                className="p-1 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-slate-300"
              >
                <X size={16} />
              </button>
            </div>
          )}

          {/* INPUT BAR (Touch-friendly 46px min target) */}
          <div className="p-3 bg-white border-t border-slate-200 shrink-0">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="flex items-center gap-2"
            >
              {/* File Attachment Button */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-11 h-11 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-all cursor-pointer shrink-0"
                title="Attach photo / camera capture"
              >
                <Camera size={18} />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleFileUpload}
              />

              {/* Text Input */}
              <input
                type="text"
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                placeholder={
                  activeChannel === 'parents'
                    ? 'Message student parent...'
                    : activeChannel === 'gate_officers'
                    ? 'Notify campus gate security...'
                    : 'Transmitting operational alert to City Manager...'
                }
                className="flex-1 min-h-[46px] px-4 bg-slate-100 border border-slate-200 rounded-2xl text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
              />

              {/* Send Button */}
              <button
                type="submit"
                disabled={isSending || (!messageInput.trim() && !mediaFileUrl)}
                className={`min-h-[46px] min-w-[46px] px-4 rounded-2xl font-black text-xs flex items-center justify-center gap-1.5 transition-all shadow-sm cursor-pointer ${
                  !messageInput.trim() && !mediaFileUrl
                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-600/20'
                }`}
              >
                <Send size={15} className={isSending ? 'animate-spin' : ''} />
                <span className="hidden sm:inline">Send</span>
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
