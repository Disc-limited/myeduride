// @ts-nocheck
'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { fetchData } from '@/lib/api';
import StudentAvatar from '@/components/shared/StudentAvatar';
import {
  LogIn,
  LogOut,
  Camera,
  CheckCircle,
  XCircle,
  ScanLine,
  Users,
  Car,
  Search,
  UserCheck,
  Bell,
} from 'lucide-react';
import NotificationsInbox from '@/components/notifications/NotificationsInbox';
import GateActivitiesReport from '@/components/gate/GateActivitiesReport';
import TodayScanStatusBanner from '@/components/gate/TodayScanStatusBanner';
import { applyScanHints, isActionBlocked } from '@/lib/gate/scan-hints-client';
import { toast } from 'sonner';
import { photoSrc } from '@/lib/photo';
import ReadyForPickupList from '@/components/gate/ReadyForPickupList';
import StudentPickupVerify from '@/components/pickup/StudentPickupVerify';

function splitName(fullName) {
  const parts = (fullName || '').trim().split(/\s+/).filter(Boolean);
  return { first: parts[0] || '', last: parts.slice(1).join(' ') || '' };
}

export default function GateOfficerDashboard() {
  const [gateMode, setGateMode] = useState('arrival');
  const [sessionActive, setSessionActive] = useState(false);
  const [gateTab, setGateTab] = useState('scan');
  const [currentTime, setCurrentTime] = useState(null);
  const [todayCount, setTodayCount] = useState(0);
  const [schoolId, setSchoolId] = useState('');
  const [schoolReady, setSchoolReady] = useState(false);
  const [gateSessionId, setGateSessionId] = useState(null);
  const [scannedPerson, setScannedPerson] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [facingMode, setFacingMode] = useState('environment');
  const [allStudents, setAllStudents] = useState([]);
  const [pickupQueue, setPickupQueue] = useState([]);
  const [pickupNotices, setPickupNotices] = useState([]);
  const [pickupPersonsByStudent, setPickupPersonsByStudent] = useState({});
  const [pickupRequests, setPickupRequests] = useState([]);
  const [pickupRequestsByStudent, setPickupRequestsByStudent] = useState({});
  const [schoolInfo, setSchoolInfo] = useState({ name: '', logo_url: '', primary_color: '#1B4D3E' });
  const [studentSearch, setStudentSearch] = useState('');
  const [gateDay, setGateDay] = useState({ gate_open: true, label: null, has_override: false });
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const scanIntervalRef = useRef(null);
  const jsQRRef = useRef(null);

  const [rapidScanMode, setRapidScanMode] = useState(false);
  const [recentScans, setRecentScans] = useState([]);
  const [flashStatus, setFlashStatus] = useState(null);
  const [lastScannedPerson, setLastScannedPerson] = useState(null);
  const lastScannedRef = useRef(new Map());

  const addToScanHistory = (scan) => {
    setRecentScans((prev) => [
      {
        id: Date.now().toString() + '-' + Math.random().toString().slice(2, 6),
        timestamp: new Date().toLocaleTimeString(),
        ...scan,
      },
      ...prev.slice(0, 9),
    ]);
  };

  const triggerFlash = (status) => {
    setFlashStatus(status);
    setTimeout(() => {
      setFlashStatus(null);
    }, 1000);
  };

  const playBeep = (type) => {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === 'success') {
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        osc.start();
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
        osc.stop(ctx.currentTime + 0.15);
      } else {
        osc.frequency.setValueAtTime(180, ctx.currentTime);
        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        osc.start();
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
        osc.stop(ctx.currentTime + 0.35);
      }
    } catch (e) {
      console.warn('[Audio] Failed to play beep:', e);
    }
  };

  useEffect(() => {
    import('jsqr')
      .then((m) => {
        jsQRRef.current = m.default;
      })
      .catch((err) => console.error('[GateOfficerDashboard] Failed to load jsqr:', err));
  }, []);

  const scannedNames = useMemo(() => {
    if (!scannedPerson?.person?.name) return { first: '', last: '' };
    return splitName(scannedPerson.person.name);
  }, [scannedPerson]);

  const noticeForStudent = useCallback(
    (studentId) => pickupNotices.find((n) => n.student_id === studentId),
    [pickupNotices]
  );

  const pickupRequestForStudent = useCallback(
    (studentId) => pickupRequestsByStudent[studentId] || null,
    [pickupRequestsByStudent]
  );

  const attachPickupContext = useCallback(
    (studentId) => {
      const notice = noticeForStudent(studentId);
      const request = pickupRequestForStudent(studentId);
      const persons =
        pickupPersonsByStudent[studentId] ||
        notice?.authorised_pickup_persons ||
        request?.authorised_pickup_persons ||
        [];
      return {
        pickup_notice: notice || null,
        pickup_request: request || null,
        pickup_persons: persons,
      };
    },
    [noticeForStudent, pickupRequestForStudent, pickupPersonsByStudent]
  );

  const loadGateData = useCallback(async () => {
    if (!schoolId) return;
    try {
      const res = await fetch(`/api/gate/dashboard?school_id=${schoolId}&t=${Date.now()}`, {
        credentials: 'include',
        cache: 'no-store',
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Could not load pickup queue');
        return;
      }
      if (data.students) setAllStudents(data.students);
      setPickupQueue(data.pickup_queue || []);
      if (data.pickup_notices) setPickupNotices(data.pickup_notices);
      if (data.pickup_persons_by_student) setPickupPersonsByStudent(data.pickup_persons_by_student);
      if (data.pickup_requests) setPickupRequests(data.pickup_requests);
      if (data.pickup_requests_by_student) setPickupRequestsByStudent(data.pickup_requests_by_student);
      if (data.school) {
        setSchoolInfo({
          name: data.school.name || '',
          logo_url: data.school.logo_url || '',
          primary_color: data.school.primary_color || '#1B4D3E',
        });
      }
      if (data.gate_day) setGateDay(data.gate_day);
    } catch (e) {
      console.error(e);
      toast.error('Could not load gate data');
    }
  }, [schoolId]);

  useEffect(() => {
    setCurrentTime(new Date());
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    loadSchool();
    return () => {
      clearInterval(timer);
      stopCamera();
    };
  }, []);

  useEffect(() => {
    if (!schoolId) return undefined;
    loadGateData();
    const poll = setInterval(loadGateData, 15000);
    return () => clearInterval(poll);
  }, [schoolId, loadGateData]);

  useEffect(() => {
    if (sessionActive && gateTab === 'scan') {
      if (!streamRef.current || !streamRef.current.active) {
        requestAnimationFrame(() => startCamera());
      } else if (!scannedPerson && !scanning) {
        startQrScanning();
      }
    } else {
      pauseQrScanning();
      if (!sessionActive) {
        stopCamera();
      }
    }
  }, [gateTab, sessionActive, scannedPerson]);

  const loadSchool = async () => {
    try {
      const data = await fetchData('get_school_admin_data', { role: 'gate_officer' });
      if (data.school_id) {
        setSchoolId(data.school_id);
        setSchoolReady(true);
      } else {
        toast.error('No school linked to your gate officer account');
      }
      if (data.school) {
        setSchoolInfo({
          name: data.school.name || '',
          logo_url: data.school.logo_url || '',
          primary_color: data.school.primary_color || '#1B4D3E',
        });
      }
    } catch {
      toast.error('Could not load school');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
  };

  const pauseQrScanning = () => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
  };

  const startQrScanning = () => {
    if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
    scanIntervalRef.current = setInterval(async () => {
      if (!videoRef.current || scanning || scannedPerson) return;
      const vw = videoRef.current.videoWidth;
      const vh = videoRef.current.videoHeight;
      if (!vw || !vh) return;
      const canvas = document.createElement('canvas');
      canvas.width = vw;
      canvas.height = vh;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(videoRef.current, 0, 0);
      const imageData = ctx.getImageData(0, 0, vw, vh);
      try {
        if (!jsQRRef.current) return;
        const code = jsQRRef.current(imageData.data, imageData.width, imageData.height);
        if (code?.data) {
          const lastScanned = lastScannedRef.current;
          const now = Date.now();
          if (lastScanned.has(code.data) && now - lastScanned.get(code.data) < 3000) {
            return;
          }
          lastScanned.set(code.data, now);

          clearInterval(scanIntervalRef.current);
          scanIntervalRef.current = null;
          await lookupPerson(code.data);
        }
      } catch {
        /* skip */
      }
    }, 400);
  };

  const startCamera = async (facing = facingMode) => {
    if (streamRef.current && streamRef.current.active && facing === facingMode) {
      if (videoRef.current && videoRef.current.srcObject !== streamRef.current) {
        videoRef.current.srcObject = streamRef.current;
        await videoRef.current.play().catch(() => {});
      }
      startQrScanning();
      return;
    }

    stopCamera();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing },
        audio: false,
      });
      streamRef.current = stream;
      setFacingMode(facing);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      startQrScanning();
    } catch {
      toast.error('Camera access denied');
    }
  };

  const removeFromPickupQueue = useCallback((studentId) => {
    if (!studentId) return;
    setPickupQueue((q) =>
      q.filter((item) => {
        const sid = item.student?.id || item.student_id;
        return sid !== studentId;
      })
    );
  }, []);

  const resumeScanning = useCallback(async () => {
    const releasedStudentId = scannedPerson?.type === 'student' ? scannedPerson.person?.id : null;
    setScannedPerson(null);
    setScanning(false);
    if (releasedStudentId) removeFromPickupQueue(releasedStudentId);
    await loadGateData();
    if (gateTab === 'scan') {
      if (streamRef.current && streamRef.current.active) {
        startQrScanning();
      } else {
        requestAnimationFrame(() => setTimeout(() => startCamera(), 150));
      }
    }
  }, [scannedPerson, removeFromPickupQueue, loadGateData, gateTab]);

  const switchCamera = () => {
    const newMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(newMode);
    startCamera(newMode);
  };

  const lookupPerson = async (scanData) => {
    setScanning(true);
    try {
      const res = await fetch('/api/gate/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ scan_data: scanData, school_id: schoolId }),
      });
      const data = await res.json();
      if (data.code === 'gate_closed') {
        const msg = data.error || 'Gate is closed today';
        toast.error(msg);
        playBeep('error');
        triggerFlash('error');
        addToScanHistory({
          name: 'Gate Closed',
          photo_url: null,
          type: 'error',
          status: 'error',
          message: msg,
        });
        setScanning(false);
        if (gateTab === 'scan') startQrScanning();
        return;
      }
      if (data.person) {
        const enriched = { ...data };
        if (data.type === 'student') {
          Object.assign(enriched, attachPickupContext(data.person.id));
          if (data.pickup_notice) enriched.pickup_notice = data.pickup_notice;
          if (data.pickup_request) enriched.pickup_request = data.pickup_request;
          if (data.pickup_persons?.length) enriched.pickup_persons = data.pickup_persons;
          if (data.ready_for_pickup) enriched.from_queue = true;
        }

        const actionMode = gateMode === 'arrival' ? 'arrival' : 'departure';
        const blockCheck = isActionBlocked(
          enriched.today_status,
          actionMode,
          enriched.type === 'staff'
        );

        if (blockCheck.blocked) {
          const msg = blockCheck.message || 'Action blocked';
          toast.error(msg);
          playBeep('error');
          triggerFlash('error');
          addToScanHistory({
            name: enriched.person.name,
            photo_url: enriched.person.photo_url,
            type: enriched.type,
            status: 'error',
            message: msg,
          });
          setScanning(false);
          if (gateTab === 'scan') startQrScanning();
          return;
        }

        if (enriched.type === 'student' && actionMode === 'departure' && !enriched.ready_for_pickup) {
          const msg = 'Not in Ready for Pickup list';
          toast.error(msg);
          playBeep('error');
          triggerFlash('error');
          addToScanHistory({
            name: enriched.person.name,
            photo_url: enriched.person.photo_url,
            type: enriched.type,
            status: 'error',
            message: msg,
          });
          setScanning(false);
          if (gateTab === 'scan') startQrScanning();
          return;
        }

        if (rapidScanMode) {
          setLastScannedPerson(enriched);
          await handleAccept(enriched);
        } else {
          applyScanHints(data, { toast, setMode: setGateMode });
          setScannedPerson(enriched);
          setGateTab('scan');
          pauseQrScanning();
        }
      } else {
        const msg = data.error || 'ID not found';
        toast.error(msg);
        playBeep('error');
        triggerFlash('error');
        addToScanHistory({
          name: 'Unknown Card',
          photo_url: null,
          type: 'error',
          status: 'error',
          message: msg,
        });
        setScanning(false);
        if (gateTab === 'scan') startQrScanning();
      }
    } catch (e) {
      toast.error('Scan failed');
      playBeep('error');
      triggerFlash('error');
      setScanning(false);
      if (gateTab === 'scan') startQrScanning();
    }
    setScanning(false);
  };

  const openStudentForRelease = async (student, fromQueue = false) => {
    const localCtx = attachPickupContext(student.id);
    setGateMode('dismissal');
    let today_status = null;
    let scan_hints = null;
    let pickup_notice = localCtx.pickup_notice;
    let pickup_request = localCtx.pickup_request;
    let pickup_persons = localCtx.pickup_persons || [];
    try {
      const scanValue = student.qr_code_data || student.student_id_number;
      if (scanValue && schoolId) {
        const res = await fetch('/api/gate/scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ scan_data: scanValue, school_id: schoolId }),
        });
        const data = await res.json();
        today_status = data.today_status;
        scan_hints = data.scan_hints;
        pickup_notice =
          data.pickup_notice ||
          data.pickup_context?.pickup_notice ||
          pickup_notice;
        pickup_request =
          data.pickup_request ||
          data.pickup_context?.pickup_request ||
          pickup_request;
        pickup_persons =
          (data.pickup_persons?.length ? data.pickup_persons : null) ||
          data.pickup_context?.pickup_persons ||
          pickup_persons;
        applyScanHints(data, { toast, setMode: setGateMode });
      }
    } catch {
      /* status optional */
    }

    if (today_status?.has_departure) {
      toast.info(`${student.first_name} was already checked out today`);
      removeFromPickupQueue(student.id);
      await loadGateData();
      return;
    }

    setScannedPerson({
      type: 'student',
      from_queue: fromQueue,
      pickup_notice,
      pickup_request,
      pickup_persons,
      today_status,
      scan_hints,
      person: {
        id: student.id,
        name: `${student.first_name} ${student.last_name}`,
        student_id: student.student_id_number,
        class_name: student.class?.name || '',
        photo_url: student.photo_url,
        qr_code_data: student.qr_code_data,
      },
    });
    setGateTab('scan');
    pauseQrScanning();
  };

  const handleAccept = async (personToAccept = scannedPerson) => {
    // Defend against React event arguments passed when mapped directly to onClick
    const targetPerson = (personToAccept && 'nativeEvent' in personToAccept)
      ? scannedPerson
      : personToAccept || scannedPerson;

    if (!targetPerson || accepting) return;
    setAccepting(true);
    try {
      const body = {
        school_id: schoolId,
        gate_session_id: gateSessionId,
        type: scanActionMode,
        verification_method: 'id_card_scan',
        person_type: targetPerson.type,
      };
      if (targetPerson.type === 'staff') {
        body.staff_profile_id = targetPerson.person.id;
        body.user_id = targetPerson.person.user_id;
      } else {
        body.student_id = targetPerson.person.id;
        if (scanActionMode === 'departure') {
          body.from_ready_queue = !!targetPerson.from_queue;
          const notice =
            targetPerson.pickup_notice ||
            pickupNotices.find((n) => n.student_id === targetPerson.person.id);
          if (notice?.pickup_person_name) {
            body.pickup_person_name = notice.pickup_person_name;
            body.pickup_person_phone = notice.pickup_person_phone;
          } else if (targetPerson.pickup_request?.pickup_person_name) {
            body.pickup_person_name = targetPerson.pickup_request.pickup_person_name;
            body.pickup_person_phone = targetPerson.pickup_request.pickup_person_phone;
          } else if (targetPerson.pickup_persons?.[0]?.name) {
            body.pickup_person_name = targetPerson.pickup_persons[0].name;
            body.pickup_person_phone = targetPerson.pickup_persons[0].phone;
          }
        }
      }
      const res = await fetch('/api/gate/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        const action =
          targetPerson.type === 'staff'
            ? gateMode === 'arrival'
              ? 'signed in'
              : 'signed out'
            : gateMode === 'arrival'
              ? 'checked in'
              : 'checked out';
        const lateNote =
          data.is_late && data.minutes_late != null
            ? ` (${data.minutes_late} min late)`
            : data.is_late
              ? ' (late)'
              : '';
        const successMessage = `${targetPerson.person.name} — ${action}${lateNote}`;
        toast.success(successMessage);
        setTodayCount((p) => p + 1);

        addToScanHistory({
          name: targetPerson.person.name,
          photo_url: targetPerson.person.photo_url,
          type: targetPerson.type,
          status: 'success',
          message: `${action}${lateNote}`,
        });

        playBeep('success');
        triggerFlash('success');

        if (rapidScanMode) {
          setScanning(false);
          await loadGateData();
          if (gateTab === 'scan') {
            startQrScanning();
          }
        } else {
          await resumeScanning();
        }
      } else {
        const msg = data.error || 'Failed to log';
        toast.error(msg);

        addToScanHistory({
          name: targetPerson.person.name,
          photo_url: targetPerson.person.photo_url,
          type: targetPerson.type,
          status: 'error',
          message: msg,
        });
        playBeep('error');
        triggerFlash('error');

        if (data.already_recorded) {
          if (targetPerson.type === 'student' && scanActionMode === 'departure') {
            removeFromPickupQueue(targetPerson.person.id);
          }
          if (rapidScanMode) {
            setScanning(false);
            await loadGateData();
            if (gateTab === 'scan') {
              startQrScanning();
            }
          } else {
            await resumeScanning();
          }
        }
      }
    } catch {
      toast.error('Failed — try again');
      playBeep('error');
      triggerFlash('error');
    }
    setAccepting(false);
  };

  const handleStartSession = async () => {
    if (!schoolReady || !schoolId) {
      toast.error('School not loaded');
      return;
    }
    try {
      const res = await fetch('/api/gate/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'start', school_id: schoolId, mode: gateMode }),
      });
      const data = await res.json();
      if (!data.success || !data.session_id) {
        toast.error(data.error || 'Could not start session');
        return;
      }
      setGateSessionId(data.session_id);
      setSessionActive(true);
      await loadGateData();
      setGateTab('scan');
    } catch {
      toast.error('Could not start session');
    }
  };

  const handleEndSession = async () => {
    if (!confirm('End session?')) return;
    if (gateSessionId) {
      await fetch('/api/gate/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'end', session_id: gateSessionId }),
      }).catch(() => {});
    }
    setSessionActive(false);
    setGateSessionId(null);
    setTodayCount(0);
    stopCamera();
    setScannedPerson(null);
  };

  const filteredStudents = allStudents.filter((s) => {
    const q = studentSearch.toLowerCase();
    return `${s.first_name} ${s.last_name} ${s.student_id_number} ${s.class?.name || ''}`.toLowerCase().includes(q);
  });

  const scanActionMode = gateMode === 'arrival' ? 'arrival' : 'departure';

  const gateBlock = isActionBlocked(
    scannedPerson?.today_status,
    scanActionMode,
    scannedPerson?.type === 'staff'
  );
  const gateClosedReason = !gateDay.gate_open ? gateDay.label || 'School closed today' : null;
  const gateBlockReason = gateClosedReason || (gateBlock.blocked ? gateBlock.message : null);
  const fullyComplete = scannedPerson?.scan_hints?.already_complete ||
    (scannedPerson?.today_status &&
      ((scannedPerson.type === 'staff' &&
        scannedPerson.today_status.has_clock_in &&
        scannedPerson.today_status.has_clock_out) ||
        (scannedPerson.type === 'student' &&
          scannedPerson.today_status.has_arrival &&
          scannedPerson.today_status.has_departure)));

  /** Checkout: dismissal session OR scan switched mode to departure after check-in */
  const isStudentCheckout =
    scannedPerson?.type === 'student' &&
    (gateMode === 'dismissal' || gateMode === 'departure');

  const schoolLogoSrc = photoSrc(schoolInfo.logo_url);

  const renderAcceptCard = () => (
    <div className="card-elevated p-5 mt-2">
      {schoolInfo.name && (
        <div className="flex items-center gap-3 mb-4 pb-3 border-b border-slate-100">
          {schoolLogoSrc ? (
            <img
              src={schoolLogoSrc}
              alt=""
              className="h-12 w-12 object-contain rounded-lg border border-slate-200 bg-white shrink-0"
            />
          ) : (
            <div className="h-12 w-12 rounded-lg bg-primary-100 flex items-center justify-center shrink-0">
              <span className="text-primary-800 font-black text-sm">
                {schoolInfo.name.split(' ').map((w) => w[0]).join('').slice(0, 2)}
              </span>
            </div>
          )}
          <p className="text-lg font-black text-slate-900 uppercase tracking-tight leading-tight flex-1">
            {schoolInfo.name}
          </p>
        </div>
      )}

      {scannedPerson.type === 'student' && (
        <div className="mb-4 p-4 rounded-2xl border-2 border-slate-200 bg-gradient-to-br from-slate-50 to-white">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 text-center">
            Student ID
          </p>
          <div className="flex flex-col items-center gap-2">
            {photoSrc(scannedPerson.person.photo_url) ? (
              <img
                src={photoSrc(scannedPerson.person.photo_url)}
                alt=""
                className="w-28 h-28 rounded-2xl object-cover border-4 border-white shadow-lg ring-2 ring-primary-200"
              />
            ) : (
              <StudentAvatar
                photoUrl={scannedPerson.person.photo_url}
                firstName={scannedNames.first}
                lastName={scannedNames.last}
                size="lg"
              />
            )}
            <p className="text-xl font-black text-slate-900 text-center leading-tight">
              {scannedPerson.person.name}
            </p>
            <p className="text-base font-mono font-bold text-primary-700 bg-primary-50 px-4 py-1.5 rounded-lg">
              {scannedPerson.person.student_id}
            </p>
            {scannedPerson.person.class_name && (
              <p className="text-sm font-semibold text-slate-600">{scannedPerson.person.class_name}</p>
            )}
          </div>
        </div>
      )}

      {scannedPerson.type === 'staff' && (
        <div className="flex items-center gap-4 mb-4">
          <StudentAvatar
            photoUrl={scannedPerson.person.photo_url}
            firstName={scannedNames.first}
            lastName={scannedNames.last}
            size="lg"
          />
          <div className="min-w-0 flex-1">
            <p className="text-xl font-bold text-slate-900 truncate">{scannedPerson.person.name}</p>
            <p className="text-sm text-slate-500 font-mono">{scannedPerson.person.staff_id}</p>
            {scannedPerson.person.role_label && (
              <p className="text-xs text-violet-600 capitalize">{scannedPerson.person.role_label}</p>
            )}
          </div>
        </div>
      )}
      <TodayScanStatusBanner
        todayStatus={scannedPerson.today_status}
        isStaff={scannedPerson.type === 'staff'}
      />
      {gateBlockReason && (
        <p className="text-sm font-semibold text-red-700 bg-red-50 border border-red-100 rounded-xl px-3 py-3 mb-4 text-center">
          {gateBlockReason}
        </p>
      )}
      {isStudentCheckout && (
        <StudentPickupVerify
          pickupNotice={scannedPerson.pickup_notice}
          pickupRequest={scannedPerson.pickup_request}
          pickupPersons={scannedPerson.pickup_persons || []}
          readyForPickup={!!scannedPerson.from_queue}
        />
      )}
      {scannedPerson.from_queue && !fullyComplete && (
        <p className="text-xs font-semibold text-orange-700 bg-orange-50 border border-orange-100 rounded-lg px-3 py-2 mb-4">
          Ready for pickup — teacher dismissed this student
        </p>
      )}
      {fullyComplete && scannedPerson.type === 'student' && (
        <p className="text-xs font-semibold text-slate-700 bg-slate-100 border border-slate-200 rounded-lg px-3 py-2 mb-4">
          Already signed in and out today — tap Done to return to the list.
        </p>
      )}
      <div
        className={`text-center py-3 rounded-xl mb-4 text-sm font-bold ${
          gateMode === 'arrival' ? 'bg-emerald-50 text-emerald-800' : 'bg-orange-50 text-orange-800'
        }`}
      >
        {scannedPerson.type === 'staff'
          ? (gateMode === 'arrival' ? 'STAFF SIGN IN' : 'STAFF SIGN OUT')
          : (gateMode === 'arrival' ? 'CHECK IN' : 'CHECK OUT / RELEASE')}
      </div>
      <div className="flex gap-3">
        <button type="button" onClick={resumeScanning} disabled={accepting} className="btn-danger flex-1 flex items-center justify-center gap-2 py-3">
          <XCircle size={18} /> Cancel
        </button>
        {!fullyComplete ? (
          <button
            type="button"
            onClick={() => handleAccept(scannedPerson)}
            disabled={accepting || !!gateBlockReason}
            className="btn-primary flex-1 flex items-center justify-center gap-2 py-3 disabled:opacity-50"
          >
            <CheckCircle size={18} />
            {accepting ? 'Saving…' : scannedPerson.type === 'staff' ? 'Confirm staff' : 'Confirm'}
          </button>
        ) : (
          <button type="button" onClick={resumeScanning} className="btn-primary flex-1 py-3">
            Done — scan next person
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col pt-12 pb-6">
      <header className="px-4 py-2 max-w-lg mx-auto w-full flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {schoolLogoSrc && (
            <img src={schoolLogoSrc} alt="" className="h-9 w-9 object-contain rounded-lg border border-slate-200 bg-white shrink-0" />
          )}
          <div className="min-w-0">
            {schoolInfo.name && (
              <p className="text-xs font-black text-slate-900 uppercase tracking-tight truncate leading-tight">
                {schoolInfo.name}
              </p>
            )}
            <p className="text-sm font-mono font-bold text-slate-600">
              {currentTime ? currentTime.toLocaleTimeString() : '--:--'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {sessionActive && <span className="text-sm font-bold">{todayCount} scans</span>}
          {sessionActive ? (
            <button type="button" onClick={handleEndSession} className="btn-danger text-xs px-3 py-2">End</button>
          ) : (
            <button type="button" onClick={handleStartSession} disabled={!schoolReady} className="btn-primary text-xs px-3 py-2">
              Start scan
            </button>
          )}
        </div>
      </header>

      {!sessionActive && (
        <div className="mx-4 max-w-lg mx-auto w-full mb-3 rounded-xl border border-primary-200 bg-primary-50 px-4 py-3 text-sm text-primary-900">
          <p className="font-semibold">Ready-for-pickup list is live</p>
          <p className="text-xs mt-0.5 text-primary-800">
            View the Ready tab anytime. Start a scan session when you are ready to check in/out at the gate.
          </p>
        </div>
      )}

      {!gateDay.gate_open && (
        <div className="mx-4 max-w-lg mb-3 rounded-xl border-2 border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-bold">Gate closed today</p>
          <p className="mt-0.5">{gateDay.label || 'Non-school day'} — check-in, release, and scans are blocked. School admin can add a gate override on the calendar.</p>
        </div>
      )}

      <div className="px-4 max-w-lg mx-auto w-full">
        <div className="pill-tabs mb-3">
          <button type="button" onClick={() => { setGateTab('scan'); setScannedPerson(null); }} className={gateTab === 'scan' ? 'pill-tab-active' : 'pill-tab-inactive'}>
            <ScanLine size={14} className="inline mr-1" /> Scan
          </button>
          <button type="button" onClick={() => setGateTab('pickup')} className={gateTab === 'pickup' ? 'pill-tab-active' : 'pill-tab-inactive'}>
            <Car size={14} className="inline mr-1" /> Ready ({pickupQueue.length})
          </button>
          <button type="button" onClick={() => setGateTab('students')} className={gateTab === 'students' ? 'pill-tab-active' : 'pill-tab-inactive'}>
            <Users size={14} className="inline mr-1" /> All ({allStudents.length})
          </button>
          <button type="button" onClick={() => setGateTab('alerts')} className={gateTab === 'alerts' ? 'pill-tab-active' : 'pill-tab-inactive'}>
            <Bell size={14} className="inline mr-1" /> Alerts
          </button>
          <button type="button" onClick={() => setGateTab('log')} className={gateTab === 'log' ? 'pill-tab-active' : 'pill-tab-inactive'}>
            <LogIn size={14} className="inline mr-1" /> Log
          </button>
        </div>
      </div>

      <main className="flex-1 px-4 max-w-lg mx-auto w-full overflow-y-auto">
        {scannedPerson && gateTab === 'scan' && renderAcceptCard()}

        {gateTab === 'scan' && !scannedPerson && !sessionActive && (
          <div className="card-elevated p-5 space-y-4 mb-4">
            <p className="text-sm font-semibold text-slate-800 text-center">Start gate session to scan</p>
            <div className="grid grid-cols-2 gap-3">
              <button type="button" onClick={() => setGateMode('arrival')} className={`p-4 rounded-2xl border-2 ${gateMode === 'arrival' ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200'}`}>
                <LogIn className="mx-auto mb-2 text-emerald-600" size={26} />
                <span className="block text-sm font-semibold">Arrival</span>
              </button>
              <button type="button" onClick={() => setGateMode('dismissal')} className={`p-4 rounded-2xl border-2 ${gateMode === 'dismissal' ? 'border-orange-500 bg-orange-50' : 'border-slate-200'}`}>
                <LogOut className="mx-auto mb-2 text-orange-600" size={26} />
                <span className="block text-sm font-semibold">Dismissal</span>
              </button>
            </div>
            <button type="button" onClick={handleStartSession} disabled={!schoolReady} className="btn-primary w-full py-3.5 disabled:opacity-50">
              {schoolReady ? 'Start gate session' : 'Loading…'}
            </button>
          </div>
        )}

        {gateTab === 'scan' && sessionActive && (
          <div className={scannedPerson ? 'hidden' : 'block'}>
            {/* Rapid Scan Toggle Switch */}
            <div className="flex items-center justify-between p-3.5 mb-3 rounded-2xl border-2 border-slate-100 bg-slate-50/50">
              <div className="flex flex-col">
                <span className="text-sm font-bold text-slate-900 font-sans">Rapid Scan Mode</span>
                <span className="text-xs text-slate-500 font-sans">Auto-confirm check-ins without clicking</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  const newMode = !rapidScanMode;
                  setRapidScanMode(newMode);
                  toast.info(newMode ? 'Rapid Scan (Auto-Confirm) enabled' : 'Manual verification enabled');
                }}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  rapidScanMode ? 'bg-emerald-600' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    rapidScanMode ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            <div className="aspect-[4/3] bg-slate-900 rounded-3xl overflow-hidden relative mb-3 shadow-lg">
              <video ref={videoRef} className="w-full h-full object-cover" playsInline muted autoPlay />
              
              {/* Flash overlay for visual feedback */}
              {flashStatus && (
                <div className={`absolute inset-0 pointer-events-none transition-opacity duration-300 flex items-center justify-center ${
                  flashStatus === 'success' ? 'bg-emerald-500/25 border-8 border-emerald-500' : 'bg-red-500/25 border-8 border-red-500'
                }`}>
                  <div className={`px-4 py-2 rounded-full font-bold text-white text-sm shadow-lg tracking-wide ${
                    flashStatus === 'success' ? 'bg-emerald-600' : 'bg-red-600'
                  }`}>
                    {flashStatus === 'success' ? 'SCAN SUCCESS' : 'SCAN FAILED'}
                  </div>
                </div>
              )}

              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-44 h-44 border-2 border-white/80 rounded-2xl animate-pulse" />
              </div>
              <button type="button" onClick={switchCamera} className="absolute bottom-3 right-3 bg-black/60 text-white text-xs px-3 py-2 rounded-full flex items-center gap-1">
                <Camera size={14} /> Flip
              </button>
            </div>

            {/* Rapid Scan mode status indicator banner */}
            {rapidScanMode && (
              <div className="bg-purple-50 border border-purple-200 text-purple-800 text-xs font-semibold px-4 py-2.5 rounded-xl text-center mb-3 flex items-center justify-center gap-2">
                <span className="w-2 h-2 rounded-full bg-purple-600 animate-ping" />
                Rapid Scan Mode Active (Auto-Confirm)
              </div>
            )}
            
            <p className="text-xs text-center text-slate-500 mb-4">
              Scan student or staff ID card · one sign-in and one sign-out per day
            </p>

            {/* Recent Scans History Panel */}
            {recentScans.length > 0 && (
              <div className="mt-4 pb-4">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Recent Scans</h3>
                <div className="card-elevated divide-y overflow-hidden max-h-[250px] overflow-y-auto">
                  {recentScans.map((scan) => (
                    <div key={scan.id} className="flex items-center gap-3 p-3 text-sm hover:bg-slate-50 transition-colors">
                      <StudentAvatar
                        photoUrl={scan.photo_url}
                        firstName={scan.name.split(' ')[0]}
                        lastName={scan.name.split(' ').slice(1).join(' ')}
                        size="sm"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1.5">
                          <p className="font-semibold text-slate-900 truncate">{scan.name}</p>
                          <span className="text-[10px] text-slate-400 font-mono font-medium shrink-0">{scan.timestamp}</span>
                        </div>
                        <div className="flex items-center justify-between gap-1.5 mt-0.5">
                          <span className={`text-xs ${scan.status === 'success' ? 'text-emerald-700 font-medium' : 'text-red-700 font-bold'}`}>
                            {scan.message}
                          </span>
                          <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${
                            scan.type === 'staff' ? 'bg-violet-50 text-violet-700 border border-violet-150' : 
                            scan.type === 'student' ? 'bg-blue-50 text-blue-700 border border-blue-150' :
                            'bg-slate-100 text-slate-700'
                          }`}>
                            {scan.type}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {gateTab === 'pickup' && !scannedPerson && schoolId && (
          <div className="pb-4">
            <ReadyForPickupList
              schoolId={schoolId}
              onRelease={(student) => openStudentForRelease(student, true)}
              showReleaseButton
            />
          </div>
        )}

        {gateTab === 'log' && !scannedPerson && schoolId && (
          <div className="pb-4">
            <GateActivitiesReport schoolId={schoolId} title="Release & gate log" />
          </div>
        )}

        {gateTab === 'alerts' && !scannedPerson && (
          <div className="space-y-4 pb-4">
            <NotificationsInbox schoolId={schoolId} compact />
            <div>
              <h2 className="text-sm font-bold text-slate-800 mb-2">Today&apos;s pickup messages</h2>
              {pickupRequests.length === 0 ? (
                <div className="card text-center py-6 text-slate-400 text-sm">No parent pickup messages today</div>
              ) : (
                pickupRequests.map((r) => {
                  const st = r.student;
                  const s = Array.isArray(st) ? st[0] : st;
                  const pickupSrc = photoSrc(r.pickup_person_photo);
                  return (
                    <div key={r.id} className="card p-3 mb-2 text-sm flex gap-3">
                      {pickupSrc ? (
                        <img src={pickupSrc} alt="" className="w-14 h-14 rounded-lg object-cover shrink-0 border border-slate-200" />
                      ) : (
                        <div className="w-14 h-14 rounded-lg bg-slate-100 shrink-0 flex items-center justify-center text-[10px] text-slate-400">No photo</div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold">{s?.first_name} {s?.last_name}</p>
                        <p className="text-blue-800 mt-1">
                          <strong>{r.pickup_person_name}</strong>
                          {r.pickup_person_phone ? ` · ${r.pickup_person_phone}` : ''}
                        </p>
                        {r.message && <p className="text-xs text-slate-600 mt-1">{r.message}</p>}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {gateTab === 'students' && !scannedPerson && (
          <div className="pb-4">
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mb-3">
              Reference only — release students from the Ready tab after teacher marks them ready.
            </p>
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="search"
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                placeholder="Search all registered students…"
                className="input pl-9"
              />
            </div>
            <div className="card-elevated divide-y max-h-[60vh] overflow-y-auto">
              {filteredStudents.map((s) => {
                const inQueue = pickupQueue.some((q) => q.student?.id === s.id);
                const notice = noticeForStudent(s.id);
                return (
                  <div key={s.id} className="list-row py-3">
                    <StudentAvatar photoUrl={s.photo_url} firstName={s.first_name} lastName={s.last_name} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{s.first_name} {s.last_name}</p>
                      <p className="text-xs text-slate-500 font-mono">{s.student_id_number}</p>
                      {inQueue && <span className="text-[10px] text-orange-600 font-semibold">Waiting pickup</span>}
                      {notice && <p className="text-[10px] text-blue-600">Pickup: {notice.pickup_person_name}</p>}
                    </div>
                    {inQueue ? (
                      <button
                        type="button"
                        onClick={() => openStudentForRelease(s, true)}
                        className="text-xs btn-primary px-2 py-1.5 shrink-0"
                      >
                        Release
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => s.qr_code_data && lookupPerson(s.qr_code_data)}
                        className="text-xs btn-secondary px-2 py-1.5 shrink-0"
                        title="Arrival scan only"
                      >
                        Scan
                      </button>
                    )}
                  </div>
                );
              })}
              {filteredStudents.length === 0 && (
                <p className="py-8 text-center text-slate-400 text-sm">No students found</p>
              )}
            </div>
          </div>
        )}

        {scannedPerson && gateTab !== 'scan' && renderAcceptCard()}
      </main>
    </div>
  );
}
