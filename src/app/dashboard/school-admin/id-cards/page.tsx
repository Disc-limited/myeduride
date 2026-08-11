// @ts-nocheck
'use client';

import { useEffect, useState } from 'react';
import { fetchData } from '@/lib/api';
import { downloadIdCardsPdf } from '@/lib/id-card/download';
import StudentAvatar from '@/components/shared/StudentAvatar';
import { Search, Download, CheckSquare, Square, Users, GraduationCap, CreditCard, Filter } from 'lucide-react';
import { toast } from 'sonner';

const STAFF_ACCESS_ROLES = ['staff', 'teacher', 'gate_officer', 'school_admin'];

export default function SchoolAdminIdCardsPage() {
  const [entityTab, setEntityTab] = useState('students');
  const [students, setStudents] = useState([]);
  const [staff, setStaff] = useState([]);
  const [classes, setClasses] = useState([]);
  const [schoolId, setSchoolId] = useState('');
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClass, setSelectedClass] = useState('all');
  const [selectedRole, setSelectedRole] = useState('all');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    setSelectedIds(new Set());
    setSearchQuery('');
  }, [entityTab]);

  const loadData = async () => {
    try {
      const schoolData = await fetchData('get_school_admin_data', { role: 'school_admin' });
      if (!schoolData?.school_id) {
        toast.error('No school linked to account');
        setLoading(false);
        return;
      }
      setSchoolId(schoolData.school_id);

      const [studentsRes, staffRes, classesRes] = await Promise.all([
        fetchData('get_students', { school_id: schoolData.school_id }),
        fetch(`/api/schools/staff?school_id=${schoolData.school_id}&ensure_profiles=1`, {
          cache: 'no-store',
          credentials: 'include',
        }),
        fetch(`/api/classes?school_id=${schoolData.school_id}`, { credentials: 'include' }),
      ]);

      setStudents(studentsRes.students || []);

      const staffJson = await staffRes.json();
      const staffList = (staffJson.staff || []).filter((s) => STAFF_ACCESS_ROLES.includes(s.role));
      setStaff(staffList);

      const classesJson = await classesRes.json();
      setClasses(classesJson.classes || []);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load ID card data');
    }
    setLoading(false);
  };

  const filteredStudents = students.filter((s) => {
    const q = searchQuery.toLowerCase();
    const matchSearch = `${s.first_name} ${s.last_name} ${s.student_id_number}`.toLowerCase().includes(q);
    const matchClass = selectedClass === 'all' || s.class_id === selectedClass;
    return matchSearch && matchClass;
  });

  const filteredStaff = staff.filter((s) => {
    const q = searchQuery.toLowerCase();
    const name = s.profile?.full_name || '';
    const idNum = s.staff?.staff_id_number || '';
    const matchSearch = `${name} ${idNum} ${s.role}`.toLowerCase().includes(q);
    const matchRole = selectedRole === 'all' || s.role === selectedRole;
    return matchSearch && matchRole;
  });

  const filtered = entityTab === 'students' ? filteredStudents : filteredStaff;

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleDownload = async () => {
    if (selectedIds.size === 0) {
      toast.error('Select at least one person to generate ID cards');
      return;
    }

    setGenerating(true);
    const result = await downloadIdCardsPdf({
      school_id: schoolId,
      student_ids: entityTab === 'students' ? [...selectedIds] : [],
      staff_role_ids: entityTab === 'staff' ? [...selectedIds] : [],
      fileName: `${entityTab}_id_cards_${new Date().toISOString().split('T')[0]}.pdf`,
    });

    if (result.ok) {
      toast.success('ID Cards PDF generated successfully! Ready to print.');
    } else {
      toast.error(result.error || 'Failed to generate ID Cards PDF');
    }
    setGenerating(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center pt-12">
        <div className="animate-pulse text-emerald-600 font-bold text-sm">Loading ID Cards Generator...</div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 min-h-screen pt-14 md:pt-6 w-full max-w-full">
      {/* Top Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <CreditCard className="text-emerald-600" size={24} />
            <h1 className="text-2xl font-bold text-slate-900">ID Cards Generator</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Generate printable high-resolution PDF ID cards with photos & QR codes for students and staff.
          </p>
        </div>
        <button
          onClick={handleDownload}
          disabled={selectedIds.size === 0 || generating}
          className="btn-primary flex items-center gap-2 text-xs font-bold px-5 py-2.5 rounded-xl shadow-md disabled:opacity-50"
        >
          <Download size={16} />
          {generating ? 'Generating PDF…' : `Download Selected ID Cards (${selectedIds.size})`}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 bg-slate-200/80 p-1.5 rounded-2xl mb-5 max-w-md">
        <button
          type="button"
          onClick={() => setEntityTab('students')}
          className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${
            entityTab === 'students' ? 'bg-white shadow-sm text-emerald-700 font-bold' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Users size={16} /> Students ({students.length})
        </button>
        <button
          type="button"
          onClick={() => setEntityTab('staff')}
          className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${
            entityTab === 'staff' ? 'bg-white shadow-sm text-emerald-700 font-bold' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <GraduationCap size={16} /> Staff ({staff.length})
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={entityTab === 'students' ? 'Search by student name or ID...' : 'Search by staff name, ID or role...'}
            className="input text-xs pl-10"
          />
        </div>

        {entityTab === 'students' && (
          <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)} className="input text-xs w-56">
            <option value="all">All Classrooms</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}{c.section ? ` · Arm ${c.section}` : ''}
              </option>
            ))}
          </select>
        )}

        {entityTab === 'staff' && (
          <select value={selectedRole} onChange={(e) => setSelectedRole(e.target.value)} className="input text-xs w-48">
            <option value="all">All Staff Roles</option>
            <option value="teacher">Teachers</option>
            <option value="gate_officer">Gate Officers</option>
            <option value="school_admin">School Admins</option>
            <option value="staff">Other Staff</option>
          </select>
        )}
      </div>

      {/* Select All Action */}
      <div className="flex items-center justify-between mb-4 px-1">
        <button
          type="button"
          onClick={() => {
            if (selectedIds.size === filtered.length) setSelectedIds(new Set());
            else setSelectedIds(new Set(filtered.map((x) => x.id)));
          }}
          className="text-xs font-bold text-emerald-700 hover:text-emerald-900 flex items-center gap-2 cursor-pointer"
        >
          {selectedIds.size === filtered.length && filtered.length > 0 ? (
            <CheckSquare size={18} className="text-emerald-600" />
          ) : (
            <Square size={18} className="text-slate-400" />
          )}
          <span>Select all shown ({filtered.length})</span>
        </button>

        <span className="text-xs text-slate-500 font-semibold">
          {selectedIds.size} selected for PDF export
        </span>
      </div>

      {/* Grid of Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {entityTab === 'students' &&
          filteredStudents.map((student) => {
            const isSel = selectedIds.has(student.id);
            return (
              <div
                key={student.id}
                onClick={() => toggleSelect(student.id)}
                className={`bg-white rounded-2xl border p-4 cursor-pointer transition-all flex items-center gap-3.5 ${
                  isSel ? 'border-emerald-500 bg-emerald-50/50 shadow-md ring-1 ring-emerald-500/30' : 'border-slate-200 hover:border-slate-300 shadow-xs'
                }`}
              >
                {isSel ? (
                  <CheckSquare size={20} className="text-emerald-600 shrink-0" />
                ) : (
                  <Square size={20} className="text-slate-300 shrink-0" />
                )}
                <StudentAvatar
                  photoUrl={student.photo_url}
                  firstName={student.first_name}
                  lastName={student.last_name}
                  size="md"
                />
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-bold text-slate-900 truncate">
                    {student.first_name} {student.last_name}
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {student.class?.name || 'Unassigned'}
                  </p>
                  <p className="text-[11px] font-mono font-bold text-emerald-800 mt-0.5">
                    {student.student_id_number}
                  </p>
                </div>
              </div>
            );
          })}

        {entityTab === 'staff' &&
          filteredStaff.map((member) => {
            const isSel = selectedIds.has(member.id);
            const name = member.profile?.full_name || 'Staff Member';
            const firstName = name.split(' ')[0];
            const lastName = name.split(' ').slice(1).join(' ');
            return (
              <div
                key={member.id}
                onClick={() => toggleSelect(member.id)}
                className={`bg-white rounded-2xl border p-4 cursor-pointer transition-all flex items-center gap-3.5 ${
                  isSel ? 'border-emerald-500 bg-emerald-50/50 shadow-md ring-1 ring-emerald-500/30' : 'border-slate-200 hover:border-slate-300 shadow-xs'
                }`}
              >
                {isSel ? (
                  <CheckSquare size={20} className="text-emerald-600 shrink-0" />
                ) : (
                  <Square size={20} className="text-slate-300 shrink-0" />
                )}
                <StudentAvatar
                  photoUrl={member.staff?.photo_url}
                  firstName={firstName}
                  lastName={lastName}
                  size="md"
                />
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-bold text-slate-900 truncate">{name}</h4>
                  <p className="text-xs text-slate-500 mt-0.5 capitalize">
                    {member.job_title || member.role?.replace('_', ' ')}
                  </p>
                  <p className="text-[11px] font-mono font-bold text-emerald-800 mt-0.5">
                    {member.staff?.staff_id_number || 'ID Auto-generated'}
                  </p>
                </div>
              </div>
            );
          })}
      </div>

      {filtered.length === 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 text-center py-12 px-4 text-slate-400 space-y-2">
          <CreditCard size={32} className="mx-auto text-slate-300" />
          <p className="text-xs font-semibold">
            {entityTab === 'staff' ? 'No staff members found matching your search' : 'No students found matching your search'}
          </p>
        </div>
      )}
    </div>
  );
}

