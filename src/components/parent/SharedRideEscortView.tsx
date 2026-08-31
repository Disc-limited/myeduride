'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Car,
  ShieldCheck,
  CheckCircle2,
  Clock,
  MapPin,
  Sparkles,
  RefreshCw,
  Copy,
  ChevronRight,
  Shield,
  Info,
  Wallet,
  Plus,
  HelpCircle,
  AlertCircle,
  Navigation,
  UserCheck,
  Award,
  ChevronDown
} from 'lucide-react';
import { toast } from 'sonner';
import { photoSrc } from '@/lib/photo';

interface SharedRideEscortViewProps {
  childrenList?: any[];
  onOpenWalletModal?: () => void;
  onSelectSafetyPillar?: (pillar: string) => void;
  className?: string;
}

export default function SharedRideEscortView({
  childrenList = [],
  onOpenWalletModal,
  onSelectSafetyPillar,
  className = '',
}: SharedRideEscortViewProps) {
  // State
  const [tripType, setTripType] = useState<'single' | 'round_trip'>('round_trip');
  const [escorts, setEscorts] = useState<any[]>([]);
  const [selectedEscortId, setSelectedEscortId] = useState<string>('');
  const [loadingEscorts, setLoadingEscorts] = useState(true);
  const [selectedStudentId, setSelectedStudentId] = useState<string>(childrenList[0]?.id || '');
  const [walletBalance, setWalletBalance] = useState<number>(25600.0);
  const [submittingBooking, setSubmittingBooking] = useState(false);
  const [showFullRouteModal, setShowFullRouteModal] = useState(false);

  // Address edit state
  const [pinnedAddress, setPinnedAddress] = useState('23, Silver Estate Road, Idimu, Lagos');
  const [isEditingAddress, setIsEditingAddress] = useState(false);

  useEffect(() => {
    fetchEscorts();
    fetchParentWallet();
  }, []);

  const fetchParentWallet = async () => {
    try {
      const res = await fetch('/api/parent/safety-connect', { credentials: 'include', cache: 'no-store' });
      const data = await res.json();
      if (res.ok && data?.safety_connect?.parent_wallet_balance !== undefined) {
        setWalletBalance(data.safety_connect.parent_wallet_balance);
      }
    } catch (err) {
      console.warn('[SharedRideEscortView] wallet fetch notice:', err);
    }
  };

  useEffect(() => {
    if (childrenList.length > 0 && !selectedStudentId) {
      setSelectedStudentId(childrenList[0].id);
    }
  }, [childrenList]);

  const fetchEscorts = async () => {
    setLoadingEscorts(true);
    try {
      const res = await fetch('/api/parent/shared-ride/escorts', {
        credentials: 'include',
        cache: 'no-store',
      });
      const data = await res.json();
      if (res.ok && data.escorts) {
        setEscorts(data.escorts);
        if (data.escorts.length > 0 && !selectedEscortId) {
          setSelectedEscortId(data.escorts[0].id);
        }
      }
    } catch (err) {
      console.warn('[SharedRideEscortView] fetch escorts error:', err);
    } finally {
      setLoadingEscorts(false);
    }
  };

  const selectedEscort = useMemo(() => {
    return escorts.find((e) => e.id === selectedEscortId) || escorts[0] || null;
  }, [escorts, selectedEscortId]);

  // Pricing calculations
  const baseFare = useMemo(() => {
    if (!selectedEscort) return 1500;
    return tripType === 'round_trip'
      ? selectedEscort.base_fare_round || 1500
      : selectedEscort.base_fare_single || 850;
  }, [selectedEscort, tripType]);

  const serviceFee = selectedEscort?.service_fee || 100;
  const totalAmount = baseFare + serviceFee;
  const isSufficientBalance = walletBalance >= totalAmount;

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success(`Copied Escort ID: ${code}`);
  };

  const handleConfirmBooking = async () => {
    if (!selectedEscort) {
      toast.error('Please select an escort to proceed');
      return;
    }

    if (!isSufficientBalance) {
      toast.error('Insufficient wallet balance. Please top up your wallet to confirm booking.');
      return;
    }

    setSubmittingBooking(true);
    try {
      const res = await fetch('/api/parent/shared-ride/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          escort_route_id: selectedEscort.id,
          student_id: selectedStudentId,
          trip_type: tripType,
          pickup_address: pinnedAddress,
          pickup_time: selectedEscort.pickup_time || '7:00 AM',
          dropoff_time: selectedEscort.dropoff_time || '2:30 PM',
          base_fare: baseFare,
          service_fee: serviceFee,
          total_amount: totalAmount,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(data.message || 'Shared Ride Escort booked successfully!');
        setWalletBalance((prev) => Math.max(0, prev - totalAmount));
      } else {
        toast.error(data.error || 'Failed to complete booking');
      }
    } catch {
      toast.error('Network error. Failed to place booking.');
    } finally {
      setSubmittingBooking(false);
    }
  };

  return (
    <div className={`space-y-6 text-slate-800 text-xs font-sans ${className}`}>
      
      {/* ------------------------------------------------------------------------- */}
      {/* TOP HEADER CONSOLE: BREADCRUMB, TITLE & HOW IT WORKS BOX */}
      {/* ------------------------------------------------------------------------- */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-slate-200/90 shadow-xs">
        <div>
          {/* Breadcrumbs */}
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 mb-1">
            <span>Safety Connect</span>
            <ChevronRight size={12} />
            <span>MyEduRide Escort</span>
            <ChevronRight size={12} />
            <span className="text-emerald-600 font-extrabold">Shared Ride Escort</span>
          </div>
          <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">
            Shared Ride Escort
          </h1>
          <p className="text-slate-500 text-xs mt-0.5 font-medium">
            Book a seat on a shared ride. Safe, reliable and on time.
          </p>
        </div>

        {/* How It Works Box */}
        <div className="bg-sky-50/80 border border-sky-200/80 rounded-2xl p-3.5 max-w-md flex items-start gap-3 text-sky-900 shrink-0">
          <div className="w-6 h-6 rounded-full bg-sky-500 text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5 shadow-xs">
            <Info size={14} />
          </div>
          <div className="space-y-1">
            <h4 className="font-extrabold text-xs text-sky-950">How it works</h4>
            <p className="text-[11px] text-sky-800 leading-snug">
              Select trip type and book a seat. The escort must complete the service before payment is deducted from your wallet.
            </p>
            <button
              onClick={() => toast.info('Shared Ride Escorts pair verified neighborhood escorts with students traveling along matched school routes.')}
              className="text-[11px] font-extrabold text-sky-600 hover:underline inline-block"
            >
              Learn more
            </button>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------------------- */}
      {/* STEP 1: CHOOSE TRIP TYPE */}
      {/* ------------------------------------------------------------------------- */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-xs space-y-4">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-emerald-600 text-white text-xs font-black flex items-center justify-center">
            1
          </span>
          <h3 className="font-extrabold text-sm text-slate-900">Choose Trip Type</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-stretch">
          {/* Option A: One Trip (Single) */}
          <div
            onClick={() => setTripType('single')}
            className={`md:col-span-4 rounded-2xl p-4 border transition-all cursor-pointer flex items-center justify-between gap-3 ${
              tripType === 'single'
                ? 'border-emerald-500 bg-emerald-50/30 ring-2 ring-emerald-500/20 shadow-sm'
                : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100/80'
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center text-slate-700 ${
                  tripType === 'single' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200'
                }`}
              >
                <Car size={20} />
              </div>
              <div>
                <h4 className="font-extrabold text-xs text-slate-900">One Trip (Single)</h4>
                <p className="text-[11px] text-slate-500 font-medium">From school or to school</p>
              </div>
            </div>
            <div
              className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                tripType === 'single' ? 'border-emerald-600 bg-emerald-600' : 'border-slate-300'
              }`}
            >
              {tripType === 'single' && <span className="w-2 h-2 rounded-full bg-white" />}
            </div>
          </div>

          {/* Option B: Complete Trip (To & Fro) */}
          <div
            onClick={() => setTripType('round_trip')}
            className={`md:col-span-4 rounded-2xl p-4 border transition-all cursor-pointer flex items-center justify-between gap-3 ${
              tripType === 'round_trip'
                ? 'border-emerald-500 bg-emerald-50/30 ring-2 ring-emerald-500/20 shadow-sm'
                : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100/80'
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  tripType === 'round_trip' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-700'
                }`}
              >
                <RefreshCw size={18} />
              </div>
              <div>
                <h4 className="font-extrabold text-xs text-slate-900">Complete Trip (To &amp; Fro)</h4>
                <p className="text-[11px] text-slate-500 font-medium">Morning and afternoon</p>
              </div>
            </div>
            <div
              className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                tripType === 'round_trip' ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-300'
              }`}
            >
              {tripType === 'round_trip' && <CheckCircle2 size={14} className="stroke-[3]" />}
            </div>
          </div>

          {/* Features Checklist Column */}
          <div className="md:col-span-4 bg-emerald-50/60 border border-emerald-200/80 rounded-2xl p-3.5 flex flex-col justify-center gap-2 text-[11px] font-bold text-slate-700">
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center gap-1.5 text-emerald-800">
                <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
                <span>Same escort for both trips</span>
              </div>
              <div className="flex items-center gap-1.5 text-emerald-800">
                <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
                <span>Pickup in the morning</span>
              </div>
              <div className="flex items-center gap-1.5 text-emerald-800">
                <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
                <span>Guaranteed unless emergency</span>
              </div>
              <div className="flex items-center gap-1.5 text-emerald-800">
                <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
                <span>Drop-off in the afternoon</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------------------- */}
      {/* MAIN 3-COLUMN LAYOUT: STEP 2, STEP 3, STEP 4 */}
      {/* ------------------------------------------------------------------------- */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        
        {/* ========================================================================= */}
        {/* COLUMN 1 (4 COLS): STEP 2 - SELECT AN ESCORT */}
        {/* ========================================================================= */}
        <div className="lg:col-span-4 bg-white rounded-3xl p-5 border border-slate-200/90 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-emerald-600 text-white text-xs font-black flex items-center justify-center">
                2
              </span>
              <h3 className="font-extrabold text-sm text-slate-900">Select an Escort</h3>
            </div>
            <button
              onClick={fetchEscorts}
              disabled={loadingEscorts}
              className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-all"
              title="Refresh Escorts"
            >
              <RefreshCw size={14} className={loadingEscorts ? 'animate-spin' : ''} />
            </button>
          </div>

          {/* Sub-tabs */}
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <div className="flex items-center gap-3">
              <span className="font-extrabold text-xs text-emerald-700 border-b-2 border-emerald-600 pb-2 -mb-2.5">
                Available Escorts ({escorts.length})
              </span>
              <span className="font-bold text-xs text-slate-400">
                Closed Escorts (0)
              </span>
            </div>
          </div>

          {/* Escort List */}
          {loadingEscorts ? (
            <div className="py-12 text-center space-y-3">
              <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-[11px] font-bold text-slate-400">Loading verified escorts from database...</p>
            </div>
          ) : escorts.length === 0 ? (
            <div className="bg-slate-50 border border-dashed border-slate-300 rounded-2xl p-6 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 text-slate-400 flex items-center justify-center mx-auto shadow-xs">
                <Car size={24} />
              </div>
              <h4 className="font-extrabold text-slate-900 text-xs">No Shared Ride Escorts Available Yet</h4>
              <p className="text-[11px] text-slate-500 max-w-xs mx-auto leading-relaxed">
                There are currently no active verified shared ride escorts assigned to your school route area in the database.
              </p>
              <button
                onClick={() => onSelectSafetyPillar && onSelectSafetyPillar('myeduride_escort')}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs transition-all shadow-xs"
              >
                Request MyEduRide Escort
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {escorts.map((escort) => {
                const isSelected = escort.id === selectedEscortId;

                return (
                  <div
                    key={escort.id}
                    onClick={() => setSelectedEscortId(escort.id)}
                    className={`rounded-2xl p-4 border transition-all cursor-pointer relative ${
                      isSelected
                        ? 'border-emerald-500 bg-emerald-50/20 ring-2 ring-emerald-500/20 shadow-sm'
                        : 'border-slate-200/90 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Radio Selection indicator */}
                      <div
                        className={`w-4 h-4 rounded-full border-2 mt-1 shrink-0 flex items-center justify-center ${
                          isSelected ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-300'
                        }`}
                      >
                        {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </div>

                      {/* Escort Avatar */}
                      <img
                        src={photoSrc(escort.escort_avatar_url) || ''}
                        alt={escort.escort_name}
                        className="w-12 h-12 rounded-2xl object-cover shrink-0 border border-slate-200 shadow-xs"
                      />

                      {/* Escort Meta Info */}
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center justify-between gap-1">
                          <div className="flex items-center gap-1.5 truncate">
                            <h4 className="font-extrabold text-xs text-slate-900 truncate">
                              {escort.escort_name}
                            </h4>
                            <span className="px-1.5 py-0.2 rounded-md bg-emerald-100 text-emerald-800 text-[9px] font-black uppercase">
                              Verified
                            </span>
                          </div>
                          {isSelected && <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />}
                        </div>

                        <p className="text-[11px] text-slate-500 font-medium">
                          {escort.vehicle_model}
                        </p>

                        <div className="flex items-center gap-3 text-[10px] text-slate-500 font-medium pt-0.5">
                          <span className="flex items-center gap-1 text-amber-600 font-bold">
                            ★ {escort.rating} <span className="text-slate-400 font-normal">({escort.total_reviews})</span>
                          </span>
                          <span className="text-slate-400">ID: {escort.escort_code}</span>
                        </div>
                      </div>
                    </div>

                    {/* Metric Cards Row */}
                    <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-slate-100 text-center">
                      <div className="bg-slate-50 rounded-xl p-1.5">
                        <span className="text-[9px] font-bold text-slate-400 uppercase block">Pickup Time</span>
                        <strong className="text-xs font-black text-slate-900">{escort.pickup_time}</strong>
                      </div>
                      <div className="bg-slate-50 rounded-xl p-1.5">
                        <span className="text-[9px] font-bold text-slate-400 uppercase block">ETA to School</span>
                        <strong className="text-xs font-black text-slate-900">{escort.eta_minutes} min</strong>
                      </div>
                      <div className="bg-slate-50 rounded-xl p-1.5">
                        <span className="text-[9px] font-bold text-slate-400 uppercase block">Available Seats</span>
                        <strong className="text-xs font-black text-emerald-600">{escort.available_seats}</strong>
                      </div>
                    </div>
                  </div>
                );
              })}

              <button
                onClick={() => toast.info('All active verified escorts in your route radius are currently loaded.')}
                className="w-full py-2.5 rounded-2xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 font-extrabold text-xs transition-all text-center"
              >
                Load More Escorts ↓
              </button>

              <div className="flex items-center gap-2 text-[10px] text-slate-500 pt-1">
                <ShieldCheck size={14} className="text-emerald-600 shrink-0" />
                <span>All escorts are background-checked, verified and trained by MyEduRide.</span>
              </div>
            </div>
          )}
        </div>

        {/* ========================================================================= */}
        {/* COLUMN 2 (5 COLS): STEP 3 - ESCORT & ROUTE DETAILS */}
        {/* ========================================================================= */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-emerald-600 text-white text-xs font-black flex items-center justify-center">
                  3
                </span>
                <h3 className="font-extrabold text-sm text-slate-900">Escort &amp; Route Details</h3>
              </div>
              <span className="text-[10px] font-extrabold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                Selected Escort
              </span>
            </div>

            {selectedEscort && (
              <>
                {/* Selected Escort Profile Card Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-slate-50/80 border border-slate-200/80">
                  <div className="flex items-center gap-3">
                    <img
                      src={photoSrc(selectedEscort.escort_avatar_url) || ''}
                      alt={selectedEscort.escort_name}
                      className="w-14 h-14 rounded-2xl object-cover border-2 border-white shadow-sm shrink-0"
                    />
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-black text-sm text-slate-900">
                          {selectedEscort.escort_name}
                        </h3>
                        <span className="px-1.5 py-0.2 rounded-md bg-emerald-100 text-emerald-800 text-[9px] font-black uppercase">
                          Verified
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                        <span>ID: {selectedEscort.escort_code}</span>
                        <button
                          onClick={() => handleCopyCode(selectedEscort.escort_code)}
                          className="text-slate-400 hover:text-slate-700"
                        >
                          <Copy size={13} />
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 sm:border-l sm:border-slate-200 sm:pl-4">
                    <div className="w-12 h-10 rounded-xl bg-white flex items-center justify-center border border-slate-200 shrink-0">
                      <Car size={22} className="text-slate-700" />
                    </div>
                    <div>
                      <h4 className="font-extrabold text-xs text-slate-900">
                        {selectedEscort.vehicle_model}
                      </h4>
                      <p className="text-[10px] text-slate-500 font-medium">
                        {selectedEscort.vehicle_color || 'White'}
                      </p>
                      <span className="text-[10px] font-extrabold text-emerald-600 bg-emerald-100/70 px-1.5 py-0.2 rounded-md inline-block mt-0.5">
                        {selectedEscort.available_seats} Seats Available
                      </span>
                    </div>
                  </div>
                </div>

                {/* Route Timeline & Visual Map Preview */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                  
                  {/* Route Timeline (5 Cols) */}
                  <div className="md:col-span-5 space-y-4 pl-1">
                    {/* Stop 1: Pickup */}
                    <div className="relative flex items-start gap-3">
                      <div className="w-3.5 h-3.5 rounded-full bg-emerald-600 ring-4 ring-emerald-100 shrink-0 mt-1" />
                      <div className="space-y-0.5 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-extrabold text-xs text-slate-900">Your Pickup</span>
                          <span className="px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 text-[9px] font-mono font-bold">
                            {selectedEscort.pickup_time}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 font-medium truncate">
                          {pinnedAddress}
                        </p>
                      </div>
                    </div>

                    {/* Timeline Connector Line */}
                    <div className="ml-1.5 w-0.5 h-6 bg-slate-200 -my-2" />

                    {/* Stop 2: School 1 */}
                    <div className="relative flex items-start gap-3">
                      <div className="w-3.5 h-3.5 rounded-full bg-sky-500 ring-4 ring-sky-100 shrink-0 mt-1" />
                      <div className="space-y-0.5 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-extrabold text-xs text-slate-900">Command Day School</span>
                          <span className="text-[10px] text-slate-400 font-mono">7:18 AM</span>
                        </div>
                        <p className="text-[11px] text-slate-500 font-medium">School, Ipaja</p>
                      </div>
                    </div>

                    {/* Timeline Connector Line */}
                    <div className="ml-1.5 w-0.5 h-6 bg-slate-200 -my-2" />

                    {/* Stop 3: School 2 */}
                    <div className="relative flex items-start gap-3">
                      <div className="w-3.5 h-3.5 rounded-full bg-rose-500 ring-4 ring-rose-100 shrink-0 mt-1" />
                      <div className="space-y-0.5 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-extrabold text-xs text-slate-900">Greenfield Int. School</span>
                          <span className="text-[10px] text-slate-400 font-mono">2:30 PM</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Visual Route Map Preview Card (7 Cols) */}
                  <div className="md:col-span-7 bg-slate-900 rounded-2xl p-4 text-white relative overflow-hidden h-44 flex flex-col justify-between border border-slate-800 shadow-md">
                    {/* Simulated Map Background Canvas */}
                    <div className="absolute inset-0 bg-gradient-to-tr from-slate-950 via-slate-900 to-slate-800 opacity-90" />
                    
                    {/* Simulated Route Polyline SVG */}
                    <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-40">
                      <path
                        d="M 30 110 Q 120 40 220 90 T 320 60"
                        fill="none"
                        stroke="#10B981"
                        strokeWidth="4"
                        strokeDasharray="6 4"
                      />
                    </svg>

                    {/* Map Badge Top Right */}
                    <div className="relative z-10 flex items-center justify-between">
                      <span className="px-2 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-500/30 flex items-center gap-1">
                        <Navigation size={12} />
                        <span>Route Preview</span>
                      </span>
                      <span className="px-2 py-1 rounded-lg bg-white/10 backdrop-blur text-white text-[10px] font-bold">
                        {selectedEscort.eta_minutes} min ETA to School
                      </span>
                    </div>

                    {/* Map Footer Link */}
                    <div className="relative z-10 flex items-center justify-between pt-2 border-t border-white/10">
                      <span className="text-[10px] text-slate-300 font-medium">Interactive Route Polyline</span>
                      <button
                        onClick={() => toast.info('Full interactive GPS map view opened')}
                        className="text-[11px] font-extrabold text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
                      >
                        <span>View full route</span>
                        <ChevronRight size={12} />
                      </button>
                    </div>
                  </div>

                </div>

                {/* Assurance Badges Row */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-100 text-[10px] text-slate-600">
                  <div className="flex items-center gap-1.5 bg-slate-50 p-2 rounded-xl">
                    <Navigation size={14} className="text-emerald-600 shrink-0" />
                    <div>
                      <strong className="block font-bold text-slate-900">Live Tracking</strong>
                      <span className="text-[9px] text-slate-400">Track in real-time</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 bg-slate-50 p-2 rounded-xl">
                    <ShieldCheck size={14} className="text-emerald-600 shrink-0" />
                    <div>
                      <strong className="block font-bold text-slate-900">Daily Safety Check</strong>
                      <span className="text-[9px] text-slate-400">Vehicle &amp; driver verified</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 bg-slate-50 p-2 rounded-xl">
                    <Award size={14} className="text-emerald-600 shrink-0" />
                    <div>
                      <strong className="block font-bold text-slate-900">Insurance Cover</strong>
                      <span className="text-[9px] text-slate-400">All rides are insured</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 bg-slate-50 p-2 rounded-xl">
                    <HelpCircle size={14} className="text-emerald-600 shrink-0" />
                    <div>
                      <strong className="block font-bold text-slate-900">24/7 Support</strong>
                      <span className="text-[9px] text-slate-400">We&apos;ve got you covered</span>
                    </div>
                  </div>
                </div>

                {/* Service Guarantee Banner */}
                <div className="bg-sky-50/70 border border-sky-200/70 rounded-2xl p-4 flex items-start gap-3 text-sky-950">
                  <div className="w-8 h-8 rounded-xl bg-sky-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                    <ShieldCheck size={18} />
                  </div>
                  <div className="space-y-1">
                    <h4 className="font-extrabold text-xs text-sky-950">Service Guarantee</h4>
                    <p className="text-[11px] text-sky-800 leading-snug">
                      This escort is committed to completing the trip.
                    </p>
                    <ul className="text-[11px] text-sky-800 list-disc list-inside space-y-0.5 pt-0.5">
                      <li>Same escort for both morning and afternoon.</li>
                      <li>Changes only in emergency (breakdown or early dismissal).</li>
                    </ul>
                  </div>
                </div>

              </>
            )}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* COLUMN 3 (3 COLS): STEP 4 - BOOKING SUMMARY */}
        {/* ========================================================================= */}
        <div className="lg:col-span-3 space-y-4">
          <div className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-xs space-y-4">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-emerald-600 text-white text-xs font-black flex items-center justify-center">
                4
              </span>
              <h3 className="font-extrabold text-sm text-slate-900">Booking Summary</h3>
            </div>

            {/* Breakdown List */}
            <div className="space-y-3 text-xs border-b border-slate-100 pb-4">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Trip Type</span>
                <span className="font-extrabold text-slate-900">
                  {tripType === 'round_trip' ? 'Complete Trip (To & Fro)' : 'One Trip (Single)'}
                </span>
              </div>

              {/* Student Selector */}
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-500 font-medium">Students</span>
                <select
                  value={selectedStudentId}
                  onChange={(e) => setSelectedStudentId(e.target.value)}
                  className="px-2.5 py-1 rounded-xl bg-slate-50 border border-slate-200 text-xs font-extrabold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {childrenList.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.first_name} {c.last_name}
                    </option>
                  ))}
                  {childrenList.length === 0 && <option value="STU-001">1 Student (David)</option>}
                </select>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Seat Type</span>
                <span className="font-extrabold text-slate-900">Shared Seat</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Pickup Time</span>
                <span className="font-extrabold text-slate-900">{selectedEscort?.pickup_time || '7:00 AM'}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Drop-off Time</span>
                <span className="font-extrabold text-slate-900">{selectedEscort?.dropoff_time || '2:30 PM'}</span>
              </div>
            </div>

            {/* Fare Details */}
            <div className="space-y-2">
              <h4 className="font-extrabold text-xs text-slate-900">Fare Details</h4>
              <div className="flex items-center justify-between text-xs text-slate-600">
                <span>Base Fare ({tripType === 'round_trip' ? 'To & Fro' : 'Single'})</span>
                <span className="font-mono font-bold">₦{baseFare.toLocaleString('en-NG', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex items-center justify-between text-xs text-slate-600">
                <span>Service Fee</span>
                <span className="font-mono font-bold">₦{serviceFee.toLocaleString('en-NG', { minimumFractionDigits: 2 })}</span>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-200/80 text-sm">
                <span className="font-black text-slate-900">Total Amount</span>
                <span className="font-black text-slate-900 font-mono text-base">
                  ₦{totalAmount.toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {/* Wallet Balance Status Card */}
            <div className="bg-sky-50/60 border border-sky-200/80 rounded-2xl p-3.5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Wallet size={16} className="text-sky-700" />
                  <span className="text-xs font-bold text-sky-950">Wallet Balance</span>
                </div>
                {isSufficientBalance ? (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[9px] font-black uppercase flex items-center gap-1">
                    <CheckCircle2 size={10} /> Sufficient Balance
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[9px] font-black uppercase">
                    Low Balance
                  </span>
                )}
              </div>

              <div className="text-center py-1">
                <strong className="text-xl font-black text-sky-950 font-mono">
                  ₦{walletBalance.toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                </strong>
              </div>

              <button
                onClick={() => {
                  if (onOpenWalletModal) onOpenWalletModal();
                  else toast.info('Opening wallet top up modal...');
                }}
                className="w-full py-2 rounded-xl bg-white hover:bg-slate-50 border border-sky-300 text-sky-900 font-extrabold text-xs transition-all shadow-xs flex items-center justify-center gap-1"
              >
                <Plus size={14} /> Top Up Wallet
              </button>
            </div>

            {/* Payment Policy Notice */}
            <div className="bg-amber-50/60 border border-amber-200/80 rounded-2xl p-3 space-y-1 text-amber-950">
              <h5 className="font-extrabold text-[11px] flex items-center gap-1 text-amber-900">
                <Info size={12} /> Payment Policy
              </h5>
              <p className="text-[10px] text-amber-800 leading-snug">
                Payment will be deducted from your wallet only after the escort successfully completes the service. Insufficient balance? The escort cannot start the service.
              </p>
            </div>

            {/* CTA Action Button */}
            <button
              onClick={handleConfirmBooking}
              disabled={submittingBooking}
              className="w-full py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-700 active:scale-95 disabled:opacity-50 text-white font-extrabold text-sm shadow-lg shadow-blue-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              {submittingBooking ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Processing Booking...</span>
                </>
              ) : (
                <span>Confirm Booking</span>
              )}
            </button>
          </div>
        </div>

      </div>

      {/* ------------------------------------------------------------------------- */}
      {/* BOTTOM BANNER: E-DRIVE EXCLUSIVE RIDE PROMOTION */}
      {/* ------------------------------------------------------------------------- */}
      <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-teal-950 rounded-3xl p-5 md:p-6 text-white border border-emerald-800/60 shadow-xl flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden">
        <div className="flex items-center gap-4 relative z-10">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center justify-center shrink-0 shadow-lg">
            <Award size={24} />
          </div>
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-black text-base text-white tracking-tight">
                E-DRIVE (Exclusive Ride)
              </h3>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/30 text-emerald-300 text-[10px] font-extrabold border border-emerald-400/30">
                VIP Comfort
              </span>
            </div>
            <p className="text-slate-300 text-xs font-medium max-w-xl leading-relaxed">
              Want the whole vehicle to yourself? Book all seats and enjoy privacy, comfort and direct ride to your destination.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-5 relative z-10 shrink-0">
          <div className="text-right">
            <span className="text-[10px] font-bold text-slate-400 block uppercase">Price (To &amp; Fro)</span>
            <div className="flex items-baseline gap-2 font-mono">
              <span className="text-xs text-slate-400 line-through">₦6,400</span>
              <strong className="text-base font-black text-emerald-400">₦6,080</strong>
              <span className="px-1.5 py-0.2 rounded bg-rose-500/30 text-rose-300 text-[9px] font-extrabold">5% OFF</span>
            </div>
          </div>

          <button
            onClick={() => {
              if (onSelectSafetyPillar) onSelectSafetyPillar('edrive');
              else toast.info('Switching to E-Drive Exclusive Ride...');
            }}
            className="px-5 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs transition-all shadow-lg shadow-emerald-500/30 active:scale-95 cursor-pointer"
          >
            Book E-DRIVE
          </button>
        </div>
      </div>

    </div>
  );
}
