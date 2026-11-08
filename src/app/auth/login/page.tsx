'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { navigateBack } from '@/lib/navigation/smart-back';
import Link from 'next/link';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowLeft,
  ArrowRight,
  Home,
  Sparkles,
  CheckCircle,
  Shield,
} from 'lucide-react';
import { photoSrc } from '@/lib/photo';
import { toast } from 'sonner';
import { isNativePlatform } from '@/lib/platform/device';

const LOGO_URL = '/images/eduride_logo.png';

type SchoolBranding = {
  id: string;
  name: string;
  logo_url?: string | null;
  welcome_message?: string | null;
};

const BottomWave = () => (
  <div className="w-full overflow-hidden leading-none rounded-b-3xl -mb-1">
    <svg viewBox="0 0 500 130" preserveAspectRatio="none" className="w-full h-20 sm:h-24 md:h-28">
      {/* Light Ice-Blue Backdrop Swoosh (Top Right) */}
      <path
        d="M 280,60 C 360,20 440,30 500,20 L 500,130 L 280,130 Z"
        fill="#E6F2FF"
      />

      {/* Top-Left Golden Yellow Swoosh */}
      <path
        d="M 0,0 C 90,45 180,75 270,75 C 180,85 90,65 0,110 Z"
        fill="#FFC107"
      />

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

export default function LoginPage() {
  const router = useRouter();
  const [isNative, setIsNative] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [usernameHint, setUsernameHint] = useState('');
  const [loginSchoolId, setLoginSchoolId] = useState('');
  const [schoolBranding, setSchoolBranding] = useState<SchoolBranding | null>(null);
  const [showForgotModal, setShowForgotModal] = useState(false);
  const brandingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const urlSchoolBranding = useRef<SchoolBranding | null>(null);

  useEffect(() => {
    if (isNativePlatform()) {
      setIsNative(true);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const sid = params.get('school_id');
    if (!sid) return;

    setLoginSchoolId(sid);
    fetch(`/api/public/school-branding?school_id=${sid}`)
      .then((r) => r.json())
      .then((d) => {
        const school = d.school || null;
        urlSchoolBranding.current = school;
        setSchoolBranding(school);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const trimmed = username.trim();
    if (brandingTimer.current) clearTimeout(brandingTimer.current);

    if (trimmed.length < 3) {
      setUsernameHint('');
      setSchoolBranding(urlSchoolBranding.current);
      return;
    }

    brandingTimer.current = setTimeout(() => {
      const params = new URLSearchParams({ username: trimmed });
      if (loginSchoolId) params.set('school_id', loginSchoolId);

      fetch(`/api/public/login-branding?${params.toString()}`)
        .then((r) => r.json())
        .then((d) => {
          if (loginSchoolId) {
            if (d.belongs_to_school && d.school) {
              setUsernameHint('');
              setSchoolBranding(d.school);
            } else {
              setUsernameHint(
                d.error || 'This username is not registered at this school.'
              );
              setSchoolBranding(urlSchoolBranding.current);
            }
            return;
          }

          setUsernameHint('');
          if (d.school) setSchoolBranding(d.school);
        })
        .catch(() => {});
    }, 400);

    return () => {
      if (brandingTimer.current) clearTimeout(brandingTimer.current);
    };
  }, [username, loginSchoolId]);

  const logoSrc = photoSrc(schoolBranding?.logo_url) || LOGO_URL;

  let welcomeLine =
    schoolBranding?.welcome_message ||
    (schoolBranding?.name
      ? `Welcome to ${schoolBranding.name}`
      : 'Login to access your account and manage safe journeys.');

  if (welcomeLine.trim().startsWith('{') && welcomeLine.trim().endsWith('}')) {
    try {
      const parsed = JSON.parse(welcomeLine);
      welcomeLine = parsed.welcomeText || parsed.welcome_message || welcomeLine;
    } catch {}
  }

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) return;
    if (usernameHint) {
      setError(usernameHint);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username.trim(),
          password,
          school_id: loginSchoolId || undefined,
        }),
      });

      const text = await response.text();
      let data: { error?: string; redirect?: string } = {};
      try {
        data = JSON.parse(text);
      } catch {
        data = { error: text };
      }

      if (!response.ok) {
        setError(data.error || 'Failed to sign in. Please verify your credentials.');
        setLoading(false);
        return;
      }

      window.location.href = data.redirect || '/dashboard';
    } catch {
      setError('Network error. Check your internet connection.');
    }

    setLoading(false);
  };

  return (
    <div
      className="min-h-screen bg-slate-900 font-poppins flex flex-col justify-between relative selection:bg-brand-green selection:text-white bg-cover bg-center bg-no-repeat"
      style={{
        backgroundImage: "linear-gradient(to bottom, rgba(15, 23, 42, 0.7), rgba(15, 23, 42, 0.8)), url('/images/background%20image.png')",
      }}
    >
      
      {/* Top Floating Bar */}
      <div className="w-full max-w-6xl mx-auto px-4 pt-4 sm:pt-6 flex items-center justify-between z-20">
        {!isNative ? (
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-xl bg-white text-navy-900 font-bold text-xs sm:text-sm border border-slate-200 hover:bg-slate-50 transition-all shadow-sm group active:scale-95 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 text-brand-green group-hover:-translate-x-0.5 transition-transform" />
            <span>Back to Home</span>
          </Link>
        ) : (
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-white/10 backdrop-blur-md text-white font-bold text-xs border border-white/10 shadow-sm">
            <Shield className="w-4 h-4 text-emerald-400" />
            <span>MyEduRide Mobile</span>
          </div>
        )}
        <span className="text-[10px] sm:text-xs font-semibold text-slate-300 uppercase tracking-widest hidden xs:inline">
          THE STUDENT SAFETY PLATFORM
        </span>
      </div>

      {/* Main Responsive Container */}
      <main className="w-full max-w-6xl mx-auto px-3 sm:px-6 py-6 flex-1 flex items-center justify-center">
        <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          
          {/* Desktop Left Side Overview & Features Card (Visible on lg+) */}
          <div className="hidden lg:block lg:col-span-6 space-y-6 pr-4">
            <div className="bg-white rounded-3xl p-8 shadow-xl border border-slate-200/80 space-y-6">
              <div>
                <Link href="/" className="inline-block hover:scale-105 transition-transform mb-2">
                  <img
                    src="/images/eduride_logo.png"
                    alt="MyEduRide Logo"
                    className="h-16 sm:h-20 w-auto object-contain"
                  />
                </Link>
                <div className="flex items-center gap-2 mt-1">
                  <span className="px-2.5 py-0.5 rounded-md bg-navy-900 text-white text-[11px] font-bold tracking-wide uppercase">
                    Access Portal
                  </span>
                  <span className="text-xs text-slate-500 font-semibold">
                    Safe Journey & Gate Intelligence
                  </span>
                </div>
              </div>

              <p className="text-sm text-slate-600 leading-relaxed font-medium">
                This is the official login screen for MyEduRide. Securely access parent notifications, teacher rosters, gate officer verifications, and fleet monitoring.
              </p>

              {/* Key Objectives Checklist */}
              <div className="space-y-3 pt-2">
                <h3 className="text-xs font-bold text-navy-900 uppercase tracking-wider">Key Objectives</h3>
                <div className="grid grid-cols-1 gap-2.5">
                  <div className="flex items-center gap-2.5 text-xs text-slate-700 font-semibold">
                    <CheckCircle className="w-4 h-4 text-brand-green shrink-0" />
                    <span>Provide a secure and simple login experience</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-xs text-slate-700 font-semibold">
                    <CheckCircle className="w-4 h-4 text-brand-green shrink-0" />
                    <span>Offer social login for faster access</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-xs text-slate-700 font-semibold">
                    <CheckCircle className="w-4 h-4 text-brand-green shrink-0" />
                    <span>Encourage new users and schools to sign up</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-xs text-slate-700 font-semibold">
                    <CheckCircle className="w-4 h-4 text-brand-green shrink-0" />
                    <span>Maintain brand trust, compliance & instant security</span>
                  </div>
                </div>
              </div>

              {/* Interactive Migo Assistant Banner */}
              <div className="bg-emerald-50/80 rounded-2xl p-4 border border-emerald-100 flex items-center gap-4">
                <div className="relative w-12 h-12 bg-white rounded-2xl p-1 shadow shrink-0 flex items-center justify-center">
                  <img src="/images/landing/migo_robot.png" alt="Migo AI" className="w-full h-full object-contain" />
                  <span className="absolute -top-1 -right-1 flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-300 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-yellow-400"></span>
                  </span>
                </div>
                <div className="flex-1">
                  <h4 className="text-xs font-bold text-navy-900 flex items-center gap-1">
                    <span>Migo is here to help!</span>
                    <Sparkles className="w-3.5 h-3.5 text-brand-yellow" />
                  </h4>
                  <p className="text-[11px] text-slate-600 font-medium">Login to chat with Migo, your smart assistant for all things MyEduRide.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Main Mobile & Desktop Login Screen Card */}
          <div className="lg:col-span-6 w-full max-w-[420px] mx-auto">
            <div className="bg-white rounded-3xl shadow-2xl border border-slate-200/90 overflow-hidden flex flex-col transition-all">
              
              {/* Mode Switcher Header Bar */}
              <div className="bg-slate-900 px-3.5 sm:px-4 py-2 sm:py-2.5 flex items-center justify-between text-white text-xs font-semibold shrink-0 gap-2">
                <span className="text-slate-300 text-[10px] sm:text-[11px] font-bold uppercase tracking-wider">Access Portal</span>
                <Link
                  href="/auth/register"
                  className="px-2.5 sm:px-3 py-1 rounded-xl bg-[#28A745] hover:bg-[#208838] text-white text-[10px] sm:text-[11px] font-bold transition-all shadow-xs flex items-center gap-1 cursor-pointer shrink-0"
                >
                  <span>Create Account / Sign Up</span>
                  <ArrowRight className="w-3 h-3" />
                </Link>
              </div>

              {/* Header Section with Logo & Bus Illustration */}
              <div className="p-6 sm:p-8 pb-4 text-center relative bg-gradient-to-b from-slate-50 to-white">
                
                {/* School or Brand Logo */}
                <div className="mb-4 flex justify-center">
                  {!isNative ? (
                    <Link href="/" className="inline-block hover:scale-105 transition-transform">
                      <img
                        src={logoSrc}
                        alt={schoolBranding?.name || 'MyEduRide'}
                        className="h-16 sm:h-20 md:h-24 max-h-[96px] w-auto object-contain mx-auto"
                      />
                    </Link>
                  ) : (
                    <div className="inline-block">
                      <img
                        src={logoSrc}
                        alt={schoolBranding?.name || 'MyEduRide'}
                        className="h-16 sm:h-20 md:h-24 max-h-[96px] w-auto object-contain mx-auto"
                      />
                    </div>
                  )}
                </div>

                {schoolBranding?.name && (
                  <span className="inline-block px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xs font-bold mb-2">
                    {schoolBranding.name}
                  </span>
                )}

                <h1 className="text-2xl sm:text-3xl font-extrabold text-navy-900 tracking-tight">
                  Welcome Back!
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1 max-w-xs mx-auto">
                  {welcomeLine}
                </p>

                {/* Subtle City & Bus Graphic */}
                <div className="relative mt-4 h-16 w-full max-w-xs mx-auto overflow-hidden rounded-xl bg-slate-100/60 border border-slate-200/50 flex items-center justify-center">
                  <img
                    src="/images/landing/hero_main.png"
                    alt="Safe Journey"
                    className="w-full h-full object-cover opacity-80"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-white via-transparent to-transparent" />
                </div>
              </div>

              {/* Form Input Body */}
              <div className="p-6 sm:p-8 pt-2 space-y-4 flex-1">
                
                {/* Username / Email Address Input */}
                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-slate-800 mb-1.5">
                    Email Address / Username
                  </label>
                  <div className="relative">
                    <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                      <Mail className="w-5 h-5" />
                    </div>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Enter your email address or username"
                      className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-900 text-sm font-medium placeholder:text-slate-400 focus:outline-none focus:border-brand-green focus:ring-2 focus:ring-brand-green/20 transition-all min-h-[48px] shadow-sm"
                      autoFocus
                      autoComplete="username"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleLogin();
                      }}
                    />
                  </div>
                  {usernameHint && (
                    <p className="text-xs text-amber-600 font-medium mt-1.5 bg-amber-50 p-2 rounded-lg border border-amber-200">
                      {usernameHint}
                    </p>
                  )}
                </div>

                {/* Password Input */}
                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-slate-800 mb-1.5">
                    Password
                  </label>
                  <div className="relative">
                    <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                      <Lock className="w-5 h-5" />
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      className="w-full pl-11 pr-11 py-3 rounded-xl border border-slate-200 bg-white text-slate-900 text-sm font-medium placeholder:text-slate-400 focus:outline-none focus:border-brand-green focus:ring-2 focus:ring-brand-green/20 transition-all min-h-[48px] shadow-sm"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleLogin();
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition-colors p-1"
                      title={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>

                  {/* Forgot Password Link */}
                  <div className="text-right mt-2">
                    <button
                      type="button"
                      onClick={() => setShowForgotModal(true)}
                      className="text-xs font-bold text-navy-900 hover:text-brand-green transition-colors"
                    >
                      Forgot Password?
                    </button>
                  </div>
                </div>

                {/* Error Banner */}
                {error && (
                  <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 font-medium">
                    {error}
                  </div>
                )}

                {/* Primary Login CTA Button */}
                <button
                  type="button"
                  onClick={handleLogin}
                  disabled={loading || !username.trim() || !password.trim() || !!usernameHint}
                  className="w-full py-3.5 px-6 rounded-2xl bg-[#28A745] hover:bg-[#218838] active:scale-[0.98] text-white font-bold text-base transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-brand-green/30 flex items-center justify-center gap-2 min-h-[50px]"
                >
                  <span>{loading ? 'Signing in...' : 'Login'}</span>
                  {!loading && <ArrowRight className="w-5 h-5" />}
                </button>

                {/* Don't have an account? Sign Up */}
                <div className="text-center pt-3">
                  <p className="text-xs sm:text-sm font-medium text-slate-600">
                    Don’t have an account?{' '}
                    <Link
                      href="/auth/register"
                      className="font-bold text-navy-900 hover:text-brand-green hover:underline transition-colors"
                    >
                      Sign Up
                    </Link>
                  </p>
                </div>
              </div>

              {/* Bottom Decorative Wave Accent (Navy, Green & Yellow Curves) */}
              <BottomWave />
            </div>
          </div>

        </div>
      </main>

      {/* Footer Copyright Bar */}
      <footer className="w-full py-4 text-center text-xs text-slate-500 font-medium">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>MyEduRide — The Student Safety Platform</span>
          <div className="flex items-center gap-4">
            <Link href="/" className="hover:text-navy-900 transition-colors">Privacy Policy</Link>
            <Link href="/" className="hover:text-navy-900 transition-colors">Terms of Service</Link>
            {!isNative && (
              <Link href="/" className="hover:text-navy-900 transition-colors inline-flex items-center gap-1">
                <Home className="w-3.5 h-3.5" />
                <span>Home</span>
              </Link>
            )}
          </div>
        </div>
      </footer>

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 text-center shadow-2xl border border-slate-100 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-brand-green flex items-center justify-center mx-auto">
              <Lock className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-navy-900">Forgot Your Password?</h3>
            <p className="text-xs text-slate-600 font-medium leading-relaxed">
              Password resets are managed securely by school administrators. Please contact your school administrator or IT desk to issue a password reset link.
            </p>
            <button
              onClick={() => setShowForgotModal(false)}
              className="w-full py-2.5 rounded-xl bg-navy-900 hover:bg-navy-950 text-white font-bold text-xs transition-all shadow"
            >
              Got It
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
