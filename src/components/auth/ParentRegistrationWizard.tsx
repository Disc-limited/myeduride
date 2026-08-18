// @ts-nocheck
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  User,
  Mail,
  Phone,
  Lock,
  Eye,
  EyeOff,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  CheckCircle,
  Users,
  Building2,
  ShieldCheck,
  Calendar,
  MapPin,
  Plus,
  Trash2,
  Bell,
  MessageSquare,
  CreditCard,
  Building,
  Keypad,
  Delete,
  Shield,
  Clock,
  Sparkles,
  Home,
  Check,
  HelpCircle,
  ChevronRight,
  Wallet,
  Car,
  FileText,
  Award,
  Smartphone,
  PhoneCall,
  Loader2,
  RefreshCw,
  Search,
} from 'lucide-react';
import { toast } from 'sonner';

const LOGO_URL = '/images/eduride_logo.png';

const DEFAULT_CLASSES = [
  'Nursery 1',
  'Nursery 2',
  'Primary 1',
  'Primary 2',
  'Primary 3',
  'Primary 4',
  'Primary 5',
  'Primary 6',
  'JSS 1',
  'JSS 2',
  'JSS 3',
  'SSS 1',
  'SSS 2',
  'SSS 3',
];

const BottomWave = () => (
  <div className="w-full overflow-hidden leading-none rounded-b-[24px] sm:rounded-b-[28px] -mb-1 mt-auto">
    <svg viewBox="0 0 500 120" preserveAspectRatio="none" className="w-full h-12 sm:h-16 md:h-20">
      <path d="M 280,50 C 360,15 440,25 500,15 L 500,120 L 280,120 Z" fill="#E6F2FF" />
      <path d="M 0,0 C 90,40 180,65 270,65 C 180,75 90,55 0,95 Z" fill="#FFC107" />
      <path d="M 0,40 C 120,70 230,85 340,65 C 410,50 460,40 500,35 L 500,120 L 0,120 Z" fill="#28A745" />
      <path d="M 0,85 C 100,75 200,70 300,65 C 380,60 440,55 500,50 L 500,120 L 0,120 Z" fill="#0D4A71" />
    </svg>
  </div>
);

interface ParentRegistrationWizardProps {
  onSwitchRole?: (role: 'parent' | 'school' | 'driver') => void;
}

export default function ParentRegistrationWizard({ onSwitchRole }: ParentRegistrationWizardProps) {
  const router = useRouter();
  const [step, setStep] = useState(1);

  // Database Registered Schools
  const [availableSchools, setAvailableSchools] = useState<
    Array<{ id: string; name: string; address: string; state: string; city: string }>
  >([]);

  // Database Classes & Enrolled Students for Selected School
  const [schoolClasses, setSchoolClasses] = useState<string[]>(DEFAULT_CLASSES);
  const [existingStudents, setExistingStudents] = useState<
    Array<{ id: string; name: string; grade: string; student_id_number?: string; photo?: string }>
  >([]);
  const [loadingSchoolDetails, setLoadingSchoolDetails] = useState(false);

  // Fetch Registered Schools from Database
  useEffect(() => {
    fetch('/api/public/schools')
      .then((res) => res.json())
      .then((data) => {
        if (data?.schools && Array.isArray(data.schools)) {
          setAvailableSchools(data.schools);
          if (data.schools.length > 0) {
            const first = data.schools[0];
            setForm((prev) => ({
              ...prev,
              schoolName: first.name,
              schoolAddress: first.address,
              state: first.state || 'Lagos',
              city: first.city || 'Lagos',
            }));
          }
        }
      })
      .catch(() => {});
  }, []);

  // Form State
  const [accountType, setAccountType] = useState<'email' | 'phone'>('email');
  const [form, setForm] = useState({
    emailOrUsername: '',
    password: '',
    confirmPassword: '',
    agreeTerms: true,
    // Step 2 OTP
    otp: ['', '', '', '', '', ''],
    // Step 3 Personal
    fullName: '',
    dob: '',
    gender: 'Female',
    address: '',
    phone: '',
    emergencyContact: '',
    // Step 4 School & Class (From DB)
    state: 'Lagos',
    city: 'Lagos',
    schoolName: '',
    schoolAddress: '',
    grade: '',
    // Step 5 Children (From DB or Entered)
    children: [],
    // Step 6 Preferences
    preferences: {
      trackChildren: true,
      tripAlerts: true,
      digitalAttendance: true,
      feePayment: true,
      communicate: true,
      marketplace: true,
    },
    // Step 7 Notifications
    notifications: {
      push: true,
      sms: true,
      email: true,
      voice: true,
      whatsapp: true,
    },
    // Step 8 Security PIN
    pin: ['', '', '', ''],
    // Step 9 & 10 Wallet & Payment
    paymentMethod: 'card',
    // Step 11 Communication
    communication: {
      school: true,
      sharedEscort: true,
      cityManager: true,
      discSupport: true,
    },
    // Step 12 Terms
    agreedDocuments: true,
  });

  // Fetch School Details (Classes & Students) whenever schoolName changes
  useEffect(() => {
    if (!form.schoolName) return;
    setLoadingSchoolDetails(true);

    const foundSchool = availableSchools.find((s) => s.name === form.schoolName);
    const query = foundSchool
      ? `school_id=${foundSchool.id}`
      : `school_name=${encodeURIComponent(form.schoolName)}`;

    fetch(`/api/public/school-details?${query}`)
      .then((res) => res.json())
      .then((data) => {
        if (data?.classes && Array.isArray(data.classes) && data.classes.length > 0) {
          setSchoolClasses(data.classes);
          if (!form.grade || !data.classes.includes(form.grade)) {
            setForm((prev) => ({ ...prev, grade: data.classes[0] || 'Primary 1' }));
          }
        }
        if (data?.students && Array.isArray(data.students)) {
          setExistingStudents(data.students);
        } else {
          setExistingStudents([]);
        }
      })
      .catch(() => {})
      .finally(() => setLoadingSchoolDetails(false));
  }, [form.schoolName, availableSchools]);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showAddChildModal, setShowAddChildModal] = useState(false);
  const [selectedStudentFromDb, setSelectedStudentFromDb] = useState<string>('');
  const [newChild, setNewChild] = useState({ name: '', grade: 'Primary 1', dob: '' });
  const [activeDocModal, setActiveDocModal] = useState<string | null>(null);

  // Backend & OTP State
  const [submitting, setSubmitting] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [sentOtpCode, setSentOtpCode] = useState<string | null>(null);
  const [resendTimer, setResendTimer] = useState(45);

  const [registeredParent, setRegisteredParent] = useState<{
    name: string;
    username: string;
    userId: string;
  } | null>(null);

  const nextStep = () => setStep((prev) => Math.min(prev + 1, 15));
  const prevStep = () => setStep((prev) => Math.max(prev - 1, 1));

  // Active Resend Countdown Timer Effect
  useEffect(() => {
    if (step !== 2 || resendTimer <= 0) return;
    const interval = setInterval(() => {
      setResendTimer((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [step, resendTimer]);

  // Format Timer string e.g. "00:45"
  const formatTimer = (seconds: number) => {
    const s = Math.max(0, seconds);
    return `00:${s < 10 ? '0' + s : s}`;
  };

  // Send real OTP email to user
  const sendVerificationEmail = async (targetEmail?: string) => {
    const emailToSend =
      targetEmail ||
      (form.emailOrUsername.includes('@')
        ? form.emailOrUsername
        : `${form.emailOrUsername || 'user'}@gmail.com`);

    setSendingOtp(true);
    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: emailToSend,
          name: form.fullName || 'Parent',
        }),
      });

      const data = await res.json();
      if (res.ok && data.code) {
        setSentOtpCode(data.code);
        toast.success(`Verification code sent to ${emailToSend}`);
        // Reset OTP input boxes so the user must retrieve and enter the code from their email
        setForm((prev) => ({ ...prev, otp: ['', '', '', '', '', ''] }));
      } else {
        toast.error(data.error || 'Failed to send verification code email');
      }
    } catch {
      toast.error('Network error sending verification code');
    } finally {
      setSendingOtp(false);
      setResendTimer(45);
    }
  };

  // Step 1 Validation & OTP Trigger
  const handleStep1Next = async () => {
    if (!form.emailOrUsername.trim()) {
      toast.error('Please enter an email address or username');
      return;
    }
    if (!form.password) {
      toast.error('Please enter a password');
      return;
    }
    if (form.password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    if (form.password !== form.confirmPassword) {
      toast.error('Password and confirm password do not match');
      return;
    }
    if (!form.agreeTerms) {
      toast.error('You must agree to the Terms of Service & Privacy Policy');
      return;
    }

    await sendVerificationEmail();
    nextStep();
  };

  // Step 2 OTP Verification
  const handleVerifyOtp = () => {
    const enteredOtp = form.otp.join('');
    if (enteredOtp.length < 6) {
      toast.error('Please enter all 6 digits of the verification code');
      return;
    }
    if (sentOtpCode && enteredOtp !== sentOtpCode) {
      toast.error('Invalid verification code. Please check your email or click Resend.');
      return;
    }
    toast.success('Email verified successfully!');
    nextStep();
  };

  // Handle School Selection
  const handleSchoolSelect = (schoolName: string) => {
    const found = availableSchools.find((s) => s.name === schoolName);
    setForm({
      ...form,
      schoolName,
      schoolAddress: found?.address || form.schoolAddress,
      state: found?.state || form.state,
      city: found?.city || form.city,
    });
  };

  // Handle Adding Child (from DB or manually)
  const handleAddChild = () => {
    if (selectedStudentFromDb) {
      const foundStud = existingStudents.find((s) => s.id === selectedStudentFromDb);
      if (foundStud) {
        if (form.children.some((c) => c.id === foundStud.id)) {
          toast.error('This child is already added');
          return;
        }
        setForm({
          ...form,
          children: [
            ...form.children,
            {
              id: foundStud.id,
              name: foundStud.name,
              grade: foundStud.grade || form.grade,
              school: form.schoolName,
              dob: '01/01/2018',
              photo: foundStud.photo || 'https://images.unsplash.com/photo-1543332164-6e82f355badc?auto=format&fit=crop&q=80&w=200',
            },
          ],
        });
        toast.success(`Added ${foundStud.name} from school records!`);
        setSelectedStudentFromDb('');
        setShowAddChildModal(false);
        return;
      }
    }

    if (!newChild.name.trim()) {
      toast.error('Please enter child name or select a student from database');
      return;
    }

    setForm({
      ...form,
      children: [
        ...form.children,
        {
          id: Date.now().toString(),
          name: newChild.name,
          grade: newChild.grade || form.grade || 'Primary 1',
          school: form.schoolName,
          dob: newChild.dob || '01/01/2018',
          photo: 'https://images.unsplash.com/photo-1543332164-6e82f355badc?auto=format&fit=crop&q=80&w=200',
        },
      ],
    });
    setNewChild({ name: '', grade: form.grade || 'Primary 1', dob: '' });
    setShowAddChildModal(false);
    toast.success('Child added successfully');
  };

  // Final Submission to Database at Step 12
  const handleCreateAccount = async () => {
    if (!form.agreedDocuments) {
      toast.error('Please agree to the documents to complete registration');
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch('/api/parents/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: form.fullName || form.emailOrUsername.split('@')[0] || 'Parent',
          email: form.emailOrUsername.includes('@') ? form.emailOrUsername : null,
          phone: form.phone,
          password: form.password,
          confirmPassword: form.confirmPassword,
          dob: form.dob,
          gender: form.gender,
          address: form.address,
          emergencyContact: form.emergencyContact,
          children: form.children,
          schoolName: form.schoolName,
          preferences: form.preferences,
          notifications: form.notifications,
          pin: form.pin,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Registration failed');
        setSubmitting(false);
        return;
      }

      toast.success('Parent account created successfully in database!');
      setRegisteredParent({
        name: form.fullName || form.emailOrUsername.split('@')[0] || 'Parent',
        username: data.username || 'parent',
        userId: data.user_id,
      });

      setSubmitting(false);
      nextStep();
    } catch {
      toast.error('Failed to create account. Please check network connection.');
      setSubmitting(false);
    }
  };

  // Keypad for PIN
  const handlePinPress = (val: string) => {
    const currentPin = [...form.pin];
    const emptyIndex = currentPin.findIndex((p) => p === '');
    if (emptyIndex !== -1) {
      currentPin[emptyIndex] = val;
      setForm({ ...form, pin: currentPin });
    }
  };

  const handlePinDelete = () => {
    const currentPin = [...form.pin];
    const lastFilled = currentPin.map((p) => p !== '').lastIndexOf(true);
    if (lastFilled !== -1) {
      currentPin[lastFilled] = '';
      setForm({ ...form, pin: currentPin });
    }
  };

  return (
    <div
      className="min-h-screen bg-slate-900 font-poppins text-slate-800 py-2 sm:py-8 px-2 sm:px-4 flex flex-col items-center justify-center relative selection:bg-brand-green selection:text-white bg-cover bg-center bg-no-repeat"
      style={{
        backgroundImage: "linear-gradient(to bottom, rgba(15, 23, 42, 0.7), rgba(15, 23, 42, 0.8)), url('/images/background%20image.png')",
      }}
    >
      
      {/* Top Banner Notice */}
      <div className="max-w-4xl w-full mb-3 sm:mb-4 bg-gradient-to-r from-[#0D4A71] via-slate-900 to-[#0D4A71] text-white p-3 sm:p-4 rounded-2xl shadow-md flex flex-wrap items-center justify-between gap-2.5 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-amber-400 text-slate-900 flex items-center justify-center font-bold shrink-0 text-xs sm:text-sm">
            📢
          </div>
          <div>
            <span className="font-bold text-amber-300 uppercase tracking-wider block text-[9px] sm:text-[10px]">
              DISC COMMUNICATION DEPARTMENT
            </span>
            <span className="text-slate-200 text-[11px] sm:text-xs">
              Important updates, promotions & security info across MyEduRide.
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2 bg-emerald-950/80 px-2.5 sm:px-3 py-1.5 rounded-xl border border-emerald-500/30">
          <Shield className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400" />
          <span className="text-emerald-300 font-semibold text-[10px] sm:text-[11px]">
            Protect What Matters! 20% off Insurance
          </span>
        </div>
      </div>

      {/* Main Wizard Mobile Frame Container */}
      <div className="max-w-[440px] w-full bg-white rounded-2xl sm:rounded-[32px] shadow-2xl border border-slate-200 overflow-hidden flex flex-col relative min-h-[580px] sm:min-h-[720px] max-h-[92vh] sm:max-h-none">
        
        {/* Role & Sign In Toggle Switcher Header */}
        <div className="bg-slate-900 px-3.5 sm:px-4 py-2 sm:py-2.5 flex items-center justify-between text-white text-xs font-semibold shrink-0 gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-slate-400 text-[10px] sm:text-[11px] font-bold uppercase tracking-wider hidden xs:inline shrink-0">Role:</span>
            <div className="flex bg-slate-800 p-0.5 rounded-xl text-[10px] sm:text-[11px]">
              <button
                type="button"
                onClick={() => onSwitchRole?.('parent')}
                className="px-2 sm:px-2.5 py-1 rounded-lg bg-[#28A745] text-white font-bold transition-all shadow-xs cursor-pointer"
              >
                Parent
              </button>
              <button
                type="button"
                onClick={() => onSwitchRole?.('school')}
                className="px-2 sm:px-2.5 py-1 rounded-lg text-slate-300 hover:text-white transition-all cursor-pointer"
              >
                School
              </button>
              <button
                type="button"
                onClick={() => onSwitchRole?.('driver')}
                className="px-2 sm:px-2.5 py-1 rounded-lg text-slate-300 hover:text-white transition-all cursor-pointer"
              >
                Escort
              </button>
            </div>
          </div>

          <Link
            href="/auth/login"
            className="px-2.5 sm:px-3 py-1 rounded-xl bg-[#28A745] hover:bg-[#208838] text-white text-[10px] sm:text-[11px] font-bold transition-all shadow-xs flex items-center gap-1 cursor-pointer shrink-0"
          >
            <span>Sign In</span>
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        {/* Step Indicator Header Bar */}
        <div className="bg-slate-50 px-4 sm:px-5 py-3 border-b border-slate-200/80 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-1.5 sm:gap-2">
            {step > 1 && (
              <button
                type="button"
                onClick={prevStep}
                className="p-1 rounded-full hover:bg-slate-200 text-slate-700 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <span className="text-[11px] sm:text-xs font-bold text-[#0D4A71] uppercase tracking-wider">
              Step {step} of 15
            </span>
          </div>

          <div className="flex items-center gap-0.5 sm:gap-1">
            {Array.from({ length: 15 }).map((_, idx) => (
              <div
                key={idx}
                className={`h-1.5 rounded-full transition-all ${
                  idx + 1 === step
                    ? 'w-3.5 sm:w-4 bg-[#28A745]'
                    : idx + 1 < step
                    ? 'w-1 sm:w-1.5 bg-[#28A745]/50'
                    : 'w-1 sm:w-1.5 bg-slate-200'
                }`}
              />
            ))}
          </div>
        </div>

        {/* STEP 1: CREATE ACCOUNT */}
        {step === 1 && (
          <div className="p-4 sm:p-6 space-y-4 sm:space-y-5 flex-1 flex flex-col justify-between overflow-y-auto">
            <div className="space-y-3.5 sm:space-y-4">
              <div className="text-center">
                <img src={LOGO_URL} alt="MyEduRide" className="h-8 sm:h-10 mx-auto mb-1" />
                <h2 className="text-lg sm:text-xl font-bold text-[#0D4A71]">Create Your Parent Account</h2>
                <p className="text-[11px] sm:text-xs text-slate-500">Join MyEduRide and keep your children safe on every trip.</p>
              </div>

              {/* Account Type Toggle */}
              <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-semibold text-slate-600">
                <button
                  type="button"
                  onClick={() => setAccountType('email')}
                  className={`flex-1 py-1.5 sm:py-2 rounded-lg transition-all ${
                    accountType === 'email' ? 'bg-[#28A745] text-white shadow-xs' : 'hover:text-slate-900'
                  }`}
                >
                  Email / Username
                </button>
                <button
                  type="button"
                  onClick={() => setAccountType('phone')}
                  className={`flex-1 py-1.5 sm:py-2 rounded-lg transition-all ${
                    accountType === 'phone' ? 'bg-[#28A745] text-white shadow-xs' : 'hover:text-slate-900'
                  }`}
                >
                  Phone Number
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {accountType === 'email' ? 'Email or Username' : 'Phone Number'}
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                    <input
                      type="text"
                      value={form.emailOrUsername}
                      onChange={(e) => setForm({ ...form, emailOrUsername: e.target.value })}
                      placeholder={accountType === 'email' ? 'Enter email or username' : 'Enter phone number'}
                      className="w-full h-11 pl-10 pr-4 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#28A745]/30 focus:border-[#28A745]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Password</label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                      placeholder="Create a strong password"
                      className="w-full h-11 pl-10 pr-10 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#28A745]/30 focus:border-[#28A745]"
                    />
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setShowPassword((prev) => !prev);
                      }}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      className="absolute right-3 top-2.5 z-20 p-1 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer pointer-events-auto rounded-lg hover:bg-slate-200/50"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Confirm Password</label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={form.confirmPassword}
                      onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                      placeholder="Confirm your password"
                      className="w-full h-11 pl-10 pr-10 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#28A745]/30 focus:border-[#28A745]"
                    />
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setShowConfirmPassword((prev) => !prev);
                      }}
                      aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                      className="absolute right-3 top-2.5 z-20 p-1 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer pointer-events-auto rounded-lg hover:bg-slate-200/50"
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Role selection mini cards */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1.5">I am signing up as</label>
                  <div className="grid grid-cols-4 gap-1 sm:gap-1.5 text-center text-[10px] sm:text-xs font-semibold">
                    <button
                      type="button"
                      onClick={() => onSwitchRole?.('parent')}
                      className="p-2 rounded-xl bg-emerald-50 border border-[#28A745] text-emerald-800 font-bold cursor-pointer"
                    >
                      Parent
                    </button>
                    <button
                      type="button"
                      onClick={() => onSwitchRole?.('school')}
                      className="p-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-500 hover:bg-slate-100 cursor-pointer"
                    >
                      School
                    </button>
                    <button
                      type="button"
                      onClick={() => onSwitchRole?.('driver')}
                      className="p-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-500 hover:bg-slate-100 cursor-pointer"
                    >
                      Escort
                    </button>
                    <button
                      type="button"
                      onClick={() => onSwitchRole?.('driver')}
                      className="p-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-500 hover:bg-slate-100 cursor-pointer"
                    >
                      Fleet
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    checked={form.agreeTerms}
                    onChange={(e) => setForm({ ...form, agreeTerms: e.target.checked })}
                    className="accent-[#28A745]"
                  />
                  <span className="text-[11px] text-slate-600">
                    I agree to the <span className="text-[#0D4A71] font-semibold">Terms of Service</span> and{' '}
                    <span className="text-[#0D4A71] font-semibold">Privacy Policy</span>
                  </span>
                </div>
              </div>
            </div>

            <button
              type="button"
              disabled={sendingOtp}
              onClick={handleStep1Next}
              className="w-full h-11 sm:h-12 rounded-xl bg-[#28A745] text-white font-bold text-xs sm:text-sm shadow-md flex items-center justify-center gap-2 hover:bg-[#208838] cursor-pointer disabled:opacity-50 mt-2"
            >
              {sendingOtp ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Sending Verification Code...</span>
                </>
              ) : (
                <>
                  <span>Next</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            <div className="text-center pt-2">
              <p className="text-xs text-slate-600">
                Already have an account?{' '}
                <Link href="/auth/login" className="text-[#0D4A71] font-bold hover:underline">
                  Sign In
                </Link>
              </p>
            </div>
          </div>
        )}

        {/* STEP 2: VERIFY EMAIL/USERNAME */}
        {step === 2 && (
          <div className="p-4 sm:p-6 space-y-5 sm:space-y-6 flex-1 flex flex-col justify-between overflow-y-auto">
            <div className="space-y-3.5 sm:space-y-4 text-center">
              <div className="w-12 h-12 sm:w-14 sm:h-14 bg-sky-50 text-[#0D4A71] rounded-2xl flex items-center justify-center mx-auto">
                <Mail className="w-6 h-6 sm:w-7 sm:h-7" />
              </div>
              <h2 className="text-lg sm:text-xl font-bold text-[#0D4A71]">Verify Your Email/Username</h2>
              <p className="text-[11px] sm:text-xs text-slate-500">
                Enter the 6-digit verification code sent to <br />
                <span className="font-semibold text-slate-800">
                  {form.emailOrUsername.includes('@')
                    ? form.emailOrUsername
                    : form.emailOrUsername
                    ? `${form.emailOrUsername}@gmail.com`
                    : 'your email address'}
                </span>
              </p>

              {/* 6 OTP Box Inputs */}
              <div className="flex justify-center gap-1.5 sm:gap-2 py-3 sm:py-4">
                {form.otp.map((digit, idx) => (
                  <input
                    key={idx}
                    type="text"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => {
                      const newOtp = [...form.otp];
                      newOtp[idx] = e.target.value;
                      setForm({ ...form, otp: newOtp });
                    }}
                    className="w-9 h-11 sm:w-10 sm:h-12 text-center text-base sm:text-lg font-bold bg-slate-50 border border-slate-300 rounded-xl focus:border-[#28A745] focus:bg-white outline-none"
                  />
                ))}
              </div>

              {/* Active Resend Countdown Timer */}
              <p className="text-[11px] sm:text-xs text-slate-500">
                Didn't receive code?{' '}
                {resendTimer > 0 ? (
                  <span className="text-slate-500 font-medium">
                    Resend in <strong className="text-[#28A745] font-bold">{formatTimer(resendTimer)}</strong>
                  </span>
                ) : (
                  <button
                    type="button"
                    disabled={sendingOtp}
                    onClick={() => sendVerificationEmail()}
                    className="text-[#28A745] font-bold hover:underline cursor-pointer disabled:opacity-50 inline-flex items-center gap-1"
                  >
                    {sendingOtp ? (
                      <>
                        <Loader2 className="w-3 h-3 animate-spin" />
                        <span>Sending...</span>
                      </>
                    ) : (
                      <span>Resend Code</span>
                    )}
                  </button>
                )}
              </p>

              <button
                type="button"
                onClick={prevStep}
                className="text-[11px] sm:text-xs text-[#0D4A71] font-semibold hover:underline block mx-auto cursor-pointer"
              >
                Change Email/Username
              </button>
            </div>

            <div className="space-y-3">
              <div className="bg-emerald-50/60 p-2.5 sm:p-3 rounded-xl border border-emerald-100 flex items-center gap-2 text-[10px] sm:text-[11px] text-emerald-800">
                <ShieldCheck className="w-4 h-4 text-[#28A745] shrink-0" />
                <span>Your information is safe with us. We never share your details.</span>
              </div>
              <button
                type="button"
                onClick={handleVerifyOtp}
                className="w-full h-11 sm:h-12 rounded-xl bg-[#28A745] text-white font-bold text-xs sm:text-sm shadow-md flex items-center justify-center gap-2 hover:bg-[#208838] cursor-pointer"
              >
                <span>Verify & Continue</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: PERSONAL INFORMATION */}
        {step === 3 && (
          <div className="p-4 sm:p-6 space-y-4 flex-1 flex flex-col justify-between overflow-y-auto">
            <div className="space-y-3">
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-[#0D4A71]">Personal Information</h2>
                <p className="text-[11px] sm:text-xs text-slate-500">Tell us about yourself</p>
              </div>

              <div className="space-y-2.5 sm:space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
                  <input
                    type="text"
                    value={form.fullName}
                    onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                    placeholder="Enter your full name"
                    className="w-full h-11 px-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Date of Birth</label>
                    <input
                      type="date"
                      value={form.dob}
                      onChange={(e) => setForm({ ...form, dob: e.target.value })}
                      className="w-full h-11 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Gender</label>
                    <select
                      value={form.gender}
                      onChange={(e) => setForm({ ...form, gender: e.target.value })}
                      className="w-full h-11 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                    >
                      <option value="Female">Female</option>
                      <option value="Male">Male</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Residential Address</label>
                  <input
                    type="text"
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                    placeholder="Enter residential address"
                    className="w-full h-11 px-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Phone Number</label>
                  <input
                    type="text"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="+234..."
                    className="w-full h-11 px-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Emergency Contact</label>
                  <input
                    type="text"
                    value={form.emergencyContact}
                    onChange={(e) => setForm({ ...form, emergencyContact: e.target.value })}
                    placeholder="Emergency phone number"
                    className="w-full h-11 px-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  />
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={nextStep}
              className="w-full h-11 sm:h-12 rounded-xl bg-[#28A745] text-white font-bold text-xs sm:text-sm shadow-md flex items-center justify-center gap-2 cursor-pointer mt-2"
            >
              <span>Continue</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* STEP 4: SCHOOL INFORMATION & CLASS (Loaded from DB) */}
        {step === 4 && (
          <div className="p-4 sm:p-6 space-y-4 flex-1 flex flex-col justify-between overflow-y-auto">
            <div className="space-y-3">
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-[#0D4A71]">Select School & Class</h2>
                <p className="text-[11px] sm:text-xs text-slate-500">
                  Choose your child's registered school and class from the database
                </p>
              </div>

              <div className="space-y-2.5 sm:space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Select State</label>
                  <select
                    value={form.state}
                    onChange={(e) => setForm({ ...form, state: e.target.value })}
                    className="w-full h-11 px-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs cursor-pointer"
                  >
                    <option value="Lagos">Lagos</option>
                    <option value="Abuja">Abuja</option>
                    <option value="Rivers">Rivers</option>
                    <option value="Ogun">Ogun</option>
                    <option value="Oyo">Oyo</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Select City</label>
                  <select
                    value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                    className="w-full h-11 px-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs cursor-pointer"
                  >
                    <option value="Lekki">Lekki</option>
                    <option value="Ikeja">Ikeja</option>
                    <option value="Victoria Island">Victoria Island</option>
                    <option value="Surulere">Surulere</option>
                    <option value="Yaba">Yaba</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    School Name (Registered Database Schools)
                  </label>
                  <select
                    value={form.schoolName}
                    onChange={(e) => handleSchoolSelect(e.target.value)}
                    className="w-full h-11 px-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 cursor-pointer"
                  >
                    {availableSchools.map((s) => (
                      <option key={s.id} value={s.name}>
                        {s.name} ({s.city})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-slate-700">
                      Select Class / Grade (School Classes DB)
                    </label>
                    {loadingSchoolDetails && <Loader2 className="w-3 h-3 animate-spin text-[#28A745]" />}
                  </div>
                  <select
                    value={form.grade}
                    onChange={(e) => setForm({ ...form, grade: e.target.value })}
                    className="w-full h-11 px-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-brand-green cursor-pointer"
                  >
                    {schoolClasses.map((cls) => (
                      <option key={cls} value={cls}>
                        {cls}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">School Address</label>
                  <input
                    type="text"
                    value={form.schoolAddress}
                    onChange={(e) => setForm({ ...form, schoolAddress: e.target.value })}
                    placeholder="Enter school address"
                    className="w-full h-11 px-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600"
                  />
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={nextStep}
              className="w-full h-11 sm:h-12 rounded-xl bg-[#28A745] text-white font-bold text-xs sm:text-sm shadow-md flex items-center justify-center gap-2 cursor-pointer hover:bg-[#208838] mt-2"
            >
              <span>Continue to Add Children</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* STEP 5: ADD YOUR CHILDREN (From DB Roster or New Entry) */}
        {step === 5 && (
          <div className="p-4 sm:p-6 space-y-4 flex-1 flex flex-col justify-between overflow-y-auto">
            <div className="space-y-3">
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-[#0D4A71]">Add Your Children</h2>
                <p className="text-[11px] sm:text-xs text-slate-500">
                  Select existing students or add children for <span className="font-semibold text-slate-800">{form.schoolName}</span>
                </p>
              </div>

              {/* Children List */}
              <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1">
                {form.children.length === 0 ? (
                  <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-50 border border-dashed border-slate-300 text-center space-y-1.5 py-5">
                    <Users className="w-7 h-7 text-slate-400 mx-auto" />
                    <p className="text-[11px] sm:text-xs text-slate-500">No children added yet for this school.</p>
                  </div>
                ) : (
                  form.children.map((child) => (
                    <div
                      key={child.id}
                      className="p-2.5 sm:p-3 bg-slate-50 rounded-2xl border border-slate-200 flex items-center gap-3"
                    >
                      <img
                        src={child.photo}
                        alt={child.name}
                        className="w-10 h-10 sm:w-12 sm:h-12 rounded-full object-cover border-2 border-white shadow-xs shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <h4 className="text-xs font-bold text-slate-900 truncate">{child.name}</h4>
                        <p className="text-[11px] font-semibold text-brand-green">{child.grade}</p>
                        <p className="text-[10px] text-slate-500 truncate">{child.school}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <button
                type="button"
                onClick={() => {
                  setNewChild({ name: '', grade: form.grade || 'Primary 1', dob: '' });
                  setSelectedStudentFromDb('');
                  setShowAddChildModal(true);
                }}
                className="w-full py-2.5 sm:py-3 rounded-2xl border-2 border-dashed border-[#28A745]/40 text-[#28A745] font-semibold text-xs hover:border-[#28A745] hover:bg-emerald-50/50 transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>+ Add Child (Pick from DB or Enter)</span>
              </button>

              <div className="p-2.5 sm:p-3 rounded-xl bg-emerald-50 text-[10px] sm:text-[11px] text-emerald-800 border border-emerald-100 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#28A745] shrink-0" />
                <span>You can add more children anytime from your parent dashboard.</span>
              </div>
            </div>

            <button
              type="button"
              onClick={nextStep}
              className="w-full h-11 sm:h-12 rounded-xl bg-[#28A745] text-white font-bold text-xs sm:text-sm shadow-md flex items-center justify-center gap-2 cursor-pointer mt-2"
            >
              <span>Continue</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* STEP 6: PARENT PREFERENCES */}
        {step === 6 && (
          <div className="p-4 sm:p-6 space-y-4 flex-1 flex flex-col justify-between overflow-y-auto">
            <div className="space-y-3">
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-[#0D4A71]">Preferences</h2>
                <p className="text-[11px] sm:text-xs text-slate-500">Choose how you want to use MyEduRide</p>
              </div>

              <div className="space-y-2">
                {[
                  { key: 'trackChildren', label: 'Track My Children', sub: 'Real-time trip tracking' },
                  { key: 'tripAlerts', label: 'Receive Trip Alerts', sub: 'Pickup, drop-off & safety alerts' },
                  { key: 'digitalAttendance', label: 'Digital Attendance', sub: 'Attendance updates' },
                  { key: 'feePayment', label: 'Fee & Payment', sub: 'Manage payments easily' },
                  { key: 'communicate', label: 'Communicate', sub: 'Chat with school & escort' },
                  { key: 'marketplace', label: 'Marketplace', sub: 'Book shared escort seats' },
                ].map((pref) => (
                  <label
                    key={pref.key}
                    className="p-2.5 sm:p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between cursor-pointer hover:bg-emerald-50/40"
                  >
                    <div>
                      <span className="text-xs font-bold text-slate-800 block">{pref.label}</span>
                      <span className="text-[10px] text-slate-500 block">{pref.sub}</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={form.preferences[pref.key]}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          preferences: { ...form.preferences, [pref.key]: e.target.checked },
                        })
                      }
                      className="w-4 h-4 accent-[#28A745]"
                    />
                  </label>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={nextStep}
              className="w-full h-11 sm:h-12 rounded-xl bg-[#28A745] text-white font-bold text-xs sm:text-sm shadow-md flex items-center justify-center gap-2 cursor-pointer mt-2"
            >
              <span>Continue</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* STEP 7: NOTIFICATIONS & ALERTS */}
        {step === 7 && (
          <div className="p-4 sm:p-6 space-y-4 flex-1 flex flex-col justify-between overflow-y-auto">
            <div className="space-y-3">
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-[#0D4A71]">Notification Preferences</h2>
                <p className="text-[11px] sm:text-xs text-slate-500">Choose how you want to be notified</p>
              </div>

              <div className="space-y-2 sm:space-y-2.5">
                {[
                  { key: 'push', label: 'Push Notifications', sub: 'In-app alerts', icon: Bell },
                  { key: 'sms', label: 'SMS Alerts', sub: 'Trip & safety updates', icon: Smartphone },
                  { key: 'email', label: 'Email Alerts', sub: 'Important updates', icon: Mail },
                  { key: 'voice', label: 'Voice Call Alerts', sub: 'For urgent notifications', icon: PhoneCall },
                  { key: 'whatsapp', label: 'WhatsApp Alerts', sub: 'Trip and safety updates', icon: MessageSquare },
                ].map((item) => {
                  const IconComp = item.icon;
                  return (
                    <div
                      key={item.key}
                      className="p-2.5 sm:p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2.5 sm:gap-3">
                        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-emerald-100 text-[#28A745] flex items-center justify-center">
                          <IconComp className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        </div>
                        <div>
                          <span className="text-xs font-bold text-slate-800 block">{item.label}</span>
                          <span className="text-[10px] text-slate-500 block">{item.sub}</span>
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={form.notifications[item.key]}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            notifications: { ...form.notifications, [item.key]: e.target.checked },
                          })
                        }
                        className="w-4 h-4 accent-[#28A745]"
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            <button
              type="button"
              onClick={nextStep}
              className="w-full h-11 sm:h-12 rounded-xl bg-[#28A745] text-white font-bold text-xs sm:text-sm shadow-md flex items-center justify-center gap-2 cursor-pointer mt-2"
            >
              <span>Continue</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* STEP 8: CREATE SECURITY PIN */}
        {step === 8 && (
          <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 flex-1 flex flex-col justify-between text-center overflow-y-auto">
            <div className="space-y-3 sm:space-y-4">
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-[#0D4A71]">Create 4-Digit PIN</h2>
                <p className="text-[11px] sm:text-xs text-slate-500">Set a 4-digit PIN for quick and secure access.</p>
              </div>

              {/* PIN Dots */}
              <div className="flex justify-center gap-3 sm:gap-4 py-2 sm:py-4">
                {[0, 1, 2, 3].map((idx) => (
                  <div
                    key={idx}
                    className={`w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full transition-all ${
                      form.pin[idx] ? 'bg-[#0D4A71] scale-110' : 'bg-slate-200'
                    }`}
                  />
                ))}
              </div>
              <p className="text-[10px] sm:text-[11px] text-slate-500">You will use this PIN to login quickly and securely.</p>

              {/* Keypad */}
              <div className="grid grid-cols-3 gap-2.5 sm:gap-3 max-w-[220px] sm:max-w-[240px] mx-auto pt-1 sm:pt-2">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => handlePinPress(num)}
                    className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-slate-100 hover:bg-slate-200 text-base sm:text-lg font-bold text-slate-800 flex items-center justify-center mx-auto cursor-pointer"
                  >
                    {num}
                  </button>
                ))}
                <div className="w-12 h-12 sm:w-14 sm:h-14 flex items-center justify-center text-slate-400 mx-auto text-xs">🔒</div>
                <button
                  type="button"
                  onClick={() => handlePinPress('0')}
                  className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-slate-100 hover:bg-slate-200 text-base sm:text-lg font-bold text-slate-800 flex items-center justify-center mx-auto cursor-pointer"
                >
                  0
                </button>
                <button
                  type="button"
                  onClick={handlePinDelete}
                  className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center mx-auto cursor-pointer"
                >
                  ⌫
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={nextStep}
              className="w-full h-11 sm:h-12 rounded-xl bg-[#28A745] text-white font-bold text-xs sm:text-sm shadow-md flex items-center justify-center gap-2 cursor-pointer mt-2"
            >
              <span>Continue</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* STEP 9: WALLET SETUP */}
        {step === 9 && (
          <div className="p-4 sm:p-6 space-y-4 sm:space-y-5 flex-1 flex flex-col justify-between overflow-y-auto">
            <div className="space-y-3.5 sm:space-y-4">
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-[#0D4A71]">My Wallet</h2>
                <p className="text-[11px] sm:text-xs text-slate-500">Set up your MyEduRide wallet to make payments.</p>
              </div>

              {/* Wallet Balance Card */}
              <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-[#28A745] to-emerald-700 text-white shadow-lg space-y-1">
                <span className="text-[10px] sm:text-[11px] font-semibold opacity-80 uppercase tracking-wider">Wallet Balance</span>
                <h3 className="text-2xl sm:text-3xl font-extrabold">₦0.00</h3>
              </div>

              <div className="bg-slate-50 p-3.5 sm:p-4 rounded-2xl border border-slate-200 space-y-1.5 sm:space-y-2">
                <h4 className="text-xs font-bold text-slate-800">Add Money to Get Started</h4>
                <p className="text-[10px] sm:text-[11px] text-slate-500">Fund your wallet for rides, fees and other services.</p>
              </div>
            </div>

            <div className="space-y-2 text-center mt-2">
              <button
                type="button"
                onClick={nextStep}
                className="w-full h-11 sm:h-12 rounded-xl bg-[#28A745] text-white font-bold text-xs sm:text-sm shadow-md flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Fund Wallet</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <button type="button" onClick={nextStep} className="text-xs text-slate-500 font-semibold hover:underline pt-1 cursor-pointer">
                Do this Later
              </button>
            </div>
          </div>
        )}

        {/* STEP 10: PAYMENT METHODS */}
        {step === 10 && (
          <div className="p-4 sm:p-6 space-y-4 flex-1 flex flex-col justify-between overflow-y-auto">
            <div className="space-y-3">
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-[#0D4A71]">Payment Methods</h2>
                <p className="text-[11px] sm:text-xs text-slate-500">Save payment methods for faster checkout.</p>
              </div>

              <div className="space-y-2 sm:space-y-2.5">
                {[
                  { id: 'card', label: 'Debit/Credit Card', sub: 'Visa, Mastercard, Verve' },
                  { id: 'bank', label: 'Bank Account', sub: 'Pay directly from your bank' },
                  { id: 'ussd', label: 'USSD', sub: '*737# quick payment' },
                  { id: 'wallet', label: 'MyEduRide Wallet', sub: 'Use wallet balance' },
                ].map((pm) => (
                  <label
                    key={pm.id}
                    className={`p-3 sm:p-3.5 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                      form.paymentMethod === pm.id
                        ? 'border-[#28A745] bg-emerald-50/70 shadow-xs'
                        : 'border-slate-200 bg-slate-50'
                    }`}
                  >
                    <div>
                      <span className="text-xs font-bold text-slate-800 block">{pm.label}</span>
                      <span className="text-[10px] text-slate-500 block">{pm.sub}</span>
                    </div>
                    <input
                      type="radio"
                      name="paymentMethod"
                      checked={form.paymentMethod === pm.id}
                      onChange={() => setForm({ ...form, paymentMethod: pm.id })}
                      className="accent-[#28A745]"
                    />
                  </label>
                ))}
              </div>

              <p className="text-[10px] sm:text-[11px] text-slate-500 text-center">Your payment information is secure and encrypted.</p>
            </div>

            <button
              type="button"
              onClick={nextStep}
              className="w-full h-11 sm:h-12 rounded-xl bg-[#28A745] text-white font-bold text-xs sm:text-sm shadow-md flex items-center justify-center gap-2 cursor-pointer mt-2"
            >
              <span>Continue</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* STEP 11: COMMUNICATION ACCESS */}
        {step === 11 && (
          <div className="p-4 sm:p-6 space-y-4 flex-1 flex flex-col justify-between overflow-y-auto">
            <div className="space-y-3">
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-[#0D4A71]">Communication Access</h2>
                <p className="text-[11px] sm:text-xs text-slate-500">Connect with the people who keep your child safe.</p>
              </div>

              <div className="space-y-2 sm:space-y-2.5">
                {[
                  { key: 'school', label: 'School', sub: 'Chat with school' },
                  { key: 'sharedEscort', label: 'Shared Escort', sub: 'Chat with escort' },
                  { key: 'cityManager', label: 'City Manager', sub: 'Report issues & get help' },
                  { key: 'discSupport', label: 'DISC Support', sub: '24/7 customer support' },
                ].map((item) => (
                  <div
                    key={item.key}
                    className="p-2.5 sm:p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between"
                  >
                    <div>
                      <span className="text-xs font-bold text-slate-800 block">{item.label}</span>
                      <span className="text-[10px] text-slate-500 block">{item.sub}</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={form.communication[item.key]}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          communication: { ...form.communication, [item.key]: e.target.checked },
                        })
                      }
                      className="w-4 h-4 accent-[#28A745]"
                    />
                  </div>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={nextStep}
              className="w-full h-11 sm:h-12 rounded-xl bg-[#28A745] text-white font-bold text-xs sm:text-sm shadow-md flex items-center justify-center gap-2 cursor-pointer mt-2"
            >
              <span>Continue</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* STEP 12: TERMS & AGREEMENT (Real Database Registration Trigger) */}
        {step === 12 && (
          <div className="p-4 sm:p-6 space-y-4 flex-1 flex flex-col justify-between overflow-y-auto">
            <div className="space-y-3">
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-[#0D4A71]">Terms & Agreement</h2>
                <p className="text-[11px] sm:text-xs text-slate-500">Please read and agree to continue</p>
              </div>

              <div className="space-y-2">
                {[
                  'Terms of Service',
                  'Privacy Policy',
                  'Parent Agreement',
                  'Child Data Policy',
                  'Safety Policy',
                ].map((doc) => (
                  <div
                    key={doc}
                    className="p-2.5 sm:p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between"
                  >
                    <span className="text-xs font-semibold text-slate-800">{doc}</span>
                    <button
                      type="button"
                      onClick={() => setActiveDocModal(doc)}
                      className="px-2.5 py-1 rounded-lg bg-sky-50 text-[#0D4A71] text-[10px] sm:text-[11px] font-bold hover:bg-sky-100 cursor-pointer"
                    >
                      View
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  checked={form.agreedDocuments}
                  onChange={(e) => setForm({ ...form, agreedDocuments: e.target.checked })}
                  className="w-4 h-4 accent-[#28A745] cursor-pointer"
                />
                <span className="text-[11px] text-slate-600">
                  I have read, understood and agree to the above documents.
                </span>
              </div>
            </div>

            <button
              type="button"
              disabled={submitting}
              onClick={handleCreateAccount}
              className="w-full h-11 sm:h-12 rounded-xl bg-[#28A745] hover:bg-[#208838] text-white font-bold text-xs sm:text-sm shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-2"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving Account to Database...</span>
                </>
              ) : (
                <>
                  <span>Create Account</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        )}

        {/* STEP 13: VERIFICATION IN PROGRESS */}
        {step === 13 && (
          <div className="p-4 sm:p-6 space-y-4 sm:space-y-5 flex-1 flex flex-col justify-between overflow-y-auto">
            <div className="space-y-3.5 sm:space-y-4">
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-[#0D4A71]">Verification in Progress</h2>
                <p className="text-[11px] sm:text-xs text-slate-500">We are reviewing your information</p>
              </div>

              <div className="space-y-2.5 sm:space-y-3">
                <div className="flex items-center gap-3 p-2.5 sm:p-3 rounded-xl bg-emerald-50 text-emerald-800 text-xs font-semibold">
                  <CheckCircle className="w-5 h-5 text-[#28A745] shrink-0" />
                  <span>Account Created (Saved in Database)</span>
                </div>
                <div className="flex items-center gap-3 p-2.5 sm:p-3 rounded-xl bg-emerald-50 text-emerald-800 text-xs font-semibold">
                  <CheckCircle className="w-5 h-5 text-[#28A745] shrink-0" />
                  <span>Email Verified (Completed)</span>
                </div>
                <div className="flex items-center gap-3 p-2.5 sm:p-3 rounded-xl bg-amber-50 text-amber-900 text-xs font-semibold">
                  <Sparkles className="w-5 h-5 text-amber-500 shrink-0" />
                  <span>Information Review (In Review)</span>
                </div>
                <div className="flex items-center gap-3 p-2.5 sm:p-3 rounded-xl bg-slate-50 text-slate-500 text-xs font-semibold">
                  <Clock className="w-5 h-5 text-slate-400 shrink-0" />
                  <span>School Verification (Active)</span>
                </div>
              </div>

              <div className="p-3.5 sm:p-4 rounded-2xl bg-sky-50 border border-sky-100 flex items-center justify-between text-xs text-[#0D4A71]">
                <div>
                  <span className="font-bold block">Status</span>
                  <span className="text-base sm:text-lg font-extrabold text-[#28A745]">Account Provisioned</span>
                </div>
                <Clock className="w-7 h-7 sm:w-8 sm:h-8 opacity-40" />
              </div>
            </div>

            <button
              type="button"
              onClick={nextStep}
              className="w-full h-11 sm:h-12 rounded-xl bg-[#28A745] text-white font-bold text-xs sm:text-sm shadow-md flex items-center justify-center gap-2 cursor-pointer mt-2"
            >
              <span>View Account Summary</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* STEP 14: ACCOUNT APPROVED */}
        {step === 14 && (
          <div className="p-4 sm:p-6 space-y-5 sm:space-y-6 flex-1 flex flex-col justify-between text-center animate-in zoom-in-95 overflow-y-auto">
            <div className="space-y-3.5 sm:space-y-4">
              <div className="w-16 h-16 sm:w-20 sm:h-20 bg-emerald-100 text-[#28A745] rounded-full flex items-center justify-center mx-auto shadow-inner">
                <CheckCircle className="w-10 h-10 sm:w-12 sm:h-12" />
              </div>

              <div>
                <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900">Congratulations! 🎉</h2>
                <p className="text-[11px] sm:text-xs text-slate-500 mt-1">Your parent account has been created in the database.</p>
              </div>

              {/* Parent ID Card Badge */}
              <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center gap-3.5 sm:gap-4 text-left max-w-xs mx-auto">
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-emerald-100 text-[#28A745] flex items-center justify-center font-bold text-lg sm:text-xl shrink-0 border-2 border-[#28A745]">
                  {(registeredParent?.name || form.fullName || 'P')[0].toUpperCase()}
                </div>
                <div className="min-w-0">
                  <h4 className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                    {registeredParent?.name || form.fullName || 'Parent User'}
                  </h4>
                  <p className="text-[11px] font-semibold text-brand-green">Parent Account</p>
                  <p className="text-[10px] font-mono text-slate-500">
                    ID: {registeredParent?.username || 'parent'}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2 mt-2">
              <button
                type="button"
                onClick={nextStep}
                className="w-full h-11 sm:h-12 rounded-xl bg-[#28A745] text-white font-bold text-xs sm:text-sm shadow-md flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Go to Dashboard</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => router.push('/auth/login')}
                className="text-xs text-[#0D4A71] font-semibold hover:underline block mx-auto cursor-pointer"
              >
                Sign In to Account
              </button>
            </div>
          </div>
        )}

        {/* STEP 15: WELCOME DASHBOARD PREVIEW */}
        {step === 15 && (
          <div className="p-4 space-y-3.5 sm:space-y-4 flex-1 flex flex-col justify-between bg-slate-50 overflow-y-auto">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm sm:text-base font-extrabold text-slate-900">
                    Welcome, {(registeredParent?.name || form.fullName || 'Parent').split(' ')[0]}! 👋
                  </h3>
                  <p className="text-[10px] sm:text-[11px] text-slate-500">Your MyEduRide account is ready.</p>
                </div>
                <div className="w-8 h-8 rounded-full bg-emerald-100 text-[#28A745] flex items-center justify-center">
                  <Bell className="w-4 h-4" />
                </div>
              </div>

              {/* Active Trip Card */}
              <div className="p-3.5 sm:p-4 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900">Student Trip Status</span>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                    Active
                  </span>
                </div>

                <div className="text-[11px] text-slate-600 space-y-1">
                  <p>School: <strong>{form.schoolName || 'Greenfield International'}</strong></p>
                  <p>Children Linked: <strong>{form.children.length} Child(ren)</strong></p>
                </div>

                <button
                  type="button"
                  onClick={() => router.push('/dashboard/parent')}
                  className="w-full py-2 rounded-xl bg-[#28A745] text-white font-bold text-xs shadow-xs cursor-pointer"
                >
                  Go to Live Dashboard
                </button>
              </div>

              {/* Quick Actions Grid */}
              <div className="grid grid-cols-4 gap-1.5 sm:gap-2 text-center text-[9px] sm:text-[10px] font-semibold">
                <div className="p-2 sm:p-2.5 rounded-xl bg-white border border-slate-200 space-y-1 shadow-xs">
                  <Users className="w-4 h-4 sm:w-5 sm:h-5 text-[#28A745] mx-auto" />
                  <span>My Children</span>
                </div>
                <div className="p-2 sm:p-2.5 rounded-xl bg-white border border-slate-200 space-y-1 shadow-xs">
                  <Car className="w-4 h-4 sm:w-5 sm:h-5 text-sky-600 mx-auto" />
                  <span>Trip History</span>
                </div>
                <div className="p-2 sm:p-2.5 rounded-xl bg-white border border-slate-200 space-y-1 shadow-xs">
                  <Wallet className="w-4 h-4 sm:w-5 sm:h-5 text-amber-500 mx-auto" />
                  <span>Wallet</span>
                </div>
                <div className="p-2 sm:p-2.5 rounded-xl bg-white border border-slate-200 space-y-1 shadow-xs">
                  <MessageSquare className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-500 mx-auto" />
                  <span>Messages</span>
                </div>
              </div>
            </div>

            {/* Bottom Nav Bar */}
            <div className="pt-2 border-t border-slate-200 flex items-center justify-around text-[9px] sm:text-[10px] font-semibold text-slate-500">
              <div className="text-[#28A745] flex flex-col items-center">
                <Home className="w-4 h-4" />
                <span>Home</span>
              </div>
              <div className="flex flex-col items-center">
                <Car className="w-4 h-4" />
                <span>Trips</span>
              </div>
              <div className="flex flex-col items-center">
                <Wallet className="w-4 h-4" />
                <span>Wallet</span>
              </div>
              <div className="flex flex-col items-center">
                <MessageSquare className="w-4 h-4" />
                <span>Messages</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => router.push('/dashboard/parent')}
              className="w-full h-10 sm:h-11 rounded-xl bg-[#0D4A71] text-white font-bold text-xs shadow-md mt-1 cursor-pointer"
            >
              Enter Parent Dashboard
            </button>
          </div>
        )}

        {/* Bottom Decorative Swoosh Wave */}
        <BottomWave />
      </div>

      {/* Modal: Add Child (Select from DB Roster or Enter New Details) */}
      {showAddChildModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 max-w-[92vw] sm:max-w-sm w-full space-y-3.5 sm:space-y-4 shadow-2xl max-h-[88vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="text-sm sm:text-base font-bold text-[#0D4A71]">Add Child Details</h3>
              <button
                type="button"
                onClick={() => setShowAddChildModal(false)}
                className="text-slate-400 font-bold hover:text-slate-600 text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              {/* Option A: Select Enrolled Student from Database */}
              {existingStudents.length > 0 && (
                <div className="p-2.5 sm:p-3 bg-emerald-50/70 border border-emerald-200 rounded-2xl space-y-1.5">
                  <label className="block text-xs font-bold text-emerald-900">
                    🎓 Select Enrolled Student (School DB Roster)
                  </label>
                  <select
                    value={selectedStudentFromDb}
                    onChange={(e) => setSelectedStudentFromDb(e.target.value)}
                    className="w-full h-10 px-2.5 bg-white border border-emerald-300 rounded-xl text-xs font-semibold text-slate-900 cursor-pointer"
                  >
                    <option value="">-- Pick from School Student Roster --</option>
                    {existingStudents.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.grade}) {s.student_id_number ? `[ID: ${s.student_id_number}]` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Option B: Enter New Child Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {existingStudents.length > 0 ? 'Or Enter Child Name Manually' : 'Child Name'}
                </label>
                <input
                  type="text"
                  value={newChild.name}
                  disabled={!!selectedStudentFromDb}
                  onChange={(e) => setNewChild({ ...newChild, name: e.target.value })}
                  placeholder="e.g. Samuel Adewale"
                  className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Selected School</label>
                <input
                  type="text"
                  readOnly
                  value={form.schoolName}
                  className="w-full h-10 px-3 bg-slate-100 border border-slate-200 rounded-xl text-xs text-slate-600 font-semibold cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Class / Grade</label>
                <select
                  value={newChild.grade}
                  disabled={!!selectedStudentFromDb}
                  onChange={(e) => setNewChild({ ...newChild, grade: e.target.value })}
                  className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-brand-green cursor-pointer disabled:opacity-50"
                >
                  {schoolClasses.map((cls) => (
                    <option key={cls} value={cls}>
                      {cls}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowAddChildModal(false)}
                className="flex-1 py-2 sm:py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddChild}
                className="flex-1 py-2 sm:py-2.5 rounded-xl bg-[#28A745] text-white text-xs font-bold shadow-xs cursor-pointer hover:bg-[#208838]"
              >
                Add Child
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Document Viewer */}
      {activeDocModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 max-w-[92vw] sm:max-w-md w-full space-y-3.5 sm:space-y-4 shadow-2xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-2 sm:pb-3">
              <h3 className="text-sm sm:text-base font-bold text-[#0D4A71]">{activeDocModal}</h3>
              <button type="button" onClick={() => setActiveDocModal(null)} className="text-slate-400 font-bold text-sm cursor-pointer">
                ✕
              </button>
            </div>
            <div className="text-xs text-slate-600 space-y-2 leading-relaxed">
              <p>
                This document sets forth the policy and terms governing {activeDocModal.toLowerCase()} on the MyEduRide platform.
              </p>
              <p>
                MyEduRide prioritizes student safety, data protection, and real-time transportation tracking for all registered users.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActiveDocModal(null)}
              className="w-full py-2.5 rounded-xl bg-[#28A745] text-white font-bold text-xs cursor-pointer"
            >
              Close & Agree
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
