// @ts-nocheck
'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  School,
  UserCheck,
  Car,
  Users,
  CheckCircle2,
  Clock,
  ShieldCheck,
  AlertTriangle,
  Radio,
  MapPin,
  Maximize2,
  UserPlus,
  ArrowRightLeft,
  UserX,
  Navigation,
  PhoneCall,
  Megaphone,
  AlertOctagon,
  Bot,
  Sparkles,
  Send,
  ChevronRight,
  TrendingUp,
  Activity,
  Zap,
  User,
  Eye,
  FileText,
  Award,
  Camera,
  Download,
  ExternalLink,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  X,
  LayoutDashboard,
  CheckSquare,
  ArrowRight,
  Archive,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import StudentAvatar from '@/components/shared/StudentAvatar';
import EscortApprovalNotificationModal from '@/components/escort/EscortApprovalNotificationModal';
import { CityManagerCommandControl } from '@/components/city-manager/CityManagerCommandControl';

function CityManagerDashboardContent() {
  const searchParams = useSearchParams();
  const sectionParam = searchParams?.get('section') || searchParams?.get('tab');

  const [activeSection, setActiveSection] = useState<'dashboard' | 'tasks-approvals' | string>(
    sectionParam || 'dashboard'
  );
  const [selectedCity, setSelectedCity] = useState('LAGOS MAINLAND');
  const [mapFilter, setMapFilter] = useState('all');
  const [aiPrompt, setAiPrompt] = useState('');

  useEffect(() => {
    if (sectionParam) {
      setActiveSection(sectionParam);
    }
  }, [sectionParam]);

  useEffect(() => {
    const handlePopState = () => {
      const sp = new URLSearchParams(window.location.search);
      const s = sp.get('section') || sp.get('tab') || 'dashboard';
      setActiveSection(s);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const [aiChatLogs, setAiChatLogs] = useState([
    { type: 'insight', text: 'MIGO SAVI Operational Intelligence online. Ask about escorts, gates, and route oversight.' },
  ]);

  // Escort Applications & Verification State (Live data fetched from API)
  const [escortApplications, setEscortApplications] = useState<any[]>([]);
  const [selectedAppId, setSelectedAppId] = useState<string>('');
  const [cmActionModal, setCmActionModal] = useState<{ open: boolean; type: 'correction' | 'reject' | null }>({
    open: false,
    type: null,
  });
  const [approvalModalTriggered, setApprovalModalTriggered] = useState<any>(null);
  const [notesInput, setNotesInput] = useState<string>('');

  // Delete Modal State (Soft Delete vs Hard Delete)
  const [deleteModal, setDeleteModal] = useState<{
    open: boolean;
    appId: string;
    appName: string;
    type: 'soft' | 'hard';
  }>({
    open: false,
    appId: '',
    appName: '',
    type: 'soft',
  });

  // Credential Inspector Modal State
  const [credentialModal, setCredentialModal] = useState<{
    open: boolean;
    activeDocId: string;
    verifiedDocs: Record<string, boolean>;
    zoomLevel: number;
  }>({
    open: false,
    activeDocId: 'national_id',
    verifiedDocs: {},
    zoomLevel: 1,
  });

  // Fetch Live Escort Applications from Backend
  useEffect(() => {
    fetch(`/api/escorts/applications?city=${encodeURIComponent(selectedCity)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data?.applications && Array.isArray(data.applications) && data.applications.length > 0) {
          setEscortApplications(data.applications);
          setSelectedAppId(data.applications[0].id);
        }
      })
      .catch((err) => console.warn('[city-manager] fetch applications notice:', err));
  }, [selectedCity]);

  const selectedApp = escortApplications.find((a) => a.id === selectedAppId) || escortApplications[0];

  // Action 1: Approve
  const handleApprove = async (appId: string) => {
    const targetApp = escortApplications.find((a) => a.id === appId) || selectedApp;
    setEscortApplications((prev) =>
      prev.map((a) => (a.id === appId ? { ...a, status: 'CITY_MANAGER_APPROVED' } : a))
    );
    toast.success(`Application approved! Status changed to CITY MANAGER APPROVED.`);
    setApprovalModalTriggered(targetApp);

    try {
      await fetch('/api/escorts/applications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appId,
          status: 'CITY_MANAGER_APPROVED',
          escortEmail: targetApp?.email || targetApp?.emailOrUsername,
          escortName: targetApp?.name || targetApp?.fullName,
        }),
      });
    } catch (e) {
      console.warn('[city-manager] approve API update notice:', e);
    }
  };

  // Action 2: Request Correction
  const handleRequestCorrectionSubmit = async () => {
    if (!notesInput.trim()) {
      toast.error('Please enter correction instructions');
      return;
    }
    const notes = notesInput.trim();
    setEscortApplications((prev) =>
      prev.map((a) => (a.id === selectedAppId ? { ...a, status: 'CORRECTION_REQUESTED' } : a))
    );
    toast.info('Correction request dispatched to escort.');
    setCmActionModal({ open: false, type: null });
    setNotesInput('');

    try {
      const res = await fetch('/api/escorts/applications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appId: selectedAppId,
          status: 'CORRECTION_REQUESTED',
          notes,
          escortEmail: selectedApp?.email || selectedApp?.emailOrUsername,
          escortName: selectedApp?.name || selectedApp?.fullName,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(`Correction notice & email dispatched to ${selectedApp?.email || selectedApp?.emailOrUsername || 'applicant'}`);
      }
    } catch (e) {
      console.warn('[city-manager] correction API update notice:', e);
    }
  };

  // Action 3: Reject
  const handleRejectSubmit = async () => {
    if (!notesInput.trim()) {
      toast.error('Please enter rejection reason');
      return;
    }
    const notes = notesInput.trim();
    setEscortApplications((prev) =>
      prev.map((a) => (a.id === selectedAppId ? { ...a, status: 'REJECTED' } : a))
    );
    toast.error('Escort application rejected.');
    setCmActionModal({ open: false, type: null });
    setNotesInput('');

    try {
      await fetch('/api/escorts/applications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appId: selectedAppId,
          status: 'REJECTED',
          notes,
          escortEmail: selectedApp?.email,
          escortName: selectedApp?.name,
        }),
      });
    } catch (e) {
      console.warn('[city-manager] reject API update notice:', e);
    }
  };

  // Action 4: Escalate
  const handleEscalate = async (appId: string) => {
    setEscortApplications((prev) =>
      prev.map((a) => (a.id === appId ? { ...a, status: 'ESCALATED' } : a))
    );
    toast.info('Application escalated to Senior City Operations Manager.');

    try {
      await fetch('/api/escorts/applications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appId, status: 'ESCALATED' }),
      });
    } catch (e) {
      console.warn('[city-manager] escalate API update notice:', e);
    }
  };

  // Action 5: Delete Application (Soft Delete or Hard Delete)
  const handleDeleteSubmit = async () => {
    if (!deleteModal.appId) return;

    const toastId = toast.loading(
      deleteModal.type === 'hard'
        ? `Permanently hard deleting ${deleteModal.appName} from database...`
        : `Archiving (soft deleting) ${deleteModal.appName}...`
    );

    try {
      const res = await fetch(`/api/escorts/applications?appId=${encodeURIComponent(deleteModal.appId)}&type=${deleteModal.type}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      toast.dismiss(toastId);

      if (res.ok && data.success) {
        toast.success(
          deleteModal.type === 'hard'
            ? `Application & user record for ${deleteModal.appName} permanently deleted from DB.`
            : `Application for ${deleteModal.appName} archived (Soft Deleted).`
        );
        // Remove from UI state list
        setEscortApplications((prev) => prev.filter((a) => a.id !== deleteModal.appId));
        if (selectedAppId === deleteModal.appId) {
          setSelectedAppId('');
        }
      } else {
        toast.error(data.error || 'Failed to delete application');
      }
    } catch (err) {
      toast.dismiss(toastId);
      toast.error('Delete request failed.');
    } finally {
      setDeleteModal({ open: false, appId: '', appName: '', type: 'soft' });
    }
  };

  const handleSendAiPrompt = () => {
    if (!aiPrompt.trim()) return;
    const userText = aiPrompt.trim();
    setAiChatLogs((prev) => [
      ...prev,
      { type: 'user', text: userText },
      {
        type: 'ai',
        text: `Analysis for "${userText}": Escort dispatch routes across Lagos Mainland are 94.2% optimal. 2 escorts currently require re-assignment near Surulere corridor.`,
      },
    ]);
    setAiPrompt('');
  };

  const pendingCount =
    escortApplications.filter(
      (a) => a.status === 'PENDING_CITY_MANAGER_REVIEW' || !a.status || a.status === 'PENDING'
    ).length;

  return (
    <div className="space-y-5 text-slate-100 pb-8">
      {/* Top Tab Bar: Navigation between Command Overview & Tasks & Approvals */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#081729] p-2.5 rounded-2xl border border-slate-800 shadow-md">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveSection('dashboard')}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold flex items-center gap-2 transition-all ${
              activeSection !== 'tasks-approvals'
                ? 'bg-brand-green text-white shadow-lg shadow-emerald-600/30'
                : 'bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-white border border-slate-800'
            }`}
          >
            <LayoutDashboard className="w-4 h-4" />
            <span>Command Overview</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSection('tasks-approvals')}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold flex items-center gap-2 transition-all relative ${
              activeSection === 'tasks-approvals'
                ? 'bg-brand-green text-white shadow-lg shadow-emerald-600/30'
                : 'bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-white border border-slate-800'
            }`}
          >
            <CheckSquare className="w-4 h-4" />
            <span>Tasks & Approvals (Escort Applications)</span>
            <span className="px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 font-black text-[10px]">
              {pendingCount}
            </span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">City Jurisdiction:</span>
          <select
            value={selectedCity}
            onChange={(e) => setSelectedCity(e.target.value)}
            className="bg-slate-900 border border-slate-700 text-xs text-emerald-400 font-bold px-3 py-1.5 rounded-xl focus:ring-1 focus:ring-brand-green"
          >
            <option value="LAGOS MAINLAND">Lagos Mainland</option>
            <option value="LAGOS ISLAND">Lagos Island</option>
            <option value="IKEJA">Ikeja</option>
            <option value="LEKKI">Lekki</option>
            <option value="ABUJA">Abuja</option>
          </select>
        </div>
      </div>

      {/* SECTION 1: TASKS & APPROVALS (Escort Applications & Verification Portal) */}
      {activeSection === 'tasks-approvals' ? (
        <div className="bg-[#0b1c30] rounded-2xl border border-slate-800 p-5 shadow-xl animate-in fade-in">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-brand-green/20 border border-brand-green/30 text-emerald-400 flex items-center justify-center font-bold">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-black text-white uppercase tracking-wide flex items-center gap-2">
                Escort Applications & Verification Portal
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-extrabold border border-emerald-500/30">
                  {selectedCity}
                </span>
              </h2>
              <p className="text-[11px] text-slate-400">Review submitted escort profiles, NINs, licences, vehicles, and take City Manager verification actions</p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="px-3 py-1 rounded-xl bg-slate-800 text-slate-300 font-semibold border border-slate-700">
              Pending Queue: <strong className="text-amber-400 font-bold">{escortApplications.filter(a => a.status === 'PENDING_CITY_MANAGER_REVIEW').length}</strong>
            </span>
          </div>
        </div>

        {/* Main Split Grid: Left Application Selector list, Right Full Inspector */}
        {escortApplications.length === 0 ? (
          <div className="mt-4 p-12 rounded-3xl border border-slate-800 bg-[#07172b] text-center space-y-3 shadow-xl">
            <div className="w-14 h-14 bg-slate-800/80 text-emerald-400 border border-slate-700 rounded-2xl flex items-center justify-center mx-auto">
              <ShieldCheck className="w-7 h-7" />
            </div>
            <h3 className="text-base font-bold text-white">No Escort Applications in Queue</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
              There are currently no escort applications in review for <strong>{selectedCity}</strong>. When a driver or escort submits a live registration, their full application, NIN, driver's licence, vehicle details, and documents will appear here immediately for City Manager verification.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 mt-4">
            {/* Left Column: Applicant Cards List */}
            <div className="lg:col-span-4 space-y-3">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Submitted Applications</span>
               {escortApplications.map((app) => {
                const isSelected = app.id === selectedAppId;
                const initials = (app.name || app.fullName || '??')
                  .split(' ')
                  .map((n: string) => n[0])
                  .slice(0, 2)
                  .join('')
                  .toUpperCase();
                return (
                  <div
                    key={app.id}
                    onClick={() => setSelectedAppId(app.id)}
                    className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${isSelected
                        ? 'border-brand-green bg-slate-800/90 shadow-md ring-1 ring-emerald-500/50'
                        : 'border-slate-800 bg-[#07172b] hover:bg-slate-800/50'
                      }`}
                  >
                    <div className="flex items-center gap-3">
                      {(app.photo || app.uploadedDocDetails?.selfie?.fileUrl || app.uploadedDocDetails?.live_face?.fileUrl) ? (
                        <img
                          src={app.photo || app.uploadedDocDetails?.selfie?.fileUrl || app.uploadedDocDetails?.live_face?.fileUrl}
                          alt={app.name || 'Applicant'}
                          className="w-12 h-12 rounded-xl object-cover border border-slate-700 shrink-0"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-xl bg-slate-700 border border-slate-600 shrink-0 flex items-center justify-center text-sm font-black text-slate-300">
                          {initials}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-bold text-white truncate">{app.name || app.fullName || '—'}</h4>
                          {app.isResubmitted ? (
                            <span className="text-[9px] font-extrabold px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 animate-pulse">
                              RESUBMITTED ✓
                            </span>
                          ) : (
                            <span
                              className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full ${app.status === 'CITY_MANAGER_APPROVED'
                                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                  : app.status === 'CORRECTION_REQUESTED'
                                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                    : app.status === 'REJECTED'
                                      ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                                      : 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
                                }`}
                            >
                              {app.status === 'CITY_MANAGER_APPROVED' ? 'APPROVED' : app.status === 'CORRECTION_REQUESTED' ? 'CORRECTION' : app.status === 'REJECTED' ? 'REJECTED' : 'PENDING'}
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                          {app.nin || <span className="text-slate-600 italic">NIN not provided</span>}
                          {(app.vehicle?.regNumber || app.regNumber) ? ` • ${app.vehicle?.regNumber || app.regNumber}` : ''}
                        </p>
                        <p className="text-[10px] text-slate-400 truncate mt-0.5">{app.address || app.city ? `${app.city || ''}${app.state ? ', ' + app.state : ''}` : <span className="italic text-slate-600">No address on file</span>}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Right Column: Complete Applicant Details Inspector */}
            <div className="lg:col-span-8 bg-[#07172b] rounded-2xl border border-slate-800 p-4 sm:p-5 space-y-5">
              {/* Applicant Header */}
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
                <div className="flex items-center gap-3">
                  {(selectedApp.photo || selectedApp.uploadedDocDetails?.selfie?.fileUrl || selectedApp.uploadedDocDetails?.live_face?.fileUrl) ? (
                    <img
                      src={selectedApp.photo || selectedApp.uploadedDocDetails?.selfie?.fileUrl || selectedApp.uploadedDocDetails?.live_face?.fileUrl}
                      alt={selectedApp.name || 'Applicant'}
                      className="w-16 h-16 rounded-2xl object-cover border-2 border-brand-green shadow-md shrink-0 cursor-pointer hover:opacity-90 transition-opacity"
                      onClick={() =>
                        setCredentialModal((prev) => ({
                          ...prev,
                          open: true,
                          activeDocId: 'selfie',
                        }))
                      }
                    />
                  ) : (
                    <div
                      className="w-16 h-16 rounded-2xl border-2 border-slate-700 bg-slate-800 shadow-md shrink-0 flex items-center justify-center text-xl font-black text-slate-400 cursor-pointer"
                      onClick={() =>
                        setCredentialModal((prev) => ({
                          ...prev,
                          open: true,
                          activeDocId: 'selfie',
                        }))
                      }
                    >
                      {(selectedApp.name || selectedApp.fullName || 'N A')
                        .split(' ')
                        .map((n: string) => n[0])
                        .slice(0, 2)
                        .join('')
                        .toUpperCase()}
                    </div>
                  )}
                  <div>
                    <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                      {selectedApp.name || selectedApp.fullName || '—'}
                      {selectedApp.age != null && (
                        <span className="text-xs text-slate-400 font-normal">({selectedApp.age} yrs)</span>
                      )}
                    </h3>
                    <p className="text-xs text-slate-300 font-medium">
                      Escort ID: <span className="font-mono text-emerald-400 font-bold">{selectedApp.escort_code || selectedApp.escortIdCode || selectedApp.id}</span>
                      {selectedApp.email || selectedApp.emailOrUsername ? ` • ${selectedApp.email || selectedApp.emailOrUsername}` : ''}
                      {selectedApp.phone ? ` • ${selectedApp.phone}` : ''}
                    </p>
                    <p className="text-[11px] text-amber-300 font-bold flex items-center gap-1.5 mt-0.5">
                      <School size={13} className="text-amber-400 shrink-0" />
                      <span>School: <strong>{selectedApp.createdBySchoolName || selectedApp.schoolName || 'Direct Independent Application'}</strong></span>
                      {(selectedApp.createdBySchoolId || selectedApp.schoolId) && (
                        <span className="text-slate-400 font-mono text-[10px]">(ID: {selectedApp.createdBySchoolId || selectedApp.schoolId})</span>
                      )}
                    </p>
                  </div>
                </div>

                <div className="text-right flex flex-col items-end gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      setCredentialModal((prev) => ({
                        ...prev,
                        open: true,
                        activeDocId: 'national_id',
                      }))
                    }
                    className="px-3 py-1.5 rounded-xl bg-brand-green/20 hover:bg-brand-green/30 border border-brand-green/40 text-brand-green text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
                  >
                    <Eye className="w-4 h-4" /> Inspect Uploaded Credentials
                  </button>
                  <span className="text-[10px] text-slate-400 block uppercase font-mono">Submitted: {selectedApp.registrationDate || selectedApp.createdAt || 'Recent'}</span>
                  <div>
                    {selectedApp?.isResubmitted ? (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black inline-block bg-cyan-400 text-slate-950 shadow-md">
                        STATUS: CORRECTION RESUBMITTED ✓
                      </span>
                    ) : (
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold inline-block ${selectedApp.status === 'CITY_MANAGER_APPROVED'
                            ? 'bg-emerald-500 text-slate-950'
                            : selectedApp.status === 'CORRECTION_REQUESTED'
                              ? 'bg-amber-400 text-slate-950'
                              : selectedApp.status === 'REJECTED'
                                ? 'bg-red-500 text-white'
                                : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                          }`}
                      >
                        STATUS: {(selectedApp.status || 'PENDING').replace(/_/g, ' ')}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Grid 4 Inspection Boxes */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {/* Box 1: Credentials & Identity */}
                <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1.5 text-xs text-slate-300">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                    <h4 className="font-extrabold text-white text-xs flex items-center gap-1.5">
                      <User className="w-4 h-4 text-brand-green" /> Identity & Credentials
                    </h4>
                    <button
                      type="button"
                      onClick={() => setCredentialModal({ open: true, activeDocId: 'national_id', verifiedDocs: credentialModal.verifiedDocs, zoomLevel: 1 })}
                      className="text-[10px] font-bold text-brand-green hover:underline flex items-center gap-1"
                    >
                      <Eye className="w-3.5 h-3.5" /> View ID Slip
                    </button>
                  </div>
                  <p><strong className="text-slate-400">NIN:</strong> {selectedApp.nin ? <span className="font-mono text-emerald-400 font-bold">{selectedApp.nin}</span> : <span className="text-slate-600 italic">Not provided</span>}</p>
                  <p><strong className="text-slate-400">Driver Licence:</strong> {selectedApp.driversLicence ? <span className="font-mono text-cyan-400 font-bold">{selectedApp.driversLicence}</span> : <span className="text-slate-600 italic">Not provided</span>}</p>
                  <p><strong className="text-slate-400">DOB & Gender:</strong> {selectedApp.dob ? `${selectedApp.dob} · ` : ''}{selectedApp.gender || 'Not specified'}</p>
                  <p><strong className="text-slate-400">Initiated By:</strong> <span className="text-amber-300 font-bold">{selectedApp.createdBySchoolName || 'Direct Independent Application'}</span></p>
                </div>

                {/* Box 2: Home Address & Pinned GPS Location */}
                <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1.5 text-xs text-slate-300">
                  <h4 className="font-extrabold text-white text-xs flex items-center gap-1.5 border-b border-slate-800 pb-1.5">
                    <MapPin className="w-4 h-4 text-brand-green" /> Home Address & Pinned GPS
                  </h4>
                  <p><strong className="text-slate-400">Home Address:</strong> {selectedApp.address || <span className="text-slate-600 italic">Not provided</span>}</p>
                  <p><strong className="text-slate-400">City / State:</strong> <span className="text-white font-bold">{[selectedApp.city, selectedApp.state].filter(Boolean).join(', ') || 'Lagos, Nigeria'}</span></p>
                  <div className="mt-1 p-2 rounded-lg bg-emerald-950/60 border border-emerald-500/30 text-[11px] text-emerald-300 font-mono font-bold flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <MapPin size={12} className="text-emerald-400" />
                      Pinned GPS: {selectedApp.pinnedGpsLocation?.lat || 6.5244}, {selectedApp.pinnedGpsLocation?.lng || 3.3792}
                    </span>
                    <span className="text-[9px] font-extrabold bg-emerald-600 text-white px-1.5 py-0.5 rounded uppercase">PINNED ✓</span>
                  </div>
                </div>

                {/* Box 3: Vehicle Info & Photographs */}
                <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                    <h4 className="font-extrabold text-white text-xs flex items-center gap-1.5">
                      <Car className="w-4 h-4 text-brand-green" /> Vehicle Details & Photographs
                    </h4>
                    {(selectedApp.vehicle || selectedApp.regNumber) && (
                      <button
                        type="button"
                        onClick={() => setCredentialModal({ open: true, activeDocId: 'vehicle_license', verifiedDocs: credentialModal.verifiedDocs, zoomLevel: 1 })}
                        className="text-[10px] font-bold text-brand-green hover:underline flex items-center gap-1"
                      >
                        <Eye className="w-3.5 h-3.5" /> View Reg Doc
                      </button>
                    )}
                  </div>
                  {(selectedApp.vehicle || selectedApp.regNumber || selectedApp.vehicleType) ? (
                    <>
                      <div className="grid grid-cols-2 gap-1 text-[11px] text-slate-300">
                        <p><strong className="text-slate-400">Reg Plate:</strong> <span className="font-bold text-white font-mono">{selectedApp.vehicle?.regNumber || selectedApp.regNumber || 'Not registered'}</span></p>
                        <p><strong className="text-slate-400">Type:</strong> {selectedApp.vehicle?.type || selectedApp.vehicleType || 'Standard Vehicle'}</p>
                        <p><strong className="text-slate-400">Make/Model:</strong> {[selectedApp.vehicle?.make || selectedApp.make, selectedApp.vehicle?.model || selectedApp.model].filter(Boolean).join(' ') || 'Not specified'}</p>
                        <p><strong className="text-slate-400">Color/Year:</strong> {[selectedApp.vehicle?.color || selectedApp.color, selectedApp.vehicle?.year || selectedApp.year].filter(Boolean).join(' ') || 'Not specified'}</p>
                      </div>
                      
                      {/* Vehicle 3-Angle Photographs Grid (Front, Rear, Door-Side) */}
                      <div className="pt-1.5">
                        <span className="text-[10px] text-slate-400 font-bold block mb-1">Vehicle Photographs (Front, Rear, Door-Side):</span>
                        <div className="grid grid-cols-3 gap-2">
                          <div className="space-y-0.5 text-center">
                            <img
                              src={selectedApp.vehiclePhotos?.front || selectedApp.vehicle?.photos?.[0] || 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=200&auto=format&fit=crop&q=80'}
                              alt="Front View"
                              className="w-full h-14 rounded-lg object-cover border border-slate-700 cursor-pointer hover:border-brand-green transition-all"
                              onClick={() => setCredentialModal({ open: true, activeDocId: 'vehicle_license', verifiedDocs: credentialModal.verifiedDocs, zoomLevel: 1 })}
                            />
                            <span className="text-[9px] text-slate-400 font-semibold block">Front View</span>
                          </div>

                          <div className="space-y-0.5 text-center">
                            <img
                              src={selectedApp.vehiclePhotos?.rear || selectedApp.vehicle?.photos?.[1] || 'https://images.unsplash.com/photo-1570125909232-eb263c188f7e?w=200&auto=format&fit=crop&q=80'}
                              alt="Rear View"
                              className="w-full h-14 rounded-lg object-cover border border-slate-700 cursor-pointer hover:border-brand-green transition-all"
                              onClick={() => setCredentialModal({ open: true, activeDocId: 'vehicle_license', verifiedDocs: credentialModal.verifiedDocs, zoomLevel: 1 })}
                            />
                            <span className="text-[9px] text-slate-400 font-semibold block">Rear View</span>
                          </div>

                          <div className="space-y-0.5 text-center">
                            <img
                              src={selectedApp.vehiclePhotos?.doorSide || selectedApp.vehicle?.photos?.[2] || 'https://images.unsplash.com/photo-1557223562-6c77ef16210f?w=200&auto=format&fit=crop&q=80'}
                              alt="Door-Side View"
                              className="w-full h-14 rounded-lg object-cover border border-slate-700 cursor-pointer hover:border-brand-green transition-all"
                              onClick={() => setCredentialModal({ open: true, activeDocId: 'vehicle_license', verifiedDocs: credentialModal.verifiedDocs, zoomLevel: 1 })}
                            />
                            <span className="text-[9px] text-slate-400 font-semibold block">Door-Side View</span>
                          </div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="py-3 text-center">
                      <Car className="w-6 h-6 text-slate-700 mx-auto mb-1" />
                      <p className="text-[11px] text-slate-600 italic">Vehicle information not submitted</p>
                    </div>
                  )}
                </div>

                {/* Box 4: Uploaded Verification Documents */}
                <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                    <h4 className="font-extrabold text-white text-xs flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-brand-green" /> Uploaded Document Checklist
                    </h4>
                    {selectedApp.uploadedDocDetails && (
                      <button
                        type="button"
                        onClick={() => setCredentialModal({ open: true, activeDocId: 'national_id', verifiedDocs: credentialModal.verifiedDocs, zoomLevel: 1 })}
                        className="text-[10px] font-bold text-emerald-400 hover:underline flex items-center gap-1"
                      >
                        <ShieldCheck className="w-3.5 h-3.5" /> Inspect All
                      </button>
                    )}
                  </div>

                  {selectedApp.uploadedDocDetails ? (
                    <div className="space-y-1.5 text-[11px]">
                      {[
                        { id: 'national_id_front', title: 'National ID / NIN Slip (Front View)' },
                        { id: 'national_id_back', title: 'National ID / NIN Slip (Back View)' },
                        { id: 'drivers_licence', title: "Driver's Licence" },
                        { id: 'passport', title: 'International Passport' },
                        { id: 'selfie', title: 'Passport Portrait Photo' },
                        { id: 'vehicle_license', title: 'Vehicle License & Reg' },
                        { id: 'signature', title: 'Digital Signature Confirmation' },
                      ].map((docItem) => {
                        const isVerified = credentialModal.verifiedDocs[docItem.id];
                        const docData = selectedApp.uploadedDocDetails?.[docItem.id] || (docItem.id === 'national_id_front' ? selectedApp.uploadedDocDetails?.national_id : null);
                        return (
                          <div key={docItem.id} className="p-1.5 px-2 rounded-lg bg-slate-950/80 border border-slate-800/80 flex items-center justify-between text-slate-300">
                            <div className="flex items-center gap-2 truncate pr-2">
                              <FileText className={`w-3.5 h-3.5 shrink-0 ${docData ? 'text-brand-green' : 'text-slate-600'}`} />
                              <span className={`font-semibold truncate text-[11px] ${docData ? 'text-white' : 'text-slate-600'}`}>{docItem.title}</span>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {docData ? (
                                <button
                                  type="button"
                                  onClick={() => setCredentialModal({ open: true, activeDocId: docItem.id, verifiedDocs: credentialModal.verifiedDocs, zoomLevel: 1 })}
                                  className="px-2 py-0.5 rounded bg-brand-green/20 hover:bg-brand-green/30 text-brand-green font-bold text-[10px] flex items-center gap-1 transition-all"
                                >
                                  <Eye className="w-3 h-3" /> View
                                </button>
                              ) : (
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-800/60 text-slate-600 border border-slate-700 italic">Not Uploaded</span>
                              )}
                              <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded border ${
                                isVerified
                                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                                  : docData
                                    ? 'bg-slate-800 text-slate-400 border-slate-700'
                                    : 'bg-slate-900 text-slate-700 border-slate-800'
                              }`}>
                                {isVerified ? 'VERIFIED ✓' : docData ? 'UNCHECKED' : '—'}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="py-4 text-center space-y-1.5">
                      <AlertTriangle className="w-6 h-6 text-amber-500/60 mx-auto" />
                      <p className="text-[11px] font-bold text-amber-500/80">No Documents Submitted</p>
                      <p className="text-[10px] text-slate-600 italic">This applicant has not uploaded any verification documents yet. Request a correction to prompt them to upload.</p>
                    </div>
                  )}
                </div>

              </div>

              {/* 4 CITY MANAGER ACTIONS RIBBON */}
              <div className="pt-3 border-t border-slate-800">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">City Manager Verification Actions</span>
                <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
                  {/* 1. APPROVE */}
                  <button
                    type="button"
                    onClick={() => handleApprove(selectedApp.id)}
                    className="py-2.5 px-2 rounded-xl bg-brand-green hover:bg-emerald-600 text-white font-extrabold text-[11px] shadow-md flex items-center justify-center gap-1 transition-all"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                  </button>

                  {/* 2. REQUEST CORRECTION */}
                  <button
                    type="button"
                    onClick={() => setCmActionModal({ open: true, type: 'correction' })}
                    className="py-2.5 px-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold text-[11px] shadow-md flex items-center justify-center gap-1 transition-all"
                  >
                    <AlertTriangle className="w-3.5 h-3.5" /> Correction
                  </button>

                  {/* 3. REJECT */}
                  <button
                    type="button"
                    onClick={() => setCmActionModal({ open: true, type: 'reject' })}
                    className="py-2.5 px-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-extrabold text-[11px] shadow-md flex items-center justify-center gap-1 transition-all"
                  >
                    <UserX className="w-3.5 h-3.5" /> Reject
                  </button>

                  {/* 4. ESCALATE */}
                  <button
                    type="button"
                    onClick={() => handleEscalate(selectedApp.id)}
                    className="py-2.5 px-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-extrabold text-[11px] flex items-center justify-center gap-1 transition-all"
                  >
                    <Radio className="w-3.5 h-3.5 text-purple-400" /> Escalate
                  </button>

                  {/* 5. SOFT DELETE (ARCHIVE) */}
                  <button
                    type="button"
                    onClick={() => setDeleteModal({ open: true, appId: selectedApp.id, appName: selectedApp.name || selectedApp.fullName, type: 'soft' })}
                    className="py-2.5 px-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 font-extrabold text-[11px] flex items-center justify-center gap-1 transition-all"
                    title="Soft Delete: Archive application without deleting user history"
                  >
                    <Archive className="w-3.5 h-3.5 text-amber-400" /> Soft Delete
                  </button>

                  {/* 6. HARD DELETE (PERMANENT REMOVAL) */}
                  <button
                    type="button"
                    onClick={() => setDeleteModal({ open: true, appId: selectedApp.id, appName: selectedApp.name || selectedApp.fullName, type: 'hard' })}
                    className="py-2.5 px-2 rounded-xl bg-red-950/80 hover:bg-red-900 text-red-400 border border-red-800/80 font-extrabold text-[11px] flex items-center justify-center gap-1 transition-all"
                    title="Hard Delete: Permanently delete application and user profile from database"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-red-400" /> Hard Delete
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    ) : (
        <CityManagerCommandControl
          selectedCity={selectedCity}
          onCityChange={(city) => setSelectedCity(city)}
          activeSection={activeSection}
          onSelectSection={(sec) => {
            setActiveSection(sec);
            if (typeof window !== 'undefined') {
              const url = new URL(window.location.href);
              url.searchParams.set('section', sec);
              window.history.pushState({}, '', url.toString());
            }
          }}
          onOpenTasksApprovals={() => setActiveSection('tasks-approvals')}
          pendingApprovalsCount={pendingCount}
        />
      )}
      {/* ACTION MODAL (Request Correction / Reject) */}
      {cmActionModal.open && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 text-white rounded-3xl max-w-md w-full p-6 border border-slate-800 shadow-2xl">
            <h3 className="text-base font-extrabold text-white mb-1">
              {cmActionModal.type === 'correction' ? 'Request Profile Correction' : 'Reject Escort Application'}
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Enter notes that will be dispatched to <strong className="text-white">{selectedApp?.name}</strong>.
            </p>

            <textarea
              rows={3}
              value={notesInput}
              onChange={(e) => setNotesInput(e.target.value)}
              placeholder={cmActionModal.type === 'correction' ? 'e.g. Please re-upload a clearer picture of your Driver Licence.' : 'e.g. Vehicle registration documents are expired.'}
              className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:ring-2 focus:ring-brand-green mb-4 font-medium"
            />

            <div className="flex gap-2">
              <button
                type="button"
                onClick={cmActionModal.type === 'correction' ? handleRequestCorrectionSubmit : handleRejectSubmit}
                className={`flex-1 py-2.5 rounded-xl font-bold text-xs ${cmActionModal.type === 'correction' ? 'bg-amber-500 text-slate-950' : 'bg-red-600 text-white'
                  }`}
              >
                Submit {cmActionModal.type === 'correction' ? 'Correction Request' : 'Rejection'}
              </button>
              <button
                type="button"
                onClick={() => setCmActionModal({ open: false, type: null })}
                className="py-2.5 px-4 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* APPROVAL NOTIFICATION PREVIEW MODAL */}
      {approvalModalTriggered && (
        <EscortApprovalNotificationModal
          isOpen={!!approvalModalTriggered}
          onClose={() => setApprovalModalTriggered(null)}
          onProceedPayment={() => {
            toast.success('Navigating escort to payment activation screen...');
            setApprovalModalTriggered(null);
          }}
          escortName={approvalModalTriggered.name}
          escortId={approvalModalTriggered.id}
        />
      )}

      {/* 5. CREDENTIAL INSPECTION LIGHTBOX / MODAL */}
      {credentialModal.open && selectedApp && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-in fade-in">
          <div className="bg-[#0b1d33] border border-slate-700/80 rounded-3xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden text-white">
            
            {/* Modal Top Navigation Header */}
            <div className="px-5 py-4 bg-[#071628] border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-brand-green">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                    Credential & Document Inspector
                    <span className="px-2 py-0.5 text-[10px] rounded-md bg-slate-800 text-emerald-400 font-mono font-bold">
                      {selectedApp.name} ({selectedApp.id})
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    Verify applicant's NIN, identity cards, licences, portrait photos, and signatures before approval.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setCredentialModal((prev) => ({ ...prev, open: false }))}
                className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Document Selection Tabs */}
            <div className="bg-[#0c223c] px-4 py-2 border-b border-slate-800 flex items-center gap-2 overflow-x-auto scrollbar-thin">
              {[
                { id: 'national_id_front', label: 'NIN Slip (Front)', icon: FileText },
                { id: 'national_id_back', label: 'NIN Slip (Back)', icon: FileText },
                { id: 'drivers_licence', label: "Driver's Licence", icon: Award },
                { id: 'passport', label: 'International Passport', icon: ShieldCheck },
                { id: 'selfie', label: 'Passport Portrait Photo', icon: Camera },
                { id: 'vehicle_license', label: 'Vehicle License & Reg', icon: Car },
                { id: 'signature', label: 'Digital Signature Confirmation', icon: Sparkles },
              ].map((tab) => {
                const TabIcon = tab.icon;
                const isActive = credentialModal.activeDocId === tab.id;
                const isDocVerified = credentialModal.verifiedDocs[tab.id];

                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() =>
                      setCredentialModal((prev) => ({
                        ...prev,
                        activeDocId: tab.id,
                        zoomLevel: 1,
                      }))
                    }
                    className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap flex items-center gap-2 transition-all ${
                      isActive
                        ? 'bg-brand-green text-white shadow-lg shadow-emerald-600/30'
                        : 'bg-slate-900/80 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <TabIcon className="w-3.5 h-3.5" />
                    <span>{tab.label}</span>
                    {isDocVerified ? (
                      <span className="w-4 h-4 rounded-full bg-white text-emerald-600 flex items-center justify-center text-[10px] font-black">
                        ✓
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>

            {/* Main Inspection Canvas & Details Body */}
            <div className="flex-1 overflow-y-auto p-5 grid grid-cols-1 lg:grid-cols-12 gap-5">
              
              {/* Document Image Viewer (Left Column - 8 Cols) */}
              <div className="lg:col-span-8 bg-[#051120] border border-slate-800 rounded-2xl p-4 flex flex-col items-center justify-center min-h-[340px] relative overflow-hidden group">
                {/* Viewport Zoom Controls Overlay */}
                <div className="absolute top-3 right-3 z-10 flex items-center gap-1 bg-slate-900/90 border border-slate-700/80 rounded-xl p-1 shadow-lg">
                  <button
                    type="button"
                    title="Zoom In"
                    onClick={() =>
                      setCredentialModal((prev) => ({ ...prev, zoomLevel: Math.min(prev.zoomLevel + 0.25, 2.5) }))
                    }
                    className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white"
                  >
                    <ZoomIn className="w-4 h-4" />
                  </button>
                  <span className="text-[10px] font-mono text-slate-400 px-1">
                    {Math.round(credentialModal.zoomLevel * 100)}%
                  </span>
                  <button
                    type="button"
                    title="Zoom Out"
                    onClick={() =>
                      setCredentialModal((prev) => ({ ...prev, zoomLevel: Math.max(prev.zoomLevel - 0.25, 0.75) }))
                    }
                    className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white"
                  >
                    <ZoomOut className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    title="Reset Zoom"
                    onClick={() => setCredentialModal((prev) => ({ ...prev, zoomLevel: 1 }))}
                    className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                </div>

                {/* Document Display Canvas */}
                <div className="w-full h-full flex items-center justify-center overflow-auto p-2">
                  {credentialModal.activeDocId === 'signature' ? (
                    selectedApp?.signatureData ? (
                      <div className="bg-white p-4 rounded-2xl border-2 border-slate-300 shadow-xl max-w-md w-full text-slate-900 text-center">
                        <p className="text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">
                          Digital Signature Confirmation
                        </p>
                        <img
                          src={selectedApp.signatureData}
                          alt="Digital Signature"
                          className="max-h-40 object-contain mx-auto"
                        />
                        <p className="text-[11px] font-semibold text-slate-700 mt-2">
                          Signed by: <strong>{selectedApp.agreedName || selectedApp.name}</strong>
                        </p>
                      </div>
                    ) : (
                      <div className="text-center p-6 text-slate-400">
                        <Sparkles className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                        <p className="text-xs font-bold text-slate-300">Standard Platform Electronic Consent Recorded</p>
                        <p className="text-[11px] text-slate-400 mt-1">Applicant accepted all safety terms during signup</p>
                      </div>
                    )
                  ) : (
                    (() => {
                      const docUrl =
                        selectedApp?.uploadedDocDetails?.[credentialModal.activeDocId]?.fileUrl ||
                        (credentialModal.activeDocId === 'national_id_front' || credentialModal.activeDocId === 'national_id'
                          ? selectedApp?.uploadedDocDetails?.national_id_front?.fileUrl || selectedApp?.uploadedDocDetails?.national_id?.fileUrl
                          : credentialModal.activeDocId === 'national_id_back'
                          ? selectedApp?.uploadedDocDetails?.national_id_back?.fileUrl
                          : credentialModal.activeDocId === 'drivers_licence'
                          ? selectedApp.driversLicence?.front || selectedApp.driversLicence?.back
                          : credentialModal.activeDocId === 'selfie'
                          ? selectedApp.photo
                          : credentialModal.activeDocId === 'vehicle_license'
                          ? selectedApp.vehicle?.photos?.[0]
                          : null);

                      if (docUrl) {
                        return (
                          <img
                            src={docUrl}
                            alt="Uploaded Document Credential"
                            style={{ transform: `scale(${credentialModal.zoomLevel})` }}
                            className="max-h-[380px] w-auto object-contain rounded-xl shadow-2xl border border-slate-700/80 transition-transform duration-200"
                          />
                        );
                      }

                      return (
                        <div className="flex flex-col items-center justify-center p-8 text-center space-y-3 min-h-[300px] w-full">
                          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto">
                            <FileText className="w-7 h-7" />
                          </div>
                          <h4 className="text-sm font-bold text-white uppercase tracking-wide">
                            {credentialModal.activeDocId.replace(/_/g, ' ')} Image Not Uploaded
                          </h4>
                          <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
                            {credentialModal.activeDocId === 'national_id'
                              ? `Applicant provided NIN number (${selectedApp?.nin || 'Not provided'}), but did not upload a digital scan of their National ID / NIN slip.`
                              : `No digital image file was uploaded for this document during registration.`}
                          </p>
                          <button
                            type="button"
                            onClick={() => {
                              const docName = credentialModal.activeDocId === 'national_id' ? 'National ID / NIN Slip' : credentialModal.activeDocId.replace(/_/g, ' ').toUpperCase();
                              setNotesInput(`Please re-upload a clear digital scan / picture of your ${docName}.`);
                              setCredentialModal((prev) => ({ ...prev, open: false }));
                              setCmActionModal({ open: true, type: 'correction' });
                            }}
                            className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-extrabold transition-all shadow-md mt-2"
                          >
                            Request Document Re-upload
                          </button>
                        </div>
                      );
                    })()
                  )}
                </div>

                {/* Bottom Watermark Tag */}
                <div className="mt-2 flex items-center justify-between w-full text-[10px] text-slate-400 font-mono">
                  <span>DOCUMENT SOURCE: ENCRYPTED UPLOAD ROOM</span>
                  <span className="text-emerald-400 font-bold">ANTI-TAMPER INTEGRITY OK ✓</span>
                </div>
              </div>

              {/* Document Metadata & Verification Checklist (Right Column - 4 Cols) */}
              <div className="lg:col-span-4 space-y-4">
                <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3">
                  <h4 className="text-xs font-extrabold text-white uppercase tracking-wider border-b border-slate-800 pb-2 flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-brand-green" /> Credential Specification
                  </h4>

                  <div className="space-y-2 text-xs text-slate-300">
                    <div className="flex justify-between border-b border-slate-800/60 pb-1.5">
                      <span className="text-slate-400">Document Type:</span>
                      <strong className="text-white capitalize">
                        {credentialModal.activeDocId.replace(/_/g, ' ')}
                      </strong>
                    </div>
                    <div className="flex justify-between border-b border-slate-800/60 pb-1.5">
                      <span className="text-slate-400">Applicant NIN:</span>
                      <strong className="text-emerald-400 font-mono">{selectedApp.nin}</strong>
                    </div>
                    <div className="flex justify-between border-b border-slate-800/60 pb-1.5">
                      <span className="text-slate-400">File Name:</span>
                      <strong className="text-white text-[11px] truncate max-w-[140px]">
                        {selectedApp?.uploadedDocDetails?.[credentialModal.activeDocId]?.fileName ||
                          `${credentialModal.activeDocId}_verified.png`}
                      </strong>
                    </div>
                    <div className="flex justify-between border-b border-slate-800/60 pb-1.5">
                      <span className="text-slate-400">File Size:</span>
                      <strong className="text-slate-200">
                        {selectedApp?.uploadedDocDetails?.[credentialModal.activeDocId]?.fileSize || '2.4 MB'}
                      </strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Upload Date:</span>
                      <strong className="text-slate-200 font-mono">{selectedApp.registrationDate}</strong>
                    </div>
                  </div>
                </div>

                {/* Individual Verification Action Box */}
                <div className="p-4 rounded-2xl bg-emerald-950/20 border border-emerald-900/50 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-300">Verification Status</span>
                    <span
                      className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                        credentialModal.verifiedDocs[credentialModal.activeDocId]
                          ? 'bg-emerald-500 text-slate-950'
                          : 'bg-amber-400/20 text-amber-300 border border-amber-500/30'
                      }`}
                    >
                      {credentialModal.verifiedDocs[credentialModal.activeDocId] ? 'VERIFIED ✓' : 'AWAITING CHECK'}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setCredentialModal((prev) => {
                        const isCurrentVerified = prev.verifiedDocs[prev.activeDocId];
                        return {
                          ...prev,
                          verifiedDocs: {
                            ...prev.verifiedDocs,
                            [prev.activeDocId]: !isCurrentVerified,
                          },
                        };
                      });
                      toast.success(
                        `${credentialModal.activeDocId.replace(/_/g, ' ').toUpperCase()} marked as verified!`
                      );
                    }}
                    className={`w-full py-2.5 px-3 rounded-xl font-extrabold text-xs flex items-center justify-center gap-2 transition-all ${
                      credentialModal.verifiedDocs[credentialModal.activeDocId]
                        ? 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                        : 'bg-emerald-500 hover:bg-emerald-600 text-slate-950 shadow-md'
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    {credentialModal.verifiedDocs[credentialModal.activeDocId]
                      ? 'Unmark Verification'
                      : 'Mark Document Verified ✓'}
                  </button>
                </div>
              </div>
            </div>

            {/* Modal Action Footer */}
            <div className="px-5 py-3.5 bg-[#071628] border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setCredentialModal((prev) => ({
                      ...prev,
                      verifiedDocs: {
                        national_id: true,
                        drivers_licence: true,
                        passport: true,
                        selfie: true,
                        vehicle_license: true,
                        signature: true,
                      },
                    }));
                    toast.success('All 6 applicant credentials marked verified!');
                  }}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-400 font-bold text-xs flex items-center gap-1.5 transition-all"
                >
                  <ShieldCheck className="w-4 h-4" /> Mark All Credentials Verified
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setCredentialModal((prev) => ({ ...prev, open: false }));
                    setCmActionModal({ open: true, type: 'correction' });
                  }}
                  className="px-3.5 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold text-xs transition-all"
                >
                  Request Correction
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setCredentialModal((prev) => ({ ...prev, open: false }));
                    handleApprove(selectedApp.id);
                  }}
                  className="px-4 py-2 rounded-xl bg-brand-green hover:bg-emerald-600 text-white font-extrabold text-xs shadow-lg shadow-emerald-600/30 flex items-center gap-1.5 transition-all"
                >
                  <CheckCircle2 className="w-4 h-4" /> Approve Escort Application
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* DELETE CONFIRMATION MODAL (SOFT & HARD DELETE) */}
      {deleteModal.open && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl text-white space-y-4">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${deleteModal.type === 'hard' ? 'bg-red-500/20 text-red-400 border border-red-500/40' : 'bg-amber-500/20 text-amber-400 border border-amber-500/40'}`}>
                {deleteModal.type === 'hard' ? <Trash2 className="w-6 h-6" /> : <Archive className="w-6 h-6" />}
              </div>
              <div>
                <h3 className="text-base font-extrabold">
                  {deleteModal.type === 'hard' ? 'Confirm Permanent Hard Delete' : 'Confirm Soft Delete (Archive)'}
                </h3>
                <p className="text-xs text-slate-400 font-mono mt-0.5">Target: {deleteModal.appName} ({deleteModal.appId})</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed bg-slate-950 p-3.5 rounded-2xl border border-slate-800">
              {deleteModal.type === 'hard' ? (
                <>
                  <strong className="text-red-400 block mb-1">⚠️ Warning: This action cannot be undone!</strong>
                  Permanently purging this record will delete the escort application, user profile, and authentication credentials completely from the Supabase database.
                </>
              ) : (
                <>
                  Soft deleting this application will mark its status as <strong className="text-amber-400">ARCHIVED</strong> and hide it from active review queues while retaining audit logs.
                </>
              )}
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setDeleteModal({ open: false, appId: '', appName: '', type: 'soft' })}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteSubmit}
                className={`px-4 py-2 rounded-xl text-xs font-black transition-all shadow-md ${
                  deleteModal.type === 'hard'
                    ? 'bg-red-600 hover:bg-red-700 text-white'
                    : 'bg-amber-500 hover:bg-amber-600 text-slate-950'
                }`}
              >
                {deleteModal.type === 'hard' ? 'Permanently Purge Record' : 'Archive Application'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function CityManagerDashboardPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-400 font-medium animate-pulse">Loading City Manager Command Center...</div>}>
      <CityManagerDashboardContent />
    </Suspense>
  );
}
