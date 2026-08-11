// @ts-nocheck
'use client';

import React, { useState } from 'react';
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
  ChevronLeft,
  Share2,
  Play
} from 'lucide-react';
import { toast } from 'sonner';

interface EscortAppSimulatorProps {
  initialStep?: number;
}

export default function EscortAppSimulator({ initialStep = 2 }: EscortAppSimulatorProps) {
  const [step, setStep] = useState<number>(initialStep);

  // Active state data
  const [phone, setPhone] = useState('+234 803 123 4567');
  const [password, setPassword] = useState('••••••••');
  const [boardedCount, setBoardedCount] = useState(2);
  const [droppedCount, setDroppedCount] = useState(0);
  const [muted, setMuted] = useState(false);

  const nextStep = () => {
    setStep((prev) => (prev < 15 ? prev + 1 : 1));
  };

  const prevStep = () => {
    setStep((prev) => (prev > 1 ? prev - 1 : 15));
  };

  return (
    <div className="max-w-md mx-auto space-y-4">
      {/* SIMULATOR STEPPER HEADER */}
      <div className="bg-[#0A1128] text-white p-3 rounded-2xl flex items-center justify-between shadow-md text-xs">
        <button
          onClick={prevStep}
          className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold transition-all"
        >
          <ChevronLeft size={16} />
        </button>
        <div className="text-center font-bold">
          <span className="text-emerald-400">Step {step} / 15:</span>{' '}
          {step === 1 && 'Login Screen'}
          {step === 2 && "Today's Assignment"}
          {step === 3 && 'Start Morning Trip'}
          {step === 4 && 'Pickup List (Morning)'}
          {step === 5 && 'Next Pickup Navigation'}
          {step === 6 && 'Pickup Confirmed'}
          {step === 7 && 'On Board List'}
          {step === 8 && 'Arrived at School'}
          {step === 9 && 'Drop-off Student'}
          {step === 10 && 'Drop-off Confirmed'}
          {step === 11 && 'Morning Trip Completed'}
          {step === 12 && 'Afternoon Trip Ready'}
          {step === 13 && 'Afternoon Pickup List'}
          {step === 14 && 'Home Drop-off List'}
          {step === 15 && 'Day Completed'}
        </div>
        <button
          onClick={nextStep}
          className="p-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold transition-all"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {/* MOBILE APP CONTAINER (IPHONE FRAME STYLE) */}
      <div className="bg-[#0A1128] p-3 rounded-[40px] shadow-2xl border-4 border-slate-800 relative">
        <div className="bg-white rounded-[32px] overflow-hidden min-h-[640px] flex flex-col justify-between text-slate-800 text-xs relative">
          
          {/* SCREEN 1: LOGIN */}
          {step === 1 && (
            <div className="p-6 space-y-6 flex-1 flex flex-col justify-between">
              <div className="space-y-6 pt-4">
                <div className="flex justify-center">
                  <img src="/images/eduride_logo.png" alt="MyEduRide" className="h-9 w-auto object-contain" />
                </div>
                <div className="w-32 h-32 mx-auto rounded-full overflow-hidden border-4 border-emerald-500 shadow-lg bg-slate-800">
                  <img src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80" alt="Officer" className="w-full h-full object-cover" />
                </div>
                <div className="text-center">
                  <h3 className="font-extrabold text-slate-900 text-lg">Welcome Back!</h3>
                  <p className="text-xs text-slate-500">Sign in to continue</p>
                </div>
                <div className="space-y-3">
                  <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-medium" />
                  <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-medium" />
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <label className="flex items-center gap-1.5"><input type="checkbox" defaultChecked /> Remember me</label>
                    <span className="text-emerald-600 font-bold cursor-pointer">Forgot Password?</span>
                  </div>
                </div>
                <button onClick={() => setStep(2)} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 rounded-2xl shadow-lg transition-all text-sm">
                  LOGIN
                </button>
              </div>
              <div className="text-center text-xs text-slate-400 font-mono">v2.5.0</div>
            </div>
          )}

          {/* SCREEN 2: TODAY'S ASSIGNMENT */}
          {step === 2 && (
            <div className="p-5 space-y-5 flex-1 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <p className="text-xs text-slate-400 font-medium">Good Morning,</p>
                    <h4 className="font-extrabold text-slate-900 text-base flex items-center gap-1.5">
                      John Adebayo <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block animate-pulse" />
                    </h4>
                  </div>
                  <div className="w-10 h-10 rounded-full bg-slate-800 border-2 border-emerald-500 overflow-hidden shadow-sm">
                    <img src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80" alt="Avatar" className="w-full h-full object-cover" />
                  </div>
                </div>

                <div className="bg-amber-50 border border-amber-200/80 rounded-2xl p-4 space-y-2.5 shadow-sm">
                  <div className="flex items-center gap-2 text-amber-800">
                    <Sun size={18} className="text-amber-600 fill-amber-400" />
                    <span className="font-extrabold text-xs uppercase tracking-wider">Morning Trip</span>
                  </div>
                  <div className="space-y-1.5 text-xs text-slate-700 font-medium">
                    <div className="flex justify-between"><span>Route</span> <strong className="text-slate-900">Route A</strong></div>
                    <div className="flex justify-between"><span>Students</span> <strong className="text-slate-900">18 Students</strong></div>
                    <div className="flex justify-between"><span>Vehicle</span> <strong className="text-slate-900">Toyota HiAce (ABC 123 XY)</strong></div>
                    <div className="flex justify-between"><span>Departure Time</span> <strong className="text-slate-900">06:30 AM</strong></div>
                    <div className="flex justify-between"><span>School</span> <strong className="text-slate-900">Greenfield Intl. School</strong></div>
                  </div>
                </div>

                <div className="space-y-2">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Trip Summary</span>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200/80">
                      <span className="font-extrabold text-slate-900 text-lg block">18</span>
                      <span className="text-[10px] text-slate-500 font-semibold block">To Pick Up</span>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200/80">
                      <span className="font-extrabold text-slate-900 text-lg block">0</span>
                      <span className="text-[10px] text-slate-500 font-semibold block">On Board</span>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200/80">
                      <span className="font-extrabold text-slate-900 text-lg block">0</span>
                      <span className="text-[10px] text-slate-500 font-semibold block">Dropped Off</span>
                    </div>
                  </div>
                </div>

                <button onClick={() => setStep(3)} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 rounded-2xl shadow-lg transition-all text-xs">
                  START MORNING TRIP
                </button>
              </div>

              <div className="border-t border-slate-100 pt-3 flex justify-around items-center text-xs text-slate-400 font-semibold">
                <span className="text-emerald-600 font-bold">Home</span>
                <span>Trip</span>
                <span>Map</span>
                <span>Chat</span>
                <span>More</span>
              </div>
            </div>
          )}

          {/* SCREEN 3: START MORNING TRIP MODAL */}
          {step === 3 && (
            <div className="bg-[#0A1128] text-white p-6 flex-1 flex flex-col justify-between">
              <div className="space-y-6 pt-2">
                <div className="flex items-center gap-2 border-b border-white/10 pb-3 text-slate-300">
                  <span className="cursor-pointer" onClick={() => setStep(2)}>←</span>
                  <span className="font-bold text-sm text-white">Morning Trip (Route A)</span>
                </div>

                <div className="text-center space-y-4 py-4">
                  <div className="w-20 h-20 rounded-full bg-emerald-500/20 border-2 border-emerald-400 flex items-center justify-center mx-auto text-emerald-400 shadow-xl">
                    <CheckCircle2 size={44} />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-base text-white">You are about to start Morning Trip</h4>
                    <p className="text-xs text-slate-400 mt-1">Please confirm details below</p>
                  </div>
                </div>

                <div className="bg-white/5 rounded-2xl p-4 border border-white/10 space-y-2.5 text-xs font-medium">
                  <div className="flex justify-between"><span className="text-slate-400">Students</span> <strong className="text-white">18</strong></div>
                  <div className="flex justify-between"><span className="text-slate-400">School</span> <strong className="text-white">Greenfield Intl. School</strong></div>
                  <div className="flex justify-between"><span className="text-slate-400">Estimated Duration</span> <strong className="text-white">1h 30m</strong></div>
                  <div className="flex justify-between"><span className="text-slate-400">Distance</span> <strong className="text-white">28.6 km</strong></div>
                </div>

                <button onClick={() => setStep(4)} className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3.5 rounded-2xl shadow-lg transition-all text-xs">
                  START TRIP
                </button>
                <button onClick={() => setStep(2)} className="w-full text-center text-slate-400 text-xs hover:text-white font-semibold block">
                  CANCEL
                </button>
              </div>

              <div className="border-t border-white/10 pt-3 flex justify-around items-center text-xs text-slate-400">
                <span>Home</span><span>Trip</span><span>Map</span><span>Chat</span><span>More</span>
              </div>
            </div>
          )}

          {/* SCREEN 4: PICKUP LIST (MORNING) */}
          {step === 4 && (
            <div className="p-5 space-y-4 flex-1 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="bg-[#0A1128] text-white p-4 rounded-2xl space-y-2 shadow-md">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-sm">Morning Trip</span>
                    <span className="bg-emerald-500 text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full">● Live</span>
                  </div>
                  <p className="text-xs text-slate-300">Pickup List</p>
                  <div className="flex justify-between text-xs pt-1 text-slate-300 font-semibold border-t border-white/10">
                    <span>Waiting: <strong className="text-white">16</strong></span>
                    <span>On Board: <strong className="text-white">2</strong></span>
                    <span>Picked Up: <strong className="text-white">0</strong></span>
                  </div>
                </div>

                <div className="flex justify-between items-center text-xs font-bold text-slate-400 uppercase">
                  <span>Pickup Sequence</span>
                  <span className="text-emerald-600">Optimized Route</span>
                </div>

                <div className="space-y-2.5">
                  <div onClick={() => setStep(5)} className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between cursor-pointer hover:bg-slate-100 transition-all">
                    <div>
                      <div className="font-bold text-slate-900 text-xs">1. David James</div>
                      <div className="text-[11px] text-slate-500">Primary 2 • GRA Phase 2 Benin City</div>
                      <div className="text-[10px] text-emerald-600 font-semibold mt-0.5">ETA: 6:35 AM • 500m</div>
                    </div>
                    <Phone size={18} className="text-slate-400" />
                  </div>

                  <div onClick={() => setStep(5)} className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between cursor-pointer hover:bg-slate-100 transition-all">
                    <div>
                      <div className="font-bold text-slate-900 text-xs">2. Esther Paul</div>
                      <div className="text-[11px] text-slate-500">KG 2 • GRA Phase 3 Benin City</div>
                      <div className="text-[10px] text-emerald-600 font-semibold mt-0.5">ETA: 6:40 AM • 1.2 km</div>
                    </div>
                    <Phone size={18} className="text-slate-400" />
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-3 flex justify-around items-center text-xs text-slate-400">
                <span>Home</span><span>Trip</span><span>Map</span><span>Chat</span><span>More</span>
              </div>
            </div>
          )}

          {/* SCREEN 5: NEXT PICKUP NAVIGATION */}
          {step === 5 && (
            <div className="bg-slate-900 text-white p-5 flex-1 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="bg-emerald-600 p-3 rounded-2xl flex items-center gap-3">
                  <Navigation size={22} />
                  <div>
                    <div className="font-extrabold text-sm">Next Pickup</div>
                    <div className="text-xs text-emerald-100">David James • 500 m ahead</div>
                  </div>
                </div>

                <div className="bg-slate-800 rounded-2xl h-52 border border-slate-700 relative overflow-hidden flex flex-col justify-between p-4 shadow-inner">
                  <div className="flex justify-between items-center">
                    <span className="bg-black/60 text-white text-xs font-bold px-2.5 py-1 rounded-full">32 km/h</span>
                  </div>
                  <div className="bg-black/80 backdrop-blur-md p-3 rounded-xl text-xs space-y-1">
                    <div className="flex justify-between font-bold text-emerald-400"><span>ETA 2 min</span> <span>Distance 500 m</span></div>
                    <div className="text-slate-200 font-medium">Turn left in 200 m - GRA Phase 2 Road</div>
                  </div>
                </div>

                <button onClick={() => setStep(6)} className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3.5 rounded-2xl shadow-lg transition-all text-xs">
                  VIEW ON BOARD (1)
                </button>
              </div>

              <div className="border-t border-slate-800 pt-3 flex justify-around items-center text-xs text-slate-400">
                <span>Home</span><span>Trip</span><span>Map</span><span>Chat</span><span>More</span>
              </div>
            </div>
          )}

          {/* SCREEN 6: PICKUP CONFIRMED */}
          {step === 6 && (
            <div className="bg-emerald-600 text-white p-6 flex-1 flex flex-col justify-between text-center">
              <div className="space-y-5 pt-6">
                <div className="w-24 h-24 rounded-full bg-white/20 border-4 border-white flex items-center justify-center mx-auto text-white shadow-2xl animate-bounce">
                  <CheckCircle2 size={56} />
                </div>
                <div>
                  <h3 className="font-extrabold text-xl">Great Job!</h3>
                  <p className="font-bold text-base text-emerald-100 mt-1">David James</p>
                  <p className="text-xs text-white/90">Picked Up Successfully</p>
                </div>
                <div className="bg-white/10 p-3 rounded-2xl border border-white/20 text-xs">
                  <span className="font-bold block text-emerald-100">Student Status</span>
                  <span className="font-extrabold text-white text-sm block mt-0.5">ON BOARD</span>
                </div>
                <button onClick={() => setStep(7)} className="w-full bg-[#0A1128] hover:bg-[#121E42] text-white font-bold py-3.5 rounded-2xl shadow-lg transition-all text-xs">
                  VIEW ON BOARD (2)
                </button>
              </div>

              <div className="border-t border-white/20 pt-3 flex justify-around items-center text-xs text-emerald-100">
                <span>Home</span><span>Trip</span><span>Map</span><span>Chat</span><span>More</span>
              </div>
            </div>
          )}

          {/* SCREEN 7: ON BOARD */}
          {step === 7 && (
            <div className="p-5 space-y-4 flex-1 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="bg-[#0A1128] text-white p-4 rounded-2xl space-y-1 shadow-md">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-sm">On Board (2 Students)</span>
                    <span className="bg-emerald-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">● Live</span>
                  </div>
                  <p className="text-xs text-slate-300">Morning Trip</p>
                </div>

                <div className="space-y-2">
                  <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between">
                    <div className="font-bold text-slate-900 text-xs">David James (Primary 2)</div>
                    <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2.5 py-0.5 rounded-full">ON BOARD</span>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between">
                    <div className="font-bold text-slate-900 text-xs">Esther Paul (KG 2)</div>
                    <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2.5 py-0.5 rounded-full">ON BOARD</span>
                  </div>
                </div>

                <button onClick={() => setStep(8)} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 rounded-2xl shadow-lg transition-all text-xs">
                  ARRIVE AT SCHOOL
                </button>
              </div>

              <div className="border-t border-slate-100 pt-3 flex justify-around items-center text-xs text-slate-400">
                <span>Home</span><span>Trip</span><span>Map</span><span>Chat</span><span>More</span>
              </div>
            </div>
          )}

          {/* SCREEN 8: ARRIVED AT SCHOOL */}
          {step === 8 && (
            <div className="p-5 space-y-4 flex-1 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="bg-emerald-700 text-white p-3.5 rounded-2xl flex items-center gap-3">
                  <Navigation size={22} />
                  <div>
                    <div className="font-extrabold text-sm">Arrived at School</div>
                    <div className="text-xs text-emerald-100">Greenfield Intl. School</div>
                  </div>
                </div>

                <div className="rounded-2xl h-44 overflow-hidden border border-slate-200 shadow-md">
                  <img src="https://images.unsplash.com/photo-1541829070764-84a7d30dd3f3?auto=format&fit=crop&w=500&q=80" alt="School" className="w-full h-full object-cover" />
                </div>

                <div className="text-center space-y-1">
                  <h4 className="font-extrabold text-slate-900 text-sm">You have arrived!</h4>
                  <p className="text-xs text-slate-500">Please begin drop-off</p>
                </div>

                <button onClick={() => setStep(9)} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 rounded-2xl shadow-lg transition-all text-xs">
                  VIEW DROP-OFF LIST
                </button>
              </div>

              <div className="border-t border-slate-100 pt-3 flex justify-around items-center text-xs text-slate-400">
                <span>Home</span><span>Trip</span><span>Map</span><span>Chat</span><span>More</span>
              </div>
            </div>
          )}

          {/* SCREEN 9: DROP-OFF STUDENT */}
          {step === 9 && (
            <div className="p-5 space-y-4 flex-1 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="bg-[#0A1128] text-white p-4 rounded-2xl space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-sm">Drop-off List</span>
                    <span className="bg-emerald-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">● Live</span>
                  </div>
                  <p className="text-xs text-slate-300">Morning Trip</p>
                </div>

                <div className="space-y-2">
                  <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between">
                    <div className="font-bold text-slate-900 text-xs">David James</div>
                    <button onClick={() => setStep(10)} className="bg-emerald-600 text-white font-bold text-xs px-3 py-1.5 rounded-xl">READY TO DROP</button>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between">
                    <div className="font-bold text-slate-900 text-xs">Esther Paul</div>
                    <button onClick={() => setStep(10)} className="bg-emerald-600 text-white font-bold text-xs px-3 py-1.5 rounded-xl">READY TO DROP</button>
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-3 flex justify-around items-center text-xs text-slate-400">
                <span>Home</span><span>Trip</span><span>Map</span><span>Chat</span><span>More</span>
              </div>
            </div>
          )}

          {/* SCREEN 10: DROP-OFF CONFIRMED */}
          {step === 10 && (
            <div className="bg-emerald-600 text-white p-6 flex-1 flex flex-col justify-between text-center">
              <div className="space-y-5 pt-6">
                <div className="w-24 h-24 rounded-full bg-white/20 border-4 border-white flex items-center justify-center mx-auto text-white shadow-2xl animate-bounce">
                  <CheckCircle2 size={56} />
                </div>
                <div>
                  <h3 className="font-extrabold text-xl">Well Done!</h3>
                  <p className="font-bold text-base text-emerald-100 mt-1">David James</p>
                  <p className="text-xs text-white/90">Dropped Off</p>
                </div>
                <div className="bg-white/10 p-3 rounded-2xl border border-white/20 text-xs">
                  <span className="font-bold block text-emerald-100">Attendance Marked</span>
                  <span className="font-extrabold text-white text-sm block mt-0.5">PRESENT</span>
                </div>
                <button onClick={() => setStep(11)} className="w-full bg-[#0A1128] hover:bg-[#121E42] text-white font-bold py-3.5 rounded-2xl shadow-lg transition-all text-xs">
                  COMPLETE MORNING TRIP
                </button>
              </div>

              <div className="border-t border-white/20 pt-3 flex justify-around items-center text-xs text-emerald-100">
                <span>Home</span><span>Trip</span><span>Map</span><span>Chat</span><span>More</span>
              </div>
            </div>
          )}

          {/* SCREEN 11: MORNING TRIP COMPLETED */}
          {step === 11 && (
            <div className="bg-[#0A1128] text-white p-6 flex-1 flex flex-col justify-between text-center">
              <div className="space-y-5 pt-4">
                <h3 className="font-extrabold text-lg text-white">Morning Trip Completed! 🎉</h3>
                <div className="w-32 h-32 rounded-full border-8 border-emerald-500 border-t-emerald-400 flex flex-col items-center justify-center mx-auto bg-white/5 shadow-2xl">
                  <span className="font-extrabold text-2xl text-white">18/18</span>
                  <span className="text-[10px] text-emerald-400 font-semibold">Students Delivered</span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center bg-white/5 p-3 rounded-2xl border border-white/10 text-xs">
                  <div><span className="text-slate-400 block text-[10px]">On Time</span><strong className="text-emerald-400 block text-sm">100%</strong></div>
                  <div><span className="text-slate-400 block text-[10px]">Duration</span><strong className="text-white block text-sm">1h 28m</strong></div>
                  <div><span className="text-slate-400 block text-[10px]">Distance</span><strong className="text-white block text-sm">26.4 km</strong></div>
                </div>

                <button onClick={() => setStep(12)} className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3.5 rounded-2xl shadow-lg transition-all text-xs">
                  CONTINUE TO AFTERNOON TRIP
                </button>
              </div>

              <div className="border-t border-white/10 pt-3 flex justify-around items-center text-xs text-slate-400">
                <span>Home</span><span>Trip</span><span>Map</span><span>Chat</span><span>More</span>
              </div>
            </div>
          )}

          {/* SCREEN 12: AFTERNOON TRIP READY */}
          {step === 12 && (
            <div className="p-5 space-y-4 flex-1 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <p className="text-xs text-slate-400 font-medium">Good Afternoon,</p>
                    <h4 className="font-extrabold text-slate-900 text-base">John Adebayo</h4>
                  </div>
                </div>

                <div className="bg-orange-50 border border-orange-200/80 rounded-2xl p-4 space-y-2.5 shadow-sm">
                  <div className="flex items-center gap-2 text-orange-800">
                    <Sun size={18} className="text-orange-600 fill-orange-400" />
                    <span className="font-extrabold text-xs uppercase tracking-wider">NEXT ASSIGNMENT</span>
                  </div>
                  <h4 className="font-extrabold text-slate-900 text-sm">Afternoon Trip</h4>
                  <div className="space-y-1.5 text-xs text-slate-700 font-medium">
                    <div className="flex justify-between"><span>Route</span> <strong className="text-slate-900">Route A</strong></div>
                    <div className="flex justify-between"><span>Students</span> <strong className="text-slate-900">18 Students</strong></div>
                    <div className="flex justify-between"><span>Departure Time</span> <strong className="text-slate-900">02:00 PM</strong></div>
                    <div className="flex justify-between"><span>From</span> <strong className="text-slate-900">Greenfield Intl. School</strong></div>
                  </div>
                </div>

                <button onClick={() => setStep(13)} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 rounded-2xl shadow-lg transition-all text-xs">
                  START AFTERNOON TRIP
                </button>
              </div>

              <div className="border-t border-slate-100 pt-3 flex justify-around items-center text-xs text-slate-400">
                <span>Home</span><span>Trip</span><span>Map</span><span>Chat</span><span>More</span>
              </div>
            </div>
          )}

          {/* SCREEN 13: AFTERNOON PICKUP LIST */}
          {step === 13 && (
            <div className="p-5 space-y-4 flex-1 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="bg-[#0A1128] text-white p-4 rounded-2xl space-y-1">
                  <span className="font-extrabold text-sm">School Pickup List</span>
                  <p className="text-xs text-slate-300">Afternoon Trip</p>
                </div>

                <div className="space-y-2">
                  <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between">
                    <div className="font-bold text-slate-900 text-xs">David James (Primary 2)</div>
                    <button onClick={() => setStep(14)} className="bg-emerald-600 text-white font-bold text-xs px-3 py-1.5 rounded-xl">PICK UP</button>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between">
                    <div className="font-bold text-slate-900 text-xs">Esther Paul (KG 2)</div>
                    <button onClick={() => setStep(14)} className="bg-emerald-600 text-white font-bold text-xs px-3 py-1.5 rounded-xl">PICK UP</button>
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-3 flex justify-around items-center text-xs text-slate-400">
                <span>Home</span><span>Trip</span><span>Map</span><span>Chat</span><span>More</span>
              </div>
            </div>
          )}

          {/* SCREEN 14: HOME DROP-OFF LIST */}
          {step === 14 && (
            <div className="p-5 space-y-4 flex-1 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="bg-[#0A1128] text-white p-4 rounded-2xl space-y-1">
                  <span className="font-extrabold text-sm">Home Drop-off List</span>
                  <p className="text-xs text-slate-300">Afternoon Trip</p>
                </div>

                <div className="space-y-2">
                  <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between">
                    <div className="font-bold text-slate-900 text-xs">David James (Usehsen)</div>
                    <button onClick={() => setStep(15)} className="bg-emerald-600 text-white font-bold text-xs px-3 py-1.5 rounded-xl">DROP OFF</button>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between">
                    <div className="font-bold text-slate-900 text-xs">Esther Paul (GRA Phase 3)</div>
                    <button onClick={() => setStep(15)} className="bg-emerald-600 text-white font-bold text-xs px-3 py-1.5 rounded-xl">DROP OFF</button>
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-3 flex justify-around items-center text-xs text-slate-400">
                <span>Home</span><span>Trip</span><span>Map</span><span>Chat</span><span>More</span>
              </div>
            </div>
          )}

          {/* SCREEN 15: DAY COMPLETED */}
          {step === 15 && (
            <div className="bg-[#0A1128] text-white p-6 flex-1 flex flex-col justify-between text-center">
              <div className="space-y-5 pt-4">
                <h3 className="font-extrabold text-xl text-white">Day Completed! 🎉</h3>
                <p className="text-xs text-slate-300">Great Job, John!</p>

                <div className="w-32 h-32 rounded-full border-8 border-emerald-500 border-t-emerald-400 flex flex-col items-center justify-center mx-auto bg-white/5 shadow-2xl">
                  <span className="font-extrabold text-2xl text-white">18/18</span>
                  <span className="text-[10px] text-emerald-400 font-semibold">Safely Delivered</span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center bg-white/5 p-3 rounded-2xl border border-white/10 text-xs">
                  <div><span className="text-slate-400 block text-[10px]">Total Trips</span><strong className="text-white block text-sm">2</strong></div>
                  <div><span className="text-slate-400 block text-[10px]">Total Duration</span><strong className="text-white block text-sm">3h 28m</strong></div>
                  <div><span className="text-slate-400 block text-[10px]">Total Distance</span><strong className="text-white block text-sm">52.7 km</strong></div>
                </div>

                <button onClick={() => setStep(2)} className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3.5 rounded-2xl shadow-lg transition-all text-xs">
                  RESTART JOURNEY SIMULATION
                </button>
              </div>

              <div className="border-t border-white/10 pt-3 flex justify-around items-center text-xs text-slate-400">
                <span>Home</span><span>Trip</span><span>Map</span><span>Chat</span><span>More</span>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
