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

const LOGO_URL = '/images/eduride_logo.png';

type SchoolBranding = {
  id: string;
  name: string;
  logo_url?: string | null;
  welcome_message?: string | null;
};

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
      let data: { error?: string } = {};
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

      window.location.href = '/dashboard';
    } catch {
      setError('Network error. Check your internet connection.');
    }

    setLoading(false);
  };

  const handleSocialLogin = (provider: string) => {
    toast.info(`${provider} Sign-In`, {
      description: `Please enter your school username or email above for instant login verification.`,
    });
  };

  return (
    <div
      className="min-h-screen bg-slate-900 font-poppins flex flex-col justify-between relative selection:bg-brand-green selection:text-white bg-cover bg-center bg-no-repeat"
      style={{
        backgroundImage: "linear-gradient(to bottom, rgba(15, 23, 42, 0.7), rgba(15, 23, 42, 0.8)), url('/images/background%20image.png')",
      }}
    >
      
      {/* Top Floating Back Bar */}
      <div className="w-full max-w-6xl mx-auto px-4 pt-4 sm:pt-6 flex items-center justify-between z-20">
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-xl bg-white text-navy-900 font-bold text-xs sm:text-sm border border-slate-200 hover:bg-slate-50 transition-all shadow-sm group active:scale-95 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4 text-brand-green group-hover:-translate-x-0.5 transition-transform" />
          <span>Back to Home</span>
        </Link>
        <span className="text-[10px] sm:text-xs font-semibold text-slate-500 uppercase tracking-widest hidden xs:inline">
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
              
              {/* Header Section with Logo & Bus Illustration */}
              <div className="p-6 sm:p-8 pb-4 text-center relative bg-gradient-to-b from-slate-50 to-white">
                
                {/* School or Brand Logo */}
                <div className="mb-4 flex justify-center">
                  <Link href="/" className="inline-block hover:scale-105 transition-transform">
                    <img
                      src={logoSrc}
                      alt={schoolBranding?.name || 'MyEduRide'}
                      className="h-16 sm:h-20 md:h-24 max-h-[96px] w-auto object-contain mx-auto"
                    />
                  </Link>
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

                {/* OR Divider */}
                <div className="relative py-2 flex items-center justify-center">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-200" />
                  </div>
                  <span className="relative px-3 bg-white text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    OR
                  </span>
                </div>

                {/* Social Login Buttons */}
                <div className="space-y-2.5">
                  <button
                    type="button"
                    onClick={() => handleSocialLogin('Google')}
                    className="w-full py-3 px-4 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 font-semibold text-xs sm:text-sm flex items-center justify-center gap-3 transition-all shadow-sm active:scale-[0.99]"
                  >
                    <GoogleIcon />
                    <span>Continue with Google</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSocialLogin('Apple')}
                    className="w-full py-3 px-4 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 font-semibold text-xs sm:text-sm flex items-center justify-center gap-3 transition-all shadow-sm active:scale-[0.99]"
                  >
                    <AppleIcon />
                    <span>Continue with Apple</span>
                  </button>
                </div>

                {/* Don't have an account? Sign Up */}
                <div className="text-center pt-2">
                  <p className="text-xs sm:text-sm font-medium text-slate-600">
                    Don’t have an account?{' '}
                    <Link
                      href="/auth/register-school"
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
            <Link href="/" className="hover:text-navy-900 transition-colors inline-flex items-center gap-1">
              <Home className="w-3.5 h-3.5" />
              <span>Home</span>
            </Link>
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
