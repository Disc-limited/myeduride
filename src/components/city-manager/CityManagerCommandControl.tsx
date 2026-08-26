// @ts-nocheck
'use client';

import { useState, useMemo, useEffect } from 'react';
import {
  Radio,
  UserCheck,
  DoorOpen,
  Navigation,
  AlertTriangle,
  MessageSquare,
  Shield,
  PhoneCall,
  Megaphone,
  AlertOctagon,
  School,
  Car,
  Users,
  CheckCircle2,
  Clock,
  Zap,
  Bot,
  Send,
  Maximize2,
  Search,
  Filter,
  ArrowRightLeft,
  UserX,
  UserPlus,
  Ban,
  Slash,
  Eye,
  Check,
  X,
  ChevronRight,
  TrendingUp,
  Activity,
  Award,
  Calendar,
  Layers,
  Phone,
  MessageCircle,
  FileText,
  AlertCircle,
  RefreshCw,
  SlidersHorizontal,
  ChevronDown,
  Info,
  MapPin,
  Flame,
  ShieldCheck,
  ShieldAlert,
  BarChart3,
  ClipboardList,
  Settings,
  Sliders,
  CheckSquare,
} from 'lucide-react';
import { toast } from 'sonner';
import StudentAvatar from '@/components/shared/StudentAvatar';
import { CityManagerOperationsPanel } from '@/components/city-manager/CityManagerOperationsPanel';

export interface CityManagerCommandControlProps {
  selectedCity: string;
  onCityChange?: (city: string) => void;
  activeSection?: string;
  onSelectSection?: (section: string) => void;
  onOpenTasksApprovals?: () => void;
  pendingApprovalsCount?: number;
}

export function CityManagerCommandControl({
  selectedCity = 'LAGOS MAINLAND',
  onCityChange,
  activeSection = 'dashboard',
  onSelectSection,
  onOpenTasksApprovals,
  pendingApprovalsCount = 0,
}: CityManagerCommandControlProps) {
  // Local active section state ensures tabs always toggle immediately
  const [currentTab, setCurrentTab] = useState<string>(activeSection || 'dashboard');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (activeSection) {
      setCurrentTab(activeSection);
    }
  }, [activeSection]);

  const switchTab = (tabId: string) => {
    setCurrentTab(tabId);
    if (onSelectSection) onSelectSection(tabId);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('section', tabId);
      window.history.pushState({}, '', url.toString());
    }
  };

  const [escorts, setEscorts] = useState<any[]>([]);
  const [gateOfficers, setGateOfficers] = useState<any[]>([]);
  const [gateActivities, setGateActivities] = useState<any[]>([]);
  const [safetyIncidents, setSafetyIncidents] = useState<any[]>([]);
  const [escalations, setEscalations] = useState<any[]>([]);
  const [schools, setSchools] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [deputisingRecords, setDeputisingRecords] = useState<any[]>([]);
  const [parentRequests, setParentRequests] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);

  // Fetch Live City Manager Operations Data
  useEffect(() => {
    setLoading(true);
    fetch(`/api/city-manager/operations?city=${encodeURIComponent(selectedCity)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data && !data.error) {
          if (Array.isArray(data.schools)) {
            setSchools(
              data.schools.map((s: any) => ({
                id: s.id,
                name: s.name || 'School Campus',
                area: s.address || selectedCity,
                escortsCount: 0,
                studentsCount: 0,
                gatesCount: 1,
                gateOfficers: 'Gate Officer',
                status: 'ONLINE',
                avgMorningEta: '07:30 AM',
                complianceScore: 100,
              }))
            );
          }
          if (Array.isArray(data.escorts)) {
            setEscorts(
              data.escorts.map((e: any) => ({
                id: e.id,
                name: e.full_name || 'Verified Escort',
                type: e.operating_area?.toLowerCase().includes('school') ? 'school' : 'myeduride',
                phone: e.phone || '—',
                status: e.availability_status === 'available' ? 'AVAILABLE' : e.status === 'ACTIVE' ? 'ON_TRIP' : 'STANDBY',
                schoolName: e.operating_area || selectedCity,
                vehicle: e.application_data?.assignedVehicle || e.application_data?.regNumber || 'Verified Vehicle',
                currentTripId: null,
                route: e.operating_area ? `${e.operating_area} Corridor` : 'Designated Route',
                studentsCount: 0,
                speed: '0 km/h',
                battery: '100%',
                lastPing: 'Live',
                complianceScore: 100,
                rating: 5.0,
                tripsToday: 0,
                avatar: e.application_data?.photo || '',
                notes: 'Verified escort profile on file.',
              }))
            );
          }
          if (Array.isArray(data.audit)) {
            setAuditLogs(
              data.audit.map((a: any) => ({
                id: a.id,
                time: a.created_at ? new Date(a.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : 'Just now',
                actor: a.user_id ? 'City Manager' : 'System',
                target: a.entity_type || 'Operations',
                action: a.action || 'AUDIT_LOGGED',
                details: a.metadata ? JSON.stringify(a.metadata) : 'Operational event recorded.',
              }))
            );
          }
          if (Array.isArray(data.deputising_records)) {
            setDeputisingRecords(data.deputising_records);
          }
          if (Array.isArray(data.parent_requests)) {
            setParentRequests(data.parent_requests);
          }
        }
      })
      .catch((err) => console.warn('[city-manager-command] fetch operations error:', err))
      .finally(() => setLoading(false));
  }, [selectedCity]);

  // Escort Sub-Filter: 'ALL' | 'MYEDURIDE' | 'SCHOOL'
  const [escortTypeFilter, setEscortTypeFilter] = useState<'ALL' | 'myeduride' | 'school'>('ALL');
  const [escortSearch, setEscortSearch] = useState('');

  // Modals State
  const [disciplinaryModal, setDisciplinaryModal] = useState<{
    open: boolean;
    escort: any | null;
    actionType: 'SUSPEND' | 'DEACTIVATE' | 'BLOCK' | null;
    reason: string;
    durationDays?: string;
  }>({
    open: false,
    escort: null,
    actionType: null,
    reason: '',
    durationDays: '7',
  });

  const [contactModal, setContactModal] = useState<{
    open: boolean;
    target: any | null;
    targetType: 'ESCORT' | 'GATE_OFFICER' | 'SCHOOL' | 'PARENT' | null;
    message: string;
    channel: 'IN_APP' | 'URGENT_SMS' | 'DISPATCH_CALL';
  }>({
    open: false,
    target: null,
    targetType: null,
    message: '',
    channel: 'IN_APP',
  });

  const [broadcastModal, setBroadcastModal] = useState<{
    open: boolean;
    audience: 'ALL_CITY_ESCORTS' | 'MYEDURIDE_ONLY' | 'GATE_OFFICERS' | 'ALL_SCHOOLS';
    title: string;
    body: string;
    priority: 'NORMAL' | 'URGENT' | 'EMERGENCY';
  }>({
    open: false,
    audience: 'ALL_CITY_ESCORTS',
    title: '',
    body: '',
    priority: 'URGENT',
  });

  const [tripDetailModal, setTripDetailModal] = useState<any | null>(null);

  // AI Assistant Chat Widget State
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiChatLogs, setAiChatLogs] = useState([
    { type: 'insight', text: 'MIGO SAVI Operational Intelligence online. Ask about escorts, gates, and route oversight.' },
  ]);

  // Filtered Escorts List
  const filteredEscorts = useMemo(() => {
    return escorts.filter((item) => {
      const matchesType = escortTypeFilter === 'ALL' || item.type === escortTypeFilter;
      const matchesSearch =
        item.name.toLowerCase().includes(escortSearch.toLowerCase()) ||
        item.id.toLowerCase().includes(escortSearch.toLowerCase()) ||
        item.schoolName.toLowerCase().includes(escortSearch.toLowerCase()) ||
        item.vehicle.toLowerCase().includes(escortSearch.toLowerCase());
      return matchesType && matchesSearch;
    });
  }, [escorts, escortTypeFilter, escortSearch]);

  // Handlers for Disciplinary Controls
  const handleExecuteDisciplinary = () => {
    if (!disciplinaryModal.escort || !disciplinaryModal.actionType) return;
    if (!disciplinaryModal.reason.trim()) {
      toast.error('Please enter a mandatory justification for this administrative action.');
      return;
    }

    const { escort, actionType, reason, durationDays } = disciplinaryModal;
    const actionLabel =
      actionType === 'SUSPEND'
        ? `Suspended for ${durationDays} days`
        : actionType === 'BLOCK'
        ? 'Permanently Blocked'
        : 'Deactivated';

    // Update escort status in state
    setEscorts((prev) =>
      prev.map((e) =>
        e.id === escort.id
          ? {
              ...e,
              status: actionType === 'SUSPEND' ? 'SUSPENDED' : actionType === 'BLOCK' ? 'BLOCKED' : 'DEACTIVATED',
              notes: `[CM Action: ${actionLabel}] Reason: ${reason}`,
            }
          : e
      )
    );

    // Append to city audit logs
    const newAudit = {
      id: `AUD-${Date.now().toString().slice(-4)}`,
      time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      actor: 'City Manager (You)',
      target: `${escort.name} (${escort.id})`,
      action: `ESCORT_${actionType}_EXECUTED`,
      details: `${actionLabel}. Justification: "${reason}"`,
    };
    setAuditLogs((prev) => [newAudit, ...prev]);

    toast.success(`Escort ${escort.name} has been ${actionLabel.toLowerCase()}. System access updated immediately.`);
    setDisciplinaryModal({ open: false, escort: null, actionType: null, reason: '', durationDays: '7' });
  };

  // Handler for Contact / Dispatch Message
  const handleSendContact = () => {
    if (!contactModal.target || !contactModal.message.trim()) {
      toast.error('Please type a communication message to send.');
      return;
    }
    const { target, targetType, message, channel } = contactModal;
    const channelName = channel === 'IN_APP' ? 'Direct Platform Message' : channel === 'URGENT_SMS' ? 'Urgent SMS Alert' : 'Priority Voice Dispatch';

    const newAudit = {
      id: `AUD-${Date.now().toString().slice(-4)}`,
      time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      actor: 'City Manager (You)',
      target: `${target.name || target.schoolName || 'Recipient'}`,
      action: `DISPATCH_${channel}_SENT`,
      details: `Dispatched ${channelName}: "${message.slice(0, 60)}..."`,
    };
    setAuditLogs((prev) => [newAudit, ...prev]);

    toast.success(`${channelName} successfully dispatched to ${target.name || target.schoolName}.`);
    setContactModal({ open: false, target: null, targetType: null, message: '', channel: 'IN_APP' });
  };

  // Handler for City-Wide Broadcast
  const handleSendBroadcast = () => {
    if (!broadcastModal.title.trim() || !broadcastModal.body.trim()) {
      toast.error('Please enter a broadcast title and message body.');
      return;
    }
    toast.success(`Broadcast "${broadcastModal.title}" transmitted to ${broadcastModal.audience.replace(/_/g, ' ')}!`);
    const newAudit = {
      id: `AUD-${Date.now().toString().slice(-4)}`,
      time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      actor: 'City Manager (You)',
      target: broadcastModal.audience,
      action: 'CITY_BROADCAST_TRANSMITTED',
      details: `[${broadcastModal.priority}] ${broadcastModal.title}: ${broadcastModal.body.slice(0, 50)}...`,
    };
    setAuditLogs((prev) => [newAudit, ...prev]);
    setBroadcastModal({ open: false, audience: 'ALL_CITY_ESCORTS', title: '', body: '', priority: 'URGENT' });
  };

  // Handler for AI Queries
  const handleSendAiPrompt = () => {
    if (!aiPrompt.trim()) return;
    const query = aiPrompt.trim();
    setAiChatLogs((prev) => [...prev, { type: 'user', text: query }]);
    setAiPrompt('');

    setTimeout(() => {
      let reply = 'MIGO Operations Copilot: Telemetry across the city is stable. No active SOS panics detected.';
      if (query.toLowerCase().includes('delay') || query.toLowerCase().includes('traffic')) {
        reply = 'MIGO: Route 3 (Gbagada to CitiLights) is experiencing +18m congestion. Recommending diversion via Oworonshoki loop.';
      } else if (query.toLowerCase().includes('kazeem') || query.toLowerCase().includes('speed') || query.toLowerCase().includes('violation')) {
        reply = 'MIGO: Escort Kazeem Oladipo (EMR-3309) exceeded speed limits twice between 09:12 and 09:18 AM. Disciplinary suspension or formal warning advised.';
      } else if (query.toLowerCase().includes('gate') || query.toLowerCase().includes('override')) {
        reply = 'MIGO: Gate 2 at Hope Academy logged 3 manual overrides today. Verified guardian contact records are recommended for auditing.';
      }
      setAiChatLogs((prev) => [...prev, { type: 'insight', text: reply }]);
    }, 600);
  };

  return (
    <div className="space-y-4 text-slate-100">
      {/* ========================================================================= */}
      {/* 1. COMMAND & CONTROL SUPERVISORY PRINCIPLE BANNER */}
      {/* ========================================================================= */}
      <div className="bg-gradient-to-r from-[#071d36] via-[#092547] to-[#07172b] rounded-2xl border border-emerald-500/30 p-4 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center font-bold shrink-0 shadow-lg shadow-emerald-500/10">
            <Radio className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-base font-black text-white tracking-wide uppercase flex items-center gap-2">
                City Manager Command & Control
              </h1>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-extrabold border border-emerald-500/40">
                {selectedCity}
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 text-[10px] font-extrabold border border-blue-500/40">
                LIVE SUPERVISION ACTIVE
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-1 font-medium max-w-2xl leading-relaxed">
              <strong className="text-emerald-400">Continuous Operational Oversight:</strong> Approval is not the end of supervision; it is the beginning of monitored operational participation across all schools, escorts, and gates.
            </p>
          </div>
        </div>

        {/* Quick Direct Controls */}
        <div className="flex items-center gap-2 flex-wrap w-full md:w-auto">
          <button
            type="button"
            onClick={() => setBroadcastModal((prev) => ({ ...prev, open: true }))}
            className="px-3.5 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 font-bold text-xs flex items-center gap-1.5 transition-all shadow-sm"
          >
            <Megaphone size={14} />
            <span>City Broadcast</span>
          </button>

          {onOpenTasksApprovals && (
            <button
              type="button"
              onClick={onOpenTasksApprovals}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-750 font-bold text-xs flex items-center gap-1.5 transition-all"
            >
              <ShieldCheck size={14} className="text-emerald-400" />
              <span>Verify Applications</span>
              {pendingApprovalsCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-slate-950 text-[10px] font-black">
                  {pendingApprovalsCount}
                </span>
              )}
            </button>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. REAL-TIME 8-POINT OPERATIONAL TELEMETRY RIBBON */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
        {/* Stat 1: Schools Online */}
        <div
          onClick={() => switchTab('schools')}
          className={`cursor-pointer rounded-2xl border p-3 flex flex-col justify-between transition-all ${
            currentTab === 'schools' ? 'bg-[#0e2747] border-emerald-500 ring-1 ring-emerald-500' : 'bg-[#0b1c30] border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Schools Online</span>
            <School size={15} className="text-emerald-400" />
          </div>
          <div className="mt-2">
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-black text-white">{schools.length}</span>
              <span className="text-[10px] font-bold text-slate-400">Schools</span>
            </div>
            <span className="inline-block mt-1 px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-emerald-500/20 text-emerald-400">
              {schools.length > 0 ? '100% Verified' : 'No Schools'}
            </span>
          </div>
        </div>

        {/* Stat 2: Active Escorts */}
        <div
          onClick={() => switchTab('escorts')}
          className={`cursor-pointer rounded-2xl border p-3 flex flex-col justify-between transition-all ${
            currentTab === 'escorts' ? 'bg-[#0e2747] border-emerald-500 ring-1 ring-emerald-500' : 'bg-[#0b1c30] border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Active Escorts</span>
            <UserCheck size={15} className="text-blue-400" />
          </div>
          <div className="mt-2">
            <span className="text-xl font-black text-white">{escorts.length}</span>
            <div className="text-[9px] text-slate-400 font-semibold mt-0.5 truncate">
              MyEduRide: <strong className="text-white">{escorts.filter(e => e.type === 'myeduride').length}</strong> · Sch: <strong className="text-white">{escorts.filter(e => e.type === 'school').length}</strong>
            </div>
          </div>
        </div>

        {/* Stat 3: Gate Officers */}
        <div
          onClick={() => switchTab('gate-monitor')}
          className={`cursor-pointer rounded-2xl border p-3 flex flex-col justify-between transition-all ${
            currentTab === 'gate-monitor' ? 'bg-[#0e2747] border-emerald-500 ring-1 ring-emerald-500' : 'bg-[#0b1c30] border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Gate Officers</span>
            <DoorOpen size={15} className="text-purple-400" />
          </div>
          <div className="mt-2">
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-black text-white">{gateOfficers.length}</span>
              <span className="text-[10px] font-bold text-emerald-400 font-mono">{gateOfficers.length > 0 ? 'ON DUTY' : 'STANDBY'}</span>
            </div>
            <span className="inline-block mt-1 px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-purple-500/20 text-purple-300">
              {gateActivities.length} Overrides
            </span>
          </div>
        </div>

        {/* Stat 4: Active Trips */}
        <div
          onClick={() => switchTab('trips-management')}
          className={`cursor-pointer rounded-2xl border p-3 flex flex-col justify-between transition-all ${
            currentTab === 'trips-management' ? 'bg-[#0e2747] border-emerald-500 ring-1 ring-emerald-500' : 'bg-[#0b1c30] border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Live Trips</span>
            <Navigation size={15} className="text-cyan-400" />
          </div>
          <div className="mt-2">
            <span className="text-xl font-black text-white">{escorts.filter(e => e.status === 'ON_TRIP').length}</span>
            <div className="text-[9px] text-slate-400 font-semibold mt-0.5 truncate">
              Deputised: <strong className="text-emerald-400">{deputisingRecords.length}</strong>
            </div>
          </div>
        </div>

        {/* Stat 5: Students En Route */}
        <div
          onClick={() => switchTab('assignments')}
          className="bg-[#0b1c30] rounded-2xl border border-slate-800 p-3 flex flex-col justify-between cursor-pointer hover:border-slate-700"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Parent Bookings</span>
            <Users size={15} className="text-indigo-400" />
          </div>
          <div className="mt-2">
            <span className="text-xl font-black text-white">{parentRequests.length}</span>
            <span className="inline-block mt-1 px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-indigo-500/20 text-indigo-300">
              Requests
            </span>
          </div>
        </div>

        {/* Stat 6: Safety Incidents */}
        <div
          onClick={() => switchTab('safety-incidents')}
          className={`cursor-pointer rounded-2xl border p-3 flex flex-col justify-between transition-all ${
            currentTab === 'safety-incidents' ? 'bg-[#0e2747] border-red-500 ring-1 ring-red-500' : 'bg-[#0b1c30] border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Incidents</span>
            <AlertTriangle size={15} className={safetyIncidents.length > 0 ? "text-red-400 animate-bounce" : "text-slate-400"} />
          </div>
          <div className="mt-2">
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-black text-red-400">{safetyIncidents.length}</span>
              <span className="text-[10px] font-bold text-amber-400">Open</span>
            </div>
            <span className="inline-block mt-1 px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-red-500/20 text-red-300">
              {safetyIncidents.length > 0 ? `${safetyIncidents.length} Open` : 'Zero Incidents'}
            </span>
          </div>
        </div>

        {/* Stat 7: Operational Timing */}
        <div
          onClick={() => switchTab('trips-management')}
          className="bg-[#0b1c30] rounded-2xl border border-slate-800 p-3 flex flex-col justify-between cursor-pointer hover:border-slate-700"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Audit Trail</span>
            <Clock size={15} className="text-emerald-400" />
          </div>
          <div className="mt-2">
            <span className="text-xl font-black text-emerald-400">{auditLogs.length}</span>
            <span className="inline-block mt-1 px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-emerald-500/20 text-emerald-400">
              Logged Events
            </span>
          </div>
        </div>

        {/* Stat 8: Escalations */}
        <div
          onClick={() => switchTab('escalations')}
          className={`cursor-pointer rounded-2xl border p-3 flex flex-col justify-between transition-all ${
            currentTab === 'escalations' ? 'bg-[#0e2747] border-amber-500 ring-1 ring-amber-500' : 'bg-[#0b1c30] border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Escalations</span>
            <AlertCircle size={15} className="text-amber-400" />
          </div>
          <div className="mt-2">
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-black text-amber-400">{escalations.length}</span>
              <span className="text-[10px] font-bold text-slate-400">Tickets</span>
            </div>
            <span className="inline-block mt-1 px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-amber-500/20 text-amber-300">
              {escalations.length > 0 ? `${escalations.length} Pending` : 'All Resolved'}
            </span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. SUB-NAVIGATION OPERATIONAL TABS */}
      {/* ========================================================================= */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin border-b border-slate-800">
        {[
          { id: 'dashboard', label: 'Live Command Map & Radar', icon: Radio },
          { id: 'escorts', label: 'Monitor Escorts (MyEduRide & School)', icon: UserCheck, count: escorts.length },
          { id: 'gate-monitor', label: 'Gate Officers & Gate Stream', icon: DoorOpen, count: gateOfficers.length },
          { id: 'trips-management', label: 'Active Trips & Operational Timing', icon: Navigation, count: escorts.filter(e => e.status === 'ON_TRIP').length },
          { id: 'assignments', label: 'Bookings & Escort Assignments', icon: ClipboardList, count: parentRequests.length },
          { id: 'safety-incidents', label: 'Safety Incidents & Panic Triage', icon: AlertTriangle, count: safetyIncidents.length, alert: safetyIncidents.length > 0 },
          { id: 'escalations', label: 'Parent & School Escalations', icon: AlertCircle, count: escalations.length },
          { id: 'communication', label: 'Approved Dispatch & Broadcasts', icon: MessageSquare },
          { id: 'schools', label: 'Schools', icon: School, count: schools.length },
          { id: 'vehicles', label: 'Vehicles Fleet', icon: Car, count: vehicles.length },
          { id: 'audit-logs', label: 'City Governance & Audit Ledger', icon: Shield, count: auditLogs.length },
        ].map((tab) => {
          const TabIcon = tab.icon;
          const isActive = currentTab === tab.id || (currentTab === 'live-operations' && tab.id === 'dashboard');
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => switchTab(tab.id)}
              className={`px-3.5 py-2.5 rounded-xl text-xs font-extrabold flex items-center gap-2 whitespace-nowrap transition-all ${
                isActive
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20 border border-emerald-500'
                  : 'bg-[#08182b] text-slate-300 hover:bg-slate-800 hover:text-white border border-slate-800'
              }`}
            >
              <TabIcon size={14} className={isActive ? 'text-white' : 'text-slate-400'} />
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                    tab.alert
                      ? 'bg-red-500 text-white'
                      : isActive
                      ? 'bg-emerald-800 text-white'
                      : 'bg-slate-800 text-slate-300'
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ========================================================================= */}
      {/* VIEW 1: LIVE COMMAND RADAR & TACTICAL MAP (DASHBOARD / LIVE-OPERATIONS / DEFAULT) */}
      {/* ========================================================================= */}
      {(currentTab === 'dashboard' || currentTab === 'live-operations' || (!['escorts', 'gate-monitor', 'trips-management', 'safety-incidents', 'escalations', 'communication', 'schools', 'vehicles', 'assignments', 'performance', 'reports-analytics', 'settings-access', 'audit-logs'].includes(currentTab))) && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Left Col: Interactive Live Operations Radar Map */}
            <div className="lg:col-span-9 bg-[#0b1c30] rounded-2xl border border-slate-800 p-4 shadow-md flex flex-col justify-between">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-cyan-500/20 border border-cyan-500/40 text-cyan-400 flex items-center justify-center font-bold">
                    <Navigation size={18} />
                  </div>
                  <div>
                    <h3 className="text-xs font-black tracking-wider uppercase text-white flex items-center gap-2">
                      Live City Tactical Radar
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Real-time GPS telemetry for {escorts.length} escorts, {schools.length} schools, and {gateOfficers.length} gate stations in {selectedCity}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-[11px] font-bold">
                  <span className="flex items-center gap-1 text-emerald-400">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Normal Flow ({escorts.filter(e => e.status === 'ON_TRIP' || e.status === 'AVAILABLE').length})
                  </span>
                  <span className="flex items-center gap-1 text-amber-400">
                    <span className="w-2 h-2 rounded-full bg-amber-500"></span> Delayed ({escorts.filter(e => e.status === 'DELAYED').length})
                  </span>
                  <span className="flex items-center gap-1 text-red-400">
                    <span className="w-2 h-2 rounded-full bg-red-500"></span> Speed / Safety Alert ({safetyIncidents.length})
                  </span>
                </div>
              </div>

              {/* Simulated Tactical Map Canvas */}
              <div className="relative my-3 flex-1 min-h-[380px] rounded-2xl overflow-hidden bg-slate-900 border border-slate-800 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:16px_16px] flex items-center justify-center">
                {escorts.length === 0 ? (
                  <div className="text-center p-8 space-y-3 z-10">
                    <div className="w-12 h-12 rounded-2xl bg-slate-800 text-slate-400 flex items-center justify-center mx-auto border border-slate-700">
                      <Navigation size={22} />
                    </div>
                    <h4 className="text-sm font-bold text-white">No Active GPS Telemetry Signals in {selectedCity}</h4>
                    <p className="text-xs text-slate-400 max-w-sm mx-auto">
                      When approved escorts and school transit fleets commence active routes in this jurisdiction, live radar coordinates and vehicle telemetry will appear on this grid in real time.
                    </p>
                  </div>
                ) : (
                  <>
                    {/* SVG Route Vectors */}
                    <div className="absolute inset-0 opacity-40 pointer-events-none">
                      <svg className="w-full h-full text-slate-700" xmlns="http://www.w3.org/2000/svg">
                        <path d="M 20 100 Q 200 80 400 150 T 800 250" fill="none" stroke="#00A859" strokeWidth="3" strokeDasharray="6,6" className="animate-pulse" />
                        <path d="M 150 0 Q 180 200 250 400" fill="none" stroke="#3b82f6" strokeWidth="2.5" />
                      </svg>
                    </div>

                    {/* Live Pins for active escorts */}
                    {escorts.slice(0, 4).map((escort, index) => {
                      const posClasses = [
                        'top-24 left-1/4',
                        'top-1/2 left-1/2',
                        'bottom-20 left-1/3',
                        'bottom-16 right-1/4',
                      ];
                      return (
                        <div
                          key={escort.id}
                          onClick={() => setTripDetailModal(escort)}
                          className={`absolute ${posClasses[index % posClasses.length]} cursor-pointer z-20 group`}
                        >
                          <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-xl border-2 border-white animate-bounce">
                            <Car size={15} />
                          </div>
                          <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-emerald-950 text-emerald-300 border border-emerald-500/50 text-[9px] font-black px-2 py-0.5 rounded-full shadow whitespace-nowrap">
                            {escort.name} ({escort.speed})
                          </div>
                        </div>
                      );
                    })}
                  </>
                )}
              </div>
            </div>

            {/* Right Col: Quick Command Bar & MIGO AI Assistant */}
            <div className="lg:col-span-3 space-y-4 flex flex-col justify-between">
              {/* Quick Actions Panel */}
              <div className="bg-[#0b1c30] rounded-2xl border border-slate-800 p-4 shadow-md">
                <div className="pb-3 border-b border-slate-800">
                  <h3 className="text-xs font-black tracking-wider uppercase text-white">COMMAND ACTIONS</h3>
                </div>

                <div className="grid grid-cols-2 gap-2 my-3">
                  <button
                    type="button"
                    onClick={() => setBroadcastModal({ open: true, audience: 'ALL_CITY_ESCORTS', title: '', body: '', priority: 'URGENT' })}
                    className="p-3 bg-[#07172b] hover:bg-[#0e2747] border border-slate-750 rounded-2xl flex flex-col items-center justify-center text-center transition-all group"
                  >
                    <Megaphone size={18} className="text-amber-400 group-hover:scale-110 transition-transform mb-1" />
                    <span className="text-[10px] font-bold text-slate-200">City Broadcast</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => switchTab('escorts')}
                    className="p-3 bg-[#07172b] hover:bg-[#0e2747] border border-slate-750 rounded-2xl flex flex-col items-center justify-center text-center transition-all group"
                  >
                    <UserX size={18} className="text-red-400 group-hover:scale-110 transition-transform mb-1" />
                    <span className="text-[10px] font-bold text-slate-200">Suspend Escort</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => switchTab('gate-monitor')}
                    className="p-3 bg-[#07172b] hover:bg-[#0e2747] border border-slate-750 rounded-2xl flex flex-col items-center justify-center text-center transition-all group"
                  >
                    <DoorOpen size={18} className="text-purple-400 group-hover:scale-110 transition-transform mb-1" />
                    <span className="text-[10px] font-bold text-slate-200">Gate Overrides</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => switchTab('safety-incidents')}
                    className="p-3 bg-red-950/40 hover:bg-red-900/60 border border-red-500/50 rounded-2xl flex flex-col items-center justify-center text-center transition-all group"
                  >
                    <AlertOctagon size={18} className="text-red-400 group-hover:scale-110 transition-transform mb-1 animate-pulse" />
                    <span className="text-[10px] font-black text-red-300">SOS Incident</span>
                  </button>
                </div>
              </div>

              {/* MIGO AI Operational Assistant */}
              <div className="bg-[#0b1c30] rounded-2xl border border-slate-800 p-4 shadow-md flex-1 flex flex-col justify-between">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
                      <Bot size={14} className="text-emerald-400" />
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-white">MIGO AI COPILOT</h4>
                      <span className="text-[9px] text-slate-400 font-medium block">SAVI City Intelligence</span>
                    </div>
                  </div>
                  <span className="px-1.5 py-0.5 bg-emerald-500/20 text-emerald-400 text-[9px] font-bold rounded">
                    Active
                  </span>
                </div>

                <div className="my-2.5 space-y-2 overflow-y-auto max-h-[160px] pr-1 custom-scrollbar text-[11px]">
                  {aiChatLogs.map((msg, i) => (
                    <div
                      key={i}
                      className={`p-2.5 rounded-xl border leading-snug ${
                        msg.type === 'user'
                          ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-200 text-right ml-4'
                          : 'bg-slate-900 border-slate-800 text-slate-300'
                      }`}
                    >
                      {msg.text}
                    </div>
                  ))}
                </div>

                {/* Chat Input */}
                <div className="relative pt-2 border-t border-slate-800">
                  <input
                    type="text"
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSendAiPrompt()}
                    placeholder="Ask MIGO about delays, escorts, gates..."
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-3 pr-9 py-2 text-xs font-semibold text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={handleSendAiPrompt}
                    className="absolute right-2 top-3.5 p-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
                  >
                    <Send size={12} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 2: ESCORT COMMAND & DISCIPLINARY OVERSIGHT (MYEDURIDE + SCHOOL ESCORTS) */}
      {/* ========================================================================= */}
      {currentTab === 'escorts' && (
        <div className="bg-[#0b1c30] rounded-2xl border border-slate-800 p-5 shadow-xl space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-500/30 text-blue-400 flex items-center justify-center font-bold">
                <UserCheck className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm font-black text-white uppercase tracking-wide flex items-center gap-2">
                  City Escort Command & Supervision
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-extrabold border border-emerald-500/30">
                    {filteredEscorts.length} Active in {selectedCity}
                  </span>
                </h2>
                <p className="text-xs text-slate-400">
                  Continuous oversight for MyEduRide Escorts & School Escorts. Contact, review telemetry, suspend, or block access.
                </p>
              </div>
            </div>

            {/* Filter Toggle: All vs MyEduRide vs School */}
            <div className="flex items-center gap-2">
              <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setEscortTypeFilter('ALL')}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    escortTypeFilter === 'ALL' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  All Escorts ({escorts.length})
                </button>
                <button
                  type="button"
                  onClick={() => setEscortTypeFilter('myeduride')}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    escortTypeFilter === 'myeduride' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  MyEduRide Escorts ({escorts.filter((e) => e.type === 'myeduride').length})
                </button>
                <button
                  type="button"
                  onClick={() => setEscortTypeFilter('school')}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    escortTypeFilter === 'school' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  School Escorts ({escorts.filter((e) => e.type === 'school').length})
                </button>
              </div>
            </div>
          </div>

          {/* Search & Status Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={escortSearch}
                onChange={(e) => setEscortSearch(e.target.value)}
                placeholder="Search escort name, ID, vehicle, or school..."
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs font-semibold text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="flex items-center gap-2 text-xs font-bold text-slate-400 flex-wrap">
              <span>Status:</span>
              <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400">ON TRIP ({escorts.filter(e => e.status === 'ON_TRIP').length})</span>
              <span className="px-2 py-0.5 rounded-md bg-blue-500/20 text-blue-400">AVAILABLE ({escorts.filter(e => e.status === 'AVAILABLE').length})</span>
              <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-400">DELAYED ({escorts.filter(e => e.status === 'DELAYED').length})</span>
              <span className="px-2 py-0.5 rounded-md bg-red-500/20 text-red-400">FLAGGED ({escorts.filter(e => e.status === 'FLAGGED').length})</span>
            </div>
          </div>

          {/* Escort Cards Table / Roster */}
          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#07172b] text-[10px] font-black text-slate-400 uppercase border-b border-slate-800">
                <tr>
                  <th className="p-3.5">Escort Profile</th>
                  <th className="p-3.5">Type & School</th>
                  <th className="p-3.5">Assigned Vehicle</th>
                  <th className="p-3.5">Live Telemetry</th>
                  <th className="p-3.5 text-center">Status</th>
                  <th className="p-3.5 text-center">Compliance</th>
                  <th className="p-3.5 text-right">Command Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80 font-medium text-slate-200">
                {filteredEscorts.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-slate-400">
                      <UserCheck className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                      <p className="text-sm font-bold text-slate-300">No Escorts Registered in {selectedCity}</p>
                      <p className="text-xs text-slate-500 mt-1">Escort applications verified and approved by the City Manager will appear in this live supervisory roster.</p>
                    </td>
                  </tr>
                ) : (
                  filteredEscorts.map((escort) => {
                    const initials = (escort.name || 'E')
                      .split(' ')
                      .map((n: string) => n[0])
                      .slice(0, 2)
                      .join('')
                      .toUpperCase();

                    return (
                      <tr key={escort.id} className="hover:bg-slate-800/40 transition-colors">
                        {/* Name & ID */}
                        <td className="p-3.5">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-white shrink-0">
                              {initials}
                            </div>
                            <div>
                              <strong className="text-white block">{escort.name}</strong>
                              <span className="text-[10px] text-slate-400 font-mono">{escort.id} · {escort.phone}</span>
                            </div>
                          </div>
                        </td>

                        {/* Type & School */}
                        <td className="p-3.5">
                          <div className="space-y-1">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase ${
                                escort.type === 'myeduride'
                                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                  : 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                              }`}
                            >
                              {escort.type === 'myeduride' ? 'MyEduRide Escort' : 'School Escort'}
                            </span>
                            <p className="text-[11px] text-slate-300 font-semibold">{escort.schoolName}</p>
                          </div>
                        </td>

                        {/* Vehicle */}
                        <td className="p-3.5">
                          <div className="text-[11px]">
                            <strong className="text-slate-200 block">{escort.vehicle}</strong>
                            <span className="text-[10px] text-slate-400 font-mono">
                              {escort.currentTripId ? `Active on ${escort.currentTripId}` : 'No Active Trip'}
                            </span>
                          </div>
                        </td>

                        {/* Live Telemetry */}
                        <td className="p-3.5">
                          <div className="space-y-1 text-[11px]">
                            <div className="flex items-center gap-2">
                              <span className="text-emerald-400 font-bold">{escort.speed}</span>
                              <span className="text-slate-500">·</span>
                              <span className="text-cyan-400 font-mono">Bat: {escort.battery}</span>
                            </div>
                            <p className="text-[10px] text-slate-400 truncate max-w-[170px]">{escort.route}</p>
                          </div>
                        </td>

                        {/* Status */}
                        <td className="p-3.5 text-center">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase border ${
                              escort.status === 'ON_TRIP'
                                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                                : escort.status === 'AVAILABLE'
                                ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                                : escort.status === 'DELAYED'
                                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse'
                                : escort.status === 'FLAGGED'
                                ? 'bg-red-500/20 text-red-400 border-red-500/40 font-black'
                                : escort.status === 'SUSPENDED'
                                ? 'bg-amber-950 text-amber-400 border-amber-500/50'
                                : 'bg-red-950 text-red-400 border-red-500/50'
                            }`}
                          >
                            {escort.status.replace(/_/g, ' ')}
                          </span>
                        </td>

                        {/* Compliance & Rating */}
                        <td className="p-3.5 text-center">
                          <div className="inline-block text-center">
                            <span className="text-xs font-black text-amber-400">{escort.rating} ★</span>
                            <span className="block text-[10px] font-bold text-emerald-400">{escort.complianceScore}% Safe</span>
                          </div>
                        </td>

                        {/* Actions */}
                        <td className="p-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() =>
                                setContactModal({
                                  open: true,
                                  target: escort,
                                  targetType: 'ESCORT',
                                  message: '',
                                  channel: 'IN_APP',
                                })
                              }
                              className="p-2 rounded-xl bg-slate-800 hover:bg-emerald-600 text-slate-300 hover:text-white transition-colors"
                              title="Contact Escort"
                            >
                              <PhoneCall size={14} />
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                setDisciplinaryModal({
                                  open: true,
                                  escort,
                                  actionType: 'SUSPEND',
                                  reason: '',
                                  durationDays: '7',
                                })
                              }
                              className="p-2 rounded-xl bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-slate-950 transition-colors"
                              title="Suspend Escort Access"
                            >
                              <Slash size={14} />
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                setDisciplinaryModal({
                                  open: true,
                                  escort,
                                  actionType: 'BLOCK',
                                  reason: '',
                                })
                              }
                              className="p-2 rounded-xl bg-red-500/20 hover:bg-red-600 text-red-300 hover:text-white transition-colors"
                              title="Block Escort Access"
                            >
                              <Ban size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 3: GATE OFFICERS & GATE STREAM MONITOR */}
      {/* ========================================================================= */}
      {currentTab === 'gate-monitor' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Left: Gate Officer Roster */}
            <div className="lg:col-span-7 bg-[#0b1c30] rounded-2xl border border-slate-800 p-5 shadow-xl space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-purple-500/20 border border-purple-500/30 text-purple-400 flex items-center justify-center font-bold">
                    <DoorOpen className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-xs font-black tracking-wider uppercase text-white">
                      Gate Officer Deployment Roster
                    </h3>
                    <p className="text-[11px] text-slate-400">Continuous shift and gate override tracking across city schools</p>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-purple-500/20 text-purple-300 text-xs font-bold border border-purple-500/30">
                  {gateOfficers.length} Stations Monitored
                </span>
              </div>

              {gateOfficers.length === 0 ? (
                <div className="text-center py-12 text-slate-400 border border-slate-800 rounded-2xl bg-slate-900/50">
                  <DoorOpen className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                  <p className="text-sm font-bold text-slate-300">No Gate Officers On Duty in {selectedCity}</p>
                  <p className="text-xs text-slate-500 mt-1">When school gate stations log morning or afternoon shifts, active officer rosters will stream here.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {gateOfficers.map((officer) => (
                    <div
                      key={officer.id}
                      className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-wrap items-center justify-between gap-3 hover:border-slate-700 transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-purple-950/60 border border-purple-500/40 text-purple-300 flex items-center justify-center font-black">
                          GT
                        </div>
                        <div>
                          <strong className="text-white text-xs block">{officer.name}</strong>
                          <span className="text-[11px] text-slate-300 font-semibold">{officer.schoolName} ({officer.gateName})</span>
                          <p className="text-[10px] text-slate-400 font-mono mt-0.5">{officer.shift}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 text-xs font-semibold">
                        <div className="text-right">
                          <span className="text-slate-400 block text-[10px]">Scanned In / Released</span>
                          <span className="font-mono text-emerald-400 font-bold">{officer.scansToday} / {officer.releasesToday}</span>
                        </div>

                        <div className="text-right">
                          <span className="text-slate-400 block text-[10px]">Manual Overrides</span>
                          <span className={`font-mono font-bold ${officer.overridesCount > 1 ? 'text-amber-400' : 'text-slate-300'}`}>
                            {officer.overridesCount}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            setContactModal({
                              open: true,
                              target: officer,
                              targetType: 'GATE_OFFICER',
                              message: '',
                              channel: 'IN_APP',
                            })
                          }
                          className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-purple-600 text-slate-200 hover:text-white text-xs font-bold transition-all flex items-center gap-1"
                        >
                          <PhoneCall size={12} /> Contact
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Right: Live Gate Stream */}
            <div className="lg:col-span-5 bg-[#0b1c30] rounded-2xl border border-slate-800 p-5 shadow-xl space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping"></span>
                  <h3 className="text-xs font-black tracking-wider uppercase text-white">LIVE GATE STREAM</h3>
                </div>
                <span className="text-[10px] text-slate-400 font-mono">Real-time Check-ins & Releases</span>
              </div>

              {gateActivities.length === 0 ? (
                <div className="text-center py-12 text-slate-400 border border-slate-800 rounded-2xl bg-slate-900/50">
                  <Radio className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                  <p className="text-sm font-bold text-slate-300">No Gate Activities Recorded Today</p>
                  <p className="text-xs text-slate-500 mt-1">Real-time QR, NFC, biometric student gate check-ins and handoffs will appear live.</p>
                </div>
              ) : (
                <div className="space-y-2.5 max-h-[480px] overflow-y-auto pr-1 custom-scrollbar">
                  {gateActivities.map((act) => (
                    <div
                      key={act.id}
                      className={`p-3 rounded-2xl border text-xs ${
                        act.status === 'SECURITY_BLOCKED'
                          ? 'bg-red-950/30 border-red-500/40 text-red-200'
                          : act.status === 'OVERRIDE_APPROVED'
                          ? 'bg-amber-950/30 border-amber-500/40 text-amber-200'
                          : 'bg-slate-900/90 border-slate-800 text-slate-200'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 pb-1 mb-1 border-b border-slate-800/60">
                        <span>{act.time} · {act.school}</span>
                        <span
                          className={`px-1.5 py-0.2 rounded font-extrabold ${
                            act.status === 'SECURITY_BLOCKED'
                              ? 'bg-red-500 text-white'
                              : act.status === 'OVERRIDE_APPROVED'
                              ? 'bg-amber-500 text-slate-950'
                              : 'bg-emerald-500/20 text-emerald-400'
                          }`}
                        >
                          {act.status}
                        </span>
                      </div>

                      <div className="space-y-1">
                        <div className="flex justify-between">
                          <strong className="text-white">{act.student}</strong>
                          <span className="text-slate-400 text-[11px]">{act.gate}</span>
                        </div>
                        <p className="text-[11px] text-slate-300">
                          <strong className="text-slate-400">Actor:</strong> {act.actor} ({act.actorType})
                        </p>
                        <p className="text-[10px] text-slate-400 italic">
                          Verified by: {act.officer} via {act.verification}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 4: ACTIVE TRIPS & OPERATIONAL TIMING */}
      {/* ========================================================================= */}
      {currentTab === 'trips-management' && (
        <div className="space-y-4">
          {/* Operational Timing Strip */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="bg-[#0b1c30] rounded-2xl border border-slate-800 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400">Punctuality Score</span>
                <Clock size={16} className="text-emerald-400" />
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-black text-emerald-400">100%</span>
                <span className="text-xs text-slate-400">Jurisdiction Compliance</span>
              </div>
            </div>

            <div className="bg-[#0b1c30] rounded-2xl border border-slate-800 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400">Active Transit Escorts</span>
                <Navigation size={16} className="text-cyan-400" />
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-black text-white">{escorts.length}</span>
                <span className="text-xs text-slate-400">Active Escorts</span>
              </div>
            </div>

            <div className="bg-[#0b1c30] rounded-2xl border border-slate-800 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400">Emergency Deputised</span>
                <AlertTriangle size={16} className="text-amber-400" />
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-black text-amber-400">{deputisingRecords.length}</span>
                <span className="text-xs text-slate-400">Deputised Records</span>
              </div>
            </div>
          </div>

          {/* Active Trips Dispatch Table */}
          <div className="bg-[#0b1c30] rounded-2xl border border-slate-800 p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h3 className="text-sm font-black tracking-wide uppercase text-white">
                  Live Trip Dispatch & Manifest Command
                </h3>
                <p className="text-xs text-slate-400">Active student movements and transit checkpoint verification</p>
              </div>
              <span className="px-3 py-1 rounded-full bg-cyan-500/20 text-cyan-300 text-xs font-bold border border-cyan-500/30">
                {escorts.filter(e => e.status === 'ON_TRIP').length} Active Trips
              </span>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-800">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#07172b] text-[10px] font-black text-slate-400 uppercase border-b border-slate-800">
                  <tr>
                    <th className="p-3">Trip ID & Route</th>
                    <th className="p-3">Escort & Vehicle</th>
                    <th className="p-3">Destination School</th>
                    <th className="p-3 text-center">Students Manifest</th>
                    <th className="p-3 text-center">Live Speed & Telemetry</th>
                    <th className="p-3 text-center">ETA & Punctuality</th>
                    <th className="p-3 text-right">Inspect</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80 font-medium text-slate-200">
                  {escorts.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-12 text-slate-400">
                        <Navigation className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                        <p className="text-sm font-bold text-slate-300">No Active Trips Dispatched in {selectedCity}</p>
                        <p className="text-xs text-slate-500 mt-1">Live trip telemetry will appear here when escorts start scheduled runs.</p>
                      </td>
                    </tr>
                  ) : (
                    escorts.map((e) => (
                      <tr key={e.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="p-3">
                          <span className="font-mono font-bold text-white block">{e.currentTripId || 'STANDBY'}</span>
                          <span className="text-[10px] text-slate-400 truncate block max-w-[200px]">{e.route}</span>
                        </td>
                        <td className="p-3">
                          <strong className="text-white block">{e.name}</strong>
                          <span className="text-[10px] text-slate-400 font-mono">{e.vehicle}</span>
                        </td>
                        <td className="p-3">
                          <span className="text-slate-200 font-semibold">{e.schoolName}</span>
                        </td>
                        <td className="p-3 text-center">
                          <span className="font-mono font-bold text-white text-xs px-2 py-0.5 rounded-lg bg-slate-800">
                            {e.studentsCount > 0 ? `${e.studentsCount} Students` : '0'}
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          <span className="text-emerald-400 font-bold block">{e.speed}</span>
                          <span className="text-[10px] text-slate-400 font-mono">Bat: {e.battery}</span>
                        </td>
                        <td className="p-3 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                              e.status === 'DELAYED'
                                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                                : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                            }`}
                          >
                            {e.status === 'DELAYED' ? 'Delayed (+18m)' : 'On Schedule'}
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          <button
                            type="button"
                            onClick={() => setTripDetailModal(e)}
                            className="px-3 py-1 rounded-xl bg-slate-800 hover:bg-emerald-600 text-slate-200 hover:text-white font-bold text-xs transition-colors"
                          >
                            View ↗
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
      {currentTab === 'assignments' && <CityManagerOperationsPanel />}


      {/* ========================================================================= */}
      {/* VIEW 5: SAFETY INCIDENTS & EMERGENCY ESCALATIONS */}
      {/* ========================================================================= */}
      {currentTab === 'safety-incidents' && (
        <div className="bg-[#0b1c30] rounded-2xl border border-slate-800 p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-red-500/20 border border-red-500/30 text-red-400 flex items-center justify-center font-bold">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-black tracking-wide uppercase text-white">
                  Safety Command & Incident Triage Center
                </h3>
                <p className="text-xs text-slate-400">Review safety escalations, speed breaches, route deviations, and emergency interventions</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setBroadcastModal({ open: true, audience: 'ALL_CITY_ESCORTS', title: 'EMERGENCY SAFETY ADVISORY', body: '', priority: 'EMERGENCY' })}
              className="px-3.5 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-extrabold text-xs flex items-center gap-1.5 shadow-lg shadow-red-600/30"
            >
              <AlertOctagon size={14} />
              <span>Broadcast Emergency Warning</span>
            </button>
          </div>

          <div className="space-y-3">
            {safetyIncidents.length === 0 ? (
              <div className="text-center py-12 text-slate-400 border border-slate-800 rounded-2xl bg-slate-900/50">
                <ShieldCheck className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                <p className="text-sm font-bold text-slate-300">Zero Open Safety Incidents</p>
                <p className="text-xs text-slate-500 mt-1">Real-time SOS triggers, speed violations, and transit alerts in {selectedCity} will triage here.</p>
              </div>
            ) : (
              safetyIncidents.map((inc) => (
                <div
                  key={inc.id}
                  className={`p-4 rounded-2xl border flex flex-col md:flex-row items-start md:items-center justify-between gap-4 transition-all ${
                    inc.severity === 'CRITICAL'
                      ? 'bg-red-950/40 border-red-500/60 shadow-lg ring-1 ring-red-500/40'
                      : 'bg-slate-900 border-slate-800'
                  }`}
                >
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                          inc.severity === 'CRITICAL' ? 'bg-red-600 text-white' : 'bg-amber-500 text-slate-950'
                        }`}
                      >
                        {inc.severity}
                      </span>
                      <span className="font-mono text-slate-400 text-xs">{inc.id} · {inc.time}</span>
                      <span className="text-white font-bold text-xs">{inc.school}</span>
                    </div>

                    <h4 className="text-sm font-bold text-white">{inc.title}</h4>
                    <p className="text-xs text-slate-300">{inc.description}</p>
                    <p className="text-[11px] text-emerald-400 font-semibold">
                      <strong className="text-slate-400">Action Plan:</strong> {inc.actionRequired}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        const matched = escorts.find((e) => inc.escort && inc.escort.includes(e.id));
                        if (matched) {
                          setDisciplinaryModal({
                            open: true,
                            escort: matched,
                            actionType: 'SUSPEND',
                            reason: `Suspension triggered by safety incident ${inc.id}: ${inc.title}`,
                            durationDays: '7',
                          });
                        } else {
                          toast.info('Direct escort profile attached to this incident.');
                        }
                      }}
                      className="px-3 py-2 rounded-xl bg-amber-500 text-slate-950 hover:bg-amber-400 font-bold text-xs flex items-center gap-1"
                    >
                      <Slash size={12} /> Disciplinary Action
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setSafetyIncidents((prev) =>
                          prev.map((i) => (i.id === inc.id ? { ...i, status: 'RESOLVED' } : i))
                        );
                        toast.success(`Incident ${inc.id} marked as RESOLVED.`);
                      }}
                      className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1"
                    >
                      <Check size={12} /> Resolve Incident
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 6: SCHOOL & PARENT ESCALATIONS */}
      {/* ========================================================================= */}
      {currentTab === 'escalations' && (
        <div className="bg-[#0b1c30] rounded-2xl border border-slate-800 p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-400 flex items-center justify-center font-bold">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-black tracking-wide uppercase text-white">
                  School & Parent Escalation Resolution Center
                </h3>
                <p className="text-xs text-slate-400">Review parent disputes, service complaints, and school management tickets</p>
              </div>
            </div>

            <span className="px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 text-xs font-bold border border-amber-500/30">
              {escalations.length} Pending Tickets
            </span>
          </div>

          <div className="space-y-3">
            {escalations.length === 0 ? (
              <div className="text-center py-12 text-slate-400 border border-slate-800 rounded-2xl bg-slate-900/50">
                <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                <p className="text-sm font-bold text-slate-300">All Escalations Resolved</p>
                <p className="text-xs text-slate-500 mt-1">No active parent queries or school transport tickets pending resolution in {selectedCity}.</p>
              </div>
            ) : (
              escalations.map((esc) => (
                <div key={esc.id} className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${
                          esc.type === 'PARENT' ? 'bg-indigo-500/20 text-indigo-300' : 'bg-purple-500/20 text-purple-300'
                        }`}
                      >
                        {esc.type} ESCALATION
                      </span>
                      <strong className="text-white">{esc.from}</strong>
                      <span className="text-slate-400 font-mono text-[10px]">({esc.date})</span>
                    </div>

                    <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-bold">
                      {esc.status}
                    </span>
                  </div>

                  <h4 className="text-sm font-bold text-white">{esc.subject}</h4>
                  <p className="text-xs text-slate-300 leading-relaxed">{esc.details}</p>

                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-3">
                    <div className="text-[11px] text-slate-400 font-mono">
                      Related Student: <strong className="text-white">{esc.student}</strong> · Escort: <strong className="text-white">{esc.escort}</strong>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setContactModal({
                            open: true,
                            target: { name: esc.from },
                            targetType: 'PARENT',
                            message: '',
                            channel: 'IN_APP',
                          })
                        }
                        className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1"
                      >
                        <PhoneCall size={12} /> Contact Stakeholder
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setEscalations((prev) => prev.filter((e) => e.id !== esc.id));
                          toast.success(`Escalation ticket ${esc.id} resolved and archived.`);
                        }}
                        className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1"
                      >
                        <Check size={12} /> Resolve Ticket
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 7: APPROVED PLATFORM COMMUNICATION & BROADCASTS */}
      {/* ========================================================================= */}
      {currentTab === 'communication' && (
        <div className="bg-[#0b1c30] rounded-2xl border border-slate-800 p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center font-bold">
                <MessageSquare className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-black tracking-wide uppercase text-white">
                  Approved Platform Communication Center
                </h3>
                <p className="text-xs text-slate-400">Direct secure dispatch channel with Escorts, Gate Officers, and School Authorities</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setBroadcastModal({ open: true, audience: 'ALL_CITY_ESCORTS', title: '', body: '', priority: 'URGENT' })}
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5"
            >
              <Megaphone size={14} />
              <span>Create New Broadcast</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-emerald-400">MyEduRide Escort Dispatch</span>
                <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px]">{escorts.filter(e => e.type === 'myeduride').length} Active</span>
              </div>
              <p className="text-xs text-slate-400">Instant direct push dispatch, route orders, and automated safety check-ins.</p>
              <button
                type="button"
                onClick={() => setContactModal({ open: true, target: { name: 'All MyEduRide Escorts' }, targetType: 'ESCORT', message: '', channel: 'IN_APP' })}
                className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold"
              >
                Open Escort Channel →
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-purple-400">Gate Security Officers</span>
                <span className="px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 text-[10px]">{gateOfficers.length} On Duty</span>
              </div>
              <p className="text-xs text-slate-400">Direct gate clearance alerts, emergency visitor advisories, and override queries.</p>
              <button
                type="button"
                onClick={() => setContactModal({ open: true, target: { name: 'All Gate Officers' }, targetType: 'GATE_OFFICER', message: '', channel: 'IN_APP' })}
                className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold"
              >
                Open Gate Channel →
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-blue-400">School Administration</span>
                <span className="px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 text-[10px]">{schools.length} Online</span>
              </div>
              <p className="text-xs text-slate-400">Liaison with school principals, transport directors, and emergency contacts.</p>
              <button
                type="button"
                onClick={() => setContactModal({ open: true, target: { name: 'City School Admins' }, targetType: 'SCHOOL', message: '', channel: 'IN_APP' })}
                className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold"
              >
                Open School Channel →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 8: SCHOOLS MONITOR */}
      {/* ========================================================================= */}
      {currentTab === 'schools' && (
        <div className="bg-[#0b1c30] rounded-2xl border border-slate-800 p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-500/30 text-blue-400 flex items-center justify-center font-bold">
                <School className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-black tracking-wide uppercase text-white">
                  City Schools Operations & Connectivity Roster
                </h3>
                <p className="text-xs text-slate-400">Real-time status of {schools.length} active schools in {selectedCity}</p>
              </div>
            </div>
            <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold border border-emerald-500/30">
              {schools.length} Enrolled
            </span>
          </div>

          {schools.length === 0 ? (
            <div className="text-center py-12 text-slate-400 border border-slate-800 rounded-2xl bg-slate-900/50">
              <School className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              <p className="text-sm font-bold text-slate-300">No Schools Registered in {selectedCity}</p>
              <p className="text-xs text-slate-500 mt-1">Institutions approved for MyEduRide transit supervision in this city will list here.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {schools.map((sch) => (
                <div key={sch.id} className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-2.5 hover:border-slate-700 transition-all">
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-extrabold border border-emerald-500/30">
                      {sch.status}
                    </span>
                    <span className="font-mono text-slate-400 text-xs">{sch.id}</span>
                  </div>
                  <h4 className="text-sm font-bold text-white">{sch.name}</h4>
                  <p className="text-xs text-slate-400">{sch.address || sch.area}</p>
                  <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs">
                    <div>
                      <span className="text-slate-400 block text-[10px]">Students</span>
                      <strong className="text-white">{sch.studentsCount}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Escorts</span>
                      <strong className="text-cyan-400">{sch.escortsCount}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Compliance</span>
                      <strong className="text-emerald-400">{sch.complianceScore || 100}%</strong>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 9: VEHICLES & FLEET */}
      {/* ========================================================================= */}
      {currentTab === 'vehicles' && (
        <div className="bg-[#0b1c30] rounded-2xl border border-slate-800 p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 flex items-center justify-center font-bold">
                <Car className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-black tracking-wide uppercase text-white">
                  Vehicle Fleet Registry & GPS Telemetry
                </h3>
                <p className="text-xs text-slate-400">Tracking {vehicles.length} registered vehicles operating in {selectedCity}</p>
              </div>
            </div>
            <span className="px-3 py-1 rounded-full bg-cyan-500/20 text-cyan-300 text-xs font-bold border border-cyan-500/30">
              {vehicles.length} Vehicles
            </span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#07172b] text-[10px] font-black text-slate-400 uppercase border-b border-slate-800">
                <tr>
                  <th className="p-3">Vehicle Details</th>
                  <th className="p-3">Plate & Type</th>
                  <th className="p-3">Assigned Escort</th>
                  <th className="p-3">School Station</th>
                  <th className="p-3 text-center">Status</th>
                  <th className="p-3 text-right">Speed / Telemetry</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80 font-medium text-slate-200">
                {vehicles.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-slate-400">
                      <Car className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                      <p className="text-sm font-bold text-slate-300">No Vehicles Registered in {selectedCity}</p>
                      <p className="text-xs text-slate-500 mt-1">Verified vehicle inspection records and trackers will be listed here.</p>
                    </td>
                  </tr>
                ) : (
                  vehicles.map((v) => (
                    <tr key={v.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="p-3">
                        <strong className="text-white block">{v.model}</strong>
                        <span className="text-[10px] text-slate-400 font-mono">{v.id}</span>
                      </td>
                      <td className="p-3">
                        <span className="font-mono font-bold text-slate-200 block">{v.plateNumber}</span>
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400">{v.type}</span>
                      </td>
                      <td className="p-3">
                        <span className="text-white font-semibold">{v.escortName}</span>
                      </td>
                      <td className="p-3">
                        <span className="text-slate-300">{v.schoolName}</span>
                      </td>
                      <td className="p-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          v.status === 'IN_TRANSIT' ? 'bg-emerald-500/20 text-emerald-400' : v.status === 'STANDBY' ? 'bg-blue-500/20 text-blue-300' : 'bg-red-500/20 text-red-400'
                        }`}>
                          {v.status}
                        </span>
                      </td>
                      <td className="p-3 text-right font-mono">
                        <span className="text-emerald-400 font-bold block">{v.speed}</span>
                        <span className="text-[10px] text-slate-400">Fuel: {v.fuel}</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 10: CITY GOVERNANCE & AUDIT TRAIL */}
      {/* ========================================================================= */}
      {currentTab === 'audit-logs' && (
        <div className="bg-[#0b1c30] rounded-2xl border border-slate-800 p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center font-bold">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-black tracking-wide uppercase text-white">
                  City Governance & Operational Audit Ledger
                </h3>
                <p className="text-xs text-slate-400">
                  Immutable supervisory log of all actions taken by users and authorities in {selectedCity}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => toast.success('Audit ledger exported to encrypted compliance archive.')}
              className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5"
            >
              Export Audit Trail
            </button>
          </div>

          <div className="space-y-2.5">
            {auditLogs.length === 0 ? (
              <div className="text-center py-12 text-slate-400 border border-slate-800 rounded-2xl bg-slate-900/50">
                <Shield className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <p className="text-sm font-bold text-slate-300">No Audit Events Logged</p>
                <p className="text-xs text-slate-500 mt-1">Supervisory assignments, verifications, disciplinary actions, and emergency overrides will be recorded here.</p>
              </div>
            ) : (
              auditLogs.map((log) => (
                <div
                  key={log.id}
                  className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-[10px] text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                      {log.time}
                    </span>
                    <div>
                      <strong className="text-white block">{log.action.replace(/_/g, ' ')}</strong>
                      <p className="text-slate-300 text-[11px]">{log.details}</p>
                    </div>
                  </div>

                  <div className="text-right text-[11px] font-mono">
                    <span className="text-emerald-400 font-bold block">Actor: {log.actor}</span>
                    <span className="text-slate-400">Target: {log.target}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. MODAL: ESCORT DISCIPLINARY ACTIONS (SUSPEND / DEACTIVATE / BLOCK) */}
      {/* ========================================================================= */}
      {disciplinaryModal.open && disciplinaryModal.escort && (
        <div className="fixed inset-0 z-[9999] bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 text-white shadow-2xl space-y-4 animate-in fade-in">
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold ${
                  disciplinaryModal.actionType === 'BLOCK'
                    ? 'bg-red-500/20 text-red-400 border border-red-500/40'
                    : 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                }`}
              >
                {disciplinaryModal.actionType === 'BLOCK' ? <Ban size={20} /> : <Slash size={20} />}
              </div>
              <div>
                <h3 className="text-base font-extrabold text-white">
                  {disciplinaryModal.actionType === 'SUSPEND'
                    ? 'Suspend Escort Access'
                    : disciplinaryModal.actionType === 'BLOCK'
                    ? 'Emergency Block Escort'
                    : 'Deactivate Escort Account'}
                </h3>
                <p className="text-xs text-slate-400">
                  Target: <strong className="text-white">{disciplinaryModal.escort.name}</strong> ({disciplinaryModal.escort.id})
                </p>
              </div>
            </div>

            {disciplinaryModal.actionType === 'SUSPEND' && (
              <div>
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                  Suspension Duration
                </label>
                <select
                  value={disciplinaryModal.durationDays}
                  onChange={(e) => setDisciplinaryModal((prev) => ({ ...prev, durationDays: e.target.value }))}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white font-semibold focus:ring-2 focus:ring-amber-500"
                >
                  <option value="3">3 Days (Minor Safety Flag)</option>
                  <option value="7">7 Days (Speed/Route Compliance Review)</option>
                  <option value="14">14 Days (Formal Investigation)</option>
                  <option value="30">30 Days (Extended Regulatory Hold)</option>
                </select>
              </div>
            )}

            <div>
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                Mandatory Supervisory Justification *
              </label>
              <textarea
                rows={3}
                value={disciplinaryModal.reason}
                onChange={(e) => setDisciplinaryModal((prev) => ({ ...prev, reason: e.target.value }))}
                placeholder="e.g. Exceeded school speed limit twice; pending safe driver refresher course."
                className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={handleExecuteDisciplinary}
                className={`flex-1 py-2.5 rounded-xl font-bold text-xs transition-all ${
                  disciplinaryModal.actionType === 'BLOCK'
                    ? 'bg-red-600 hover:bg-red-500 text-white'
                    : 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                }`}
              >
                Confirm {disciplinaryModal.actionType} Action
              </button>
              <button
                type="button"
                onClick={() => setDisciplinaryModal({ open: false, escort: null, actionType: null, reason: '', durationDays: '7' })}
                className="py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. MODAL: CONTACT STAKEHOLDER / DISPATCH MESSAGE */}
      {/* ========================================================================= */}
      {contactModal.open && contactModal.target && (
        <div className="fixed inset-0 z-[9999] bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 text-white shadow-2xl space-y-4 animate-in fade-in">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center font-bold">
                <PhoneCall size={20} />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-white">Contact Platform Stakeholder</h3>
                <p className="text-xs text-slate-400">
                  Recipient: <strong className="text-white">{contactModal.target.name || contactModal.target.schoolName}</strong>
                </p>
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                Communication Dispatch Channel
              </label>
              <div className="grid grid-cols-3 gap-2 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setContactModal((prev) => ({ ...prev, channel: 'IN_APP' }))}
                  className={`p-2 rounded-xl border text-center transition-all ${
                    contactModal.channel === 'IN_APP' ? 'bg-emerald-600 text-white border-emerald-500' : 'bg-slate-950 border-slate-800 text-slate-400'
                  }`}
                >
                  In-App Dispatch
                </button>
                <button
                  type="button"
                  onClick={() => setContactModal((prev) => ({ ...prev, channel: 'URGENT_SMS' }))}
                  className={`p-2 rounded-xl border text-center transition-all ${
                    contactModal.channel === 'URGENT_SMS' ? 'bg-emerald-600 text-white border-emerald-500' : 'bg-slate-950 border-slate-800 text-slate-400'
                  }`}
                >
                  Urgent SMS
                </button>
                <button
                  type="button"
                  onClick={() => setContactModal((prev) => ({ ...prev, channel: 'DISPATCH_CALL' }))}
                  className={`p-2 rounded-xl border text-center transition-all ${
                    contactModal.channel === 'DISPATCH_CALL' ? 'bg-emerald-600 text-white border-emerald-500' : 'bg-slate-950 border-slate-800 text-slate-400'
                  }`}
                >
                  Voice Call
                </button>
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                Dispatch Message / Instructions *
              </label>
              <textarea
                rows={3}
                value={contactModal.message}
                onChange={(e) => setContactModal((prev) => ({ ...prev, message: e.target.value }))}
                placeholder="Enter official message to dispatch..."
                className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={handleSendContact}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs"
              >
                Send Dispatch Message
              </button>
              <button
                type="button"
                onClick={() => setContactModal({ open: false, target: null, targetType: null, message: '', channel: 'IN_APP' })}
                className="py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. MODAL: CITY-WIDE BROADCAST DISPATCH */}
      {/* ========================================================================= */}
      {broadcastModal.open && (
        <div className="fixed inset-0 z-[9999] bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 text-white shadow-2xl space-y-4 animate-in fade-in">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center font-bold">
                <Megaphone size={20} />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-white">City-Wide Operations Broadcast</h3>
                <p className="text-xs text-slate-400">Broadcast official alerts to stakeholders in {selectedCity}</p>
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                Target Audience
              </label>
              <select
                value={broadcastModal.audience}
                onChange={(e) => setBroadcastModal((prev) => ({ ...prev, audience: e.target.value as any }))}
                className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white font-semibold focus:ring-2 focus:ring-amber-500"
              >
                <option value="ALL_CITY_ESCORTS">All Escorts (MyEduRide & School - 245)</option>
                <option value="MYEDURIDE_ONLY">MyEduRide Independent Escorts Only (172)</option>
                <option value="GATE_OFFICERS">Gate Security Officers Only (64)</option>
                <option value="ALL_SCHOOLS">School Authorities Only (52)</option>
              </select>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                Broadcast Title *
              </label>
              <input
                type="text"
                value={broadcastModal.title}
                onChange={(e) => setBroadcastModal((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="e.g. TRAFFIC ALERT: Third Mainland Bridge Heavy Gridlock"
                className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                Broadcast Body *
              </label>
              <textarea
                rows={3}
                value={broadcastModal.body}
                onChange={(e) => setBroadcastModal((prev) => ({ ...prev, body: e.target.value }))}
                placeholder="Enter alert details, required speed precautions, and diversion recommendations..."
                className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={handleSendBroadcast}
                className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs"
              >
                Transmit City Broadcast
              </button>
              <button
                type="button"
                onClick={() => setBroadcastModal({ open: false, audience: 'ALL_CITY_ESCORTS', title: '', body: '', priority: 'URGENT' })}
                className="py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 7. MODAL: TRIP DETAIL INSPECTOR */}
      {/* ========================================================================= */}
      {tripDetailModal && (
        <div className="fixed inset-0 z-[9999] bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 text-white shadow-2xl space-y-4 animate-in fade-in">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 border border-cyan-500/40 text-cyan-400 flex items-center justify-center font-bold">
                  <Navigation size={20} />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white">Live Trip Telemetry & Manifest</h3>
                  <span className="text-xs text-slate-400 font-mono">Trip #{tripDetailModal.currentTripId || 'STANDBY'}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setTripDetailModal(null)}
                className="p-1 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                <p><strong className="text-slate-400">Escort:</strong> {tripDetailModal.name} ({tripDetailModal.id})</p>
                <p><strong className="text-slate-400">Vehicle:</strong> {tripDetailModal.vehicle}</p>
                <p><strong className="text-slate-400">Destination:</strong> {tripDetailModal.schoolName}</p>
                <p><strong className="text-slate-400">Route:</strong> {tripDetailModal.route}</p>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">Speed</span>
                  <span className="font-bold text-emerald-400 text-xs">{tripDetailModal.speed}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">Battery</span>
                  <span className="font-bold text-cyan-400 text-xs">{tripDetailModal.battery}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">Compliance</span>
                  <span className="font-bold text-amber-400 text-xs">{tripDetailModal.complianceScore}% Safe</span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <strong className="text-white block mb-1">Supervisor Notes / Alerts</strong>
                <p className="text-slate-300 text-[11px]">{tripDetailModal.notes}</p>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setTripDetailModal(null);
                  setContactModal({
                    open: true,
                    target: tripDetailModal,
                    targetType: 'ESCORT',
                    message: '',
                    channel: 'IN_APP',
                  });
                }}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs"
              >
                Contact Escort Now
              </button>
              <button
                type="button"
                onClick={() => setTripDetailModal(null)}
                className="py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
