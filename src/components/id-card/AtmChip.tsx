'use client';

import React from 'react';

interface AtmChipProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Realistic Gold EMV Smart Chip (CR80 Standard)
 * Rendered using SVG with metallic gold gradients and contact pads.
 */
export default function AtmChip({ className = '', size = 'md' }: AtmChipProps) {
  const dimensions =
    size === 'sm'
      ? { width: 34, height: 26 }
      : size === 'lg'
      ? { width: 50, height: 38 }
      : { width: 44, height: 34 };

  return (
    <div
      className={`relative rounded-md overflow-hidden shadow-sm select-none shrink-0 ${className}`}
      style={{
        width: dimensions.width,
        height: dimensions.height,
        background: 'linear-gradient(135deg, #f7d070 0%, #d4af37 40%, #aa7c11 75%, #f3e5ab 100%)',
        border: '1px solid rgba(138, 99, 14, 0.7)',
        boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.7), inset 0 -1px 2px rgba(0,0,0,0.4), 0 1px 2px rgba(0,0,0,0.3)',
      }}
      aria-label="EMV Smart Card Chip"
    >
      <svg
        viewBox="0 0 50 38"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full"
      >
        <defs>
          <linearGradient id="chipLine" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#8a630e" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#5a3d04" stopOpacity="0.9" />
          </linearGradient>
        </defs>

        {/* Central horizontal line */}
        <line x1="0" y1="19" x2="50" y2="19" stroke="url(#chipLine)" strokeWidth="1.2" />

        {/* Left vertical circuit contacts */}
        <path
          d="M 16 0 L 16 11 A 3 3 0 0 1 13 14 L 0 14"
          stroke="url(#chipLine)"
          strokeWidth="1.2"
          fill="none"
        />
        <path
          d="M 16 38 L 16 27 A 3 3 0 0 0 13 24 L 0 24"
          stroke="url(#chipLine)"
          strokeWidth="1.2"
          fill="none"
        />

        {/* Right vertical circuit contacts */}
        <path
          d="M 34 0 L 34 11 A 3 3 0 0 0 37 14 L 50 14"
          stroke="url(#chipLine)"
          strokeWidth="1.2"
          fill="none"
        />
        <path
          d="M 34 38 L 34 27 A 3 3 0 0 1 37 24 L 50 24"
          stroke="url(#chipLine)"
          strokeWidth="1.2"
          fill="none"
        />

        {/* Central Core Rectangle */}
        <rect
          x="19"
          y="10"
          width="12"
          height="18"
          rx="2.5"
          stroke="url(#chipLine)"
          strokeWidth="1.2"
          fill="none"
        />
      </svg>
    </div>
  );
}
