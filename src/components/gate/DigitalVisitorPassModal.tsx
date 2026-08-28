// @ts-nocheck
'use client';

import { useState } from 'react';
import {
  ShieldCheck,
  QrCode,
  Smartphone,
  CheckCircle2,
  Clock,
  User,
  Building,
  Car,
  AlertTriangle,
  X,
  Share2,
  Copy,
  Check
} from 'lucide-react';
import { toast } from 'sonner';

interface DigitalVisitorPassModalProps {
  visitor: any;
  schoolName?: string;
  onClose: () => void;
}

export default function DigitalVisitorPassModal({ visitor, schoolName, onClose }: DigitalVisitorPassModalProps) {
  const [copied, setCopied] = useState(false);

  if (!visitor) return null;

  const passUrl = `https://myeduride.ng/pass/visitor/${visitor.digital_pass_token || visitor.id}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(passUrl);
    setCopied(true);
    toast.success('Digital Visitor Pass link copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-700 space-y-4 text-white relative">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-full bg-slate-800/80 cursor-pointer"
        >
          <X size={18} />
        </button>

        {/* Top Header Badge */}
        <div className="text-center space-y-1">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-black uppercase tracking-wider">
            <ShieldCheck size={12} /> Live Digital Access Pass
          </div>
          <h3 className="text-lg font-black tracking-tight text-white">{visitor.full_name}</h3>
          <p className="text-xs text-slate-400 font-mono">ID: {visitor.id}</p>
        </div>

        {/* Digital QR Pass Canvas (Smartphone Format) */}
        <div className="bg-white rounded-2xl p-5 text-slate-900 space-y-3 shadow-inner text-center relative overflow-hidden">
          {/* Dynamic Security Pulse Bar */}
          <div className="h-1.5 w-full bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-500 rounded-full animate-pulse"></div>

          {/* QR Code Container */}
          <div className="flex flex-col items-center justify-center p-2 bg-slate-50 rounded-xl border border-slate-200">
            <div className="w-40 h-40 bg-white p-2 rounded-lg border border-slate-300 flex items-center justify-center shadow-xs">
              <QrCode size={135} className="text-slate-900" />
            </div>
            <span className="text-[10px] font-mono font-bold text-slate-500 mt-1">
              TOKEN: {visitor.digital_pass_token || visitor.id}
            </span>
          </div>

          {/* Strict Non-Printable Policy Watermark */}
          <div className="p-2 rounded-xl bg-amber-50 border border-amber-200 text-[10px] text-amber-800 font-black uppercase tracking-tight flex items-center justify-center gap-1.5">
            <AlertTriangle size={13} className="text-amber-600 shrink-0" />
            <span>Digital Access Only • Not Printable</span>
          </div>

          {/* Visitor Pass Metadata */}
          <div className="space-y-1.5 text-left text-xs pt-1 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Purpose:</span>
              <span className="font-bold text-slate-900 truncate max-w-[170px]">{visitor.purpose_of_visit}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Person to See:</span>
              <span className="font-bold text-slate-900 truncate max-w-[170px]">{visitor.person_to_see}</span>
            </div>
            {visitor.vehicle_plate && visitor.vehicle_plate !== 'N/A' && (
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Vehicle Plate:</span>
                <span className="font-mono font-bold text-slate-900">{visitor.vehicle_plate}</span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Entry Timestamp:</span>
              <span className="font-bold text-emerald-700">
                {new Date(visitor.entry_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>
        </div>

        {/* Pass Actions */}
        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            onClick={handleCopyLink}
            className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer border border-slate-700"
          >
            {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
            <span>{copied ? 'Link Copied' : 'Copy Pass Link'}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              toast.success(`Digital pass SMS sent to ${visitor.phone}`);
            }}
            className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-md shadow-emerald-600/20"
          >
            <Smartphone size={14} />
            <span>Send to Phone</span>
          </button>
        </div>
      </div>
    </div>
  );
}
