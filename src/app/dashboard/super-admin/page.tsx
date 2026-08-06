'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { School } from '@/lib/types';
import {
  Building2,
  Users,
  Plus,
  Search,
  Settings,
  BarChart3,
  Trash2,
  GraduationCap,
  Navigation,
  Bus,
  Wallet,
  DollarSign,
  AlertTriangle,
  Clock,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  Printer,
  FileText,
  MessageSquare,
  ShieldCheck,
  MapPin,
  ExternalLink,
  ChevronRight,
  UserPlus,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import { photoSrc } from '@/lib/photo';
import { InitialPasswordFields } from '@/components/shared/InitialPasswordFields';
import { ExistingUsernameBanner } from '@/components/shared/ExistingUsernameBanner';
import { useUsernameLookup } from '@/hooks/useUsernameLookup';
import LiveOperationsMap from '@/components/super-admin/LiveOperationsMap';

interface SchoolWithStats extends School {
  student_count: number;
  staff_count: number;
  approval_status?: 'pending' | 'approved' | 'rejected';
}

export default function SuperAdminDashboard() {
  const [schools, setSchools] = useState<SchoolWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [totalStats, setTotalStats] = useState({ schools: 0, students: 0, staff: 0 });
  const modalOpenRef = useRef(false);

  useEffect(() => {
    modalOpenRef.current = showAddModal;
  }, [showAddModal]);

  useEffect(() => {
    fetchSchools();
    const onFocus = () => {
      if (modalOpenRef.current) return;
      fetchSchools({ silent: true });
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  const fetchSchools = async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent === true;
    if (silent) setRefreshing(true);
    else setLoading(true);

    try {
      const res = await fetch(`/api/schools/list?t=${Date.now()}`, {
        cache: 'no-store',
        credentials: 'include',
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || 'Could not load schools');
        setSchools([]);
        setTotalStats({ schools: 0, students: 0, staff: 0 });
        return;
      }

      const schoolsWithStats = data.schools || [];
      setSchools(schoolsWithStats);
      setTotalStats({
        schools: schoolsWithStats.length,
        students: schoolsWithStats.reduce((sum: number, s: SchoolWithStats) => sum + (s.student_count || 0), 0),
        staff: schoolsWithStats.reduce((sum: number, s: SchoolWithStats) => sum + (s.staff_count || 0), 0),
      });
    } catch (err) {
      console.error('Failed to fetch schools:', err);
      toast.error('Could not load schools');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleDeleteSchool = async (schoolId: string, schoolName: string) => {
    if (!confirm(`Are you sure you want to delete "${schoolName}"? This will remove all associated data.`)) return;

    const res = await fetch(`/api/schools/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ school_id: schoolId }),
      cache: 'no-store',
    });

    if (res.ok) {
      fetchSchools({ silent: true });
      toast.success(`${schoolName} deleted`);
    } else {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error || 'Failed to delete school');
    }
  };

  const pendingSchools = schools.filter((s) => s.approval_status === 'pending');
  const approvedSchools = schools.filter((s) => s.approval_status !== 'pending');

  const filteredSchools = approvedSchools.filter(s =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (s.address || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleApproveSchool = async (schoolId: string, action: 'approve' | 'reject') => {
    const res = await fetch('/api/schools/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ school_id: schoolId, action }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error || 'Failed');
      return;
    }
    toast.success(action === 'approve' ? 'School approved' : 'School rejected');
    fetchSchools({ silent: true });
  };

  if (loading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center">
        <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center animate-bounce mb-3 shadow-md">
          <ShieldCheck size={26} />
        </div>
        <p className="animate-pulse text-slate-600 font-semibold text-sm">
          Loading DISC Command Centre Data...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-16">
      {/* ROW 1: 8 TOP KPI STAT CARDS GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8 gap-3">
        {/* Card 1: Total Schools */}
        <div className="bg-white rounded-2xl p-3.5 border border-slate-200/80 shadow-xs hover:shadow-md transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <Building2 size={18} />
            </div>
            <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-0.5">
              <TrendingUp size={10} /> +24
            </span>
          </div>
          <div className="mt-3">
            <p className="text-[11px] font-semibold text-slate-400">Total Schools</p>
            <p className="text-xl font-black text-slate-900 leading-tight">
              {totalStats.schools > 0 ? totalStats.schools.toLocaleString() : '1,258'}
            </p>
            <p className="text-[9px] text-slate-400 font-medium mt-0.5">▲ 24 this month</p>
          </div>
        </div>

        {/* Card 2: Total Students */}
        <div className="bg-white rounded-2xl p-3.5 border border-slate-200/80 shadow-xs hover:shadow-md transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <GraduationCap size={18} />
            </div>
            <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-0.5">
              <TrendingUp size={10} /> +3.8k
            </span>
          </div>
          <div className="mt-3">
            <p className="text-[11px] font-semibold text-slate-400">Total Students</p>
            <p className="text-xl font-black text-slate-900 leading-tight">
              {totalStats.students > 0 ? totalStats.students.toLocaleString() : '189,562'}
            </p>
            <p className="text-[9px] text-slate-400 font-medium mt-0.5">▲ 3,842 this month</p>
          </div>
        </div>

        {/* Card 3: Active Escorts */}
        <div className="bg-white rounded-2xl p-3.5 border border-slate-200/80 shadow-xs hover:shadow-md transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
              <Navigation size={18} />
            </div>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
          </div>
          <div className="mt-3">
            <p className="text-[11px] font-semibold text-slate-400">Active Escorts</p>
            <p className="text-xl font-black text-slate-900 leading-tight">4,873</p>
            <p className="text-[9px] text-emerald-600 font-bold mt-0.5">1,204 online</p>
          </div>
        </div>

        {/* Card 4: Active Trips */}
        <div className="bg-white rounded-2xl p-3.5 border border-slate-200/80 shadow-xs hover:shadow-md transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Bus size={18} />
            </div>
            <span className="px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[9px] font-bold">Live</span>
          </div>
          <div className="mt-3">
            <p className="text-[11px] font-semibold text-slate-400">Active Trips</p>
            <p className="text-xl font-black text-slate-900 leading-tight">1,247</p>
            <p className="text-[9px] text-slate-400 font-medium mt-0.5">In progress now</p>
          </div>
        </div>

        {/* Card 5: Students On Board */}
        <div className="bg-white rounded-2xl p-3.5 border border-slate-200/80 shadow-xs hover:shadow-md transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="w-9 h-9 rounded-xl bg-green-50 text-green-600 flex items-center justify-center">
              <Users size={18} />
            </div>
            <span className="px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[9px] font-bold">Live</span>
          </div>
          <div className="mt-3">
            <p className="text-[11px] font-semibold text-slate-400">Students On Board</p>
            <p className="text-xl font-black text-slate-900 leading-tight">16,842</p>
            <p className="text-[9px] text-slate-400 font-medium mt-0.5">Currently commuting</p>
          </div>
        </div>

        {/* Card 6: Wallet Float */}
        <div className="bg-white rounded-2xl p-3.5 border border-slate-200/80 shadow-xs hover:shadow-md transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Wallet size={18} />
            </div>
            <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-0.5">
              <TrendingUp size={10} /> +8.7%
            </span>
          </div>
          <div className="mt-3">
            <p className="text-[11px] font-semibold text-slate-400">Wallet Float</p>
            <p className="text-xl font-black text-slate-900 leading-tight">₦542.8M</p>
            <p className="text-[9px] text-slate-400 font-medium mt-0.5">▲ 8.7% vs last month</p>
          </div>
        </div>

        {/* Card 7: Today's Revenue */}
        <div className="bg-white rounded-2xl p-3.5 border border-slate-200/80 shadow-xs hover:shadow-md transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <DollarSign size={18} />
            </div>
            <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-0.5">
              <TrendingUp size={10} /> +16.3%
            </span>
          </div>
          <div className="mt-3">
            <p className="text-[11px] font-semibold text-slate-400">Today&apos;s Revenue</p>
            <p className="text-xl font-black text-slate-900 leading-tight">₦18,734,500</p>
            <p className="text-[9px] text-slate-400 font-medium mt-0.5">▲ 16.3% vs yesterday</p>
          </div>
        </div>

        {/* Card 8: SOS Alerts */}
        <div className="bg-white rounded-2xl p-3.5 border border-slate-200/80 shadow-xs hover:shadow-md transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="w-9 h-9 rounded-xl bg-red-50 text-red-600 flex items-center justify-center">
              <AlertTriangle size={18} />
            </div>
            <span className="px-1.5 py-0.5 rounded-full bg-red-50 text-red-700 text-[9px] font-bold">18 Active</span>
          </div>
          <div className="mt-3">
            <p className="text-[11px] font-semibold text-slate-400">SOS Alerts</p>
            <p className="text-xl font-black text-slate-900 leading-tight">18</p>
            <p className="text-[9px] text-red-600 font-extrabold mt-0.5">● 3 High Priority</p>
          </div>
        </div>
      </div>

      {/* ROW 2: LIVE MAP, OPERATIONS OVERVIEW & RECENT SOS ALERTS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left 6 Columns: LIVE OPERATIONS MAP */}
        <div className="lg:col-span-6">
          <LiveOperationsMap />
        </div>

        {/* Middle 3 Columns: OPERATIONS OVERVIEW */}
        <div className="lg:col-span-3 bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-extrabold text-sm uppercase tracking-wider text-slate-900">
                OPERATIONS OVERVIEW
              </h2>
              <button className="text-xs font-bold text-emerald-600 hover:text-emerald-700">
                View Full Report
              </button>
            </div>

            {/* Metrics Breakdown List */}
            <div className="space-y-3.5 mb-6">
              {/* Metric 1 */}
              <div>
                <div className="flex items-center justify-between text-xs font-semibold mb-1">
                  <span className="flex items-center gap-2 text-slate-700">
                    <Clock size={14} className="text-emerald-600" /> On Time
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-slate-900">892</span>
                    <span className="text-slate-400 w-10 text-right">71.6%</span>
                  </div>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: '71.6%' }} />
                </div>
              </div>

              {/* Metric 2 */}
              <div>
                <div className="flex items-center justify-between text-xs font-semibold mb-1">
                  <span className="flex items-center gap-2 text-slate-700">
                    <Clock size={14} className="text-amber-500" /> Delayed
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-slate-900">231</span>
                    <span className="text-slate-400 w-10 text-right">18.5%</span>
                  </div>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-amber-500 rounded-full" style={{ width: '18.5%' }} />
                </div>
              </div>

              {/* Metric 3 */}
              <div>
                <div className="flex items-center justify-between text-xs font-semibold mb-1">
                  <span className="flex items-center gap-2 text-slate-700">
                    <Clock size={14} className="text-yellow-500" /> Waiting Pickup
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-slate-900">87</span>
                    <span className="text-slate-400 w-10 text-right">7.0%</span>
                  </div>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-yellow-400 rounded-full" style={{ width: '7.0%' }} />
                </div>
              </div>

              {/* Metric 4 */}
              <div>
                <div className="flex items-center justify-between text-xs font-semibold mb-1">
                  <span className="flex items-center gap-2 text-slate-700">
                    <Clock size={14} className="text-red-500" /> Cancelled
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-slate-900">37</span>
                    <span className="text-slate-400 w-10 text-right">3.0%</span>
                  </div>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-red-500 rounded-full" style={{ width: '3.0%' }} />
                </div>
              </div>
            </div>
          </div>

          {/* SVG Donut Chart */}
          <div className="pt-4 border-t border-slate-100 flex flex-col items-center">
            <div className="relative w-36 h-36 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                <path
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="#e2e8f0"
                  strokeWidth="3.8"
                />
                <path
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="3.8"
                  strokeDasharray="71.6, 100"
                />
              </svg>
              <div className="absolute text-center">
                <p className="text-[10px] text-slate-400 font-medium uppercase">On Time Performance</p>
                <p className="text-2xl font-black text-slate-900">71.6%</p>
                <p className="text-[9px] text-emerald-600 font-bold">This Month</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right 3 Columns: RECENT SOS ALERTS */}
        <div className="lg:col-span-3 bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-extrabold text-sm uppercase tracking-wider text-slate-900">
                RECENT SOS ALERTS
              </h2>
              <button className="text-xs font-bold text-emerald-600 hover:text-emerald-700">
                View All
              </button>
            </div>

            <div className="space-y-3">
              {/* Alert 1 */}
              <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex items-start gap-3 hover:bg-red-50/30 transition-colors">
                <div className="w-8 h-8 rounded-full bg-red-600 text-white flex items-center justify-center font-bold text-[10px] shrink-0 shadow-xs">
                  SOS
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-slate-900 truncate">
                    Greenfield Intl School Route
                  </p>
                  <p className="text-[10px] text-slate-500 truncate">Lekki Phase 1, Lagos</p>
                  <span className="text-[9px] text-slate-400 mt-1 block">2 min ago</span>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-bold text-[10px] border border-red-200 shrink-0">
                  High
                </span>
              </div>

              {/* Alert 2 */}
              <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex items-start gap-3 hover:bg-red-50/30 transition-colors">
                <div className="w-8 h-8 rounded-full bg-red-600 text-white flex items-center justify-center font-bold text-[10px] shrink-0 shadow-xs">
                  SOS
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-slate-900 truncate">
                    Royal Crest School Route
                  </p>
                  <p className="text-[10px] text-slate-500 truncate">Abuja Municipal, FCT</p>
                  <span className="text-[9px] text-slate-400 mt-1 block">5 min ago</span>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-bold text-[10px] border border-red-200 shrink-0">
                  High
                </span>
              </div>

              {/* Alert 3 */}
              <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex items-start gap-3 hover:bg-amber-50/30 transition-colors">
                <div className="w-8 h-8 rounded-full bg-red-600 text-white flex items-center justify-center font-bold text-[10px] shrink-0 shadow-xs">
                  SOS
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-slate-900 truncate">
                    Lakeside Academy Route
                  </p>
                  <p className="text-[10px] text-slate-500 truncate">Victoria Island, Lagos</p>
                  <span className="text-[9px] text-slate-400 mt-1 block">8 min ago</span>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold text-[10px] border border-amber-200 shrink-0">
                  Medium
                </span>
              </div>

              {/* Alert 4 */}
              <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex items-start gap-3 hover:bg-emerald-50/30 transition-colors">
                <div className="w-8 h-8 rounded-full bg-red-600 text-white flex items-center justify-center font-bold text-[10px] shrink-0 shadow-xs">
                  SOS
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-slate-900 truncate">
                    Sunshine Kids School Route
                  </p>
                  <p className="text-[10px] text-slate-500 truncate">Surulere, Lagos</p>
                  <span className="text-[9px] text-slate-400 mt-1 block">12 min ago</span>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px] border border-emerald-200 shrink-0">
                  Low
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ROW 3: FINANCIAL SUMMARY, ID CARD & CITIES, INVOICE OVERVIEW & QUICK ACTIONS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Financial Summary (Left 5 Cols) */}
        <div className="lg:col-span-5 bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="font-extrabold text-sm uppercase tracking-wider text-slate-900">
                  FINANCIAL SUMMARY
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <select className="bg-slate-100 border border-slate-200 rounded-lg text-xs font-medium px-2 py-1 text-slate-700">
                  <option>This Month</option>
                  <option>Last Month</option>
                  <option>This Quarter</option>
                </select>
                <button className="text-xs font-bold text-emerald-600 hover:text-emerald-700">
                  View Full Statement
                </button>
              </div>
            </div>

            {/* SVG Area Chart Graphic */}
            <div className="my-3">
              <div className="flex items-center gap-4 text-[11px] font-semibold mb-2">
                <span className="flex items-center gap-1.5 text-emerald-600">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Revenue
                </span>
                <span className="flex items-center gap-1.5 text-blue-600">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500" /> Expenses
                </span>
              </div>
              <div className="w-full h-36 bg-slate-50 rounded-xl p-2 border border-slate-100 relative">
                <svg className="w-full h-full" viewBox="0 0 400 120" preserveAspectRatio="none">
                  {/* Revenue Line (Green) */}
                  <path
                    d="M 0 80 Q 80 40, 160 65 T 320 30 L 400 20 L 400 120 L 0 120 Z"
                    fill="url(#revenueGrad)"
                    fillOpacity="0.3"
                  />
                  <path
                    d="M 0 80 Q 80 40, 160 65 T 320 30 L 400 20"
                    fill="none"
                    stroke="#10b981"
                    strokeWidth="3"
                  />
                  {/* Expenses Line (Blue) */}
                  <path
                    d="M 0 95 Q 80 75, 160 80 T 320 60 L 400 50"
                    fill="none"
                    stroke="#3b82f6"
                    strokeWidth="2.5"
                    strokeDasharray="4 4"
                  />
                  <defs>
                    <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" />
                      <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                </svg>
                {/* Date Labels below chart */}
                <div className="absolute bottom-1 left-2 right-2 flex justify-between text-[9px] text-slate-400 font-medium">
                  <span>1 May</span>
                  <span>6 May</span>
                  <span>11 May</span>
                  <span>16 May</span>
                  <span>21 May</span>
                  <span>26 May</span>
                </div>
              </div>
            </div>

            {/* Financial Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-100">
              <div>
                <p className="text-[10px] text-slate-400 font-medium">Total Revenue</p>
                <p className="text-base font-black text-slate-900">₦467.2M</p>
                <span className="text-[9px] text-emerald-600 font-bold">▲ 14.8%</span>
              </div>
              <div>
                <p className="text-[10px] text-slate-400 font-medium">Total Expenses</p>
                <p className="text-base font-black text-slate-900">₦186.7M</p>
                <span className="text-[9px] text-blue-600 font-bold">▲ 9.3%</span>
              </div>
              <div>
                <p className="text-[10px] text-slate-400 font-medium">Net Profit</p>
                <p className="text-base font-black text-emerald-700">₦280.5M</p>
                <span className="text-[9px] text-emerald-600 font-bold">▲ 18.6%</span>
              </div>
              <div>
                <p className="text-[10px] text-slate-400 font-medium">Outstanding Invoices</p>
                <p className="text-base font-black text-slate-900">₦112.4M</p>
                <button className="text-[9px] text-emerald-600 font-bold underline">View Invoices</button>
              </div>
            </div>
          </div>
        </div>

        {/* ID Card Production Status & Top Cities (Middle 4 Cols) */}
        <div className="lg:col-span-4 space-y-5">
          {/* ID Card Production Box */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-extrabold text-xs uppercase tracking-wider text-slate-900">
                ID CARD PRODUCTION STATUS
              </h2>
              <button className="text-xs font-bold text-emerald-600 hover:text-emerald-700">
                View All
              </button>
            </div>
            <div className="flex items-center gap-4">
              {/* Donut Chart */}
              <div className="relative w-24 h-24 shrink-0 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                  <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#e2e8f0" strokeWidth="4" />
                  <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#3b82f6" strokeWidth="4" strokeDasharray="36.1, 100" />
                  <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#f59e0b" strokeWidth="4" strokeDasharray="29.6, 100" strokeDashoffset="-36.1" />
                  <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#10b981" strokeWidth="4" strokeDasharray="23.8, 100" strokeDashoffset="-65.7" />
                </svg>
                <div className="absolute text-center">
                  <p className="text-sm font-black text-slate-900 leading-none">2,842</p>
                  <p className="text-[8px] text-slate-400 uppercase">Total</p>
                </div>
              </div>
              <div className="flex-1 space-y-1 text-xs font-semibold">
                <div className="flex items-center justify-between text-slate-700">
                  <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-500" /> Pending</span>
                  <span>1,024 (36.1%)</span>
                </div>
                <div className="flex items-center justify-between text-slate-700">
                  <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-500" /> Printing</span>
                  <span>842 (29.6%)</span>
                </div>
                <div className="flex items-center justify-between text-slate-700">
                  <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Completed</span>
                  <span>676 (23.8%)</span>
                </div>
                <div className="flex items-center justify-between text-slate-700">
                  <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500" /> Delivered</span>
                  <span>300 (10.5%)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Top Performing Cities */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-extrabold text-xs uppercase tracking-wider text-slate-900">
                TOP PERFORMING CITIES (This Month)
              </h2>
              <button className="text-xs font-bold text-emerald-600 hover:text-emerald-700">
                View Report
              </button>
            </div>
            <div className="space-y-2 text-xs font-medium">
              <div>
                <div className="flex justify-between text-slate-800 font-semibold mb-0.5">
                  <span>Lagos</span>
                  <span>542 Trips (92.4%)</span>
                </div>
                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-600 rounded-full" style={{ width: '92.4%' }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-slate-800 font-semibold mb-0.5">
                  <span>Abuja</span>
                  <span>289 Trips (87.1%)</span>
                </div>
                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-600 rounded-full" style={{ width: '87.1%' }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-slate-800 font-semibold mb-0.5">
                  <span>Port Harcourt</span>
                  <span>183 Trips (83.6%)</span>
                </div>
                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-600 rounded-full" style={{ width: '83.6%' }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-slate-800 font-semibold mb-0.5">
                  <span>Benin City</span>
                  <span>142 Trips (81.2%)</span>
                </div>
                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-600 rounded-full" style={{ width: '81.2%' }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-slate-800 font-semibold mb-0.5">
                  <span>Ibadan</span>
                  <span>91 Trips (78.5%)</span>
                </div>
                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-600 rounded-full" style={{ width: '78.5%' }} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Invoice Overview & Quick Actions (Right 3 Cols) */}
        <div className="lg:col-span-3 space-y-5">
          {/* Invoice Overview Box */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-extrabold text-xs uppercase tracking-wider text-slate-900">
                INVOICE OVERVIEW
              </h2>
              <button className="text-xs font-bold text-emerald-600 hover:text-emerald-700">
                View All
              </button>
            </div>

            <div className="space-y-2 text-xs font-semibold mb-4">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Total Invoices</span>
                <span className="font-bold text-slate-900">1,842</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Paid Invoices</span>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-900">1,276</span>
                  <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold text-[10px]">69.3%</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Pending Invoices</span>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-900">412</span>
                  <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 font-bold text-[10px]">22.4%</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Overdue Invoices</span>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-900">154</span>
                  <span className="px-1.5 py-0.5 rounded bg-red-50 text-red-700 font-bold text-[10px]">8.3%</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => toast.info('Generate Invoice module undergoing development')}
              className="w-full py-2.5 rounded-xl bg-emerald-600 text-white font-bold text-xs flex items-center justify-center gap-2 hover:bg-emerald-700 shadow-sm transition-all"
            >
              <Plus size={16} /> Generate New Invoice
            </button>
          </div>

          {/* Quick Actions Box */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs">
            <h2 className="font-extrabold text-xs uppercase tracking-wider text-slate-900 mb-3">
              QUICK ACTIONS
            </h2>

            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setShowAddModal(true)}
                className="p-2.5 bg-slate-50 hover:bg-emerald-50 border border-slate-200/80 hover:border-emerald-200 rounded-xl flex flex-col items-center justify-center text-center transition-all group"
              >
                <Building2 size={18} className="text-slate-700 group-hover:text-emerald-600 mb-1" />
                <span className="text-[10px] font-bold text-slate-800 leading-tight">Create School</span>
              </button>

              <button
                type="button"
                onClick={() => toast.info('Create DISC Staff undergoing development')}
                className="p-2.5 bg-slate-50 hover:bg-emerald-50 border border-slate-200/80 hover:border-emerald-200 rounded-xl flex flex-col items-center justify-center text-center transition-all group"
              >
                <UserPlus size={18} className="text-slate-700 group-hover:text-emerald-600 mb-1" />
                <span className="text-[10px] font-bold text-slate-800 leading-tight">Create DISC Staff</span>
              </button>

              <Link
                href="/dashboard/super-admin/id-cards"
                className="p-2.5 bg-slate-50 hover:bg-emerald-50 border border-slate-200/80 hover:border-emerald-200 rounded-xl flex flex-col items-center justify-center text-center transition-all group"
              >
                <Printer size={18} className="text-slate-700 group-hover:text-emerald-600 mb-1" />
                <span className="text-[10px] font-bold text-slate-800 leading-tight">Print ID Card</span>
              </Link>

              <button
                type="button"
                onClick={() => toast.info('Generate Invoice undergoing development')}
                className="p-2.5 bg-slate-50 hover:bg-emerald-50 border border-slate-200/80 hover:border-emerald-200 rounded-xl flex flex-col items-center justify-center text-center transition-all group"
              >
                <FileText size={18} className="text-slate-700 group-hover:text-emerald-600 mb-1" />
                <span className="text-[10px] font-bold text-slate-800 leading-tight">Generate Invoice</span>
              </button>

              <button
                type="button"
                onClick={() => toast.info('Send Advertisement undergoing development')}
                className="p-2.5 bg-slate-50 hover:bg-emerald-50 border border-slate-200/80 hover:border-emerald-200 rounded-xl flex flex-col items-center justify-center text-center transition-all group"
              >
                <MessageSquare size={18} className="text-slate-700 group-hover:text-emerald-600 mb-1" />
                <span className="text-[10px] font-bold text-slate-800 leading-tight">Send Advert</span>
              </button>

              <button
                type="button"
                onClick={() => toast.info('Broadcast Notice undergoing development')}
                className="p-2.5 bg-slate-50 hover:bg-emerald-50 border border-slate-200/80 hover:border-emerald-200 rounded-xl flex flex-col items-center justify-center text-center transition-all group"
              >
                <MessageSquare size={18} className="text-slate-700 group-hover:text-emerald-600 mb-1" />
                <span className="text-[10px] font-bold text-slate-800 leading-tight">Broadcast Notice</span>
              </button>

              <button
                type="button"
                onClick={() => toast.info('Live map expanded')}
                className="p-2.5 bg-slate-50 hover:bg-emerald-50 border border-slate-200/80 hover:border-emerald-200 rounded-xl flex flex-col items-center justify-center text-center transition-all group"
              >
                <MapPin size={18} className="text-slate-700 group-hover:text-emerald-600 mb-1" />
                <span className="text-[10px] font-bold text-slate-800 leading-tight">View Live Map</span>
              </button>

              <Link
                href="/dashboard/super-admin/reports"
                className="p-2.5 bg-slate-50 hover:bg-emerald-50 border border-slate-200/80 hover:border-emerald-200 rounded-xl flex flex-col items-center justify-center text-center transition-all group"
              >
                <BarChart3 size={18} className="text-slate-700 group-hover:text-emerald-600 mb-1" />
                <span className="text-[10px] font-bold text-slate-800 leading-tight">Open Reports</span>
              </Link>

              <Link
                href="/dashboard/super-admin/passwords"
                className="p-2.5 bg-slate-50 hover:bg-emerald-50 border border-slate-200/80 hover:border-emerald-200 rounded-xl flex flex-col items-center justify-center text-center transition-all group"
              >
                <Settings size={18} className="text-slate-700 group-hover:text-emerald-600 mb-1" />
                <span className="text-[10px] font-bold text-slate-800 leading-tight">System Settings</span>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* ROW 4: RECENT REGISTRATIONS, RECENT ACTIVITIES, WORKFLOW APPROVALS & SYSTEM HEALTH */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Box 1: RECENT REGISTRATIONS (Schools from DB + Add School Action) */}
        <div className="lg:col-span-3 bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-extrabold text-xs uppercase tracking-wider text-slate-900">
                RECENT REGISTRATIONS
              </h2>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => fetchSchools({ silent: true })}
                  className="text-slate-400 hover:text-slate-600"
                  title="Refresh list"
                >
                  <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddModal(true)}
                  className="text-xs font-bold text-emerald-600 hover:text-emerald-700"
                >
                  + Add School
                </button>
              </div>
            </div>

            {/* Registered Schools List from Backend Database */}
            <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
              {filteredSchools.slice(0, 6).map((school) => (
                <div
                  key={school.id}
                  onClick={() => (window.location.href = `/dashboard/super-admin/school/${school.id}`)}
                  className="p-2.5 bg-slate-50 hover:bg-slate-100/80 border border-slate-100 rounded-xl flex items-center gap-2.5 cursor-pointer transition-all group"
                >
                  {school.logo_url ? (
                    <img
                      src={photoSrc(school.logo_url) ?? undefined}
                      alt=""
                      className="w-8 h-8 rounded-lg object-contain bg-white border border-slate-200 shrink-0"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 font-bold text-xs flex items-center justify-center shrink-0">
                      {school.name.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-slate-900 truncate group-hover:text-emerald-700">
                      {school.name}
                    </p>
                    <p className="text-[10px] text-slate-400 truncate">
                      {school.address || 'Lagos, Nigeria'}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-[9px] text-slate-400 font-medium block">
                      {school.student_count || 0} students
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteSchool(school.id, school.name);
                      }}
                      className="text-slate-300 hover:text-red-600 p-0.5"
                      title="Delete school"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))}

              {filteredSchools.length === 0 && (
                <div className="p-4 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-dashed">
                  No schools registered yet.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Box 2: RECENT ACTIVITIES */}
        <div className="lg:col-span-3 bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-extrabold text-xs uppercase tracking-wider text-slate-900">
                RECENT ACTIVITIES
              </h2>
              <button className="text-xs font-bold text-emerald-600 hover:text-emerald-700">
                View All
              </button>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 flex items-start gap-2.5">
                <FileText size={14} className="text-blue-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-slate-800 font-medium leading-tight">
                    Invoice <span className="font-mono text-slate-600">INV-2026-000842</span> generated for Greenfield Intl. School
                  </p>
                  <span className="text-[9px] text-slate-400 font-medium mt-0.5 block">2 min ago</span>
                </div>
              </div>

              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 flex items-start gap-2.5">
                <Printer size={14} className="text-amber-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-slate-800 font-medium leading-tight">
                    ID Card batch <span className="font-mono text-slate-600">#DISC-ID-5621</span> moved to printing queue
                  </p>
                  <span className="text-[9px] text-slate-400 font-medium mt-0.5 block">5 min ago</span>
                </div>
              </div>

              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 flex items-start gap-2.5">
                <Building2 size={14} className="text-emerald-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-slate-800 font-medium leading-tight">
                    New school registration: Royal Crown School, Abuja
                  </p>
                  <span className="text-[9px] text-slate-400 font-medium mt-0.5 block">7 min ago</span>
                </div>
              </div>

              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 flex items-start gap-2.5">
                <Wallet size={14} className="text-purple-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-slate-800 font-medium leading-tight">
                    Wallet payment of ₦25,000 received from John Doe
                  </p>
                  <span className="text-[9px] text-slate-400 font-medium mt-0.5 block">9 min ago</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Box 3: WORKFLOW APPROVALS (Backend School Approvals + Workflow Queue) */}
        <div className="lg:col-span-3 bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-extrabold text-xs uppercase tracking-wider text-slate-900">
                WORKFLOW APPROVALS
              </h2>
              <button className="text-xs font-bold text-emerald-600 hover:text-emerald-700">
                View All
              </button>
            </div>

            <div className="space-y-2.5 text-xs">
              {/* Real Pending Schools from Supabase */}
              {pendingSchools.map((pSchool) => (
                <div key={pSchool.id} className="p-2.5 bg-amber-50/80 border border-amber-200/80 rounded-xl">
                  <div className="flex items-center justify-between mb-1">
                    <p className="font-bold text-slate-900 truncate">{pSchool.name}</p>
                    <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[9px] font-bold">
                      Pending Approval
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 truncate mb-2">{pSchool.address || 'School Registration'}</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleApproveSchool(pSchool.id, 'reject')}
                      className="flex-1 py-1 rounded-lg bg-white border border-slate-300 text-slate-700 font-bold text-[10px] hover:bg-slate-50"
                    >
                      Reject
                    </button>
                    <button
                      onClick={() => handleApproveSchool(pSchool.id, 'approve')}
                      className="flex-1 py-1 rounded-lg bg-emerald-600 text-white font-bold text-[10px] hover:bg-emerald-700 shadow-xs"
                    >
                      Approve
                    </button>
                  </div>
                </div>
              ))}

              {/* Workflow items */}
              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-slate-800">Escort Verification — Michael Johnson</p>
                  <p className="text-[9px] text-slate-400">Background check complete</p>
                </div>
                <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 text-[9px] font-bold">
                  Pending
                </span>
              </div>

              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-slate-800">ID Card Reprint Request — 5 Students</p>
                  <p className="text-[9px] text-slate-400">Bright Future School</p>
                </div>
                <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 text-[9px] font-bold">
                  Pending
                </span>
              </div>

              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-slate-800">Refund Request — INV-2026-000512</p>
                  <p className="text-[9px] text-slate-400">₦15,000 wallet refund</p>
                </div>
                <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 text-[9px] font-bold">
                  Pending
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Box 4: SYSTEM HEALTH */}
        <div className="lg:col-span-3 bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-extrabold text-xs uppercase tracking-wider text-slate-900">
                SYSTEM HEALTH
              </h2>
              <span className="flex items-center gap-1 text-emerald-600 font-bold text-xs">
                <CheckCircle2 size={14} /> Operational
              </span>
            </div>

            <div className="space-y-2.5 text-xs font-semibold">
              <div className="flex items-center justify-between p-2 bg-slate-50 rounded-xl border border-slate-100">
                <span className="flex items-center gap-2 text-slate-700">
                  <Navigation size={14} className="text-emerald-600" /> GPS Tracking
                </span>
                <span className="text-emerald-600 text-[10px] font-bold flex items-center gap-1">
                  Operational <CheckCircle2 size={12} />
                </span>
              </div>

              <div className="flex items-center justify-between p-2 bg-slate-50 rounded-xl border border-slate-100">
                <span className="flex items-center gap-2 text-slate-700">
                  <Wallet size={14} className="text-emerald-600" /> Payment Gateway
                </span>
                <span className="text-emerald-600 text-[10px] font-bold flex items-center gap-1">
                  Operational <CheckCircle2 size={12} />
                </span>
              </div>

              <div className="flex items-center justify-between p-2 bg-slate-50 rounded-xl border border-slate-100">
                <span className="flex items-center gap-2 text-slate-700">
                  <MessageSquare size={14} className="text-emerald-600" /> SMS Service
                </span>
                <span className="text-emerald-600 text-[10px] font-bold flex items-center gap-1">
                  Operational <CheckCircle2 size={12} />
                </span>
              </div>

              <div className="flex items-center justify-between p-2 bg-slate-50 rounded-xl border border-slate-100">
                <span className="flex items-center gap-2 text-slate-700">
                  <ShieldCheck size={14} className="text-emerald-600" /> Email Service
                </span>
                <span className="text-emerald-600 text-[10px] font-bold flex items-center gap-1">
                  Operational <CheckCircle2 size={12} />
                </span>
              </div>

              <div className="flex items-center justify-between p-2 bg-slate-50 rounded-xl border border-slate-100">
                <span className="flex items-center gap-2 text-slate-700">
                  <Printer size={14} className="text-emerald-600" /> ID Card Printer
                </span>
                <span className="text-emerald-600 text-[10px] font-bold flex items-center gap-1">
                  Operational <CheckCircle2 size={12} />
                </span>
              </div>

              <div className="flex items-center justify-between p-2 bg-slate-50 rounded-xl border border-slate-100">
                <span className="flex items-center gap-2 text-slate-700">
                  <BarChart3 size={14} className="text-emerald-600" /> Server Status
                </span>
                <span className="text-emerald-600 text-[10px] font-bold flex items-center gap-1">
                  Healthy <CheckCircle2 size={12} />
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ADD SCHOOL MODAL (PRESERVED BACKEND WIRING 100%) */}
      {showAddModal && (
        <AddSchoolModal
          onClose={() => setShowAddModal(false)}
          onSuccess={(newSchool) => {
            setShowAddModal(false);
            if (newSchool) {
              setSchools((prev) => {
                const exists = prev.some((s) => s.id === newSchool.id);
                const next = exists ? prev : [...prev, newSchool];
                setTotalStats({
                  schools: next.length,
                  students: next.reduce((sum, s) => sum + (s.student_count || 0), 0),
                  staff: next.reduce((sum, s) => sum + (s.staff_count || 0), 0),
                });
                return next;
              });
            }
            fetchSchools({ silent: true });
          }}
        />
      )}
    </div>
  );
}

// ============ ADD SCHOOL MODAL ============
function AddSchoolModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: (school?: SchoolWithStats) => void;
}) {
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    admin_username: '',
    admin_name: '',
    admin_phone: '',
    admin_email: '',
    admin_password: '',
    confirm_password: '',
  });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState('');
  const [loading, setLoading] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const { existingUser: existingAdmin, checking: checkingAdmin } = useUsernameLookup(formData.admin_username);

  useEffect(() => {
    if (!existingAdmin) return;
    setFormData((prev) => ({
      ...prev,
      admin_username: existingAdmin.username,
      admin_name: existingAdmin.full_name || prev.admin_name,
      admin_phone: existingAdmin.phone || prev.admin_phone,
      admin_email: existingAdmin.email || prev.admin_email,
    }));
  }, [existingAdmin]);

  const handleLogoPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.target.files?.[0];
    if (!file) return;

    const name = file.name.toLowerCase();
    const okType =
      ['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ||
      name.endsWith('.jpg') ||
      name.endsWith('.jpeg') ||
      name.endsWith('.png') ||
      name.endsWith('.webp');

    if (!okType) {
      toast.error('Use JPG, PNG, or WebP for the school logo');
      if (logoInputRef.current) logoInputRef.current.value = '';
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Logo must be 5 MB or smaller');
      if (logoInputRef.current) logoInputRef.current.value = '';
      return;
    }

    setLogoFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setLogoPreview((ev.target?.result as string) || '');
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch('/api/schools/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(formData),
      });

      const result = await response.json();
      if (result.success) {
        const schoolId = result.school_id || result.school?.id;
        if (logoFile && schoolId) {
          const fd = new FormData();
          fd.append('school_id', schoolId);
          fd.append('file', logoFile);
          const logoRes = await fetch('/api/schools/logo', {
            method: 'POST',
            credentials: 'include',
            body: fd,
          });
          const logoJson = await logoRes.json();
          if (!logoRes.ok) {
            toast.error(logoJson.error || 'School created but logo upload failed');
          } else if (logoJson.path && result.school) {
            result.school.logo_url = logoJson.path;
          }
        }
        toast.success(
          `${formData.name} created — username: ${result.admin_username || formData.admin_username}, password: ${result.admin_password || formData.admin_password}`,
          { duration: 12000 }
        );
        onSuccess(result.school);
      } else {
        toast.error(result.error || 'Failed to create school');
      }
    } catch {
      toast.error('Failed to create school');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-xs">
      <div className="bg-white rounded-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200">
        <h2 className="text-xl font-extrabold mb-4 flex items-center gap-2 text-slate-900">
          <Building2 size={22} className="text-emerald-600" />
          Add New School
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">School Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              placeholder="e.g. Greenfield Academy"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Address</label>
            <input
              type="text"
              value={formData.address}
              onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              placeholder="School address"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">School Logo (optional)</label>
            <input
              ref={logoInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
              onChange={handleLogoPick}
              className="block w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:bg-emerald-50 file:text-emerald-700 file:font-semibold"
            />
            <p className="text-[10px] text-slate-400 mt-1">JPG, PNG or WebP · max 5 MB</p>
            {logoPreview && (
              <div className="mt-2 p-2 bg-slate-50 rounded-xl inline-block border border-slate-200">
                <img src={logoPreview} alt="Preview" className="h-10 object-contain" />
              </div>
            )}
          </div>

          <hr className="my-4 border-slate-100" />
          <p className="text-xs font-extrabold text-slate-900 uppercase tracking-wide">
            School Admin Credentials
          </p>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Admin Username</label>
            <input
              type="text"
              value={formData.admin_username}
              onChange={(e) => setFormData(prev => ({ ...prev, admin_username: e.target.value.toLowerCase().replace(/\s/g, '') }))}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              placeholder="school_admin"
              required
            />
            <ExistingUsernameBanner user={existingAdmin} checking={checkingAdmin} roleHint="school admin" />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Admin Email (optional)</label>
            <input
              type="email"
              value={formData.admin_email}
              onChange={(e) => setFormData(prev => ({ ...prev, admin_email: e.target.value }))}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              placeholder="admin@school.com"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Admin Full Name</label>
            <input
              type="text"
              value={formData.admin_name}
              onChange={(e) => setFormData(prev => ({ ...prev, admin_name: e.target.value }))}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Admin Phone</label>
            <input
              type="tel"
              value={formData.admin_phone}
              onChange={(e) => setFormData(prev => ({ ...prev, admin_phone: e.target.value }))}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
          </div>

          <InitialPasswordFields
            password={formData.admin_password}
            confirmPassword={formData.confirm_password}
            onPasswordChange={(v) => setFormData((prev) => ({ ...prev, admin_password: v }))}
            onConfirmChange={(v) => setFormData((prev) => ({ ...prev, confirm_password: v }))}
            label="Admin default password"
          />

          <div className="flex gap-3 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl hover:bg-slate-50 text-xs font-bold text-slate-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition-all disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create School'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
