'use client';

import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

type Props = {
  password: string;
  confirmPassword: string;
  onPasswordChange: (value: string) => void;
  onConfirmChange: (value: string) => void;
  label?: string;
  hint?: string;
  required?: boolean;
};

export function InitialPasswordFields({
  password,
  confirmPassword,
  onPasswordChange,
  onConfirmChange,
  label = 'Default password',
  hint = 'Share this with the user. They should change it after first login.',
  required = true,
}: Props) {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  return (
    <div className="space-y-3 border border-slate-100 rounded-xl p-3 bg-slate-50/80">
      <p className="text-xs font-semibold text-slate-700">{label}{required ? ' *' : ''}</p>
      {hint && <p className="text-[11px] text-slate-500 -mt-2">{hint}</p>}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Password</label>
        <div className="relative">
          <input
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => onPasswordChange(e.target.value)}
            className="input font-mono text-sm pr-10"
            placeholder="e.g. Welcome2026"
            autoComplete="new-password"
          />
          <button
            type="button"
            onClick={() => setShowPassword((prev) => !prev)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors p-1"
            title={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Confirm password</label>
        <div className="relative">
          <input
            type={showConfirm ? 'text' : 'password'}
            value={confirmPassword}
            onChange={(e) => onConfirmChange(e.target.value)}
            className="input font-mono text-sm pr-10"
            placeholder="Re-enter password"
            autoComplete="new-password"
          />
          <button
            type="button"
            onClick={() => setShowConfirm((prev) => !prev)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors p-1"
            title={showConfirm ? 'Hide password' : 'Show password'}
          >
            {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
      </div>
    </div>
  );
}
