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

// Initial Mock Operational Data for Command & Control
const INITIAL_ESCORT_ROSTER = [
  {
    id: 'EMR-2031',
    name: 'Emeka Johnson',
    type: 'myeduride',
    phone: '+234 803 219 4481',
    status: 'ON_TRIP',
    schoolName: "St. Mary's School",
    vehicle: 'Toyota HiAce (KJA-892-AA)',
    currentTripId: 'TRP-1092',
    route: 'Ikeja GRA → St. Mary\'s Campus',
    studentsCount: 12,
    speed: '34 km/h',
    battery: '88%',
    lastPing: '12s ago',
    complianceScore: 98,
    rating: 4.9,
    tripsToday: 4,
    avatar: '',
    notes: 'Verified top-tier escort. Clean safety record.',
  },
  {
    id: 'EMR-1187',
    name: 'Grace Afolabi',
    type: 'myeduride',
    phone: '+234 802 443 1928',
    status: 'ON_TRIP',
    schoolName: 'Greenfield Academy',
    vehicle: 'Ford Transit (LND-412-XY)',
    currentTripId: 'TRP-1094',
    route: 'Yaba Tech Corridor → Greenfield',
    studentsCount: 10,
    speed: '28 km/h',
    battery: '94%',
    lastPing: '5s ago',
    complianceScore: 95,
    rating: 4.8,
    tripsToday: 3,
    avatar: '',
    notes: 'Punctual, positive parent feedback.',
  },
  {
    id: 'SCH-045',
    name: 'Fatima Bello',
    type: 'school',
    phone: '+234 814 883 9021',
    status: 'ON_TRIP',
    schoolName: 'Hope Academy',
    vehicle: 'Mercedes Sprinter (GGE-219-BC)',
    currentTripId: 'TRP-1098',
    route: 'Maryland Estate → Hope Academy',
    studentsCount: 8,
    speed: '31 km/h',
    battery: '76%',
    lastPing: '20s ago',
    complianceScore: 93,
    rating: 4.6,
    tripsToday: 2,
    avatar: '',
    notes: 'School staff driver & escort.',
  },
  {
    id: 'EMR-1576',
    name: 'Daniel Okoro',
    type: 'myeduride',
    phone: '+234 809 112 5590',
    status: 'AVAILABLE',
    schoolName: 'Whitesands School',
    vehicle: 'Nissan Urvan (AGL-552-DE)',
    currentTripId: null,
    route: 'Standby at Surulere Hub',
    studentsCount: 0,
    speed: '0 km/h',
    battery: '92%',
    lastPing: '45s ago',
    complianceScore: 94,
    rating: 4.7,
    tripsToday: 3,
    avatar: '',
    notes: 'Ready for emergency backup dispatch.',
  },
  {
    id: 'SCH-072',
    name: 'Samuel Efiong',
    type: 'school',
    phone: '+234 805 776 3312',
    status: 'DELAYED',
    schoolName: 'CitiLights School',
    vehicle: 'Toyota Coaster (IKJ-110-ZA)',
    currentTripId: 'TRP-1102',
    route: 'Gbagada Expressway → CitiLights',
    studentsCount: 14,
    speed: '12 km/h',
    battery: '62%',
    lastPing: '30s ago',
    complianceScore: 88,
    rating: 4.5,
    tripsToday: 2,
    avatar: '',
    notes: 'Heavy traffic congestion reported on Third Mainland approach.',
  },
  {
    id: 'EMR-3309',
    name: 'Kazeem Oladipo',
    type: 'myeduride',
    phone: '+234 803 551 2289',
    status: 'FLAGGED',
    schoolName: 'Corona School Victoria Island',
    vehicle: 'Toyota HiAce (APP-901-LK)',
    currentTripId: null,
    route: 'Under Investigation',
    studentsCount: 0,
    speed: '0 km/h',
    battery: '81%',
    lastPing: '2m ago',
    complianceScore: 71,
    rating: 3.9,
    tripsToday: 1,
    avatar: '',
    notes: 'Speed alert triggered twice this morning (>65km/h in 30km/h school zone).',
  },
];

const INITIAL_GATE_OFFICERS = [
  {
    id: 'GT-01',
    name: 'Sgt. Babatunde Lawal',
    schoolName: "St. Mary's School",
    gateName: 'Main Gate A',
    shift: 'Morning (06:30 - 14:30)',
    status: 'ON_DUTY',
    scansToday: 312,
    releasesToday: 298,
    visitorsLogged: 8,
    overridesCount: 1,
    lastActive: 'Just now',
    compliance: '100%',
  },
  {
    id: 'GT-02',
    name: 'Officer Musa Danladi',
    schoolName: 'Greenfield Academy',
    gateName: 'North Gate 1',
    shift: 'Morning (06:30 - 14:30)',
    status: 'ON_DUTY',
    scansToday: 245,
    releasesToday: 220,
    visitorsLogged: 5,
    overridesCount: 0,
    lastActive: '1m ago',
    compliance: '100%',
  },
  {
    id: 'GT-03',
    name: 'Officer Chioma Nwosu',
    schoolName: 'Hope Academy',
    gateName: 'Gate 2 (Primary)',
    shift: 'Morning (06:30 - 14:30)',
    status: 'ATTENTION',
    scansToday: 186,
    releasesToday: 150,
    visitorsLogged: 6,
    overridesCount: 3,
    lastActive: '30s ago',
    compliance: '89%',
  },
  {
    id: 'GT-04',
    name: 'Officer Segun Adeleke',
    schoolName: 'Whitesands School',
    gateName: 'Admin Gate B',
    shift: 'Morning (06:30 - 14:30)',
    status: 'ON_DUTY',
    scansToday: 210,
    releasesToday: 189,
    visitorsLogged: 7,
    overridesCount: 1,
    lastActive: '2m ago',
    compliance: '97%',
  },
];

const INITIAL_GATE_ACTIVITIES = [
  {
    id: 'GA-991',
    time: '10:28 AM',
    school: "St. Mary's School",
    gate: 'Gate A',
    officer: 'Sgt. Babatunde Lawal',
    student: 'Chinedu Eze (JSS 2)',
    actor: 'Mrs. Ngozi Eze (Mother)',
    actorType: 'Parent Pickup',
    verification: 'QR Code + NFC Tag',
    status: 'APPROVED',
  },
  {
    id: 'GA-992',
    time: '10:25 AM',
    school: 'Hope Academy',
    gate: 'Gate 2',
    officer: 'Officer Chioma Nwosu',
    student: 'Aisha Bello (Primary 4)',
    actor: 'Uncle Tunde Bello',
    actorType: 'Emergency Guardian',
    verification: 'Manual Override (Phone Confirmed with Mother)',
    status: 'OVERRIDE_APPROVED',
  },
  {
    id: 'GA-993',
    time: '10:21 AM',
    school: 'Greenfield Academy',
    gate: 'North Gate 1',
    officer: 'Officer Musa Danladi',
    student: 'David Adeleke (Primary 1)',
    actor: 'Emeka Johnson (MyEduRide Escort)',
    actorType: 'Escort Handoff',
    verification: 'Escort Biometric + Student Badge QR',
    status: 'APPROVED',
  },
  {
    id: 'GA-994',
    time: '10:14 AM',
    school: 'Whitesands School',
    gate: 'Admin Gate B',
    officer: 'Officer Segun Adeleke',
    student: 'Zainab Mohammed (SS 1)',
    actor: 'Unregistered Driver',
    actorType: 'Unauthorized Attempt',
    verification: 'BLOCKED — Unregistered Driver QR Mismatch',
    status: 'SECURITY_BLOCKED',
  },
];

const INITIAL_SAFETY_INCIDENTS = [
  {
    id: 'INC-401',
    severity: 'CRITICAL',
    title: 'Speed Threshold Violation & Route Deviation Alert',
    escort: 'Kazeem Oladipo (EMR-3309)',
    school: 'Corona School VI',
    time: '10:12 AM',
    status: 'INVESTIGATING',
    description: 'Vehicle exceeded 65km/h in 30km/h school safety zone along Ozumba Mbadiwe.',
    actionRequired: 'Contact escort, review dash telemetry, issue temporary suspension if unexcused.',
  },
  {
    id: 'INC-402',
    severity: 'HIGH',
    title: 'Trip Congestion & Prolonged Delay (>25m)',
    escort: 'Samuel Efiong (SCH-072)',
    school: 'CitiLights School',
    time: '10:05 AM',
    status: 'ACTION_TAKEN',
    description: 'Vehicle halted in gridlock near Gbagada. Parents automatically notified with live ETA.',
    actionRequired: 'Monitoring route clearance; alternate route dispatched to driver via MIGO.',
  },
  {
    id: 'INC-403',
    severity: 'HIGH',
    title: 'Unauthorized Gate Pickup Attempt Blocked',
    escort: 'N/A (Gate Security)',
    school: 'Whitesands School',
    time: '09:50 AM',
    status: 'RESOLVED',
    description: 'Individual attempting pickup failed ID verification. Student remained safely with gate staff.',
    actionRequired: 'Parent called and confirmed they did not authorize individual. Security notified.',
  },
];

const INITIAL_ESCALATIONS = [
  {
    id: 'ESC-701',
    type: 'PARENT',
    from: 'Dr. (Mrs) Folashade Williams',
    student: 'Tobi Williams',
    escort: 'Kazeem Oladipo (EMR-3309)',
    subject: 'Driver harsh braking & abrupt stops',
    urgency: 'HIGH',
    status: 'OPEN',
    date: 'Today, 09:30 AM',
    details: 'Parent observed sudden braking on morning route. Requested escort compliance check.',
  },
  {
    id: 'ESC-702',
    type: 'SCHOOL',
    from: 'Principal, Hope Academy',
    student: 'Multiple Students',
    escort: 'Fatima Bello (SCH-045)',
    subject: 'Morning gate arrival 15 minutes past schedule',
    urgency: 'MEDIUM',
    status: 'UNDER_REVIEW',
    date: 'Today, 08:45 AM',
    details: 'School admin noted route departure was delayed from first pickup node.',
  },
];

const INITIAL_SCHOOLS_ROSTER = [
  {
    id: 'SCH-01',
    name: "St. Mary's School",
    address: '12 Education Drive, Ikeja',
    studentsCount: 312,
    escortsCount: 14,
    gatesCount: 2,
    status: 'ONLINE',
    complianceRate: '99.4%',
    principal: 'Mrs. Folake Adesina',
  },
  {
    id: 'SCH-02',
    name: 'Greenfield Academy',
    address: '44 University Road, Yaba',
    studentsCount: 245,
    escortsCount: 10,
    gatesCount: 2,
    status: 'ONLINE',
    complianceRate: '98.8%',
    principal: 'Mr. Jude Okafor',
  },
  {
    id: 'SCH-03',
    name: 'Hope Academy',
    address: '8 Anthony Way, Maryland',
    studentsCount: 186,
    escortsCount: 8,
    gatesCount: 1,
    status: 'ATTENTION',
    complianceRate: '94.2%',
    principal: 'Dr. (Mrs) Ngozi Obi',
  },
  {
    id: 'SCH-04',
    name: 'Whitesands School',
    address: 'Plot 5 Admiralty Crescent, Lekki Phase 1',
    studentsCount: 210,
    escortsCount: 9,
    gatesCount: 2,
    status: 'ONLINE',
    complianceRate: '99.1%',
    principal: 'Mr. Emmanuel Adeleke',
  },
  {
    id: 'SCH-05',
    name: 'CitiLights School',
    address: '18 Gbagada Expressway, Gbagada',
    studentsCount: 198,
    escortsCount: 8,
    gatesCount: 1,
    status: 'ONLINE',
    complianceRate: '96.5%',
    principal: 'Mrs. Patience Danladi',
  },
];

const INITIAL_VEHICLES_FLEET = [
  {
    id: 'VEH-101',
    plateNumber: 'KJA-892-AA',
    model: 'Toyota HiAce (14 Seater)',
    type: 'BUS',
    escortName: 'Emeka Johnson',
    schoolName: "St. Mary's School",
    status: 'IN_TRANSIT',
    speed: '34 km/h',
    fuel: '85%',
    trackerStatus: 'ACTIVE',
  },
  {
    id: 'VEH-102',
    plateNumber: 'LND-412-XY',
    model: 'Ford Transit (12 Seater)',
    type: 'VAN',
    escortName: 'Grace Afolabi',
    schoolName: 'Greenfield Academy',
    status: 'IN_TRANSIT',
    speed: '28 km/h',
    fuel: '92%',
    trackerStatus: 'ACTIVE',
  },
  {
    id: 'VEH-103',
    plateNumber: 'GGE-219-BC',
    model: 'Mercedes Sprinter (18 Seater)',
    type: 'BUS',
    escortName: 'Fatima Bello',
    schoolName: 'Hope Academy',
    status: 'IN_TRANSIT',
    speed: '31 km/h',
    fuel: '70%',
    trackerStatus: 'ACTIVE',
  },
  {
    id: 'VEH-104',
    plateNumber: 'AGL-552-DE',
    model: 'Nissan Urvan (14 Seater)',
    type: 'BUS',
    escortName: 'Daniel Okoro',
    schoolName: 'Whitesands School',
    status: 'STANDBY',
    speed: '0 km/h',
    fuel: '95%',
    trackerStatus: 'ACTIVE',
  },
  {
    id: 'VEH-105',
    plateNumber: 'APP-901-LK',
    model: 'Toyota HiAce (14 Seater)',
    type: 'BUS',
    escortName: 'Kazeem Oladipo',
    schoolName: 'Corona School VI',
    status: 'FLAGGED',
    speed: '0 km/h',
    fuel: '80%',
    trackerStatus: 'FLAGGED',
  },
];

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

  const [escorts, setEscorts] = useState(INITIAL_ESCORT_ROSTER);
  const [gateOfficers, setGateOfficers] = useState(INITIAL_GATE_OFFICERS);
  const [gateActivities, setGateActivities] = useState(INITIAL_GATE_ACTIVITIES);
  const [safetyIncidents, setSafetyIncidents] = useState(INITIAL_SAFETY_INCIDENTS);
  const [escalations, setEscalations] = useState(INITIAL_ESCALATIONS);
  const [schools, setSchools] = useState(INITIAL_SCHOOLS_ROSTER);
  const [vehicles, setVehicles] = useState(INITIAL_VEHICLES_FLEET);

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
    { type: 'insight', text: 'All 52 schools in Lagos Mainland are online. Morning check-in completion is at 94.2%.' },
    { type: 'insight', text: 'Route 3 (Gbagada → CitiLights) is running 18m behind schedule due to expressway roadwork.' },
    { type: 'insight', text: 'Kazeem Oladipo (EMR-3309) has triggered 2 speed violations. City Manager review recommended.' },
  ]);

  // City Audit Trail State
  const [auditLogs, setAuditLogs] = useState([
    {
      id: 'AUD-901',
      time: '10:30 AM',
      actor: 'City Manager (You)',
      target: 'Kazeem Oladipo (EMR-3309)',
      action: 'SAFETY_FLAG_ISSUED',
      details: 'Flagged for school-zone speed violation review.',
    },
    {
      id: 'AUD-902',
      time: '10:15 AM',
      actor: 'Officer Chioma Nwosu',
      target: 'Aisha Bello',
      action: 'GATE_OVERRIDE_RECORDED',
      details: 'Manual override pickup approved after direct parent telephone verification.',
    },
    {
      id: 'AUD-903',
      time: '09:40 AM',
      actor: 'City Manager (You)',
      target: 'Emeka Johnson (EMR-2031)',
      action: 'CREDENTIALS_RE-VERIFIED',
      details: 'Annual driver licence renewal confirmed and unlocked.',
    },
    {
      id: 'AUD-904',
      time: '08:15 AM',
      actor: 'City Operations System',
      target: '52 City Schools',
      action: 'MORNING_DISPATCH_COMMENCED',
      details: '245 Escorts synchronized and morning safety perimeter activated.',
    },
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
              <span className="text-xl font-black text-white">52</span>
              <span className="text-[10px] font-bold text-slate-400">/ 58</span>
            </div>
            <span className="inline-block mt-1 px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-emerald-500/20 text-emerald-400">
              89.7% Live
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
            <span className="text-xl font-black text-white">245</span>
            <div className="text-[9px] text-slate-400 font-semibold mt-0.5 truncate">
              MyEduRide: <strong className="text-white">172</strong> · Sch: <strong className="text-white">73</strong>
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
              <span className="text-xl font-black text-white">64</span>
              <span className="text-[10px] font-bold text-emerald-400 font-mono">ON DUTY</span>
            </div>
            <span className="inline-block mt-1 px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-purple-500/20 text-purple-300">
              4 Overrides Today
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
            <span className="text-xl font-black text-white">164</span>
            <div className="text-[9px] text-slate-400 font-semibold mt-0.5 truncate">
              On Time: <strong className="text-emerald-400">158</strong> · Delayed: <strong className="text-amber-400">6</strong>
            </div>
          </div>
        </div>

        {/* Stat 5: Students En Route */}
        <div
          onClick={() => switchTab('trips-management')}
          className="bg-[#0b1c30] rounded-2xl border border-slate-800 p-3 flex flex-col justify-between cursor-pointer hover:border-slate-700"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">En Route</span>
            <Users size={15} className="text-indigo-400" />
          </div>
          <div className="mt-2">
            <span className="text-xl font-black text-white">2,368</span>
            <span className="inline-block mt-1 px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-indigo-500/20 text-indigo-300">
              Delivered: 1,987
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
            <AlertTriangle size={15} className="text-red-400 animate-bounce" />
          </div>
          <div className="mt-2">
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-black text-red-400">2</span>
              <span className="text-[10px] font-bold text-amber-400">Open</span>
            </div>
            <span className="inline-block mt-1 px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-red-500/20 text-red-300">
              1 Critical Review
            </span>
          </div>
        </div>

        {/* Stat 7: Operational Timing */}
        <div
          onClick={() => switchTab('trips-management')}
          className="bg-[#0b1c30] rounded-2xl border border-slate-800 p-3 flex flex-col justify-between cursor-pointer hover:border-slate-700"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Punctuality</span>
            <Clock size={15} className="text-emerald-400" />
          </div>
          <div className="mt-2">
            <span className="text-xl font-black text-emerald-400">96.4%</span>
            <span className="inline-block mt-1 px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-emerald-500/20 text-emerald-400">
              Avg ETA: 18 min
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
              <span className="text-xl font-black text-amber-400">2</span>
              <span className="text-[10px] font-bold text-slate-400">Tickets</span>
            </div>
            <span className="inline-block mt-1 px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-amber-500/20 text-amber-300">
              Parent & School
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
          { id: 'trips-management', label: 'Active Trips & Operational Timing', icon: Navigation, count: 164 },
          { id: 'assignments', label: 'Bookings & Escort Assignments', icon: ClipboardList },
          { id: 'safety-incidents', label: 'Safety Incidents & Panic Triage', icon: AlertTriangle, count: safetyIncidents.length, alert: true },
          { id: 'escalations', label: 'Parent & School Escalations', icon: AlertCircle, count: escalations.length },
          { id: 'communication', label: 'Approved Dispatch & Broadcasts', icon: MessageSquare },
          { id: 'schools', label: 'Schools', icon: School, count: schools.length },
          { id: 'vehicles', label: 'Vehicles Fleet', icon: Car, count: vehicles.length },
          { id: 'audit-logs', label: 'City Governance & Audit Ledger', icon: Shield },
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
                      Real-time GPS telemetry for 245 escorts, 52 schools, and 64 gate stations in {selectedCity}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-[11px] font-bold">
                  <span className="flex items-center gap-1 text-emerald-400">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Normal Flow (158)
                  </span>
                  <span className="flex items-center gap-1 text-amber-400">
                    <span className="w-2 h-2 rounded-full bg-amber-500"></span> Delayed / Congested (6)
                  </span>
                  <span className="flex items-center gap-1 text-red-400">
                    <span className="w-2 h-2 rounded-full bg-red-500"></span> Speed / Safety Alert (1)
                  </span>
                </div>
              </div>

              {/* Simulated Tactical Map Canvas */}
              <div className="relative my-3 flex-1 min-h-[380px] rounded-2xl overflow-hidden bg-slate-900 border border-slate-800 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:16px_16px]">
                {/* SVG Route Vectors */}
                <div className="absolute inset-0 opacity-40 pointer-events-none">
                  <svg className="w-full h-full text-slate-700" xmlns="http://www.w3.org/2000/svg">
                    <path d="M 20 100 Q 200 80 400 150 T 800 250" fill="none" stroke="#00A859" strokeWidth="3" strokeDasharray="6,6" className="animate-pulse" />
                    <path d="M 150 0 Q 180 200 250 400" fill="none" stroke="#3b82f6" strokeWidth="2.5" />
                    <path d="M 450 0 Q 380 200 520 400" fill="none" stroke="#f59e0b" strokeWidth="2.5" />
                  </svg>
                </div>

                {/* Map Geographic Markers */}
                <span className="absolute top-4 left-8 text-xs font-black text-slate-500 tracking-wider">Ikeja GRA</span>
                <span className="absolute top-12 left-1/2 -translate-x-1/2 text-xs font-black text-slate-500 tracking-wider">Maryland / Ojota</span>
                <span className="absolute top-28 left-1/4 text-xs font-black text-slate-500 tracking-wider">Surulere</span>
                <span className="absolute bottom-20 left-1/3 text-xs font-black text-slate-500 tracking-wider">Yaba Tech Hub</span>
                <span className="absolute bottom-8 right-1/4 text-xs font-black text-slate-500 tracking-wider">Victoria Island</span>

                {/* Live Pins */}
                {/* School Pin */}
                <div className="absolute top-16 left-28 group cursor-pointer z-10">
                  <div className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-lg border-2 border-white hover:scale-125 transition-transform">
                    <School size={14} />
                  </div>
                  <span className="absolute top-8 left-1/2 -translate-x-1/2 bg-slate-950 text-white text-[9px] px-2 py-0.5 rounded shadow whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
                    St. Mary's School (Gate Active)
                  </span>
                </div>

                {/* Escort 1: On Trip Normal */}
                <div
                  onClick={() => setTripDetailModal(escorts[0])}
                  className="absolute top-28 left-1/2 cursor-pointer z-20 group"
                >
                  <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-xl border-2 border-white animate-bounce">
                    <Car size={15} />
                  </div>
                  <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-emerald-950 text-emerald-300 border border-emerald-500/50 text-[9px] font-black px-2 py-0.5 rounded-full shadow whitespace-nowrap">
                    EMR-2031 (34 km/h)
                  </div>
                </div>

                {/* Escort 2: Delayed */}
                <div
                  onClick={() => setTripDetailModal(escorts[4])}
                  className="absolute bottom-24 left-1/3 cursor-pointer z-20 group"
                >
                  <div className="w-8 h-8 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center shadow-xl border-2 border-white">
                    <Clock size={15} />
                  </div>
                  <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-amber-950 text-amber-300 border border-amber-500/50 text-[9px] font-black px-2 py-0.5 rounded-full shadow whitespace-nowrap">
                    SCH-072 (DELAY +18m)
                  </div>
                </div>

                {/* Escort 3: Speed Alert Flagged */}
                <div
                  onClick={() => setTripDetailModal(escorts[5])}
                  className="absolute bottom-14 right-1/3 cursor-pointer z-20 group"
                >
                  <div className="w-8 h-8 rounded-full bg-red-600 text-white flex items-center justify-center shadow-xl border-2 border-white animate-pulse">
                    <AlertTriangle size={15} />
                  </div>
                  <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-red-950 text-red-300 border border-red-500/50 text-[9px] font-black px-2 py-0.5 rounded-full shadow whitespace-nowrap">
                    EMR-3309 (OVERSPEED)
                  </div>
                </div>

                {/* Live Floating Trip Inspector Card */}
                <div className="absolute top-4 right-4 bg-slate-950/90 backdrop-blur-md text-white rounded-2xl p-4 shadow-2xl border border-slate-700 max-w-[260px] animate-in fade-in z-30">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                      <span className="text-xs font-black text-emerald-400">LIVE TRIP FEED</span>
                    </div>
                    <span className="px-1.5 py-0.5 bg-emerald-500/20 text-emerald-300 text-[9px] font-extrabold rounded">
                      TRP-1092
                    </span>
                  </div>

                  <div className="mt-2.5 space-y-1.5 text-[11px] text-slate-300">
                    <p><strong className="text-slate-400">Escort:</strong> Emeka Johnson (EMR-2031)</p>
                    <p><strong className="text-slate-400">Route:</strong> Ikeja GRA → St. Mary's School</p>
                    <p><strong className="text-slate-400">Students:</strong> 12 Manifest (All Scanned)</p>
                    <p><strong className="text-slate-400">Speed:</strong> 34 km/h · <strong className="text-emerald-400">ETA:</strong> 10:32 AM</p>
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-slate-800 flex gap-2">
                    <button
                      type="button"
                      onClick={() => setContactModal({ open: true, target: escorts[0], targetType: 'ESCORT', message: '', channel: 'IN_APP' })}
                      className="flex-1 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] text-center"
                    >
                      Contact Escort
                    </button>
                    <button
                      type="button"
                      onClick={() => setTripDetailModal(escorts[0])}
                      className="py-1.5 px-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-[10px]"
                    >
                      Details ↗
                    </button>
                  </div>
                </div>
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

            <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
              <span>Status:</span>
              <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400">ON TRIP (3)</span>
              <span className="px-2 py-0.5 rounded-md bg-blue-500/20 text-blue-400">AVAILABLE (1)</span>
              <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-400">DELAYED (1)</span>
              <span className="px-2 py-0.5 rounded-md bg-red-500/20 text-red-400">FLAGGED (1)</span>
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
                {filteredEscorts.map((escort) => {
                  const initials = escort.name
                    .split(' ')
                    .map((n) => n[0])
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
                })}
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
                <span className="text-xs font-bold text-slate-400">Morning Pickup Punctuality</span>
                <Clock size={16} className="text-emerald-400" />
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-black text-emerald-400">97.1%</span>
                <span className="text-xs text-slate-400">Peak (06:30 - 08:30)</span>
              </div>
            </div>

            <div className="bg-[#0b1c30] rounded-2xl border border-slate-800 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400">Average Transit Duration</span>
                <Navigation size={16} className="text-cyan-400" />
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-black text-white">21.4 min</span>
                <span className="text-xs text-slate-400">Per Route Manifest</span>
              </div>
            </div>

            <div className="bg-[#0b1c30] rounded-2xl border border-slate-800 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400">Delay Incidents Today</span>
                <AlertTriangle size={16} className="text-amber-400" />
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-black text-amber-400">6 Trips</span>
                <span className="text-xs text-slate-400">Avg delay: +14 mins</span>
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
                164 Live Vehicles
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
                  {escorts.map((e) => (
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
                  ))}
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
            {safetyIncidents.map((inc) => (
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
                      const matched = escorts.find((e) => inc.escort.includes(e.id));
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
            ))}
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
            {escalations.map((esc) => (
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
            ))}
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
                <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px]">172 Active</span>
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
                <span className="px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 text-[10px]">64 On Duty</span>
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
                <span className="px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 text-[10px]">52 Online</span>
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
                <p className="text-xs text-slate-400">Real-time status of 52 active schools in {selectedCity}</p>
              </div>
            </div>
            <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold border border-emerald-500/30">
              52 Online / 58 Enrolled
            </span>
          </div>

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
                <p className="text-xs text-slate-400">{sch.address}</p>
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
                    <strong className="text-emerald-400">{sch.complianceRate}</strong>
                  </div>
                </div>
              </div>
            ))}
          </div>
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
                <p className="text-xs text-slate-400">Tracking 198 registered vehicles operating in {selectedCity}</p>
              </div>
            </div>
            <span className="px-3 py-1 rounded-full bg-cyan-500/20 text-cyan-300 text-xs font-bold border border-cyan-500/30">
              164 On Trips
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
                {vehicles.map((v) => (
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
                ))}
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
            {auditLogs.map((log) => (
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
            ))}
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
