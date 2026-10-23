// @ts-nocheck
'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { downloadIdCardsPdf } from '@/lib/id-card/download';
import { exportCardPdfFromDom } from '@/lib/id-card/client-pdf';
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
  RefreshCw,
} from 'lucide-react';
import AtmCardPass from '@/components/id-card/AtmCardPass';
import ClassicCardPass from '@/components/id-card/ClassicCardPass';
import { photoSrc } from '@/lib/photo';
import QRCode from 'qrcode';
import { toast } from 'sonner';

const STAFF_ACCESS_ROLES = ['staff', 'teacher', 'gate_officer', 'school_admin'];

const COLOR_PRESETS = [
  { label: 'MyEduRide Brand', primary: '#0C2340', accent: '#28A745' },
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
  { label: 'Match Primary', value: 'PRIMARY_MATCH', colorBox: 'bg-gradient-to-r from-[#0C2340] to-[#28A745]' },
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

  // ID Card Styling Studio State (Defaults to MyEduRide Brand Navy and Green)
  const [primaryColor, setPrimaryColor] = useState('#0C2340');
  const [accentColor, setAccentColor] = useState('#28A745');
  const [photoBgColor, setPhotoBgColor] = useState('#FFFFFF');
  const [removePhotoBg, setRemovePhotoBg] = useState(false);
  const [showStudioPanel, setShowStudioPanel] = useState(true);

  // Live Card Preview Modal
  const [previewPerson, setPreviewPerson] = useState<any | null>(null);
  const [previewFormat, setPreviewFormat] = useState<'atm' | 'classic'>('atm');
  const [previewViewMode, setPreviewViewMode] = useState<'both' | 'front' | 'back' | '3d'>('both');
  const [previewQrDataUrl, setPreviewQrDataUrl] = useState<string>('');
  const [printFormat, setPrintFormat] = useState<'atm' | 'classic'>('atm');

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
    setPreviewViewMode('both');
  }, [previewPerson]);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    setSelectedIds(new Set());
    setSearchQuery('');
  }, [entityTab]);

  const [loadError, setLoadError] = useState<string | null>(null);

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
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch('/api/super-admin/id-cards', {
        cache: 'no-store',
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to load ID card data');
      }

      setSchools(data.schools || []);
      setStudents(data.students || []);
      setStaff(data.staff || []);
    } catch (err: any) {
      console.error(err);
      const msg = err?.message || 'Failed to load ID card data';
      setLoadError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
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
      fileName: `${entityTab}_id_cards_${printFormat}.pdf`,
      primary_color: primaryColor,
      accent_color: accentColor,
      photo_bg_color: activePhotoBgHex,
      card_format: printFormat,
    });

    if (result.ok) toast.success(`PDF generated in ${printFormat === 'classic' ? 'Classic Print' : 'ATM Smart Card'} format — print at 100% scale`);
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
          {loadError && (
            <button
              type="button"
              onClick={loadData}
              className="px-3.5 py-2 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 hover:bg-amber-500/30 text-xs font-bold flex items-center gap-2 transition-all cursor-pointer"
            >
              <RefreshCw className="w-4 h-4 animate-spin-reverse" />
              <span>Retry Load</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowStudioPanel(!showStudioPanel)}
            className="px-3.5 py-2 rounded-xl bg-slate-800 border border-slate-700 hover:bg-slate-700 text-xs font-bold flex items-center gap-2 transition-all cursor-pointer"
          >
            <Sliders className="w-4 h-4 text-emerald-400" />
            <span>{showStudioPanel ? 'Hide Studio Controls' : 'Customize Card Theme'}</span>
          </button>

          {/* Print Format Selector */}
          <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 gap-1 shrink-0">
            <button
              type="button"
              onClick={() => setPrintFormat('atm')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                printFormat === 'atm'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="ATM Smart Card (New Format with gold chip, orbit photo & emergency contacts)"
            >
              <CreditCard size={13} />
              <span className="hidden sm:inline">ATM Smart Card</span>
              <span className="sm:hidden">ATM</span>
            </button>
            <button
              type="button"
              onClick={() => setPrintFormat('classic')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                printFormat === 'classic'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Classic Print Layout (Retained original format with bold barcode)"
            >
              <FileBadge2 size={13} />
              <span className="hidden sm:inline">Classic Print Layout</span>
              <span className="sm:hidden">Classic</span>
            </button>
          </div>

          <button
            type="button"
            onClick={handleDownload}
            disabled={selectedIds.size === 0 || generating}
            className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs transition-all shadow-lg shadow-emerald-600/30 flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            <span>{generating ? 'Generating PDF...' : `Download ${printFormat === 'classic' ? 'Classic' : 'ATM'} PDF (${selectedIds.size})`}</span>
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
                    <p className="text-[11px] text-slate-400 truncate flex items-center gap-1.5">
                      <span>{student.school?.name}</span>
                      {!student.school?.logo_url && (
                        <span className="text-[9px] text-amber-300 bg-amber-950/70 border border-amber-500/40 px-1.5 py-0.2 rounded font-medium">
                          Add School Logo
                        </span>
                      )}
                    </p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 rounded">
                        {student.student_id_number}
                      </span>
                      {student.guardian_name && student.guardian_name !== 'Not Assigned' && (
                        <span className="text-[9.5px] text-slate-300 bg-slate-900 border border-slate-800 px-1.5 py-0.5 rounded truncate max-w-[150px]" title={`Guardian: ${student.guardian_name} (${student.guardian_phone || 'No phone'})`}>
                          👤 {student.guardian_name}
                        </span>
                      )}
                      {student.home_stop && student.home_stop !== 'Campus Gate' && (
                        <span className="text-[9.5px] text-teal-300 bg-teal-950/60 border border-teal-500/30 px-1.5 py-0.5 rounded truncate max-w-[150px]" title={`Home Stop: ${student.home_stop}`}>
                          🚏 {student.home_stop}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Preview Button */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    const schoolObj = student.school || schools.find((s) => s.id === student.school_id) || (selectedSchool !== 'all' ? schools.find((s) => s.id === selectedSchool) : schools[0]);
                    setPreviewPerson({
                      kind: 'student',
                      id: student.id,
                      schoolId: student.school?.id || student.school_id || schoolObj?.id,
                      fullName: `${student.first_name} ${student.last_name}`,
                      idNumber: student.student_id_number,
                      schoolName: schoolObj?.name || student.school?.name || 'MYEDURIDE PARTNER SCHOOL',
                      schoolAddress: schoolObj?.location_address || schoolObj?.address || student.school?.location_address || student.school?.address || 'Main Campus Gate',
                      schoolLandmark: schoolObj?.location_landmark || student.school?.location_landmark,
                      schoolPhone: schoolObj?.phone || student.school?.phone,
                      logoUrl: schoolObj?.logo_url || student.school?.logo_url,
                      signatureUrl: schoolObj?.principal_signature_url || schoolObj?.signature_url || student.school?.principal_signature_url || student.school?.signature_url,
                      photoUrl: student.photo_url,
                      className: student.class?.name || 'Class Assigned',
                      gradeSection: student.class?.name || 'Class Assigned',
                      routeCode: student.route_code || student.custom_fields?.route || student.route || 'R-CAMPUS',
                      guardianName: student.guardian_name || student.custom_fields?.guardian_name || student.parent_name || 'Not Assigned',
                      guardianPhone: student.guardian_phone || student.custom_fields?.emergency_phone || student.parent_phone || 'Not Available',
                      homeStop: student.home_stop || student.house_landmark || student.house_address || student.custom_fields?.home_stop || 'Campus Gate',
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
                    const schoolObj = member.school || schools.find((s) => s.id === member.school_id) || (selectedSchool !== 'all' ? schools.find((s) => s.id === selectedSchool) : schools[0]);
                    setPreviewPerson({
                      kind: 'staff',
                      id: member.id,
                      schoolId: member.school?.id || member.school_id || schoolObj?.id,
                      fullName,
                      idNumber: member.staff?.staff_id_number || 'STAFF-1001',
                      roleLabel: member.job_title || member.role.replace('_', ' ').toUpperCase(),
                      schoolName: schoolObj?.name || member.school?.name || 'MYEDURIDE PARTNER SCHOOL',
                      schoolAddress: schoolObj?.location_address || schoolObj?.address || member.school?.location_address || member.school?.address || 'Main Campus Gate',
                      schoolLandmark: schoolObj?.location_landmark || member.school?.location_landmark,
                      schoolPhone: schoolObj?.phone || member.school?.phone,
                      logoUrl: schoolObj?.logo_url || member.school?.logo_url,
                      signatureUrl: schoolObj?.principal_signature_url || schoolObj?.signature_url || member.school?.principal_signature_url || member.school?.signature_url,
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
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-4xl sm:max-w-5xl w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95 relative max-h-[94vh] overflow-y-auto">
            
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-slate-950 p-1 border border-slate-800 flex items-center justify-center shadow-md shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/images/eduride_emblem.png" alt="MyEduRide" className="w-full h-full object-contain" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Digital Brand ID Card Studio</h3>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-[11px] text-slate-400">
                      {previewPerson.kind === 'staff' ? 'Official Staff Pass' : 'Verified Student Pass'} · ATM Smart Card &amp; Classic Print Layout
                    </p>
                    {!previewPerson.logoUrl ? (
                      <span className="text-[9px] font-bold text-amber-300 bg-amber-950/80 border border-amber-500/50 px-2 py-0.5 rounded-full">
                        ⚠️ Add School Logo
                      </span>
                    ) : (
                      <span className="text-[9px] font-bold text-emerald-300 bg-emerald-950/80 border border-emerald-500/50 px-2 py-0.5 rounded-full">
                        ✓ School Logo Verified
                      </span>
                    )}
                    {!previewPerson.signatureUrl ? (
                      <span className="text-[9px] font-bold text-sky-300 bg-sky-950/80 border border-sky-500/50 px-2 py-0.5 rounded-full">
                        Principal Signature Pending
                      </span>
                    ) : (
                      <span className="text-[9px] font-bold text-emerald-300 bg-emerald-950/80 border border-emerald-500/50 px-2 py-0.5 rounded-full">
                        ✓ Principal Signature Present
                      </span>
                    )}
                  </div>
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

            {/* Layout Format Switcher: ATM Smart Card vs Classic Print Layout */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex bg-slate-950 p-1 rounded-2xl border border-slate-800 gap-1 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setPreviewFormat('atm')}
                  className={`flex-1 sm:flex-initial px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                    previewFormat === 'atm'
                      ? 'bg-emerald-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <CreditCard size={15} />
                  <span>ATM Smart Card (New Format)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewFormat('classic')}
                  className={`flex-1 sm:flex-initial px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                    previewFormat === 'classic'
                      ? 'bg-emerald-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <FileBadge2 size={15} />
                  <span>Classic Print Layout (Retained)</span>
                </button>
              </div>

              {/* View Mode Selector: Dual Side, Front, Back (Barcode), Interactive 3D */}
              <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 gap-1 flex-wrap w-full sm:w-auto justify-center">
                <button
                  type="button"
                  onClick={() => setPreviewViewMode('both')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    previewViewMode === 'both'
                      ? 'bg-slate-800 text-white shadow-xs border border-slate-700'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <span>Dual View</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewViewMode('front')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    previewViewMode === 'front'
                      ? 'bg-slate-800 text-white shadow-xs border border-slate-700'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <span>Front</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewViewMode('back')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    previewViewMode === 'back'
                      ? 'bg-slate-800 text-white shadow-xs border border-slate-700'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <span>Back (Barcode)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewViewMode('3d')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    previewViewMode === '3d'
                      ? 'bg-slate-800 text-white shadow-xs border border-slate-700'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <CreditCard size={13} />
                  <span>3D Flip</span>
                </button>
              </div>
            </div>

            {/* UNIFIED HIGH-DEFINITION ID CARD VIEW CANVAS */}
            <div className="py-2 space-y-4">
              <div className="w-full bg-slate-950/70 border border-slate-800/80 rounded-3xl p-4 sm:p-6 flex flex-col items-center justify-center">
                {previewFormat === 'atm' ? (
                  <AtmCardPass
                    viewMode={previewViewMode}
                    cardType={previewPerson.kind === 'staff' ? 'staff' : 'student'}
                    cardholderName={previewPerson.fullName}
                    idNumber={previewPerson.idNumber}
                    photoUrl={previewPerson.photoUrl}
                    qrUrl={previewQrDataUrl}
                    qrPayload={previewPerson.qrData || `MYEDURIDE:${previewPerson.idNumber}`}
                    schoolName={previewPerson.schoolName || 'MYEDURIDE PARTNER SCHOOL'}
                    schoolAddress={previewPerson.schoolAddress}
                    schoolPhone={previewPerson.schoolPhone}
                    logoUrl={previewPerson.logoUrl}
                    classNameOrRole={previewPerson.className || previewPerson.roleLabel}
                    gradeSection={previewPerson.gradeSection || previewPerson.className || previewPerson.roleLabel}
                    routeCode={previewPerson.routeCode}
                    guardianName={previewPerson.guardianName}
                    guardianPhone={previewPerson.guardianPhone}
                    homeStop={previewPerson.homeStop}
                    signatureUrl={previewPerson.signatureUrl}
                    validThru="07/27"
                    primaryColor={primaryColor || '#0C3B5E'}
                    accentColor={accentColor || '#10B981'}
                  />
                ) : (
                  <ClassicCardPass
                    viewMode={previewViewMode}
                    cardType={previewPerson.kind === 'staff' ? 'staff' : 'student'}
                    cardholderName={previewPerson.fullName}
                    idNumber={previewPerson.idNumber}
                    photoUrl={previewPerson.photoUrl}
                    qrUrl={previewQrDataUrl}
                    qrPayload={previewPerson.qrData || `MYEDURIDE:${previewPerson.idNumber}`}
                    schoolName={previewPerson.schoolName || 'MYEDURIDE PARTNER SCHOOL'}
                    schoolAddress={previewPerson.schoolAddress}
                    schoolLandmark={previewPerson.schoolLandmark}
                    schoolPhone={previewPerson.schoolPhone}
                    logoUrl={previewPerson.logoUrl}
                    classNameOrRole={previewPerson.className || previewPerson.roleLabel}
                    gradeSection={previewPerson.gradeSection || previewPerson.className || previewPerson.roleLabel}
                    signatureUrl={previewPerson.signatureUrl}
                    primaryColor={primaryColor || '#0C2340'}
                    accentColor={accentColor || '#28A745'}
                  />
                )}
              </div>

              <div className="w-full p-3.5 rounded-2xl bg-slate-950 border border-slate-800 text-slate-300 text-xs leading-relaxed flex items-start justify-between gap-3 flex-wrap">
                <div className="flex items-start gap-2.5 max-w-xl">
                  <Sparkles className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <p>
                    {previewFormat === 'atm' ? (
                      <>
                        <strong className="text-emerald-400">ATM Smart Card (New Format):</strong> Features metallic EMV chip, contactless RFID symbol, embossed card numbering, emergency contacts, and <strong>bold Code 128 barcode</strong> on card back for laser &amp; mobile scanning.
                      </>
                    ) : (
                      <>
                        <strong className="text-emerald-400">Classic Print Layout (Retained):</strong> Preserves the full-bleed school banner, enlarged portrait frame, signature authorization panel, and <strong>bold Code 128 barcode</strong> on card back.
                      </>
                    )}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      const schoolId = previewPerson.schoolId || (schools.find((s) => s.name === previewPerson.schoolName)?.id) || (selectedSchool !== 'all' ? selectedSchool : schools[0]?.id);
                      if (!schoolId) {
                        toast.error('School ID not found');
                        return;
                      }
                      const fileName = `${previewPerson.fullName.replace(/\s+/g, '_')}_${previewFormat}_card.pdf`;
                      toast.info(`Generating exact ${previewFormat === 'classic' ? 'Classic' : 'ATM'} Card PDF...`);

                      // 1. Direct exact DOM-to-PDF export: captures the exact rendered preview pixel-for-pixel
                      const domSuccess = await exportCardPdfFromDom({
                        format: previewFormat,
                        fileName,
                      });

                      if (domSuccess) {
                        toast.success('Card PDF downloaded successfully (exact preview replica)');
                        return;
                      }

                      // 2. Fallback to server route if DOM capture is not available
                      const res = await downloadIdCardsPdf({
                        school_id: schoolId,
                        student_ids: previewPerson.kind === 'student' ? [previewPerson.id || selectedIds.values().next().value] : [],
                        staff_role_ids: previewPerson.kind === 'staff' ? [previewPerson.id || selectedIds.values().next().value] : [],
                        fileName,
                        primary_color: primaryColor,
                        accent_color: accentColor,
                        photo_bg_color: activePhotoBgHex,
                        card_format: previewFormat,
                      });
                      if (res.ok) toast.success('Card PDF downloaded successfully');
                      else toast.error(res.error || 'Failed to download card');
                    }}
                    className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
                  >
                    <Download size={13} />
                    <span>Download This {previewFormat === 'classic' ? 'Classic' : 'ATM'} Card</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="pt-2 flex items-center justify-between border-t border-slate-800">
              <span className="text-[11px] text-slate-400">
                💡 Point phone camera or gate scanner at screen to test scan barcode &amp; QR
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
