'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Users,
  Search,
  KeyRound,
  RefreshCcw,
  Pencil,
  Building2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  GraduationCap,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import EditParentModal from '@/components/school-admin/EditParentModal';

export type SuperAdminParentChild = {
  student_id: string;
  student_name: string;
  class_name: string | null;
  student_id_number: string;
};

export type SuperAdminParentRow = {
  id: string | null;
  name: string;
  phone: string | null;
  username: string | null;
  has_login: boolean;
  school_id: string;
  school_name: string;
  children: SuperAdminParentChild[];
};

export type SchoolOption = {
  id: string;
  name: string;
  address: string | null;
};

export default function ParentsManagementView() {
  const [parents, setParents] = useState<SuperAdminParentRow[]>([]);
  const [schools, setSchools] = useState<SchoolOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [deduplicating, setDeduplicating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSchool, setSelectedSchool] = useState('all');
  const [selectedLoginStatus, setSelectedLoginStatus] = useState('all');
  const [editingParent, setEditingParent] = useState<SuperAdminParentRow | null>(null);

  const loadParents = useCallback(async () => {
    setLoading(true);
    try {
      const url = selectedSchool !== 'all'
        ? `/api/super-admin/parents?school_id=${selectedSchool}`
        : '/api/super-admin/parents';

      const res = await fetch(url, {
        credentials: 'include',
        cache: 'no-store',
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Failed to load parents');
        return;
      }
      setParents(data.parents || []);
      setSchools(data.schools || []);
    } catch {
      toast.error('Failed to load parents');
    } finally {
      setLoading(false);
    }
  }, [selectedSchool]);

  useEffect(() => {
    loadParents();
  }, [loadParents]);

  const handleDeduplicate = async () => {
    if (selectedSchool === 'all' && schools.length > 0) {
      toast.info('Running parent deduplication across all schools...');
    }
    setDeduplicating(true);
    try {
      const schoolIdsToRun = selectedSchool !== 'all' ? [selectedSchool] : schools.map((s) => s.id);
      let mergedTotal = 0;

      for (const sid of schoolIdsToRun) {
        const res = await fetch('/api/school-admin/parents/deduplicate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ school_id: sid }),
        });
        const data = await res.json();
        if (res.ok && data.totalMerged > 0) {
          mergedTotal += data.totalMerged;
        }
      }

      if (mergedTotal > 0) {
        toast.success(`Consolidated & merged ${mergedTotal} duplicate parent records!`);
      } else {
        toast.info('Parent records are fully deduplicated and up-to-date.');
      }
      loadParents();
    } catch {
      toast.error('Failed to run deduplication');
    } finally {
      setDeduplicating(false);
    }
  };

  const filteredParents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return parents.filter((p) => {
      const matchSchool = selectedSchool === 'all' || p.school_id === selectedSchool;
      const matchLogin =
        selectedLoginStatus === 'all' ||
        (selectedLoginStatus === 'login' && p.has_login) ||
        (selectedLoginStatus === 'no_login' && !p.has_login);

      if (!matchSchool || !matchLogin) return false;
      if (!q) return true;

      const childText = p.children
        .map((c) => `${c.student_name} ${c.class_name || ''} ${c.student_id_number}`)
        .join(' ');

      return (
        p.name.toLowerCase().includes(q) ||
        (p.phone || '').includes(q) ||
        (p.username || '').toLowerCase().includes(q) ||
        p.school_name.toLowerCase().includes(q) ||
        childText.toLowerCase().includes(q)
      );
    });
  }, [parents, searchQuery, selectedSchool, selectedLoginStatus]);

  const withLoginCount = parents.filter((p) => p.has_login).length;
  const totalChildrenCount = parents.reduce((sum, p) => sum + (p.children?.length || 0), 0);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center">
        <Loader2 size={32} className="animate-spin text-emerald-600 mb-3" />
        <p className="animate-pulse text-slate-600 font-semibold text-sm">
          Loading Parents Directory from backend...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Header & Page Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200">
              User Management
            </span>
            <span className="text-slate-300">•</span>
            <span className="text-xs font-bold text-slate-500">{schools.length} Schools</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <Users className="text-emerald-600" size={26} />
            Parents Directory
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Platform-wide parent records on file, linked student relationships, and login provisioning.
          </p>
        </div>

        <div className="flex flex-wrap gap-2.5">
          <button
            type="button"
            onClick={handleDeduplicate}
            disabled={deduplicating}
            className="px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs flex items-center gap-2 transition-all border border-slate-200"
          >
            {deduplicating ? <Loader2 size={16} className="animate-spin text-emerald-600" /> : <Sparkles size={16} className="text-emerald-600" />}
            {deduplicating ? 'Consolidating...' : 'Deduplicate Records'}
          </button>

          <button
            type="button"
            onClick={loadParents}
            className="px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs flex items-center gap-2 transition-all border border-slate-200"
          >
            <RefreshCcw size={16} /> Refresh
          </button>

          <Link
            href="/dashboard/super-admin/passwords"
            className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-2 shadow-sm transition-all"
          >
            <KeyRound size={16} /> Manage Credentials
          </Link>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs">
          <p className="text-2xl font-black text-slate-900">{parents.length}</p>
          <p className="text-xs text-slate-500 font-medium mt-0.5">Total Parents on File</p>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs">
          <p className="text-2xl font-black text-emerald-600">{withLoginCount}</p>
          <p className="text-xs text-slate-500 font-medium mt-0.5">With Active App Login</p>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs">
          <p className="text-2xl font-black text-amber-600">{parents.length - withLoginCount}</p>
          <p className="text-xs text-slate-500 font-medium mt-0.5">On-File Contact Only</p>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs">
          <p className="text-2xl font-black text-blue-600">{totalChildrenCount}</p>
          <p className="text-xs text-slate-500 font-medium mt-0.5">Linked Students / Children</p>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex flex-col md:flex-row gap-3 items-center justify-between">
        {/* Search */}
        <div className="relative flex-1 w-full">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by parent name, phone, username, child name, or student ID..."
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
          />
        </div>

        {/* School Dropdown */}
        <div className="flex gap-3 w-full md:w-auto">
          <select
            value={selectedSchool}
            onChange={(e) => setSelectedSchool(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          >
            <option value="all">All Schools ({schools.length})</option>
            {schools.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>

          {/* Login Status Filter */}
          <select
            value={selectedLoginStatus}
            onChange={(e) => setSelectedLoginStatus(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          >
            <option value="all">All Login Status</option>
            <option value="login">With App Login</option>
            <option value="no_login">On-File Contact Only</option>
          </select>
        </div>
      </div>

      {/* Parents Directory Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[900px]">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3.5 px-4">Parent Details</th>
                <th className="py-3.5 px-4">School</th>
                <th className="py-3.5 px-4">App Access</th>
                <th className="py-3.5 px-4">Linked Children / Students</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredParents.map((parent, idx) => (
                <tr key={parent.id || `parent-${idx}`} className="hover:bg-slate-50/80 transition-colors">
                  {/* Parent Name & Contacts */}
                  <td className="py-3.5 px-4">
                    <p className="font-extrabold text-slate-900 text-sm">{parent.name}</p>
                    <div className="flex flex-wrap items-center gap-2 mt-0.5">
                      {parent.phone && (
                        <span className="text-[11px] font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                          {parent.phone}
                        </span>
                      )}
                      {parent.username && (
                        <span className="text-[11px] font-mono text-emerald-700 font-semibold">
                          @{parent.username}
                        </span>
                      )}
                    </div>
                  </td>

                  {/* School */}
                  <td className="py-3.5 px-4">
                    <span className="inline-flex items-center gap-1.5 text-slate-700 font-semibold text-xs">
                      <Building2 size={14} className="text-slate-400" />
                      {parent.school_name}
                    </span>
                  </td>

                  {/* App Access Status */}
                  <td className="py-3.5 px-4">
                    {parent.has_login ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 font-bold text-[10px] border border-emerald-200">
                        <CheckCircle2 size={12} /> Active Login
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 font-medium text-[10px] border border-slate-200">
                        <AlertCircle size={12} className="text-slate-400" /> On-File Only
                      </span>
                    )}
                  </td>

                  {/* Linked Children */}
                  <td className="py-3.5 px-4">
                    <div className="flex flex-wrap gap-1.5">
                      {parent.children?.map((child) => (
                        <span
                          key={child.student_id}
                          className="inline-flex items-center gap-1 bg-blue-50 text-blue-900 border border-blue-100 px-2 py-1 rounded-lg text-[11px] font-medium"
                        >
                          <GraduationCap size={12} className="text-blue-600" />
                          <span className="font-bold">{child.student_name}</span>
                          {child.class_name && <span className="text-blue-600 text-[10px]">({child.class_name})</span>}
                          <span className="text-blue-400 font-mono text-[9px]">{child.student_id_number}</span>
                        </span>
                      ))}
                      {(!parent.children || parent.children.length === 0) && (
                        <span className="text-slate-400 text-xs italic">No linked children</span>
                      )}
                    </div>
                  </td>

                  {/* Actions */}
                  <td className="py-3.5 px-4 text-right">
                    <button
                      type="button"
                      onClick={() => setEditingParent(parent)}
                      className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs inline-flex items-center gap-1 transition-colors"
                    >
                      <Pencil size={13} /> Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredParents.length === 0 && (
            <div className="p-8 text-center text-slate-400 text-xs">
              {searchQuery ? 'No parents match your search criteria' : 'No parent records found on file.'}
            </div>
          )}
        </div>
      </div>

      {/* Edit Parent Modal */}
      {editingParent && (
        <EditParentModal
          isOpen={!!editingParent}
          onClose={() => setEditingParent(null)}
          onSuccess={loadParents}
          parent={editingParent}
          schoolId={editingParent.school_id}
        />
      )}
    </div>
  );
}
