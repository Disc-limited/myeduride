// @ts-nocheck
'use client';

import { useState, useEffect } from 'react';
import {
  Send,
  X,
  Bell,
  Check,
  Users,
  Calendar,
  AlertTriangle,
  FileText,
  Paperclip,
  Mail,
  History,
  CheckCircle2,
  Sparkles,
  ShieldAlert,
  Megaphone
} from 'lucide-react';
import { toast } from 'sonner';

interface SendNoticeModalProps {
  isOpen: boolean;
  onClose: () => void;
  schoolId?: string;
  schoolName?: string;
}

const NOTICE_CATEGORIES = [
  { id: 'public_holiday', label: 'Public Holiday', icon: Calendar, color: 'bg-amber-100 text-amber-800 border-amber-300' },
  { id: 'general', label: 'General Notice', icon: Megaphone, color: 'bg-sky-100 text-sky-800 border-sky-300' },
  { id: 'urgent', label: 'Urgent Advisory', icon: AlertTriangle, color: 'bg-rose-100 text-rose-800 border-rose-300' },
  { id: 'event', label: 'School Event', icon: Sparkles, color: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  { id: 'emergency', label: 'Emergency Alert', icon: ShieldAlert, color: 'bg-purple-100 text-purple-800 border-purple-300' },
];

const TARGET_ROLES = [
  { id: 'parents', label: 'Parents & Guardians', desc: 'All registered parent accounts' },
  { id: 'students', label: 'Students', desc: 'All student accounts & portals' },
  { id: 'teachers', label: 'Teachers & School Staff', desc: 'All class teachers & staff' },
  { id: 'escorts', label: 'Escorts & Transit Drivers', desc: 'All verified school escorts' },
  { id: 'gate_officers', label: 'Gate Managers & Officers', desc: 'All gate security personnel' },
];

export default function SendNoticeModal({
  isOpen,
  onClose,
  schoolId,
  schoolName,
}: SendNoticeModalProps) {
  const [activeTab, setActiveTab] = useState<'compose' | 'history'>('compose');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [category, setCategory] = useState('public_holiday');
  const [selectedAudiences, setSelectedAudiences] = useState<string[]>(['parents', 'teachers', 'escorts', 'gate_officers']);
  const [sendEmail, setSendEmail] = useState(true);
  const [mediaUrl, setMediaUrl] = useState('');
  const [sending, setSending] = useState(false);

  const [historyList, setHistoryList] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    if (isOpen && activeTab === 'history' && schoolId) {
      fetchHistory();
    }
  }, [isOpen, activeTab, schoolId]);

  const fetchHistory = async () => {
    if (!schoolId) return;
    setLoadingHistory(true);
    try {
      const res = await fetch(`/api/school-admin/notices?school_id=${encodeURIComponent(schoolId)}`);
      const data = await res.json();
      if (res.ok && data.notices) {
        setHistoryList(data.notices);
      }
    } catch (err) {
      console.warn('Failed to load notice history:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  if (!isOpen) return null;

  const toggleAudience = (roleId: string) => {
    setSelectedAudiences((prev) =>
      prev.includes(roleId) ? prev.filter((r) => r !== roleId) : [...prev, roleId]
    );
  };

  const handleSelectAll = () => {
    if (selectedAudiences.length === TARGET_ROLES.length) {
      setSelectedAudiences([]);
    } else {
      setSelectedAudiences(TARGET_ROLES.map((r) => r.id));
    }
  };

  const handleSendNotice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) {
      toast.error('Please enter a notice title and message content');
      return;
    }
    if (selectedAudiences.length === 0) {
      toast.error('Please select at least one target audience category');
      return;
    }

    setSending(true);
    try {
      const res = await fetch('/api/school-admin/notices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          school_id: schoolId,
          title,
          message,
          category,
          target_audiences: selectedAudiences,
          send_email: sendEmail,
          media_url: mediaUrl || null,
        }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to dispatch notice');
      }

      toast.success(data.message || 'School notice dispatched successfully!');
      setTitle('');
      setMessage('');
      setMediaUrl('');
      setActiveTab('history');
      fetchHistory();
    } catch (err: any) {
      toast.error(err.message || 'Failed to dispatch notice');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-2xl w-full p-6 md:p-8 shadow-2xl border border-slate-200 text-slate-900 space-y-6 relative max-h-[90vh] flex flex-col">
        
        {/* MODAL HEADER */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-sky-100 text-sky-700 flex items-center justify-center font-bold shadow-xs">
              <Send size={20} />
            </div>
            <div>
              <h2 className="text-lg md:text-xl font-black text-slate-900 leading-tight">School Notice Console</h2>
              <p className="text-xs text-slate-500 font-medium">
                Send vital announcements (Public Holidays, Closures, Advisories) to all school users.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* TAB SWITCHER */}
        <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-2xl shrink-0 text-xs font-bold">
          <button
            type="button"
            onClick={() => setActiveTab('compose')}
            className={`flex-1 py-2 px-4 rounded-xl transition-all flex items-center justify-center gap-2 ${
              activeTab === 'compose' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Megaphone size={15} />
            <span>Compose Notice</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`flex-1 py-2 px-4 rounded-xl transition-all flex items-center justify-center gap-2 ${
              activeTab === 'history' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <History size={15} />
            <span>Sent History Log</span>
          </button>
        </div>

        {/* TAB 1: COMPOSE FORM */}
        {activeTab === 'compose' && (
          <form onSubmit={handleSendNotice} className="space-y-5 overflow-y-auto pr-1 flex-1">
            
            {/* CATEGORY SELECTION */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Notice Category
              </label>
              <div className="flex flex-wrap gap-2">
                {NOTICE_CATEGORIES.map((cat) => {
                  const Icon = cat.icon;
                  const isSelected = category === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setCategory(cat.id)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-extrabold transition-all ${
                        isSelected
                          ? `${cat.color} ring-2 ring-emerald-500/30 scale-[1.02]`
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <Icon size={14} />
                      <span>{cat.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* TITLE INPUT */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Notice Subject / Title *
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Public Holiday Announcement - Mid-Term Break & School Closure"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>

            {/* TARGET AUDIENCE CHECKBOX MATRIX */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Target Audiences ({selectedAudiences.length} Selected) *
                </label>
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="text-[11px] font-bold text-emerald-600 hover:underline"
                >
                  {selectedAudiences.length === TARGET_ROLES.length ? 'Deselect All' : 'Select All Community'}
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {TARGET_ROLES.map((role) => {
                  const isChecked = selectedAudiences.includes(role.id);
                  return (
                    <label
                      key={role.id}
                      className={`flex items-start gap-3 p-3 rounded-2xl border cursor-pointer transition-all ${
                        isChecked
                          ? 'bg-emerald-50/60 border-emerald-300 text-emerald-950'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleAudience(role.id)}
                        className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500"
                      />
                      <div>
                        <p className="text-xs font-bold leading-tight">{role.label}</p>
                        <p className="text-[10px] text-slate-500 mt-0.5">{role.desc}</p>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* MESSAGE TEXTAREA */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Notice Information / Message Body *
              </label>
              <textarea
                rows={4}
                required
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Compose the vital notice information here. For example: Dear Parents and Staff, Please be informed that the school will observe a public holiday on Friday 1st October. Normal school transport operations resume on Monday."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs text-slate-900 font-medium leading-relaxed focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>

            {/* OPTIONAL ATTACHMENT URL */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Attachment / Document Link (Optional)
              </label>
              <div className="relative">
                <Paperclip size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="url"
                  value={mediaUrl}
                  onChange={(e) => setMediaUrl(e.target.value)}
                  placeholder="https://myeduride.ng/notices/holiday-circular.pdf"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-800 font-medium focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            {/* EMAIL BROADCAST SWITCH */}
            <div className="flex items-center justify-between bg-slate-50 border border-slate-200 p-3.5 rounded-2xl">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                  <Mail size={16} />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-900">Send Email Notification Broadcast</p>
                  <p className="text-[10px] text-slate-500">Dispatch copies directly to target recipient email addresses.</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={sendEmail}
                  onChange={(e) => setSendEmail(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600" />
              </label>
            </div>

            {/* SUBMIT ACTION BUTTON */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={sending}
                className="px-6 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-extrabold text-xs shadow-md flex items-center gap-2 transition-all disabled:opacity-50"
              >
                <Send size={15} />
                <span>{sending ? 'Dispatching Notice...' : 'Broadcast School Notice'}</span>
              </button>
            </div>

          </form>
        )}

        {/* TAB 2: SENT HISTORY LOG */}
        {activeTab === 'history' && (
          <div className="space-y-4 overflow-y-auto pr-1 flex-1">
            {loadingHistory ? (
              <div className="py-12 text-center text-xs text-slate-400 font-semibold animate-pulse">
                Loading sent notices log...
              </div>
            ) : historyList.length === 0 ? (
              <div className="py-12 text-center text-slate-400 space-y-2">
                <History size={36} className="mx-auto text-slate-300" />
                <p className="text-sm font-bold text-slate-700">No Sent Notices Recorded</p>
                <p className="text-xs text-slate-500">Notices dispatched via the console will log here with target analytics.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {historyList.map((item) => (
                  <div key={item.id} className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="bg-sky-100 text-sky-800 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider border border-sky-300">
                        {item.category || 'General Notice'}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {new Date(item.created_at).toLocaleString()}
                      </span>
                    </div>

                    <h4 className="font-bold text-slate-900 text-sm">{item.title}</h4>
                    <p className="text-slate-600 leading-relaxed whitespace-pre-line">{item.message}</p>

                    <div className="flex flex-wrap items-center justify-between pt-2 border-t border-slate-200/60 text-[11px] text-slate-500 font-medium">
                      <span>Recipients: <strong className="text-emerald-700">{item.recipient_count} users</strong></span>
                      <span>Target: <strong className="text-slate-700">{(item.target_audiences || []).join(', ')}</strong></span>
                      {item.send_email && <span className="text-blue-600 font-bold">✓ Email Sent</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
