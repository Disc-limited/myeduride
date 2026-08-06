'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  GraduationCap,
  Search,
  RefreshCcw,
  Pencil,
  Trash2,
  Building2,
  CreditCard,
  Loader2,
  BookOpen,
  UserCheck,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import StudentAvatar from '@/components/shared/StudentAvatar';

export type SuperAdminStudent = {
  id: string;
  first_name: string;
  last_name: string;
  student_id_number: string;
  gender: string | null;
  photo_url: string | null;
  class_id: string | null;
  school_id: string;
  parent_name: string | null;
  parent_phone: string | null;
  parent_email: string | null;
  class?: {
    id: string;
    name: string;
    grade: string | null;
  };
  school?: {
    id: string;
    name: string;
  };
};

export type SchoolOption = {
  id: string;
  name: string;
  address: string | null;
};

export type ClassOption = {
  id: string;
  name: string;
  grade: string | null;
  school_id: string;
};

export default function StudentsDirectoryView() {
  const [students, setStudents] = useState<SuperAdminStudent[]>([]);
  const [schools, setSchools] = useState<SchoolOption[]>([]);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSchool, setSelectedSchool] = useState('all');
  const [selectedClass, setSelectedClass] = useState('all');
  const [editingStudent, setEditingStudent] = useState<SuperAdminStudent | null>(null);

  const loadStudents = useCallback(async () => {
    setLoading(true);
    try {
      const url =
        selectedSchool !== 'all'
          ? `/api/super-admin/students?school_id=${selectedSchool}`
          : '/api/super-admin/students';

      const res = await fetch(url, {
        credentials: 'include',
        cache: 'no-store',
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Failed to load students');
        return;
      }
      setStudents(data.students || []);
      setSchools(data.schools || []);
      setClasses(data.classes || []);
    } catch {
      toast.error('Failed to load students');
    } finally {
      setLoading(false);
    }
  }, [selectedSchool]);

  useEffect(() => {
    loadStudents();
  }, [loadStudents]);

  const handleDelete = async (studentId: string, name: string) => {
    if (!confirm(`Are you sure you want to delete ${name}? This cannot be undone.`)) return;

    try {
      const res = await fetch('/api/students/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ student_id: studentId }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        toast.success(`${name} deleted successfully`);
        loadStudents();
      } else {
        toast.error(data.error || 'Failed to delete student');
      }
    } catch {
      toast.error('Failed to delete student');
    }
  };

  const filteredStudents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return students.filter((s) => {
      const matchSchool = selectedSchool === 'all' || s.school_id === selectedSchool;
      const matchClass = selectedClass === 'all' || s.class_id === selectedClass || s.class?.id === selectedClass;

      if (!matchSchool || !matchClass) return false;
      if (!q) return true;

      const fullName = `${s.first_name} ${s.last_name}`.toLowerCase();
      const parentInfo = `${s.parent_name || ''} ${s.parent_phone || ''}`.toLowerCase();

      return (
        fullName.includes(q) ||
        (s.student_id_number || '').toLowerCase().includes(q) ||
        (s.class?.name || '').toLowerCase().includes(q) ||
        (s.school?.name || '').toLowerCase().includes(q) ||
        parentInfo.includes(q)
      );
    });
  }, [students, searchQuery, selectedSchool, selectedClass]);

  const availableClasses = useMemo(() => {
    if (selectedSchool === 'all') return classes;
    return classes.filter((c) => c.school_id === selectedSchool);
  }, [classes, selectedSchool]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center">
        <Loader2 size={32} className="animate-spin text-emerald-600 mb-3" />
        <p className="animate-pulse text-slate-600 font-semibold text-sm">
          Loading Platform Students Directory...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
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
            <GraduationCap className="text-emerald-600" size={26} />
            Students Directory
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Platform-wide active student records, class enrollments, ID numbers, and parent contacts.
          </p>
        </div>

        <div className="flex flex-wrap gap-2.5">
          <button
            type="button"
            onClick={loadStudents}
            className="px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs flex items-center gap-2 transition-all border border-slate-200"
          >
            <RefreshCcw size={16} /> Refresh
          </button>

          <Link
            href="/dashboard/super-admin/id-cards"
            className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-2 shadow-sm transition-all"
          >
            <CreditCard size={16} /> Print Student ID Cards
          </Link>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs">
          <p className="text-2xl font-black text-slate-900">{students.length.toLocaleString()}</p>
          <p className="text-xs text-slate-500 font-medium mt-0.5">Total Enrolled Students</p>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs">
          <p className="text-2xl font-black text-emerald-600">{schools.length}</p>
          <p className="text-xs text-slate-500 font-medium mt-0.5">Active Schools</p>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs">
          <p className="text-2xl font-black text-blue-600">{availableClasses.length}</p>
          <p className="text-xs text-slate-500 font-medium mt-0.5">Classes Registered</p>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs">
          <p className="text-2xl font-black text-purple-600">{filteredStudents.length.toLocaleString()}</p>
          <p className="text-xs text-slate-500 font-medium mt-0.5">Filtered Results</p>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex flex-col md:flex-row gap-3 items-center justify-between">
        {/* Search */}
        <div className="relative flex-1 w-full">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search student by name, student ID number, class, or parent name..."
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
          />
        </div>

        {/* Dropdowns */}
        <div className="flex gap-3 w-full md:w-auto">
          {/* School Dropdown */}
          <select
            value={selectedSchool}
            onChange={(e) => {
              setSelectedSchool(e.target.value);
              setSelectedClass('all');
            }}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          >
            <option value="all">All Schools ({schools.length})</option>
            {schools.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>

          {/* Class Dropdown */}
          <select
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          >
            <option value="all">All Classes ({availableClasses.length})</option>
            {availableClasses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Students Directory Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[900px]">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3.5 px-4">Student Name & Avatar</th>
                <th className="py-3.5 px-4">Student ID Number</th>
                <th className="py-3.5 px-4">School</th>
                <th className="py-3.5 px-4">Class</th>
                <th className="py-3.5 px-4">Parent / Contact on File</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredStudents.map((student) => (
                <tr key={student.id} className="hover:bg-slate-50/80 transition-colors">
                  {/* Student Name & Avatar */}
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-3">
                      <StudentAvatar
                        photoUrl={student.photo_url}
                        firstName={student.first_name}
                        lastName={student.last_name}
                        size="sm"
                      />
                      <div>
                        <p className="font-extrabold text-slate-900 text-sm">
                          {student.first_name} {student.last_name}
                        </p>
                        {student.gender && (
                          <span className="text-[10px] text-slate-400 capitalize">
                            {student.gender}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Student ID Number */}
                  <td className="py-3.5 px-4">
                    <span className="font-mono text-xs font-bold text-slate-800 bg-slate-100 px-2 py-1 rounded">
                      {student.student_id_number}
                    </span>
                  </td>

                  {/* School */}
                  <td className="py-3.5 px-4">
                    <span className="inline-flex items-center gap-1.5 text-slate-800 font-semibold">
                      <Building2 size={14} className="text-slate-400" />
                      {student.school?.name || 'School'}
                    </span>
                  </td>

                  {/* Class */}
                  <td className="py-3.5 px-4">
                    {student.class?.name ? (
                      <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-800 border border-blue-100 px-2.5 py-1 rounded-lg font-bold text-xs">
                        <BookOpen size={12} className="text-blue-600" />
                        {student.class.name}
                      </span>
                    ) : (
                      <span className="text-slate-400 text-xs italic">Unassigned</span>
                    )}
                  </td>

                  {/* Parent on file */}
                  <td className="py-3.5 px-4">
                    {student.parent_name ? (
                      <div>
                        <p className="font-semibold text-slate-800">{student.parent_name}</p>
                        <p className="text-[10px] text-slate-400 font-mono">{student.parent_phone || ''}</p>
                      </div>
                    ) : (
                      <span className="text-slate-400 text-xs italic">No parent linked</span>
                    )}
                  </td>

                  {/* Actions */}
                  <td className="py-3.5 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => setEditingStudent(student)}
                        className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition-colors"
                        title="Edit Student"
                      >
                        <Pencil size={14} />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDelete(student.id, `${student.first_name} ${student.last_name}`)}
                        className="p-1.5 rounded-lg bg-slate-100 hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors"
                        title="Delete Student"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredStudents.length === 0 && (
            <div className="p-8 text-center text-slate-400 text-xs">
              {searchQuery ? 'No students match your search criteria' : 'No students found.'}
            </div>
          )}
        </div>
      </div>

      {/* Edit Student Modal */}
      {editingStudent && (
        <EditStudentModal
          student={editingStudent}
          classes={availableClasses}
          onClose={() => setEditingStudent(null)}
          onSuccess={loadStudents}
        />
      )}
    </div>
  );
}

// Edit Student Modal Component
function EditStudentModal({
  student,
  classes,
  onClose,
  onSuccess,
}: {
  student: SuperAdminStudent;
  classes: ClassOption[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [form, setForm] = useState({
    first_name: student.first_name || '',
    last_name: student.last_name || '',
    student_id_number: student.student_id_number || '',
    class_id: student.class_id || student.class?.id || '',
    gender: student.gender || '',
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const res = await fetch('/api/students/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          id: student.id,
          ...form,
        }),
      });

      if (res.ok) {
        toast.success('Student details updated successfully');
        onSuccess();
        onClose();
      } else {
        const d = await res.json().catch(() => ({}));
        toast.error(d.error || 'Failed to update student');
      }
    } catch {
      toast.error('Failed to update student');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 p-6">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <GraduationCap className="text-emerald-600" size={20} />
            Edit Student Details
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          <div>
            <label className="block font-bold text-slate-700 mb-1">First Name *</label>
            <input
              type="text"
              value={form.first_name}
              onChange={(e) => setForm({ ...form, first_name: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-medium"
              required
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Last Name *</label>
            <input
              type="text"
              value={form.last_name}
              onChange={(e) => setForm({ ...form, last_name: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-medium"
              required
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Student ID Number</label>
            <input
              type="text"
              value={form.student_id_number}
              onChange={(e) => setForm({ ...form, student_id_number: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-medium font-mono"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Class</label>
            <select
              value={form.class_id}
              onChange={(e) => setForm({ ...form, class_id: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-medium"
            >
              <option value="">Unassigned</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 border border-slate-200 rounded-xl hover:bg-slate-50 font-bold text-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white font-bold shadow-sm hover:bg-emerald-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
