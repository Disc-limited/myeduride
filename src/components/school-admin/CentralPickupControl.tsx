// @ts-nocheck
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Car,
  Users,
  Shield,
  ShieldCheck,
  UserCheck,
  Footprints,
  Clock,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Phone,
  Calendar,
  ChevronRight,
  ArrowRight,
  Sparkles,
  MapPin,
  X,
  FileCheck,
  Check,
  ShieldAlert,
  Lock,
  Eye,
  SlidersHorizontal,
  Send,
  UserPlus
} from 'lucide-react';
import { toast } from 'sonner';
import StudentAvatar from '@/components/shared/StudentAvatar';
import { photoSrc } from '@/lib/photo';

export default function CentralPickupControl() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClass, setSelectedClass] = useState('all');
  const [activeFilter, setActiveFilter] = useState<'all' | 'ready' | 'assigned' | 'parent' | 'sibling' | 'walk_home' | 'completed'>('all');
  const [activeTab, setActiveTab] = useState<'queue' | 'ledger' | 'escorts'>('queue');

  // Modal State for 4-Way Assignment
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [assignmentMode, setAssignmentMode] = useState<'escort' | 'parent' | 'sibling' | 'walk_home'>('escort');
  const [escortSubType, setEscortSubType] = useState<'school' | 'myeduride'>('school');
  const [selectedEscortId, setSelectedEscortId] = useState<string>('');
  const [selectedParentId, setSelectedParentId] = useState<string>('');
  const [selectedSiblingId, setSelectedSiblingId] = useState<string>('');
  const [assignmentNotes, setAssignmentNotes] = useState('');
  const [submittingAction, setSubmittingAction] = useState(false);

  // Load Data
  const loadPickupData = useCallback(async (isSilent = false) => {
    if (!isSilent) setRefreshing(true);
    try {
      const res = await fetch('/api/school-admin/pickup-control', {
        credentials: 'include',
        cache: 'no-store',
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Failed to load central pickup control');
      }
      setData(json);
    } catch (err: any) {
      toast.error(err.message || 'Could not load pickup data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadPickupData();
    const timer = setInterval(() => loadPickupData(true), 20000);
    return () => clearInterval(timer);
  }, [loadPickupData]);

  // Classes list for filter
  const classesList = useMemo(() => {
    if (!data?.students) return [];
    const map = new Map();
    data.students.forEach((s: any) => {
      if (s.class_id && s.class_name) {
        map.set(s.class_id, s.class_name);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [data]);

  // Filtered Students
  const filteredStudents = useMemo(() => {
    if (!data?.students) return [];
    return data.students.filter((s: any) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        `${s.first_name} ${s.last_name}`.toLowerCase().includes(q) ||
        (s.student_id_number && s.student_id_number.toLowerCase().includes(q)) ||
        (s.class_name && s.class_name.toLowerCase().includes(q)) ||
        (s.today_status?.departure_picker_name && s.today_status.departure_picker_name.toLowerCase().includes(q));

      const matchesClass = selectedClass === 'all' || s.class_id === selectedClass;

      let matchesFilter = true;
      if (activeFilter === 'ready') {
        matchesFilter = s.today_status?.ready_for_pickup && !s.today_status?.departure_completed;
      } else if (activeFilter === 'assigned') {
        matchesFilter = !!s.current_assignment && !s.today_status?.departure_completed;
      } else if (activeFilter === 'parent') {
        matchesFilter = s.today_status?.departure_picker_type === 'parent';
      } else if (activeFilter === 'sibling') {
        matchesFilter = s.today_status?.departure_picker_type === 'sibling';
      } else if (activeFilter === 'walk_home') {
        matchesFilter = s.today_status?.departure_picker_type === 'walk_home' || s.walk_home_permitted;
      } else if (activeFilter === 'completed') {
        matchesFilter = !!s.today_status?.departure_completed;
      }

      return matchesSearch && matchesClass && matchesFilter;
    });
  }, [data, searchQuery, selectedClass, activeFilter]);

  // Open Assignment Modal
  const openAssignmentModal = (student: any, defaultMode: 'escort' | 'parent' | 'sibling' | 'walk_home' = 'escort') => {
    setSelectedStudent(student);
    setAssignmentMode(defaultMode);
    setAssignmentNotes('');
    // Prefill selections
    if (student.authorized_options?.parents?.length > 0) {
      setSelectedParentId(student.authorized_options.parents[0].id);
    } else {
      setSelectedParentId('');
    }
    if (student.authorized_options?.siblings?.length > 0) {
      setSelectedSiblingId(student.authorized_options.siblings[0].student_id);
    } else {
      setSelectedSiblingId('');
    }
    if (data?.escorts?.school_escorts?.length > 0) {
      setSelectedEscortId(data.escorts.school_escorts[0].id);
      setEscortSubType('school');
    } else if (data?.escorts?.myeduride_escorts?.length > 0) {
      setSelectedEscortId(data.escorts.myeduride_escorts[0].id);
      setEscortSubType('myeduride');
    } else {
      setSelectedEscortId('');
    }
  };

  // Close Assignment Modal
  const closeAssignmentModal = () => {
    setSelectedStudent(null);
    setAssignmentNotes('');
  };

  // Handle Pickup Assignment
  const handleAssignPickup = async (executeInstantRelease = false) => {
    if (!selectedStudent || !data?.school?.id) return;
    setSubmittingAction(true);

    let pickerType: any = assignmentMode;
    let pickerId = '';
    let pickerName = '';
    let pickerPhone = '';

    if (assignmentMode === 'escort') {
      pickerType = escortSubType === 'myeduride' ? 'myeduride_escort' : 'school_escort';
      const escortList = escortSubType === 'myeduride' ? data.escorts.myeduride_escorts : data.escorts.school_escorts;
      const foundEscort = escortList.find((e: any) => e.id === selectedEscortId) || escortList[0];
      if (!foundEscort) {
        toast.error('Please select an escort');
        setSubmittingAction(false);
        return;
      }
      pickerId = foundEscort.id;
      pickerName = foundEscort.full_name;
      pickerPhone = foundEscort.phone;
    } else if (assignmentMode === 'parent') {
      pickerType = 'parent';
      const foundParent = selectedStudent.authorized_options?.parents?.find((p: any) => p.id === selectedParentId) || selectedStudent.authorized_options?.parents?.[0];
      if (!foundParent) {
        toast.error('No parent profile found for this child');
        setSubmittingAction(false);
        return;
      }
      pickerId = foundParent.user_id || foundParent.id;
      pickerName = foundParent.full_name;
      pickerPhone = foundParent.phone;
    } else if (assignmentMode === 'sibling') {
      pickerType = 'sibling';
      const foundSibling = selectedStudent.authorized_options?.siblings?.find((s: any) => s.student_id === selectedSiblingId) || selectedStudent.authorized_options?.siblings?.[0];
      if (!foundSibling) {
        toast.error('No approved sibling arrangement found');
        setSubmittingAction(false);
        return;
      }
      pickerId = foundSibling.student_id;
      pickerName = `Sibling: ${foundSibling.full_name}`;
      pickerPhone = '';
    } else if (assignmentMode === 'walk_home') {
      pickerType = 'walk_home';
      pickerId = selectedStudent.id;
      pickerName = `Walk Home (Authorized: ${selectedStudent.first_name})`;
      pickerPhone = '';
    }

    try {
      const endpointAction = executeInstantRelease ? 'execute_release' : 'assign_pickup';
      const res = await fetch('/api/school-admin/pickup-control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action: endpointAction,
          school_id: data.school.id,
          student_id: selectedStudent.id,
          picker_type: pickerType,
          picker_id: pickerId,
          picker_name: pickerName,
          picker_phone: pickerPhone,
          notes: assignmentNotes,
        }),
      });

      const resJson = await res.json();
      if (!res.ok) throw new Error(resJson.error || 'Action failed');

      toast.success(
        executeInstantRelease
          ? `🎉 ${selectedStudent.first_name} released to ${pickerName}!`
          : `✓ Pickup assigned to ${pickerName} for ${selectedStudent.first_name}`
      );
      closeAssignmentModal();
      loadPickupData(true);
    } catch (err: any) {
      toast.error(err.message || 'Failed to record pickup action');
    } finally {
      setSubmittingAction(false);
    }
  };

  // Toggle Walk Home Permission
  const toggleWalkHomePermission = async (student: any) => {
    if (!data?.school?.id) return;
    const newStatus = !student.walk_home_permitted;
    try {
      const res = await fetch('/api/school-admin/pickup-control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action: 'update_walk_home_status',
          school_id: data.school.id,
          student_id: student.id,
          permitted: newStatus,
          notes: newStatus ? 'Authorized by School Admin' : 'Revoked by School Admin',
        }),
      });
      const resJson = await res.json();
      if (!res.ok) throw new Error(resJson.error);
      toast.success(newStatus ? `Walk home authorization granted for ${student.first_name}` : `Walk home authorization revoked for ${student.first_name}`);
      loadPickupData(true);
    } catch (err: any) {
      toast.error(err.message || 'Could not update walk-home permission');
    }
  };

  if (loading) {
    return (
      <div className="min-h-[500px] flex flex-col items-center justify-center p-8">
        <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center animate-bounce mb-4">
          <Car size={26} />
        </div>
        <p className="text-sm font-bold text-slate-800 animate-pulse">Loading Central Pickup Control...</p>
        <p className="text-xs text-slate-500 mt-1">Retrieving live student queue, escorts & authorization logs</p>
      </div>
    );
  }

  const metrics = data?.metrics || {
    total_students: 0,
    checked_in_today: 0,
    ready_for_pickup: 0,
    escort_assigned: 0,
    parent_picked_up: 0,
    sibling_picked_up: 0,
    walked_home: 0,
    completed_departures: 0,
  };

  return (
    <div className="space-y-6 font-sans text-slate-800 p-4 md:p-6 max-w-7xl mx-auto">
      {/* Central Control Header Banner */}
      <div className="bg-gradient-to-r from-[#07132B] via-[#0B1E36] to-[#0A1633] rounded-3xl p-6 text-white shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-5 border border-slate-800">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 font-black text-[11px] border border-emerald-400/30 uppercase tracking-wider flex items-center gap-1.5">
              <Car size={13} /> Central Control
            </span>
            <span className="px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-bold text-[10px] border border-blue-400/30">
              {data?.school?.name || 'School Campus'}
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">
            Pickup List & Dispatch Central
          </h1>
          <p className="text-slate-300 text-xs md:text-sm max-w-2xl font-medium">
            The primary interface for authorized student pickup: Assign School Escorts, City Manager Vetted MyEduRide Escorts, Parents, Siblings, or record Walk Home departures with full audit accountability.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <button
            onClick={() => loadPickupData()}
            disabled={refreshing}
            className="px-4 py-2.5 rounded-2xl bg-slate-800/80 hover:bg-slate-700 text-slate-200 font-bold text-xs transition-all border border-slate-700 flex items-center gap-2 cursor-pointer shadow-md"
          >
            <RefreshCw size={15} className={refreshing ? 'animate-spin text-emerald-400' : ''} />
            <span>{refreshing ? 'Syncing...' : 'Sync Live'}</span>
          </button>
        </div>
      </div>

      {/* KPI Metrics Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Checked In</span>
            <UserCheck size={14} className="text-emerald-500" />
          </div>
          <p className="text-xl font-black text-slate-900 mt-1">{metrics.checked_in_today}</p>
          <span className="text-[10px] text-slate-400 font-medium">of {metrics.total_students} students</span>
        </div>

        <div className="bg-amber-50/60 p-3.5 rounded-2xl border border-amber-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-amber-700 tracking-wider">Ready Queue</span>
            <Clock size={14} className="text-amber-600" />
          </div>
          <p className="text-xl font-black text-amber-900 mt-1">{metrics.ready_for_pickup}</p>
          <span className="text-[10px] text-amber-700 font-bold">Waiting at gate</span>
        </div>

        <div className="bg-cyan-50/60 p-3.5 rounded-2xl border border-cyan-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-cyan-700 tracking-wider">Escort Trips</span>
            <Car size={14} className="text-cyan-600" />
          </div>
          <p className="text-xl font-black text-cyan-900 mt-1">{metrics.escort_assigned}</p>
          <span className="text-[10px] text-cyan-700 font-bold">Assigned / In transit</span>
        </div>

        <div className="bg-blue-50/60 p-3.5 rounded-2xl border border-blue-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-blue-700 tracking-wider">Parent Pickup</span>
            <Users size={14} className="text-blue-600" />
          </div>
          <p className="text-xl font-black text-blue-900 mt-1">{metrics.parent_picked_up}</p>
          <span className="text-[10px] text-blue-700 font-medium">Verified releases</span>
        </div>

        <div className="bg-purple-50/60 p-3.5 rounded-2xl border border-purple-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-purple-700 tracking-wider">Sibling Pickup</span>
            <ShieldCheck size={14} className="text-purple-600" />
          </div>
          <p className="text-xl font-black text-purple-900 mt-1">{metrics.sibling_picked_up}</p>
          <span className="text-[10px] text-purple-700 font-medium">Approved arrangement</span>
        </div>

        <div className="bg-emerald-50/60 p-3.5 rounded-2xl border border-emerald-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-emerald-700 tracking-wider">Walk Home</span>
            <Footprints size={14} className="text-emerald-600" />
          </div>
          <p className="text-xl font-black text-emerald-900 mt-1">{metrics.walked_home}</p>
          <span className="text-[10px] text-emerald-700 font-medium">Permitted departures</span>
        </div>

        <div className="bg-slate-900 text-white p-3.5 rounded-2xl shadow-xs border border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Completed</span>
            <CheckCircle2 size={14} className="text-emerald-400" />
          </div>
          <p className="text-xl font-black text-emerald-400 mt-1">{metrics.completed_departures}</p>
          <span className="text-[10px] text-slate-400 font-medium">All logged & audited</span>
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('queue')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'queue'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-white text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Car size={14} />
            <span>Central Student Queue ({filteredStudents.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('escorts')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'escorts'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-white text-slate-600 hover:bg-slate-100'
            }`}
          >
            <ShieldCheck size={14} />
            <span>Escort Pool ({(data?.escorts?.school_escorts?.length || 0) + (data?.escorts?.myeduride_escorts?.length || 0)})</span>
          </button>

          <button
            onClick={() => setActiveTab('ledger')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'ledger'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-white text-slate-600 hover:bg-slate-100'
            }`}
          >
            <FileCheck size={14} />
            <span>Accountability Ledger ({data?.recent_activity_ledger?.length || 0})</span>
          </button>
        </div>
      </div>

      {/* TAB 1: CENTRAL STUDENT QUEUE */}
      {activeTab === 'queue' && (
        <div className="space-y-4">
          {/* Search & Filter Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search student name, ID number, class, or pickup person..."
                className="w-full pl-10 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-medium"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold text-slate-700"
              >
                <option value="all">All Classes</option>
                {classesList.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>

              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                <button
                  onClick={() => setActiveFilter('all')}
                  className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all ${
                    activeFilter === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setActiveFilter('ready')}
                  className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all ${
                    activeFilter === 'ready' ? 'bg-amber-500 text-white shadow-xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Ready ({metrics.ready_for_pickup})
                </button>
                <button
                  onClick={() => setActiveFilter('assigned')}
                  className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all ${
                    activeFilter === 'assigned' ? 'bg-cyan-600 text-white shadow-xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Assigned
                </button>
                <button
                  onClick={() => setActiveFilter('completed')}
                  className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all ${
                    activeFilter === 'completed' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Released
                </button>
              </div>
            </div>
          </div>

          {/* Student Matrix Cards */}
          {filteredStudents.length === 0 ? (
            <div className="bg-white p-12 rounded-3xl border border-slate-200 text-center space-y-3 shadow-xs">
              <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                <Search size={26} />
              </div>
              <h3 className="font-black text-slate-800 text-base">No matching students found</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Try adjusting your search criteria or filter tags to find students in the Central Control Pickup List.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredStudents.map((student: any) => {
                const isReady = student.today_status?.ready_for_pickup && !student.today_status?.departure_completed;
                const isDeparted = !!student.today_status?.departure_completed;
                const isAssigned = !!student.current_assignment && !isDeparted;
                const parents = student.authorized_options?.parents || [];
                const siblings = student.authorized_options?.siblings || [];

                return (
                  <div
                    key={student.id}
                    className={`bg-white rounded-2xl p-4 border transition-all shadow-xs flex flex-col justify-between ${
                      isDeparted
                        ? 'border-slate-200/80 opacity-80 bg-slate-50/50'
                        : isReady
                        ? 'border-amber-400/80 ring-2 ring-amber-400/20'
                        : isAssigned
                        ? 'border-cyan-400/80 ring-2 ring-cyan-400/20'
                        : 'border-slate-200/90 hover:border-slate-300'
                    }`}
                  >
                    <div>
                      {/* Card Top: Student Profile Header */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <StudentAvatar
                            photoUrl={student.photo_url}
                            firstName={student.first_name}
                            lastName={student.last_name}
                            size="md"
                          />
                          <div>
                            <h3 className="font-black text-slate-900 text-sm">
                              {student.first_name} {student.last_name}
                            </h3>
                            <p className="text-xs font-bold text-emerald-800">
                              {student.class_name} {student.grade ? `· ${student.grade}` : ''}
                            </p>
                            <span className="text-[10px] font-mono text-slate-400">
                              {student.student_id_number}
                            </span>
                          </div>
                        </div>

                        {/* Status Badge */}
                        <div className="shrink-0">
                          {isDeparted ? (
                            <span className="px-2.5 py-1 rounded-full bg-slate-900 text-white font-extrabold text-[10px] flex items-center gap-1">
                              <Check size={12} className="text-emerald-400" /> Released
                            </span>
                          ) : isReady ? (
                            <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-900 border border-amber-300 font-extrabold text-[10px] flex items-center gap-1 animate-pulse">
                              <Clock size={12} /> Ready
                            </span>
                          ) : isAssigned ? (
                            <span className="px-2.5 py-1 rounded-full bg-cyan-100 text-cyan-900 border border-cyan-300 font-extrabold text-[10px] flex items-center gap-1">
                              <Car size={12} /> Escort Assigned
                            </span>
                          ) : student.today_status?.checked_in ? (
                            <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-bold text-[10px]">
                              In Class
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-500 font-medium text-[10px]">
                              Not Checked In
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Middle: Active Pickup Info / Status Details */}
                      <div className="mt-3.5 pt-3 border-t border-slate-100 space-y-2">
                        {isDeparted ? (
                          <div className="p-2.5 rounded-xl bg-slate-100/90 text-xs space-y-1">
                            <div className="flex items-center justify-between text-[11px] font-bold text-slate-700">
                              <span>Departure Verified</span>
                              <span className="text-slate-500">
                                {student.today_status?.departure_time
                                  ? new Date(student.today_status.departure_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                  : 'Today'}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-800 font-black flex items-center gap-1">
                              <CheckCircle2 size={13} className="text-emerald-600" />
                              <span>{student.today_status?.departure_picker_name || 'Authorized Recipient'}</span>
                            </p>
                          </div>
                        ) : isAssigned ? (
                          <div className="p-2.5 rounded-xl bg-cyan-50 border border-cyan-200/80 text-xs space-y-1">
                            <div className="flex items-center justify-between text-[10px] font-black text-cyan-800 uppercase tracking-wider">
                              <span>Assigned Escort</span>
                              <span className="text-cyan-600">{student.current_assignment?.picker_type === 'myeduride_escort' ? 'MyEduRide Escort' : 'School Escort'}</span>
                            </div>
                            <p className="text-xs text-cyan-950 font-black">
                              {student.current_assignment?.picker_name}
                            </p>
                            {student.current_assignment?.picker_phone && (
                              <p className="text-[11px] text-cyan-800 font-mono">
                                📞 {student.current_assignment.picker_phone}
                              </p>
                            )}
                          </div>
                        ) : isReady ? (
                          <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200/80 text-xs">
                            <p className="text-[11px] font-black text-amber-900 flex items-center gap-1">
                              <AlertCircle size={13} className="text-amber-600" /> Marked ready by teacher
                            </p>
                            <p className="text-[10px] text-amber-700 mt-0.5">
                              {student.today_status?.ready_note || 'Student is waiting at school gate release point.'}
                            </p>
                          </div>
                        ) : null}

                        {/* Authorization Summary Grid */}
                        <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
                          <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
                            <span className="text-[10px] font-bold text-slate-400 uppercase block">Parents ({parents.length})</span>
                            <span className="font-bold text-slate-800 truncate block mt-0.5">
                              {parents[0]?.full_name || 'None listed'}
                            </span>
                          </div>
                          <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
                            <span className="text-[10px] font-bold text-slate-400 uppercase block">Siblings ({siblings.length})</span>
                            <span className="font-bold text-slate-800 truncate block mt-0.5">
                              {siblings[0]?.full_name || 'No siblings'}
                            </span>
                          </div>
                        </div>

                        {/* Walk Home Permission Indicator */}
                        <div className="flex items-center justify-between text-[11px] px-1">
                          <span className="text-slate-500 flex items-center gap-1">
                            <Footprints size={13} className={student.walk_home_permitted ? 'text-emerald-600' : 'text-slate-400'} />
                            Walk Home Authorized:
                          </span>
                          <button
                            type="button"
                            onClick={() => toggleWalkHomePermission(student)}
                            className={`font-black text-[10px] px-2 py-0.5 rounded-md cursor-pointer transition-all ${
                              student.walk_home_permitted
                                ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                                : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                            }`}
                          >
                            {student.walk_home_permitted ? 'YES (Permitted)' : 'NO (Disabled)'}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Card Bottom: Action Buttons */}
                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-2">
                      {!isDeparted ? (
                        <>
                          <button
                            type="button"
                            onClick={() => openAssignmentModal(student)}
                            className="flex-1 px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-black text-xs transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <SlidersHorizontal size={13} />
                            <span>Assign Pickup</span>
                          </button>

                          {isReady && (
                            <button
                              type="button"
                              onClick={() => openAssignmentModal(student, 'parent')}
                              className="px-3 py-2 rounded-xl bg-[#00A859] hover:bg-emerald-600 text-white font-black text-xs transition-all shadow-xs flex items-center gap-1 cursor-pointer shrink-0"
                              title="Instant Release"
                            >
                              <CheckCircle2 size={14} />
                              <span>Release</span>
                            </button>
                          )}
                        </>
                      ) : (
                        <div className="w-full flex items-center justify-between text-[11px] text-slate-400 px-1 py-1">
                          <span>Completed for today</span>
                          <button
                            type="button"
                            onClick={() => openAssignmentModal(student)}
                            className="text-xs text-primary-600 hover:underline font-bold"
                          >
                            Re-verify
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: ESCORTS DIRECTORY (SCHOOL VS CITY MANAGER APPROVED MYEDURIDE) */}
      {activeTab === 'escorts' && (
        <div className="space-y-6">
          {/* School Escorts Section */}
          <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <span className="px-2.5 py-0.5 rounded-md bg-teal-100 text-teal-800 font-extrabold text-[10px] uppercase tracking-wider">
                  Category A.1
                </span>
                <h3 className="text-base font-black text-slate-900 mt-1">School Escorts Pool</h3>
                <p className="text-xs text-slate-500 font-medium">
                  Escorts created and managed directly by the School Administrator.
                </p>
              </div>
              <span className="text-xs font-black text-slate-600 bg-slate-100 px-3 py-1.5 rounded-xl self-start">
                {data?.escorts?.school_escorts?.length || 0} Registered
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {(data?.escorts?.school_escorts || []).map((escort: any) => (
                <div key={escort.id} className="p-4 rounded-2xl border border-slate-200/90 bg-slate-50/50 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-teal-600 text-white flex items-center justify-center font-black text-sm uppercase">
                      {escort.full_name?.charAt(0) || 'E'}
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-slate-900">{escort.full_name}</h4>
                      <p className="text-[11px] text-slate-500 font-mono">📞 {escort.phone || 'No phone'}</p>
                    </div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white border border-slate-100 text-xs space-y-1">
                    <div className="flex items-center justify-between text-[10px] text-slate-500">
                      <span>Vehicle Reg</span>
                      <span className="font-bold text-slate-800">{escort.vehicle?.reg_number || 'N/A'}</span>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-slate-500">
                      <span>Vehicle Type</span>
                      <span className="font-bold text-slate-800">{escort.vehicle?.type || 'Bus / Van'}</span>
                    </div>
                  </div>
                  <span className="inline-block px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-extrabold text-[10px]">
                    ✓ School Verified
                  </span>
                </div>
              ))}
              {(!data?.escorts?.school_escorts || data.escorts.school_escorts.length === 0) && (
                <p className="text-xs text-slate-400 col-span-full py-4 text-center">
                  No school escorts currently listed. Use the Transport module to add school escorts.
                </p>
              )}
            </div>
          </div>

          {/* MyEduRide Escorts Section (City Manager Approved ONLY) */}
          <div className="bg-white p-5 rounded-3xl border border-emerald-200 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-emerald-100 pb-3">
              <div>
                <span className="px-2.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-extrabold text-[10px] uppercase tracking-wider flex items-center gap-1">
                  <ShieldCheck size={12} /> Category A.2 · City Manager Vetted
                </span>
                <h3 className="text-base font-black text-slate-900 mt-1">MyEduRide Platform Escorts</h3>
                <p className="text-xs text-slate-500 font-medium">
                  <strong>Strict Security Policy:</strong> Only MyEduRide Escorts vetted and approved by the <strong>City Manager</strong> are accessible for student pickup.
                </p>
              </div>
              <span className="text-xs font-black text-emerald-800 bg-emerald-100 px-3 py-1.5 rounded-xl self-start">
                {data?.escorts?.myeduride_escorts?.length || 0} Approved Available
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {(data?.escorts?.myeduride_escorts || []).map((escort: any) => (
                <div key={escort.id} className="p-4 rounded-2xl border border-emerald-200/80 bg-emerald-50/30 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-black text-sm uppercase">
                      {escort.full_name?.charAt(0) || 'M'}
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-slate-900">{escort.full_name}</h4>
                      <p className="text-[11px] text-slate-500 font-mono">📞 {escort.phone || 'No phone'}</p>
                    </div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white border border-emerald-100 text-xs space-y-1">
                    <div className="flex items-center justify-between text-[10px] text-slate-500">
                      <span>Operating Area</span>
                      <span className="font-bold text-slate-800">{escort.operating_area || 'Lagos'}</span>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-slate-500">
                      <span>Vehicle</span>
                      <span className="font-bold text-slate-800">{escort.vehicle?.reg_number || 'Registered'}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-1">
                    <span className="px-2 py-0.5 rounded-md bg-emerald-600 text-white font-extrabold text-[10px] flex items-center gap-1">
                      <ShieldCheck size={11} /> City Manager Approved
                    </span>
                    <span className="text-[10px] font-bold text-slate-500">
                      {escort.availability_status}
                    </span>
                  </div>
                </div>
              ))}
              {(!data?.escorts?.myeduride_escorts || data.escorts.myeduride_escorts.length === 0) && (
                <p className="text-xs text-slate-400 col-span-full py-4 text-center">
                  No platform escorts currently approved by City Manager in this zone.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: ACCOUNTABILITY LEDGER & AUDIT TRAIL */}
      {activeTab === 'ledger' && (
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <span className="px-2.5 py-0.5 rounded-md bg-blue-100 text-blue-800 font-extrabold text-[10px] uppercase tracking-wider">
                Regulatory Ledger
              </span>
              <h3 className="text-base font-black text-slate-900 mt-1">Pickup Actions & Audit Trail</h3>
              <p className="text-xs text-slate-500 font-medium">
                Every pickup action is permanently timestamped and logged for student safety and compliance.
              </p>
            </div>
            <span className="text-xs font-bold text-slate-400">
              Live Log Sync
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="p-3 font-bold">Time (Lagos)</th>
                  <th className="p-3 font-bold">Student</th>
                  <th className="p-3 font-bold">Action / Mode</th>
                  <th className="p-3 font-bold">Authorized Picker</th>
                  <th className="p-3 font-bold">Verified By</th>
                  <th className="p-3 font-bold">Audit Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(data?.recent_activity_ledger || []).map((log: any) => (
                  <tr key={log.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="p-3 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                      {log.created_at ? new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'Today'}
                    </td>
                    <td className="p-3 font-bold text-slate-900 whitespace-nowrap">
                      {log.student_name}
                      <span className="block text-[10px] text-slate-400 font-mono">{log.student_id_number}</span>
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 font-bold text-slate-700 text-[10px] uppercase">
                        {log.action_type?.replaceAll('_', ' ')}
                      </span>
                    </td>
                    <td className="p-3 font-bold text-slate-800 whitespace-nowrap">
                      {log.pickup_person_name || 'Standard Gate Release'}
                      {log.pickup_person_phone && (
                        <span className="block text-[10px] text-slate-400 font-mono">{log.pickup_person_phone}</span>
                      )}
                    </td>
                    <td className="p-3 text-slate-600 font-medium whitespace-nowrap">
                      {log.officer_name || 'School Admin'}
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-extrabold text-[10px] flex items-center gap-1 w-fit">
                        <CheckCircle2 size={11} /> Recorded
                      </span>
                    </td>
                  </tr>
                ))}
                {(!data?.recent_activity_ledger || data.recent_activity_ledger.length === 0) && (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-400">
                      No pickup activities recorded yet today. Actions will appear in real-time as pickups occur.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4-MODE ASSIGNMENT & DISPATCH MODAL */}
      {selectedStudent && (
        <div className="fixed inset-0 bg-slate-950/70 z-50 flex items-center justify-center p-4 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-3">
                <StudentAvatar
                  photoUrl={selectedStudent.photo_url}
                  firstName={selectedStudent.first_name}
                  lastName={selectedStudent.last_name}
                  size="md"
                />
                <div>
                  <h3 className="font-black text-slate-900 text-base">
                    Pickup Assignment: {selectedStudent.first_name} {selectedStudent.last_name}
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    {selectedStudent.class_name} · {selectedStudent.student_id_number}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={closeAssignmentModal}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* 4-Mode Selector Tabs */}
            <div className="p-5 space-y-5">
              <div>
                <label className="text-[11px] font-black uppercase text-slate-400 tracking-wider block mb-2">
                  Select Authorized Assignment Option
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {/* Mode A: Escort */}
                  <button
                    type="button"
                    onClick={() => setAssignmentMode('escort')}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      assignmentMode === 'escort'
                        ? 'border-cyan-500 bg-cyan-50/60 ring-2 ring-cyan-500/20'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <Car size={18} className={assignmentMode === 'escort' ? 'text-cyan-600' : 'text-slate-400'} />
                    <div className="mt-2">
                      <span className="font-black text-xs block text-slate-900">A. Escort</span>
                      <span className="text-[10px] text-slate-500 font-medium">School / MyEduRide</span>
                    </div>
                  </button>

                  {/* Mode B: Parent */}
                  <button
                    type="button"
                    onClick={() => setAssignmentMode('parent')}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      assignmentMode === 'parent'
                        ? 'border-blue-500 bg-blue-50/60 ring-2 ring-blue-500/20'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <Users size={18} className={assignmentMode === 'parent' ? 'text-blue-600' : 'text-slate-400'} />
                    <div className="mt-2">
                      <span className="font-black text-xs block text-slate-900">B. Parent</span>
                      <span className="text-[10px] text-slate-500 font-medium">Verified Guardian</span>
                    </div>
                  </button>

                  {/* Mode C: Sibling */}
                  <button
                    type="button"
                    onClick={() => setAssignmentMode('sibling')}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      assignmentMode === 'sibling'
                        ? 'border-purple-500 bg-purple-50/60 ring-2 ring-purple-500/20'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <ShieldCheck size={18} className={assignmentMode === 'sibling' ? 'text-purple-600' : 'text-slate-400'} />
                    <div className="mt-2">
                      <span className="font-black text-xs block text-slate-900">C. Sibling</span>
                      <span className="text-[10px] text-slate-500 font-medium">Approved Linked</span>
                    </div>
                  </button>

                  {/* Mode D: Walk Home */}
                  <button
                    type="button"
                    onClick={() => setAssignmentMode('walk_home')}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      assignmentMode === 'walk_home'
                        ? 'border-emerald-500 bg-emerald-50/60 ring-2 ring-emerald-500/20'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <Footprints size={18} className={assignmentMode === 'walk_home' ? 'text-emerald-600' : 'text-slate-400'} />
                    <div className="mt-2">
                      <span className="font-black text-xs block text-slate-900">D. Walk Home</span>
                      <span className="text-[10px] text-slate-500 font-medium">Permitted Solo</span>
                    </div>
                  </button>
                </div>
              </div>

              {/* Mode A: ESCORT SELECTION SUB-PANEL */}
              {assignmentMode === 'escort' && (
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
                  {/* Sub-selector: School Escort vs MyEduRide Escort */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEscortSubType('school');
                        if (data?.escorts?.school_escorts?.[0]) {
                          setSelectedEscortId(data.escorts.school_escorts[0].id);
                        }
                      }}
                      className={`flex-1 py-2 px-3 rounded-xl text-xs font-black transition-all cursor-pointer ${
                        escortSubType === 'school'
                          ? 'bg-slate-900 text-white shadow-xs'
                          : 'bg-white text-slate-600 border border-slate-200'
                      }`}
                    >
                      ● School Escort ({data?.escorts?.school_escorts?.length || 0})
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setEscortSubType('myeduride');
                        if (data?.escorts?.myeduride_escorts?.[0]) {
                          setSelectedEscortId(data.escorts.myeduride_escorts[0].id);
                        }
                      }}
                      className={`flex-1 py-2 px-3 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                        escortSubType === 'myeduride'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-white text-slate-600 border border-slate-200'
                      }`}
                    >
                      <ShieldCheck size={13} />
                      <span>● MyEduRide Escort ({data?.escorts?.myeduride_escorts?.length || 0})</span>
                    </button>
                  </div>

                  {escortSubType === 'myeduride' && (
                    <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-center gap-2 font-medium">
                      <ShieldCheck size={16} className="text-emerald-700 shrink-0" />
                      <span>
                        City Manager Approval Enforced: Only escorts with approved credentials appear below.
                      </span>
                    </div>
                  )}

                  {/* Escorts Dropdown or List */}
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1.5">
                      Choose {escortSubType === 'myeduride' ? 'Approved MyEduRide' : 'School'} Escort:
                    </label>
                    {((escortSubType === 'myeduride' ? data?.escorts?.myeduride_escorts : data?.escorts?.school_escorts) || []).length === 0 ? (
                      <p className="text-xs text-slate-400 py-3 text-center bg-white rounded-xl border border-dashed border-slate-200">
                        No {escortSubType === 'myeduride' ? 'City Manager approved MyEduRide escorts' : 'school escorts'} available.
                      </p>
                    ) : (
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {((escortSubType === 'myeduride' ? data?.escorts?.myeduride_escorts : data?.escorts?.school_escorts) || []).map((escort: any) => (
                          <div
                            key={escort.id}
                            onClick={() => setSelectedEscortId(escort.id)}
                            className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                              selectedEscortId === escort.id
                                ? 'bg-white border-emerald-500 shadow-xs ring-2 ring-emerald-500/20'
                                : 'bg-white border-slate-200 hover:border-slate-300'
                            }`}
                          >
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold text-xs">
                                {escort.full_name.charAt(0)}
                              </div>
                              <div>
                                <p className="text-xs font-black text-slate-900">{escort.full_name}</p>
                                <p className="text-[10px] text-slate-500">
                                  {escort.vehicle?.reg_number ? `Plate: ${escort.vehicle.reg_number}` : 'Vehicle registered'} · {escort.operating_area || 'Lagos'}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {escortSubType === 'myeduride' && (
                                <span className="text-[9px] font-black bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-md">
                                  ✓ CM Approved
                                </span>
                              )}
                              <input
                                type="radio"
                                checked={selectedEscortId === escort.id}
                                onChange={() => setSelectedEscortId(escort.id)}
                                className="text-emerald-600"
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Mode B: PARENT SELECTION SUB-PANEL */}
              {assignmentMode === 'parent' && (
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                  <h4 className="text-xs font-bold text-slate-700">Verified Parent / Guardian Profiles:</h4>
                  {(!selectedStudent.authorized_options?.parents || selectedStudent.authorized_options.parents.length === 0) ? (
                    <p className="text-xs text-slate-400 py-3 text-center bg-white rounded-xl border border-dashed border-slate-200">
                      No linked parent account found. You can link parents in the Parents module.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {selectedStudent.authorized_options.parents.map((p: any) => (
                        <div
                          key={p.id}
                          onClick={() => setSelectedParentId(p.id)}
                          className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                            selectedParentId === p.id
                              ? 'bg-white border-blue-500 shadow-xs ring-2 ring-blue-500/20'
                              : 'bg-white border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-xs">
                              {p.full_name.charAt(0)}
                            </div>
                            <div>
                              <p className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                                <span>{p.full_name}</span>
                                <span className="text-[9px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded-md">
                                  {p.relationship || 'Parent'}
                                </span>
                              </p>
                              <p className="text-[11px] text-slate-500 font-mono">📞 {p.phone || 'No phone'}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            {p.nin && (
                              <span className="text-[9px] font-black bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-md">
                                NIN Verified
                              </span>
                            )}
                            <input
                              type="radio"
                              checked={selectedParentId === p.id}
                              onChange={() => setSelectedParentId(p.id)}
                              className="text-blue-600"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Mode C: SIBLING SELECTION SUB-PANEL */}
              {assignmentMode === 'sibling' && (
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                  <h4 className="text-xs font-bold text-slate-700">Approved Sibling Arrangement:</h4>
                  {(!selectedStudent.authorized_options?.siblings || selectedStudent.authorized_options.siblings.length === 0) ? (
                    <div className="p-4 text-center bg-white rounded-xl border border-dashed border-slate-200 space-y-1">
                      <p className="text-xs font-bold text-slate-600">No linked siblings detected in this school.</p>
                      <p className="text-[11px] text-slate-400">
                        Siblings are automatically recognized when parents register multiple children with the same parent account.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {selectedStudent.authorized_options.siblings.map((sib: any) => (
                        <div
                          key={sib.student_id}
                          onClick={() => setSelectedSiblingId(sib.student_id)}
                          className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                            selectedSiblingId === sib.student_id
                              ? 'bg-white border-purple-500 shadow-xs ring-2 ring-purple-500/20'
                              : 'bg-white border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-purple-600 text-white flex items-center justify-center font-bold text-xs">
                              {sib.full_name.charAt(0)}
                            </div>
                            <div>
                              <p className="text-xs font-black text-slate-900">{sib.full_name}</p>
                              <p className="text-[11px] text-purple-700 font-medium">{sib.class_name} · {sib.relationship}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="text-[9px] font-black bg-purple-100 text-purple-800 px-2 py-0.5 rounded-md">
                              ✓ Family Linked
                            </span>
                            <input
                              type="radio"
                              checked={selectedSiblingId === sib.student_id}
                              onChange={() => setSelectedSiblingId(sib.student_id)}
                              className="text-purple-600"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Mode D: WALK HOME SUB-PANEL */}
              {assignmentMode === 'walk_home' && (
                <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200 space-y-3">
                  <div className="flex items-center gap-2">
                    <Footprints size={18} className="text-emerald-700" />
                    <h4 className="text-xs font-black text-emerald-950">Walk Home Authorization Record:</h4>
                  </div>
                  <p className="text-xs text-emerald-900/80 leading-relaxed font-medium">
                    This action logs that <strong>{selectedStudent.first_name} {selectedStudent.last_name}</strong> is authorized to walk home unescorted. A real-time departure notification will be sent to the parent(s).
                  </p>
                  <div className="p-3 rounded-xl bg-white border border-emerald-200 text-xs flex items-center justify-between">
                    <span className="text-slate-600 font-bold">Parent Consent On File:</span>
                    <span className="font-extrabold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                      {selectedStudent.walk_home_permitted ? 'Verified & On Record' : 'Standard Admin Waiver'}
                    </span>
                  </div>
                </div>
              )}

              {/* Notes Field */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Optional Dispatch / Gate Notes:
                </label>
                <input
                  type="text"
                  value={assignmentNotes}
                  onChange={(e) => setAssignmentNotes(e.target.value)}
                  placeholder="e.g. Authorized by mother via phone call / Front gate pickup"
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                />
              </div>
            </div>

            {/* Modal Actions */}
            <div className="p-5 border-t border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={closeAssignmentModal}
                disabled={submittingAction}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 font-bold text-xs cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() => handleAssignPickup(false)}
                disabled={submittingAction}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-black text-xs transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <SlidersHorizontal size={14} />
                <span>{submittingAction ? 'Recording...' : 'Assign for Later Pickup'}</span>
              </button>

              <button
                type="button"
                onClick={() => handleAssignPickup(true)}
                disabled={submittingAction}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[#00A859] hover:bg-emerald-600 text-white font-black text-xs transition-all shadow-md shadow-emerald-600/20 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <CheckCircle2 size={14} />
                <span>{submittingAction ? 'Processing...' : 'Confirm & Release Student Now'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
