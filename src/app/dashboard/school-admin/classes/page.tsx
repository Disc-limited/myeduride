// @ts-nocheck
'use client';

import { useEffect, useState } from 'react';
import { fetchData } from '@/lib/api';
import { Plus, Users, Pencil, Trash2, X, UserPlus, UserCheck, Shield, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';

export default function ClassesPage() {
  const [classes, setClasses] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [schoolId, setSchoolId] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [teacherModalOpen, setTeacherModalOpen] = useState(false);
  const [rosterModalOpen, setRosterModalOpen] = useState(false);
  const [selectedClass, setSelectedClass] = useState(null);
  const [rosterStudents, setRosterStudents] = useState([]);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', arm: '', assigned_teacher_id: '' });
  const [selectedTeacherId, setSelectedTeacherId] = useState('');
  const ARM_OPTIONS = ['A', 'B', 'C', 'D', 'Gold', 'Silver', 'Emerald', 'Diamond'];
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      const schoolData = await fetchData('get_school_admin_data', { role: 'school_admin' });
      if (!schoolData?.school_id) {
        toast.error(schoolData?.error || 'No school linked to your admin account');
        setLoading(false);
        return;
      }
      setSchoolId(schoolData.school_id);

      const classesData = await fetchData('get_classes', { school_id: schoolData.school_id });
      if (classesData.error && !classesData.classes?.length) {
        throw new Error(classesData.error);
      }
      setClasses(classesData.classes || []);

      try {
        const teachersRes = await fetch(
          `/api/schools/class-teachers?school_id=${schoolData.school_id}`,
          { credentials: 'include', cache: 'no-store' }
        );
        const teachersData = await teachersRes.json();
        setTeachers(
          (teachersData.teachers || []).map((t) => ({
            id: t.id,
            user_id: t.user_id,
            user: { full_name: t.full_name },
          }))
        );
      } catch {
        setTeachers([]);
      }
    } catch (err) {
      console.error(err);
      toast.error(err.message || 'Could not load classes');
      setClasses([]);
    }
    setLoading(false);
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', arm: 'A', assigned_teacher_id: '' });
    setModalOpen(true);
  };

  const openEdit = (cls) => {
    setEditing(cls);
    setForm({
      name: cls.name,
      arm: cls.section || '',
      assigned_teacher_id: cls.assigned_teacher_id || '',
    });
    setModalOpen(true);
  };

  const openQuickTeacherAttach = (cls) => {
    setSelectedClass(cls);
    setSelectedTeacherId(cls.assigned_teacher_id || '');
    setTeacherModalOpen(true);
  };

  const openRoster = async (cls) => {
    setSelectedClass(cls);
    setRosterModalOpen(true);
    setRosterLoading(true);
    try {
      const res = await fetch(`/api/students?school_id=${schoolId}&class_id=${cls.id}`, {
        credentials: 'include',
      });
      const data = await res.json();
      setRosterStudents(data.students || []);
    } catch (e) {
      console.error(e);
      setRosterStudents([]);
    }
    setRosterLoading(false);
  };

  const saveClass = async () => {
    if (!form.name.trim() || !form.arm.trim()) {
      toast.error('Class name and arm are required');
      return;
    }
    setSaving(true);
    try {
      const method = editing ? 'PUT' : 'POST';
      const payload = {
        name: form.name.trim(),
        grade: form.name.trim(),
        section: form.arm.trim().toUpperCase(),
        assigned_teacher_id: form.assigned_teacher_id || null,
      };
      const body = editing
        ? { id: editing.id, school_id: schoolId, ...payload }
        : { school_id: schoolId, ...payload };

      const res = await fetch('/api/classes', {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      toast.success(editing ? 'Class updated successfully' : 'Class created successfully');
      setModalOpen(false);
      await loadAll();
    } catch (e) {
      toast.error(e.message || 'Save failed');
    }
    setSaving(false);
  };

  const handleQuickAssignTeacher = async () => {
    if (!selectedClass) return;
    setSaving(true);
    try {
      const res = await fetch('/api/classes', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          id: selectedClass.id,
          school_id: schoolId,
          assigned_teacher_id: selectedTeacherId || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Assignment failed');
      toast.success('Homeroom teacher attached to class!');
      setTeacherModalOpen(false);
      await loadAll();
    } catch (e) {
      toast.error(e.message || 'Assignment failed');
    }
    setSaving(false);
  };

  const deleteClass = async (cls) => {
    const label = cls.section ? `${cls.name} (Arm ${cls.section})` : cls.name;
    if (!confirm(`Delete class "${label}"?`)) return;
    try {
      const res = await fetch(`/api/classes?id=${cls.id}&school_id=${schoolId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('Class removed');
      await loadAll();
    } catch (e) {
      toast.error(e.message || 'Delete failed');
    }
  };

  const teacherName = (cls) => {
    const t = cls.assigned_teacher;
    if (!t) {
      const byId = teachers.find((tp) => tp.id === cls.assigned_teacher_id);
      if (byId?.user?.full_name) return byId.user.full_name;
      return null;
    }
    const u = Array.isArray(t.user) ? t.user[0] : t.user;
    return u?.full_name || null;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-emerald-600 font-bold text-sm">Loading MyEduRide Classrooms...</div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 min-h-screen pt-14 md:pt-6 w-full max-w-full">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900">Classroom Management</h1>
            <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-2.5 py-0.5 rounded-full border border-emerald-200">
              {classes.length} Classes
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Create classroom arms and attach homeroom teachers to manage student safety and daily attendance.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/school-admin/students/new"
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors border border-slate-300"
          >
            <UserPlus size={16} /> Onboard Student
          </Link>
          <button
            type="button"
            onClick={openCreate}
            className="btn-primary flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-xl shadow-md"
          >
            <Plus size={16} /> Add Classroom Arm
          </button>
        </div>
      </div>

      {/* Class Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {classes.map((cls) => {
          const teacher = teacherName(cls);
          return (
            <div
              key={cls.id}
              className="bg-white rounded-2xl border border-slate-200/90 shadow-sm hover:shadow-md transition-all p-5 flex flex-col justify-between relative overflow-hidden group"
            >
              <div>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 group-hover:text-emerald-700 transition-colors">
                      {cls.name}{cls.section ? ` · Arm ${cls.section}` : ''}
                    </h3>
                    <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mt-0.5">
                      GRADE: {cls.grade || cls.name}
                    </p>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0">
                    <Users size={18} className="text-emerald-600" />
                  </div>
                </div>

                {/* Homeroom Teacher Attachment Status Pill */}
                <div className="mb-4">
                  {teacher ? (
                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-emerald-50/80 border border-emerald-200/70">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-6 h-6 rounded-full bg-emerald-600 text-white text-[10px] font-black flex items-center justify-center shrink-0 shadow-xs">
                          {teacher.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <span className="text-[10px] font-extrabold text-emerald-800 uppercase block leading-tight">
                            CLASSROOM TEACHER
                          </span>
                          <span className="text-xs font-bold text-slate-900 truncate block">
                            {teacher}
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => openQuickTeacherAttach(cls)}
                        className="text-[11px] font-bold text-emerald-700 hover:text-emerald-900 underline shrink-0 ml-2"
                      >
                        Change
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-amber-50 border border-amber-200">
                      <div className="flex items-center gap-2 min-w-0">
                        <UserCheck size={16} className="text-amber-600 shrink-0" />
                        <span className="text-xs font-semibold text-amber-900 truncate">
                          No teacher attached
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => openQuickTeacherAttach(cls)}
                        className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-bold rounded-lg transition-colors shadow-xs shrink-0"
                      >
                        Attach Teacher
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Roster & Actions */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => openRoster(cls)}
                  className="flex items-center gap-1.5 text-xs font-bold text-slate-700 hover:text-emerald-700 transition-colors"
                >
                  <Users size={14} className="text-slate-400" />
                  <span>{cls.student_count ?? 0} Students</span>
                  <ChevronRight size={14} className="text-slate-400" />
                </button>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => openEdit(cls)}
                    className="p-2 rounded-xl text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 transition-colors"
                    title="Edit Classroom Details"
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteClass(cls)}
                    className="p-2 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                    title="Delete Class"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {classes.length === 0 && (
          <div className="col-span-full bg-white rounded-2xl border border-dashed border-slate-300 text-center py-12 px-4 space-y-3">
            <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
              <Users size={24} />
            </div>
            <h3 className="text-base font-bold text-slate-900">No Classrooms Setup Yet</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Create your classroom arms (e.g. Primary 1 Arm A, Arm B) and attach homeroom teachers to start onboarding students.
            </p>
            <button
              type="button"
              onClick={openCreate}
              className="btn-primary inline-flex items-center gap-2 text-xs font-bold px-4 py-2.5 rounded-xl shadow-md"
            >
              <Plus size={16} /> Add Classroom Now
            </button>
          </div>
        )}
      </div>

      {/* Create / Edit Class Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl border border-slate-200 animate-in fade-in duration-150">
            <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-900">{editing ? 'Edit Classroom' : 'Create New Classroom Arm'}</h2>
              <button type="button" onClick={() => setModalOpen(false)} className="p-1 rounded-lg text-slate-400 hover:text-slate-700">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Class Name *</label>
                <input
                  className="input text-xs"
                  placeholder="e.g. Primary 5, JSS 1, Nursery 2"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Arm / Section *</label>
                <select className="input text-xs" value={form.arm} onChange={(e) => setForm((f) => ({ ...f, arm: e.target.value }))}>
                  <option value="">Select arm…</option>
                  {ARM_OPTIONS.map((a) => (
                    <option key={a} value={a}>Arm {a}</option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-400 mt-1">
                  You can create multiple arms under the same class name (e.g. Primary 5 A, Primary 5 B).
                </p>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Attach Homeroom Teacher</label>
                <select
                  className="input text-xs"
                  value={form.assigned_teacher_id}
                  onChange={(e) => setForm((f) => ({ ...f, assigned_teacher_id: e.target.value }))}
                >
                  <option value="">— Select Teacher (Optional) —</option>
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.user?.full_name || 'Teacher'}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-400 mt-1">
                  All active school teachers and staff appear in this list.
                </p>
              </div>
            </div>

            <div className="mt-6 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="w-1/3 py-2.5 border border-slate-300 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveClass}
                disabled={saving}
                className="w-2/3 btn-primary py-2.5 rounded-xl text-xs font-bold shadow-md"
              >
                {saving ? 'Saving…' : editing ? 'Update Classroom' : 'Create Classroom'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Attach Teacher Modal */}
      {teacherModalOpen && selectedClass && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl border border-slate-200">
            <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-100">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Attach Teacher to {selectedClass.name} (Arm {selectedClass.section})
                </h2>
                <p className="text-xs text-slate-500">Select homeroom teacher responsible for this classroom</p>
              </div>
              <button type="button" onClick={() => setTeacherModalOpen(false)} className="p-1 rounded-lg text-slate-400 hover:text-slate-700">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4 my-4">
              <label className="text-xs font-bold text-slate-700 block">Select Teacher</label>
              <select
                className="input text-xs"
                value={selectedTeacherId}
                onChange={(e) => setSelectedTeacherId(e.target.value)}
              >
                <option value="">— Unassign Teacher —</option>
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.user?.full_name || 'Teacher'}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2 mt-6">
              <button
                type="button"
                onClick={() => setTeacherModalOpen(false)}
                className="w-1/3 py-2.5 border border-slate-300 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleQuickAssignTeacher}
                disabled={saving}
                className="w-2/3 btn-primary py-2.5 rounded-xl text-xs font-bold shadow-md"
              >
                {saving ? 'Saving…' : 'Confirm Teacher Attachment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Class Student Roster Modal */}
      {rosterModalOpen && selectedClass && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-lg shadow-2xl border border-slate-200 max-h-[85vh] flex flex-col">
            <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-100 shrink-0">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  {selectedClass.name}{selectedClass.section ? ` · Arm ${selectedClass.section}` : ''} Roster
                </h2>
                <p className="text-xs text-slate-500">Active onboarded students in this classroom</p>
              </div>
              <button type="button" onClick={() => setRosterModalOpen(false)} className="p-1 rounded-lg text-slate-400 hover:text-slate-700">
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
              {rosterLoading ? (
                <div className="py-8 text-center text-xs text-slate-400 animate-pulse">Loading class roster…</div>
              ) : rosterStudents.length > 0 ? (
                rosterStudents.map((s) => (
                  <div key={s.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-emerald-600 text-white font-bold text-xs flex items-center justify-center">
                        {s.first_name?.[0]}{s.last_name?.[0]}
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-900">{s.first_name} {s.last_name}</h4>
                        <span className="text-[10px] text-slate-500 font-mono">ID: {s.student_id_number}</span>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                      Active
                    </span>
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-xs text-slate-400">
                  No onboarded students in this classroom yet.
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-slate-100 mt-3 flex justify-between items-center shrink-0">
              <Link
                href={`/dashboard/school-admin/students/new?class_id=${selectedClass.id}`}
                onClick={() => setRosterModalOpen(false)}
                className="btn-primary text-xs font-bold px-4 py-2 rounded-xl flex items-center gap-1.5"
              >
                <UserPlus size={14} /> Add Student to this Class
              </Link>
              <button
                type="button"
                onClick={() => setRosterModalOpen(false)}
                className="px-4 py-2 border border-slate-300 text-slate-700 text-xs font-bold rounded-xl"
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

