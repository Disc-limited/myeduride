// @ts-nocheck
'use client';

import React from 'react';
import {
  Phone,
  MapPin,
  CheckCircle2,
  Clock,
  Navigation,
  ChevronRight,
  Sun,
  Shield,
  Volume2,
  Mic,
  MessageSquare,
  AlertTriangle,
  FileText,
  User,
  Users,
  LogOut,
  Sparkles,
  ArrowRight,
  Radio,
  Share2
} from 'lucide-react';

interface EscortWorkflowCanvasProps {
  onSelectStep?: (stepIndex: number) => void;
}

export default function EscortWorkflowCanvas({ onSelectStep }: EscortWorkflowCanvasProps) {
  return (
    <div className="space-y-8 bg-slate-100/70 p-4 sm:p-6 rounded-3xl border border-slate-200 shadow-inner">
      {/* 15-STEP JOURNEY GRID OVERVIEW */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-5">
        
        {/* STEP 1: LOGIN */}
        <div
          onClick={() => onSelectStep?.(1)}
          className="bg-white rounded-[32px] p-4 shadow-lg border border-slate-200 flex flex-col justify-between cursor-pointer hover:ring-2 hover:ring-emerald-500 transition-all text-xs relative group min-h-[580px]"
        >
          <div className="absolute -top-3 left-4 bg-emerald-600 text-white font-extrabold text-[10px] px-2.5 py-0.5 rounded-full shadow-sm">
            1 LOGIN
          </div>

          <div className="space-y-4 pt-2">
            {/* Header */}
            <div className="flex justify-center">
              <img src="/images/eduride_logo.png" alt="MyEduRide" className="h-7 w-auto object-contain" />
            </div>

            {/* Avatar Image */}
            <div className="w-28 h-28 mx-auto rounded-full overflow-hidden border-4 border-emerald-500 shadow-md bg-slate-800">
              <img
                src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80"
                alt="John Adebayo"
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            </div>

            {/* Text */}
            <div className="text-center">
              <h3 className="font-extrabold text-slate-900 text-sm">Welcome Back!</h3>
              <p className="text-[11px] text-slate-500">Sign in to continue</p>
            </div>

            {/* Form Inputs */}
            <div className="space-y-2.5">
              <input
                type="text"
                readOnly
                value="+234 803 123 4567"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-medium text-[11px]"
              />
              <input
                type="password"
                readOnly
                value="••••••••"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 text-[11px]"
              />
              <div className="flex items-center justify-between text-[10px] text-slate-500">
                <label className="flex items-center gap-1">
                  <input type="checkbox" checked readOnly className="rounded text-emerald-600" /> Remember me
                </label>
                <span className="text-emerald-600 font-semibold hover:underline">Forgot Password?</span>
              </div>
            </div>

            {/* Login Button */}
            <button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl shadow-md transition-all text-xs">
              LOGIN
            </button>
          </div>

          <div className="text-center text-[10px] text-slate-400 font-mono pt-2">v2.5.0</div>
        </div>

        {/* STEP 2: TODAY'S ASSIGNMENT */}
        <div
          onClick={() => onSelectStep?.(2)}
          className="bg-white rounded-[32px] p-4 shadow-lg border border-slate-200 flex flex-col justify-between cursor-pointer hover:ring-2 hover:ring-emerald-500 transition-all text-xs relative group min-h-[580px]"
        >
          <div className="absolute -top-3 left-4 bg-emerald-600 text-white font-extrabold text-[10px] px-2.5 py-0.5 rounded-full shadow-sm">
            2 TODAY'S ASSIGNMENT
          </div>

          <div className="space-y-4 pt-2">
            {/* Header Greeting */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div>
                <p className="text-[10px] text-slate-400 font-medium">Good Morning,</p>
                <h4 className="font-extrabold text-slate-900 text-xs flex items-center gap-1">
                  John Adebayo <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                </h4>
              </div>
              <div className="w-8 h-8 rounded-full bg-slate-800 border border-emerald-500 overflow-hidden">
                <img src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80" alt="Avatar" className="w-full h-full object-cover" />
              </div>
            </div>

            {/* Yellow Assignment Box */}
            <div className="bg-amber-50 border border-amber-200/80 rounded-2xl p-3.5 space-y-2">
              <div className="flex items-center gap-1.5 text-amber-800">
                <Sun size={15} className="text-amber-600 fill-amber-400" />
                <span className="font-extrabold text-xs uppercase tracking-wide">Morning Trip</span>
              </div>
              <div className="space-y-1 text-[11px] text-slate-700">
                <div className="flex justify-between"><span>Route</span> <strong className="text-slate-900">Route A</strong></div>
                <div className="flex justify-between"><span>Students</span> <strong className="text-slate-900">18 Students</strong></div>
                <div className="flex justify-between"><span>Vehicle</span> <strong className="text-slate-900">Toyota HiAce (ABC 123 XY)</strong></div>
                <div className="flex justify-between"><span>Departure Time</span> <strong className="text-slate-900">06:30 AM</strong></div>
                <div className="flex justify-between"><span>School</span> <strong className="text-slate-900">Greenfield Intl. School</strong></div>
              </div>
            </div>

            {/* Trip Summary Grid */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Trip Summary</span>
              <div className="grid grid-cols-3 gap-1.5 text-center">
                <div className="bg-slate-50 p-2 rounded-xl border border-slate-100">
                  <span className="font-extrabold text-slate-900 text-sm block">18</span>
                  <span className="text-[9px] text-slate-500 font-semibold block">To Pick Up</span>
                </div>
                <div className="bg-slate-50 p-2 rounded-xl border border-slate-100">
                  <span className="font-extrabold text-slate-900 text-sm block">0</span>
                  <span className="text-[9px] text-slate-500 font-semibold block">On Board</span>
                </div>
                <div className="bg-slate-50 p-2 rounded-xl border border-slate-100">
                  <span className="font-extrabold text-slate-900 text-sm block">0</span>
                  <span className="text-[9px] text-slate-500 font-semibold block">Dropped Off</span>
                </div>
              </div>
            </div>

            {/* Action Button */}
            <button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl shadow-md transition-all text-xs">
              START MORNING TRIP
            </button>
          </div>

          {/* Bottom Nav */}
          <div className="border-t border-slate-100 pt-2 flex justify-between items-center text-[10px] text-slate-400 font-semibold">
            <span className="text-emerald-600 font-bold">Home</span>
            <span>Trip</span>
            <span>Map</span>
            <span>Chat</span>
            <span>More</span>
          </div>
        </div>

        {/* STEP 3: START MORNING TRIP */}
        <div
          onClick={() => onSelectStep?.(3)}
          className="bg-[#0A1128] text-white rounded-[32px] p-4 shadow-lg border border-slate-800 flex flex-col justify-between cursor-pointer hover:ring-2 hover:ring-emerald-500 transition-all text-xs relative group min-h-[580px]"
        >
          <div className="absolute -top-3 left-4 bg-emerald-600 text-white font-extrabold text-[10px] px-2.5 py-0.5 rounded-full shadow-sm">
            3 START MORNING TRIP
          </div>

          <div className="space-y-4 pt-2">
            <div className="flex items-center gap-2 border-b border-white/10 pb-2 text-slate-300">
              <span>←</span>
              <span className="font-bold text-xs text-white">Morning Trip (Route A)</span>
            </div>

            <div className="text-center space-y-3 py-3">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 border-2 border-emerald-400 flex items-center justify-center mx-auto text-emerald-400 shadow-md">
                <CheckCircle2 size={36} />
              </div>
              <div>
                <h4 className="font-extrabold text-sm text-white">You are about to start Morning Trip</h4>
                <p className="text-[11px] text-slate-400 mt-0.5">Please confirm details below</p>
              </div>
            </div>

            <div className="bg-white/5 rounded-2xl p-3.5 border border-white/10 space-y-2 text-[11px]">
              <div className="flex justify-between"><span className="text-slate-400">Students</span> <strong className="text-white">18</strong></div>
              <div className="flex justify-between"><span className="text-slate-400">School</span> <strong className="text-white">Greenfield Intl. School</strong></div>
              <div className="flex justify-between"><span className="text-slate-400">Estimated Duration</span> <strong className="text-white">1h 30m</strong></div>
              <div className="flex justify-between"><span className="text-slate-400">Distance</span> <strong className="text-white">28.6 km</strong></div>
            </div>

            <button className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-2.5 rounded-xl shadow-md transition-all text-xs">
              START TRIP
            </button>
            <button className="w-full text-center text-slate-400 text-[11px] hover:text-white font-semibold block">
              CANCEL
            </button>
          </div>

          <div className="border-t border-white/10 pt-2 flex justify-between items-center text-[10px] text-slate-400">
            <span>Home</span><span>Trip</span><span>Map</span><span>Chat</span><span>More</span>
          </div>
        </div>

        {/* STEP 4: PICKUP LIST (MORNING) */}
        <div
          onClick={() => onSelectStep?.(4)}
          className="bg-white rounded-[32px] p-4 shadow-lg border border-slate-200 flex flex-col justify-between cursor-pointer hover:ring-2 hover:ring-emerald-500 transition-all text-xs relative group min-h-[580px]"
        >
          <div className="absolute -top-3 left-4 bg-emerald-600 text-white font-extrabold text-[10px] px-2.5 py-0.5 rounded-full shadow-sm">
            4 PICKUP LIST (MORNING)
          </div>

          <div className="space-y-3 pt-2">
            <div className="bg-[#0A1128] text-white p-3 rounded-2xl space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-xs">Morning Trip</span>
                <span className="bg-emerald-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-full">● Live</span>
              </div>
              <p className="text-[10px] text-slate-300">Pickup List</p>
              <div className="flex justify-between text-[10px] pt-1 text-slate-300 font-semibold border-t border-white/10">
                <span>Waiting: <strong className="text-white">16</strong></span>
                <span>On Board: <strong className="text-white">2</strong></span>
                <span>Picked Up: <strong className="text-white">0</strong></span>
              </div>
            </div>

            <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase">
              <span>Pickup Sequence</span>
              <span className="text-emerald-600">Optimized Route</span>
            </div>

            <div className="space-y-2">
              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                <div>
                  <div className="font-bold text-slate-900 text-xs">1. David James</div>
                  <div className="text-[10px] text-slate-500">Primary 2 • GRA Phase 2 Benin City</div>
                  <div className="text-[9px] text-emerald-600 font-semibold">ETA: 6:35 AM • 500m</div>
                </div>
                <Phone size={15} className="text-slate-400" />
              </div>

              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                <div>
                  <div className="font-bold text-slate-900 text-xs">2. Esther Paul</div>
                  <div className="text-[10px] text-slate-500">KG 2 • GRA Phase 3 Benin City</div>
                  <div className="text-[9px] text-emerald-600 font-semibold">ETA: 6:40 AM • 1.2 km</div>
                </div>
                <Phone size={15} className="text-slate-400" />
              </div>

              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                <div>
                  <div className="font-bold text-slate-900 text-xs">3. Michael Obi</div>
                  <div className="text-[10px] text-slate-500">Primary 3 • Airport Road Benin City</div>
                  <div className="text-[9px] text-emerald-600 font-semibold">ETA: 6:45 AM • 1.8 km</div>
                </div>
                <Phone size={15} className="text-slate-400" />
              </div>
            </div>
          </div>

          <div className="border-t border-slate-100 pt-2 flex justify-between items-center text-[10px] text-slate-400">
            <span>Home</span><span>Trip</span><span>Map</span><span>Chat</span><span>More</span>
          </div>
        </div>

        {/* STEP 5: NEXT PICKUP NAVIGATION */}
        <div
          onClick={() => onSelectStep?.(5)}
          className="bg-slate-900 text-white rounded-[32px] p-4 shadow-lg border border-slate-800 flex flex-col justify-between cursor-pointer hover:ring-2 hover:ring-emerald-500 transition-all text-xs relative group min-h-[580px]"
        >
          <div className="absolute -top-3 left-4 bg-emerald-600 text-white font-extrabold text-[10px] px-2.5 py-0.5 rounded-full shadow-sm">
            5 NEXT PICKUP NAVIGATION
          </div>

          <div className="space-y-3 pt-2">
            <div className="bg-emerald-600 p-2.5 rounded-2xl flex items-center gap-2">
              <Navigation size={18} />
              <div>
                <div className="font-extrabold text-xs">Next Pickup</div>
                <div className="text-[10px] text-emerald-100">David James • 500 m ahead</div>
              </div>
            </div>

            {/* Map Simulation Box */}
            <div className="bg-slate-800 rounded-2xl h-44 border border-slate-700 relative overflow-hidden flex flex-col justify-between p-3">
              <div className="flex justify-between items-center">
                <span className="bg-black/50 text-white text-[9px] font-bold px-2 py-0.5 rounded-full">32 km/h</span>
              </div>
              <div className="bg-black/70 p-2 rounded-xl text-[10px] space-y-0.5">
                <div className="flex justify-between font-bold text-emerald-400"><span>ETA 2 min</span> <span>Distance 500 m</span></div>
                <div className="text-slate-300">Turn left in 200 m - GRA Phase 2 Road</div>
              </div>
            </div>

            <button className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-2.5 rounded-xl shadow-md transition-all text-xs">
              VIEW ON BOARD (1)
            </button>
          </div>

          <div className="border-t border-slate-800 pt-2 flex justify-between items-center text-[10px] text-slate-400">
            <span>Home</span><span>Trip</span><span>Map</span><span>Chat</span><span>More</span>
          </div>
        </div>

        {/* STEP 6: PICKUP CONFIRMED */}
        <div
          onClick={() => onSelectStep?.(6)}
          className="bg-emerald-600 text-white rounded-[32px] p-4 shadow-lg border border-emerald-500 flex flex-col justify-between cursor-pointer hover:ring-2 hover:ring-white transition-all text-xs relative group min-h-[580px]"
        >
          <div className="absolute -top-3 left-4 bg-[#0A1128] text-white font-extrabold text-[10px] px-2.5 py-0.5 rounded-full shadow-sm">
            6 PICKUP CONFIRMED
          </div>

          <div className="space-y-4 pt-4 text-center">
            <div className="w-20 h-20 rounded-full bg-white/20 border-2 border-white flex items-center justify-center mx-auto text-white shadow-lg animate-bounce">
              <CheckCircle2 size={48} />
            </div>

            <div>
              <h3 className="font-extrabold text-base">Great Job!</h3>
              <p className="font-bold text-sm text-emerald-100 mt-0.5">David James</p>
              <p className="text-xs text-white/90">Picked Up Successfully</p>
            </div>

            <div className="bg-white/10 p-2.5 rounded-2xl border border-white/20 text-[11px]">
              <span className="font-bold block text-emerald-100">Student Status</span>
              <span className="font-extrabold text-white text-xs block mt-0.5">ON BOARD</span>
            </div>

            <div className="bg-white text-slate-900 p-3 rounded-2xl text-left space-y-1 text-[11px] shadow-md">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Next Pickup</span>
              <div className="font-extrabold text-slate-900 text-xs">Esther Paul</div>
              <div className="text-[10px] text-slate-500">1.2 km away • ETA: 4 min</div>
            </div>

            <button className="w-full bg-[#0A1128] hover:bg-[#121E42] text-white font-bold py-2.5 rounded-xl shadow-md transition-all text-xs">
              VIEW ON BOARD (1)
            </button>
          </div>

          <div className="border-t border-white/20 pt-2 flex justify-between items-center text-[10px] text-emerald-100">
            <span>Home</span><span>Trip</span><span>Map</span><span>Chat</span><span>More</span>
          </div>
        </div>

        {/* STEP 7: ON BOARD (DROP-OFF LIST) */}
        <div
          onClick={() => onSelectStep?.(7)}
          className="bg-white rounded-[32px] p-4 shadow-lg border border-slate-200 flex flex-col justify-between cursor-pointer hover:ring-2 hover:ring-emerald-500 transition-all text-xs relative group min-h-[580px]"
        >
          <div className="absolute -top-3 left-4 bg-emerald-600 text-white font-extrabold text-[10px] px-2.5 py-0.5 rounded-full shadow-sm">
            7 ON BOARD (DROP-OFF LIST)
          </div>

          <div className="space-y-3 pt-2">
            <div className="bg-[#0A1128] text-white p-3 rounded-2xl space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-xs">On Board (2 Students)</span>
                <span className="bg-emerald-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-full">● Live</span>
              </div>
              <p className="text-[10px] text-slate-300">Morning Trip</p>
            </div>

            <div className="space-y-2">
              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-slate-800 text-white flex items-center justify-center font-bold text-xs">DJ</div>
                  <div>
                    <div className="font-bold text-slate-900 text-xs">David James</div>
                    <div className="text-[10px] text-slate-500">Primary 2</div>
                  </div>
                </div>
                <span className="bg-emerald-100 text-emerald-800 text-[9px] font-bold px-2 py-0.5 rounded-full">ON BOARD</span>
              </div>

              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-slate-800 text-white flex items-center justify-center font-bold text-xs">EP</div>
                  <div>
                    <div className="font-bold text-slate-900 text-xs">Esther Paul</div>
                    <div className="text-[10px] text-slate-500">KG 2</div>
                  </div>
                </div>
                <span className="bg-emerald-100 text-emerald-800 text-[9px] font-bold px-2 py-0.5 rounded-full">ON BOARD</span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-1 text-center bg-slate-50 p-2 rounded-xl border border-slate-100 text-[10px]">
              <div><span className="font-bold text-slate-900 block">2</span><span className="text-slate-400">On Board</span></div>
              <div><span className="font-bold text-slate-900 block">16</span><span className="text-slate-400">Waiting</span></div>
              <div><span className="font-bold text-slate-900 block">0</span><span className="text-slate-400">Dropped Off</span></div>
            </div>

            <button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl shadow-md transition-all text-xs">
              VIEW DROP-OFF LIST
            </button>
          </div>

          <div className="border-t border-slate-100 pt-2 flex justify-between items-center text-[10px] text-slate-400">
            <span>Home</span><span>Trip</span><span>Map</span><span>Chat</span><span>More</span>
          </div>
        </div>

        {/* STEP 8: ARRIVED AT SCHOOL */}
        <div
          onClick={() => onSelectStep?.(8)}
          className="bg-white rounded-[32px] p-4 shadow-lg border border-slate-200 flex flex-col justify-between cursor-pointer hover:ring-2 hover:ring-emerald-500 transition-all text-xs relative group min-h-[580px]"
        >
          <div className="absolute -top-3 left-4 bg-emerald-600 text-white font-extrabold text-[10px] px-2.5 py-0.5 rounded-full shadow-sm">
            8 ARRIVED AT SCHOOL
          </div>

          <div className="space-y-3 pt-2">
            <div className="bg-emerald-700 text-white p-3 rounded-2xl flex items-center gap-2">
              <Navigation size={18} />
              <div>
                <div className="font-extrabold text-xs">Arrived at School</div>
                <div className="text-[10px] text-emerald-100">Greenfield Intl. School</div>
              </div>
            </div>

            {/* School Campus Photo */}
            <div className="rounded-2xl h-36 overflow-hidden border border-slate-200 relative bg-slate-800">
              <img
                src="https://images.unsplash.com/photo-1541829070764-84a7d30dd3f3?auto=format&fit=crop&w=500&q=80"
                alt="Greenfield International School"
                className="w-full h-full object-cover"
              />
            </div>

            <div className="text-center space-y-1">
              <h4 className="font-extrabold text-slate-900 text-xs">You have arrived!</h4>
              <p className="text-[10px] text-slate-500">Please begin drop-off</p>
              <div className="bg-slate-50 p-2 rounded-xl border border-slate-100 font-bold text-slate-900 text-xs">
                Students on board: 2
              </div>
            </div>

            <button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl shadow-md transition-all text-xs">
              VIEW DROP-OFF LIST
            </button>
          </div>

          <div className="border-t border-slate-100 pt-2 flex justify-between items-center text-[10px] text-slate-400">
            <span>Home</span><span>Trip</span><span>Map</span><span>Chat</span><span>More</span>
          </div>
        </div>

        {/* STEP 9: DROP-OFF STUDENT */}
        <div
          onClick={() => onSelectStep?.(9)}
          className="bg-white rounded-[32px] p-4 shadow-lg border border-slate-200 flex flex-col justify-between cursor-pointer hover:ring-2 hover:ring-emerald-500 transition-all text-xs relative group min-h-[580px]"
        >
          <div className="absolute -top-3 left-4 bg-emerald-600 text-white font-extrabold text-[10px] px-2.5 py-0.5 rounded-full shadow-sm">
            9 DROP-OFF STUDENT
          </div>

          <div className="space-y-3 pt-2">
            <div className="bg-[#0A1128] text-white p-3 rounded-2xl space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-xs">Drop-off List</span>
                <span className="bg-emerald-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-full">● Live</span>
              </div>
              <p className="text-[10px] text-slate-300">Morning Trip</p>
            </div>

            <div className="space-y-2">
              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                <div>
                  <div className="font-bold text-slate-900 text-xs">David James</div>
                  <div className="text-[10px] text-slate-500">Primary 2</div>
                </div>
                <button className="bg-emerald-600 text-white font-bold text-[9px] px-2.5 py-1 rounded-lg">READY TO DROP</button>
              </div>

              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                <div>
                  <div className="font-bold text-slate-900 text-xs">Esther Paul</div>
                  <div className="text-[10px] text-slate-500">KG 2</div>
                </div>
                <button className="bg-emerald-600 text-white font-bold text-[9px] px-2.5 py-1 rounded-lg">READY TO DROP</button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-center bg-slate-50 p-2 rounded-xl border border-slate-100 text-[10px]">
              <div><span className="font-bold text-slate-900 block">2</span><span className="text-slate-400">On Board</span></div>
              <div><span className="font-bold text-slate-900 block">0</span><span className="text-slate-400">Dropped Off</span></div>
            </div>
          </div>

          <div className="border-t border-slate-100 pt-2 flex justify-between items-center text-[10px] text-slate-400">
            <span>Home</span><span>Trip</span><span>Map</span><span>Chat</span><span>More</span>
          </div>
        </div>

        {/* STEP 10: DROP-OFF CONFIRMED */}
        <div
          onClick={() => onSelectStep?.(10)}
          className="bg-emerald-600 text-white rounded-[32px] p-4 shadow-lg border border-emerald-500 flex flex-col justify-between cursor-pointer hover:ring-2 hover:ring-white transition-all text-xs relative group min-h-[580px]"
        >
          <div className="absolute -top-3 left-4 bg-[#0A1128] text-white font-extrabold text-[10px] px-2.5 py-0.5 rounded-full shadow-sm">
            10 DROP-OFF CONFIRMED
          </div>

          <div className="space-y-4 pt-4 text-center">
            <div className="w-20 h-20 rounded-full bg-white/20 border-2 border-white flex items-center justify-center mx-auto text-white shadow-lg animate-bounce">
              <CheckCircle2 size={48} />
            </div>

            <div>
              <h3 className="font-extrabold text-base">Well Done!</h3>
              <p className="font-bold text-sm text-emerald-100 mt-0.5">David James</p>
              <p className="text-xs text-white/90">Dropped Off</p>
            </div>

            <div className="bg-white/10 p-2.5 rounded-2xl border border-white/20 text-[11px]">
              <span className="font-bold block text-emerald-100">Attendance Marked</span>
              <span className="font-extrabold text-white text-xs block mt-0.5">PRESENT</span>
            </div>

            <div className="bg-white text-slate-900 p-3 rounded-2xl text-left space-y-1 text-[11px] shadow-md">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Next Drop-off</span>
              <div className="font-extrabold text-slate-900 text-xs">Esther Paul</div>
              <div className="text-[10px] text-emerald-600 font-semibold">Ready</div>
            </div>

            <button className="w-full bg-[#0A1128] hover:bg-[#121E42] text-white font-bold py-2.5 rounded-xl shadow-md transition-all text-xs">
              DROP OFF NEXT
            </button>
          </div>

          <div className="border-t border-white/20 pt-2 flex justify-between items-center text-[10px] text-emerald-100">
            <span>Home</span><span>Trip</span><span>Map</span><span>Chat</span><span>More</span>
          </div>
        </div>

        {/* STEP 11: MORNING TRIP COMPLETED */}
        <div
          onClick={() => onSelectStep?.(11)}
          className="bg-[#0A1128] text-white rounded-[32px] p-4 shadow-lg border border-slate-800 flex flex-col justify-between cursor-pointer hover:ring-2 hover:ring-emerald-500 transition-all text-xs relative group min-h-[580px]"
        >
          <div className="absolute -top-3 left-4 bg-emerald-600 text-white font-extrabold text-[10px] px-2.5 py-0.5 rounded-full shadow-sm">
            11 MORNING TRIP COMPLETED
          </div>

          <div className="space-y-4 pt-2 text-center">
            <h3 className="font-extrabold text-base text-white">Morning Trip Completed! 🎉</h3>

            {/* Circular Progress Gauge */}
            <div className="w-28 h-28 rounded-full border-8 border-emerald-500 border-t-emerald-400 flex flex-col items-center justify-center mx-auto bg-white/5 shadow-inner">
              <span className="font-extrabold text-xl text-white">18/18</span>
              <span className="text-[9px] text-emerald-400 font-semibold">Students Delivered</span>
            </div>

            <div className="grid grid-cols-3 gap-1.5 text-center bg-white/5 p-2 rounded-2xl border border-white/10 text-[10px]">
              <div><span className="text-slate-400 block">On Time</span><strong className="text-emerald-400 block text-xs">100%</strong></div>
              <div><span className="text-slate-400 block">Duration</span><strong className="text-white block text-xs">1h 28m</strong></div>
              <div><span className="text-slate-400 block">Distance</span><strong className="text-white block text-xs">26.4 km</strong></div>
            </div>

            <button className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-2.5 rounded-xl shadow-md transition-all text-xs">
              VIEW SUMMARY
            </button>
            <p className="text-[10px] text-slate-400">Afternoon Trip starts at 01:50 PM</p>
          </div>

          <div className="border-t border-white/10 pt-2 flex justify-between items-center text-[10px] text-slate-400">
            <span>Home</span><span>Trip</span><span>Map</span><span>Chat</span><span>More</span>
          </div>
        </div>

        {/* STEP 12: AFTERNOON TRIP READY */}
        <div
          onClick={() => onSelectStep?.(12)}
          className="bg-white rounded-[32px] p-4 shadow-lg border border-slate-200 flex flex-col justify-between cursor-pointer hover:ring-2 hover:ring-emerald-500 transition-all text-xs relative group min-h-[580px]"
        >
          <div className="absolute -top-3 left-4 bg-emerald-600 text-white font-extrabold text-[10px] px-2.5 py-0.5 rounded-full shadow-sm">
            12 AFTERNOON TRIP READY
          </div>

          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div>
                <p className="text-[10px] text-slate-400 font-medium">Good Afternoon,</p>
                <h4 className="font-extrabold text-slate-900 text-xs">John Adebayo</h4>
              </div>
              <div className="w-8 h-8 rounded-full bg-slate-800 border border-emerald-500 overflow-hidden">
                <img src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80" alt="Avatar" className="w-full h-full object-cover" />
              </div>
            </div>

            {/* Orange Assignment Box */}
            <div className="bg-orange-50 border border-orange-200/80 rounded-2xl p-3.5 space-y-2">
              <div className="flex items-center gap-1.5 text-orange-800">
                <Sun size={15} className="text-orange-600 fill-orange-400" />
                <span className="font-extrabold text-xs uppercase tracking-wide">NEXT ASSIGNMENT</span>
              </div>
              <h4 className="font-extrabold text-slate-900 text-xs">Afternoon Trip</h4>
              <div className="space-y-1 text-[11px] text-slate-700">
                <div className="flex justify-between"><span>Route</span> <strong className="text-slate-900">Route A</strong></div>
                <div className="flex justify-between"><span>Students</span> <strong className="text-slate-900">18 Students</strong></div>
                <div className="flex justify-between"><span>Departure Time</span> <strong className="text-slate-900">02:00 PM</strong></div>
                <div className="flex justify-between"><span>From</span> <strong className="text-slate-900">Greenfield Intl. School</strong></div>
              </div>
            </div>

            <button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl shadow-md transition-all text-xs">
              START AFTERNOON TRIP
            </button>
          </div>

          <div className="border-t border-slate-100 pt-2 flex justify-between items-center text-[10px] text-slate-400">
            <span>Home</span><span>Trip</span><span>Map</span><span>Chat</span><span>More</span>
          </div>
        </div>

        {/* STEP 13: AFTERNOON PICKUP LIST */}
        <div
          onClick={() => onSelectStep?.(13)}
          className="bg-white rounded-[32px] p-4 shadow-lg border border-slate-200 flex flex-col justify-between cursor-pointer hover:ring-2 hover:ring-emerald-500 transition-all text-xs relative group min-h-[580px]"
        >
          <div className="absolute -top-3 left-4 bg-emerald-600 text-white font-extrabold text-[10px] px-2.5 py-0.5 rounded-full shadow-sm">
            13 AFTERNOON PICKUP LIST
          </div>

          <div className="space-y-3 pt-2">
            <div className="bg-[#0A1128] text-white p-3 rounded-2xl space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-xs">School Pickup List</span>
                <span className="bg-emerald-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-full">● Live</span>
              </div>
              <p className="text-[10px] text-slate-300">Afternoon Trip</p>
            </div>

            <div className="space-y-2">
              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                <div>
                  <div className="font-bold text-slate-900 text-xs">David James</div>
                  <div className="text-[10px] text-slate-500">Primary 2 • Waiting at School</div>
                </div>
                <button className="bg-emerald-600 text-white font-bold text-[9px] px-2.5 py-1 rounded-lg">PICK UP</button>
              </div>

              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                <div>
                  <div className="font-bold text-slate-900 text-xs">Esther Paul</div>
                  <div className="text-[10px] text-slate-500">KG 2 • Waiting at School</div>
                </div>
                <button className="bg-emerald-600 text-white font-bold text-[9px] px-2.5 py-1 rounded-lg">PICK UP</button>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-100 pt-2 flex justify-between items-center text-[10px] text-slate-400">
            <span>Home</span><span>Trip</span><span>Map</span><span>Chat</span><span>More</span>
          </div>
        </div>

        {/* STEP 14: HOME DROP-OFF LIST */}
        <div
          onClick={() => onSelectStep?.(14)}
          className="bg-white rounded-[32px] p-4 shadow-lg border border-slate-200 flex flex-col justify-between cursor-pointer hover:ring-2 hover:ring-emerald-500 transition-all text-xs relative group min-h-[580px]"
        >
          <div className="absolute -top-3 left-4 bg-emerald-600 text-white font-extrabold text-[10px] px-2.5 py-0.5 rounded-full shadow-sm">
            14 HOME DROP-OFF LIST
          </div>

          <div className="space-y-3 pt-2">
            <div className="bg-[#0A1128] text-white p-3 rounded-2xl space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-xs">Home Drop-off List</span>
                <span className="bg-emerald-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-full">● Live</span>
              </div>
              <p className="text-[10px] text-slate-300">Afternoon Trip</p>
            </div>

            <div className="space-y-2">
              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                <div>
                  <div className="font-bold text-slate-900 text-xs">David James</div>
                  <div className="text-[10px] text-slate-500">Usehsen Benin City</div>
                </div>
                <button className="bg-emerald-600 text-white font-bold text-[9px] px-2.5 py-1 rounded-lg">DROP OFF</button>
              </div>

              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                <div>
                  <div className="font-bold text-slate-900 text-xs">Esther Paul</div>
                  <div className="text-[10px] text-slate-500">GRA Phase 3 Benin City</div>
                </div>
                <button className="bg-emerald-600 text-white font-bold text-[9px] px-2.5 py-1 rounded-lg">DROP OFF</button>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-100 pt-2 flex justify-between items-center text-[10px] text-slate-400">
            <span>Home</span><span>Trip</span><span>Map</span><span>Chat</span><span>More</span>
          </div>
        </div>

        {/* STEP 15: AFTERNOON TRIP COMPLETED / DAY COMPLETED */}
        <div
          onClick={() => onSelectStep?.(15)}
          className="bg-[#0A1128] text-white rounded-[32px] p-4 shadow-lg border border-slate-800 flex flex-col justify-between cursor-pointer hover:ring-2 hover:ring-emerald-500 transition-all text-xs relative group min-h-[580px]"
        >
          <div className="absolute -top-3 left-4 bg-emerald-600 text-white font-extrabold text-[10px] px-2.5 py-0.5 rounded-full shadow-sm">
            15 AFTERNOON TRIP COMPLETED
          </div>

          <div className="space-y-4 pt-2 text-center">
            <h3 className="font-extrabold text-base text-white">Day Completed! 🎉</h3>
            <p className="text-xs text-slate-300">Great Job, John!</p>

            {/* Circular Progress Gauge */}
            <div className="w-28 h-28 rounded-full border-8 border-emerald-500 border-t-emerald-400 flex flex-col items-center justify-center mx-auto bg-white/5 shadow-inner">
              <span className="font-extrabold text-xl text-white">18/18</span>
              <span className="text-[9px] text-emerald-400 font-semibold">Safely Delivered</span>
            </div>

            <div className="grid grid-cols-3 gap-1.5 text-center bg-white/5 p-2 rounded-2xl border border-white/10 text-[10px]">
              <div><span className="text-slate-400 block">Total Trips</span><strong className="text-white block text-xs">2</strong></div>
              <div><span className="text-slate-400 block">Total Duration</span><strong className="text-white block text-xs">3h 28m</strong></div>
              <div><span className="text-slate-400 block">Total Distance</span><strong className="text-white block text-xs">52.7 km</strong></div>
            </div>

            <button className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-2.5 rounded-xl shadow-md transition-all text-xs">
              VIEW TRIP REPORT
            </button>
            <button className="w-full text-center text-red-400 text-[10px] font-bold block hover:underline">
              SIGN OUT (AUTO IN 02:45)
            </button>
          </div>

          <div className="border-t border-white/10 pt-2 flex justify-between items-center text-[10px] text-slate-400">
            <span>Home</span><span>Trip</span><span>Map</span><span>Chat</span><span>More</span>
          </div>
        </div>

      </div>
    </div>
  );
}
