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
  Home,
  ExternalLink,
  ShieldCheck,
  ShieldAlert,
  BarChart3,
  ClipboardList,
  Settings,
  Sliders,
  CheckSquare,
  Battery,
  BatteryCharging,
  BatteryWarning,
  Gauge,
  Smartphone,
  Tag,
  BadgePercent,
} from 'lucide-react';
import { toast } from 'sonner';
import StudentAvatar from '@/components/shared/StudentAvatar';
import { CityManagerOperationsPanel } from '@/components/city-manager/CityManagerOperationsPanel';
import InteractiveRouteCorridorMap from '@/components/routes/InteractiveRouteCorridorMap';
import SchoolHomeRouteMap from '@/components/routes/SchoolHomeRouteMap';

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
  const [transitRoutes, setTransitRoutes] = useState<any[]>([]);
  const [selectedCorridorRoute, setSelectedCorridorRoute] = useState<any>(null);
  const [corridorSchool, setCorridorSchool] = useState<any>(null);
  const [corridorMetrics, setCorridorMetrics] = useState<any>(null);
  const [loadingCorridors, setLoadingCorridors] = useState(false);
  const [pinnedParentAddresses, setPinnedParentAddresses] = useState<any[]>([]);
  const [pinnedAddressSearch, setPinnedAddressSearch] = useState('');
  const [pinnedAddressSchoolFilter, setPinnedAddressSchoolFilter] = useState('ALL');

  const loadCorridors = async () => {
    try {
      setLoadingCorridors(true);
      const res = await fetch('/api/school-admin/routes');
      const json = await res.json();
      if (json.success) {
        setTransitRoutes(json.routes || []);
        setCorridorSchool(json.school || null);
        setCorridorMetrics(json.metrics || null);
        if (json.all_pinned_students?.length > 0) {
          setPinnedParentAddresses((prev) => (prev.length > 0 ? prev : json.all_pinned_students));
        }
        if (json.routes?.length > 0) {
          setSelectedCorridorRoute((prev) => prev || json.routes[0]);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingCorridors(false);
    }
  };

  useEffect(() => {
    if (currentTab === 'corridor-map') {
      loadCorridors();
    }
  }, [currentTab]);

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
                escortsCount: s.escortsCount || 0,
                studentsCount: s.studentsCount || (Array.isArray(s.students) ? s.students.length : 0),
                students: Array.isArray(s.students) ? s.students : [],
                gatesCount: s.gateOfficersCount || 1,
                gateOfficersCount: s.gateOfficersCount || 1,
                gateOfficers: 'Gate Officer',
                status: s.status || 'ONLINE',
                avgMorningEta: '07:30 AM',
                complianceScore: s.complianceScore || 100,
              }))
            );
          }
          if (Array.isArray(data.escorts)) {
            setEscorts(
              data.escorts.map((e: any) => ({
                id: e.id,
                name: e.full_name || 'Verified Escort',
                type: e.operating_area?.toLowerCase().includes('school') || e.school_id ? 'school' : 'myeduride',
                phone: e.phone || '—',
                status: e.availability_status === 'available' ? 'AVAILABLE' : e.status === 'ACTIVE' ? 'ON_TRIP' : 'STANDBY',
                schoolName: e.assigned_school_name || e.school_name || e.operating_area || selectedCity,
                schoolId: e.assigned_school_id || e.school_id || null,
                vehicle: e.application_data?.assignedVehicle || e.application_data?.regNumber || 'Verified Vehicle',
                currentTripId: null,
                route: e.operating_area ? `${e.operating_area} Corridor` : 'Designated Route',
                studentsCount: e.assigned_students_count || (Array.isArray(e.assigned_students) ? e.assigned_students.length : 0),
                assignedStudents: Array.isArray(e.assigned_students) ? e.assigned_students : [],
                speed: e.speed || `${e.speed_kmh || 0} km/h`,
                speed_kmh: e.speed_kmh || 0,
                battery: e.battery || `${e.battery_level || 85}%`,
                battery_level: e.battery_level || 85,
                battery_status: e.battery_status || 'GOOD',
                device_status: e.device_status || 'ACTIVE',
                device_model: e.device_model || 'Samsung Galaxy A14 (App v2.4)',
                lastPing: e.last_ping_at || 'Live',
                last_ping_at: e.last_ping_at || 'Live',
                complianceScore: 100,
                rating: 5.0,
                tripsToday: 0,
                avatar: e.application_data?.photo || '',
                notes: 'Verified escort profile on file.',
              }))
            );
          }
          if (Array.isArray(data.gate_officers) && data.gate_officers.length > 0) {
            setGateOfficers(data.gate_officers);
          }
          if (Array.isArray(data.gate_activities) && data.gate_activities.length > 0) {
            setGateActivities(data.gate_activities);
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
          if (Array.isArray(data.vehicles)) {
            setVehicles(data.vehicles);
          }
          if (Array.isArray(data.deputising_records)) {
            setDeputisingRecords(data.deputising_records);
          }
          if (Array.isArray(data.parent_requests)) {
            setParentRequests(data.parent_requests);
          }
          if (Array.isArray(data.pinned_parent_addresses)) {
            setPinnedParentAddresses(data.pinned_parent_addresses);
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

  const [assignedStudentsModal, setAssignedStudentsModal] = useState<{
    open: boolean;
    escort: any | null;
  }>({
    open: false,
    escort: null,
  });

  const [assignSchoolModal, setAssignSchoolModal] = useState<{
    open: boolean;
    escort: any | null;
    schoolId: string;
    notes: string;
    submitting: boolean;
  }>({
    open: false,
    escort: null,
    schoolId: '',
    notes: '',
    submitting: false,
  });

  const handleCommandAssignSchoolSubmit = async () => {
    if (!assignSchoolModal.escort?.id || !assignSchoolModal.schoolId) {
      toast.error('Please select a school to assign.');
      return;
    }
    const matchedSchool = schools.find((s) => s.id === assignSchoolModal.schoolId);
    const schoolName = matchedSchool?.name || 'Designated School Campus';
    setAssignSchoolModal((prev) => ({ ...prev, submitting: true }));

    try {
      const res = await fetch('/api/city-manager/operations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'quick_approve_and_assign_school',
          escortApplicationId: assignSchoolModal.escort.id,
          schoolId: assignSchoolModal.schoolId,
          schoolName,
          notes: assignSchoolModal.notes || `Assigned to ${schoolName} by City Manager`,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Failed to assign escort to school');

      setEscorts((prev) =>
        prev.map((e) =>
          e.id === assignSchoolModal.escort.id
            ? { ...e, schoolName, schoolId: assignSchoolModal.schoolId, type: 'school' }
            : e
        )
      );

      toast.success(`Escort ${assignSchoolModal.escort.name} assigned to ${schoolName}!`);
      setAssignSchoolModal({ open: false, escort: null, schoolId: '', notes: '', submitting: false });
    } catch (err: any) {
      toast.error(err.message || 'Could not assign escort');
      setAssignSchoolModal((prev) => ({ ...prev, submitting: false }));
    }
  };

  const [inspectRouteModal, setInspectRouteModal] = useState<{
    open: boolean;
    item: any | null;
  }>({
    open: false,
    item: null,
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

  // Escort Telemetry & Health Filter (Requirement F)
  const [escortTelemetryFilter, setEscortTelemetryFilter] = useState<'ALL' | 'ACTIVE' | 'LOW_BATTERY' | 'OFFLINE'>('ALL');

  // Emergency Message to Gate Officers State & Dispatch (Requirement 1)
  const [emergencyGateModal, setEmergencyGateModal] = useState<{
    open: boolean;
    officer: any | null;
    message: string;
    severity: 'CRITICAL_EMERGENCY' | 'NON_COMPLIANCE_DIRECTIVE' | 'URGENT_GATE_ALERT';
    actionRequired: string;
    submitting: boolean;
  }>({
    open: false,
    officer: null,
    message: '',
    severity: 'NON_COMPLIANCE_DIRECTIVE',
    actionRequired: 'Verify digital student authorization immediately',
    submitting: false,
  });

  const handleSendGateEmergencyMessage = async () => {
    if (!emergencyGateModal.message.trim()) {
      toast.error('Please enter the emergency message');
      return;
    }
    setEmergencyGateModal((prev) => ({ ...prev, submitting: true }));
    try {
      const res = await fetch('/api/city-manager/operations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send_gate_officer_emergency_message',
          gateOfficerId: emergencyGateModal.officer?.id,
          officerName: emergencyGateModal.officer?.name || 'Gate Officer',
          schoolId: emergencyGateModal.officer?.schoolId,
          message: emergencyGateModal.message.trim(),
          severity: emergencyGateModal.severity,
          actionRequired: emergencyGateModal.actionRequired.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to dispatch directive');
      toast.success(json.message || 'Emergency directive dispatched to gate officer!');
      setEmergencyGateModal({
        open: false,
        officer: null,
        message: '',
        severity: 'NON_COMPLIANCE_DIRECTIVE',
        actionRequired: 'Verify digital student authorization immediately',
        submitting: false,
      });
    } catch (err: any) {
      toast.error(err.message || 'Error transmitting message');
    } finally {
      setEmergencyGateModal((prev) => ({ ...prev, submitting: false }));
    }
  };

  // School Students Census & Demographics Modal State (Requirement E)
  const [schoolStudentsModal, setSchoolStudentsModal] = useState<{
    open: boolean;
    school: any | null;
    search: string;
  }>({
    open: false,
    school: null,
    search: '',
  });

  // AI Assistant Chat Widget State
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiChatLogs, setAiChatLogs] = useState([
    { type: 'insight', text: 'MIGO SAVI Operational Intelligence online. Ask about escorts, gates, and route oversight.' },
  ]);

  // Filtered Escorts List with Telemetry & Status
  const filteredEscorts = useMemo(() => {
    return escorts.filter((item) => {
      const matchesType = escortTypeFilter === 'ALL' || item.type === escortTypeFilter;
      const matchesTelemetry =
        escortTelemetryFilter === 'ALL' ||
        (escortTelemetryFilter === 'ACTIVE' && item.device_status === 'ACTIVE') ||
        (escortTelemetryFilter === 'LOW_BATTERY' && (item.battery_level < 20 || item.device_status === 'LOW_BATTERY')) ||
        (escortTelemetryFilter === 'OFFLINE' && item.device_status === 'OFFLINE');
      const matchesSearch =
        item.name.toLowerCase().includes(escortSearch.toLowerCase()) ||
        item.id.toLowerCase().includes(escortSearch.toLowerCase()) ||
        item.schoolName.toLowerCase().includes(escortSearch.toLowerCase()) ||
        item.vehicle.toLowerCase().includes(escortSearch.toLowerCase());
      return matchesType && matchesTelemetry && matchesSearch;
    });
  }, [escorts, escortTypeFilter, escortTelemetryFilter, escortSearch]);

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
          className={`cursor-pointer rounded-2xl border p-3 flex flex-col justify-between transition-all ${
            currentTab === 'assignments' ? 'bg-[#0e2747] border-indigo-500 ring-1 ring-indigo-500' : 'bg-[#0b1c30] border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Bookings &amp; Escorts</span>
            <Users size={15} className="text-indigo-400" />
          </div>
          <div className="mt-2">
            <span className="text-xl font-black text-white">{parentRequests.length}</span>
            <span className="inline-block mt-1 px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-indigo-500/20 text-indigo-300">
              {parentRequests.length > 0 ? `${parentRequests.length} Active` : 'All Cleared'}
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
          { id: 'corridor-map', label: 'Transit Corridors & Pinned Houses', icon: MapPin, count: pinnedParentAddresses.length || corridorMetrics?.total_pinned_houses || 0 },
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
      {(currentTab === 'dashboard' || currentTab === 'live-operations' || (!['escorts', 'gate-monitor', 'trips-management', 'corridor-map', 'safety-incidents', 'escalations', 'communication', 'schools', 'vehicles', 'assignments', 'performance', 'reports-analytics', 'settings-access', 'audit-logs'].includes(currentTab))) && (
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

            {/* Telemetry Sub-Filter Pills (Requirement F) */}
            <div className="flex items-center gap-1.5 text-xs font-bold flex-wrap">
              <span className="text-slate-400 text-[11px] mr-1">Device Telemetry:</span>
              <button
                type="button"
                onClick={() => setEscortTelemetryFilter('ALL')}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold transition-all cursor-pointer ${
                  escortTelemetryFilter === 'ALL'
                    ? 'bg-slate-700 text-white'
                    : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                All Devices ({escorts.length})
              </button>
              <button
                type="button"
                onClick={() => setEscortTelemetryFilter('ACTIVE')}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold transition-all cursor-pointer ${
                  escortTelemetryFilter === 'ACTIVE'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                }`}
              >
                ⚡ Active ({escorts.filter(e => e.device_status === 'ACTIVE').length})
              </button>
              <button
                type="button"
                onClick={() => setEscortTelemetryFilter('LOW_BATTERY')}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold transition-all cursor-pointer ${
                  escortTelemetryFilter === 'LOW_BATTERY'
                    ? 'bg-red-600 text-white animate-pulse'
                    : 'bg-red-500/10 text-red-400 border border-red-500/30'
                }`}
              >
                🪫 Low Battery &lt;20% ({escorts.filter(e => e.battery_level < 20 || e.device_status === 'LOW_BATTERY').length})
              </button>
              <button
                type="button"
                onClick={() => setEscortTelemetryFilter('OFFLINE')}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold transition-all cursor-pointer ${
                  escortTelemetryFilter === 'OFFLINE'
                    ? 'bg-slate-700 text-white'
                    : 'bg-slate-900 text-slate-500 border border-slate-800'
                }`}
              >
                Offline ({escorts.filter(e => e.device_status === 'OFFLINE').length})
              </button>
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
                  <th className="p-3.5">Live Telemetry (Battery / Speed / Device)</th>
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
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase ${
                                  escort.type === 'myeduride'
                                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                    : 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                                }`}
                              >
                                {escort.type === 'myeduride' ? 'MyEduRide Escort' : 'School Escort'}
                              </span>
                              <button
                                type="button"
                                onClick={() => setAssignedStudentsModal({ open: true, escort })}
                                className="px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-blue-500/20 text-blue-300 border border-blue-500/30 flex items-center gap-1 hover:bg-blue-500/30 transition-colors cursor-pointer"
                                title="Click to view assigned students manifest"
                              >
                                <Users size={10} />
                                <span>{escort.studentsCount} Students</span>
                              </button>
                            </div>
                            <p className="text-[11px] text-slate-300 font-semibold flex items-center gap-1">
                              <School size={12} className="text-amber-400 shrink-0" />
                              <span className="truncate">{escort.schoolName}</span>
                            </p>
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

                        {/* Live Telemetry & Device Health (Requirement F) */}
                        <td className="p-3.5">
                          <div className="space-y-1 text-[11px] min-w-[150px]">
                            <div className="flex items-center gap-2">
                              {/* Battery Gauge */}
                              {escort.battery_level < 20 ? (
                                <span className="text-red-400 font-black animate-pulse flex items-center gap-1 bg-red-500/10 px-1.5 py-0.5 rounded border border-red-500/30">
                                  <BatteryWarning size={12} /> {escort.battery}
                                </span>
                              ) : escort.battery_level < 50 ? (
                                <span className="text-amber-400 font-bold flex items-center gap-1 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/30">
                                  <Battery size={12} /> {escort.battery}
                                </span>
                              ) : (
                                <span className="text-emerald-400 font-bold flex items-center gap-1 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/30">
                                  <BatteryCharging size={12} /> {escort.battery}
                                </span>
                              )}

                              {/* Speedometer */}
                              <span className="text-cyan-300 font-mono font-bold flex items-center gap-1">
                                <Gauge size={12} /> {escort.speed}
                              </span>
                            </div>

                            {/* Device & Status */}
                            <div className="flex items-center gap-1.5 text-[9px] text-slate-400">
                              <Smartphone size={10} className="text-slate-500 shrink-0" />
                              <span className="truncate max-w-[130px]">{escort.device_model}</span>
                            </div>
                            <p className="text-[9px] text-slate-500 font-mono">Ping: {escort.lastPing}</p>
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
                              onClick={() => setAssignedStudentsModal({ open: true, escort })}
                              className="p-2 rounded-xl bg-slate-800 hover:bg-emerald-600 text-slate-300 hover:text-white transition-colors relative cursor-pointer"
                              title={`View Assigned Students (${escort.studentsCount})`}
                            >
                              <Users size={14} className="text-emerald-400" />
                              {escort.studentsCount > 0 && (
                                <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-500 text-slate-950 font-black text-[9px] flex items-center justify-center">
                                  {escort.studentsCount}
                                </span>
                              )}
                            </button>

                            <button
                              type="button"
                              onClick={() => setAssignSchoolModal({ open: true, escort, schoolId: escort.schoolId || '', notes: '', submitting: false })}
                              className="p-2 rounded-xl bg-slate-800 hover:bg-purple-600 text-slate-300 hover:text-white transition-colors cursor-pointer"
                              title="Assign / Change School"
                            >
                              <School size={14} className="text-purple-300" />
                            </button>

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
                              className="p-2 rounded-xl bg-slate-800 hover:bg-emerald-600 text-slate-300 hover:text-white transition-colors cursor-pointer"
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
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setEmergencyGateModal({
                        open: true,
                        officer: null,
                        message: 'Urgent City Operations Directive: All school gates must enforce zero-tolerance identity checks. Do not release students without verified QR or escort PIN verification.',
                        severity: 'CRITICAL_EMERGENCY',
                        actionRequired: 'Enforce 100% digital verification and zero unauthorized gate releases',
                        submitting: false,
                      })
                    }
                    className="px-3 py-1 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-black flex items-center gap-1.5 shadow-md cursor-pointer transition-all animate-pulse"
                  >
                    <AlertOctagon size={13} />
                    <span>Emergency Directive Broadcast</span>
                  </button>
                  <span className="px-2.5 py-1 rounded-full bg-purple-500/20 text-purple-300 text-xs font-bold border border-purple-500/30">
                    {gateOfficers.length} Stations Monitored
                  </span>
                </div>
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

                      <div className="flex items-center gap-3 text-xs font-semibold flex-wrap">
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
                            setEmergencyGateModal({
                              open: true,
                              officer,
                              message: `Compliance warning for ${officer.gateName}: Suspicious manual gate overrides detected. Verify all credentials through the official scanner.`,
                              severity: 'NON_COMPLIANCE_DIRECTIVE',
                              actionRequired: 'Verify digital student authorization immediately',
                              submitting: false,
                            })
                          }
                          className="px-3 py-1.5 rounded-xl bg-red-500/20 hover:bg-red-600 text-red-300 hover:text-white text-xs font-bold transition-all flex items-center gap-1 border border-red-500/30 cursor-pointer"
                          title="Send Emergency Non-Compliance Warning to this Gate Officer"
                        >
                          <AlertTriangle size={12} /> Directive
                        </button>

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
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => setAssignedStudentsModal({ open: true, escort: e })}
                              className="px-2.5 py-1 rounded-xl bg-blue-600/20 hover:bg-blue-600 text-blue-300 hover:text-white font-bold text-xs transition-colors border border-blue-500/30 flex items-center gap-1 cursor-pointer"
                              title="Inspect Assigned Students Manifest"
                            >
                              <Users size={12} />
                              <span>Pupils ({e.studentsCount || e.assignedStudents?.length || 0})</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setTripDetailModal(e)}
                              className="px-3 py-1 rounded-xl bg-slate-800 hover:bg-emerald-600 text-slate-200 hover:text-white font-bold text-xs transition-colors cursor-pointer"
                            >
                              View ↗
                            </button>
                          </div>
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

      {/* ========================================================================= */}
      {/* VIEW: TRANSIT CORRIDORS & PINNED HOUSES OVERSIGHT */}
      {/* ========================================================================= */}
      {currentTab === 'corridor-map' && (
        <div className="space-y-4">
          <div className="bg-[#0b1c30] rounded-2xl border border-slate-800 p-5 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-black tracking-wide uppercase text-white flex items-center gap-2">
                  <span>School Transit Corridors & Pinned Houses Radar</span>
                  <span className="w-2 h-2 rounded-full bg-teal-400 animate-ping"></span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Live tactical map: School campus gate, landmark pickup points, and doorstep houses pinned by parents.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="px-3 py-1.5 rounded-full bg-teal-500/20 text-teal-300 text-xs font-bold border border-teal-500/30">
                  📌 {pinnedParentAddresses.length || corridorMetrics?.total_pinned_houses || 0} Parent House Pins Synced
                </span>
              </div>
            </div>

            {/* Route Selector & Info */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/80 p-3 rounded-xl border border-slate-800">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-slate-400">Select Corridor:</span>
                <div className="flex flex-wrap gap-1.5">
                  {transitRoutes.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setSelectedCorridorRoute(r)}
                      className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                        selectedCorridorRoute?.id === r.id
                          ? 'bg-teal-600 text-white shadow-xs'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      <span>{r.code} - {r.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {selectedCorridorRoute && (
                <div className="text-xs text-slate-400 font-medium">
                  Escort: <strong className="text-white">{selectedCorridorRoute.assigned_escort_name}</strong> ·
                  Vehicle: <strong className="text-white">{selectedCorridorRoute.assigned_vehicle}</strong> ·
                  <span className="text-teal-400 font-bold ml-1">
                    📌 {selectedCorridorRoute.pinned_by_parents_count || selectedCorridorRoute.passenger_students?.length || 0} Corridor Homes
                  </span>
                </div>
              )}
            </div>

            {/* Interactive Route Corridor Map */}
            {selectedCorridorRoute ? (
              <InteractiveRouteCorridorMap
                school={corridorSchool}
                routeCode={selectedCorridorRoute.code}
                routeName={selectedCorridorRoute.name}
                stops={selectedCorridorRoute.stops || []}
                students={
                  selectedCorridorRoute.passenger_students?.length > 0
                    ? selectedCorridorRoute.passenger_students
                    : pinnedParentAddresses.map((p) => ({
                        student_id: p.student_id,
                        name: p.student_name,
                        class: p.class_name,
                        house_address: p.house_address,
                        house_lat: p.house_lat,
                        house_lng: p.house_lng,
                        house_landmark: p.house_landmark,
                        house_notes: p.house_notes,
                        is_house_pinned: true,
                      }))
                }
                heightClassName="h-[520px]"
              />
            ) : (
              <div className="p-12 text-center text-slate-500 text-xs bg-slate-900/40 rounded-2xl border border-slate-800">
                {loadingCorridors ? 'Loading transit corridors and student house coordinates...' : 'No active routes found for this jurisdiction.'}
              </div>
            )}

            {/* Parent Pinned Addresses Registry & Doorstep Oversight */}
            <div className="pt-4 border-t border-slate-800 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h4 className="text-sm font-extrabold text-white flex items-center gap-2">
                    <Home size={16} className="text-teal-400" />
                    <span>Parent Pinned Addresses Registry (City Jurisdiction)</span>
                  </h4>
                  <p className="text-xs text-slate-400">
                    Live directory of typed doorstep residential addresses, landmarks, and GPS coordinates submitted by parents.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 rounded-xl bg-teal-500/20 text-teal-300 font-mono font-bold text-xs border border-teal-500/30">
                    {pinnedParentAddresses.length} Addresses Pinned
                  </span>
                </div>
              </div>

              {/* Search & School Filters */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/90 p-3 rounded-xl border border-slate-800">
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                  <input
                    type="text"
                    value={pinnedAddressSearch}
                    onChange={(e) => setPinnedAddressSearch(e.target.value)}
                    placeholder="Search by student name, school, or typed address..."
                    className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-teal-500"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 font-bold">School:</span>
                  <select
                    value={pinnedAddressSchoolFilter}
                    onChange={(e) => setPinnedAddressSchoolFilter(e.target.value)}
                    className="px-2.5 py-1.5 text-xs bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none"
                  >
                    <option value="ALL">All Schools ({schools.length})</option>
                    {schools.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Cards Grid */}
              {(() => {
                const filtered = pinnedParentAddresses.filter((p) => {
                  if (pinnedAddressSchoolFilter !== 'ALL' && p.school_id !== pinnedAddressSchoolFilter) return false;
                  if (pinnedAddressSearch.trim()) {
                    const q = pinnedAddressSearch.toLowerCase();
                    const matchName = p.student_name?.toLowerCase().includes(q);
                    const matchAddr = p.house_address?.toLowerCase().includes(q);
                    const matchSch = p.school_name?.toLowerCase().includes(q);
                    const matchLandmark = p.house_landmark?.toLowerCase().includes(q);
                    if (!matchName && !matchAddr && !matchSch && !matchLandmark) return false;
                  }
                  return true;
                });

                if (filtered.length === 0) {
                  return (
                    <div className="p-8 text-center bg-slate-900/40 rounded-xl border border-slate-800 text-slate-400 text-xs">
                      No parent-pinned addresses found matching your filter criteria.
                    </div>
                  );
                }

                return (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {filtered.map((item) => (
                      <div
                        key={item.student_id}
                        className="bg-slate-900/80 rounded-2xl p-4 border border-slate-800 hover:border-teal-500/40 transition-all space-y-3 flex flex-col justify-between"
                      >
                        <div className="space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <h5 className="font-extrabold text-white text-xs">{item.student_name}</h5>
                              <span className="text-[11px] text-teal-300 font-semibold">{item.school_name}</span>
                              <span className="text-[10px] text-slate-400 ml-1.5">({item.class_name})</span>
                              <div className="flex items-center gap-1.5 flex-wrap mt-1">
                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1 font-mono">
                                  📏 {item.distance_km != null ? `${item.distance_km} km` : 'Calculating...'}
                                </span>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/20 flex items-center gap-1">
                                  ⏱️ ~{item.estimated_transit_mins || 12}m
                                </span>
                              </div>
                            </div>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                                item.is_assigned
                                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                  : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              }`}
                            >
                              {item.is_assigned ? 'Escort Assigned' : 'Unassigned'}
                            </span>
                          </div>

                          <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-xs space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-black uppercase text-teal-400 flex items-center gap-1">
                                <MapPin size={11} />
                                <span>Typed Doorstep Address</span>
                              </span>
                              <span className="text-[9px] font-mono text-slate-400">PINNED ✓</span>
                            </div>
                            <p className="font-bold text-slate-200 text-[11px] leading-snug">
                              {item.house_address || 'Designated Home Residence'}
                            </p>
                            {item.house_landmark && (
                              <p className="text-[10px] text-slate-400">🏢 Landmark: {item.house_landmark}</p>
                            )}
                            {item.house_notes && (
                              <p className="text-[10px] text-slate-400 italic">📝 &ldquo;{item.house_notes}&rdquo;</p>
                            )}
                            <div className="pt-1.5 flex flex-col gap-1 border-t border-slate-800/80 text-[10px] font-mono text-slate-400">
                              <div className="flex items-center justify-between">
                                <span className="text-slate-400">Parent House Pin:</span>
                                <span className="text-teal-300 font-bold">{item.house_lat?.toFixed(5)}, {item.house_lng?.toFixed(5)}</span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-slate-400">School Campus Pin:</span>
                                <span className="text-emerald-400 font-bold">{item.school_lat?.toFixed(5) || '6.44740'}, {item.school_lng?.toFixed(5) || '3.47310'}</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="pt-2 border-t border-slate-800 flex items-center justify-between gap-2 text-[11px]">
                          <span className="text-slate-400 truncate max-w-[130px]">
                            {item.assigned_escort_name ? `Escort: ${item.assigned_escort_name}` : 'Awaiting dispatch'}
                          </span>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => setInspectRouteModal({ open: true, item })}
                              className="px-2.5 py-1 rounded-lg bg-teal-600/20 hover:bg-teal-600/30 text-teal-300 border border-teal-500/30 font-extrabold text-[10px] flex items-center gap-1 cursor-pointer transition-all"
                              title="Inspect School-to-Home Route & Distance"
                            >
                              <Navigation size={11} />
                              <span>Inspect Route</span>
                            </button>
                            {(item.directions_url || (item.house_lat && item.house_lng)) && (
                              <a
                                href={item.directions_url || `https://www.google.com/maps/dir/?api=1&destination=${item.house_lat},${item.house_lng}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-bold text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer p-1 rounded hover:bg-slate-800"
                                title="Open Turn-by-Turn Driving Route in Google Maps"
                              >
                                <ExternalLink size={12} />
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
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
                      <strong className="text-white font-mono">{sch.studentsCount}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Gate Officers</span>
                      <strong className="text-purple-300 font-mono">{sch.gateOfficersCount || 1}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Escorts</span>
                      <strong className="text-cyan-400 font-mono">{sch.escortsCount}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Compliance</span>
                      <strong className="text-emerald-400 font-mono">{sch.complianceScore || 100}%</strong>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setSchoolStudentsModal({ open: true, school: sch, search: '' })}
                    className="w-full mt-2 py-2 rounded-xl bg-blue-600/20 hover:bg-blue-600 text-blue-300 hover:text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5 border border-blue-500/30 cursor-pointer shadow-xs"
                  >
                    <Users size={13} />
                    <span>Inspect Students Roster ({sch.studentsCount})</span>
                  </button>
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
                  <th className="p-3">Vehicle & Snaps</th>
                  <th className="p-3">Plate & Type</th>
                  <th className="p-3">Allocated Escort</th>
                  <th className="p-3">Assigned Route</th>
                  <th className="p-3">School Station</th>
                  <th className="p-3 text-center">Status</th>
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
                  vehicles.map((v) => {
                    const photos = typeof v.vehiclePhotos === 'object' && v.vehiclePhotos ? v.vehiclePhotos : {};
                    const img = v.photoUrl || photos.front || null;

                    return (
                      <tr key={v.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="p-3">
                          <div className="flex items-center gap-2.5">
                            {img ? (
                              <img src={img} alt={v.plateNumber || v.regNumber} className="w-10 h-10 rounded-xl object-cover border border-slate-700 shrink-0" />
                            ) : (
                              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 flex items-center justify-center font-bold shrink-0">
                                <Car size={18} />
                              </div>
                            )}
                            <div>
                              <strong className="text-white block font-bold">{v.model || v.make}</strong>
                              <div className="flex items-center gap-1 mt-0.5">
                                {(photos.front || v.photoUrl) && <span className="text-[9px] px-1 py-0.2 rounded bg-blue-500/20 text-blue-300 font-bold">Front</span>}
                                {photos.side && <span className="text-[9px] px-1 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-bold">Side</span>}
                                {photos.plate && <span className="text-[9px] px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 font-bold">Plate</span>}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="p-3">
                          <span className="font-mono font-bold text-slate-100 block">{v.plateNumber || v.regNumber}</span>
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-300">{v.type || 'School Bus'} ({v.capacity || 18} seats)</span>
                        </td>
                        <td className="p-3">
                          <span className="text-emerald-400 font-bold block flex items-center gap-1">
                            <ShieldCheck size={13} />
                            {v.escortName || 'Unassigned'}
                          </span>
                          {v.escortPhone && <span className="text-[10px] text-slate-400 font-mono">{v.escortPhone}</span>}
                        </td>
                        <td className="p-3">
                          <span className="text-indigo-300 font-bold block flex items-center gap-1">
                            <MapPin size={13} />
                            {v.routeName || 'Unassigned Route'}
                          </span>
                        </td>
                        <td className="p-3">
                          <span className="text-slate-300 block">{v.schoolName || 'School Campus'}</span>
                        </td>
                        <td className="p-3 text-center">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            v.status === 'ACTIVE' || v.status === 'active' || v.status === 'IN_TRANSIT' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-slate-700 text-slate-300'
                          }`}>
                            {v.status || 'ACTIVE'}
                          </span>
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
      {/* MODAL: VIEW ESCORT ASSIGNED STUDENTS MANIFEST */}
      {/* ========================================================================= */}
      {assignedStudentsModal.open && assignedStudentsModal.escort && (
        <div className="fixed inset-0 z-[9999] bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-[#0b1d33] border border-slate-700 rounded-3xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden text-white">
            <div className="px-5 py-4 bg-[#071628] border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                    Assigned Students Manifest
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-mono">
                      {assignedStudentsModal.escort.studentsCount || (assignedStudentsModal.escort.assignedStudents?.length || 0)} Students
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Escort: <strong className="text-white">{assignedStudentsModal.escort.name}</strong> • School: <strong className="text-amber-300">{assignedStudentsModal.escort.schoolName}</strong>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAssignedStudentsModal({ open: false, escort: null })}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-5 overflow-y-auto flex-1 space-y-3">
              {(assignedStudentsModal.escort.assignedStudents && assignedStudentsModal.escort.assignedStudents.length > 0) ? (
                assignedStudentsModal.escort.assignedStudents.map((st: any) => (
                  <div key={st.id || st.assignment_id} className="p-3 rounded-2xl bg-slate-900/90 border border-slate-800 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <StudentAvatar photoUrl={st.photo_url || st.photo} name={st.name} size={44} className="rounded-xl shrink-0" />
                      <div className="min-w-0">
                        <strong className="text-sm font-bold text-white block truncate">{st.name}</strong>
                        <p className="text-[11px] text-slate-400 font-mono">
                          ID: <span className="text-slate-300 font-bold">{st.student_id_number || 'N/A'}</span> • Class: <span className="text-amber-300 font-bold">{st.class_name || 'Class N/A'}</span>
                        </p>
                        <p className="text-[11px] text-slate-300 truncate mt-0.5 flex items-center gap-1">
                          <MapPin size={11} className="text-emerald-400 shrink-0" />
                          <span className="truncate">{st.house_address}</span>
                          {st.is_house_pinned && (
                            <span className="text-[8px] font-black px-1.5 py-0.5 rounded bg-emerald-600 text-white shrink-0">
                              PINNED ✓
                            </span>
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 uppercase block">
                        {st.status || 'ACTIVE'}
                      </span>
                      {st.parent_phone && (
                        <a
                          href={`tel:${st.parent_phone}`}
                          className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-mono text-cyan-400 hover:underline"
                        >
                          <PhoneCall size={10} /> {st.parent_phone}
                        </a>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-10 text-center space-y-2">
                  <Users className="w-8 h-8 text-slate-600 mx-auto" />
                  <p className="text-sm font-bold text-slate-300">No Students Currently Assigned</p>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    This escort is ready for transport duty. Students assigned to this escort will appear on this manifest automatically.
                  </p>
                </div>
              )}
            </div>

            <div className="p-4 bg-[#071628] border-t border-slate-800 flex items-center justify-between">
              <span className="text-[11px] text-slate-400">
                Official City Operations Escort Assignment Manifest
              </span>
              <button
                type="button"
                onClick={() => setAssignedStudentsModal({ open: false, escort: null })}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs cursor-pointer"
              >
                Close Manifest
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ASSIGN ESCORT TO SCHOOL */}
      {/* ========================================================================= */}
      {assignSchoolModal.open && assignSchoolModal.escort && (
        <div className="fixed inset-0 z-[9999] bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-[#0c1e36] border border-slate-700 rounded-3xl max-w-md w-full p-6 text-white shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-300">
                  <School className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white uppercase tracking-wider">
                    Assign Escort to School
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Set designated campus &amp; transport operations
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAssignSchoolModal({ open: false, escort: null, schoolId: '', notes: '', submitting: false })}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs">
              <strong className="text-white block text-sm">{assignSchoolModal.escort.name}</strong>
              <p className="text-slate-400 font-mono text-[11px]">{assignSchoolModal.escort.id} • {assignSchoolModal.escort.phone}</p>
              <p className="text-amber-400 mt-1 font-semibold">Current: {assignSchoolModal.escort.schoolName}</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">
                Target School Campus <span className="text-red-400">*</span>
              </label>
              <select
                value={assignSchoolModal.schoolId}
                onChange={(e) => setAssignSchoolModal(prev => ({ ...prev, schoolId: e.target.value }))}
                className="w-full p-3 rounded-xl bg-slate-950 border border-slate-700 text-xs font-bold text-emerald-400 focus:ring-2 focus:ring-brand-green"
              >
                <option value="">-- Choose a School Campus --</option>
                {schools.map((s) => (
                  <option key={s.id} value={s.id} className="text-white">
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">
                Directives / Notes
              </label>
              <textarea
                rows={2}
                value={assignSchoolModal.notes}
                onChange={(e) => setAssignSchoolModal(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="e.g. Assigned to School Fleet. Operational supervision confirmed."
                className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 font-medium focus:ring-2 focus:ring-brand-green"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setAssignSchoolModal({ open: false, escort: null, schoolId: '', notes: '', submitting: false })}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={assignSchoolModal.submitting}
                onClick={handleCommandAssignSchoolSubmit}
                className="px-5 py-2.5 rounded-xl bg-brand-green hover:bg-emerald-600 text-white font-extrabold text-xs shadow-lg shadow-emerald-600/30 flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                {assignSchoolModal.submitting ? 'Assigning...' : 'Confirm School Assignment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: INSPECT PARENT-TO-SCHOOL ROUTE & DISTANCE */}
      {/* ========================================================================= */}
      {inspectRouteModal.open && inspectRouteModal.item && (
        <div className="fixed inset-0 z-[9999] bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-[#0b1c31] border border-slate-700 rounded-3xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden text-white">
            {/* Header */}
            <div className="px-5 py-4 bg-[#071628] border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-teal-500/20 border border-teal-500/30 flex items-center justify-center text-teal-300 font-bold">
                  <Navigation className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                    Parent-to-School Route Corridor &amp; Distance
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-mono">
                      {inspectRouteModal.item.distance_km != null ? `${inspectRouteModal.item.distance_km} km` : 'Calculated'}
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Student: <strong className="text-white">{inspectRouteModal.item.student_name}</strong> • School: <strong className="text-amber-300">{inspectRouteModal.item.school_name}</strong>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setInspectRouteModal({ open: false, item: null })}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto flex-1 space-y-4">
              {/* Route Metric Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3 rounded-2xl bg-slate-900/90 border border-slate-800 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold shrink-0">
                    <Compass size={18} />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Haversine Distance</span>
                    <strong className="text-base font-black text-emerald-300">
                      {inspectRouteModal.item.distance_km != null ? `${inspectRouteModal.item.distance_km} km` : '—'}
                    </strong>
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-slate-900/90 border border-slate-800 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold shrink-0">
                    <Clock size={18} />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Est. Transit Time</span>
                    <strong className="text-base font-black text-amber-300">
                      ~{inspectRouteModal.item.estimated_transit_mins || 12} mins
                    </strong>
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-slate-900/90 border border-slate-800 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold shrink-0">
                    <CheckSquare size={18} />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">GPS Verification</span>
                    <strong className="text-xs font-black text-cyan-300">
                      Doorstep Pinned ✓
                    </strong>
                  </div>
                </div>
              </div>

              {/* Interactive Route Corridor Map */}
              <SchoolHomeRouteMap
                school={{
                  name: inspectRouteModal.item.school_name,
                  address: inspectRouteModal.item.school_address,
                  lat: inspectRouteModal.item.school_lat || 6.4474,
                  lng: inspectRouteModal.item.school_lng || 3.4731,
                }}
                student={{
                  name: inspectRouteModal.item.student_name,
                  className: inspectRouteModal.item.class_name,
                  studentIdNumber: inspectRouteModal.item.student_number,
                  houseAddress: inspectRouteModal.item.house_address,
                  houseLandmark: inspectRouteModal.item.house_landmark,
                  houseNotes: inspectRouteModal.item.house_notes,
                  lat: inspectRouteModal.item.house_lat || 6.4521,
                  lng: inspectRouteModal.item.house_lng || 3.4802,
                  parentPhone: inspectRouteModal.item.assigned_escort_phone || null,
                }}
                distanceKm={inspectRouteModal.item.distance_km}
                estimatedTransitMins={inspectRouteModal.item.estimated_transit_mins}
                heightClassName="h-[360px]"
              />

              {/* Route Directives Details */}
              <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 text-xs space-y-2">
                <h5 className="font-extrabold text-white uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                  <MapPin size={13} className="text-teal-400" />
                  <span>Doorstep Route Navigation Specification</span>
                </h5>
                <p className="text-slate-300 leading-relaxed">
                  The system computed a straight-line corridor of <strong className="text-emerald-300">{inspectRouteModal.item.distance_km} km</strong> between <strong className="text-white">{inspectRouteModal.item.school_name}</strong> campus gates and the student&rsquo;s residence at <strong className="text-white">{inspectRouteModal.item.house_address}</strong>. Escorts dispatched on this route have turn-by-turn guidance available.
                </p>
                {inspectRouteModal.item.house_landmark && (
                  <p className="text-slate-400 font-mono text-[11px]">
                    🏢 Pinned Landmark: <span className="text-slate-200">{inspectRouteModal.item.house_landmark}</span>
                  </p>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 bg-[#071628] border-t border-slate-800 flex items-center justify-between">
              <span className="text-[11px] text-slate-400 font-mono">
                Lat/Lng: ({inspectRouteModal.item.house_lat?.toFixed(5)}, {inspectRouteModal.item.house_lng?.toFixed(5)})
              </span>
              <div className="flex items-center gap-2">
                {inspectRouteModal.item.directions_url && (
                  <a
                    href={inspectRouteModal.item.directions_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-extrabold text-xs flex items-center gap-1.5 shadow-sm transition-all"
                  >
                    <span>Open Google Maps</span>
                    <ExternalLink size={13} />
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => setInspectRouteModal({ open: false, item: null })}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
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

      {/* ========================================================================= */}
      {/* 8. MODAL: EMERGENCY DIRECTIVE TO GATE OFFICERS (Requirement 1) */}
      {/* ========================================================================= */}
      {emergencyGateModal.open && (
        <div className="fixed inset-0 z-[9999] bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0c1829] border border-red-500/40 rounded-3xl max-w-lg w-full p-6 text-white shadow-2xl space-y-4 animate-in fade-in">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-red-500/20 border border-red-500/40 text-red-400 flex items-center justify-center font-black animate-pulse shrink-0">
                <AlertOctagon size={24} />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                  Emergency Gate Directive Dispatch
                </h3>
                <p className="text-xs text-slate-400">
                  {emergencyGateModal.officer
                    ? `Direct tactical transmission to ${emergencyGateModal.officer.name} (${emergencyGateModal.officer.gateName})`
                    : `High-priority broadcast to all ${gateOfficers.length} Gate Security Stations in ${selectedCity}`}
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Severity Level
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['NON_COMPLIANCE_DIRECTIVE', 'URGENT_GATE_ALERT', 'CRITICAL_EMERGENCY'] as const).map((sev) => (
                    <button
                      key={sev}
                      type="button"
                      onClick={() => setEmergencyGateModal((prev) => ({ ...prev, severity: sev }))}
                      className={`py-2 px-2 rounded-xl text-[10px] font-black border transition-all cursor-pointer ${
                        emergencyGateModal.severity === sev
                          ? 'bg-red-600 text-white border-red-500 shadow-md'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {sev.replace(/_/g, ' ')}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Mandatory Action Required *
                </label>
                <input
                  type="text"
                  value={emergencyGateModal.actionRequired}
                  onChange={(e) => setEmergencyGateModal((prev) => ({ ...prev, actionRequired: e.target.value }))}
                  placeholder="e.g. Halt manual release without verified biometric/QR scanning"
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-red-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Directive Details & Warning *
                </label>
                <textarea
                  rows={4}
                  value={emergencyGateModal.message}
                  onChange={(e) => setEmergencyGateModal((prev) => ({ ...prev, message: e.target.value }))}
                  placeholder="State the non-compliance incident, perimeter vulnerability, or mandatory instruction..."
                  className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-red-500 resize-none font-medium"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                disabled={emergencyGateModal.submitting}
                onClick={handleSendGateEmergencyMessage}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-extrabold text-xs shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {emergencyGateModal.submitting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Transmitting Directive...</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle size={14} />
                    <span>Dispatch Emergency Directive Now</span>
                  </>
                )}
              </button>
              <button
                type="button"
                disabled={emergencyGateModal.submitting}
                onClick={() =>
                  setEmergencyGateModal({
                    open: false,
                    officer: null,
                    message: '',
                    severity: 'NON_COMPLIANCE_DIRECTIVE',
                    actionRequired: 'Verify digital student authorization immediately',
                    submitting: false,
                  })
                }
                className="py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 9. MODAL: SCHOOL STUDENTS ROSTER INSPECTION (Requirement E) */}
      {/* ========================================================================= */}
      {schoolStudentsModal.open && schoolStudentsModal.school && (
        <div className="fixed inset-0 z-[9999] bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0b1c30] border border-slate-800 rounded-3xl max-w-4xl w-full p-6 text-white shadow-2xl space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-500/20 border border-blue-500/40 text-blue-400 flex items-center justify-center font-black shrink-0">
                  <School size={20} />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                    {schoolStudentsModal.school.name}
                    <span className="px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 text-[10px] font-black border border-blue-500/30">
                      {schoolStudentsModal.school.students?.length || schoolStudentsModal.school.studentsCount || 0} Students Enrolled
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    {schoolStudentsModal.school.area || schoolStudentsModal.school.address} · Institutional Census
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSchoolStudentsModal({ open: false, school: null, search: '' })}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Search filter */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={schoolStudentsModal.search}
                onChange={(e) => setSchoolStudentsModal((prev) => ({ ...prev, search: e.target.value }))}
                placeholder="Search enrolled students by name, ID number, or parent contact..."
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-medium"
              />
            </div>

            {/* Students Table */}
            <div className="overflow-y-auto flex-1 rounded-2xl border border-slate-800 bg-slate-900/40">
              {(() => {
                const studentsList = Array.isArray(schoolStudentsModal.school.students)
                  ? schoolStudentsModal.school.students
                  : [];
                const filtered = studentsList.filter((s: any) => {
                  if (!schoolStudentsModal.search) return true;
                  const q = schoolStudentsModal.search.toLowerCase();
                  const name = `${s.first_name || ''} ${s.last_name || ''}`.toLowerCase();
                  const phone = (s.parent_phone || '').toLowerCase();
                  const id = (s.student_id_number || s.id || '').toLowerCase();
                  return name.includes(q) || phone.includes(q) || id.includes(q);
                });

                if (filtered.length === 0) {
                  return (
                    <div className="text-center py-12 text-slate-400">
                      <Users className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                      <p className="text-sm font-bold text-slate-300">No Enrolled Students Match Search</p>
                      <p className="text-xs text-slate-500 mt-1">Check back when school administrators register pupil accounts.</p>
                    </div>
                  );
                }

                return (
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#07172b] text-[10px] font-black text-slate-400 uppercase sticky top-0 border-b border-slate-800">
                      <tr>
                        <th className="p-3">Student Profile</th>
                        <th className="p-3">Class</th>
                        <th className="p-3">Parent Contact</th>
                        <th className="p-3">Pinned Address</th>
                        <th className="p-3 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-medium text-slate-200">
                      {filtered.map((s: any) => {
                        const name = `${s.first_name || 'Pupil'} ${s.last_name || ''}`.trim();
                        const hasPin = Boolean(s.house_lat && s.house_lng);
                        return (
                          <tr key={s.id} className="hover:bg-slate-800/40 transition-colors">
                            <td className="p-3">
                              <div className="flex items-center gap-2.5">
                                <StudentAvatar photoUrl={s.photo_url} name={name} size={32} />
                                <div>
                                  <strong className="text-white block font-bold">{name}</strong>
                                  <span className="text-[10px] font-mono text-slate-400">
                                    {s.student_id_number || s.id.slice(0, 8)}
                                  </span>
                                </div>
                              </div>
                            </td>

                            <td className="p-3">
                              <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 text-[11px] font-semibold">
                                {s.class_name || s.class?.name || 'Assigned Class'}
                              </span>
                            </td>

                            <td className="p-3">
                              {s.parent_phone ? (
                                <a
                                  href={`tel:${s.parent_phone}`}
                                  className="text-cyan-400 hover:text-cyan-300 font-mono text-xs flex items-center gap-1 hover:underline"
                                >
                                  <Phone size={11} /> {s.parent_phone}
                                </a>
                              ) : (
                                <span className="text-slate-500 italic text-[11px]">No phone on file</span>
                              )}
                            </td>

                            <td className="p-3">
                              <div className="space-y-0.5 max-w-[220px]">
                                <div className="flex items-center gap-1 text-[11px] text-slate-300 truncate">
                                  <MapPin
                                    size={11}
                                    className={hasPin ? 'text-emerald-400 shrink-0' : 'text-slate-500 shrink-0'}
                                  />
                                  <span className="truncate">{s.house_address || 'Address unrecorded'}</span>
                                </div>
                                <span
                                  className={`text-[9px] font-black uppercase px-1.5 py-0.2 rounded inline-block ${
                                    hasPin
                                      ? 'bg-emerald-500/20 text-emerald-400'
                                      : 'bg-amber-500/20 text-amber-400'
                                  }`}
                                >
                                  {hasPin ? 'GPS Coordinate Pinned' : 'Coordinates Pending'}
                                </span>
                              </div>
                            </td>

                            <td className="p-3 text-right">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                {s.status || 'ENROLLED'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                );
              })()}
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setSchoolStudentsModal({ open: false, school: null, search: '' })}
                className="py-2 px-5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs cursor-pointer"
              >
                Close Roster
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
