'use client';

import { useState, useEffect } from 'react';
import { photoSrc } from '@/lib/photo';

type StudentAvatarProps = {
  photoUrl?: string | null;
  firstName?: string;
  lastName?: string;
  name?: string;
  fullName?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  accentColor?: string;
  className?: string;
};

const sizes: Record<string, string> = {
  xs: 'w-7 h-7 text-xs rounded-full',
  sm: 'w-10 h-10 text-sm rounded-full',
  md: 'w-14 h-14 text-base rounded-full',
  lg: 'w-20 h-20 text-xl rounded-full',
  xl: 'w-24 h-24 text-2xl rounded-full',
};

export default function StudentAvatar({
  photoUrl,
  firstName = '',
  lastName = '',
  name = '',
  fullName = '',
  size = 'md',
  accentColor = '#1B4D3E',
  className = '',
}: StudentAvatarProps) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [photoUrl]);

  const src = photoSrc(photoUrl);

  let first = firstName;
  let last = lastName;
  if (!first && !last) {
    const rawName = (fullName || name || '').trim();
    if (rawName) {
      const parts = rawName.split(/\s+/).filter(Boolean);
      first = parts[0] || '';
      last = parts.slice(1).join(' ') || '';
    }
  }

  const initials = `${first?.[0] || ''}${last?.[0] || ''}`.toUpperCase() || (first?.[0] || '?').toUpperCase();
  const sizeClass = sizes[size] || sizes.md;
  const displayName = `${first} ${last}`.trim() || 'Avatar';

  if (src && !failed) {
    return (
      <img
        src={src}
        alt={displayName}
        className={`${sizeClass} object-cover shrink-0 border-2 border-white shadow-md ring-1 ring-gray-100 ${className}`}
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <div
      className={`${sizeClass} flex items-center justify-center text-white font-bold shrink-0 shadow-sm ${className}`}
      style={{ backgroundColor: accentColor }}
      title={displayName}
    >
      {initials}
    </div>
  );
}
