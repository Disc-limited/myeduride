'use client';

import { useState } from 'react';
import {
  Bus,
  ShieldCheck,
  Clock,
  MapPin,
  CheckCircle2,
  AlertCircle,
  Radio,
  Users,
  ExternalLink,
  Phone
} from 'lucide-react';
import { toast } from 'sonner';

interface InboundVehicle {
  id: string;
  vehicleReg: string;
  vehicleModel: string;
  driverName: string;
  driverPhone: string;
  escortName: string;
  routeName: string;
  distanceToGateMeters: number;
  etaMinutes: number;
  studentCount: number;
  status: 'approaching' | 'at_gate' | 'cleared';
  lastPing: string;
}

const DEFAULT_INBOUND: InboundVehicle[] = [];

export default function GateInboundVehicleQueue({
  schoolId,
  schoolName = '',
}: {
  schoolId?: string;
  schoolName?: string;
}) {
  const [inboundQueue, setInboundQueue] = useState<InboundVehicle[]>(DEFAULT_INBOUND);

  const handleClearGate = (id: string, reg: string) => {
    setInboundQueue((prev) =>
      prev.map((v) => (v.id === id ? { ...v, status: 'cleared' } : v))
    );
    toast.success(`Vehicle ${reg} cleared for campus entry! Student offloading manifest initiated.`);
  };

  return (
    <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-4 font-sans text-slate-800">
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-200 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-extrabold text-slate-900 text-sm tracking-tight">
                Inbound Shuttle Gate Radar (1.5 km Perimeter)
              </h3>
              <span className="bg-indigo-100 text-indigo-800 text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-ping" />
                Live Radar
              </span>
            </div>
            <p className="text-[11px] text-slate-500">
              Shuttles en route to {schoolName} gate with real-time arrival ETAs
            </p>
          </div>
        </div>

        <span className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-xl">
          {inboundQueue.filter((v) => v.status !== 'cleared').length} Approaching
        </span>
      </div>

      {/* Inbound Vehicles List */}
      <div className="space-y-3">
        {inboundQueue.length === 0 && (
          <div className="py-8 text-center bg-slate-50/80 rounded-2xl border border-slate-200 p-4">
            <Bus className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-bold text-slate-700">No Vehicles Inbound</p>
            <p className="text-xs text-slate-500 mt-0.5">Active shuttles approaching campus will appear here automatically.</p>
          </div>
        )}
        {inboundQueue.map((item) => {
          const isAtGate = item.status === 'at_gate';
          const isCleared = item.status === 'cleared';

          return (
            <div
              key={item.id}
              className={`p-4 rounded-2xl border transition-all ${
                isCleared
                  ? 'bg-slate-50/60 border-slate-200 opacity-60'
                  : isAtGate
                  ? 'bg-amber-50/60 border-amber-300 ring-2 ring-amber-400/30'
                  : 'bg-slate-50 border-slate-200'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                
                {/* Left: Vehicle & Route Info */}
                <div className="flex items-center gap-3">
                  <div className={`w-11 h-11 rounded-2xl flex items-center justify-center text-white font-bold shadow-md shrink-0 ${
                    isCleared ? 'bg-slate-400' : isAtGate ? 'bg-amber-500' : 'bg-emerald-600'
                  }`}>
                    <Bus className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-extrabold text-slate-900 text-sm">{item.vehicleReg}</h4>
                      <span className="text-[10px] text-slate-500">({item.vehicleModel})</span>
                    </div>
                    <p className="text-xs text-slate-600 font-medium">{item.routeName}</p>
                    <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-500">
                      <span>Escort: <strong className="text-slate-800">{item.escortName}</strong></span>
                      <span>•</span>
                      <span>Driver: <strong className="text-slate-800">{item.driverName}</strong></span>
                    </div>
                  </div>
                </div>

                {/* Right: Telemetry Metrics & Gate Clearance Action */}
                <div className="flex items-center gap-3 self-end sm:self-center">
                  
                  {/* Distance & ETA Badge */}
                  <div className="text-right">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      {isCleared ? 'Gate Cleared' : isAtGate ? 'At Gate' : 'Inbound ETA'}
                    </span>
                    <span className={`text-sm font-black ${
                      isCleared ? 'text-slate-400' : isAtGate ? 'text-amber-700 animate-pulse' : 'text-emerald-700'
                    }`}>
                      {isCleared ? 'Entered' : isAtGate ? 'Arrived at Gate' : `~ ${item.etaMinutes} min (${item.distanceToGateMeters}m)`}
                    </span>
                  </div>

                  {/* Student Manifest Count */}
                  <div className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-center shadow-2xs">
                    <span className="text-[9px] font-bold text-slate-400 block uppercase">Students</span>
                    <span className="text-xs font-black text-slate-900">{item.studentCount}</span>
                  </div>

                  {/* Action Button */}
                  {!isCleared ? (
                    <button
                      type="button"
                      onClick={() => handleClearGate(item.id, item.vehicleReg)}
                      className={`px-3.5 py-2 rounded-xl text-white font-extrabold text-xs shadow-md transition-all flex items-center gap-1.5 cursor-pointer ${
                        isAtGate
                          ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/20'
                          : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20'
                      }`}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{isAtGate ? 'Admit to Campus' : 'Pre-Clear'}</span>
                    </button>
                  ) : (
                    <span className="px-3 py-1.5 rounded-xl bg-emerald-100 text-emerald-800 font-extrabold text-xs flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Admitted
                    </span>
                  )}

                </div>

              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
}
