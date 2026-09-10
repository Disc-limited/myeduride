// @ts-nocheck
'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Users,
  QrCode,
  Search,
  UserPlus,
  Clock,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  LogOut,
  Smartphone,
  Eye,
  Camera,
  X,
  Phone,
  Building,
  Car,
  RefreshCw,
  Plus,
  Copy,
  Check,
  ShieldAlert,
  UserCheck,
  UserX,
  Send,
  ScanLine
} from 'lucide-react';
import { toast } from 'sonner';
import DigitalVisitorPassModal from './DigitalVisitorPassModal';

interface VisitorIdScanPanelProps {
  schoolId: string;
  onVisitorCountChange?: (count: number) => void;
}

export default function VisitorIdScanPanel({ schoolId, onVisitorCountChange }: VisitorIdScanPanelProps) {
  const [visitors, setVisitors] = useState([]);
  const [onCampusVisitors, setOnCampusVisitors] = useState([]);
  const [metrics, setMetrics] = useState({
    total_visitors_today: 0,
    currently_on_campus: 0,
    departed_today: 0,
    pending_approval: 0,
  });
  const [loading, setLoading] = useState(true);
  const [scanInput, setScanInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [registerModalOpen, setRegisterModalOpen] = useState(false);
  const [selectedPassVisitor, setSelectedPassVisitor] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Staff Directory state for host selection
  const [schoolStaff, setSchoolStaff] = useState<any[]>([]);
  const [loadingStaff, setLoadingStaff] = useState(false);
  const [staffSearchQuery, setStaffSearchQuery] = useState('');
  const [useCustomHost, setUseCustomHost] = useState(false);

  // Camera QR Scanner state
  const [cameraModalOpen, setCameraModalOpen] = useState(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const jsQRRef = useRef<any>(null);

  // Form for Register Visitor
  const [form, setForm] = useState({
    full_name: '',
    phone: '',
    email: '',
    purpose_of_visit: '',
    person_to_see: '',
    department: 'General Administration',
    host_user_id: '',
    vehicle_plate: '',
    visitor_type: 'Parent / Guardian',
    require_host_approval: true,
  });

  // Load jsqr dynamically
  useEffect(() => {
    import('jsqr')
      .then((m) => {
        jsQRRef.current = m.default;
      })
      .catch((err) => console.error('[VisitorIdScanPanel] Failed to load jsqr:', err));
  }, []);

  const loadVisitors = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/gate/visitors?school_id=${schoolId || ''}`);
      const json = await res.json();
      if (json.success) {
        setVisitors(json.all_visitors || []);
        setOnCampusVisitors(json.on_campus_visitors || []);
        setMetrics(json.metrics || {});
        onVisitorCountChange?.(json.metrics?.currently_on_campus || 0);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load visitor records');
    } finally {
      setLoading(false);
    }
  };

  const loadStaff = async () => {
    if (!schoolId) return;
    try {
      setLoadingStaff(true);
      const res = await fetch(`/api/schools/staff?school_id=${schoolId}`);
      const json = await res.json();
      if (json.staff) {
        const mapped = json.staff.map((s: any) => ({
          user_id: s.user_id,
          full_name: s.profile?.full_name || s.full_name || 'School Staff',
          job_title: s.job_title || 'Staff',
          phone: s.profile?.phone || s.phone || '',
          email: s.profile?.email || s.email || '',
        })).sort((a: any, b: any) => a.full_name.localeCompare(b.full_name));
        setSchoolStaff(mapped);
      }
    } catch (err) {
      console.error('[loadStaff] Error loading staff list:', err);
    } finally {
      setLoadingStaff(false);
    }
  };

  useEffect(() => {
    loadVisitors();
    loadStaff();
  }, [schoolId]);

  // Clean raw token input (handles pasted URL, hashes, whitespace)
  const sanitizeScanInput = (raw: string) => {
    let clean = (raw || '').trim();
    if (clean.includes('/pass/visitor/')) {
      clean = clean.split('/pass/visitor/').pop()?.split('?')[0]?.split('#')[0] || clean;
    }
    return clean.replace(/^[#\s]+|[#\s]+$/g, '');
  };

  const executeVerifyScan = async (rawToken: string) => {
    const cleanToken = sanitizeScanInput(rawToken);
    if (!cleanToken) {
      toast.error('Please enter or scan a visitor pass token');
      return;
    }

    try {
      const res = await fetch('/api/gate/visitors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'scan_verify_visitor',
          school_id: schoolId,
          scan_token: cleanToken,
        }),
      });
      const json = await res.json();

      if (json.success) {
        if (json.action_performed === 'exit') {
          toast.success(json.message || `Visitor ${json.visitor.full_name} exited.`);
        } else if (json.action_performed === 'pending_clearance') {
          toast.warning(json.message || `Awaiting host clearance!`);
        } else {
          toast.info(json.message || `Visitor pass verified: ${json.visitor.full_name}`);
        }
        setScanInput('');
        loadVisitors();
      } else {
        if (json.denied) {
          toast.error(json.error || 'Access Denied: Unwanted visitors are not allowed on premises.', {
            duration: 6000,
          });
        } else {
          toast.error(json.error || 'Digital pass not recognized. Please verify ID token.');
        }
      }
    } catch (err: any) {
      toast.error('Scan processing error. Please try again.');
    }
  };

  const handleScanSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    executeVerifyScan(scanInput);
  };

  const handleHostRespond = async (visitorId: string, decision: 'accepted' | 'declined') => {
    try {
      const res = await fetch('/api/gate/visitors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'host_respond',
          school_id: schoolId,
          visitor_id: visitorId,
          decision,
        }),
      });
      const json = await res.json();
      if (json.success) {
        if (decision === 'accepted') {
          toast.success(json.message || 'Visitor approved for entry!');
        } else {
          toast.error(json.message || 'Visitor declined. Entry denied.', { duration: 5000 });
        }
        loadVisitors();
      } else {
        toast.error(json.error || 'Failed to update host decision');
      }
    } catch (err) {
      toast.error('Network error updating clearance status');
    }
  };

  const handleRegisterVisitor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.full_name || !form.phone || !form.purpose_of_visit) {
      toast.error('Name, phone, and purpose of visit are required');
      return;
    }
    if (!form.person_to_see) {
      toast.error('Please designate a staff host or person to see');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/gate/visitors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'register_visitor',
          school_id: schoolId,
          visitor_data: {
            ...form,
            pre_approved: !form.require_host_approval,
          },
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(json.message || `Visitor registered! Digital Pass generated.`);
        setRegisterModalOpen(false);
        setSelectedPassVisitor(json.visitor);
        setForm({
          full_name: '',
          phone: '',
          email: '',
          purpose_of_visit: '',
          person_to_see: '',
          department: 'General Administration',
          host_user_id: '',
          vehicle_plate: '',
          visitor_type: 'Parent / Guardian',
          require_host_approval: true,
        });
        setStaffSearchQuery('');
        setUseCustomHost(false);
        loadVisitors();
      } else {
        toast.error(json.error || 'Failed to register visitor');
      }
    } catch (err: any) {
      toast.error('Registration error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleManualExit = async (visitorId: string, visitorName: string) => {
    try {
      const res = await fetch('/api/gate/visitors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'log_visitor_exit',
          school_id: schoolId,
          visitor_id: visitorId,
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(`Visitor ${visitorName} exit recorded.`);
        loadVisitors();
      }
    } catch (err) {
      toast.error('Failed to log exit');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(text);
    toast.success(`Pass Token ${text} copied!`);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Camera QR scanning helpers
  const stopCamera = () => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraModalOpen(false);
  };

  const startCamera = async (facing: 'environment' | 'user' = facingMode) => {
    stopCamera();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing },
        audio: false,
      });
      streamRef.current = stream;
      setCameraModalOpen(true);

      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(console.error);
          startQrLoop();
        }
      }, 300);
    } catch (err) {
      console.error('[startCamera] Error accessing camera:', err);
      toast.error('Unable to access camera. Please check camera permissions.');
    }
  };

  const startQrLoop = () => {
    if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    scanIntervalRef.current = setInterval(() => {
      const video = videoRef.current;
      const jsQR = jsQRRef.current;
      if (!video || !ctx || !jsQR || video.readyState !== video.HAVE_ENOUGH_DATA) return;

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: 'dontInvert',
      });

      if (code && code.data) {
        stopCamera();
        const scannedToken = sanitizeScanInput(code.data);
        setScanInput(scannedToken);
        toast.success(`QR Scanned: ${scannedToken}`);
        executeVerifyScan(scannedToken);
      }
    }, 250);
  };

  // Filtered staff list for search
  const filteredStaff = schoolStaff.filter(
    (s) =>
      s.full_name.toLowerCase().includes(staffSearchQuery.toLowerCase()) ||
      s.job_title.toLowerCase().includes(staffSearchQuery.toLowerCase())
  );

  const filteredVisitors = visitors.filter(
    (v) =>
      (v.full_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (v.phone || '').includes(searchQuery) ||
      (v.id || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (v.digital_pass_token || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (v.person_to_see || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 font-sans">
      {/* SCANNING WORKSTATION & ACTIONS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left 2 Cols: High-Speed Scan Terminal */}
        <div className="lg:col-span-2 bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-purple-100 text-purple-800 flex items-center justify-center font-black">
                <QrCode size={24} />
              </div>
              <div>
                <h3 className="font-black text-slate-900 text-base">Digital Visitor Scan & Verification</h3>
                <p className="text-xs text-slate-500 font-medium">
                  Scan smartphone QR code passes, paste pass tokens, or camera scan visitor passes.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => startCamera()}
                className="px-3 py-2.5 rounded-2xl bg-purple-100 hover:bg-purple-200 text-purple-800 font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-colors"
                title="Scan QR with Camera"
              >
                <Camera size={16} />
                <span className="hidden sm:inline">Camera Scan</span>
              </button>

              <button
                type="button"
                onClick={() => setRegisterModalOpen(true)}
                className="px-4 py-2.5 rounded-2xl bg-[#00A859] hover:bg-emerald-600 text-white font-black text-xs flex items-center gap-1.5 shadow-md shadow-emerald-600/20 cursor-pointer transition-all"
              >
                <Plus size={16} />
                <span>Register Visitor</span>
              </button>
            </div>
          </div>

          {/* Quick Scan Input Box */}
          <form onSubmit={handleScanSubmit} className="space-y-3">
            <div className="relative flex items-center">
              <input
                type="text"
                autoFocus
                placeholder="Scan QR pass, paste Pass ID (e.g. EDURIDE-VIS-627381) or phone number..."
                value={scanInput}
                onChange={(e) => setScanInput(e.target.value)}
                className="w-full pl-12 pr-32 py-3.5 bg-slate-50 border-2 border-slate-200 focus:border-purple-600 rounded-2xl text-xs font-mono font-bold focus:outline-none transition-all"
              />
              <QrCode className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs cursor-pointer shadow-xs transition-colors"
                >
                  Verify / Check
                </button>
              </div>
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium px-1">
              <span>Supports smartphone QR tokens, web pass links, and manual ID/phone matching.</span>
              <span className="font-bold text-purple-700">Digital verification & clearance</span>
            </div>
          </form>

          {/* KPI Snapshot */}
          <div className="grid grid-cols-4 gap-2.5 pt-2">
            <div className="p-3 rounded-2xl bg-purple-50 border border-purple-100 text-center">
              <span className="text-[10px] font-black uppercase text-purple-800 tracking-wider">Total Today</span>
              <p className="text-xl font-black text-purple-900 mt-0.5">{metrics.total_visitors_today}</p>
            </div>
            <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-center">
              <span className="text-[10px] font-black uppercase text-amber-800 tracking-wider">Awaiting Clearance</span>
              <p className="text-xl font-black text-amber-900 mt-0.5">{metrics.pending_approval || 0}</p>
            </div>
            <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-100 text-center">
              <span className="text-[10px] font-black uppercase text-emerald-800 tracking-wider">On Campus</span>
              <p className="text-xl font-black text-emerald-900 mt-0.5">{metrics.currently_on_campus}</p>
            </div>
            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-center">
              <span className="text-[10px] font-black uppercase text-slate-600 tracking-wider">Departed</span>
              <p className="text-xl font-black text-slate-900 mt-0.5">{metrics.departed_today}</p>
            </div>
          </div>
        </div>

        {/* Right Col: Active On-Campus Quick Release Station */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h4 className="font-black text-slate-900 text-sm">Active Visitors On Campus</h4>
              <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-extrabold text-[10px]">
                {onCampusVisitors.length} Active
              </span>
            </div>

            <div className="space-y-2.5 mt-3 max-h-72 overflow-y-auto pr-1">
              {onCampusVisitors.map((v) => {
                const passToken = v.digital_pass_token || v.id;
                const isPending = v.host_response === 'pending' || v.security_flag === 'restricted';
                const isDeclined = v.host_response === 'declined' || v.security_flag === 'flagged';

                return (
                  <div key={v.id} className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2 text-xs">
                    <div className="flex items-start justify-between gap-1">
                      <div>
                        <h5 className="font-black text-slate-900">{v.full_name}</h5>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[10px] font-mono text-purple-700 font-bold">{passToken}</span>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(passToken)}
                            className="text-slate-400 hover:text-slate-700 cursor-pointer"
                            title="Copy Pass Token"
                          >
                            {copiedId === passToken ? <Check size={11} className="text-emerald-600" /> : <Copy size={11} />}
                          </button>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleManualExit(v.id, v.full_name)}
                        className="px-2.5 py-1 rounded-lg bg-rose-100 hover:bg-rose-200 text-rose-800 font-black text-[10px] uppercase cursor-pointer"
                      >
                        Log Exit
                      </button>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <span>Host: <strong className="text-slate-800">{v.person_to_see}</strong></span>
                      {isPending && (
                        <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-bold">
                          Pending Clearance
                        </span>
                      )}
                      {isDeclined && (
                        <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 text-[10px] font-bold">
                          Host Declined
                        </span>
                      )}
                      {!isPending && !isDeclined && (
                        <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                          Cleared
                        </span>
                      )}
                    </div>

                    {/* Quick Gate Officer Clearance Controls if Host Hasn't Responded */}
                    {isPending && (
                      <div className="flex items-center gap-1.5 pt-1 border-t border-slate-200">
                        <span className="text-[10px] text-slate-400 font-bold">Officer Action:</span>
                        <button
                          type="button"
                          onClick={() => handleHostRespond(v.id, 'accepted')}
                          className="px-2 py-0.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold cursor-pointer"
                        >
                          Approve Entry
                        </button>
                        <button
                          type="button"
                          onClick={() => handleHostRespond(v.id, 'declined')}
                          className="px-2 py-0.5 rounded-md bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-bold cursor-pointer"
                        >
                          Deny / Turn Away
                        </button>
                      </div>
                    )}

                    <div className="flex items-center justify-between text-[10px] text-slate-400 pt-0.5 border-t border-slate-100">
                      <span>Entry: {new Date(v.entry_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      <button
                        type="button"
                        onClick={() => setSelectedPassVisitor(v)}
                        className="text-purple-600 font-bold hover:underline cursor-pointer"
                      >
                        View Digital Pass
                      </button>
                    </div>
                  </div>
                );
              })}
              {onCampusVisitors.length === 0 && (
                <div className="p-6 text-center text-slate-400 text-xs">
                  No visitors currently checked into campus.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ALL VISITORS OPERATIONAL RECORD TABLE */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <Users size={18} className="text-slate-600" />
            <h3 className="font-black text-slate-900 text-base">School Visitor Operational Log</h3>
          </div>

          <div className="relative w-full max-w-xs">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
            <input
              type="text"
              placeholder="Search visitor, Pass ID, host, phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
              <tr>
                <th className="p-3 font-bold">Visitor Details</th>
                <th className="p-3 font-bold">Pass ID / Token</th>
                <th className="p-3 font-bold">Purpose of Visit</th>
                <th className="p-3 font-bold">Host Staff Assigned</th>
                <th className="p-3 font-bold">Security Clearance</th>
                <th className="p-3 font-bold">Entry Time</th>
                <th className="p-3 font-bold">Status</th>
                <th className="p-3 font-bold text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredVisitors.map((v) => {
                const passToken = v.digital_pass_token || v.id;
                const isPending = v.host_response === 'pending' || v.security_flag === 'restricted';
                const isDeclined = v.host_response === 'declined' || v.security_flag === 'flagged';
                const isAccepted = v.host_response === 'accepted' || (!isPending && !isDeclined);

                return (
                  <tr key={v.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="p-3 font-bold text-slate-900">
                      {v.full_name}
                      <span className="block text-[10px] text-slate-400 font-mono">{v.phone}</span>
                    </td>
                    <td className="p-3 font-mono text-[11px] font-bold text-purple-900">
                      <div className="flex items-center gap-1.5">
                        <span>{passToken}</span>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(passToken)}
                          className="text-slate-400 hover:text-slate-800 p-1 rounded hover:bg-slate-100 cursor-pointer"
                          title="Copy Pass Token to scan"
                        >
                          {copiedId === passToken ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                        </button>
                      </div>
                    </td>
                    <td className="p-3 text-slate-700 font-medium">{v.purpose_of_visit}</td>
                    <td className="p-3">
                      <span className="font-bold text-slate-800 block">{v.person_to_see}</span>
                      <span className="text-[10px] text-slate-400">{v.department || 'Administration'}</span>
                    </td>
                    <td className="p-3">
                      {isPending && (
                        <div className="space-y-1">
                          <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-extrabold text-[10px] uppercase inline-flex items-center gap-1">
                            <Clock size={10} /> Pending Clearance
                          </span>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleHostRespond(v.id, 'accepted')}
                              className="px-1.5 py-0.5 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[10px] font-bold cursor-pointer"
                              title="Officer Approve"
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              onClick={() => handleHostRespond(v.id, 'declined')}
                              className="px-1.5 py-0.5 rounded bg-rose-50 hover:bg-rose-100 text-rose-700 text-[10px] font-bold cursor-pointer"
                              title="Officer Deny"
                            >
                              Deny
                            </button>
                          </div>
                        </div>
                      )}
                      {isDeclined && (
                        <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 font-extrabold text-[10px] uppercase inline-flex items-center gap-1">
                          <ShieldAlert size={10} /> Entry Declined
                        </span>
                      )}
                      {isAccepted && (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-extrabold text-[10px] uppercase inline-flex items-center gap-1">
                          <CheckCircle2 size={10} /> Host Cleared
                        </span>
                      )}
                    </td>
                    <td className="p-3 font-bold text-emerald-700">
                      {new Date(v.entry_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="p-3">
                      <span
                        className={`px-2.5 py-0.5 rounded-full font-extrabold text-[10px] uppercase ${
                          v.status === 'on_campus' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {v.status === 'on_campus' ? 'On Campus' : 'Departed'}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setScanInput(passToken);
                            executeVerifyScan(passToken);
                          }}
                          className="px-2 py-1 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-700 font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                          title="Verify or Log Exit for this pass"
                        >
                          <ScanLine size={12} />
                          <span>Scan</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedPassVisitor(v)}
                          className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                          title="View Digital Visitor Pass"
                        >
                          <Smartphone size={12} />
                          <span>Pass</span>
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

      {/* REGISTER VISITOR MODAL */}
      {registerModalOpen && (
        <div className="fixed inset-0 bg-slate-950/70 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-purple-100 text-purple-800 flex items-center justify-center font-black">
                  <UserPlus size={18} />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-base">Register Visitor Entry</h3>
                  <p className="text-xs text-slate-500 font-medium">
                    Assigns to a school staff host for real-time security clearance.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setRegisterModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-full cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleRegisterVisitor} className="space-y-3.5 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Visitor Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Engr. Chidi Okafor"
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:outline-purple-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Phone Number *</label>
                  <input
                    type="tel"
                    required
                    placeholder="+234..."
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono focus:outline-purple-600"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Visitor Classification</label>
                  <select
                    value={form.visitor_type}
                    onChange={(e) => setForm({ ...form, visitor_type: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:outline-purple-600"
                  >
                    <option value="Parent / Guardian">Parent / Guardian</option>
                    <option value="Official Vendor / Contractor">Official Vendor / Contractor</option>
                    <option value="Government Official">Government Official</option>
                    <option value="Prospective Parent">Prospective Parent</option>
                    <option value="Guest / Other">Guest / Other</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Purpose of Visit *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Academic Conference with Class Teacher"
                  value={form.purpose_of_visit}
                  onChange={(e) => setForm({ ...form, purpose_of_visit: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-purple-600"
                />
              </div>

              {/* HOST SELECTION: STAFF DIRECTORY OR CUSTOM HOST */}
              <div className="space-y-2 p-3.5 rounded-2xl bg-purple-50/50 border border-purple-100">
                <div className="flex items-center justify-between">
                  <label className="font-black text-slate-900 block flex items-center gap-1.5">
                    <Building size={14} className="text-purple-700" />
                    <span>School Staff Host to See *</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setUseCustomHost(!useCustomHost);
                      if (!useCustomHost) {
                        setForm({ ...form, host_user_id: '', person_to_see: '' });
                      }
                    }}
                    className="text-[11px] text-purple-700 font-bold hover:underline cursor-pointer"
                  >
                    {useCustomHost ? '← Select From School Staff Directory' : '+ Other / External Host'}
                  </button>
                </div>

                {!useCustomHost ? (
                  <div className="space-y-2">
                    <p className="text-[11px] text-slate-500">
                      Select the staff member the visitor is here to see. They will receive a notification to Accept or Decline entry.
                    </p>

                    {/* Quick Staff Search */}
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
                      <input
                        type="text"
                        placeholder="Search staff name or role..."
                        value={staffSearchQuery}
                        onChange={(e) => setStaffSearchQuery(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                      />
                    </div>

                    {/* Staff Selector Dropdown */}
                    <select
                      value={form.host_user_id}
                      onChange={(e) => {
                        const selId = e.target.value;
                        const selStaff = schoolStaff.find((s) => s.user_id === selId);
                        if (selStaff) {
                          setForm({
                            ...form,
                            host_user_id: selStaff.user_id,
                            person_to_see: selStaff.full_name,
                            department: selStaff.job_title || 'Staff',
                          });
                        } else {
                          setForm({ ...form, host_user_id: '', person_to_see: '' });
                        }
                      }}
                      className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl font-bold text-slate-900 focus:outline-purple-600"
                    >
                      <option value="">-- Choose School Staff Member ({filteredStaff.length} available) --</option>
                      {filteredStaff.map((staff) => (
                        <option key={staff.user_id} value={staff.user_id}>
                          {staff.full_name} ({staff.job_title})
                        </option>
                      ))}
                    </select>

                    {form.person_to_see && (
                      <div className="p-2 rounded-lg bg-purple-100/60 text-[11px] text-purple-900 font-bold flex items-center justify-between">
                        <span>Assigned Host: {form.person_to_see}</span>
                        <span className="text-[10px] text-purple-700 uppercase font-mono">{form.department}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <input
                      type="text"
                      required
                      placeholder="e.g. Maintenance Office / External Supervisor"
                      value={form.person_to_see}
                      onChange={(e) => setForm({ ...form, person_to_see: e.target.value, host_user_id: '' })}
                      className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl font-bold"
                    />
                    <span className="text-[10px] text-slate-500">
                      External contact specified. Gate officer will clear entry manually.
                    </span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Department</label>
                  <input
                    type="text"
                    value={form.department}
                    onChange={(e) => setForm({ ...form, department: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Vehicle License Plate</label>
                  <input
                    type="text"
                    placeholder="e.g. LAG-381-KT"
                    value={form.vehicle_plate}
                    onChange={(e) => setForm({ ...form, vehicle_plate: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl uppercase font-mono"
                  />
                </div>
              </div>

              {/* Clearance Checkbox */}
              <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-[11px] text-amber-800 space-y-2">
                <label className="flex items-center gap-2 cursor-pointer font-bold text-amber-900">
                  <input
                    type="checkbox"
                    checked={form.require_host_approval}
                    onChange={(e) => setForm({ ...form, require_host_approval: e.target.checked })}
                    className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500"
                  />
                  <span>Require Staff Acceptance before allowing entry into school premises</span>
                </label>
                <p className="text-[10px] text-amber-700 pl-6">
                  {form.require_host_approval
                    ? 'Security rule: Unwanted visitors are not allowed. The assigned staff will receive an alert to accept or decline.'
                    : 'Instant Clearance: Visitor pass will be immediately approved on registration.'}
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setRegisterModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 font-bold text-slate-600 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-black shadow-md shadow-purple-600/20 cursor-pointer transition-all"
                >
                  {submitting ? 'Registering...' : 'Register Entry & Generate Pass'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CAMERA QR SCANNER MODAL */}
      {cameraModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-slate-900 rounded-3xl max-w-sm w-full p-5 shadow-2xl border border-slate-800 text-white space-y-4 text-center relative">
            <button
              onClick={stopCamera}
              className="absolute top-3 right-3 text-slate-400 hover:text-white p-1.5 rounded-full bg-slate-800 cursor-pointer"
            >
              <X size={18} />
            </button>

            <div className="flex items-center justify-center gap-2 text-emerald-400 font-bold text-xs uppercase tracking-wider">
              <Camera size={16} />
              <span>Camera QR Scanner</span>
            </div>

            <p className="text-xs text-slate-400">
              Point camera at the visitor&apos;s digital smartphone pass QR code.
            </p>

            <div className="relative rounded-2xl overflow-hidden bg-black aspect-square border-2 border-emerald-500/40 flex items-center justify-center">
              <video
                ref={videoRef}
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-8 border-2 border-dashed border-emerald-400/70 rounded-2xl pointer-events-none animate-pulse"></div>
            </div>

            <div className="flex items-center justify-between gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  const nextFacing = facingMode === 'environment' ? 'user' : 'environment';
                  setFacingMode(nextFacing);
                  startCamera(nextFacing);
                }}
                className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 cursor-pointer"
              >
                Flip Camera
              </button>
              <button
                type="button"
                onClick={stopCamera}
                className="flex-1 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-xs font-bold text-white cursor-pointer"
              >
                Close Scanner
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DIGITAL VISITOR PASS MODAL */}
      {selectedPassVisitor && (
        <DigitalVisitorPassModal
          visitor={selectedPassVisitor}
          onClose={() => setSelectedPassVisitor(null)}
          onVerifyPass={(token) => {
            setScanInput(token);
            executeVerifyScan(token);
          }}
        />
      )}
    </div>
  );
}
