'use client';

import React from 'react';

export default function EscortLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F4F6F9] font-sans antialiased text-slate-800">
      {children}
    </div>
  );
}
