'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Building2,
  Mail,
  Phone,
  Lock,
  Eye,
  EyeOff,
  User,
  MapPin,
  Calendar,
  Clock,
  Upload,
  CheckCircle,
  ShieldCheck,
  ArrowRight,
  ArrowLeft,
  MessageSquare,
  Sparkles,
  Award,
  Users,
  Shield,
  HelpCircle,
  Camera,
  Compass,
  FileText,
  BadgeCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import MigoChatModal from '@/components/landing/MigoChatModal';
import { NIGERIAN_STATES, type NigerianState } from '@/lib/constants/nigerian-states';

type SchoolRegistrationWizardProps = {
  onSwitchRole?: (role: 'parent' | 'school' | 'driver') => void;
};

const LOGO_URL = '/images/eduride_logo.png';

const SCHOOL_TYPES = [
  'Nursery & Primary School',
  'Secondary School',
  'K-12 (Combined Nursery, Primary & Secondary)',
  'Crèche / Preschool',
  'Tertiary / Vocational Academy',
];

const SCHOOL_CATEGORIES = [
  'Private Independent School',
  'Public / Government School',
  'Mission / Faith-Based School',
  'International / British Curriculum',
  'Montessori Academy',
];

const ADMIN_POSITIONS = [
  'Proprietor / Director',
  'Principal',
  'Headteacher',
  'Administrator / Admin Officer',
  'IT / Operations Manager',
];

const ACADEMIC_SESSIONS = [
  '2024/2025 Academic Session',
  '2025/2026 Academic Session',
  '2026/2027 Academic Session',
];

const CALENDAR_TYPES = [
  '3 Terms / Academic Year (Standard)',
  '2 Semesters / Academic Year',
];

export default function SchoolRegistrationWizard({ onSwitchRole }: SchoolRegistrationWizardProps) {
  const router = useRouter();

  // Navigation State
  // Phase 1: 'quick_signup' (Step 1), 'otp_verify' (Step 2)
  // Phase 2: 'wizard' (Step 3 to 7: Profile, Location, Admin, Academic, Activate)
  const [phase, setPhase] = useState<'quick_signup' | 'otp_verify' | 'wizard'>('quick_signup');
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3 | 4 | 5>(1); // 1: Profile, 2: Location, 3: Admin, 4: Academic, 5: Complete

  // Loading & Submissions
  const [loading, setLoading] = useState(false);
  const [migoModalOpen, setMigoModalOpen] = useState(false);

  // Registered Context
  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [contactId, setContactId] = useState<string | null>(null);

  // Form State — Zero Dummies
  const [form, setForm] = useState({
    // Phase 1: Quick Signup
    schoolName: '',
    usernameOrEmail: '',
    countryCode: '+234',
    phone: '',
    password: '',
    confirmPassword: '',
    agreeTerms: true,

    // Phase 1 Step 2: OTP
    otpDigits: ['', '', '', '', '', ''],
    resendTimer: 45,

    // Phase 2 Step 1: Profile
    logoUrl: '',
    schoolType: 'Nursery & Primary School',
    category: 'Private Independent School',
    motto: '',

    // Phase 2 Step 2: Location
    address: '',
    state: 'Lagos',
    lga: '',
    landmark: '',
    latitude: 6.5244,
    longitude: 3.3792,

    // Phase 2 Step 3: Admin Details
    adminName: '',
    adminPosition: 'Proprietor / Director',
    adminEmail: '',
    adminPhone: '',
    altPhone: '',

    // Phase 2 Step 4: Academic Setup
    academicSession: '2024/2025 Academic Session',
    calendarType: '3 Terms / Academic Year (Standard)',
    openingTime: '08:00 AM',
    closingTime: '02:00 PM',
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [sentOtpCode, setSentOtpCode] = useState<string | null>(null);

  // OTP Input References
  const otpInputRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];

  // Resend Countdown Timer for OTP
  useEffect(() => {
    if (phase !== 'otp_verify' || form.resendTimer <= 0) return;
    const interval = setInterval(() => {
      setForm((prev) => ({ ...prev, resendTimer: prev.resendTimer - 1 }));
    }, 1000);
    return () => clearInterval(interval);
  }, [phase, form.resendTimer]);

  // General Input Handler
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setForm((prev) => ({ ...prev, [name]: checked }));
    } else {
      setForm((prev) => ({ ...prev, [name]: value }));
    }
  };

  // Image Logo Upload Handler
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select a valid image file (JPEG, PNG, WebP)');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Logo file size must be less than 5MB');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setForm((prev) => ({ ...prev, logoUrl: reader.result as string }));
      toast.success('School logo loaded successfully');
    };
    reader.readAsDataURL(file);
  };

  // Geolocation Handler
  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser');
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm((prev) => ({
          ...prev,
          latitude: Number(pos.coords.latitude.toFixed(6)),
          longitude: Number(pos.coords.longitude.toFixed(6)),
        }));
        setIsLocating(false);
        toast.success('Current coordinates pinned!');
      },
      (err) => {
        setIsLocating(false);
        toast.error(`Could not retrieve location: ${err.message}`);
      }
    );
  };

  // -------------------------------------------------------------
  // STAGE VALIDATIONS & SUBMISSIONS
  // -------------------------------------------------------------

  // Send real 6-digit OTP verification code email
  const sendVerificationEmail = async (targetEmail: string, recipientName: string) => {
    setSendingOtp(true);
    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: targetEmail,
          name: recipientName,
        }),
      });

      const data = await res.json();
      if (res.ok && data.code) {
        setSentOtpCode(data.code);
        toast.success(`6-digit verification code sent to ${targetEmail}`);
        setForm((prev) => ({ ...prev, otpDigits: ['', '', '', '', '', ''], resendTimer: 45 }));
      } else {
        toast.error(data.error || 'Failed to send verification code email');
      }
    } catch {
      toast.error('Network error sending verification code');
    } finally {
      setSendingOtp(false);
    }
  };

  const handleCreateAccountSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedName = form.schoolName.trim();
    const trimmedUser = form.usernameOrEmail.trim();
    const trimmedPhone = form.phone.trim();

    if (!trimmedName || trimmedName.length < 3) {
      toast.error('Please enter a valid school name (minimum 3 characters)');
      return;
    }
    if (!trimmedUser) {
      toast.error('Please enter a username or email address');
      return;
    }
    if (!trimmedPhone || trimmedPhone.length < 10) {
      toast.error('Please enter a valid 10 to 11 digit Nigerian phone number');
      return;
    }
    if (!form.password || form.password.length < 6) {
      toast.error('Password must be at least 6 characters long');
      return;
    }
    if (form.password !== form.confirmPassword) {
      toast.error('Password and confirm password do not match');
      return;
    }
    if (!form.agreeTerms) {
      toast.error('You must agree to the Terms of Service and Privacy Policy');
      return;
    }

    setLoading(true);

    try {
      const isEmail = trimmedUser.includes('@');
      const adminEmail = isEmail ? trimmedUser : `${trimmedUser.toLowerCase()}@myeduride.com`;
      const adminUsername = isEmail ? trimmedUser.split('@')[0] : trimmedUser;
      const fullPhone = `${form.countryCode}${trimmedPhone.replace(/^0/, '')}`;

      const res = await fetch('/api/schools/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: trimmedName,
          admin_name: `${trimmedName} Admin`,
          admin_username: adminUsername,
          admin_email: adminEmail,
          admin_phone: fullPhone,
          admin_password: form.password,
          confirm_password: form.confirmPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Account creation failed');
        setLoading(false);
        return;
      }

      setSchoolId(data.school_id || null);
      setForm((prev) => ({
        ...prev,
        adminName: `${trimmedName} Admin`,
        adminEmail: adminEmail,
        adminPhone: fullPhone,
      }));

      // Send actual 6-digit OTP code to admin email
      await sendVerificationEmail(adminEmail, trimmedName);

      // Advance to Step 2: OTP Verification
      setPhase('otp_verify');
    } catch {
      toast.error('Network error during registration. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // OTP Handling
  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;

    const newOtp = [...form.otpDigits];
    newOtp[index] = value.slice(-1);
    setForm((prev) => ({ ...prev, otpDigits: newOtp }));

    if (value && index < 5) {
      otpInputRefs[index + 1].current?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !form.otpDigits[index] && index > 0) {
      otpInputRefs[index - 1].current?.focus();
    }
  };

  const handleVerifyOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const enteredOtp = form.otpDigits.join('');

    if (enteredOtp.length < 6) {
      toast.error('Please enter all 6 digits of the verification code');
      return;
    }

    if (sentOtpCode && enteredOtp !== sentOtpCode) {
      toast.error('Invalid verification code. Please check your email or click Resend.');
      return;
    }

    setLoading(true);

    try {
      // Auto-authenticate / verify session
      const loginRes = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: form.usernameOrEmail.trim(),
          password: form.password,
        }),
      });

      if (!loginRes.ok) {
        toast.success('Account verified! Please log in to complete setup.');
        router.push('/auth/login');
        return;
      }

      toast.success('Account verified successfully!');
      // Transition to Phase 2 Wizard Step 1 (School Profile)
      setPhase('wizard');
      setWizardStep(1);
    } catch {
      toast.error('Verification check failed. Proceeding to setup.');
      setPhase('wizard');
      setWizardStep(1);
    } finally {
      setLoading(false);
    }
  };

  // Phase 2 Step 1: School Profile Validation & Save
  const handleStepProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.schoolName.trim() || form.schoolName.trim().length < 3) {
      toast.error('School name is required (minimum 3 characters)');
      return;
    }
    if (!form.schoolType) {
      toast.error('Please select a school type');
      return;
    }
    if (!form.category) {
      toast.error('Please select a school category');
      return;
    }

    setLoading(true);
    try {
      if (schoolId) {
        await fetch('/api/schools/settings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            school_id: schoolId,
            name: form.schoolName.trim(),
            logo_url: form.logoUrl || null,
            school_type: form.schoolType,
            category: form.category,
            motto: form.motto.trim() || null,
            setup_step: '2',
          }),
        });
      }
      setWizardStep(2);
      toast.success('School profile saved!');
    } catch {
      toast.error('Failed to save profile. Moving to location setup.');
      setWizardStep(2);
    } finally {
      setLoading(false);
    }
  };

  // Phase 2 Step 2: Location Validation & Save
  const handleStepLocationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.address.trim() || form.address.trim().length < 5) {
      toast.error('Please enter a full valid school address (minimum 5 characters)');
      return;
    }
    if (!form.state) {
      toast.error('Please select a state');
      return;
    }
    if (!form.lga) {
      toast.error('Please select an LGA for your school');
      return;
    }

    setLoading(true);
    try {
      if (schoolId) {
        await fetch('/api/schools/settings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            school_id: schoolId,
            address: form.address.trim(),
            state: form.state,
            lga: form.lga,
            landmark: form.landmark.trim() || null,
            latitude: form.latitude,
            longitude: form.longitude,
            setup_step: '3',
          }),
        });
      }
      setWizardStep(3);
      toast.success('School location saved!');
    } catch {
      toast.error('Failed to save location. Moving to administrator details.');
      setWizardStep(3);
    } finally {
      setLoading(false);
    }
  };

  // Phase 2 Step 3: Administrator Details Validation & Save
  const handleStepAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.adminName.trim() || form.adminName.trim().length < 3) {
      toast.error('Please enter administrator full name');
      return;
    }
    if (!form.adminPosition) {
      toast.error('Please select administrator position');
      return;
    }
    if (!form.adminEmail.trim() || !form.adminEmail.includes('@')) {
      toast.error('Please enter a valid administrator email address');
      return;
    }
    if (!form.adminPhone.trim() || form.adminPhone.trim().length < 10) {
      toast.error('Please enter a valid administrator phone number');
      return;
    }

    const generatedContactId = `ADM-${(schoolId || 'SCH').slice(0, 6).toUpperCase()}-${Date.now().toString().slice(-4)}`;
    setContactId(generatedContactId);

    setLoading(true);
    try {
      if (schoolId) {
        await fetch('/api/schools/settings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            school_id: schoolId,
            admin_name: form.adminName.trim(),
            admin_position: form.adminPosition,
            admin_email: form.adminEmail.trim(),
            admin_phone: form.adminPhone.trim(),
            alt_phone: form.altPhone.trim() || null,
            setup_step: '4',
          }),
        });
      }
      setWizardStep(4);
      toast.success(`Admin details saved! Contact ID: ${generatedContactId}`);
    } catch {
      toast.error('Failed to save admin details. Moving to academic setup.');
      setWizardStep(4);
    } finally {
      setLoading(false);
    }
  };

  // Phase 2 Step 4: Academic Setup Validation & Save
  const handleStepAcademicSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.academicSession) {
      toast.error('Please select academic session');
      return;
    }
    if (!form.calendarType) {
      toast.error('Please select school calendar');
      return;
    }
    if (!form.openingTime) {
      toast.error('Please select opening time');
      return;
    }
    if (!form.closingTime) {
      toast.error('Please select closing time');
      return;
    }

    setLoading(true);
    try {
      if (schoolId) {
        await fetch('/api/schools/settings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            school_id: schoolId,
            academic_session: form.academicSession,
            calendar_type: form.calendarType,
            opening_time: form.openingTime,
            closing_time: form.closingTime,
            setup_completed: true,
            setup_step: 'complete',
          }),
        });
      }
      setWizardStep(5);
      toast.success('Academic configuration saved! Setup complete 🎉');
    } catch {
      toast.error('Academic setup complete!');
      setWizardStep(5);
    } finally {
      setLoading(false);
    }
  };

  const selectedStateObj = NIGERIAN_STATES.find((s: NigerianState) => s.state === form.state);
  const lgaOptions = selectedStateObj ? selectedStateObj.lgas : [];

  return (
    <div
      className="min-h-screen bg-slate-900 font-poppins text-slate-100 flex flex-col selection:bg-emerald-600 selection:text-white bg-cover bg-center bg-no-repeat relative"
      style={{
        backgroundImage: "linear-gradient(to bottom, rgba(15, 23, 42, 0.75), rgba(15, 23, 42, 0.85)), url('/images/background%20image.png')",
      }}
    >

      {/* ------------------------------------------------------------- */}
      {/* TOP HEADER: DISC COMMUNICATION DEPARTMENT BANNER & PROMO      */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-slate-900 border-b border-slate-800 text-xs py-2 px-3 sm:px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-2.5">

          {/* Announcement Banner */}
          <div className="flex items-center gap-2 text-slate-200">
            <span className="bg-emerald-600 text-white font-extrabold px-2 py-0.5 rounded text-[10px] uppercase tracking-wider flex items-center gap-1 shadow-xs">
              <MegaphoneIcon /> DISC COMMUNICATION DEPARTMENT
            </span>
            <span className="truncate max-w-xl text-[11px] sm:text-xs">
              Important updates, promotions, safety info and adverts are <strong className="text-emerald-400">seen by all users across the platform</strong>.
            </span>
          </div>

          {/* Promo Callout */}
          <div className="flex items-center gap-3 bg-emerald-950/80 border border-emerald-500/40 rounded-xl px-3 py-1 text-emerald-300">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <div className="text-[11px] leading-tight">
              <span className="font-bold text-white block">Protect What Matters!</span>
              <span className="text-[10px] text-emerald-300">Get 20% off Insurance when you complete registration.</span>
            </div>
            <button
              type="button"
              onClick={() => toast.info('Insurance Partner Offer unlocked upon school verification!')}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] px-2.5 py-1 rounded-lg transition-all ml-1 shrink-0"
            >
              Learn More
            </button>
          </div>

        </div>
      </div>

      {/* Main Page Content */}
      <div className="flex-1 py-6 sm:py-10 px-3 sm:px-6 md:px-8 max-w-7xl mx-auto w-full">

        {/* Header Title Section */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-3">
              <Link href="/">
                <img src={LOGO_URL} alt="MyEduRide" className="h-10 sm:h-12 w-auto" />
              </Link>
              <div className="h-6 w-px bg-slate-800 hidden sm:block" />
              <span className="justify-center text-xs sm:text-sm font-bold text-emerald-400 uppercase tracking-widest bg-emerald-950/60 border border-emerald-500/30 px-3 py-1 rounded-full">
                SCHOOL SIGN-UP FLOW
              </span>
            </div>
            <p className="text-slate-400 text-xs sm:text-sm mt-2">
              <strong className="text-white">QUICK SIGN-UP NOW. COMPLETE SETUP LATER.</strong> Create your account in under 60 seconds and finish the rest anytime.
            </p>
          </div>

          {/* Role Selector Tabs */}
          <div className="bg-slate-900 border border-slate-800 p-1 rounded-2xl flex items-center gap-1 text-xs">
            <button
              type="button"
              onClick={() => onSwitchRole?.('parent')}
              className="px-3 py-1.5 rounded-xl font-medium text-slate-400 hover:text-white transition-all"
            >
              Parent
            </button>
            <button
              type="button"
              className="px-3.5 py-1.5 rounded-xl font-bold bg-emerald-600 text-white shadow-md flex items-center gap-1.5"
            >
              <Building2 size={14} />
              <span>School</span>
            </button>
            <button
              type="button"
              onClick={() => onSwitchRole?.('driver')}
              className="px-3 py-1.5 rounded-xl font-medium text-slate-400 hover:text-white transition-all"
            >
              Shared Escort
            </button>
          </div>
        </div>

        {/* ------------------------------------------------------------- */}
        {/* MAIN LAYOUT GRID: Left Mobile Frame + Right Desktop Sidebars   */}
        {/* ------------------------------------------------------------- */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

          {/* ========================================================= */}
          {/* LEFT CONTAINER: MOBILE-FIRST 375PX PREVIEW FRAME          */}
          {/* ========================================================= */}
          <div className="lg:col-span-6 xl:col-span-5 mx-auto w-full max-w-[400px]">

            {/* Mobile Device Frame styling */}
            <div className="bg-white text-slate-900 rounded-[32px] shadow-2xl border-4 border-slate-800 overflow-hidden flex flex-col relative transition-all">

              {/* Device Top Bar Mockup */}
              <div className="bg-slate-900 text-white px-5 py-2 flex items-center justify-between text-[11px] font-mono shrink-0">
                {/* <span>9:41</span>
                <div className="w-16 h-4 bg-slate-800 rounded-full mx-auto" />
                <div className="flex items-center gap-1">
                  <span>5G</span>
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                </div> */}
              </div>

              {/* ------------------------------------------------------- */}
              {/* PHASE 1 - STEP 1: CREATE SCHOOL ACCOUNT                 */}
              {/* ------------------------------------------------------- */}
              {phase === 'quick_signup' && (
                <div className="p-5 sm:p-6 space-y-4 animate-in fade-in zoom-in-95">

                  {/* Step Header Indicator */}
                  <div className="flex items-center justify-between text-[11px] font-bold text-emerald-800 uppercase tracking-wider bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                    <span>PHASE 1: QUICK SIGN-UP (30-60 SECS)</span>
                    <span className="bg-emerald-600 text-white px-2 py-0.5 rounded-full text-[10px]">STEP 1 OF 2</span>
                  </div>

                  <div className="text-center space-y-1">
                    <img src={LOGO_URL} alt="MyEduRide" className="h-8 mx-auto" />
                    <h2 className="text-xl font-extrabold text-slate-900">Create School Account</h2>
                    <p className="text-xs text-slate-500">Let's get your school on MyEduRide.</p>
                  </div>

                  <form onSubmit={handleCreateAccountSubmit} className="space-y-3">

                    {/* School Name */}
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        School Name <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <Building2 size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="text"
                          name="schoolName"
                          value={form.schoolName}
                          onChange={handleChange}
                          placeholder="e.g. Greenfield International School"
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all font-medium"
                        />
                      </div>
                    </div>

                    {/* Username or Email */}
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Username or Email <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="text"
                          name="usernameOrEmail"
                          value={form.usernameOrEmail}
                          onChange={handleChange}
                          placeholder="e.g. info@greenfieldschool.com or greenfieldadmin"
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all font-medium"
                        />
                      </div>
                    </div>

                    {/* Phone Number */}
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Phone Number <span className="text-red-500">*</span>
                      </label>
                      <div className="flex gap-2">
                        <select
                          name="countryCode"
                          value={form.countryCode}
                          onChange={handleChange}
                          className="bg-slate-50 border border-slate-200 rounded-xl px-2 py-2.5 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        >
                          <option value="+234">🇳🇬 +234</option>
                        </select>
                        <div className="relative flex-1">
                          <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                          <input
                            type="tel"
                            name="phone"
                            value={form.phone}
                            onChange={handleChange}
                            placeholder="e.g. 8031234567"
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all font-medium"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Password */}
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Password <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type={showPassword ? 'text' : 'password'}
                          name="password"
                          value={form.password}
                          onChange={handleChange}
                          placeholder="••••••••"
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-10 py-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all font-medium"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        >
                          {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </div>

                    {/* Confirm Password */}
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Confirm Password <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type={showConfirmPassword ? 'text' : 'password'}
                          name="confirmPassword"
                          value={form.confirmPassword}
                          onChange={handleChange}
                          placeholder="••••••••"
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-10 py-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all font-medium"
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        >
                          {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </div>

                    {/* Role Selector Card Buttons */}
                    <div>
                      <p className="text-[11px] font-semibold text-slate-700 mb-1.5">I am signing up as</p>
                      <div className="grid grid-cols-4 gap-1.5 text-center text-[10px]">
                        <button
                          type="button"
                          onClick={() => onSwitchRole?.('parent')}
                          className="p-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 font-semibold"
                        >
                          <User size={14} className="mx-auto mb-1 text-slate-500" />
                          Parent
                        </button>
                        <button
                          type="button"
                          className="p-2 rounded-xl border-2 border-emerald-600 bg-emerald-50 text-emerald-900 font-bold shadow-xs"
                        >
                          <Building2 size={14} className="mx-auto mb-1 text-emerald-600" />
                          School
                        </button>
                        <button
                          type="button"
                          onClick={() => onSwitchRole?.('driver')}
                          className="p-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 font-semibold"
                        >
                          <Users size={14} className="mx-auto mb-1 text-slate-500" />
                          Escort
                        </button>
                        <button
                          type="button"
                          onClick={() => onSwitchRole?.('driver')}
                          className="p-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 font-semibold"
                        >
                          <Shield size={14} className="mx-auto mb-1 text-slate-500" />
                          Fleet
                        </button>
                      </div>
                    </div>

                    {/* Terms Checkbox */}
                    <label className="flex items-start gap-2 text-[11px] text-slate-600 cursor-pointer pt-1">
                      <input
                        type="checkbox"
                        name="agreeTerms"
                        checked={form.agreeTerms}
                        onChange={handleChange}
                        className="mt-0.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                      />
                      <span>
                        I agree to the <a href="#" className="text-emerald-700 font-bold underline">Terms of Service</a> and <a href="#" className="text-emerald-700 font-bold underline">Privacy Policy</a>
                      </span>
                    </label>

                    {/* Primary Button */}
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs transition-all shadow-md shadow-emerald-600/30 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {loading ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <>
                          <span>Next</span>
                          <ArrowRight size={14} />
                        </>
                      )}
                    </button>

                    <p className="text-center text-xs text-slate-500 pt-1">
                      Already have an account?{' '}
                      <Link href="/auth/login" className="text-emerald-700 font-bold hover:underline">
                        Login
                      </Link>
                    </p>

                  </form>
                </div>
              )}

              {/* ------------------------------------------------------- */}
              {/* PHASE 1 - STEP 2: VERIFY ACCOUNT (OTP)                   */}
              {/* ------------------------------------------------------- */}
              {phase === 'otp_verify' && (
                <div className="p-5 sm:p-6 space-y-5 animate-in fade-in zoom-in-95 text-center">

                  <div className="flex items-center justify-between text-[11px] font-bold text-emerald-800 uppercase tracking-wider bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                    <span>PHASE 1: QUICK SIGN-UP</span>
                    <span className="bg-emerald-600 text-white px-2 py-0.5 rounded-full text-[10px]">STEP 2 OF 2</span>
                  </div>

                  <div className="w-14 h-14 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto text-emerald-700 shadow-inner">
                    <Mail size={28} />
                  </div>

                  <div>
                    <h2 className="text-xl font-extrabold text-slate-900">Verify Your Account</h2>
                    <p className="text-xs text-slate-600 mt-1">
                      We have sent a 6-digit code to{' '}
                      <strong className="text-slate-900">{form.usernameOrEmail || form.phone}</strong>
                    </p>
                  </div>

                  <form onSubmit={handleVerifyOtpSubmit} className="space-y-4">
                    <div className="flex justify-center gap-2">
                      {form.otpDigits.map((digit, idx) => (
                        <input
                          key={idx}
                          ref={otpInputRefs[idx]}
                          type="text"
                          maxLength={1}
                          value={digit}
                          onChange={(e) => handleOtpChange(idx, e.target.value)}
                          onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                          className="w-10 h-12 text-center text-lg font-bold bg-slate-50 border-2 border-slate-200 focus:border-emerald-600 focus:bg-white rounded-xl focus:outline-none transition-all"
                        />
                      ))}
                    </div>

                    <div className="text-xs text-slate-500">
                      Didn't receive code?{' '}
                      <button
                        type="button"
                        disabled={sendingOtp || form.resendTimer > 0}
                        onClick={() => sendVerificationEmail(form.adminEmail || form.usernameOrEmail, form.schoolName || 'School Admin')}
                        className="text-emerald-700 font-bold disabled:text-slate-400 hover:underline cursor-pointer"
                      >
                        {sendingOtp
                          ? 'Sending...'
                          : form.resendTimer > 0
                            ? `Resend in 00:${form.resendTimer.toString().padStart(2, '0')}`
                            : 'Resend Code'}
                      </button>
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs transition-all shadow-md shadow-emerald-600/30 flex items-center justify-center gap-2 cursor-pointer"
                    >
                      {loading ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <span>Verify & Continue</span>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => setPhase('quick_signup')}
                      className="w-full py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50 transition-all"
                    >
                      Change Email/Username
                    </button>

                    <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-left flex items-start gap-2.5 text-xs text-emerald-900">
                      <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold">Your account is created successfully!</p>
                        <p className="text-[11px] text-emerald-700 mt-0.5">You can complete the rest later from your dashboard anytime.</p>
                      </div>
                    </div>
                  </form>
                </div>
              )}

              {/* ------------------------------------------------------- */}
              {/* PHASE 2: COMPLETE SETUP WIZARD (STEPS 3 - 7)             */}
              {/* ------------------------------------------------------- */}
              {phase === 'wizard' && (
                <div className="p-5 sm:p-6 space-y-4 animate-in fade-in zoom-in-95">

                  {/* Wizard Header Progress Indicator */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-[11px] font-bold text-slate-700">
                      <span className="uppercase text-emerald-800 font-extrabold">PHASE 2: SETUP WIZARD</span>
                      <span className="text-emerald-700">Step {wizardStep} of 5</span>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-600 transition-all duration-300"
                        style={{ width: `${(wizardStep / 5) * 100}%` }}
                      />
                    </div>
                  </div>

                  {/* WIZARD STEP 1 (Step 3 of Total): SCHOOL PROFILE */}
                  {wizardStep === 1 && (
                    <form onSubmit={handleStepProfileSubmit} className="space-y-3">
                      <h3 className="text-lg font-extrabold text-slate-900">Tell us about your school</h3>

                      {/* Upload School Logo */}
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                          Upload School Logo <span className="text-slate-400 font-normal">(Optional)</span>
                        </label>
                        <div className="border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-2xl p-4 text-center bg-slate-50 transition-all relative">
                          {form.logoUrl ? (
                            <div className="flex flex-col items-center gap-2">
                              <img src={form.logoUrl} alt="Logo Preview" className="w-16 h-16 object-contain rounded-lg border border-slate-200" />
                              <button
                                type="button"
                                onClick={() => setForm((prev) => ({ ...prev, logoUrl: '' }))}
                                className="text-[10px] text-red-600 font-bold hover:underline"
                              >
                                Remove Logo
                              </button>
                            </div>
                          ) : (
                            <label className="cursor-pointer flex flex-col items-center gap-1.5">
                              <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
                                <Camera size={20} />
                              </div>
                              <span className="text-xs font-semibold text-slate-700">Upload School Logo</span>
                              <span className="text-[10px] text-slate-400">PNG, JPG, WebP up to 5MB</span>
                              <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                            </label>
                          )}
                        </div>
                      </div>

                      {/* School Name */}
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                          School Name <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          name="schoolName"
                          value={form.schoolName}
                          onChange={handleChange}
                          placeholder="e.g. Greenfield International School"
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                        />
                      </div>

                      {/* School Type */}
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                          School Type <span className="text-red-500">*</span>
                        </label>
                        <select
                          name="schoolType"
                          value={form.schoolType}
                          onChange={handleChange}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-emerald-500"
                        >
                          {SCHOOL_TYPES.map((t) => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </select>
                      </div>

                      {/* Category */}
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                          Category <span className="text-red-500">*</span>
                        </label>
                        <select
                          name="category"
                          value={form.category}
                          onChange={handleChange}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-emerald-500"
                        >
                          {SCHOOL_CATEGORIES.map((c) => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      </div>

                      {/* Motto */}
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                          Motto <span className="text-slate-400 font-normal">(Optional)</span>
                        </label>
                        <input
                          type="text"
                          name="motto"
                          value={form.motto}
                          onChange={handleChange}
                          placeholder="Enter school motto"
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs transition-all shadow-md shadow-emerald-600/30 flex items-center justify-center gap-2"
                      >
                        <span>Save & Continue</span>
                        <ArrowRight size={14} />
                      </button>
                    </form>
                  )}

                  {/* WIZARD STEP 2 (Step 4 of Total): SCHOOL LOCATION */}
                  {wizardStep === 2 && (
                    <form onSubmit={handleStepLocationSubmit} className="space-y-3">
                      <div>
                        <h3 className="text-lg font-extrabold text-slate-900">Pin your school location</h3>
                        <p className="text-xs text-slate-500">This helps students, parents and escorts find you easily.</p>
                      </div>

                      {/* Location Pin Map Preview Card */}
                      <div className="bg-slate-100 rounded-2xl p-3 border border-slate-200 text-center space-y-2">
                        <div className="h-24 bg-emerald-950/90 rounded-xl flex items-center justify-center relative overflow-hidden text-emerald-400">
                          <MapPin size={32} className="animate-bounce text-emerald-400" />
                          <span className="absolute bottom-2 left-2 text-[10px] text-white bg-slate-900/80 px-2 py-0.5 rounded font-mono">
                            {form.latitude.toFixed(4)}, {form.longitude.toFixed(4)}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={handleUseCurrentLocation}
                          disabled={isLocating}
                          className="w-full py-2 bg-white border border-slate-300 rounded-xl text-slate-800 font-bold text-xs hover:bg-slate-50 flex items-center justify-center gap-1.5"
                        >
                          <Compass size={14} className="text-emerald-600" />
                          <span>{isLocating ? 'Locating...' : 'Use Current Location'}</span>
                        </button>
                      </div>

                      {/* School Address */}
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                          School Address <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          name="address"
                          value={form.address}
                          onChange={handleChange}
                          placeholder="Enter full address"
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>

                      {/* State */}
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                          State <span className="text-red-500">*</span>
                        </label>
                        <select
                          name="state"
                          value={form.state}
                          onChange={handleChange}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-emerald-500"
                        >
                          {NIGERIAN_STATES.map((s: NigerianState) => (
                            <option key={s.state} value={s.state}>{s.state}</option>
                          ))}
                        </select>
                      </div>

                      {/* LGA */}
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                          LGA <span className="text-red-500">*</span>
                        </label>
                        <select
                          name="lga"
                          value={form.lga}
                          onChange={handleChange}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-emerald-500"
                        >
                          <option value="">Select LGA</option>
                          {lgaOptions.map((l: string) => (
                            <option key={l} value={l}>{l}</option>
                          ))}
                        </select>
                      </div>

                      {/* Landmark */}
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                          Landmark <span className="text-slate-400 font-normal">(Optional)</span>
                        </label>
                        <input
                          type="text"
                          name="landmark"
                          value={form.landmark}
                          onChange={handleChange}
                          placeholder="Enter landmark"
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>

                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setWizardStep(1)}
                          className="py-3 px-4 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50"
                        >
                          Back
                        </button>
                        <button
                          type="submit"
                          disabled={loading}
                          className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs transition-all shadow-md shadow-emerald-600/30 flex items-center justify-center gap-2"
                        >
                          <span>Save & Continue</span>
                          <ArrowRight size={14} />
                        </button>
                      </div>
                    </form>
                  )}

                  {/* WIZARD STEP 3 (Step 5 of Total): ADMINISTRATOR DETAILS */}
                  {wizardStep === 3 && (
                    <form onSubmit={handleStepAdminSubmit} className="space-y-3">
                      <div>
                        <h3 className="text-lg font-extrabold text-slate-900">Administrator Information</h3>
                        <p className="text-xs text-slate-500">Primary school contact person.</p>
                      </div>

                      {/* Administrator Name */}
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                          Administrator Name <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          name="adminName"
                          value={form.adminName}
                          onChange={handleChange}
                          placeholder="Enter full name"
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>

                      {/* Position */}
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                          Position <span className="text-red-500">*</span>
                        </label>
                        <select
                          name="adminPosition"
                          value={form.adminPosition}
                          onChange={handleChange}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-emerald-500"
                        >
                          {ADMIN_POSITIONS.map((p) => (
                            <option key={p} value={p}>{p}</option>
                          ))}
                        </select>
                      </div>

                      {/* Email */}
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                          Email <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="email"
                          name="adminEmail"
                          value={form.adminEmail}
                          onChange={handleChange}
                          placeholder="Enter email address"
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>

                      {/* Phone Number */}
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                          Phone Number <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="tel"
                          name="adminPhone"
                          value={form.adminPhone}
                          onChange={handleChange}
                          placeholder="Enter phone number"
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>

                      {/* Alternative Contact */}
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                          Alternative Contact <span className="text-slate-400 font-normal">(Optional)</span>
                        </label>
                        <input
                          type="tel"
                          name="altPhone"
                          value={form.altPhone}
                          onChange={handleChange}
                          placeholder="Enter phone number"
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>

                      <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-xs text-emerald-900">
                        <BadgeCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>A Contact ID will be generated after you complete setup.</span>
                      </div>

                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setWizardStep(2)}
                          className="py-3 px-4 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50"
                        >
                          Back
                        </button>
                        <button
                          type="submit"
                          disabled={loading}
                          className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs transition-all shadow-md shadow-emerald-600/30 flex items-center justify-center gap-2"
                        >
                          <span>Save & Continue</span>
                          <ArrowRight size={14} />
                        </button>
                      </div>
                    </form>
                  )}

                  {/* WIZARD STEP 4 (Step 6 of Total): ACADEMIC SETUP */}
                  {wizardStep === 4 && (
                    <form onSubmit={handleStepAcademicSubmit} className="space-y-3">
                      <div>
                        <h3 className="text-lg font-extrabold text-slate-900">Academic Information</h3>
                        <p className="text-xs text-slate-500">Set your academic details.</p>
                      </div>

                      {/* Academic Session */}
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                          Academic Session <span className="text-red-500">*</span>
                        </label>
                        <select
                          name="academicSession"
                          value={form.academicSession}
                          onChange={handleChange}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-emerald-500"
                        >
                          {ACADEMIC_SESSIONS.map((s) => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      </div>

                      {/* School Calendar */}
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                          School Calendar <span className="text-red-500">*</span>
                        </label>
                        <select
                          name="calendarType"
                          value={form.calendarType}
                          onChange={handleChange}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-emerald-500"
                        >
                          {CALENDAR_TYPES.map((c) => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      </div>

                      {/* Opening Time & Closing Time */}
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                            Opening Time <span className="text-red-500">*</span>
                          </label>
                          <div className="relative">
                            <Clock size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                              type="text"
                              name="openingTime"
                              value={form.openingTime}
                              onChange={handleChange}
                              placeholder="08:00 AM"
                              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-2 py-2 text-xs font-semibold text-slate-900"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                            Closing Time <span className="text-red-500">*</span>
                          </label>
                          <div className="relative">
                            <Clock size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                              type="text"
                              name="closingTime"
                              value={form.closingTime}
                              onChange={handleChange}
                              placeholder="02:00 PM"
                              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-2 py-2 text-xs font-semibold text-slate-900"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setWizardStep(3)}
                          className="py-3 px-4 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50"
                        >
                          Back
                        </button>
                        <button
                          type="submit"
                          disabled={loading}
                          className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs transition-all shadow-md shadow-emerald-600/30 flex items-center justify-center gap-2"
                        >
                          <span>Save & Continue</span>
                          <ArrowRight size={14} />
                        </button>
                      </div>
                    </form>
                  )}

                  {/* WIZARD STEP 5 (Step 7 of Total): ACTIVATE MODULES & COMPLETE */}
                  {wizardStep === 5 && (
                    <div className="text-center space-y-4 py-3">
                      <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto text-emerald-600 shadow-inner animate-bounce">
                        <CheckCircle size={40} />
                      </div>

                      <div>
                        <h3 className="text-2xl font-extrabold text-slate-900">You're All Set! 🎉</h3>
                        <p className="text-xs text-slate-500 mt-1">Your school setup is complete and ready.</p>
                      </div>

                      <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-left space-y-2 text-xs text-emerald-950 font-medium">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span>Your school account is active and verified.</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span>You can complete or update any information anytime.</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span>Start exploring MyEduRide school admin features now.</span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => router.push('/dashboard/school-admin')}
                        className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs transition-all shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <span>Go to Dashboard</span>
                        <ArrowRight size={16} />
                      </button>
                    </div>
                  )}

                </div>
              )}

            </div>
          </div>

          {/* ========================================================= */}
          {/* RIGHT SIDE CONTAINER: DESKTOP OVERVIEW & CARDS            */}
          {/* ========================================================= */}
          <div className="lg:col-span-6 xl:col-span-7 space-y-6">

            {/* WORKFLOW OVERVIEW CARD */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="font-extrabold text-sm text-emerald-400 uppercase tracking-wider flex items-center gap-2">
                  <FileText size={16} /> WORKFLOW OVERVIEW
                </h3>
                <span className="text-xs text-slate-400">Total Setup Time: &lt; 3 Mins</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">

                {/* Phase 1 Box */}
                <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2">
                  <span className="text-[10px] font-bold text-emerald-400 uppercase bg-emerald-950 px-2 py-0.5 rounded border border-emerald-500/30 block w-fit">
                    PHASE 1: QUICK SIGN-UP
                  </span>
                  <ol className="space-y-1.5 text-slate-300 font-medium">
                    <li className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0">1</span>
                      <span>Create School Account</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0">2</span>
                      <span>Verify Account (OTP)</span>
                    </li>
                    <li className="flex items-center gap-2 text-emerald-400 font-bold">
                      <CheckCircle size={14} className="shrink-0" />
                      <span>Start Using MyEduRide</span>
                    </li>
                  </ol>
                </div>

                {/* Phase 2 Box */}
                <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2">
                  <span className="text-[10px] font-bold text-blue-400 uppercase bg-blue-950 px-2 py-0.5 rounded border border-blue-500/30 block w-fit">
                    PHASE 2: COMPLETE SETUP
                  </span>
                  <ol className="space-y-1.5 text-slate-300 font-medium text-[11px]">
                    <li className="flex items-center gap-2">
                      <span className="w-4 h-4 rounded-full bg-slate-800 text-slate-300 text-[9px] font-bold flex items-center justify-center shrink-0">3</span>
                      <span>School Profile</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-4 h-4 rounded-full bg-slate-800 text-slate-300 text-[9px] font-bold flex items-center justify-center shrink-0">4</span>
                      <span>School Location</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-4 h-4 rounded-full bg-slate-800 text-slate-300 text-[9px] font-bold flex items-center justify-center shrink-0">5</span>
                      <span>Administrator Details</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-4 h-4 rounded-full bg-slate-800 text-slate-300 text-[9px] font-bold flex items-center justify-center shrink-0">6</span>
                      <span>Academic Setup</span>
                    </li>
                    <li className="flex items-center gap-2 text-emerald-400 font-bold">
                      <Sparkles size={14} className="shrink-0" />
                      <span>Activate Modules & Full Access</span>
                    </li>
                  </ol>
                </div>

              </div>
            </div>

            {/* WHY SCHOOLS CHOOSE MYEDURIDE */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
              <h3 className="font-extrabold text-sm text-slate-100 uppercase tracking-wider flex items-center gap-2">
                <Award size={16} className="text-emerald-400" /> WHY SCHOOLS CHOOSE MYEDURIDE
              </h3>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center text-xs">

                <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 flex flex-col items-center">
                  <div className="w-10 h-10 rounded-xl bg-emerald-950 text-emerald-400 flex items-center justify-center mb-2">
                    <Clock size={20} />
                  </div>
                  <span className="font-bold text-white block">Save Time</span>
                  <span className="text-[10px] text-slate-400 mt-0.5">Quick signup in 60s</span>
                </div>

                <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 flex flex-col items-center">
                  <div className="w-10 h-10 rounded-xl bg-emerald-950 text-emerald-400 flex items-center justify-center mb-2">
                    <ShieldCheck size={20} />
                  </div>
                  <span className="font-bold text-white block">More Safety</span>
                  <span className="text-[10px] text-slate-400 mt-0.5">Priority student release</span>
                </div>

                <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 flex flex-col items-center">
                  <div className="w-10 h-10 rounded-xl bg-emerald-950 text-emerald-400 flex items-center justify-center mb-2">
                    <Sparkles size={20} />
                  </div>
                  <span className="font-bold text-white block">Easy to Use</span>
                  <span className="text-[10px] text-slate-400 mt-0.5">Simple & powerful</span>
                </div>

                <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 flex flex-col items-center">
                  <div className="w-10 h-10 rounded-xl bg-emerald-950 text-emerald-400 flex items-center justify-center mb-2">
                    <Users size={20} />
                  </div>
                  <span className="font-bold text-white block">Connected</span>
                  <span className="text-[10px] text-slate-400 mt-0.5">Parents & escorts sync</span>
                </div>

                <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 flex flex-col items-center col-span-2 sm:col-span-1">
                  <div className="w-10 h-10 rounded-xl bg-emerald-950 text-emerald-400 flex items-center justify-center mb-2">
                    <Building2 size={20} />
                  </div>
                  <span className="font-bold text-white block">Grow Smarter</span>
                  <span className="text-[10px] text-slate-400 mt-0.5">Data-driven insights</span>
                </div>

              </div>
            </div>

            {/* MIGO - YOUR SCHOOL ASSISTANT */}
            <div className="bg-gradient-to-r from-slate-900 via-emerald-950/60 to-slate-900 border border-emerald-500/30 rounded-3xl p-5 sm:p-6 shadow-xl flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-2xl bg-emerald-600 flex items-center justify-center text-white shadow-lg shrink-0">
                  <Sparkles size={28} />
                </div>
                <div>
                  <h4 className="font-extrabold text-sm text-white">MIGO — YOUR SCHOOL ASSISTANT</h4>
                  <p className="text-xs text-slate-300 mt-0.5">
                    "Hi! I'm Migo. I'll guide you step by step to set up your school and get the most out of MyEduRide."
                  </p>
                  <span className="text-[10px] text-emerald-400 font-bold block mt-1">Powered by SAVI Intelligence</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setMigoModalOpen(true)}
                className="py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-all shadow-md shrink-0 flex items-center gap-1.5 cursor-pointer"
              >
                <MessageSquare size={14} />
                <span>Chat with Migo</span>
              </button>
            </div>

            {/* WHAT HAPPENS NEXT */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-3">
              <h3 className="font-extrabold text-sm text-slate-100 uppercase tracking-wider flex items-center gap-2">
                <HelpCircle size={16} className="text-emerald-400" /> WHAT HAPPENS NEXT?
              </h3>

              <ul className="space-y-2 text-xs text-slate-300 font-medium">
                <li className="flex items-center gap-2">
                  <CheckCircle size={14} className="text-emerald-400 shrink-0" />
                  <span>You can start using MyEduRide immediately after quick signup.</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle size={14} className="text-emerald-400 shrink-0" />
                  <span>Complete remaining setup wizard anytime from your dashboard.</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle size={14} className="text-emerald-400 shrink-0" />
                  <span>Invite staff, add students and connect with verified escorts.</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle size={14} className="text-emerald-400 shrink-0" />
                  <span>Get full access to all platform features and pickup reports.</span>
                </li>
              </ul>
            </div>

            {/* DISC BOTTOM TRUST BANNER */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white font-bold">
                  DISC
                </div>
                <div>
                  <span className="font-bold text-white block">Verified &amp; Trusted</span>
                  <span className="text-[11px] text-slate-400">You are in safe hands with MyEduRide.</span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-300">
                <span className="bg-slate-800 px-2.5 py-1 rounded-full border border-slate-700">Safe Transport</span>
                <span className="bg-slate-800 px-2.5 py-1 rounded-full border border-slate-700">Real-time Tracking</span>
                <span className="bg-slate-800 px-2.5 py-1 rounded-full border border-slate-700">Smart Reports</span>
                <span className="bg-slate-800 px-2.5 py-1 rounded-full border border-slate-700">24/7 Support</span>
              </div>
            </div>

          </div>

        </div>

      </div>

      {/* Migo AI Chat Assistant Modal */}
      <MigoChatModal isOpen={migoModalOpen} onClose={() => setMigoModalOpen(false)} />
    </div>
  );
}

function MegaphoneIcon() {
  return (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="m3 11 18-5v12L3 13v-2z" />
      <path d="M11.6 16.8 a3 3 0 1 1-5.8-1.6" />
    </svg>
  );
}
