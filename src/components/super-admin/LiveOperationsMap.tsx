'use client';

import { useState } from 'react';
import { MapPin, Navigation, Shield, AlertTriangle, ZoomIn, ZoomOut, Layers, Filter, Maximize2, X } from 'lucide-react';

export default function LiveOperationsMap() {
  const [showFullMapModal, setShowFullMapModal] = useState(false);
  const [activeFilter, setActiveFilter] = useState('all');

  const mapContent = (
    <div className="relative w-full h-full min-h-[320px] bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 shadow-inner group">
      {/* Map Graphic background pattern / dark map representation */}
      <div className="absolute inset-0 bg-[#0d1626] opacity-95">
        {/* Grid lines for map coordinate look */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b15_1px,transparent_1px),linear-gradient(to_bottom,#1e293b15_1px,transparent_1px)] bg-[size:24px_24px]" />
        
        {/* Lagos Lagoon & coastline SVG representation */}
        <svg className="absolute inset-0 w-full h-full text-slate-800/40 opacity-40" viewBox="0 0 800 450" fill="none">
          <path
            d="M 50 120 Q 200 80, 350 150 T 650 180 T 780 250 L 800 450 L 0 450 L 0 180 Z"
            fill="#0284c7"
            fillOpacity="0.25"
          />
          <path
            d="M 220 200 C 280 220, 320 280, 420 260 C 500 240, 580 300, 620 340"
            stroke="#0369a1"
            strokeWidth="16"
            strokeLinecap="round"
            strokeOpacity="0.3"
          />
        </svg>

        {/* Roads & Highways overlay lines */}
        <svg className="absolute inset-0 w-full h-full stroke-slate-700/60 stroke-1" viewBox="0 0 800 450" fill="none">
          <path d="M 0 150 L 800 150 M 300 0 L 300 450 M 500 0 L 500 450 M 150 0 L 650 450" />
        </svg>
      </div>

      {/* Map Control Buttons Top Left */}
      <div className="absolute top-4 left-4 flex flex-col gap-1.5 z-10">
        <button
          type="button"
          className="w-8 h-8 rounded-xl bg-slate-900/90 border border-slate-700/80 text-white flex items-center justify-center hover:bg-slate-800 transition-colors shadow-md"
          title="Zoom In"
        >
          <ZoomIn size={15} />
        </button>
        <button
          type="button"
          className="w-8 h-8 rounded-xl bg-slate-900/90 border border-slate-700/80 text-white flex items-center justify-center hover:bg-slate-800 transition-colors shadow-md"
          title="Zoom Out"
        >
          <ZoomOut size={15} />
        </button>
        <button
          type="button"
          className="w-8 h-8 rounded-xl bg-slate-900/90 border border-slate-700/80 text-white flex items-center justify-center hover:bg-slate-800 transition-colors shadow-md"
          title="Toggle Layers"
        >
          <Layers size={15} />
        </button>
        <button
          type="button"
          className="w-8 h-8 rounded-xl bg-slate-900/90 border border-slate-700/80 text-white flex items-center justify-center hover:bg-slate-800 transition-colors shadow-md"
          title="Filter Pins"
        >
          <Filter size={15} />
        </button>
      </div>

      {/* Lagos City Landmark Labels */}
      <div className="absolute top-[28%] left-[22%] text-[11px] font-bold text-slate-400/80 tracking-wider uppercase pointer-events-none">
        Ikeja
      </div>
      <div className="absolute top-[22%] left-[45%] text-[11px] font-bold text-slate-400/80 tracking-wider uppercase pointer-events-none">
        Ojota
      </div>
      <div className="absolute top-[48%] left-[34%] text-[11px] font-bold text-slate-400/80 tracking-wider uppercase pointer-events-none">
        Yaba
      </div>
      <div className="absolute top-[68%] left-[22%] text-[11px] font-bold text-slate-400/80 tracking-wider uppercase pointer-events-none">
        Victoria Island
      </div>
      <div className="absolute top-[52%] left-[48%] text-[11px] font-bold text-slate-300/90 tracking-wider uppercase pointer-events-none drop-shadow">
        Lagos Lagoon
      </div>
      <div className="absolute top-[68%] left-[62%] text-[11px] font-bold text-slate-400/80 tracking-wider uppercase pointer-events-none">
        Ajah
      </div>
      <div className="absolute top-[18%] left-[68%] text-[11px] font-bold text-slate-400/80 tracking-wider uppercase pointer-events-none">
        Ikorodu
      </div>

      {/* Animated Live Pins */}
      {/* 1. Active Escort Pins (Green) */}
      {(activeFilter === 'all' || activeFilter === 'escorts') && (
        <>
          <div className="absolute top-[32%] left-[18%] group/pin cursor-pointer">
            <div className="w-6 h-6 rounded-full bg-emerald-500/30 flex items-center justify-center animate-ping absolute inset-0" />
            <div className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-lg border-2 border-white text-[10px] font-bold">
              <Navigation size={12} />
            </div>
          </div>
          <div className="absolute top-[30%] left-[58%] group/pin cursor-pointer">
            <div className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-lg border-2 border-white text-[10px] font-bold">
              <Navigation size={12} />
            </div>
          </div>
          <div className="absolute top-[62%] left-[44%] group/pin cursor-pointer">
            <div className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-lg border-2 border-white text-[10px] font-bold">
              <Navigation size={12} />
            </div>
          </div>
        </>
      )}

      {/* 2. School Pins (Blue) */}
      {(activeFilter === 'all' || activeFilter === 'schools') && (
        <>
          <div className="absolute top-[36%] left-[28%] group/pin cursor-pointer">
            <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-lg border-2 border-white text-[10px] font-bold">
              D
            </div>
          </div>
          <div className="absolute top-[42%] left-[52%] group/pin cursor-pointer">
            <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-lg border-2 border-white text-[10px] font-bold">
              D
            </div>
          </div>
          <div className="absolute top-[72%] left-[58%] group/pin cursor-pointer">
            <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-lg border-2 border-white text-[10px] font-bold">
              D
            </div>
          </div>
        </>
      )}

      {/* 3. Active Trips Cluster Pins (Yellow) */}
      {(activeFilter === 'all' || activeFilter === 'trips') && (
        <>
          <div className="absolute top-[28%] left-[32%] group/pin cursor-pointer">
            <div className="w-7 h-7 rounded-full bg-amber-500 text-slate-950 font-bold flex items-center justify-center shadow-lg border-2 border-white text-xs">
              12
            </div>
          </div>
          <div className="absolute top-[38%] left-[42%] group/pin cursor-pointer">
            <div className="w-7 h-7 rounded-full bg-amber-500 text-slate-950 font-bold flex items-center justify-center shadow-lg border-2 border-white text-xs">
              3
            </div>
          </div>
          <div className="absolute top-[58%] left-[38%] group/pin cursor-pointer">
            <div className="w-7 h-7 rounded-full bg-amber-500 text-slate-950 font-bold flex items-center justify-center shadow-lg border-2 border-white text-xs">
              15
            </div>
          </div>
        </>
      )}

      {/* 4. SOS Alert Pin (Red Pulsing) */}
      {(activeFilter === 'all' || activeFilter === 'sos') && (
        <div className="absolute top-[36%] left-[62%] group/pin cursor-pointer">
          <div className="w-8 h-8 rounded-full bg-red-500/40 flex items-center justify-center animate-ping absolute -inset-1" />
          <div className="w-6 h-6 rounded-full bg-red-600 text-white flex items-center justify-center shadow-lg border-2 border-white font-bold text-[10px]">
            SOS
          </div>
        </div>
      )}

      {/* Legend Footer inside Map Box */}
      <div className="absolute bottom-3 left-3 right-3 flex flex-wrap items-center justify-between gap-2 z-10 bg-slate-900/90 backdrop-blur-md border border-slate-700/80 px-3.5 py-2 rounded-xl text-xs">
        <div className="flex flex-wrap items-center gap-3.5">
          <button
            onClick={() => setActiveFilter(activeFilter === 'escorts' ? 'all' : 'escorts')}
            className={`flex items-center gap-1.5 transition-opacity ${activeFilter !== 'all' && activeFilter !== 'escorts' ? 'opacity-40' : ''}`}
          >
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span className="text-slate-300 text-[11px] font-medium">Escorts</span>
          </button>
          <button
            onClick={() => setActiveFilter(activeFilter === 'schools' ? 'all' : 'schools')}
            className={`flex items-center gap-1.5 transition-opacity ${activeFilter !== 'all' && activeFilter !== 'schools' ? 'opacity-40' : ''}`}
          >
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
            <span className="text-slate-300 text-[11px] font-medium">Schools</span>
          </button>
          <button
            onClick={() => setActiveFilter(activeFilter === 'trips' ? 'all' : 'trips')}
            className={`flex items-center gap-1.5 transition-opacity ${activeFilter !== 'all' && activeFilter !== 'trips' ? 'opacity-40' : ''}`}
          >
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
            <span className="text-slate-300 text-[11px] font-medium">Active Trips</span>
          </button>
          <button
            onClick={() => setActiveFilter(activeFilter === 'sos' ? 'all' : 'sos')}
            className={`flex items-center gap-1.5 transition-opacity ${activeFilter !== 'all' && activeFilter !== 'sos' ? 'opacity-40' : ''}`}
          >
            <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
            <span className="text-slate-300 text-[11px] font-medium">SOS Alerts</span>
          </button>
        </div>

        <button
          type="button"
          onClick={() => setShowFullMapModal(true)}
          className="bg-slate-800 hover:bg-slate-700 text-white font-medium text-[11px] px-3 py-1.5 rounded-lg border border-slate-700 flex items-center gap-1.5 transition-all"
        >
          <Maximize2 size={12} />
          View Full Map
        </button>
      </div>
    </div>
  );

  return (
    <>
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex flex-col h-full">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h2 className="font-extrabold text-sm uppercase tracking-wider text-slate-900">
              LIVE OPERATIONS MAP
            </h2>
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live
            </span>
          </div>
        </div>

        <div className="flex-1 min-h-[340px]">
          {mapContent}
        </div>
      </div>

      {/* Full Map Modal */}
      {showFullMapModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-slate-950 w-full max-w-6xl h-[85vh] rounded-2xl border border-slate-800 p-4 flex flex-col relative">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <h2 className="text-white font-bold text-base">DISC Live Operations Command Map</h2>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold border border-emerald-500/30">
                  Full View
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowFullMapModal(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg bg-slate-900 border border-slate-800"
              >
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 mt-3">
              {mapContent}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
