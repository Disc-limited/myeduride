// @ts-nocheck
'use client';

import { useEffect, useState } from 'react';
import { fetchData } from '@/lib/api';
import { Search, Plus, Trash2, Edit, X, ArrowUpCircle, CreditCard, CalendarDays } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import StudentAvatar from '@/components/shared/StudentAvatar';
import FaceCapture from '@/components/shared/FaceCapture';
import { todayInLagos, formatDateTimeLagos } from '@/lib/timezone';
import { timestampToLagosDateKey } from '@/lib/attendance/lagos-dates';
import { IdCardPreviewModal, IdCardPreviewData } from '@/components/id-card/IdCardPreviewModal';

export default function StudentsListPage() {
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [schoolId, setSchoolId] = useState('');
  const [schoolInfo, setSchoolInfo] = useState<any>(null);
  const [editingStudent, setEditingStudent] = useState(null);
  const [editFaceData, setEditFaceData] = useState({ photos: [], face_descriptor: null });
  const [clearingPhoto, setClearingPhoto] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [promoteOpen, setPromoteOpen] = useState(false);
  const [promoteClassId, setPromoteClassId] = useState('');
  const [promoting, setPromoting] = useState(false);
  const [promoteTarget, setPromoteTarget] = useState(null);

  // Digital Card Preview State (Read-only for School Admins)
  const [cardPreviewOpen, setCardPreviewOpen] = useState(false);
  const [previewCardData, setPreviewCardData] = useState<IdCardPreviewData | null>(null);

  useEffect(() => { loadStudents(); }, []);

  const loadStudents = async () => {
    try {
      const schoolData = await fetchData('get_school_admin_data', { role: 'school_admin' });
      if (!schoolData.school_id) { setLoading(false); return; }
      setSchoolId(schoolData.school_id);
      if (schoolData.school) setSchoolInfo(schoolData.school);
      const [studentsRes, classesRes] = await Promise.all([
        fetchData('get_students', { school_id: schoolData.school_id }),
        fetch(`/api/classes?school_id=${schoolData.school_id}`, { credentials: 'include' }),
      ]);
      setStudents(studentsRes.students || []);
      const classesJson = await classesRes.json();
      setClasses(classesJson.classes || []);
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const handleDelete = async (studentId, name) => {
    if (!confirm(`Delete ${name}? This cannot be undone.`)) return;
    const res = await fetch('/api/students/delete', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ student_id: studentId }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      const extra = data.parents_removed > 0 ? ` (${data.parents_removed} parent account${data.parents_removed > 1 ? 's' : ''} removed — no other children)` : '';
      toast.success(`${name} deleted${extra}`);
      loadStudents();
    } else toast.error(data.error || 'Failed to delete');
  };

  const handleClearPhoto = async () => {
    if (!editingStudent?.id) return;
    if (!confirm(`Remove the registered photo for ${editingStudent.first_name} ${editingStudent.last_name}? You can then capture the correct face.`)) {
      return;
    }
    setClearingPhoto(true);
    try {
      const res = await fetch('/api/students/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ id: editingStudent.id, clear_photo: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to remove photo');
      setEditingStudent({ ...editingStudent, photo_url: null, face_descriptor: null });
      setEditFaceData({ photos: [], face_descriptor: null });
      toast.success('Photo removed. Capture 3 new face photos for the correct student.');
      loadStudents();
    } catch (err) {
      toast.error(err?.message || 'Failed to remove photo');
    } finally {
      setClearingPhoto(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!editingStudent) return;

    if (editFaceData.photos.length > 0 && editFaceData.photos.length < 3) {
      toast.error("Take all 3 face photos to update the student's photo");
      return;
    }

    const payload = {
      ...editingStudent,
    };

    if (editFaceData.photos.length === 3) {
      payload.photo_base64 = editFaceData.photos[0];
      payload.face_descriptor = editFaceData.face_descriptor;
      payload.clear_photo = false;
    }

    const res = await fetch('/api/students/update', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      toast.success('Student updated');
      setEditingStudent(null);
      setEditFaceData({ photos: [], face_descriptor: null });
      loadStudents();
    }
    else toast.error('Failed to update');
  };

  const runPromote = async () => {
    const ids = promoteTarget ? [promoteTarget.id] : selectedIds;
    if (!ids.length || !promoteClassId) {
      toast.error('Select students and a target class');
      return;
    }
    setPromoting(true);
    try {
      const res = await fetch('/api/students/promote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          school_id: schoolId,
          student_ids: ids,
          to_class_id: promoteClassId,
          effective_date: todayInLagos(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(`Promoted ${data.promoted_count} student(s) to ${data.to_class}`);
      setPromoteOpen(false);
      setPromoteTarget(null);
      setSelectedIds([]);
      loadStudents();
    } catch (e) {
      toast.error(e.message || 'Promotion failed');
    }
    setPromoting(false);
  };

  const openPromote = (student = null) => {
    setPromoteTarget(student);
    setPromoteClassId('');
    setPromoteOpen(true);
  };

  const openEditModal = (student) => {
    setEditingStudent({ ...student });
    setEditFaceData({ photos: [], face_descriptor: null });
  };

  const openCardPreview = (student: any) => {
    setPreviewCardData({
      kind: 'student',
      fullName: `${student.first_name} ${student.last_name}`,
      idNumber: student.student_id_number,
      className: student.class?.name || 'Class',
      photoUrl: student.photo_url,
      qrData: student.qr_code_data || `MYEDURIDE:${student.student_id_number}`,
      schoolName: schoolInfo?.name,
      schoolAddress: schoolInfo?.location_address || schoolInfo?.address,
      schoolLandmark: schoolInfo?.location_landmark,
      signatureUrl: schoolInfo?.principal_signature_url,
      logoUrl: schoolInfo?.logo_url,
      primaryColor: schoolInfo?.primary_color,
    });
    setCardPreviewOpen(true);
  };

  const todayKey = todayInLagos();
  const registeredToday = students.filter(
    (s) => s.created_at && timestampToLagosDateKey(s.created_at) === todayKey
  ).length;

  const filteredStudents = students.filter((s) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = `${s.first_name} ${s.last_name} ${s.student_id_number} ${s.class?.name || ''}`.toLowerCase().includes(q);
    const matchesClass = !classFilter || s.class_id === classFilter || s.class?.id === classFilter;
    const matchesDate =
      !dateFilter || (s.created_at && timestampToLagosDateKey(s.created_at) === dateFilter);
    return matchesSearch && matchesClass && matchesDate;
  });

  const toggleSelect = (id) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredStudents.length) setSelectedIds([]);
    else setSelectedIds(filteredStudents.map((s) => s.id));
  };

  if (loading) return <div className="page-shell flex items-center justify-center"><div className="animate-pulse text-primary-600">Loading...</div></div>;

  return (
    <div className="page-shell w-full max-w-full">
      <div className="page-header">
        <div>
          <p className="page-badge">Students</p>
          <h1 className="page-title">Student list ({students.length})</h1>
          <p className="page-subtitle">Search, filter by class or registration date, or promote to the next class for the new term.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 shrink-0 w-full sm:w-auto">
          <Link
            href="/dashboard/school-admin/reports/student-registrations"
            className="btn-secondary flex items-center justify-center gap-2 text-sm min-h-[44px]"
          >
            <CalendarDays size={16} /> Daily registrations
          </Link>
          <Link href="/dashboard/school-admin/students/new" className="btn-primary flex items-center justify-center gap-2 text-sm min-h-[44px]">
            <Plus size={18} /> Add student
          </Link>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-3 mb-4">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 px-4 py-3 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700">Registered today</p>
            <p className="text-2xl font-black text-slate-900">{registeredToday}</p>
          </div>
          <button
            type="button"
            onClick={() => setDateFilter(todayKey)}
            className="text-xs font-bold text-emerald-700 hover:underline"
          >
            View today
          </button>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">Total students</p>
            <p className="text-2xl font-black text-slate-900">{students.length}</p>
          </div>
          <Link href="/dashboard/school-admin/reports/student-registrations" className="text-xs font-bold text-slate-600 hover:underline">
            Accountant ledger →
          </Link>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search name, class, or ID…"
            className="input pl-10 min-h-[44px]"
          />
        </div>
        <select
          value={classFilter}
          onChange={(e) => setClassFilter(e.target.value)}
          className="input sm:w-48 min-h-[44px]"
        >
          <option value="">All classes</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>{c.name}{c.section ? ` · Arm ${c.section}` : ''}</option>
          ))}
        </select>
        <input
          type="date"
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
          className="input sm:w-44 min-h-[44px]"
          title="Filter by registration date"
        />
        {dateFilter && (
          <button type="button" onClick={() => setDateFilter('')} className="btn-secondary text-xs min-h-[44px] px-3">
            Clear date
          </button>
        )}
      </div>

      {selectedIds.length > 0 && (
        <div className="alert-info flex flex-wrap items-center justify-between gap-2 mb-4">
          <span className="text-sm font-medium">{selectedIds.length} selected</span>
          <button type="button" onClick={() => openPromote()} className="btn-primary text-sm min-h-[44px] px-4">
            <ArrowUpCircle size={16} className="inline mr-1" /> Promote selected
          </button>
        </div>
      )}

      <div className="card p-0 overflow-hidden overflow-x-auto">
        <table className="w-full min-w-[640px]">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-3 py-3 w-10">
                <input
                  type="checkbox"
                  checked={filteredStudents.length > 0 && selectedIds.length === filteredStudents.length}
                  onChange={toggleSelectAll}
                  aria-label="Select all"
                />
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Student</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Class</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">ID</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Date created</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filteredStudents.map((s) => (
              <tr key={s.id} className="hover:bg-gray-50">
                <td className="px-3 py-3">
                  <input type="checkbox" checked={selectedIds.includes(s.id)} onChange={() => toggleSelect(s.id)} />
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <StudentAvatar photoUrl={s.photo_url} firstName={s.first_name} lastName={s.last_name} size="sm" />
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                      <span className="text-sm font-semibold">{s.first_name} {s.last_name}</span>
                      {!s.photo_url && (
                        <span className="text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded-full flex items-center gap-1 shrink-0 w-fit">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                          Missing Photo
                        </span>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm font-medium text-primary-700">{s.class?.name || '—'}</td>
                <td className="px-4 py-3 text-sm text-gray-500 font-mono">{s.student_id_number}</td>
                <td className="px-4 py-3 text-sm text-slate-700 whitespace-nowrap">
                  {s.created_at ? formatDateTimeLagos(s.created_at) : '—'}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button type="button" onClick={() => openCardPreview(s)} className="p-2.5 rounded-lg hover:bg-emerald-50 text-gray-400 hover:text-emerald-600 min-h-[44px] min-w-[44px]" title="View Digital ID Pass (Read-Only)">
                      <CreditCard size={16} />
                    </button>
                    <button type="button" onClick={() => openPromote(s)} className="p-2.5 rounded-lg hover:bg-emerald-50 text-gray-400 hover:text-emerald-600 min-h-[44px] min-w-[44px]" title="Promote">
                      <ArrowUpCircle size={16} />
                    </button>
                    <button type="button" onClick={() => openEditModal(s)} className="p-2.5 rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-600 min-h-[44px] min-w-[44px]" title="Edit Student">
                      <Edit size={16} />
                    </button>
                    <button type="button" onClick={() => handleDelete(s.id, `${s.first_name} ${s.last_name}`)} className="p-2.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 min-h-[44px] min-w-[44px]" title="Delete Student">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filteredStudents.length === 0 && <tr><td colSpan={6} className="py-8 text-center text-gray-400">No students found</td></tr>}
          </tbody>
        </table>
      </div>

      {editingStudent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">Edit student</h2>
              <button type="button" onClick={() => setEditingStudent(null)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>
            <div className="space-y-3">
              {editingStudent.photo_url && (
                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <StudentAvatar photoUrl={editingStudent.photo_url} firstName={editingStudent.first_name} lastName={editingStudent.last_name} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-600">Current Photo Registered</p>
                    <p className="text-[10px] text-slate-500">Wrong photo? Remove it, then capture 3 new face shots below.</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleClearPhoto}
                    disabled={clearingPhoto}
                    className="shrink-0 text-xs font-bold text-red-600 hover:text-red-700 hover:bg-red-50 px-2.5 py-1.5 rounded-lg border border-red-200 disabled:opacity-60 flex items-center gap-1"
                    title="Remove registered photo"
                  >
                    <X size={12} />
                    {clearingPhoto ? 'Removing…' : 'Remove photo'}
                  </button>
                </div>
              )}
              {!editingStudent.photo_url && (
                <div className="p-3 rounded-xl border border-amber-200 bg-amber-50 text-[11px] text-amber-900 font-medium">
                  No photo registered. Use the camera below to capture 3 face photos for this student, then Save.
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">First name</label>
                  <input type="text" value={editingStudent.first_name} onChange={(e) => setEditingStudent({ ...editingStudent, first_name: e.target.value })} className="input" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Last name</label>
                  <input type="text" value={editingStudent.last_name} onChange={(e) => setEditingStudent({ ...editingStudent, last_name: e.target.value })} className="input" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Student ID</label>
                <input type="text" value={editingStudent.student_id_number} className="input bg-gray-50" disabled />
              </div>
              <div className="border-t border-slate-100 pt-3 mt-3">
                <FaceCapture
                  label={editingStudent.photo_url ? "Update face & ID photo" : "Register face & ID photo"}
                  minPhotos={3}
                  maxPhotos={3}
                  onChange={setEditFaceData}
                />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button type="button" onClick={() => setEditingStudent(null)} className="btn-secondary flex-1 min-h-[44px]">Cancel</button>
              <button type="button" onClick={handleSaveEdit} disabled={editFaceData.photos.length > 0 && editFaceData.photos.length < 3} className="btn-primary flex-1 min-h-[44px]">Save</button>
            </div>
          </div>
        </div>
      )}

      {promoteOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold mb-2">Promote {promoteTarget ? `${promoteTarget.first_name} ${promoteTarget.last_name}` : `${selectedIds.length} students`}</h2>
            <p className="text-sm text-gray-500 mb-4">Updates class for the new term. History is recorded in promotions log.</p>
            <label className="block text-xs font-medium text-gray-600 mb-1">Promote to class</label>
            <select value={promoteClassId} onChange={(e) => setPromoteClassId(e.target.value)} className="input mb-4 min-h-[44px]">
              <option value="">Select class…</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <div className="flex gap-3">
              <button type="button" onClick={() => { setPromoteOpen(false); setPromoteTarget(null); }} className="btn-secondary flex-1 min-h-[44px]">Cancel</button>
              <button type="button" onClick={runPromote} disabled={promoting} className="btn-primary flex-1 min-h-[44px]">
                {promoting ? 'Promoting…' : 'Confirm promotion'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Read-Only Digital ID Card Preview Modal */}
      <IdCardPreviewModal
        isOpen={cardPreviewOpen}
        onClose={() => setCardPreviewOpen(false)}
        data={previewCardData}
      />
    </div>
  );
}
