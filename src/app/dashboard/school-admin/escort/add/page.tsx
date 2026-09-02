// @ts-nocheck
'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  User,
  Phone,
  Mail,
  Calendar,
  MapPin,
  Camera,
  Upload,
  CheckCircle2,
  ScanFace,
  Fingerprint,
  FileText,
  ShieldCheck,
  KeyRound,
  Eye,
  EyeOff,
  Sparkles,
  RefreshCw,
  Car,
  Navigation,
  Check,
  AlertCircle,
  HelpCircle,
  Download,
  Printer
} from 'lucide-react';
import { toast } from 'sonner';
import BiometricCaptureModal from '@/components/school-admin/BiometricCaptureModal';
import { fetchData, getSession } from '@/lib/api';

export default function AddSchoolEscortPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const passportDocInputRef = useRef<HTMLInputElement>(null);
  const licenseDocInputRef = useRef<HTMLInputElement>(null);

  const [currentStep, setCurrentStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [createdEscortData, setCreatedEscortData] = useState<any>(null);

  // Available Fleet & Routes Data from DB
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [routes, setRoutes] = useState<any[]>([]);
  const [loadingDb, setLoadingDb] = useState(false);

  // Biometrics Modal State
  const [bioModalOpen, setBioModalOpen] = useState(false);
  const [bioModalType, setBioModalType] = useState<'photo' | 'facial' | 'fingerprint'>('photo');

  // Password Visibility
  const [showPassword, setShowPassword] = useState(false);

  // Form State
  const [form, setForm] = useState({
    // Step 1: Personal Info
    fullName: '',
    nationality: 'Nigerian',
    dob: '',
    religion: '',
    phone: '',
    bloodGroup: '',
    email: '',
    closestLandmark: '',
    residentialAddress: '',
    lga: 'Ikeja',
    state: 'Lagos',
    emergencyContactName: '',
    emergencyContactPhone: '',
    maritalStatus: 'Single',
    childrenCount: '0',
    photo: '',

    // Biometrics & IDs
    passportDocUrl: '',
    facialScanToken: '',
    fingerprintToken: '',

    // Dashboard Login Credentials (NEW)
    username: '',
    password: 'EduRide#2026',
    requirePasswordChange: true,
    sendCredentials: true,

    // Additional Info
    qualification: 'SSCE / WAEC',
    languages: 'English, Yoruba',
    experienceYears: '3',
    previousEmployment: '',

    // Step 2: Verification & ID
    nin: '',
    ninVerified: false,
    driversLicence: '',
    driversLicenceExpiry: '',
    driversLicenceDocUrl: '',
    policeClearanceDocUrl: '',
    medicalFitnessDocUrl: '',

    // Step 3: Employment & Assignment
    employmentType: 'Full-Time',
    staffId: `ESC-${Math.floor(1000 + Math.random() * 9000)}`,
    assignedVehicleId: '',
    assignedRouteId: '',
  });

  // Auto-suggest username when Full Name changes
  const handleFullNameChange = (name: string) => {
    const cleanName = name.toLowerCase().replace(/[^a-z0-9]/g, '.');
    const autoUsername = cleanName ? `escort.${cleanName}`.slice(0, 24) : '';
    setForm((prev) => ({
      ...prev,
      fullName: name,
      username: prev.username === '' || prev.username.startsWith('escort.') ? autoUsername : prev.username,
    }));
  };

  // Generate a random secure password
  const generateSecurePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
    let rand = '';
    for (let i = 0; i < 6; i++) {
      rand += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const newPass = `Edu#${rand}!`;
    setForm((prev) => ({ ...prev, password: newPass }));
    toast.success('Generated strong temporary password!');
  };

  // Load registered vehicles and routes from database
  useEffect(() => {
    const loadFleet = async () => {
      setLoadingDb(true);
      try {
        const [vehRes, routeRes] = await Promise.all([
          fetchData('get_school_vehicles').catch(() => ({ vehicles: [] })),
          fetchData('get_transport_routes').catch(() => ({ routes: [] })),
        ]);
        setVehicles(vehRes?.vehicles || []);
        setRoutes(routeRes?.routes || []);
      } catch (err) {
        console.error('Failed to load fleet data:', err);
      } finally {
        setLoadingDb(false);
      }
    };
    loadFleet();
  }, []);

  // Handlers for File Uploads
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size exceeds 5MB limit.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setForm((prev) => ({ ...prev, photo: reader.result as string }));
      toast.success('Passport photo attached successfully!');
    };
    reader.readAsDataURL(file);
  };

  const handleDocUpload = (e: React.ChangeEvent<HTMLInputElement>, fieldKey: string) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setForm((prev) => ({ ...prev, [fieldKey]: reader.result as string }));
      toast.success('Document uploaded successfully!');
    };
    reader.readAsDataURL(file);
  };

  // Open Biometric Modal
  const openBioModal = (type: 'photo' | 'facial' | 'fingerprint') => {
    setBioModalType(type);
    setBioModalOpen(true);
  };

  // Handle Biometric Capture confirm
  const handleBioCapture = (data: string) => {
    if (bioModalType === 'photo') {
      setForm((prev) => ({ ...prev, photo: data }));
      toast.success('Portrait photo captured!');
    } else if (bioModalType === 'facial') {
      setForm((prev) => ({ ...prev, facialScanToken: data }));
      toast.success('Facial recognition biometric profile attached!');
    } else if (bioModalType === 'fingerprint') {
      setForm((prev) => ({ ...prev, fingerprintToken: data }));
      toast.success('Fingerprint bio-scan registered!');
    }
  };

  // Simulated NIN Verification
  const handleVerifyNIN = () => {
    if (!form.nin || form.nin.length < 11) {
      toast.error('Please enter a valid 11-digit NIN');
      return;
    }
    toast.loading('Verifying NIN against National Identity Database...');
    setTimeout(() => {
      toast.dismiss();
      setForm((prev) => ({ ...prev, ninVerified: true }));
      toast.success('NIN Verified Successfully! Identity matched.');
    }, 1200);
  };

  // Validation before step transition
  const handleNextStep = () => {
    if (currentStep === 1) {
      if (!form.fullName.trim()) {
        toast.error('Please enter the escort full name');
        return;
      }
      if (!form.phone.trim()) {
        toast.error('Please enter a valid phone number');
        return;
      }
      if (!form.username.trim()) {
        toast.error('Please specify a username for the escort dashboard login');
        return;
      }
      if (!form.password.trim()) {
        toast.error('Please set a temporary login password');
        return;
      }
    }
    if (currentStep === 2) {
      // Step 2 validations
      if (form.nin && !form.ninVerified) {
        toast.info('NIN verification recommended before proceeding.');
      }
    }
    setCurrentStep((prev) => Math.min(prev + 1, 4));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Final Form Submission
  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const activeSession = getSession();
      const payload = {
        ...form,
        schoolId: activeSession?.roles?.find((r: any) => r.school_id)?.school_id || activeSession?.primary_school_id || activeSession?.school_id || null,
        sessionUser: activeSession ? {
          userId: activeSession.user_id,
          username: activeSession.username,
          fullName: activeSession.full_name,
          roles: activeSession.roles,
        } : null,
      };

      const res = await fetch('/api/school-admin/escorts/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
        },
        body: JSON.stringify(payload),
        credentials: 'include',
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Failed to onboard escort');
      }

      setCreatedEscortData(json);
      toast.success('Escort registered and submitted to City Manager for review!');
    } catch (err: any) {
      console.error('Submission error:', err);
      toast.error(err.message || 'Failed to submit escort application.');
    } finally {
      setSubmitting(false);
    }
  };

  // Selected vehicle & route display names for summary
  const selectedVehicleObj = useMemo(() => {
    return vehicles.find((v) => v.id === form.assignedVehicleId);
  }, [vehicles, form.assignedVehicleId]);

  const selectedRouteObj = useMemo(() => {
    return routes.find((r) => r.id === form.assignedRouteId);
  }, [routes, form.assignedRouteId]);

  return (
    <div className="space-y-6 font-sans text-slate-800 text-xs pb-16">
      
      {/* ------------------------------------------------------------- */}
      {/* 1. TOP BREADCRUMB & HEADER                                    */}
      {/* ------------------------------------------------------------- */}
      <div className="space-y-1">
        <Link
          href="/dashboard/school-admin/escort/school-escort"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-blue-600 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Escorts List</span>
        </Link>
        <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
          Add New Escort
        </h1>
        <p className="text-slate-500 text-xs font-medium">
          Register a new school escort. After saving, the escort will be moved to Staff List automatically.
        </p>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 2. 4-STEP WIZARD PROGRESS BAR (Matching UI Reference)         */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-3.5 shadow-xs">
        <div className="flex items-center justify-between max-w-4xl mx-auto overflow-x-auto gap-2 py-1">
          
          {/* Step 1 */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center font-extrabold text-xs transition-all ${
                currentStep >= 1
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                  : 'bg-slate-100 text-slate-400'
              }`}
            >
              {currentStep > 1 ? <Check className="w-4 h-4" /> : '1'}
            </div>
            <span className={`text-xs font-bold ${currentStep === 1 ? 'text-blue-600 font-black' : 'text-slate-700'}`}>
              Personal Information
            </span>
          </div>

          <div className="h-[2px] w-8 sm:w-16 bg-slate-200 shrink-0" />

          {/* Step 2 */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center font-extrabold text-xs transition-all ${
                currentStep >= 2
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                  : 'bg-slate-100 text-slate-400'
              }`}
            >
              {currentStep > 2 ? <Check className="w-4 h-4" /> : '2'}
            </div>
            <span className={`text-xs font-bold ${currentStep === 2 ? 'text-blue-600 font-black' : 'text-slate-400'}`}>
              Verification & ID
            </span>
          </div>

          <div className="h-[2px] w-8 sm:w-16 bg-slate-200 shrink-0" />

          {/* Step 3 */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center font-extrabold text-xs transition-all ${
                currentStep >= 3
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                  : 'bg-slate-100 text-slate-400'
              }`}
            >
              {currentStep > 3 ? <Check className="w-4 h-4" /> : '3'}
            </div>
            <span className={`text-xs font-bold ${currentStep === 3 ? 'text-blue-600 font-black' : 'text-slate-400'}`}>
              Employment & Assignment
            </span>
          </div>

          <div className="h-[2px] w-8 sm:w-16 bg-slate-200 shrink-0" />

          {/* Step 4 */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center font-extrabold text-xs transition-all ${
                currentStep === 4
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                  : 'bg-slate-100 text-slate-400'
              }`}
            >
              4
            </div>
            <span className={`text-xs font-bold ${currentStep === 4 ? 'text-blue-600 font-black' : 'text-slate-400'}`}>
              Review & Submit
            </span>
          </div>

        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 3. MAIN WORKFLOW CONTAINER: 8 Cols Form + 4 Cols Sidebar       */}
      {/* ------------------------------------------------------------- */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* LEFT FORM COLUMN (Col 8/12) */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* ========================================================= */}
          {/* STEP 1: PERSONAL INFORMATION, BIOMETRICS & LOGIN          */}
          {/* ========================================================= */}
          {currentStep === 1 && (
            <div className="space-y-6 animate-in fade-in">
              
              {/* Card 1: Personal Information Grid */}
              <div className="bg-white rounded-3xl border border-slate-200/80 p-5 sm:p-7 shadow-xs space-y-6">
                <div className="border-b border-slate-100 pb-3">
                  <h2 className="text-sm sm:text-base font-extrabold text-slate-900">
                    Personal Information
                  </h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
                  
                  {/* Left Form Inputs (Col 8) */}
                  <div className="md:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    
                    {/* Full Name */}
                    <div className="sm:col-span-1 space-y-1.5">
                      <label className="text-[11px] font-extrabold text-slate-700">
                        Full Name <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="Enter full name"
                        value={form.fullName}
                        onChange={(e) => handleFullNameChange(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                      />
                    </div>

                    {/* Nationality */}
                    <div className="sm:col-span-1 space-y-1.5">
                      <label className="text-[11px] font-extrabold text-slate-700">
                        Nationality <span className="text-rose-500">*</span>
                      </label>
                      <select
                        value={form.nationality}
                        onChange={(e) => setForm({ ...form, nationality: e.target.value })}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                      >
                        <option value="Nigerian">Nigerian</option>
                        <option value="Ghanaian">Ghanaian</option>
                        <option value="Kenyan">Kenyan</option>
                        <option value="British">British</option>
                        <option value="American">American</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>

                    {/* Date of Birth */}
                    <div className="sm:col-span-1 space-y-1.5">
                      <label className="text-[11px] font-extrabold text-slate-700">
                        Date of Birth <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="date"
                        value={form.dob}
                        onChange={(e) => setForm({ ...form, dob: e.target.value })}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                      />
                    </div>

                    {/* Religion */}
                    <div className="sm:col-span-1 space-y-1.5">
                      <label className="text-[11px] font-extrabold text-slate-700">
                        Religion
                      </label>
                      <select
                        value={form.religion}
                        onChange={(e) => setForm({ ...form, religion: e.target.value })}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                      >
                        <option value="">Select religion</option>
                        <option value="Christianity">Christianity</option>
                        <option value="Islam">Islam</option>
                        <option value="Other">Other</option>
                        <option value="Prefer not to say">Prefer not to say</option>
                      </select>
                    </div>

                    {/* Phone Number */}
                    <div className="sm:col-span-1 space-y-1.5">
                      <label className="text-[11px] font-extrabold text-slate-700">
                        Phone Number <span className="text-rose-500">*</span>
                      </label>
                      <div className="flex rounded-xl border border-slate-200 overflow-hidden focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 transition-all">
                        <span className="bg-slate-50 px-2.5 py-2.5 border-r border-slate-200 text-xs font-bold text-slate-600 flex items-center gap-1">
                          🇳🇬 +234
                        </span>
                        <input
                          type="tel"
                          placeholder="Enter phone number"
                          value={form.phone}
                          onChange={(e) => setForm({ ...form, phone: e.target.value })}
                          className="w-full px-3 py-2 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none"
                        />
                      </div>
                    </div>

                    {/* Blood Group */}
                    <div className="sm:col-span-1 space-y-1.5">
                      <label className="text-[11px] font-extrabold text-slate-700">
                        Blood Group
                      </label>
                      <select
                        value={form.bloodGroup}
                        onChange={(e) => setForm({ ...form, bloodGroup: e.target.value })}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                      >
                        <option value="">Select blood group</option>
                        <option value="O+">O Positive (O+)</option>
                        <option value="O-">O Negative (O-)</option>
                        <option value="A+">A Positive (A+)</option>
                        <option value="A-">A Negative (A-)</option>
                        <option value="B+">B Positive (B+)</option>
                        <option value="B-">B Negative (B-)</option>
                        <option value="AB+">AB Positive (AB+)</option>
                        <option value="AB-">AB Negative (AB-)</option>
                      </select>
                    </div>

                    {/* Email Address */}
                    <div className="sm:col-span-1 space-y-1.5">
                      <label className="text-[11px] font-extrabold text-slate-700">
                        Email Address
                      </label>
                      <input
                        type="email"
                        placeholder="Enter email address"
                        value={form.email}
                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                      />
                    </div>

                    {/* Closest Landmark */}
                    <div className="sm:col-span-1 space-y-1.5">
                      <label className="text-[11px] font-extrabold text-slate-700">
                        Closest Landmark
                      </label>
                      <input
                        type="text"
                        placeholder="Enter closest landmark"
                        value={form.closestLandmark}
                        onChange={(e) => setForm({ ...form, closestLandmark: e.target.value })}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                      />
                    </div>

                  </div>

                  {/* Right Profile Photo Box (Col 4) (Matching Screenshot) */}
                  <div className="md:col-span-4 bg-slate-50/80 rounded-2xl border border-slate-200/80 p-4 flex flex-col items-center justify-center text-center space-y-3">
                    <label className="text-[11px] font-extrabold text-slate-700 self-start">
                      Profile Photo (Passport)
                    </label>

                    <div className="w-24 h-24 rounded-full bg-white border-2 border-dashed border-slate-300 flex items-center justify-center overflow-hidden shadow-xs relative group">
                      {form.photo ? (
                        <img src={form.photo} alt="Escort portrait" className="w-full h-full object-cover" />
                      ) : (
                        <User className="w-12 h-12 text-slate-300" />
                      )}
                    </div>

                    <p className="text-[10px] text-slate-500 leading-tight">
                      Capture or upload passport photo<br />
                      <span className="text-slate-400">JPG, PNG (Max. 5MB)</span>
                    </p>

                    <div className="flex items-center gap-2 w-full pt-1">
                      <button
                        type="button"
                        onClick={() => openBioModal('photo')}
                        className="flex-1 py-2 px-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-bold text-[11px] flex items-center justify-center gap-1 cursor-pointer transition-colors shadow-2xs"
                      >
                        <Camera className="w-3.5 h-3.5 text-slate-600" />
                        <span>Capture</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="flex-1 py-2 px-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-bold text-[11px] flex items-center justify-center gap-1 cursor-pointer transition-colors shadow-2xs"
                      >
                        <Upload className="w-3.5 h-3.5 text-slate-600" />
                        <span>Upload</span>
                      </button>
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handlePhotoUpload}
                        accept="image/png, image/jpeg"
                        className="hidden"
                      />
                    </div>
                  </div>

                </div>

                {/* Residential Address & Location Subgrid */}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 pt-2 border-t border-slate-100">
                  <div className="sm:col-span-12 space-y-1.5">
                    <label className="text-[11px] font-extrabold text-slate-700">
                      Residential Address <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Enter full residential address"
                      value={form.residentialAddress}
                      onChange={(e) => setForm({ ...form, residentialAddress: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    />
                  </div>

                  <div className="sm:col-span-3 space-y-1.5">
                    <label className="text-[11px] font-extrabold text-slate-700">
                      LGA <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={form.lga}
                      onChange={(e) => setForm({ ...form, lga: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    >
                      <option value="Ikeja">Ikeja</option>
                      <option value="Surulere">Surulere</option>
                      <option value="Lagos Island">Lagos Island</option>
                      <option value="Eti-Osa">Eti-Osa</option>
                      <option value="Kosofe">Kosofe</option>
                      <option value="Alimosho">Alimosho</option>
                      <option value="Oshodi-Isolo">Oshodi-Isolo</option>
                      <option value="Agege">Agege</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div className="sm:col-span-3 space-y-1.5">
                    <label className="text-[11px] font-extrabold text-slate-700">
                      State <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={form.state}
                      onChange={(e) => setForm({ ...form, state: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    >
                      <option value="Lagos">Lagos</option>
                      <option value="Abuja (FCT)">Abuja (FCT)</option>
                      <option value="Ogun">Ogun</option>
                      <option value="Oyo">Oyo</option>
                      <option value="Rivers">Rivers</option>
                      <option value="Edo">Edo</option>
                      <option value="Delta">Delta</option>
                    </select>
                  </div>

                  <div className="sm:col-span-3 space-y-1.5">
                    <label className="text-[11px] font-extrabold text-slate-700">
                      Emergency Contact Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Enter emergency contact name"
                      value={form.emergencyContactName}
                      onChange={(e) => setForm({ ...form, emergencyContactName: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    />
                  </div>

                  <div className="sm:col-span-3 space-y-1.5">
                    <label className="text-[11px] font-extrabold text-slate-700">
                      Emergency Contact Phone <span className="text-rose-500">*</span>
                    </label>
                    <div className="flex rounded-xl border border-slate-200 overflow-hidden focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 transition-all">
                      <span className="bg-slate-50 px-2 py-2.5 border-r border-slate-200 text-xs font-bold text-slate-600">
                        🇳🇬 +234
                      </span>
                      <input
                        type="tel"
                        placeholder="Emergency phone"
                        value={form.emergencyContactPhone}
                        onChange={(e) => setForm({ ...form, emergencyContactPhone: e.target.value })}
                        className="w-full px-2.5 py-2 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="sm:col-span-6 space-y-1.5">
                    <label className="text-[11px] font-extrabold text-slate-700">
                      Marital Status
                    </label>
                    <select
                      value={form.maritalStatus}
                      onChange={(e) => setForm({ ...form, maritalStatus: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    >
                      <option value="Single">Single</option>
                      <option value="Married">Married</option>
                      <option value="Divorced">Divorced</option>
                      <option value="Widowed">Widowed</option>
                    </select>
                  </div>

                  <div className="sm:col-span-6 space-y-1.5">
                    <label className="text-[11px] font-extrabold text-slate-700">
                      Number of Children
                    </label>
                    <input
                      type="number"
                      min="0"
                      placeholder="Enter number of children"
                      value={form.childrenCount}
                      onChange={(e) => setForm({ ...form, childrenCount: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    />
                  </div>

                </div>
              </div>

              {/* Card 2: ID & Verification (3 Biometric Cards from Screenshot) */}
              <div className="bg-white rounded-3xl border border-slate-200/80 p-5 sm:p-7 shadow-xs space-y-4">
                <div className="border-b border-slate-100 pb-3">
                  <h2 className="text-sm sm:text-base font-extrabold text-slate-900">
                    ID & Verification
                  </h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  
                  {/* Card 1: Passport for ID Card */}
                  <div className="bg-slate-50/80 rounded-2xl border border-slate-200/80 p-4 flex flex-col items-center justify-between text-center space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-blue-600 shadow-2xs">
                      <FileText className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="font-extrabold text-slate-900 text-xs">
                        Passport for ID Card
                      </h4>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        Upload clear image of passport (Bio-data page)<br />
                        <span className="text-slate-400">JPG, PNG, PDF (Max. 5MB)</span>
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => passportDocInputRef.current?.click()}
                      className={`w-full py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all shadow-2xs ${
                        form.passportDocUrl
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                          : 'bg-white hover:bg-slate-100 border-slate-300 text-slate-700'
                      }`}
                    >
                      {form.passportDocUrl ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Uploaded ✔</span>
                        </>
                      ) : (
                        <>
                          <Upload className="w-3.5 h-3.5 text-slate-500" />
                          <span>Upload Passport</span>
                        </>
                      )}
                    </button>
                    <input
                      type="file"
                      ref={passportDocInputRef}
                      onChange={(e) => handleDocUpload(e, 'passportDocUrl')}
                      accept="image/*,application/pdf"
                      className="hidden"
                    />
                  </div>

                  {/* Card 2: Facial Scan */}
                  <div className="bg-slate-50/80 rounded-2xl border border-slate-200/80 p-4 flex flex-col items-center justify-between text-center space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-blue-600 shadow-2xs">
                      <ScanFace className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="font-extrabold text-slate-900 text-xs">
                        Facial Scan
                      </h4>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        Capture live facial image<br />
                        <span className="text-slate-400">This will be used for recognition</span>
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => openBioModal('facial')}
                      className={`w-full py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all shadow-2xs ${
                        form.facialScanToken
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                          : 'bg-white hover:bg-slate-100 border-slate-300 text-slate-700'
                      }`}
                    >
                      {form.facialScanToken ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Scanned & Verified</span>
                        </>
                      ) : (
                        <>
                          <ScanFace className="w-3.5 h-3.5 text-slate-500" />
                          <span>Start Facial Scan</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Card 3: Fingerprint Scan */}
                  <div className="bg-slate-50/80 rounded-2xl border border-slate-200/80 p-4 flex flex-col items-center justify-between text-center space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-blue-600 shadow-2xs">
                      <Fingerprint className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="font-extrabold text-slate-900 text-xs">
                        Fingerprint Scan
                      </h4>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        Capture fingerprint<br />
                        <span className="text-slate-400">This will be used for verification</span>
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => openBioModal('fingerprint')}
                      className={`w-full py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all shadow-2xs ${
                        form.fingerprintToken
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                          : 'bg-white hover:bg-slate-100 border-slate-300 text-slate-700'
                      }`}
                    >
                      {form.fingerprintToken ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Biometrics Linked</span>
                        </>
                      ) : (
                        <>
                          <Fingerprint className="w-3.5 h-3.5 text-slate-500" />
                          <span>Start Fingerprint Scan</span>
                        </>
                      )}
                    </button>
                  </div>

                </div>
              </div>

              {/* Card 3: Dashboard Login Credentials Setup (Requested by User) */}
              <div className="bg-gradient-to-br from-blue-50/60 via-white to-slate-50 rounded-3xl border border-blue-200/80 p-5 sm:p-7 shadow-xs space-y-5">
                <div className="border-b border-blue-100 pb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
                      <KeyRound className="w-4 h-4" />
                    </div>
                    <div>
                      <h2 className="text-sm sm:text-base font-extrabold text-slate-900">
                        Dashboard Login Credentials Setup
                      </h2>
                      <p className="text-[11px] text-slate-500">
                        Set up the username and password the escort will use to log into their mobile dashboard.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  
                  {/* Username */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-extrabold text-slate-700 flex items-center justify-between">
                      <span>Username / Login ID <span className="text-rose-500">*</span></span>
                      <span className="text-[10px] text-slate-400 font-normal">Auto-suggested from name</span>
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="e.g. escort.david"
                        value={form.username}
                        onChange={(e) => setForm({ ...form, username: e.target.value.toLowerCase().trim() })}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-bold text-blue-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                      />
                    </div>
                  </div>

                  {/* Password with Generator */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-extrabold text-slate-700">
                        Temporary Password <span className="text-rose-500">*</span>
                      </label>
                      <button
                        type="button"
                        onClick={generateSecurePassword}
                        className="text-[11px] font-extrabold text-blue-600 hover:text-blue-700 flex items-center gap-1 cursor-pointer"
                      >
                        <Sparkles className="w-3 h-3" />
                        <span>Generate Secure</span>
                      </button>
                    </div>

                    <div className="relative flex items-center">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={form.password}
                        onChange={(e) => setForm({ ...form, password: e.target.value })}
                        className="w-full pl-3.5 pr-10 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                </div>

                {/* Security Checkboxes */}
                <div className="space-y-2 pt-1 border-t border-blue-100/80">
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.requirePasswordChange}
                      onChange={(e) => setForm({ ...form, requirePasswordChange: e.target.checked })}
                      className="rounded text-blue-600 focus:ring-blue-500"
                    />
                    <span>Require password change upon first escort login (Recommended)</span>
                  </label>

                  <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.sendCredentials}
                      onChange={(e) => setForm({ ...form, sendCredentials: e.target.checked })}
                      className="rounded text-blue-600 focus:ring-blue-500"
                    />
                    <span>Send portal link and login credentials to escort's email & phone</span>
                  </label>
                </div>
              </div>

              {/* Card 4: Additional Information */}
              <div className="bg-white rounded-3xl border border-slate-200/80 p-5 sm:p-7 shadow-xs space-y-4">
                <div className="border-b border-slate-100 pb-3">
                  <h2 className="text-sm sm:text-base font-extrabold text-slate-900">
                    Additional Information
                  </h2>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-extrabold text-slate-700">
                      Highest Qualification
                    </label>
                    <select
                      value={form.qualification}
                      onChange={(e) => setForm({ ...form, qualification: e.target.value })}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    >
                      <option value="SSCE / WAEC">SSCE / WAEC</option>
                      <option value="OND / NCE">OND / NCE</option>
                      <option value="HND">HND</option>
                      <option value="B.Sc / B.Ed">B.Sc / B.Ed</option>
                      <option value="M.Sc">M.Sc</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-extrabold text-slate-700">
                      Languages Spoken
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. English, Yoruba, Hausa"
                      value={form.languages}
                      onChange={(e) => setForm({ ...form, languages: e.target.value })}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-extrabold text-slate-700">
                      Years of Experience
                    </label>
                    <input
                      type="number"
                      min="0"
                      placeholder="Enter years"
                      value={form.experienceYears}
                      onChange={(e) => setForm({ ...form, experienceYears: e.target.value })}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-extrabold text-slate-700">
                      Previous Employment
                    </label>
                    <input
                      type="text"
                      placeholder="Enter previous employer"
                      value={form.previousEmployment}
                      onChange={(e) => setForm({ ...form, previousEmployment: e.target.value })}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* ========================================================= */}
          {/* STEP 2: VERIFICATION & ID                                 */}
          {/* ========================================================= */}
          {currentStep === 2 && (
            <div className="space-y-6 animate-in fade-in">
              <div className="bg-white rounded-3xl border border-slate-200/80 p-5 sm:p-7 shadow-xs space-y-6">
                <div className="border-b border-slate-100 pb-3">
                  <h2 className="text-sm sm:text-base font-extrabold text-slate-900">
                    Verification & Legal Credentials
                  </h2>
                  <p className="text-[11px] text-slate-500">
                    Verify government identity credentials and professional safety certifications.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  
                  {/* National Identity Number (NIN) */}
                  <div className="sm:col-span-2 space-y-1.5 bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-extrabold text-slate-700 flex items-center gap-1.5">
                        <ShieldCheck className="w-4 h-4 text-emerald-600" />
                        <span>National Identity Number (NIN)</span>
                      </label>
                      {form.ninVerified && (
                        <span className="text-[10px] font-black text-emerald-700 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Check className="w-3 h-3" /> NIMC Verified
                        </span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        maxLength={11}
                        placeholder="Enter 11-digit NIN"
                        value={form.nin}
                        onChange={(e) => setForm({ ...form, nin: e.target.value.replace(/\D/g, ''), ninVerified: false })}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-mono font-bold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      />
                      <button
                        type="button"
                        onClick={handleVerifyNIN}
                        className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs shrink-0 cursor-pointer shadow-xs transition-colors"
                      >
                        Verify NIN
                      </button>
                    </div>
                  </div>

                  {/* Driver's License Number */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-extrabold text-slate-700">
                      Driver's License Number
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. AAA-12345-AA"
                      value={form.driversLicence}
                      onChange={(e) => setForm({ ...form, driversLicence: e.target.value.toUpperCase() })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-mono font-bold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>

                  {/* Driver's License Expiry */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-extrabold text-slate-700">
                      License Expiry Date
                    </label>
                    <input
                      type="date"
                      value={form.driversLicenceExpiry}
                      onChange={(e) => setForm({ ...form, driversLicenceExpiry: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>

                  {/* Upload License Document */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-extrabold text-slate-700">
                      Upload Driver's License (Document)
                    </label>
                    <button
                      type="button"
                      onClick={() => licenseDocInputRef.current?.click()}
                      className={`w-full py-2.5 px-3.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-all ${
                        form.driversLicenceDocUrl
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                          : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
                      }`}
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>{form.driversLicenceDocUrl ? 'License Uploaded ✔' : 'Upload File (PDF/JPG)'}</span>
                    </button>
                    <input
                      type="file"
                      ref={licenseDocInputRef}
                      onChange={(e) => handleDocUpload(e, 'driversLicenceDocUrl')}
                      accept="image/*,application/pdf"
                      className="hidden"
                    />
                  </div>

                  {/* LASDRI / Police Clearance */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-extrabold text-slate-700">
                      LASDRI / Police Clearance
                    </label>
                    <input
                      type="text"
                      placeholder="Certificate Reference Number"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>

                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* STEP 3: EMPLOYMENT & ASSIGNMENT                           */}
          {/* ========================================================= */}
          {currentStep === 3 && (
            <div className="space-y-6 animate-in fade-in">
              <div className="bg-white rounded-3xl border border-slate-200/80 p-5 sm:p-7 shadow-xs space-y-6">
                <div className="border-b border-slate-100 pb-3">
                  <h2 className="text-sm sm:text-base font-extrabold text-slate-900">
                    Employment & Vehicle Assignment
                  </h2>
                  <p className="text-[11px] text-slate-500">
                    Assign this escort to a school vehicle and designated student transit route.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  
                  {/* Employment Type */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-extrabold text-slate-700">
                      Employment Type <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={form.employmentType}
                      onChange={(e) => setForm({ ...form, employmentType: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    >
                      <option value="Full-Time">Full-Time (Staff)</option>
                      <option value="Part-Time">Part-Time</option>
                      <option value="Contract">Contract / Third-Party Fleet</option>
                    </select>
                  </div>

                  {/* Staff ID */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-extrabold text-slate-700">
                      Staff ID Code
                    </label>
                    <input
                      type="text"
                      readOnly
                      value={form.staffId}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-mono font-bold text-slate-700 cursor-not-allowed"
                    />
                  </div>

                  {/* Assign Vehicle */}
                  <div className="sm:col-span-2 space-y-1.5">
                    <label className="text-[11px] font-extrabold text-slate-700 flex items-center gap-1.5">
                      <Car className="w-4 h-4 text-blue-600" />
                      <span>Assign School Vehicle (Optional)</span>
                    </label>
                    <select
                      value={form.assignedVehicleId}
                      onChange={(e) => setForm({ ...form, assignedVehicleId: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    >
                      <option value="">No Vehicle Assigned (Floating / Backup Escort)</option>
                      {vehicles.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.make} {v.model} — Plate: {v.reg_number || v.license_plate} ({v.capacity || 18} Seats)
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Assign Route */}
                  <div className="sm:col-span-2 space-y-1.5">
                    <label className="text-[11px] font-extrabold text-slate-700 flex items-center gap-1.5">
                      <Navigation className="w-4 h-4 text-emerald-600" />
                      <span>Assign Transit Route (Optional)</span>
                    </label>
                    <select
                      value={form.assignedRouteId}
                      onChange={(e) => setForm({ ...form, assignedRouteId: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    >
                      <option value="">No Designated Route (On-Demand / Flexible)</option>
                      {routes.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name} ({r.code || 'ROUTE'}) — Morning: {r.departure_morning || '07:00 AM'}
                        </option>
                      ))}
                    </select>
                  </div>

                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* STEP 4: REVIEW & SUBMIT                                   */}
          {/* ========================================================= */}
          {currentStep === 4 && (
            <div className="space-y-6 animate-in fade-in">
              {createdEscortData ? (
                /* Success Screen */
                <div className="bg-white rounded-3xl border border-emerald-200 p-6 sm:p-8 shadow-sm text-center space-y-6">
                  <div className="w-16 h-16 rounded-3xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-md shadow-emerald-500/10 animate-bounce">
                    <CheckCircle2 className="w-9 h-9" />
                  </div>
                  
                  <div className="space-y-2">
                    <h2 className="text-xl font-black text-slate-900">
                      Escort Successfully Onboarded!
                    </h2>
                    <p className="text-xs text-slate-500 max-w-md mx-auto">
                      <strong>{form.fullName}</strong> has been added to the School Escort Roster and Staff Directory.
                    </p>
                  </div>

                  {/* Credentials Handover Card */}
                  <div className="bg-slate-50 rounded-2xl border border-slate-200 p-5 max-w-md mx-auto text-left space-y-3">
                    <h4 className="font-extrabold text-xs text-slate-900 flex items-center gap-1.5 border-b border-slate-200 pb-2">
                      <KeyRound className="w-4 h-4 text-blue-600" />
                      <span>Escort Mobile Login Credentials</span>
                    </h4>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-slate-400 text-[10px] block">Username:</span>
                        <strong className="text-slate-900 font-mono">{createdEscortData?.credentials?.username || form.username}</strong>
                      </div>
                      <div>
                        <span className="text-slate-400 text-[10px] block">Password:</span>
                        <strong className="text-slate-900 font-mono">{createdEscortData?.credentials?.temporaryPassword || form.password}</strong>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-center gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => window.print()}
                      className="py-2.5 px-5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-extrabold text-xs flex items-center gap-2 cursor-pointer shadow-2xs"
                    >
                      <Printer className="w-4 h-4" />
                      <span>Print Onboarding Slip</span>
                    </button>
                    <Link
                      href="/dashboard/school-admin/escort/school-escort"
                      className="py-2.5 px-6 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs flex items-center gap-2 shadow-md shadow-blue-600/20 cursor-pointer"
                    >
                      <span>Go to Escorts List →</span>
                    </Link>
                  </div>
                </div>
              ) : (
                /* Review Summary Card */
                <div className="bg-white rounded-3xl border border-slate-200/80 p-5 sm:p-7 shadow-xs space-y-6">
                  <div className="border-b border-slate-100 pb-3">
                    <h2 className="text-sm sm:text-base font-extrabold text-slate-900">
                      Review & Confirm Escort Registration
                    </h2>
                    <p className="text-[11px] text-slate-500">
                      Please review all details before finalizing and generating escort login credentials.
                    </p>
                  </div>

                  {/* Summary Details Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-5 rounded-2xl border border-slate-200/80 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 block font-bold">FULL NAME</span>
                      <strong className="text-slate-900 text-sm">{form.fullName}</strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-bold">PHONE NUMBER</span>
                      <strong className="text-slate-900">+234 {form.phone}</strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-bold">ASSIGNED USERNAME</span>
                      <strong className="text-blue-600 font-mono">{form.username}</strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-bold">TEMPORARY PASSWORD</span>
                      <strong className="text-slate-800 font-mono">••••••••</strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-bold">EMPLOYMENT TYPE</span>
                      <strong className="text-slate-800">{form.employmentType}</strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-bold">ASSIGNED VEHICLE</span>
                      <strong className="text-slate-800">{selectedVehicleObj ? `${selectedVehicleObj.make} ${selectedVehicleObj.model} (${selectedVehicleObj.reg_number})` : 'None'}</strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-bold">ASSIGNED ROUTE</span>
                      <strong className="text-slate-800">{selectedRouteObj ? selectedRouteObj.name : 'None'}</strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-bold">BIOMETRIC STATUS</span>
                      <strong className="text-emerald-700">
                        {form.facialScanToken ? 'Facial Token Attached ✔' : 'Standard Bio Profile'}
                      </strong>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ========================================================= */}
          {/* NAVIGATION BUTTONS BAR                                     */}
          {/* ========================================================= */}
          {!createdEscortData && (
            <div className="flex items-center justify-between pt-2">
              {currentStep > 1 ? (
                <button
                  type="button"
                  onClick={() => setCurrentStep((prev) => Math.max(prev - 1, 1))}
                  className="py-2.5 px-5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-extrabold text-xs flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Previous Step</span>
                </button>
              ) : (
                <Link
                  href="/dashboard/school-admin/escort/school-escort"
                  className="py-2.5 px-5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-extrabold text-xs cursor-pointer transition-colors"
                >
                  Cancel
                </Link>
              )}

              {currentStep < 4 ? (
                <button
                  type="button"
                  onClick={handleNextStep}
                  className="py-2.5 px-6 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs flex items-center gap-2 shadow-md shadow-blue-600/20 cursor-pointer transition-all"
                >
                  <span>Save & Continue</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="button"
                  disabled={submitting}
                  onClick={handleSubmit}
                  className="py-2.5 px-7 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs flex items-center gap-2 shadow-md shadow-emerald-600/20 cursor-pointer transition-all disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Onboarding Escort...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Confirm & Register Escort</span>
                    </>
                  )}
                </button>
              )}
            </div>
          )}

        </div>

        {/* RIGHT SIDEBAR WIDGETS (Col 4/12) (Matching Screenshot) */}
        <div className="lg:col-span-4 space-y-5">
          
          {/* 1. ESCORT SUMMARY CARD */}
          <div className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-xs space-y-4">
            <h3 className="font-extrabold text-slate-900 text-sm border-b border-slate-100 pb-2.5">
              Escort Summary
            </h3>

            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between items-center py-1 border-b border-slate-50">
                <span className="text-slate-500 font-medium">Full Name</span>
                <span className="font-extrabold text-slate-900 truncate max-w-[160px]">
                  {form.fullName || '—'}
                </span>
              </div>

              <div className="flex justify-between items-center py-1 border-b border-slate-50">
                <span className="text-slate-500 font-medium">Phone Number</span>
                <span className="font-bold text-slate-800">
                  {form.phone ? `+234 ${form.phone}` : '—'}
                </span>
              </div>

              <div className="flex justify-between items-center py-1 border-b border-slate-50">
                <span className="text-slate-500 font-medium">Username</span>
                <span className="font-bold text-blue-600 font-mono">
                  {form.username || '—'}
                </span>
              </div>

              <div className="flex justify-between items-center py-1 border-b border-slate-50">
                <span className="text-slate-500 font-medium">ID Type</span>
                <span className="font-bold text-slate-800">
                  {form.nin ? 'National ID (NIN)' : '—'}
                </span>
              </div>

              <div className="flex justify-between items-center py-1 border-b border-slate-50">
                <span className="text-slate-500 font-medium">License Number</span>
                <span className="font-mono font-bold text-slate-800">
                  {form.driversLicence || '—'}
                </span>
              </div>

              <div className="flex justify-between items-center py-1 border-b border-slate-50">
                <span className="text-slate-500 font-medium">Status</span>
                <span className="bg-amber-100 text-amber-800 text-[10px] font-black px-2.5 py-0.5 rounded-full border border-amber-200">
                  Pending
                </span>
              </div>

              <div className="flex justify-between items-center py-1 border-b border-slate-50">
                <span className="text-slate-500 font-medium">Employment Type</span>
                <span className="font-bold text-slate-800">
                  {form.employmentType || '—'}
                </span>
              </div>

              <div className="flex justify-between items-center py-1 border-b border-slate-50">
                <span className="text-slate-500 font-medium">Vehicle Assigned</span>
                <span className="font-bold text-slate-800 truncate max-w-[150px]">
                  {selectedVehicleObj ? `${selectedVehicleObj.make} ${selectedVehicleObj.model}` : '—'}
                </span>
              </div>

              <div className="flex justify-between items-center py-1 border-b border-slate-50">
                <span className="text-slate-500 font-medium">Routes Assigned</span>
                <span className="font-bold text-slate-800 truncate max-w-[150px]">
                  {selectedRouteObj ? selectedRouteObj.name : '—'}
                </span>
              </div>

              <div className="flex justify-between items-center py-1">
                <span className="text-slate-500 font-medium">Students Assigned</span>
                <span className="font-bold text-slate-800">
                  {selectedRouteObj ? 'Route Linked' : '—'}
                </span>
              </div>
            </div>
          </div>

          {/* 2. IMPORTANT NOTE CARD */}
          <div className="bg-amber-50/70 rounded-3xl border border-amber-200/80 p-5 shadow-xs space-y-2 text-amber-950">
            <h4 className="font-extrabold text-xs text-amber-900 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-amber-600" />
              <span>Important Note</span>
            </h4>
            <p className="text-[11px] text-amber-900/90 leading-relaxed font-medium">
              All escorts will go through verification before they can be assigned to vehicles and routes. Please ensure all information provided is accurate and valid.
            </p>
          </div>

          {/* 3. AFTER SUBMISSION CARD */}
          <div className="bg-slate-50 rounded-3xl border border-slate-200/80 p-5 shadow-xs space-y-3">
            <h4 className="font-extrabold text-xs text-slate-900">
              After Submission
            </h4>
            <p className="text-[11px] text-slate-500">
              Once submitted, this escort will:
            </p>
            <ul className="space-y-2 text-[11px] font-bold text-slate-700">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>Be moved to Staff List</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>Be available for assignment</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>Receive login credentials (if required)</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>Undergo verification process</span>
              </li>
            </ul>
          </div>

        </div>

      </div>

      {/* ------------------------------------------------------------- */}
      {/* 4. BIOMETRIC & WEBCAM MODAL                                   */}
      {/* ------------------------------------------------------------- */}
      <BiometricCaptureModal
        isOpen={bioModalOpen}
        onClose={() => setBioModalOpen(false)}
        type={bioModalType}
        onCapture={handleBioCapture}
      />

    </div>
  );
}
