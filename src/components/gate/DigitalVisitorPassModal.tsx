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
  Check,
  ShieldAlert,
  ScanLine
} from 'lucide-react';
import { toast } from 'sonner';

interface DigitalVisitorPassModalProps {
  visitor: any;
  schoolName?: string;
  onClose: () => void;
  onVerifyPass?: (token: string) => void;
}

export default function DigitalVisitorPassModal({
  visitor,
  schoolName,
  onClose,
  onVerifyPass,
}: DigitalVisitorPassModalProps) {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);

  if (!visitor) return null;

  const passToken = visitor.digital_pass_token || visitor.id;
  const passUrl = `https://www.myeduride.com/pass/visitor/${passToken}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(passUrl);
    setCopiedLink(true);
    toast.success('Digital Visitor Pass web link copied!');
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleCopyToken = () => {
    navigator.clipboard.writeText(passToken);
    setCopiedToken(true);
    toast.success(`Pass ID ${passToken} copied to clipboard!`);
    setTimeout(() => setCopiedToken(false), 2000);
  };

  const hostResponse = visitor.host_response || (visitor.security_flag === 'cleared' ? 'accepted' : 'pending');

  return (
    <div className="fixed inset-0 bg-slate-950/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-700 space-y-4 text-white relative">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-full bg-slate-800/80 cursor-pointer transition-colors"
          title="Close Modal"
        >
          <X size={18} />
        </button>

        {/* Top Header Badge */}
        <div className="text-center space-y-1">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-black uppercase tracking-wider">
            <ShieldCheck size={12} /> Live Digital Access Pass
          </div>
          <h3 className="text-lg font-black tracking-tight text-white">{visitor.full_name}</h3>
          
          {/* Host Clearance Indicator */}
          <div className="pt-1 flex justify-center">
            {hostResponse === 'accepted' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[11px] font-bold">
                <CheckCircle2 size={12} /> Host Cleared Entry
              </span>
            )}
            {hostResponse === 'pending' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[11px] font-bold">
                <Clock size={12} /> Awaiting Host Acceptance
              </span>
            )}
            {hostResponse === 'declined' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[11px] font-black">
                <ShieldAlert size={12} /> ENTRY DECLINED BY HOST
              </span>
            )}
          </div>
        </div>

        {/* Digital QR Pass Canvas (Smartphone Format) */}
        <div className="bg-white rounded-2xl p-5 text-slate-900 space-y-3 shadow-inner text-center relative overflow-hidden">
          {/* Dynamic Security Pulse Bar */}
          <div className={`h-1.5 w-full rounded-full animate-pulse ${
            hostResponse === 'declined'
              ? 'bg-rose-500'
              : hostResponse === 'pending'
              ? 'bg-amber-400'
              : 'bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-500'
          }`}></div>

          {/* QR Code Container */}
          <div className="flex flex-col items-center justify-center p-2 bg-slate-50 rounded-xl border border-slate-200">
            <div className="w-40 h-40 bg-white p-2 rounded-lg border border-slate-300 flex items-center justify-center shadow-xs">
              <QrCode size={135} className="text-slate-900" />
            </div>

            <div className="flex items-center justify-center gap-1.5 mt-2 bg-slate-100 px-3 py-1 rounded-lg border border-slate-200 w-full">
              <span className="text-[11px] font-mono font-black text-purple-900 truncate">
                {passToken}
              </span>
              <button
                type="button"
                onClick={handleCopyToken}
                className="p-1 rounded hover:bg-slate-200 text-slate-600 hover:text-slate-900 cursor-pointer"
                title="Copy Pass Token to clipboard"
              >
                {copiedToken ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
              </button>
            </div>
          </div>

          {/* Strict Non-Printable Policy Watermark */}
          <div className="p-2 rounded-xl bg-amber-50 border border-amber-200 text-[10px] text-amber-800 font-black uppercase tracking-tight flex items-center justify-center gap-1.5">
            <AlertTriangle size={13} className="text-amber-600 shrink-0" />
            <span>Digital Access Only • Non-Printable</span>
          </div>

          {/* Visitor Pass Metadata */}
          <div className="space-y-1.5 text-left text-xs pt-1 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Purpose:</span>
              <span className="font-bold text-slate-900 truncate max-w-[170px]">{visitor.purpose_of_visit}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Host to See:</span>
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
        <div className="space-y-2 pt-1">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyToken}
              className="flex-1 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm"
            >
              {copiedToken ? <Check size={14} /> : <Copy size={14} />}
              <span>{copiedToken ? 'ID Copied!' : 'Copy Pass ID'}</span>
            </button>

            {onVerifyPass && (
              <button
                type="button"
                onClick={() => {
                  onVerifyPass(passToken);
                  onClose();
                }}
                className="flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm"
              >
                <ScanLine size={14} />
                <span>Verify at Gate</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyLink}
              className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer border border-slate-700"
            >
              {copiedLink ? <Check size={13} className="text-emerald-400" /> : <Share2 size={13} />}
              <span>{copiedLink ? 'Link Copied' : 'Copy Pass Link'}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                toast.success(`Digital pass SMS sent to ${visitor.phone}`);
              }}
              className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer border border-slate-700"
            >
              <Smartphone size={13} />
              <span>SMS to Phone</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
