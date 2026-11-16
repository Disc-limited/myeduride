'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Building2,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  ChevronsLeft,
  ChevronsRight,
  Eye,
  EyeOff,
  GraduationCap,
  KeyRound,
  RefreshCcw,
  Search,
  Users,
  BookUser,
  Trash2,
  AlertCircle,
  Layers,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  CredentialPasswordRows,
  CredentialPasswordTableHead,
  type CredentialUser,
} from '@/components/shared/CredentialPasswordRows';
import {
  StudentParentCredentialRows,
  StudentParentCredentialTableHead,
  type StudentParentCredential,
} from '@/components/shared/StudentParentCredentialRows';
import EditUserModal from '@/components/super-admin/EditUserModal';

type SchoolBlock = {
  id: string;
  name: string;
  address: string | null;
  staff: CredentialUser[];
  parents: CredentialUser[];
  students: StudentParentCredential[];
  other: CredentialUser[];
  users: CredentialUser[];
  total_users: number;
};

function formatRole(role: string) {
  return role.replace(/_/g, ' ');
}

function StudentSection({
  students,
  draftPasswords,
  draftConfirmPasswords,
  setDraftPasswords,
  setDraftConfirmPasswords,
  onSave,
  savingId,
  showPasswords,
  onEdit,
  onDelete,
}: {
  students: StudentParentCredential[];
  draftPasswords: Record<string, string>;
  draftConfirmPasswords: Record<string, string>;
  setDraftPasswords: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  setDraftConfirmPasswords: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  onSave: (parentUserId: string) => void;
  savingId: string | null;
  showPasswords: boolean;
  onEdit: (row: StudentParentCredential) => void;
  onDelete?: (row: StudentParentCredential) => void;
}) {
  const [innerSearch, setInnerSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  const filtered = useMemo(() => {
    const q = innerSearch.trim().toLowerCase();
    if (!q) return students;
    return students.filter(
      (s) =>
        s.student_name.toLowerCase().includes(q) ||
        s.student_id_number.toLowerCase().includes(q) ||
        (s.class_name || '').toLowerCase().includes(q) ||
        s.parent_name.toLowerCase().includes(q) ||
        s.parent_username.toLowerCase().includes(q) ||
        (s.parent_on_file_name || '').toLowerCase().includes(q) ||
        (s.authorised_pickup_persons || []).some(
          (p) =>
            p.name.toLowerCase().includes(q) ||
            (p.phone || '').toLowerCase().includes(q)
        )
    );
  }, [students, innerSearch]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pagedRows = useMemo(() => {
    if (pageSize >= 1000) return filtered;
    return filtered.slice((page - 1) * pageSize, page * pageSize);
  }, [filtered, page, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [innerSearch, pageSize]);

  if (students.length === 0) return null;

  return (
    <div className="border-t first:border-t-0">
      <div className="px-5 py-2.5 bg-emerald-50/90 flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-emerald-900 uppercase tracking-wide">
        <div className="flex items-center gap-2">
          <BookUser size={14} className="text-emerald-700" />
          Students — parent login
          <span className="text-emerald-700 font-semibold">({students.length})</span>
        </div>

        {students.length > 10 && (
          <div className="flex items-center gap-2 normal-case font-normal">
            <input
              type="text"
              value={innerSearch}
              onChange={(e) => setInnerSearch(e.target.value)}
              placeholder="Filter students in school..."
              className="text-xs bg-white border border-emerald-300 rounded-lg px-2.5 py-1 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 w-44"
            />
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="text-xs bg-white border border-emerald-300 rounded-lg px-2 py-1 text-slate-800 focus:outline-none"
            >
              <option value={10}>10 / pg</option>
              <option value={15}>15 / pg</option>
              <option value={25}>25 / pg</option>
              <option value={50}>50 / pg</option>
              <option value={1000}>All ({students.length})</option>
            </select>
          </div>
        )}
      </div>

      <p className="px-5 py-2 text-xs text-gray-500 border-b bg-white flex flex-wrap items-center justify-between gap-2">
        <span>Each student&apos;s parent app login (username &amp; password set when the student was added)</span>
        {filtered.length > pageSize && (
          <span className="font-semibold text-emerald-700 text-[11px]">
            Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, filtered.length)} of {filtered.length} students
          </span>
        )}
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[1100px]">
          <thead>
            <StudentParentCredentialTableHead />
          </thead>
          <StudentParentCredentialRows
            rows={pagedRows}
            draftPasswords={draftPasswords}
            draftConfirmPasswords={draftConfirmPasswords}
            setDraftPasswords={setDraftPasswords}
            setDraftConfirmPasswords={setDraftConfirmPasswords}
            onSave={onSave}
            savingId={savingId}
            provisioningId={null}
            showPasswords={showPasswords}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        </table>
      </div>

      {totalPages > 1 && (
        <div className="px-5 py-2.5 bg-emerald-50/50 border-t border-emerald-100 flex items-center justify-between text-xs text-slate-600">
          <span>
            Page <strong>{page}</strong> of <strong>{totalPages}</strong> ({filtered.length} students)
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={page === 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-2.5 py-1 rounded-md border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed font-medium transition-colors"
            >
              Prev
            </button>
            <div className="flex items-center gap-1 px-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                .map((p, idx, arr) => {
                  const prevP = arr[idx - 1];
                  const showEllipsis = prevP && p - prevP > 1;
                  return (
                    <span key={p} className="flex items-center gap-1">
                      {showEllipsis && <span className="px-0.5 text-slate-400">...</span>}
                      <button
                        type="button"
                        onClick={() => setPage(p)}
                        className={`w-6 h-6 rounded-md text-xs font-bold ${
                          page === p ? 'bg-emerald-700 text-white' : 'bg-white border border-slate-200 text-slate-700'
                        }`}
                      >
                        {p}
                      </button>
                    </span>
                  );
                })}
            </div>
            <button
              type="button"
              disabled={page === totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="px-2.5 py-1 rounded-md border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed font-medium transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function UserSection({
  title,
  icon,
  users,
  draftPasswords,
  draftConfirmPasswords,
  setDraftPasswords,
  setDraftConfirmPasswords,
  onSave,
  savingId,
  showPasswords,
  onUnlock,
  unlockingId,
  onEdit,
  onDelete,
}: {
  title: string;
  icon: React.ReactNode;
  users: CredentialUser[];
  draftPasswords: Record<string, string>;
  draftConfirmPasswords: Record<string, string>;
  setDraftPasswords: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  setDraftConfirmPasswords: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  onSave: (userId: string) => void;
  savingId: string | null;
  showPasswords: boolean;
  onUnlock?: (userId: string) => void;
  unlockingId?: string | null;
  onEdit?: (user: CredentialUser) => void;
  onDelete?: (user: CredentialUser) => void;
}) {
  const [innerSearch, setInnerSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  const filtered = useMemo(() => {
    const q = innerSearch.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.full_name.toLowerCase().includes(q) ||
        u.username.toLowerCase().includes(q) ||
        u.roles.some((r) => r.toLowerCase().includes(q)) ||
        (u.staff_id_number || '').toLowerCase().includes(q)
    );
  }, [users, innerSearch]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pagedRows = useMemo(() => {
    if (pageSize >= 1000) return filtered;
    return filtered.slice((page - 1) * pageSize, page * pageSize);
  }, [filtered, page, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [innerSearch, pageSize]);

  if (users.length === 0) return null;

  return (
    <div className="border-t first:border-t-0">
      <div className="px-5 py-2.5 bg-gray-50/90 flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-gray-700 uppercase tracking-wide">
        <div className="flex items-center gap-2">
          {icon}
          {title}
          <span className="text-gray-500 font-semibold">({users.length})</span>
        </div>

        {users.length > 10 && (
          <div className="flex items-center gap-2 normal-case font-normal">
            <input
              type="text"
              value={innerSearch}
              onChange={(e) => setInnerSearch(e.target.value)}
              placeholder="Filter staff..."
              className="text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-primary-500 w-36"
            />
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="text-xs bg-white border border-slate-300 rounded-lg px-2 py-1 text-slate-800 focus:outline-none"
            >
              <option value={10}>10 / pg</option>
              <option value={20}>20 / pg</option>
              <option value={50}>50 / pg</option>
              <option value={1000}>All ({users.length})</option>
            </select>
          </div>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[800px]">
          <thead>
            <CredentialPasswordTableHead />
          </thead>
          <CredentialPasswordRows
            users={pagedRows}
            draftPasswords={draftPasswords}
            draftConfirmPasswords={draftConfirmPasswords}
            setDraftPasswords={setDraftPasswords}
            setDraftConfirmPasswords={setDraftConfirmPasswords}
            onSave={onSave}
            savingId={savingId}
            showPasswords={showPasswords}
            onUnlock={onUnlock}
            unlockingId={unlockingId}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        </table>
      </div>

      {totalPages > 1 && (
        <div className="px-5 py-2 bg-gray-50/60 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
          <span>
            Page <strong>{page}</strong> of <strong>{totalPages}</strong> ({filtered.length} staff)
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={page === 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-2.5 py-1 rounded-md border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed font-medium transition-colors"
            >
              Prev
            </button>
            <button
              type="button"
              disabled={page === totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="px-2.5 py-1 rounded-md border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed font-medium transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SuperAdminPasswordsPage() {
  const [superAdmins, setSuperAdmins] = useState<CredentialUser[]>([]);
  const [schools, setSchools] = useState<SchoolBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLetter, setSelectedLetter] = useState('ALL');
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'students' | 'staff'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [jumpSchoolId, setJumpSchoolId] = useState('');
  const [expandedSchools, setExpandedSchools] = useState<Set<string>>(new Set());
  const [superExpanded, setSuperExpanded] = useState(true);
  const [draftPasswords, setDraftPasswords] = useState<Record<string, string>>({});
  const [draftConfirmPasswords, setDraftConfirmPasswords] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [unlockingId, setUnlockingId] = useState<string | null>(null);
  const [showPasswords, setShowPasswords] = useState(true);
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [deletingUser, setDeletingUser] = useState<{ id: string; name: string; username?: string; role?: string } | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [totalUsers, setTotalUsers] = useState(0);
  const [totalStudents, setTotalStudents] = useState(0);
  const [totalStaff, setTotalStaff] = useState(0);

  const fetchCredentials = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/super-admin/passwords', {
        credentials: 'include',
        cache: 'no-store',
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Failed to load credentials');
        return;
      }

      const loadedSchools: SchoolBlock[] = (data.schools || []).map(
        (s: SchoolBlock) => ({ ...s, students: s.students || [] })
      );
      const supers: CredentialUser[] = data.super_admins || [];
      setSchools(loadedSchools);
      setSuperAdmins(supers);
      setTotalUsers(data.total_users || 0);
      setTotalStudents(data.total_students || 0);
      setTotalStaff(data.total_staff || 0);

      // Auto-expand first 3 schools for fast initial readability
      setExpandedSchools(
        new Set(
          loadedSchools
            .filter((s) => s.total_users > 0 || s.students.length > 0)
            .slice(0, 3)
            .map((s) => s.id)
        )
      );

      const passwordMap: Record<string, string> = {};
      const confirmMap: Record<string, string> = {};
      for (const u of supers) {
        passwordMap[u.id] = u.password || '';
        confirmMap[u.id] = u.password || '';
      }
      for (const school of loadedSchools) {
        for (const user of school.users) {
          passwordMap[user.id] = user.password || '';
          confirmMap[user.id] = user.password || '';
        }
        for (const row of school.students) {
          if (row.parent_user_id) {
            passwordMap[row.parent_user_id] = row.password || '';
            confirmMap[row.parent_user_id] = row.password || '';
          }
        }
      }
      setDraftPasswords(passwordMap);
      setDraftConfirmPasswords(confirmMap);
    } catch {
      toast.error('Failed to load credentials');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCredentials();
  }, [fetchCredentials]);

  // A-Z letter counts across schools
  const letterCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const s of schools) {
      const firstChar = s.name.trim().charAt(0).toUpperCase();
      if (/[A-Z]/.test(firstChar)) {
        counts[firstChar] = (counts[firstChar] || 0) + 1;
      }
    }
    return counts;
  }, [schools]);

  const alphabet = useMemo(() => 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''), []);

  // Filtered schools based on search, A-Z letter, and category
  const filteredSchools = useMemo(() => {
    let list = schools;

    if (selectedCategory === 'students') {
      list = list.filter((s) => s.students.length > 0);
    } else if (selectedCategory === 'staff') {
      list = list.filter((s) => s.staff.length > 0);
    }

    if (selectedLetter && selectedLetter !== 'ALL') {
      list = list.filter((s) => s.name.trim().toUpperCase().startsWith(selectedLetter));
    }

    const q = searchQuery.trim().toLowerCase();
    if (!q) return list;

    return list
      .map((school) => {
        const schoolMatch =
          school.name.toLowerCase().includes(q) ||
          (school.address || '').toLowerCase().includes(q);

        const filterList = (uList: CredentialUser[]) =>
          uList.filter(
            (u) =>
              u.full_name.toLowerCase().includes(q) ||
              u.username.toLowerCase().includes(q) ||
              u.roles.some((r) => formatRole(r).includes(q)) ||
              (u.staff_id_number || '').toLowerCase().includes(q)
          );

        const filterStudents = (sList: StudentParentCredential[]) =>
          sList.filter(
            (s) =>
              s.student_name.toLowerCase().includes(q) ||
              s.student_id_number.toLowerCase().includes(q) ||
              (s.class_name || '').toLowerCase().includes(q) ||
              s.parent_name.toLowerCase().includes(q) ||
              (s.parent_on_file_name || '').toLowerCase().includes(q) ||
              s.parent_username.toLowerCase().includes(q) ||
              (s.primary_pickup_person || '').toLowerCase().includes(q) ||
              (s.authorised_pickup_persons || []).some(
                (p) =>
                  p.name.toLowerCase().includes(q) ||
                  (p.phone || '').toLowerCase().includes(q)
              )
          );

        const staff = filterList(school.staff);
        const parents = filterList(school.parents);
        const other = filterList(school.other);
        const students = filterStudents(school.students);

        if (schoolMatch) return school;
        if (staff.length + parents.length + other.length + students.length === 0) return null;

        const users = [...staff, ...parents, ...other];
        return {
          ...school,
          staff,
          parents,
          other,
          students,
          users,
          total_users: users.length + students.filter((s) => s.parent_user_id).length,
        };
      })
      .filter(Boolean) as SchoolBlock[];
  }, [schools, selectedCategory, selectedLetter, searchQuery]);

  // Reset pagination when search or filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedLetter, selectedCategory, pageSize]);

  // Pagination calculation
  const totalSchoolPages = pageSize > 0 ? Math.max(1, Math.ceil(filteredSchools.length / pageSize)) : 1;
  const startIndex = (currentPage - 1) * (pageSize > 0 ? pageSize : filteredSchools.length);
  const endIndex = pageSize > 0 ? Math.min(startIndex + pageSize, filteredSchools.length) : filteredSchools.length;
  const paginatedSchools = useMemo(() => {
    if (pageSize === 0) return filteredSchools;
    return filteredSchools.slice(startIndex, endIndex);
  }, [filteredSchools, startIndex, endIndex, pageSize]);

  const filteredSupers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return superAdmins;
    return superAdmins.filter(
      (u) =>
        u.full_name.toLowerCase().includes(q) ||
        u.username.toLowerCase().includes(q) ||
        'super admin'.includes(q)
    );
  }, [superAdmins, searchQuery]);

  const savePassword = async (userId: string) => {
    const password = (draftPasswords[userId] || '').trim();
    const confirmPassword = (draftConfirmPasswords[userId] || password).trim();
    if (!password) {
      toast.error('Enter a new password');
      return;
    }
    if (password !== confirmPassword) {
      toast.error('Password and confirmation do not match');
      return;
    }

    setSavingId(userId);
    try {
      const res = await fetch('/api/super-admin/users/set-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ user_id: userId, password, confirm_password: confirmPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Failed to update password');
        return;
      }

      toast.success('Password updated');
      setDraftConfirmPasswords((prev) => ({ ...prev, [userId]: password }));
      const patch = (u: CredentialUser) => (u.id === userId ? { ...u, password } : u);
      const patchStudent = (s: StudentParentCredential) =>
        s.parent_user_id === userId ? { ...s, password } : s;
      setSuperAdmins((prev) => prev.map(patch));
      setSchools((prev) =>
        prev.map((s) => ({
          ...s,
          staff: s.staff.map(patch),
          parents: s.parents.map(patch),
          other: s.other.map(patch),
          users: s.users.map(patch),
          students: s.students.map(patchStudent),
        }))
      );
    } catch {
      toast.error('Failed to update password');
    } finally {
      setSavingId(null);
    }
  };

  const unlockUser = async (userId: string) => {
    setUnlockingId(userId);
    try {
      const res = await fetch('/api/super-admin/users/unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ user_id: userId }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Failed to unlock user');
        return;
      }

      toast.success('User account unlocked');
      const patch = (u: CredentialUser) =>
        u.id === userId ? { ...u, locked_until: null, failed_login_attempts: 0 } : u;
      setSuperAdmins((prev) => prev.map(patch));
      setSchools((prev) =>
        prev.map((s) => ({
          ...s,
          staff: s.staff.map(patch),
          parents: s.parents.map(patch),
          other: s.other.map(patch),
          users: s.users.map(patch),
        }))
      );
    } catch {
      toast.error('Failed to unlock user');
    } finally {
      setUnlockingId(null);
    }
  };

  const confirmDeleteAccount = async () => {
    if (!deletingUser?.id) return;
    setDeleteLoading(true);
    try {
      const res = await fetch('/api/super-admin/users/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: deletingUser.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Failed to delete account');
        return;
      }
      toast.success(data.message || 'Account deleted successfully');
      setDeletingUser(null);
      fetchCredentials();
    } catch {
      toast.error('Network error deleting account');
    } finally {
      setDeleteLoading(false);
    }
  };

  const toggleSchool = (schoolId: string) => {
    setExpandedSchools((prev) => {
      const next = new Set(prev);
      if (next.has(schoolId)) next.delete(schoolId);
      else next.add(schoolId);
      return next;
    });
  };

  const studentCount = totalStudents || schools.reduce((n, s) => n + s.students.length, 0);
  const staffCount = totalStaff || schools.reduce((n, s) => n + s.staff.length, 0);

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="p-4 sm:p-6 w-full max-w-full mx-auto pb-16">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2.5">
              <KeyRound size={26} className="text-primary-700" />
              Credentials &amp; Passwords Hub
            </h1>
            <p className="text-sm text-gray-500 font-medium">
              Unified authentication hub for every school: staff, student-parent credentials, and platform admins.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 self-start">
            <button
              type="button"
              onClick={() => setShowPasswords((v) => !v)}
              className="btn-secondary flex items-center gap-2 text-sm min-h-[42px] font-semibold"
            >
              {showPasswords ? <EyeOff size={14} /> : <Eye size={14} />}
              {showPasswords ? 'Hide Passwords' : 'Show Passwords'}
            </button>
            <button
              type="button"
              onClick={fetchCredentials}
              className="btn-secondary flex items-center gap-2 min-h-[42px] font-semibold"
            >
              <RefreshCcw size={14} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
        </div>

        {/* Top KPI Metrics Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div className="card py-3 px-4 border-l-4 border-l-primary-600 shadow-2xs">
            <p className="text-2xl font-black text-slate-900">
              {loading ? <span className="inline-block w-8 h-6 bg-slate-200 animate-pulse rounded"></span> : schools.length}
            </p>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-0.5">Schools Registered</p>
          </div>

          <div className="card py-3 px-4 border-l-4 border-l-purple-600 shadow-2xs">
            <p className="text-2xl font-black text-purple-700">
              {loading ? <span className="inline-block w-12 h-6 bg-slate-200 animate-pulse rounded"></span> : totalUsers}
            </p>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-0.5">Total Accounts</p>
          </div>

          <div className="card py-3 px-4 border-l-4 border-l-emerald-600 shadow-2xs">
            <p className="text-2xl font-black text-emerald-700">
              {loading ? <span className="inline-block w-12 h-6 bg-slate-200 animate-pulse rounded"></span> : studentCount}
            </p>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-0.5">Student–Parent Logins</p>
          </div>

          <div className="card py-3 px-4 border-l-4 border-l-blue-600 shadow-2xs">
            <p className="text-2xl font-black text-blue-700">
              {loading ? <span className="inline-block w-8 h-6 bg-slate-200 animate-pulse rounded"></span> : staffCount}
            </p>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-0.5">Staff &amp; Officers</p>
          </div>
        </div>

        {/* Global Search & School Quick Jump */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
          <div className="relative md:col-span-2">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search schools, student names, IDs, parents, staff, usernames…"
              className="input pl-10 pr-16 min-h-[44px] w-full text-sm font-medium"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 font-bold bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded"
              >
                Clear
              </button>
            )}
          </div>

          <div>
            <select
              value={jumpSchoolId}
              onChange={(e) => {
                const id = e.target.value;
                setJumpSchoolId(id);
                if (id) {
                  // Find index in filtered schools to navigate to page
                  const idx = filteredSchools.findIndex((s) => s.id === id);
                  if (idx >= 0 && pageSize > 0) {
                    setCurrentPage(Math.floor(idx / pageSize) + 1);
                  }
                  setExpandedSchools((prev) => new Set([...prev, id]));
                  setTimeout(() => {
                    const el = document.getElementById(`school-block-${id}`);
                    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  }, 150);
                }
              }}
              className="input min-h-[44px] w-full text-xs font-bold text-slate-700 bg-white border border-slate-300"
            >
              <option value="">⚡ Jump to school ({schools.length} total)...</option>
              {schools.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.students.length} students, {s.staff.length} staff)
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Alphabetical A–Z Index Bar */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-3 mb-4 shadow-2xs">
          <div className="flex items-center justify-between mb-2 px-1">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Layers size={13} className="text-primary-600" />
              A–Z School Directory Index
            </span>
            {selectedLetter !== 'ALL' && (
              <button
                type="button"
                onClick={() => setSelectedLetter('ALL')}
                className="text-xs text-primary-600 font-bold hover:underline flex items-center gap-1"
              >
                <span>Reset A-Z filter (Showing all letters)</span>
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1">
            <button
              type="button"
              onClick={() => setSelectedLetter('ALL')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                selectedLetter === 'ALL'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              All ({schools.length})
            </button>

            {alphabet.map((letter) => {
              const count = letterCounts[letter] || 0;
              const isSelected = selectedLetter === letter;
              return (
                <button
                  key={letter}
                  type="button"
                  disabled={count === 0}
                  onClick={() => setSelectedLetter(letter)}
                  className={`min-w-[32px] px-2 py-1 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-0.5 ${
                    isSelected
                      ? 'bg-primary-600 text-white shadow-xs ring-2 ring-primary-500/30'
                      : count > 0
                      ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200/80 cursor-pointer'
                      : 'bg-slate-50 text-slate-300 cursor-not-allowed opacity-40'
                  }`}
                  title={
                    count > 0
                      ? `${count} school${count > 1 ? 's' : ''} starting with ${letter}`
                      : `No schools starting with ${letter}`
                  }
                >
                  <span>{letter}</span>
                  {count > 0 && <span className="text-[9px] font-normal opacity-75">({count})</span>}
                </button>
              );
            })}
          </div>
        </div>

        {/* Category Tabs & Expand / Collapse Controls */}
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-1 bg-slate-100/90 p-1 rounded-xl text-xs font-semibold">
            <button
              type="button"
              onClick={() => setSelectedCategory('all')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                selectedCategory === 'all'
                  ? 'bg-white text-slate-900 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Schools ({schools.length})
            </button>
            <button
              type="button"
              onClick={() => setSelectedCategory('students')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                selectedCategory === 'students'
                  ? 'bg-white text-emerald-800 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              With Students ({schools.filter((s) => s.students.length > 0).length})
            </button>
            <button
              type="button"
              onClick={() => setSelectedCategory('staff')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                selectedCategory === 'staff'
                  ? 'bg-white text-blue-800 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              With Staff ({schools.filter((s) => s.staff.length > 0).length})
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                const allPageIds = paginatedSchools.map((s) => s.id);
                const allExpanded = allPageIds.length > 0 && allPageIds.every((id) => expandedSchools.has(id));
                setExpandedSchools((prev) => {
                  const next = new Set(prev);
                  if (allExpanded) {
                    allPageIds.forEach((id) => next.delete(id));
                  } else {
                    allPageIds.forEach((id) => next.add(id));
                  }
                  return next;
                });
              }}
              className="text-xs font-bold px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 shadow-2xs transition-colors"
            >
              {paginatedSchools.length > 0 && paginatedSchools.every((s) => expandedSchools.has(s.id))
                ? 'Collapse Visible'
                : 'Expand Visible'}
            </button>
          </div>
        </div>

        {/* Content Body */}
        {loading ? (
          <div className="space-y-4">
            {/* Shimmer Skeletons for Schools */}
            {[1, 2, 3].map((n) => (
              <div key={n} className="card p-5 animate-pulse space-y-3 bg-white">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-200"></div>
                  <div className="space-y-1.5 flex-1">
                    <div className="h-4 bg-slate-200 rounded w-1/3"></div>
                    <div className="h-3 bg-slate-200 rounded w-1/4"></div>
                  </div>
                  <div className="w-20 h-6 bg-slate-200 rounded-full"></div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Super Admins Section */}
            <div className="card p-0 overflow-hidden shadow-2xs border border-purple-100">
              <button
                type="button"
                onClick={() => setSuperExpanded((v) => !v)}
                className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-purple-50/50 min-h-[52px] transition-colors"
              >
                {superExpanded ? (
                  <ChevronDown size={18} className="text-purple-600 shrink-0" />
                ) : (
                  <ChevronRight size={18} className="text-purple-600 shrink-0" />
                )}
                <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center shrink-0">
                  <KeyRound size={18} className="text-purple-700" />
                </div>
                <div className="flex-1">
                  <p className="font-extrabold text-gray-900">Platform Super Administrators</p>
                  <p className="text-xs text-gray-500 font-medium">DISC Root &amp; Global Command Centre platform accounts</p>
                </div>
                <span className="text-xs font-bold px-3 py-1 rounded-full bg-purple-100 text-purple-800">
                  {filteredSupers.length} account{filteredSupers.length === 1 ? '' : 's'}
                </span>
              </button>

              {superExpanded && (
                <div className="border-t overflow-x-auto">
                  {filteredSupers.length === 0 ? (
                    <p className="px-5 py-6 text-sm text-gray-400 text-center font-medium">No super admins found</p>
                  ) : (
                    <table className="w-full text-sm min-w-[800px]">
                      <thead>
                        <CredentialPasswordTableHead />
                      </thead>
                      <CredentialPasswordRows
                        users={filteredSupers}
                        draftPasswords={draftPasswords}
                        draftConfirmPasswords={draftConfirmPasswords}
                        setDraftPasswords={setDraftPasswords}
                        setDraftConfirmPasswords={setDraftConfirmPasswords}
                        onSave={savePassword}
                        savingId={savingId}
                        showPasswords={showPasswords}
                        onUnlock={unlockUser}
                        unlockingId={unlockingId}
                        onEdit={setEditingUser}
                        onDelete={(u) =>
                          setDeletingUser({
                            id: u.id,
                            name: u.full_name,
                            username: u.username,
                            role: 'Super Admin',
                          })
                        }
                      />
                    </table>
                  )}
                </div>
              )}
            </div>

            {/* Schools Directory Section */}
            {filteredSchools.length === 0 ? (
              <div className="card text-center py-12 text-slate-500 bg-white">
                <Building2 size={32} className="mx-auto text-slate-300 mb-2" />
                <p className="font-bold text-slate-700">No schools or accounts match your criteria</p>
                <p className="text-xs text-slate-400 mt-1">Try clearing your search query or selecting &quot;All&quot; in the A–Z index bar.</p>
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedLetter('ALL');
                    setSelectedCategory('all');
                  }}
                  className="mt-3 px-4 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700"
                >
                  Reset All Filters
                </button>
              </div>
            ) : (
              paginatedSchools.map((school) => {
                const isExpanded = expandedSchools.has(school.id);
                const hasContent = school.total_users > 0 || school.students.length > 0;
                return (
                  <div
                    key={school.id}
                    id={`school-block-${school.id}`}
                    className="card p-0 overflow-hidden shadow-2xs border border-slate-200/90 transition-all hover:border-slate-300"
                  >
                    <button
                      type="button"
                      onClick={() => toggleSchool(school.id)}
                      className="w-full flex items-center gap-3.5 px-5 py-4 text-left hover:bg-slate-50 min-h-[56px] transition-colors"
                    >
                      {isExpanded ? (
                        <ChevronDown size={18} className="text-slate-400 shrink-0" />
                      ) : (
                        <ChevronRight size={18} className="text-slate-400 shrink-0" />
                      )}
                      <div className="w-10 h-10 rounded-xl bg-primary-50 border border-primary-100 flex items-center justify-center shrink-0">
                        <Building2 size={18} className="text-primary-700" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-extrabold text-slate-900 text-sm sm:text-base">{school.name}</p>
                        {school.address && (
                          <p className="text-xs text-slate-500 font-medium truncate">{school.address}</p>
                        )}
                        <p className="text-xs text-slate-400 mt-0.5 font-medium">
                          <strong className="text-emerald-700">{school.students.length}</strong> students ·{' '}
                          <strong className="text-blue-700">{school.staff.length}</strong> staff
                        </p>
                      </div>
                      <span className="text-xs font-bold px-3 py-1 rounded-full bg-slate-100 text-slate-700 shrink-0 border border-slate-200/60">
                        {school.total_users} accounts
                      </span>
                    </button>

                    {isExpanded && (
                      <div className="bg-white">
                        {!hasContent ? (
                          <div className="px-5 py-8 text-center text-sm text-slate-400 font-medium">
                            No registered accounts or students in this school campus yet.
                          </div>
                        ) : (
                          <>
                            <StudentSection
                              students={school.students}
                              draftPasswords={draftPasswords}
                              draftConfirmPasswords={draftConfirmPasswords}
                              setDraftPasswords={setDraftPasswords}
                              setDraftConfirmPasswords={setDraftConfirmPasswords}
                              onSave={savePassword}
                              savingId={savingId}
                              showPasswords={showPasswords}
                              onEdit={setEditingUser}
                              onDelete={(row) =>
                                setDeletingUser({
                                  id: row.parent_user_id!,
                                  name: row.parent_name,
                                  username: row.parent_username,
                                  role: 'Parent',
                                })
                              }
                            />
                            <UserSection
                              title="Staff (Admins, Teachers, Gate Officers, General Staff)"
                              icon={<GraduationCap size={14} className="text-blue-600" />}
                              users={school.staff}
                              draftPasswords={draftPasswords}
                              draftConfirmPasswords={draftConfirmPasswords}
                              setDraftPasswords={setDraftPasswords}
                              setDraftConfirmPasswords={setDraftConfirmPasswords}
                              onSave={savePassword}
                              savingId={savingId}
                              showPasswords={showPasswords}
                              onUnlock={unlockUser}
                              unlockingId={unlockingId}
                              onEdit={setEditingUser}
                              onDelete={(u) =>
                                setDeletingUser({
                                  id: u.id,
                                  name: u.full_name,
                                  username: u.username,
                                  role: u.roles?.join(', '),
                                })
                              }
                            />
                            <UserSection
                              title="Other Direct User Accounts"
                              icon={<Users size={14} className="text-gray-600" />}
                              users={school.other}
                              draftPasswords={draftPasswords}
                              draftConfirmPasswords={draftConfirmPasswords}
                              setDraftPasswords={setDraftPasswords}
                              setDraftConfirmPasswords={setDraftConfirmPasswords}
                              onSave={savePassword}
                              savingId={savingId}
                              showPasswords={showPasswords}
                              onUnlock={unlockUser}
                              unlockingId={unlockingId}
                              onEdit={setEditingUser}
                              onDelete={(u) =>
                                setDeletingUser({
                                  id: u.id,
                                  name: u.full_name,
                                  username: u.username,
                                  role: u.roles?.join(', '),
                                })
                              }
                            />
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}

            {/* School Pagination Controls Bar */}
            {filteredSchools.length > 0 && (
              <div className="mt-6 p-4 bg-white border border-slate-200/90 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600 shadow-2xs">
                <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-start">
                  <span>
                    Showing <strong className="text-slate-900 font-bold">{filteredSchools.length === 0 ? 0 : startIndex + 1}</strong> to{' '}
                    <strong className="text-slate-900 font-bold">{endIndex}</strong> of{' '}
                    <strong className="text-slate-900 font-bold">{filteredSchools.length}</strong> schools
                    {selectedLetter !== 'ALL' && ` (Letter "${selectedLetter}")`}
                  </span>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-slate-400 hidden sm:inline">Per page:</span>
                    <select
                      value={pageSize}
                      onChange={(e) => {
                        setPageSize(Number(e.target.value));
                        setCurrentPage(1);
                      }}
                      className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                    >
                      <option value={5}>5 / page</option>
                      <option value={10}>10 / page</option>
                      <option value={20}>20 / page</option>
                      <option value={0}>All ({filteredSchools.length})</option>
                    </select>
                  </div>
                </div>

                {pageSize > 0 && totalSchoolPages > 1 && (
                  <div className="flex items-center gap-1 w-full sm:w-auto justify-center sm:justify-end">
                    <button
                      type="button"
                      onClick={() => setCurrentPage(1)}
                      disabled={currentPage === 1}
                      className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      title="First Page"
                    >
                      <ChevronsLeft size={15} />
                    </button>

                    <button
                      type="button"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1 font-semibold transition-colors"
                    >
                      <ChevronLeft size={15} />
                      <span className="hidden sm:inline">Prev</span>
                    </button>

                    <div className="flex items-center gap-1 px-1">
                      {Array.from({ length: totalSchoolPages }, (_, i) => i + 1)
                        .filter((p) => {
                          if (totalSchoolPages <= 5) return true;
                          return p === 1 || p === totalSchoolPages || Math.abs(p - currentPage) <= 1;
                        })
                        .map((p, idx, arr) => {
                          const prevP = arr[idx - 1];
                          const showEllipsis = prevP && p - prevP > 1;

                          return (
                            <span key={p} className="flex items-center gap-1">
                              {showEllipsis && <span className="px-1 text-slate-400">...</span>}
                              <button
                                type="button"
                                onClick={() => setCurrentPage(p)}
                                className={`w-7 h-7 rounded-lg text-xs font-bold transition-all ${
                                  currentPage === p
                                    ? 'bg-primary-600 text-white shadow-2xs'
                                    : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                                }`}
                              >
                                {p}
                              </button>
                            </span>
                          );
                        })}
                    </div>

                    <button
                      type="button"
                      onClick={() => setCurrentPage((p) => Math.min(totalSchoolPages, p + 1))}
                      disabled={currentPage === totalSchoolPages}
                      className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1 font-semibold transition-colors"
                    >
                      <span className="hidden sm:inline">Next</span>
                      <ChevronRight size={15} />
                    </button>

                    <button
                      type="button"
                      onClick={() => setCurrentPage(totalSchoolPages)}
                      disabled={currentPage === totalSchoolPages}
                      className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      title="Last Page"
                    >
                      <ChevronsRight size={15} />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>

      <EditUserModal
        isOpen={!!editingUser}
        onClose={() => setEditingUser(null)}
        onSuccess={fetchCredentials}
        user={editingUser}
      />

      {/* Delete User Confirmation Modal */}
      {deletingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-red-100 p-6 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 border border-red-200 flex items-center justify-center mx-auto">
              <AlertCircle size={26} />
            </div>

            <div className="text-center space-y-1.5">
              <h3 className="text-base font-extrabold text-slate-900">
                Permanently Delete Account?
              </h3>
              <p className="text-xs text-slate-500 font-medium leading-relaxed">
                Are you sure you want to permanently delete the account for <strong className="text-slate-800">{deletingUser.name}</strong>
                {deletingUser.username ? ` (@${deletingUser.username})` : ''}
                {deletingUser.role ? ` [${deletingUser.role}]` : ''}?
                All associated access, roles, and linked dependencies will be safely removed. This action cannot be undone.
              </p>
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setDeletingUser(null)}
                disabled={deleteLoading}
                className="flex-1 py-2.5 px-3 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 font-bold text-xs transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteAccount}
                disabled={deleteLoading}
                className="flex-1 py-2.5 px-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Trash2 size={14} />
                <span>{deleteLoading ? 'Deleting...' : 'Confirm Delete'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
