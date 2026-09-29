'use client';

import { useState, useEffect, useRef } from 'react';
import {
  X,
  Camera,
  Upload,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  XCircle,
  TrendingUp,
  MapPin,
  Shield,
  Bus,
  Phone,
  User,
  School,
  Sparkles,
  Loader2,
  ChevronRight,
  Info,
  CalendarDays,
} from 'lucide-react';
import { toast } from 'sonner';
import { photoSrc } from '@/lib/photo';
import { formatTimeLagos, todayInLagos } from '@/lib/timezone';
import { DAY_STATUS_LABELS } from '@/lib/attendance/status';
import StudentAvatar from '@/components/shared/StudentAvatar';

interface ChildProfileAttendanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  child: any;
  allChildren?: any[];
  onSelectChild?: (childId: string) => void;
  onPhotoUpdated?: (childId: string, newPhotoUrl: string) => void;
}

export default function ChildProfileAttendanceModal({
  isOpen,
  onClose,
  child,
  allChildren = [],
  onSelectChild,
  onPhotoUpdated,
}: ChildProfileAttendanceModalProps) {
  const [activeTab, setActiveTab] = useState<'profile' | 'attendance'>('profile');
  const [filterType, setFilterType] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('weekly');
  const [selectedDate, setSelectedDate] = useState<string>(todayInLagos());
  const [attendanceData, setAttendanceData] = useState<any>(null);
  const [attendanceLoading, setAttendanceLoading] = useState<boolean>(false);
  const [uploadingPhoto, setUploadingPhoto] = useState<boolean>(false);
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setPreviewPhoto(null);
  }, [child?.id]);

  useEffect(() => {
    if (isOpen && child?.id) {
      loadAttendance();
    }
  }, [isOpen, child?.id, filterType, selectedDate]);

  if (!isOpen || !child) return null;

  const loadAttendance = async () => {
    if (!child?.id) return;
    setAttendanceLoading(true);
    try {
      const params = new URLSearchParams({
        student_id: child.id,
        type: filterType,
        date: selectedDate,
      });
      const res = await fetch(`/api/parent/attendance-history?${params}`, {
        credentials: 'include',
        cache: 'no-store',
      });
      const json = await res.json();
      if (res.ok) {
        setAttendanceData(json);
      } else {
        toast.error(json.error || 'Could not load attendance logs');
      }
    } catch {
      toast.error('Network error loading attendance logs');
    } finally {
      setAttendanceLoading(false);
    }
  };

  // Handle Photo File Upload
  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file (PNG, JPG, WEBP)');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Photo size should be less than 5MB');
      return;
    }

    setUploadingPhoto(true);

    try {
      // Compress and resize client-side to ~400x400 max JPEG base64
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (readerEvent) => {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            const MAX_DIM = 400;
            let width = img.width;
            let height = img.height;

            if (width > height) {
              if (width > MAX_DIM) {
                height = Math.round((height * MAX_DIM) / width);
                width = MAX_DIM;
              }
            } else {
              if (height > MAX_DIM) {
                width = Math.round((width * MAX_DIM) / height);
                height = MAX_DIM;
              }
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(img, 0, 0, width, height);
              resolve(canvas.toDataURL('image/jpeg', 0.88));
            } else {
              resolve(readerEvent.target?.result as string);
            }
          };
          img.onerror = reject;
          img.src = readerEvent.target?.result as string;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      setPreviewPhoto(base64);

      // Send to server
      const res = await fetch('/api/students/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          id: child.id,
          photo_base64: base64,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(`Photo for ${child.first_name} updated successfully!`);
        if (onPhotoUpdated) {
          onPhotoUpdated(child.id, base64);
        }
      } else {
        toast.error(data.error || 'Failed to update photo');
        setPreviewPhoto(null);
      }
    } catch (err: any) {
      toast.error(err.message || 'Error processing photo');
      setPreviewPhoto(null);
    } finally {
      setUploadingPhoto(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const fullName = `${child.first_name || ''} ${child.last_name || ''}`.trim() || 'Student';
  const classNameStr = child.class?.name || child.class_name || 'Enrolled Student';
  const schoolName = child.school?.name || 'School Campus';
  const currentPhoto = previewPhoto || child.photo_url;

  const summary = attendanceData?.summary || {
    total_school_days: 0,
    present: 0,
    late: 0,
    absent: 0,
    attendance_pct: 0,
  };

  const calendarLogs = attendanceData?.calendar || [];

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-3xl w-full shadow-2xl border border-slate-200/90 overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200">
        
        {/* MODAL HEADER */}
        <div className="bg-gradient-to-r from-emerald-800 via-teal-900 to-slate-900 p-5 sm:p-6 text-white relative shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-2xl bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer"
            title="Close"
          >
            <X size={18} />
          </button>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            
            {/* Student Avatar with Direct Upload Trigger */}
            <div className="flex items-center gap-4">
              <div className="relative group shrink-0">
                {currentPhoto ? (
                  <img
                    src={photoSrc(currentPhoto) || ''}
                    alt={fullName}
                    className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl object-cover border-4 border-white/90 shadow-xl bg-slate-800"
                  />
                ) : (
                  <StudentAvatar
                    photoUrl={null}
                    firstName={child.first_name}
                    lastName={child.last_name}
                    size="xl"
                    className="border-4 border-white/90 shadow-xl"
                  />
                )}

                {/* Upload photo overlay badge */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingPhoto}
                  className="absolute -bottom-2 -right-2 p-2 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-white shadow-lg transition-transform active:scale-90 cursor-pointer border-2 border-slate-900 flex items-center justify-center"
                  title="Upload / Change Student Photo"
                >
                  {uploadingPhoto ? (
                    <Loader2 size={16} className="animate-spin text-white" />
                  ) : (
                    <Camera size={16} />
                  )}
                </button>

                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handlePhotoSelect}
                  accept="image/png, image/jpeg, image/jpg, image/webp"
                  className="hidden"
                />
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider bg-emerald-400/20 text-emerald-300 border border-emerald-400/30 px-2 py-0.5 rounded-full">
                    {child.student_id_number || 'STUDENT'}
                  </span>
                  {child.is_active && (
                    <span className="text-[10px] font-bold text-emerald-300 flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      Active Student
                    </span>
                  )}
                </div>

                <h2 className="text-xl sm:text-2xl font-black text-white mt-1 leading-tight">
                  {fullName}
                </h2>
                <p className="text-xs text-emerald-100/90 font-semibold mt-0.5">
                  Class: {classNameStr} • {schoolName}
                </p>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-[11px] font-bold text-emerald-300 hover:text-white mt-2 flex items-center gap-1 underline underline-offset-2 transition-colors cursor-pointer"
                >
                  <Upload size={12} />
                  <span>{currentPhoto ? 'Change photo' : 'Upload student photo'}</span>
                </button>
              </div>
            </div>

            {/* Child Switcher if multiple children */}
            {allChildren.length > 1 && onSelectChild && (
              <div className="sm:self-end bg-white/10 p-1.5 rounded-2xl border border-white/15 backdrop-blur-xs">
                <span className="text-[10px] font-bold text-emerald-200 block px-2 mb-1">
                  Switch Child
                </span>
                <select
                  value={child.id}
                  onChange={(e) => onSelectChild(e.target.value)}
                  className="bg-slate-900 text-white text-xs font-bold px-3 py-1.5 rounded-xl border border-white/20 focus:outline-none cursor-pointer"
                >
                  {allChildren.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.first_name} {c.last_name} ({c.class?.name || c.class_name || 'Student'})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* TAB BAR */}
          <div className="flex items-center gap-2 mt-6 pt-2 border-t border-white/15">
            <button
              type="button"
              onClick={() => setActiveTab('profile')}
              className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                activeTab === 'profile'
                  ? 'bg-white text-slate-900 shadow-md font-black'
                  : 'text-emerald-100 hover:text-white hover:bg-white/10'
              }`}
            >
              Child Information
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('attendance')}
              className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'attendance'
                  ? 'bg-white text-slate-900 shadow-md font-black'
                  : 'text-emerald-100 hover:text-white hover:bg-white/10'
              }`}
            >
              <Calendar size={14} />
              <span>Detailed Attendance Record</span>
            </button>
          </div>
        </div>

        {/* MODAL BODY (Scrollable) */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-6 text-slate-800">
          
          {/* ========================================================================= */}
          {/* TAB 1: CHILD INFORMATION */}
          {/* ========================================================================= */}
          {activeTab === 'profile' && (
            <div className="space-y-5 animate-in fade-in-50 duration-200">
              
              {/* Profile Overview Banner */}
              <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-2xl p-4 flex items-start gap-3">
                <Shield className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-black text-emerald-950">Verified Child Profile</h4>
                  <p className="text-[11px] text-emerald-800/90 mt-0.5 leading-relaxed">
                    Official biometric and school transit profile. Linked to your parent emergency contacts and doorstep pickup authorizations.
                  </p>
                </div>
              </div>

              {/* Identity & School Details Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* School & Class Information */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
                  <div className="flex items-center gap-2 pb-2 border-b border-slate-200">
                    <School className="w-4 h-4 text-emerald-600" />
                    <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                      Academic Enrollment
                    </h3>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-medium">Student Full Name:</span>
                      <strong className="text-slate-900 font-bold">{fullName}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-medium">Student ID Number:</span>
                      <strong className="font-mono text-emerald-700 font-bold">{child.student_id_number || '—'}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-medium">Class / Grade:</span>
                      <strong className="text-slate-900 font-bold">{classNameStr}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-medium">School Campus:</span>
                      <strong className="text-slate-900 font-bold">{schoolName}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-medium">Status:</span>
                      <span className="font-bold text-emerald-600">Enrolled & Active</span>
                    </div>
                  </div>
                </div>

                {/* Transit & Escort Logistics */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
                  <div className="flex items-center gap-2 pb-2 border-b border-slate-200">
                    <Bus className="w-4 h-4 text-teal-600" />
                    <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                      Transit & Escort Logistics
                    </h3>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-medium">Assigned Escort:</span>
                      <strong className="text-slate-900 font-bold">
                        {child.escort_name || 'Verified School Escort'}
                      </strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-medium">Corridor Route:</span>
                      <strong className="text-slate-900 font-bold">
                        {child.route_name || 'Direct School Line'}
                      </strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-medium">Assigned Vehicle:</span>
                      <strong className="text-slate-900 font-bold">
                        {child.vehicle_model || 'School Bus Fleet'}
                      </strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-medium">Trip Cancellation:</span>
                      <span className="text-xs font-bold text-slate-700">
                        {child.is_canceled_today ? '🚫 Canceled for Today' : '✅ Active on Schedule'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Doorstep Home Address */}
                <div className="md:col-span-2 p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-rose-600" />
                      <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                        Doorstep Home Address & GPS Pin
                      </h3>
                    </div>
                    {child.house_lat && child.house_lng && (
                      <span className="text-[10px] font-mono bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
                        GPS Locked
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-slate-500 font-medium block">Pinned Address:</span>
                      <p className="font-bold text-slate-900 mt-0.5">
                        {child.house_address || 'Address not yet pinned. Please use "Pin Child House Location" on home screen.'}
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-500 font-medium block">Landmark / Driver Notes:</span>
                      <p className="font-bold text-slate-900 mt-0.5">
                        {child.house_landmark || child.house_notes || 'Near estate gate / security post'}
                      </p>
                    </div>
                  </div>
                </div>

              </div>

              {/* Switch to Detailed Attendance button */}
              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => setActiveTab('attendance')}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs flex items-center gap-2 shadow-sm transition-all cursor-pointer"
                >
                  <span>View Full Attendance History</span>
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 2: FULL DETAILED ATTENDANCE RECORD */}
          {/* ========================================================================= */}
          {activeTab === 'attendance' && (
            <div className="space-y-5 animate-in fade-in-50 duration-200">
              
              {/* Filter Controls Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <div className="flex items-center gap-2">
                  <CalendarDays className="w-5 h-5 text-emerald-600 shrink-0" />
                  <div>
                    <h3 className="text-xs font-black text-slate-900">Attendance Filter</h3>
                    <p className="text-[11px] text-slate-500 font-medium">Select timeframe to inspect records</p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center bg-white border border-slate-200 p-1 rounded-xl text-xs font-bold shadow-2xs">
                    {(['daily', 'weekly', 'monthly', 'yearly'] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setFilterType(t)}
                        className={`px-3 py-1 rounded-lg capitalize transition-all cursor-pointer ${
                          filterType === t
                            ? 'bg-emerald-600 text-white shadow-xs font-black'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-1.5 bg-white border border-slate-200 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-800 shadow-2xs">
                    <Calendar size={13} className="text-emerald-600" />
                    <input
                      type="date"
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      className="bg-transparent font-bold text-xs focus:outline-none cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              {/* 4 Summary KPI Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                
                {/* Attendance Rate */}
                <div className="bg-emerald-50/70 border border-emerald-200 p-3.5 rounded-2xl flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">Rate</span>
                    <TrendingUp size={16} className="text-emerald-600" />
                  </div>
                  <strong className="text-2xl font-black text-emerald-950 mt-1">
                    {summary.attendance_pct}%
                  </strong>
                  <span className="text-[10px] font-bold text-emerald-700">Target &gt; 90%</span>
                </div>

                {/* Present Count */}
                <div className="bg-blue-50/70 border border-blue-200 p-3.5 rounded-2xl flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-blue-800 uppercase tracking-wider">Present</span>
                    <CheckCircle2 size={16} className="text-blue-600" />
                  </div>
                  <strong className="text-2xl font-black text-blue-950 mt-1">
                    {summary.present}
                  </strong>
                  <span className="text-[10px] font-bold text-blue-700">On-Time Days</span>
                </div>

                {/* Late Count */}
                <div className="bg-amber-50/70 border border-amber-200 p-3.5 rounded-2xl flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider">Late</span>
                    <Clock size={16} className="text-amber-600" />
                  </div>
                  <strong className="text-2xl font-black text-amber-950 mt-1">
                    {summary.late}
                  </strong>
                  <span className="text-[10px] font-bold text-amber-700">Late Arrivals</span>
                </div>

                {/* Absent / At Home */}
                <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-2xl flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Absent</span>
                    <XCircle size={16} className="text-slate-500" />
                  </div>
                  <strong className="text-2xl font-black text-slate-900 mt-1">
                    {summary.absent}
                  </strong>
                  <span className="text-[10px] font-bold text-slate-500">School Days</span>
                </div>

              </div>

              {/* Detailed Attendance Records Table */}
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                    Attendance Log Details
                  </h3>
                  <span className="text-[10px] text-slate-500 font-bold font-mono">
                    Timezone: Africa/Lagos
                  </span>
                </div>

                {attendanceLoading ? (
                  <div className="py-12 text-center text-slate-400">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-600" />
                    <p className="text-xs font-bold text-slate-600">Loading attendance history...</p>
                  </div>
                ) : filterType === 'daily' ? (
                  /* Single Day View */
                  <div className="p-5 space-y-3">
                    <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 block uppercase">Selected Date</span>
                        <h4 className="text-sm font-black text-slate-900">{attendanceData?.date || selectedDate}</h4>
                      </div>
                      <span className="text-xs font-black px-3 py-1 rounded-full bg-emerald-100 text-emerald-800">
                        {(DAY_STATUS_LABELS as any)[attendanceData?.status] || attendanceData?.status || 'Scheduled'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                        <span className="text-slate-500 font-bold block">Morning Gate Arrival:</span>
                        <strong className="text-slate-900 text-sm mt-1 block">
                          {formatTimeLagos(attendanceData?.check_in_time) || '—'}
                        </strong>
                      </div>
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                        <span className="text-slate-500 font-bold block">Afternoon Gate Departure:</span>
                        <strong className="text-slate-900 text-sm mt-1 block">
                          {formatTimeLagos(attendanceData?.check_out_time) || '—'}
                        </strong>
                      </div>
                    </div>
                  </div>
                ) : calendarLogs.length === 0 ? (
                  <div className="py-10 text-center text-slate-400 text-xs">
                    No attendance records logged for this timeframe.
                  </div>
                ) : (
                  /* Calendar Table View */
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-100 bg-slate-50/50 text-[10px] uppercase font-bold text-slate-400">
                          <th className="px-4 py-2.5">Date</th>
                          <th className="px-4 py-2.5">Status</th>
                          <th className="px-4 py-2.5">Morning Arrival</th>
                          <th className="px-4 py-2.5">Afternoon Departure</th>
                          <th className="px-4 py-2.5">Verification</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium">
                        {calendarLogs.map((log: any) => {
                          const dateObj = new Date(`${log.date}T12:00:00`);
                          const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
                          const isWeekend = log.is_weekend;
                          const isToday = log.date === todayInLagos();

                          let badgeColor = 'bg-slate-100 text-slate-600 border-slate-200';
                          let label = (DAY_STATUS_LABELS as any)[log.status] || log.status;

                          if (isWeekend) {
                            badgeColor = 'bg-slate-100 text-slate-500 border-slate-200';
                            label = '🏡 Weekend (At Home)';
                          } else if (log.status === 'on_time') {
                            badgeColor = 'bg-emerald-50 text-emerald-700 border-emerald-200';
                            label = '✅ Present (On-Time)';
                          } else if (log.status === 'late') {
                            badgeColor = 'bg-amber-50 text-amber-700 border-amber-200';
                            label = `⚠️ Late (${log.minutes_late || 15}m)`;
                          } else if (log.status === 'absent') {
                            badgeColor = 'bg-rose-50 text-rose-700 border-rose-200';
                            label = '❌ Absent';
                          }

                          return (
                            <tr
                              key={log.date}
                              className={`hover:bg-slate-50/80 transition-colors ${
                                isToday ? 'bg-emerald-50/30' : ''
                              }`}
                            >
                              <td className="px-4 py-3 font-bold text-slate-900">
                                <span>{dayName}, {log.date}</span>
                                {isToday && (
                                  <span className="ml-2 text-[9px] bg-emerald-600 text-white font-black px-1.5 py-0.5 rounded">
                                    TODAY
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-3">
                                <span className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full border ${badgeColor}`}>
                                  {label}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-slate-700 font-mono">
                                {formatTimeLagos(log.check_in_time) || (isWeekend ? '—' : 'Not marked')}
                              </td>
                              <td className="px-4 py-3 text-slate-700 font-mono">
                                {formatTimeLagos(log.check_out_time) || '—'}
                              </td>
                              <td className="px-4 py-3 text-[11px] text-slate-500">
                                {log.check_in_time
                                  ? 'GPS Geofence Verified'
                                  : isWeekend
                                  ? 'Weekend Home'
                                  : 'School Schedule'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

              </div>

            </div>
          )}

        </div>

        {/* MODAL FOOTER */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <p className="text-[11px] text-slate-500">
            Student: <strong className="text-slate-800">{fullName}</strong> ({child.student_id_number || 'ID Linked'})
          </p>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
}
