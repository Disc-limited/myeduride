// @ts-nocheck
'use client';

import { useEffect, useState } from 'react';
import { downloadIdCardsPdf } from '@/lib/id-card/download';
import StudentAvatar from '@/components/shared/StudentAvatar';
import {
  Search,
  Download,
  CheckSquare,
  Square,
  Users,
  GraduationCap,
  Palette,
  Eye,
  Sliders,
  Sparkles,
  ShieldCheck,
  X,
  Check,
  QrCode,
  Building2,
  FileBadge2,
  Image as ImageIcon,
  CreditCard,
} from 'lucide-react';
import AtmCardPass from '@/components/id-card/AtmCardPass';
import { photoSrc } from '@/lib/photo';
import QRCode from 'qrcode';
import { toast } from 'sonner';

const STAFF_ACCESS_ROLES = ['staff', 'teacher', 'gate_officer', 'school_admin'];

const COLOR_PRESETS = [
  { label: 'School Navy', primary: '#0D4A71', accent: '#28A745' },
  { label: 'Royal Blue', primary: '#1E3A8A', accent: '#3B82F6' },
  { label: 'Emerald Green', primary: '#065F46', accent: '#10B981' },
  { label: 'Crimson Red', primary: '#991B1B', accent: '#EF4444' },
  { label: 'Deep Purple', primary: '#581C87', accent: '#A855F7' },
  { label: 'Midnight Slate', primary: '#0F172A', accent: '#64748B' },
  { label: 'Warm Amber', primary: '#78350F', accent: '#F59E0B' },
];

const PHOTO_BG_PRESETS = [
  { label: 'Pure White', value: '#FFFFFF', colorBox: 'bg-white border border-slate-300' },
  { label: 'Ice Blue', value: '#F0F9FF', colorBox: 'bg-sky-100' },
  { label: 'Light Slate', value: '#F1F5F9', colorBox: 'bg-slate-200' },
  { label: 'Match Primary', value: 'PRIMARY_MATCH', colorBox: 'bg-gradient-to-r from-[#0D4A71] to-[#28A745]' },
  { label: 'Dark Navy', value: '#0F172A', colorBox: 'bg-slate-900' },
];

export default function SuperAdminIdCardsPage() {
  const [entityTab, setEntityTab] = useState('students');
  const [students, setStudents] = useState([]);
  const [staff, setStaff] = useState([]);
  const [schools, setSchools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSchool, setSelectedSchool] = useState('all');
  const [selectedRole, setSelectedRole] = useState('all');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [generating, setGenerating] = useState(false);

  // ID Card Styling Studio State
  const [primaryColor, setPrimaryColor] = useState('#0D4A71');
  const [accentColor, setAccentColor] = useState('#28A745');
  const [photoBgColor, setPhotoBgColor] = useState('#FFFFFF');
  const [removePhotoBg, setRemovePhotoBg] = useState(false);
  const [showStudioPanel, setShowStudioPanel] = useState(true);

  // Live Card Preview Modal
  const [previewPerson, setPreviewPerson] = useState<any | null>(null);
  const [previewDesign, setPreviewDesign] = useState<'atm' | 'classic'>('atm');
  const [previewSide, setPreviewSide] = useState<'front' | 'back'>('front');
  const [previewQrDataUrl, setPreviewQrDataUrl] = useState<string>('');

  useEffect(() => {
    if (previewPerson?.qrData) {
      QRCode.toDataURL(previewPerson.qrData, {
        width: 384,
        margin: 1,
        errorCorrectionLevel: 'M',
        color: { dark: '#000000', light: '#ffffff' },
      })
        .then((url) => setPreviewQrDataUrl(url))
        .catch(() => setPreviewQrDataUrl(''));
    } else {
      setPreviewQrDataUrl('');
    }
    setPreviewSide('front');
    setPreviewDesign('atm');
  }, [previewPerson]);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    setSelectedIds(new Set());
    setSearchQuery('');
  }, [entityTab]);

  // When a school is selected, auto-load its primary color if set
  useEffect(() => {
    if (selectedSchool !== 'all') {
      const foundSchool = schools.find((s) => s.id === selectedSchool);
      if (foundSchool?.primary_color) {
        setPrimaryColor(foundSchool.primary_color);
      }
    }
  }, [selectedSchool, schools]);

  const loadData = async () => {
    try {
      const schoolRes = await fetch('/api/schools/list', { cache: 'no-store', credentials: 'include' });
      const schoolData = await schoolRes.json();
      const schoolList = schoolData.schools || [];
      setSchools(schoolList);

      const allStudents = [];
      const allStaff = [];

      for (const school of schoolList) {
        const [studentRes, staffRes] = await Promise.all([
          fetch(`/api/schools/students?school_id=${school.id}`, {
            cache: 'no-store',
            credentials: 'include',
          }),
          fetch(`/api/schools/staff?school_id=${school.id}&ensure_profiles=1`, {
            cache: 'no-store',
            credentials: 'include',
          }),
        ]);

        const studentData = await studentRes.json();
        (studentData.students || []).forEach((s) =>
          allStudents.push({ ...s, school, school_id: school.id })
        );

        const staffData = await staffRes.json();
        (staffData.staff || [])
          .filter((s) => STAFF_ACCESS_ROLES.includes(s.role))
          .forEach((s) => allStaff.push({ ...s, school, school_id: school.id }));
      }

      setStudents(allStudents);
      setStaff(allStaff);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load ID card data');
    }
    setLoading(false);
  };

  const filteredStudents = students.filter((s) => {
    const q = searchQuery.toLowerCase();
    const matchSearch = `${s.first_name} ${s.last_name} ${s.student_id_number}`.toLowerCase().includes(q);
    const matchSchool = selectedSchool === 'all' || s.school_id === selectedSchool;
    return matchSearch && matchSchool;
  });

  const filteredStaff = staff.filter((s) => {
    const q = searchQuery.toLowerCase();
    const matchSearch = `${s.profile?.full_name} ${s.staff?.staff_id_number} ${s.role}`.toLowerCase().includes(q);
    const matchSchool = selectedSchool === 'all' || s.school_id === selectedSchool;
    const matchRole = selectedRole === 'all' || s.role === selectedRole;
    return matchSearch && matchSchool && matchRole;
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

  const activePhotoBgHex = photoBgColor === 'PRIMARY_MATCH' ? primaryColor : photoBgColor;

  const handleDownload = async () => {
    if (selectedIds.size === 0) {
      toast.error('Select at least one person');
      return;
    }

    const list = entityTab === 'students' ? students : staff;
    const selected = list.filter((x) => selectedIds.has(x.id));
    const schoolId = selected[0]?.school_id || selected[0]?.school?.id;
    if (!schoolId) {
      toast.error('Could not determine school');
      return;
    }

    const sameSchool = selected.every((x) => (x.school_id || x.school?.id) === schoolId);
    if (!sameSchool) {
      toast.error('Select people from one school at a time');
      return;
    }

    setGenerating(true);
    const result = await downloadIdCardsPdf({
      school_id: schoolId,
      student_ids: entityTab === 'students' ? [...selectedIds] : [],
      staff_role_ids: entityTab === 'staff' ? [...selectedIds] : [],
      fileName: `${entityTab}_id_cards.pdf`,
      primary_color: primaryColor,
      accent_color: accentColor,
      photo_bg_color: activePhotoBgHex,
    });

    if (result.ok) toast.success('PDF generated — open it and print at 100% scale');
    else toast.error(result.error);
    setGenerating(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center pt-12 bg-slate-900 text-white font-poppins">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-semibold text-slate-300">Loading DISC ID Card Studio...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 min-h-screen pt-14 bg-slate-900 font-poppins text-slate-100">
      
      {/* Top Header Title & Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-emerald-950/80 border border-emerald-500/30 rounded-2xl text-emerald-400">
              <FileBadge2 className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-extrabold text-white">DISC ID Card & Photo Branding Studio</h1>
              <p className="text-xs text-slate-400">
                Super Admin Exclusive · {students.length} Students · {staff.length} Staff · Custom Color & Photo Studio
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowStudioPanel(!showStudioPanel)}
            className="px-3.5 py-2 rounded-xl bg-slate-800 border border-slate-700 hover:bg-slate-700 text-xs font-bold flex items-center gap-2 transition-all cursor-pointer"
          >
            <Sliders className="w-4 h-4 text-emerald-400" />
            <span>{showStudioPanel ? 'Hide Studio Controls' : 'Customize Card Theme'}</span>
          </button>

          <button
            type="button"
            onClick={handleDownload}
            disabled={selectedIds.size === 0 || generating}
            className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs transition-all shadow-lg shadow-emerald-600/30 flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            <span>{generating ? 'Generating PDF...' : `Download PDF (${selectedIds.size})`}</span>
          </button>
        </div>
      </div>

      {/* SUPER ADMIN ID CARD BRANDING & PHOTO STUDIO PANEL */}
      {showStudioPanel && (
        <div className="bg-slate-950 border border-slate-800 rounded-3xl p-5 mb-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2 text-emerald-400 font-extrabold text-xs uppercase tracking-wider">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>School Brand Colors & Photo Background Studio</span>
            </div>
            <span className="text-[11px] text-slate-400 bg-slate-900 border border-slate-800 px-2.5 py-1 rounded-full">
              PDF & Print Compliant
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Color Preset Selector */}
            <div className="space-y-2.5">
              <label className="block text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Palette className="w-4 h-4 text-emerald-400" />
                <span>Primary School Color</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {COLOR_PRESETS.map((p) => (
                  <button
                    key={p.primary}
                    type="button"
                    onClick={() => {
                      setPrimaryColor(p.primary);
                      setAccentColor(p.accent);
                    }}
                    className={`px-2.5 py-1.5 rounded-xl text-[11px] font-semibold border flex items-center gap-2 transition-all cursor-pointer ${
                      primaryColor === p.primary
                        ? 'border-emerald-400 bg-slate-800 text-white shadow-xs'
                        : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-white'
                    }`}
                  >
                    <span className="w-3 h-3 rounded-full border border-white/20" style={{ backgroundColor: p.primary }} />
                    <span>{p.label}</span>
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-3 pt-1">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-slate-400 font-semibold">Hex:</span>
                  <input
                    type="color"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="w-7 h-7 rounded-lg cursor-pointer bg-transparent border-0 p-0"
                  />
                  <input
                    type="text"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="w-20 bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-xs font-mono text-white focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Photo Avatar Background Customizer */}
            <div className="space-y-2.5">
              <label className="block text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <ImageIcon className="w-4 h-4 text-emerald-400" />
                <span>Photo Avatar Backdrop Styling</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {PHOTO_BG_PRESETS.map((bg) => (
                  <button
                    key={bg.value}
                    type="button"
                    onClick={() => setPhotoBgColor(bg.value)}
                    className={`px-2.5 py-1.5 rounded-xl text-[11px] font-semibold border flex items-center gap-2 transition-all cursor-pointer ${
                      photoBgColor === bg.value
                        ? 'border-emerald-400 bg-slate-800 text-white shadow-xs'
                        : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-white'
                    }`}
                  >
                    <span className={`w-3 h-3 rounded-full ${bg.colorBox}`} />
                    <span>{bg.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Background Removal & Quality Controls */}
            <div className="space-y-2.5">
              <label className="block text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Background Removal & Verification</span>
              </label>
              <div className="space-y-2">
                <label className="flex items-center gap-2.5 text-xs text-slate-300 cursor-pointer bg-slate-900 p-2.5 rounded-xl border border-slate-800 hover:border-slate-700">
                  <input
                    type="checkbox"
                    checked={removePhotoBg}
                    onChange={(e) => setRemovePhotoBg(e.target.checked)}
                    className="rounded border-slate-700 text-emerald-500 focus:ring-emerald-500"
                  />
                  <span>Auto-contrast Photo Background</span>
                </label>
                <div className="p-2.5 bg-slate-900/60 rounded-xl border border-slate-800 text-[11px] text-slate-400 leading-relaxed">
                  Active Brand Color: <strong style={{ color: primaryColor }}>{primaryColor}</strong> · Photo Backdrop: <strong style={{ color: activePhotoBgHex }}>{activePhotoBgHex}</strong>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Role Entity Tabs */}
      <div className="flex gap-1 bg-slate-950 p-1.5 rounded-2xl mb-4 max-w-md border border-slate-800">
        <button
          type="button"
          onClick={() => setEntityTab('students')}
          className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
            entityTab === 'students' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Students ({students.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setEntityTab('staff')}
          className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
            entityTab === 'staff' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
          }`}
        >
          <GraduationCap className="w-4 h-4" />
          <span>Staff ({staff.length})</span>
        </button>
      </div>

      {/* Search & School Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={entityTab === 'students' ? 'Search students by name or ID...' : 'Search staff by name, role or ID...'}
            className="w-full h-10 pl-10 pr-4 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />
        </div>

        <select
          value={selectedSchool}
          onChange={(e) => setSelectedSchool(e.target.value)}
          className="h-10 px-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500 cursor-pointer min-w-[200px]"
        >
          <option value="all">All Schools</option>
          {schools.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>

        {entityTab === 'staff' && (
          <select
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value)}
            className="h-10 px-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500 cursor-pointer min-w-[160px]"
          >
            <option value="all">All Roles</option>
            <option value="staff">Staff (all roles)</option>
            <option value="teacher">Teachers</option>
            <option value="gate_officer">Gate Officers</option>
            <option value="school_admin">School Admins</option>
          </select>
        )}
      </div>

      {/* Select All Action Header */}
      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          onClick={() => {
            if (selectedIds.size === filtered.length) setSelectedIds(new Set());
            else setSelectedIds(new Set(filtered.map((x) => x.id)));
          }}
          className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 flex items-center gap-2 cursor-pointer"
        >
          {selectedIds.size === filtered.length ? <CheckSquare size={16} /> : <Square size={16} />}
          <span>Select all shown ({filtered.length})</span>
        </button>

        <span className="text-xs text-slate-400">
          Selected: <strong className="text-white">{selectedIds.size}</strong> cards
        </span>
      </div>

      {/* CARDS LIST GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {entityTab === 'students' &&
          filteredStudents.map((student) => {
            const isSelected = selectedIds.has(student.id);
            return (
              <div
                key={student.id}
                className={`bg-slate-950 border rounded-2xl p-4 transition-all flex items-center justify-between gap-3 ${
                  isSelected ? 'border-emerald-500 bg-slate-900/90 shadow-lg shadow-emerald-500/10' : 'border-slate-800 hover:border-slate-700'
                }`}
              >
                <div
                  onClick={() => toggleSelect(student.id)}
                  className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
                >
                  {isSelected ? (
                    <CheckSquare size={18} className="text-emerald-400 shrink-0" />
                  ) : (
                    <Square size={18} className="text-slate-600 shrink-0" />
                  )}

                  {/* Student Photo Avatar with Customized Background Frame */}
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center overflow-hidden border border-slate-700 shrink-0 relative"
                    style={{ backgroundColor: activePhotoBgHex }}
                  >
                    <StudentAvatar
                      photoUrl={student.photo_url}
                      firstName={student.first_name}
                      lastName={student.last_name}
                      size="sm"
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-white truncate">
                      {student.first_name} {student.last_name}
                    </p>
                    <p className="text-[11px] text-slate-400 truncate">{student.school?.name}</p>
                    <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 rounded">
                      {student.student_id_number}
                    </span>
                  </div>
                </div>

                {/* Preview Button */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setPreviewPerson({
                      kind: 'student',
                      fullName: `${student.first_name} ${student.last_name}`,
                      idNumber: student.student_id_number,
                      schoolName: student.school?.name,
                      schoolAddress: student.school?.location_address || student.school?.address || 'Main Campus Gate',
                      schoolLandmark: student.school?.location_landmark,
                      logoUrl: student.school?.logo_url,
                      signatureUrl: student.school?.principal_signature_url,
                      photoUrl: student.photo_url,
                      className: student.class?.name || 'Class Assigned',
                      qrData: student.qr_code_data || `MYEDURIDE:${student.student_id_number}`,
                    });
                  }}
                  className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 transition-all cursor-pointer shrink-0"
                  title="Live Preview ID Card"
                >
                  <Eye className="w-4 h-4 text-emerald-400" />
                </button>
              </div>
            );
          })}

        {entityTab === 'staff' &&
          filteredStaff.map((member) => {
            const isSelected = selectedIds.has(member.id);
            const fullName = member.profile?.full_name || 'Staff Member';
            return (
              <div
                key={member.id}
                className={`bg-slate-950 border rounded-2xl p-4 transition-all flex items-center justify-between gap-3 ${
                  isSelected ? 'border-emerald-500 bg-slate-900/90 shadow-lg shadow-emerald-500/10' : 'border-slate-800 hover:border-slate-700'
                }`}
              >
                <div
                  onClick={() => toggleSelect(member.id)}
                  className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
                >
                  {isSelected ? (
                    <CheckSquare size={18} className="text-emerald-400 shrink-0" />
                  ) : (
                    <Square size={18} className="text-slate-600 shrink-0" />
                  )}

                  {/* Staff Photo Avatar with Customized Background Frame */}
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center overflow-hidden border border-slate-700 shrink-0 relative"
                    style={{ backgroundColor: activePhotoBgHex }}
                  >
                    <StudentAvatar
                      photoUrl={member.staff?.photo_url}
                      firstName={fullName.split(' ')[0]}
                      lastName={fullName.split(' ').slice(1).join(' ')}
                      size="sm"
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-white truncate">{fullName}</p>
                    <p className="text-[11px] text-slate-400 truncate">
                      {member.school?.name} · {member.job_title || member.role.replace('_', ' ')}
                    </p>
                    <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 rounded">
                      {member.staff?.staff_id_number || 'ID Auto-Generated'}
                    </span>
                  </div>
                </div>

                {/* Preview Button */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setPreviewPerson({
                      kind: 'staff',
                      fullName,
                      idNumber: member.staff?.staff_id_number || 'STAFF-1001',
                      roleLabel: member.job_title || member.role.replace('_', ' ').toUpperCase(),
                      schoolName: member.school?.name,
                      schoolAddress: member.school?.location_address || member.school?.address || 'Main Campus Gate',
                      schoolLandmark: member.school?.location_landmark,
                      logoUrl: member.school?.logo_url,
                      signatureUrl: member.school?.principal_signature_url,
                      photoUrl: member.staff?.photo_url,
                      qrData: member.staff?.qr_code_data || `MYEDURIDE:STAFF:${member.staff?.staff_id_number || '1001'}`,
                    });
                  }}
                  className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 transition-all cursor-pointer shrink-0"
                  title="Live Preview ID Card"
                >
                  <Eye className="w-4 h-4 text-emerald-400" />
                </button>
              </div>
            );
          })}
      </div>

      {filtered.length === 0 && (
        <div className="bg-slate-950 border border-slate-800 rounded-3xl p-12 text-center text-slate-400">
          <Building2 className="w-10 h-10 mx-auto text-slate-600 mb-2" />
          <p className="text-sm font-semibold">
            {entityTab === 'staff' ? 'No staff found for this filter' : 'No students found for this filter'}
          </p>
        </div>
      )}

      {/* LIVE HIGH-DEFINITION ID CARD PREVIEW MODAL */}
      {previewPerson && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-xl w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95 relative max-h-[92vh] overflow-y-auto">
            
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-slate-950 p-1 border border-slate-800 flex items-center justify-center shadow-md shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/images/eduride_emblem.png" alt="MyEduRide" className="w-full h-full object-contain" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Digital Brand ID Card Studio</h3>
                  <p className="text-[11px] text-slate-400">
                    {previewPerson.kind === 'staff' ? 'Official Staff Pass' : 'Verified Student Pass'} · ATM Smart Card &amp; Gate Verification
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPreviewPerson(null)}
                className="p-1.5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Design Selector: ATM Smart Card vs Classic Print Layout */}
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 gap-1">
                <button
                  type="button"
                  onClick={() => setPreviewDesign('atm')}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    previewDesign === 'atm'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <CreditCard size={13} />
                  <span>ATM Smart Card</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewDesign('classic')}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    previewDesign === 'classic'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <span>🪪 Classic Print Layout</span>
                </button>
              </div>

              <span className="text-[11px] text-emerald-400 font-mono font-bold bg-emerald-950/60 border border-emerald-500/30 px-2.5 py-1 rounded-full">
                Standard CR80 (85.6 × 54mm)
              </span>
            </div>

            {/* ATM SMART CARD PASS VIEW */}
            {previewDesign === 'atm' && (
              <div className="py-2 space-y-3 flex flex-col items-center">
                <div className="w-full bg-slate-950/70 border border-slate-800/80 rounded-3xl p-4 sm:p-5 flex flex-col items-center justify-center">
                  <AtmCardPass
                    cardType={previewPerson.kind === 'staff' ? 'staff' : 'student'}
                    cardholderName={previewPerson.fullName}
                    idNumber={previewPerson.idNumber}
                    photoUrl={previewPerson.photoUrl}
                    qrUrl={previewQrDataUrl}
                    qrPayload={previewPerson.qrData || `MYEDURIDE:${previewPerson.idNumber}`}
                    schoolName={previewPerson.schoolName || 'MYEDURIDE SCHOOL'}
                    schoolAddress={previewPerson.schoolAddress}
                    classNameOrRole={previewPerson.className || previewPerson.roleLabel}
                    validThru="09/27"
                    primaryColor={primaryColor}
                  />
                </div>

                <div className="w-full p-3 rounded-2xl bg-emerald-950/50 border border-emerald-500/30 text-emerald-200 text-xs leading-relaxed flex items-start gap-2.5">
                  <Sparkles className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <p>
                    <strong>ATM Smart Card Design:</strong> Features metallic gold EMV chip, contactless NFC wave, high-contrast gate scan QR on card back, and embossed styling. Tap the card or flip button to view both sides.
                  </p>
                </div>
              </div>
            )}

            {/* CLASSIC PRINT LAYOUT VIEW */}
            {previewDesign === 'classic' && (
              <div className="space-y-3">
                {/* Side Switcher Tabs */}
                <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 gap-1">
                  <button
                    type="button"
                    onClick={() => setPreviewSide('front')}
                    className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      previewSide === 'front'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Front Card
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewSide('back')}
                    className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      previewSide === 'back'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Back Card (School & Signature)
                  </button>
                </div>

                {/* FRONT CARD VIEW */}
                {previewSide === 'front' && (
                  <div className="space-y-2">
                    <div
                      className="w-full aspect-[85.6/54] rounded-2xl p-4 sm:p-5 flex flex-col justify-between relative overflow-hidden shadow-2xl border border-white/20 text-white"
                      style={{ backgroundColor: primaryColor }}
                    >
                      {/* Header Banner */}
                      <div className="flex items-center justify-between border-b border-white/20 pb-2">
                        <div className="min-w-0 flex-1 pr-2">
                          <h4 className="text-sm sm:text-base font-extrabold uppercase tracking-tight truncate">
                            {previewPerson.schoolName || 'MYEDURIDE SCHOOL'}
                          </h4>
                          <p className="text-[10px] text-white/80 truncate">{previewPerson.schoolAddress || 'Student Safety Platform'}</p>
                        </div>
                        <span className="text-[10px] font-extrabold bg-white text-slate-900 px-2.5 py-0.5 rounded-full uppercase shrink-0 shadow-xs">
                          {previewPerson.kind === 'staff' ? 'STAFF ID' : 'STUDENT ID'}
                        </span>
                      </div>

                      {/* Card Content Row */}
                      <div className="flex items-center gap-4 py-1">
                        
                        {/* Enlarged Photo Box */}
                        <div
                          className="w-24 sm:w-28 h-32 sm:h-36 rounded-2xl border-2 border-white/80 overflow-hidden flex items-center justify-center shrink-0 shadow-lg relative"
                          style={{ backgroundColor: activePhotoBgHex }}
                        >
                          <StudentAvatar
                            photoUrl={previewPerson.photoUrl}
                            firstName={previewPerson.fullName.split(' ')[0]}
                            lastName={previewPerson.fullName.split(' ').slice(1).join(' ')}
                            size="xl"
                            className="!w-full !h-full !rounded-2xl object-cover"
                          />
                        </div>

                        {/* Student/Staff Details */}
                        <div className="flex-1 space-y-1.5 text-xs min-w-0">
                          <div>
                            <span className="text-[9px] uppercase tracking-wider text-white/70 font-bold block">Full Name</span>
                            <strong className="text-sm sm:text-base font-extrabold block text-white truncate">{previewPerson.fullName}</strong>
                          </div>
                          <div>
                            <span className="text-[9px] uppercase tracking-wider text-white/70 font-bold block">ID Number</span>
                            <span className="text-xs sm:text-sm font-mono font-extrabold text-emerald-300 block">{previewPerson.idNumber}</span>
                          </div>
                          {previewPerson.kind === 'student' ? (
                            <div>
                              <span className="text-[9px] uppercase tracking-wider text-white/70 font-bold block">Class</span>
                              <span className="text-xs font-bold text-white/90">{previewPerson.className}</span>
                            </div>
                          ) : (
                            <div>
                              <span className="text-[9px] uppercase tracking-wider text-white/70 font-bold block">Role</span>
                              <span className="text-xs font-bold text-white/90">{previewPerson.roleLabel}</span>
                            </div>
                          )}
                        </div>

                        {/* Extended Scannable QR Code / Barcode Indicator */}
                        <div className="flex flex-col items-center shrink-0">
                          <div className="w-20 sm:w-24 h-20 sm:h-24 bg-white p-1.5 rounded-2xl flex items-center justify-center shadow-lg border border-white">
                            {previewQrDataUrl ? (
                              /* eslint-disable-next-line @next/next/no-img-element */
                              <img src={previewQrDataUrl} alt="Live Scannable QR" className="w-full h-full object-contain" />
                            ) : (
                              <QrCode className="w-full h-full text-slate-900" />
                            )}
                          </div>
                          <span className="text-[9px] font-mono font-bold text-white/90 mt-1">Gate Scannable</span>
                        </div>
                      </div>

                      {/* Card Footer Verification Bar */}
                      <div className="flex items-center justify-between border-t border-white/20 pt-1.5 text-[10px] text-white/80 font-mono">
                        <span>DISCL Gate Verified</span>
                        <span>MyEduRide Protection Network</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* BACK CARD VIEW */}
                {previewSide === 'back' && (
                  <div className="space-y-2">
                    <div className="w-full aspect-[85.6/54] rounded-2xl p-4 sm:p-5 flex flex-col justify-between relative overflow-hidden shadow-2xl border border-slate-700 bg-white text-slate-900">
                      
                      {/* Top Brand Banner */}
                      <div
                        className="flex items-center justify-between -mx-4 -mt-4 sm:-mx-5 sm:-mt-5 px-4 sm:px-5 py-2.5 text-white"
                        style={{ backgroundColor: primaryColor }}
                      >
                        <span className="text-xs font-black uppercase tracking-wider">
                          {previewPerson.schoolName || 'SCHOOL INFORMATION'}
                        </span>
                        <span className="text-[10px] font-bold text-white/80 uppercase">Card Back</span>
                      </div>

                      {/* Middle Information */}
                      <div className="space-y-2 py-1">
                        <div>
                          <span className="text-[9px] font-black uppercase tracking-wider text-slate-500 block">Campus Full Address</span>
                          <p className="text-xs font-bold text-slate-800 leading-snug">
                            {previewPerson.schoolAddress || 'Official School Campus Address'}
                          </p>
                          {previewPerson.schoolLandmark && (
                            <p className="text-[10px] text-emerald-700 font-semibold">📍 Landmark: {previewPerson.schoolLandmark}</p>
                          )}
                        </div>

                        {/* Dual Box: Authorised Signature & If Found */}
                        <div className="grid grid-cols-2 gap-3 pt-1">
                          
                          {/* Authorised Signature Box */}
                          <div className="border border-slate-300 rounded-xl p-2.5 bg-slate-50/70 flex flex-col justify-between min-h-[70px]">
                            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 block">Authorised Signature</span>
                            <div className="flex-1 flex items-center justify-center py-1">
                              {previewPerson.signatureUrl ? (
                                <div className="text-center">
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={photoSrc(previewPerson.signatureUrl)}
                                    alt="Principal Signature"
                                    className="h-9 max-h-9 object-contain mx-auto"
                                  />
                                  <span className="text-[9px] font-serif italic text-slate-600 block">Principal / Director</span>
                                </div>
                              ) : (
                                <div className="text-center">
                                  <span className="text-xs font-black tracking-wider text-emerald-800 uppercase block">
                                    Authorised by school
                                  </span>
                                  <span className="text-[8px] text-slate-400 font-medium">Official Campus Validation</span>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* If Found Return Instructions */}
                          <div className="border border-slate-300 rounded-xl p-2.5 bg-slate-50/70 flex flex-col justify-between min-h-[70px]">
                            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 block">If Found</span>
                            <p className="text-[10px] text-slate-700 leading-tight">
                              Please return this card to <strong className="font-extrabold">{previewPerson.schoolName || 'the school'}</strong> at the campus address shown.
                            </p>
                          </div>

                        </div>
                      </div>

                      {/* Bottom Security Notice Bar */}
                      <div
                        className="-mx-4 -mb-4 sm:-mx-5 sm:-mb-5 px-4 sm:px-5 py-1.5 text-center text-white text-[9px] font-bold uppercase tracking-wide"
                        style={{ backgroundColor: primaryColor }}
                      >
                        Official ID · Must be carried on campus at all times · Property of the school
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Modal Actions */}
            <div className="pt-2 flex items-center justify-between">
              <span className="text-[11px] text-slate-400">
                💡 Point phone camera or gate scanner at screen to test scan
              </span>
              <button
                type="button"
                onClick={() => setPreviewPerson(null)}
                className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold cursor-pointer transition-colors"
              >
                Close Preview
              </button>
            </div>

          </div>
        </div>
      )}


    </div>
  );
}
