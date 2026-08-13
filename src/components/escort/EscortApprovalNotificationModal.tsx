// @ts-nocheck
'use client';

import { useState } from 'react';
import {
  CheckCircle2,
  X,
  Mail,
  Bell,
  CreditCard,
  ArrowRight,
  ShieldCheck,
  Building,
  User,
  Car,
  Calendar,
  Sparkles,
  ExternalLink
} from 'lucide-react';
import { toast } from 'sonner';

interface EscortApprovalNotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProceedPayment: () => void;
  approvalMessage?: string;
  escortName?: string;
  escortId?: string;
}

export default function EscortApprovalNotificationModal({
  isOpen,
  onClose,
  onProceedPayment,
  approvalMessage = 'Congratulations! Your MyEduRide Escort account has been approved. You can now proceed with the required registration payment to activate your account.',
  escortName = 'John Adewale',
  escortId = 'MRD-ESC-124578',
}: EscortApprovalNotificationModalProps) {
  const [activeTab, setActiveTab] = useState<'notification' | 'email'>('notification');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-slate-900 text-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-800 relative overflow-hidden">
        {/* Decorative Top Gradient Glow */}
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-brand-green/20 rounded-full blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-1.5 rounded-full bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header Title */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-7 h-7" />
          </div>
          <div>
            <h3 className="text-lg font-extrabold text-white">City Manager Approval</h3>
            <p className="text-xs text-slate-400">Account status updated to <span className="text-emerald-400 font-bold">CITY MANAGER APPROVED</span></p>
          </div>
        </div>

        {/* Notification vs Email Tab Switcher */}
        <div className="flex bg-slate-800 p-1 rounded-xl mb-4 border border-slate-700 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('notification')}
            className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'notification' ? 'bg-brand-green text-white shadow-md font-bold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Bell className="w-3.5 h-3.5" /> In-Platform Notification
          </button>
          <button
            onClick={() => setActiveTab('email')}
            className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'email' ? 'bg-brand-green text-white shadow-md font-bold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Mail className="w-3.5 h-3.5" /> Email Alert
          </button>
        </div>

        {/* Tab 1: In-Platform Notification View */}
        {activeTab === 'notification' && (
          <div className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700/80 space-y-3 mb-5">
            <div className="flex items-center justify-between text-xs text-slate-400 pb-2 border-b border-slate-700/60">
              <span className="flex items-center gap-1 font-bold text-emerald-400">
                <ShieldCheck className="w-4 h-4" /> System Approval Alert
              </span>
              <span className="font-mono text-[10px]">Just now</span>
            </div>

            <p className="text-xs text-slate-200 leading-relaxed font-medium">
              {approvalMessage}
            </p>

            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 flex items-center justify-between">
              <div>
                <span className="text-[10px] text-slate-400 block uppercase font-bold">Escort Profile</span>
                <strong className="text-white">{escortName}</strong> ({escortId})
              </div>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500 text-white font-bold text-[10px]">
                CM Approved
              </span>
            </div>
          </div>
        )}

        {/* Tab 2: Simulated Email Alert View */}
        {activeTab === 'email' && (
          <div className="p-4 rounded-2xl bg-white text-slate-900 space-y-3 mb-5 border border-slate-200 text-xs shadow-inner">
            <div className="border-b border-slate-200 pb-2">
              <div className="flex justify-between font-bold text-slate-800">
                <span>From: notifications@myeduride.com</span>
                <span className="text-[10px] text-slate-400">Today, 10:45 AM</span>
              </div>
              <div className="text-slate-600">To: {escortName.toLowerCase().replace(' ', '.')}@example.com</div>
              <div className="font-extrabold text-brand-green mt-1">
                Subject: Approval Notice - MyEduRide Shared Escort Account
              </div>
            </div>

            <div className="py-2 space-y-2 text-slate-700 leading-relaxed">
              <p>Dear {escortName},</p>
              <p className="bg-emerald-50 p-2.5 rounded-xl border border-emerald-200 text-emerald-900 font-semibold">
                {approvalMessage}
              </p>
              <p>
                Your City Manager has verified all submitted documents, NIN credentials, Driver&apos;s Licence, and vehicle photographs.
              </p>
              <p className="text-[11px] text-slate-500">
                Required Activation Fee: <strong>₦1,200.00</strong> (Includes ID Card, Barcode Badge, Digital Profile & Verification Support).
              </p>
            </div>
          </div>
        )}

        {/* Action Button */}
        <div className="space-y-2">
          <button
            onClick={() => {
              onClose();
              onProceedPayment();
            }}
            className="w-full py-3.5 px-4 rounded-2xl bg-brand-green hover:bg-emerald-600 text-white font-extrabold text-xs tracking-wide transition-all shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 uppercase"
          >
            <CreditCard className="w-4 h-4" /> Proceed to Registration Payment & Activate
          </button>
          <button
            onClick={onClose}
            className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-all text-center"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
