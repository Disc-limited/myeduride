'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Building2,
  Users,
  Plus,
  Search,
  Trash2,
  GraduationCap,
  RefreshCcw,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ExternalLink,
  Pencil,
  Mail,
  Phone,
  User,
  School as SchoolIcon,
  XCircle,
  Copy,
  AlertCircle,
  Check,
  MoreVertical,
} from 'lucide-react';
import { toast } from 'sonner';
import { photoSrc } from '@/lib/photo';
import EditSchoolModal, { type SchoolForEdit } from './EditSchoolModal';
import AddSchoolModal from './AddSchoolModal';

export interface SchoolRecord {
  id: string;
  name: string;
  address?: string | null;
  logo_url?: string | null;
  approval_status?: 'pending' | 'approved' | 'rejected';
  student_count?: number;
  staff_count?: number;
  class_count?: number;
  admin_user_id?: string | null;
  admin_name?: string | null;
  admin_email?: string | null;
  admin_phone?: string | null;
  admin_username?: string | null;
  gate_open_time?: string | null;
  gate_close_time?: string | null;
  dismissal_start_time?: string | null;
  dismissal_end_time?: string | null;
  primary_color?: string | null;
  secondary_color?: string | null;
}

export default function SchoolsManagementView() {
  const [schools, setSchools] = useState<SchoolRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'approved' | 'pending' | 'rejected'>('all');
  const [editingSchool, setEditingSchool] = useState<SchoolForEdit | null>(null);
  const [deletingSchool, setDeletingSchool] = useState<SchoolRecord | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [copiedEmailId, setCopiedEmailId] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const fetchSchools = useCallback(async (opts?: { silent?: boolean }) => {
    if (opts?.silent) setRefreshing(true);
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
        return;
      }

      setSchools(data.schools || []);
    } catch (err: any) {
      console.error('Failed to load schools:', err);
      toast.error('Network error loading schools');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchSchools();
  }, [fetchSchools]);

  const handleApproveSchool = async (schoolId: string, action: 'approve' | 'reject') => {
    try {
      const res = await fetch('/api/schools/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ school_id: schoolId, action }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Action failed');
        return;
      }
      toast.success(action === 'approve' ? 'School approved successfully' : 'School registration rejected');
      fetchSchools({ silent: true });
    } catch {
      toast.error('Failed to process approval action');
    }
  };

  const confirmDeleteSchool = async () => {
    if (!deletingSchool) return;

    setDeleteLoading(true);
    try {
      const res = await fetch('/api/schools/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ school_id: deletingSchool.id }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Failed to delete school');
        return;
      }

      toast.success(`"${deletingSchool.name}" has been permanently deleted.`);
      setDeletingSchool(null);
      fetchSchools({ silent: true });
    } catch (err: any) {
      toast.error(err?.message || 'Error deleting school');
    } finally {
      setDeleteLoading(false);
    }
  };

  const copyEmail = (email: string, id: string) => {
    navigator.clipboard.writeText(email);
    setCopiedEmailId(id);
    toast.success('Email copied to clipboard');
    setTimeout(() => setCopiedEmailId(null), 2500);
  };

  const filteredSchools = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return schools.filter((s) => {
      // Filter by approval status
      if (statusFilter !== 'all') {
        const schoolStatus = s.approval_status || 'approved';
        if (schoolStatus !== statusFilter) return false;
      }

      if (!q) return true;

      const searchableText = [
        s.name,
        s.address || '',
        s.admin_name || '',
        s.admin_email || '',
        s.admin_phone || '',
        s.admin_username || '',
      ]
        .join(' ')
        .toLowerCase();

      return searchableText.includes(q);
    });
  }, [schools, searchQuery, statusFilter]);

  const stats = useMemo(() => {
    const total = schools.length;
    const approved = schools.filter((s) => s.approval_status !== 'pending' && s.approval_status !== 'rejected').length;
    const pending = schools.filter((s) => s.approval_status === 'pending').length;
    const students = schools.reduce((sum, s) => sum + (s.student_count || 0), 0);
    const staff = schools.reduce((sum, s) => sum + (s.staff_count || 0), 0);

    return { total, approved, pending, students, staff };
  }, [schools]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center">
        <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center animate-bounce mb-3 shadow-md">
          <Building2 size={26} />
        </div>
        <p className="animate-pulse text-slate-600 font-semibold text-sm">
          Loading Schools Directory &amp; Information...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-16">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200">
              Institution Management
            </span>
            <span className="text-slate-300">•</span>
            <span className="text-xs font-bold text-slate-500">{schools.length} Schools Enrolled</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <Building2 className="text-emerald-600" size={26} />
            Schools Directory &amp; Administration
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Browse all registered institutions, edit school and administrator emails/contact, configure schedules, or remove accounts.
          </p>
        </div>

        <div className="flex flex-wrap gap-2.5">
          <button
            type="button"
            onClick={() => fetchSchools({ silent: true })}
            className="px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs flex items-center gap-2 transition-all border border-slate-200"
            title="Refresh schools"
          >
            <RefreshCcw size={15} className={refreshing ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-2 shadow-sm transition-all"
          >
            <Plus size={16} />
            <span>+ Add New School</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5">
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-semibold">Total Schools</span>
            <Building2 size={16} className="text-emerald-600" />
          </div>
          <p className="text-2xl font-black text-slate-900">{stats.total}</p>
          <p className="text-[10px] text-slate-400 font-medium mt-0.5">Registered institutions</p>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-semibold">Approved</span>
            <CheckCircle2 size={16} className="text-emerald-600" />
          </div>
          <p className="text-2xl font-black text-emerald-600">{stats.approved}</p>
          <p className="text-[10px] text-slate-400 font-medium mt-0.5">Active &amp; verified</p>
        </div>

        <div className={`bg-white rounded-2xl p-4 border shadow-xs ${stats.pending > 0 ? 'border-amber-300 bg-amber-50/20' : 'border-slate-200/80'}`}>
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-semibold">Pending Approval</span>
            <AlertTriangle size={16} className={stats.pending > 0 ? 'text-amber-500' : 'text-slate-400'} />
          </div>
          <p className={`text-2xl font-black ${stats.pending > 0 ? 'text-amber-600' : 'text-slate-900'}`}>{stats.pending}</p>
          <p className="text-[10px] text-slate-400 font-medium mt-0.5">Awaiting verification</p>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-semibold">Total Students</span>
            <GraduationCap size={16} className="text-blue-600" />
          </div>
          <p className="text-2xl font-black text-blue-600">{stats.students.toLocaleString()}</p>
          <p className="text-[10px] text-slate-400 font-medium mt-0.5">Enrolled across network</p>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-semibold">Total Staff</span>
            <Users size={16} className="text-purple-600" />
          </div>
          <p className="text-2xl font-black text-purple-600">{stats.staff.toLocaleString()}</p>
          <p className="text-[10px] text-slate-400 font-medium mt-0.5">Teachers, admins &amp; escorts</p>
        </div>
      </div>

      {/* Search & Status Filter Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex flex-col md:flex-row gap-3 items-center justify-between">
        {/* Search */}
        <div className="relative w-full md:w-96">
          <Search size={16} className="absolute left-3.5 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Search by school, address, admin name, or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
          />
        </div>

        {/* Status Filter Buttons */}
        <div className="flex items-center gap-1.5 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
          {(['all', 'approved', 'pending', 'rejected'] as const).map((filter) => {
            const count =
              filter === 'all'
                ? schools.length
                : filter === 'approved'
                ? stats.approved
                : filter === 'pending'
                ? stats.pending
                : schools.filter((s) => s.approval_status === 'rejected').length;

            return (
              <button
                key={filter}
                type="button"
                onClick={() => setStatusFilter(filter)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all capitalize flex items-center gap-1.5 shrink-0 ${
                  statusFilter === filter
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                }`}
              >
                <span>{filter}</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                  statusFilter === filter ? 'bg-slate-700 text-white' : 'bg-slate-200 text-slate-700'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Schools Master Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[950px]">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4">School &amp; Address</th>
                <th className="py-3 px-4">Administrator &amp; Email Contact</th>
                <th className="py-3 px-4">Enrolled Stats</th>
                <th className="py-3 px-4">Gate Schedule</th>
                <th className="py-3 px-4">Approval Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredSchools.map((school) => {
                const status = school.approval_status || 'approved';

                return (
                  <tr key={school.id} className="hover:bg-slate-50/70 transition-colors">
                    {/* School Identity */}
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-3">
                        {school.logo_url ? (
                          <img
                            src={photoSrc(school.logo_url) ?? undefined}
                            alt=""
                            className="w-10 h-10 rounded-xl object-contain bg-white border border-slate-200 shrink-0 p-0.5"
                          />
                        ) : (
                          <div
                            className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white shrink-0 text-xs shadow-xs"
                            style={{ backgroundColor: school.primary_color || '#1B4D3E' }}
                          >
                            {school.name.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0 max-w-xs">
                          <Link
                            href={`/dashboard/super-admin/school/${school.id}`}
                            className="font-bold text-slate-900 hover:text-emerald-600 transition-colors text-sm line-clamp-1 flex items-center gap-1 group"
                          >
                            <span>{school.name}</span>
                            <ExternalLink size={12} className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400" />
                          </Link>
                          <p className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">
                            {school.address || 'Address not configured'}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Administrator & Email Contact */}
                    <td className="py-4 px-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5">
                          <User size={13} className="text-slate-400 shrink-0" />
                          <span className="font-bold text-slate-800">
                            {school.admin_name || 'No admin assigned'}
                          </span>
                          {school.admin_username && (
                            <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                              @{school.admin_username}
                            </span>
                          )}
                        </div>

                        {/* Email address with quick copy */}
                        {school.admin_email ? (
                          <div className="flex items-center gap-1.5">
                            <Mail size={12} className="text-emerald-600 shrink-0" />
                            <span className="font-medium text-slate-700 text-[11px]">
                              {school.admin_email}
                            </span>
                            <button
                              type="button"
                              onClick={() => copyEmail(school.admin_email!, school.id)}
                              className="text-slate-400 hover:text-slate-600 p-0.5"
                              title="Copy email"
                            >
                              {copiedEmailId === school.id ? (
                                <Check size={12} className="text-emerald-600" />
                              ) : (
                                <Copy size={12} />
                              )}
                            </button>
                          </div>
                        ) : (
                          <span className="text-[11px] text-amber-600 italic flex items-center gap-1">
                            <Mail size={12} /> No email configured
                          </span>
                        )}

                        {school.admin_phone && (
                          <div className="flex items-center gap-1.5 text-slate-500 text-[11px]">
                            <Phone size={11} className="text-slate-400 shrink-0" />
                            <span>{school.admin_phone}</span>
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Enrolled Metrics */}
                    <td className="py-4 px-4">
                      <div className="flex flex-wrap gap-1.5">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-blue-50 text-blue-800 text-[11px] font-bold border border-blue-100">
                          <GraduationCap size={12} />
                          {school.student_count || 0} Students
                        </span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-purple-50 text-purple-800 text-[11px] font-bold border border-purple-100">
                          <Users size={12} />
                          {school.staff_count || 0} Staff
                        </span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700 text-[11px] font-bold">
                          <SchoolIcon size={12} />
                          {school.class_count || 0} Classes
                        </span>
                      </div>
                    </td>

                    {/* Gate Timetable */}
                    <td className="py-4 px-4">
                      <div className="space-y-0.5 text-[11px] text-slate-600 font-medium">
                        <p className="flex items-center gap-1">
                          <Clock size={12} className="text-emerald-600" />
                          <span>Gate: {school.gate_open_time ? String(school.gate_open_time).slice(0, 5) : '06:30'} – {school.gate_close_time ? String(school.gate_close_time).slice(0, 5) : '09:00'}</span>
                        </p>
                        <p className="flex items-center gap-1 text-slate-400">
                          <Clock size={12} className="text-amber-500" />
                          <span>Dismissal: {school.dismissal_start_time ? String(school.dismissal_start_time).slice(0, 5) : '14:00'} – {school.dismissal_end_time ? String(school.dismissal_end_time).slice(0, 5) : '16:00'}</span>
                        </p>
                      </div>
                    </td>

                    {/* Approval Status */}
                    <td className="py-4 px-4">
                      {status === 'approved' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 font-bold text-[11px] border border-emerald-200">
                          <CheckCircle2 size={12} /> Approved
                        </span>
                      )}
                      {status === 'pending' && (
                        <div className="space-y-1.5">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 font-bold text-[11px] border border-amber-200 animate-pulse">
                            <AlertTriangle size={12} /> Pending Approval
                          </span>
                          <div className="flex items-center gap-1.5 pt-0.5">
                            <button
                              type="button"
                              onClick={() => handleApproveSchool(school.id, 'approve')}
                              className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[10px] font-bold"
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              onClick={() => handleApproveSchool(school.id, 'reject')}
                              className="px-2 py-0.5 bg-slate-200 hover:bg-red-100 hover:text-red-700 text-slate-700 rounded text-[10px] font-bold"
                            >
                              Reject
                            </button>
                          </div>
                        </div>
                      )}
                      {status === 'rejected' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-50 text-red-700 font-bold text-[11px] border border-red-200">
                          <XCircle size={12} /> Rejected
                        </span>
                      )}
                    </td>

                    {/* Actions Dropdown */}
                    <td className="py-4 px-4 text-right">
                      <div className="relative inline-block text-left">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenMenuId(openMenuId === school.id ? null : school.id);
                          }}
                          className={`p-1.5 rounded-xl border transition-all cursor-pointer ${
                            openMenuId === school.id
                              ? 'bg-slate-100 border-slate-300 text-slate-900 shadow-xs'
                              : 'bg-white hover:bg-slate-100 border-slate-200 text-slate-500 hover:text-slate-800'
                          }`}
                          title="School options"
                          aria-label="School options"
                        >
                          <MoreVertical size={16} />
                        </button>

                        {openMenuId === school.id && (
                          <>
                            <div
                              className="fixed inset-0 z-30"
                              onClick={() => setOpenMenuId(null)}
                            />

                            <div className="absolute right-0 top-full mt-1.5 z-40 w-44 bg-white rounded-2xl shadow-xl border border-slate-200 py-1 text-left text-xs animate-in fade-in zoom-in-95 duration-100">
                              <Link
                                href={`/dashboard/super-admin/school/${school.id}`}
                                onClick={() => setOpenMenuId(null)}
                                className="w-full px-3 py-2 text-slate-700 hover:text-slate-900 hover:bg-slate-50 flex items-center gap-2 font-medium transition-colors"
                              >
                                <ExternalLink size={13} className="text-slate-400" />
                                <span>Open Portal</span>
                              </Link>

                              <button
                                type="button"
                                onClick={() => {
                                  setOpenMenuId(null);
                                  setEditingSchool(school);
                                }}
                                className="w-full px-3 py-2 text-slate-700 hover:text-emerald-700 hover:bg-emerald-50/60 flex items-center gap-2 font-medium transition-colors text-left cursor-pointer"
                              >
                                <Pencil size={13} className="text-emerald-600" />
                                <span>Edit School</span>
                              </button>

                              <div className="my-1 border-t border-slate-100" />

                              <button
                                type="button"
                                onClick={() => {
                                  setOpenMenuId(null);
                                  setDeletingSchool(school);
                                }}
                                className="w-full px-3 py-2 text-red-600 hover:bg-red-50 flex items-center gap-2 font-medium transition-colors text-left cursor-pointer"
                              >
                                <Trash2 size={13} className="text-red-500" />
                                <span>Delete School</span>
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {filteredSchools.length === 0 && (
            <div className="p-12 text-center text-slate-400">
              <Building2 size={36} className="mx-auto text-slate-300 mb-2" />
              <p className="text-sm font-bold text-slate-600">No schools found</p>
              <p className="text-xs text-slate-400 mt-1">
                {searchQuery ? 'Try adjusting your search criteria or status filter.' : 'No schools registered in the database yet.'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Edit School Modal */}
      {editingSchool && (
        <EditSchoolModal
          isOpen={!!editingSchool}
          onClose={() => setEditingSchool(null)}
          onSuccess={() => fetchSchools({ silent: true })}
          school={editingSchool}
        />
      )}

      {/* Add School Modal */}
      {showAddModal && (
        <AddSchoolModal
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            setShowAddModal(false);
            fetchSchools({ silent: true });
          }}
        />
      )}

      {/* Delete School Confirmation Modal */}
      {deletingSchool && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-red-100 p-6 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 border border-red-200 flex items-center justify-center mx-auto">
              <AlertCircle size={26} />
            </div>

            <div className="text-center space-y-1.5">
              <h3 className="text-lg font-extrabold text-slate-900">
                Delete &ldquo;{deletingSchool.name}&rdquo;?
              </h3>
              <p className="text-xs text-slate-500 font-medium leading-relaxed">
                This action is <span className="font-bold text-red-600">irreversible</span>. It will permanently remove the school along with all its classes, student rosters, staff links, attendance archives, and associated credentials.
              </p>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeletingSchool(null)}
                disabled={deleteLoading}
                className="flex-1 py-2.5 px-4 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 font-bold text-xs transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteSchool}
                disabled={deleteLoading}
                className="flex-1 py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-sm transition-colors flex items-center justify-center gap-1.5"
              >
                {deleteLoading ? (
                  <span>Deleting...</span>
                ) : (
                  <>
                    <Trash2 size={14} />
                    <span>Permanently Delete</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
