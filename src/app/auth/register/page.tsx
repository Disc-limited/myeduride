// @ts-nocheck
'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { navigateBack } from '@/lib/navigation/smart-back';
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
  Users,
  Building2,
  ShieldCheck,
  ChevronDown,
  Sparkles,
  MessageSquare,
  CheckCircle,
  HelpCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import MigoChatModal from '@/components/landing/MigoChatModal';
import ParentRegistrationWizard from '@/components/auth/ParentRegistrationWizard';

const LOGO_URL = '/images/eduride_logo.png';

const GoogleIcon = () => (
  <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
    <path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <path
      fill="#FBBC05"
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
    />
    <path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
    />
  </svg>
);

const AppleIcon = () => (
  <svg className="w-5 h-5 shrink-0 fill-current text-slate-900" viewBox="0 0 24 24">
    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.37c.65-.79 1.1-1.89.98-2.99-.95.04-2.1.63-2.77 1.42-.6.7-1.13 1.83-.99 2.92 1.06.08 2.13-.56 2.78-1.35z" />
  </svg>
);

const BottomWave = () => (
  <div className="w-full overflow-hidden leading-none rounded-b-[24px] -mb-1">
    <svg viewBox="0 0 500 130" preserveAspectRatio="none" className="w-full h-16 sm:h-20 md:h-24">
      {/* Light Ice-Blue Backdrop Swoosh */}
      <path d="M 280,60 C 360,20 440,30 500,20 L 500,130 L 280,130 Z" fill="#E6F2FF" />

      {/* Top-Left Golden Yellow Swoosh */}
      <path d="M 0,0 C 90,45 180,75 270,75 C 180,85 90,65 0,110 Z" fill="#FFC107" />

      {/* Middle Green Swoosh */}
      <path
        d="M 0,45 C 120,80 230,95 340,75 C 410,60 460,50 500,45 L 500,130 L 0,130 Z"
        fill="#28A745"
      />

      {/* Deep Navy Blue Foundation */}
      <path
        d="M 0,95 C 100,85 200,80 300,75 C 380,70 440,65 500,60 L 500,130 L 0,130 Z"
        fill="#0D4A71"
      />
    </svg>
  </div>
);

const MigoMascotSvg = () => (
  <div className="relative w-16 h-16 sm:w-20 sm:h-20 shrink-0">
    <div className="w-full h-full rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center text-white shadow-lg border-2 border-white relative overflow-hidden">
      <div className="absolute inset-0 bg-white/10 backdrop-blur-xs" />
      <div className="relative z-10 flex flex-col items-center">
        <div className="flex items-center gap-1.5 mb-1">
          <div className="w-2.5 h-2.5 rounded-full bg-white animate-pulse" />
          <div className="w-2.5 h-2.5 rounded-full bg-white animate-pulse delay-100" />
        </div>
        <div className="w-5 h-1.5 bg-white/90 rounded-full" />
      </div>
      <div className="absolute -bottom-2 w-full h-4 bg-brand-green/80 flex items-center justify-center">
        <ShieldCheck className="w-3 h-3 text-white" />
      </div>
    </div>
  </div>
);

function RegisterContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialRole = searchParams.get('role') || 'parent';


  const [role, setRole] = useState<'parent' | 'school' | 'driver'>(
    initialRole === 'school' ? 'school' : initialRole === 'driver' ? 'driver' : 'parent'
  );

  const [form, setForm] = useState({
    fullName: '',
    email: '',
    countryCode: '+234',
    phone: '',
    password: '',
    confirmPassword: '',
    agreeTerms: true,
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [registeredAccount, setRegisteredAccount] = useState<{ name: string; role: string } | null>(null);

  const [migoModalOpen, setMigoModalOpen] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setForm((prev) => ({ ...prev, [name]: checked }));
    } else {
      setForm((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.fullName.trim()) {
      toast.error('Please enter your full name');
      return;
    }
    if (!form.email.trim()) {
      toast.error('Please enter your email address');
      return;
    }
    if (!form.password) {
      toast.error('Please enter a password');
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
      if (role === 'school') {
        const res = await fetch('/api/schools/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: form.fullName.trim(),
            admin_name: form.fullName.trim(),
            admin_username: form.email.split('@')[0],
            admin_email: form.email.trim(),
            admin_phone: `${form.countryCode}${form.phone.trim()}`,
            admin_password: form.password,
            confirm_password: form.confirmPassword,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          toast.error(data.error || 'Registration failed');
          setLoading(false);
          return;
        }
      }

      setRegisteredAccount({
        name: form.fullName,
        role: role === 'school' ? 'School Administrator' : role === 'driver' ? 'Driver / Escort' : 'Parent',
      });
      setSubmitted(true);
      toast.success('Account created successfully!');
    } catch {
      toast.error('Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div
        className="min-h-screen flex items-center justify-center p-4 sm:p-6 bg-slate-900 font-poppins relative selection:bg-brand-green selection:text-white bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: "linear-gradient(to bottom, rgba(15, 23, 42, 0.7), rgba(15, 23, 42, 0.8)), url('/images/background%20image.png')",
        }}
      >
        <div className="bg-white rounded-3xl p-8 max-w-md w-full text-center shadow-2xl space-y-5 border border-slate-100 animate-in fade-in zoom-in-95">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto text-brand-green shadow-inner">
            <CheckCircle size={36} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 mb-1">Account Created!</h1>
            <p className="text-sm text-slate-600">
              Welcome to MyEduRide, <strong>{registeredAccount?.name}</strong>.
            </p>
          </div>
          <div className="bg-slate-50 rounded-2xl p-4 text-left border border-slate-100 text-xs text-slate-600 space-y-1">
            <p className="font-semibold text-slate-800">Role: {registeredAccount?.role}</p>
            <p>Your account is configured and ready for login.</p>
          </div>
          <Link
            href="/auth/login"
            className="w-full py-3.5 px-6 rounded-xl bg-brand-green text-white font-semibold text-sm hover:bg-brand-green-dark transition-all shadow-lg shadow-brand-green/25 block text-center"
          >
            Sign in to Your Account
          </Link>
        </div>
      </div>
    );
  }

  if (role === 'parent') {
    return <ParentRegistrationWizard onSwitchRole={(newRole) => setRole(newRole)} />;
  }

  return (
    <div
      className="min-h-screen bg-slate-900 font-poppins text-slate-800 py-6 sm:py-10 px-3 sm:px-6 md:px-8 flex items-center justify-center relative selection:bg-brand-green selection:text-white bg-cover bg-center bg-no-repeat"
      style={{
        backgroundImage: "linear-gradient(to bottom, rgba(15, 23, 42, 0.7), rgba(15, 23, 42, 0.8)), url('/images/background%20image.png')",
      }}
    >
      
      {/* Container Wrapper */}
      <div className="max-w-6xl w-full grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* LEFT COLUMN: Main Sign Up Form Container (Mobile-first Frame) */}
        <div className="lg:col-span-7 xl:col-span-6 mx-auto w-full max-w-[440px] bg-white rounded-[28px] shadow-2xl border border-slate-200/80 overflow-hidden flex flex-col relative">
          
          {/* Role & Sign In Toggle Switcher Header */}
          <div className="bg-slate-900 px-3.5 sm:px-4 py-2 sm:py-2.5 flex items-center justify-between text-white text-xs font-semibold shrink-0 gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-slate-400 text-[10px] sm:text-[11px] font-bold uppercase tracking-wider hidden xs:inline shrink-0">Role:</span>
              <div className="flex bg-slate-800 p-0.5 rounded-xl text-[10px] sm:text-[11px]">
                <button
                  type="button"
                  onClick={() => setRole('parent')}
                  className={`px-2 sm:px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                    role === 'parent' ? 'bg-[#28A745] text-white font-bold shadow-xs' : 'text-slate-300 hover:text-white'
                  }`}
                >
                  Parent
                </button>
                <button
                  type="button"
                  onClick={() => setRole('school')}
                  className={`px-2 sm:px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                    role === 'school' ? 'bg-[#28A745] text-white font-bold shadow-xs' : 'text-slate-300 hover:text-white'
                  }`}
                >
                  School
                </button>
                <button
                  type="button"
                  onClick={() => setRole('driver')}
                  className={`px-2 sm:px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                    role === 'driver' ? 'bg-[#28A745] text-white font-bold shadow-xs' : 'text-slate-300 hover:text-white'
                  }`}
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

          {/* Top Header Bar */}
          <div className="p-5 sm:p-6 pb-2 relative">
            <button
              type="button"
              onClick={() => navigateBack(router, '/')}
              className="absolute top-5 left-5 p-2 rounded-full hover:bg-slate-100 text-slate-600 transition-colors cursor-pointer"
              title="Go Back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>

            {/* Logo */}
            <div className="flex flex-col items-center text-center mt-1">
              <img
                src={LOGO_URL}
                alt="MyEduRide Logo"
                className="h-12 w-auto object-contain mb-1"
              />
              <span className="text-[10px] font-bold tracking-widest text-slate-500 uppercase">
                THE STUDENT SAFETY PLATFORM
              </span>
            </div>

            {/* Title & Subtitle */}
            <div className="text-center mt-5">
              <h1 className="text-2xl sm:text-[26px] font-bold text-[#0D4A71] tracking-tight">
                Create Your Account
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-xs mx-auto leading-relaxed">
                Join thousands of parents, schools and drivers using MyEduRide.
              </p>
            </div>

            {/* Progress Bar (4 Steps) */}
            <div className="flex items-center justify-between max-w-xs mx-auto mt-6 mb-2 px-2">
              
              {/* Step 1: Account */}
              <div className="flex flex-col items-center gap-1.5 z-10">
                <div className="w-8 h-8 rounded-full bg-[#28A745] text-white flex items-center justify-center text-xs font-bold shadow-md ring-4 ring-emerald-50">
                  1
                </div>
                <span className="text-[11px] font-bold text-slate-800">Account</span>
              </div>

              {/* Connecting Line 1 */}
              <div className="flex-1 h-[2px] bg-slate-200 mx-1 -mt-4" />

              {/* Step 2: Details */}
              <div className="flex flex-col items-center gap-1.5 z-10">
                <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-300 text-slate-400 flex items-center justify-center text-xs font-semibold">
                  2
                </div>
                <span className="text-[11px] font-medium text-slate-400">Details</span>
              </div>

              {/* Connecting Line 2 */}
              <div className="flex-1 h-[2px] bg-slate-200 mx-1 -mt-4" />

              {/* Step 3: Verify */}
              <div className="flex flex-col items-center gap-1.5 z-10">
                <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-300 text-slate-400 flex items-center justify-center text-xs font-semibold">
                  3
                </div>
                <span className="text-[11px] font-medium text-slate-400">Verify</span>
              </div>

              {/* Connecting Line 3 */}
              <div className="flex-1 h-[2px] bg-slate-200 mx-1 -mt-4" />

              {/* Step 4: Complete */}
              <div className="flex flex-col items-center gap-1.5 z-10">
                <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-300 text-slate-400 flex items-center justify-center text-xs font-semibold">
                  4
                </div>
                <span className="text-[11px] font-medium text-slate-400">Complete</span>
              </div>
            </div>
          </div>

          {/* Form Body */}
          <form onSubmit={handleSubmit} className="px-5 sm:px-6 py-3 space-y-4">
            
            {/* 1. Full Name */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Full Name
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                  <User className="w-5 h-5" />
                </div>
                <input
                  type="text"
                  name="fullName"
                  value={form.fullName}
                  onChange={handleChange}
                  placeholder="Enter your full name"
                  required
                  className="w-full h-14 pl-12 pr-4 bg-slate-50/70 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#28A745]/30 focus:border-[#28A745] transition-all"
                />
              </div>
            </div>

            {/* 2. Email Address */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-5 h-5" />
                </div>
                <input
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  placeholder="Enter your email address"
                  required
                  className="w-full h-14 pl-12 pr-4 bg-slate-50/70 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#28A745]/30 focus:border-[#28A745] transition-all"
                />
              </div>
            </div>

            {/* 3. Phone Number with Country Code Dropdown */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Phone Number
              </label>
              <div className="relative flex items-center bg-slate-50/70 border border-slate-200 rounded-xl focus-within:bg-white focus-within:ring-2 focus-within:ring-[#28A745]/30 focus-within:border-[#28A745] transition-all overflow-hidden h-14">
                <div className="pl-4 text-slate-400 flex items-center pointer-events-none">
                  <Phone className="w-5 h-5" />
                </div>
                
                {/* Country Code Prefix */}
                <div className="flex items-center gap-1 px-2 border-r border-slate-200 text-xs font-semibold text-slate-700 shrink-0">
                  <span className="text-base">🇳🇬</span>
                  <select
                    name="countryCode"
                    value={form.countryCode}
                    onChange={handleChange}
                    className="bg-transparent text-xs font-semibold text-slate-700 outline-none cursor-pointer pr-1"
                  >
                    <option value="+234">+234</option>
                    <option value="+1">+1</option>
                    <option value="+44">+44</option>
                    <option value="+233">+233</option>
                    <option value="+254">+254</option>
                  </select>
                </div>

                <input
                  type="tel"
                  name="phone"
                  value={form.phone}
                  onChange={handleChange}
                  placeholder="Enter your phone number"
                  className="w-full h-full px-3 text-sm text-slate-800 placeholder:text-slate-400 bg-transparent outline-none"
                />
              </div>
            </div>

            {/* 4. Password */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-5 h-5" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={form.password}
                  onChange={handleChange}
                  placeholder="Create a strong password"
                  required
                  className="w-full h-14 pl-12 pr-12 bg-slate-50/70 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#28A745]/30 focus:border-[#28A745] transition-all"
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
                  className="absolute inset-y-0 right-0 pr-4 flex items-center z-20 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer pointer-events-auto"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* 5. Confirm Password */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Confirm Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-5 h-5" />
                </div>
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  name="confirmPassword"
                  value={form.confirmPassword}
                  onChange={handleChange}
                  placeholder="Confirm your password"
                  required
                  className="w-full h-14 pl-12 pr-12 bg-slate-50/70 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#28A745]/30 focus:border-[#28A745] transition-all"
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
                  className="absolute inset-y-0 right-0 pr-4 flex items-center z-20 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer pointer-events-auto"
                >
                  {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* 6. Role Selection Cards ("I am signing up as") */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-2">
                I am signing up as
              </label>
              <div className="grid grid-cols-3 gap-2">
                
                {/* Role 1: Parent */}
                <button
                  type="button"
                  onClick={() => setRole('parent')}
                  className={`p-2.5 rounded-xl border text-center transition-all flex flex-col items-center justify-between cursor-pointer ${
                    role === 'parent'
                      ? 'border-[#28A745] bg-emerald-50/70 shadow-sm ring-1 ring-[#28A745]'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 text-brand-green flex items-center justify-center mb-1">
                    <Users className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-bold text-slate-900 block leading-tight">Parent</span>
                  <span className="text-[10px] text-slate-500 leading-tight mt-0.5 line-clamp-2">
                    Manage your children's safety
                  </span>
                </button>

                {/* Role 2: School */}
                <button
                  type="button"
                  onClick={() => setRole('school')}
                  className={`p-2.5 rounded-xl border text-center transition-all flex flex-col items-center justify-between cursor-pointer ${
                    role === 'school'
                      ? 'border-[#28A745] bg-emerald-50/70 shadow-sm ring-1 ring-[#28A745]'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="w-8 h-8 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center mb-1">
                    <Building2 className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-bold text-slate-900 block leading-tight">School</span>
                  <span className="text-[10px] text-slate-500 leading-tight mt-0.5 line-clamp-2">
                    Manage your school
                  </span>
                </button>

                {/* Role 3: Driver / Escort */}
                <button
                  type="button"
                  onClick={() => setRole('driver')}
                  className={`p-2.5 rounded-xl border text-center transition-all flex flex-col items-center justify-between cursor-pointer ${
                    role === 'driver'
                      ? 'border-[#28A745] bg-emerald-50/70 shadow-sm ring-1 ring-[#28A745]'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center mb-1">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-bold text-slate-900 block leading-tight">Driver / Escort</span>
                  <span className="text-[10px] text-slate-500 leading-tight mt-0.5 line-clamp-2">
                    Provide safe transport
                  </span>
                </button>
              </div>
            </div>

            {/* 7. Terms & Privacy Agreement */}
            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="agreeTerms"
                name="agreeTerms"
                checked={form.agreeTerms}
                onChange={handleChange}
                className="w-4 h-4 accent-[#28A745] rounded border-slate-300 cursor-pointer"
              />
              <label htmlFor="agreeTerms" className="text-xs text-slate-600 leading-tight cursor-pointer">
                I agree to the{' '}
                <Link href="#" className="text-[#0D4A71] font-semibold hover:underline">
                  Terms of Service
                </Link>{' '}
                and{' '}
                <Link href="#" className="text-[#0D4A71] font-semibold hover:underline">
                  Privacy Policy
                </Link>
              </label>
            </div>

            {/* 8. Primary CTA Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full h-14 rounded-xl bg-[#28A745] hover:bg-[#208838] active:scale-[0.99] text-white font-bold text-base transition-all shadow-md shadow-[#28A745]/25 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <span>Creating Account...</span>
              ) : (
                <>
                  <span>Next</span>
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>

            {/* Divider OR */}
            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-3 text-slate-400 font-medium">OR</span>
              </div>
            </div>

            {/* 9. Social Sign Up Options */}
            <div className="space-y-2.5">
              <button
                type="button"
                onClick={() => toast.info('Google Sign Up available on live server')}
                className="w-full h-12 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-all flex items-center justify-center gap-3 shadow-xs cursor-pointer"
              >
                <GoogleIcon />
                <span>Sign up with Google</span>
              </button>

              <button
                type="button"
                onClick={() => toast.info('Apple Sign Up available on live server')}
                className="w-full h-12 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-all flex items-center justify-center gap-3 shadow-xs cursor-pointer"
              >
                <AppleIcon />
                <span>Sign up with Apple</span>
              </button>
            </div>

            {/* 10. Login Redirect Link */}
            <div className="text-center pt-3 pb-2">
              <p className="text-xs text-slate-600">
                Already have an account?{' '}
                <Link href="/auth/login" className="text-[#0D4A71] font-bold hover:underline">
                  Login
                </Link>
              </p>
            </div>
          </form>

          {/* Bottom Swoosh Wave Graphic */}
          <BottomWave />
        </div>

        {/* RIGHT COLUMN: Desktop Documentation / Features & Migo AI Assistant Panel */}
        <div className="lg:col-span-5 xl:col-span-6 space-y-6 hidden lg:block">
          
          {/* Top Overview Cards */}
          <div className="bg-white rounded-3xl p-6 shadow-xl border border-slate-200/80 space-y-4">
            <div className="flex items-center gap-3 text-[#0D4A71]">
              <div className="w-10 h-10 rounded-2xl bg-sky-50 flex items-center justify-center">
                <HelpCircle className="w-5 h-5 text-[#0D4A71]" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">SCREEN OVERVIEW</h2>
                <p className="text-xs text-slate-500">Sign Up Experience Specification</p>
              </div>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              This is the sign up screen for MyEduRide. It allows new users to create an account and choose their role on the platform seamlessly.
            </p>

            <div className="border-t border-slate-100 pt-4 space-y-2">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Key Objectives</h3>
              <ul className="text-xs text-slate-600 space-y-1.5">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#28A745] shrink-0" />
                  <span>Allow new users to register seamlessly</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#28A745] shrink-0" />
                  <span>Capture essential account information</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#28A745] shrink-0" />
                  <span>Let users choose their role</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#28A745] shrink-0" />
                  <span>Ensure trust with terms & privacy</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#28A745] shrink-0" />
                  <span>Encourage account creation</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Migo AI Assistant Helper Box */}
          <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-sky-50 rounded-3xl p-6 shadow-xl border border-emerald-200/60 flex items-center justify-between gap-4 relative overflow-hidden">
            <div className="space-y-2 max-w-xs z-10">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white text-emerald-800 text-[11px] font-bold shadow-xs">
                <span>Need help signing up?</span>
                <span>👋</span>
              </div>
              <h3 className="text-base font-extrabold text-slate-900">
                Migo is here for you!
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Chat with Migo, your smart assistant for all things MyEduRide.
              </p>
              <button
                type="button"
                onClick={() => setMigoModalOpen(true)}
                className="mt-2 px-5 py-2.5 rounded-xl bg-white border border-emerald-300 text-slate-800 font-semibold text-xs hover:bg-emerald-100/50 transition-all shadow-sm flex items-center gap-2 cursor-pointer"
              >
                <span>Chat with Migo</span>
                <MessageSquare className="w-4 h-4 text-[#28A745]" />
              </button>
            </div>

            <MigoMascotSvg />
          </div>

          {/* Role Summary Preview Box */}
          <div className="bg-white rounded-3xl p-6 shadow-xl border border-slate-200/80 space-y-3">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Role Selection Details
            </h3>
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 text-center space-y-1">
                <span className="text-xs font-bold text-slate-800 block">Parent</span>
                <span className="text-[10px] text-slate-500 block leading-tight">
                  Manage your children's rides, tracking and safety.
                </span>
              </div>
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 text-center space-y-1">
                <span className="text-xs font-bold text-slate-800 block">School</span>
                <span className="text-[10px] text-slate-500 block leading-tight">
                  Manage students, staff, transport and attendance.
                </span>
              </div>
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 text-center space-y-1">
                <span className="text-xs font-bold text-slate-800 block">Driver / Escort</span>
                <span className="text-[10px] text-slate-500 block leading-tight">
                  Provide safe and reliable transport services.
                </span>
              </div>
            </div>
          </div>

        </div>

      </div>

      {/* Migo AI Chat Modal */}
      <MigoChatModal isOpen={migoModalOpen} onClose={() => setMigoModalOpen(false)} />
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={
      <div
        className="min-h-screen bg-slate-900 flex items-center justify-center p-4 selection:bg-brand-green selection:text-white bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: "linear-gradient(to bottom, rgba(15, 23, 42, 0.7), rgba(15, 23, 42, 0.8)), url('/images/background%20image.png')",
        }}
      >
        <div className="animate-pulse text-slate-200 text-sm font-semibold">Loading registration page...</div>
      </div>
    }>
      <RegisterContent />
    </Suspense>
  );
}

