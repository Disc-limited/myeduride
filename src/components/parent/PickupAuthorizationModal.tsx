// @ts-nocheck
'use client';

import { useState, useEffect } from 'react';
import {
  ShieldCheck,
  UserCheck,
  Phone,
  Camera,
  AlertTriangle,
  CheckCircle2,
  Lock,
  Plus,
  Trash2,
  X,
  FileCheck,
  ArrowRight,
  ArrowLeft,
  User,
  Users,
  Car,
  Layers,
  Sparkles,
  Info
} from 'lucide-react';
import { toast } from 'sonner';
import { photoSrc } from '@/lib/photo';

interface PickupAuthorizationModalProps {
  isOpen: boolean;
  onClose: () => void;
  childId?: string;
  childName?: string;
  onUpdated?: () => void;
}

type ModalMode = 'list' | 'enter' | 'review' | 'success';

export default function PickupAuthorizationModal({
  isOpen,
  onClose,
  childId = 'STU-001',
  childName = 'David James',
  onUpdated,
}: PickupAuthorizationModalProps) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<ModalMode>('list');
  const [selectedSlotNum, setSelectedSlotNum] = useState<number | null>(null);

  // 5-Step Form State
  const [form, setForm] = useState({
    name: '',
    category: 'family_member',
    relationship: 'Uncle',
    phone: '',
    photo_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150',
    emergency_notes: 'Authorized for gate release.',
    legal_confirmation: false,
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadData();
      setMode('list');
    }
  }, [isOpen, childId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/parent/pickup-authorizations?child_id=${childId}`, {
        credentials: 'include',
        cache: 'no-store',
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setData(json);
      } else {
        toast.error(json.error || 'Failed to load pickup authorizations');
      }
    } catch {
      toast.error('Network error loading authorizations');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAdd = (slotNum?: number) => {
    setSelectedSlotNum(slotNum || null);
    setForm({
      name: '',
      category: 'family_member',
      relationship: 'Mother',
      phone: '',
      photo_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
      emergency_notes: 'Authorized for school gate pickup.',
      legal_confirmation: false,
    });
    setMode('enter');
  };

  const handleProceedToReview = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.relationship.trim() || !form.phone.trim()) {
      return toast.error('Full name, relationship, and phone number are required.');
    }
    setMode('review');
  };

  const handleConfirmAndSubmit = async () => {
    if (!form.legal_confirmation) {
      return toast.error('You must confirm the legal authorization acknowledgment.');
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/parent/pickup-authorizations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          child_id: childId,
          target_slot_number: selectedSlotNum,
          ...form,
        }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        toast.success(json.message || 'Authorized person recorded and transmitted to Gate Officer!');
        setMode('success');
        await loadData();
        onUpdated?.();
      } else {
        toast.error(json.error || 'Authorization failed');
      }
    } catch {
      toast.error('Error recording authorization');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteSlot = async (slotNumber: number, personName: string) => {
    if (!confirm(`Are you sure you want to remove ${personName} from Slot ${slotNumber}?`)) return;
    try {
      const res = await fetch(
        `/api/parent/pickup-authorizations?child_id=${childId}&slot_number=${slotNumber}`,
        {
          method: 'DELETE',
          credentials: 'include',
        }
      );
      const json = await res.json();
      if (res.ok && json.success) {
        toast.success('Pickup authorization removed and slot freed.');
        await loadData();
        onUpdated?.();
      } else {
        toast.error(json.error || 'Failed to remove slot');
      }
    } catch {
      toast.error('Error removing slot');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 font-sans">
      <div className="bg-white rounded-3xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl border border-slate-200 overflow-y-auto max-h-[92vh] space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
              <ShieldCheck size={20} />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 leading-tight">
                Emergency &amp; Authorized Pickup List
              </h2>
              <p className="text-xs text-slate-500">
                Child Safety Record for <strong className="text-slate-800">{childName}</strong>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* ========================================================================= */}
        {/* PRE-SUBMISSION SAFETY EXPLAINER BANNER (MANDATORY REQUIREMENT)           */}
        {/* ========================================================================= */}
        <div className="p-4 rounded-2xl bg-gradient-to-r from-indigo-900 via-slate-900 to-slate-950 text-white shadow-xs space-y-2">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
              <Lock size={10} /> Child Safety &amp; Gate Protocol
            </span>
            <span className="text-[11px] text-slate-300 font-mono">Max 3 Authorized Slots</span>
          </div>
          <p className="text-xs text-slate-200 leading-relaxed font-medium">
            This pickup list forms an <strong>official, immutable part of your child&apos;s safety record</strong>. The Gate Officer and School Staff will <strong>ONLY release your child</strong> to individuals registered across your <strong>3 allocated slots</strong> upon photograph and identity verification.
          </p>
          <div className="grid grid-cols-3 gap-2 pt-1 text-[11px] text-slate-300 border-t border-slate-800">
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span>1. Escorts</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-cyan-400" />
              <span>2. Family Members</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              <span>3. Other Approved</span>
            </div>
          </div>
        </div>

        {/* 3-Slot Occupancy Visualizer Bar */}
        <div className="grid grid-cols-3 gap-2.5">
          {data?.slots?.map((slot: any) => (
            <div
              key={slot.slot_number}
              className={`p-3 rounded-2xl border text-xs transition-all ${
                slot.status === 'FILLED'
                  ? 'bg-emerald-50/70 border-emerald-300 text-emerald-950 shadow-2xs'
                  : 'bg-slate-50 border-dashed border-slate-300 text-slate-500'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-mono font-black text-[10px] uppercase">
                  Slot #{slot.slot_number}
                </span>
                <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase ${
                  slot.status === 'FILLED' ? 'bg-emerald-200 text-emerald-900' : 'bg-slate-200 text-slate-600'
                }`}>
                  {slot.status}
                </span>
              </div>
              <p className="font-bold text-xs truncate">
                {slot.status === 'FILLED' ? slot.person?.name : 'Available Slot'}
              </p>
              <p className="text-[10px] text-slate-500 truncate">
                {slot.status === 'FILLED' ? slot.person?.relationship : 'Click to authorize'}
              </p>
            </div>
          ))}
        </div>

        {/* ========================================================================= */}
        {/* MODE 1: 3-SLOT LIST & CATEGORIZED VIEW                                    */}
        {/* ========================================================================= */}
        {mode === 'list' && (
          <div className="space-y-4">
            {/* Slot Items Cards */}
            <div className="space-y-3">
              {data?.slots?.map((slot: any) => {
                const person = slot.person;
                if (slot.status === 'FILLED' && person) {
                  return (
                    <div
                      key={slot.slot_number}
                      className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-3.5">
                        <div className="w-13 h-13 rounded-2xl overflow-hidden bg-slate-100 border border-slate-200 shrink-0">
                          <img
                            src={photoSrc(person.photo_url)}
                            alt={person.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <h4 className="font-black text-slate-900 text-sm">{person.name}</h4>
                            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                              Slot {slot.slot_number} · {person.category_label || person.category}
                            </span>
                          </div>
                          <p className="text-slate-600 text-xs">
                            Relationship: <strong className="text-slate-900">{person.relationship}</strong>
                          </p>
                          <p className="text-[11px] text-slate-500 font-mono">
                            📞 {person.phone} · <span className="text-emerald-700 font-bold">✓ Synced to Gate Officer</span>
                          </p>
                          <p className="text-[10px] text-slate-400 italic">{person.emergency_notes}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleDeleteSlot(slot.slot_number, person.name)}
                          className="px-3 py-1.5 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 font-bold text-[11px] flex items-center gap-1 cursor-pointer transition-all"
                        >
                          <Trash2 size={12} /> Remove
                        </button>
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={slot.slot_number}
                    onClick={() => handleOpenAdd(slot.slot_number)}
                    className="p-4 rounded-2xl bg-slate-50 hover:bg-slate-100/80 border border-dashed border-slate-300 flex items-center justify-between text-xs cursor-pointer transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-200 text-slate-500 flex items-center justify-center font-bold group-hover:bg-emerald-100 group-hover:text-emerald-700 transition-colors">
                        <Plus size={18} />
                      </div>
                      <div>
                        <p className="font-bold text-slate-800">
                          Slot #{slot.slot_number} is Empty
                        </p>
                        <p className="text-[11px] text-slate-500">
                          Click to authorize an Escort, Family Member, or Approved Alternate
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="px-3.5 py-1.5 rounded-xl bg-emerald-600 group-hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1 shadow-xs"
                    >
                      Authorize Slot #{slot.slot_number} <ArrowRight size={13} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* STEP 1: PARENT ENTERS THE AUTHORISED PERSON                               */}
        {/* ========================================================================= */}
        {mode === 'enter' && (
          <form onSubmit={handleProceedToReview} className="space-y-4 text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <span className="font-black text-slate-900 text-sm flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px]">1</span>
                Step 1: Enter Authorised Person Details
              </span>
              <button
                type="button"
                onClick={() => setMode('list')}
                className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer"
              >
                <ArrowLeft size={13} /> Back to Slots
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Full Legal Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Mary Okafor"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Authorisation Category *</label>
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800"
                >
                  <option value="family_member">Family Member (Mother, Father, Grandparent, etc.)</option>
                  <option value="escort">Escort (School / MyEduRide Certified)</option>
                  <option value="other_approved">Other Approved Person (Trusted Driver, Neighbor)</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Relationship to Child *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Mother, Uncle, Designated Driver"
                  value={form.relationship}
                  onChange={(e) => setForm({ ...form, relationship: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Phone Number *</label>
                <input
                  type="tel"
                  required
                  placeholder="e.g. +234 803 112 4455"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Emergency &amp; Handover Notes</label>
              <input
                type="text"
                placeholder="e.g. Authorized for regular Tuesday & Thursday pickup."
                value={form.emergency_notes}
                onChange={(e) => setForm({ ...form, emergency_notes: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setMode('list')}
                className="px-4 py-2 rounded-xl border border-slate-200 font-bold text-slate-600 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold cursor-pointer shadow-xs flex items-center gap-1.5"
              >
                <span>Step 2: Review Information</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </form>
        )}

        {/* ========================================================================= */}
        {/* STEP 2 & 3: PARENT REVIEWS & CONFIRMS INFORMATION                         */}
        {/* ========================================================================= */}
        {mode === 'review' && (
          <div className="space-y-4 text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <span className="font-black text-slate-900 text-sm flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-amber-500 text-white flex items-center justify-center text-[10px]">2</span>
                Step 2 &amp; 3: Review &amp; Legal Confirmation
              </span>
              <button
                type="button"
                onClick={() => setMode('enter')}
                className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer"
              >
                <ArrowLeft size={13} /> Edit Information
              </button>
            </div>

            {/* Verification Summary Card */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                Gate Officer Verification Preview
              </span>

              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl overflow-hidden bg-slate-200 border-2 border-emerald-500 shrink-0">
                  <img src={photoSrc(form.photo_url)} alt="" className="w-full h-full object-cover" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h4 className="text-base font-black text-slate-900">{form.name}</h4>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                      {form.category === 'escort' ? 'Escort' : form.category === 'family_member' ? 'Family Member' : 'Other Approved'}
                    </span>
                  </div>
                  <p className="text-slate-600">Relationship: <strong>{form.relationship}</strong> to {childName}</p>
                  <p className="text-slate-600 font-mono">Phone: <strong>{form.phone}</strong></p>
                  <p className="text-slate-500 italic text-[11px]">{form.emergency_notes}</p>
                </div>
              </div>
            </div>

            {/* Step 3: Legal Confirmation Checkbox */}
            <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 space-y-2">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.legal_confirmation}
                  onChange={(e) => setForm({ ...form, legal_confirmation: e.target.checked })}
                  className="mt-0.5 w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer"
                />
                <span className="text-slate-800 font-bold leading-tight">
                  I legally confirm that this person is authorized to take physical custody of my child ({childName}) at the school gate. This will become an official part of the school safety record.
                </span>
              </label>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setMode('enter')}
                className="px-4 py-2 rounded-xl border border-slate-200 font-bold text-slate-600 cursor-pointer"
              >
                Back to Edit
              </button>
              <button
                type="button"
                disabled={!form.legal_confirmation || submitting}
                onClick={handleConfirmAndSubmit}
                className={`px-5 py-2.5 rounded-xl font-black text-white cursor-pointer shadow-xs flex items-center gap-1.5 transition-all ${
                  form.legal_confirmation
                    ? 'bg-emerald-600 hover:bg-emerald-500'
                    : 'bg-slate-300 cursor-not-allowed text-slate-500'
                }`}
              >
                <CheckCircle2 size={15} />
                <span>{submitting ? 'Recording & Transmitting...' : 'Step 4 & 5: Confirm & Transmit to Gate Officer'}</span>
              </button>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* STEP 4 & 5: SYSTEM RECORDED & GATE OFFICER RECEIVED (SUCCESS STATE)       */}
        {/* ========================================================================= */}
        {mode === 'success' && (
          <div className="p-6 text-center space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-sm">
              <CheckCircle2 size={32} />
            </div>

            <div>
              <h3 className="text-lg font-black text-slate-900">Authorisation Recorded Successfully!</h3>
              <p className="text-xs text-slate-600 max-w-md mx-auto mt-1">
                The authorized pickup person has been registered into <strong>{childName}&apos;s child safety record</strong> and synchronized in real time with the <strong>School Administration and Gate Officer</strong>.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setMode('list')}
              className="px-6 py-2.5 rounded-xl bg-[#0B1E36] hover:bg-[#07132B] text-white font-bold text-xs cursor-pointer shadow-md transition-all"
            >
              View 3-Slot Pickup List
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
