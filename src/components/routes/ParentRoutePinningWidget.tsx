// @ts-nocheck
'use client';

import { useState, useEffect } from 'react';
import { Bookmark, MapPin, Bus, Clock, Check, Phone, ShieldCheck, Compass, Home } from 'lucide-react';
import { toast } from 'sonner';
import InteractiveLocationPickerModal from '@/components/shared/InteractiveLocationPickerModal';

interface ParentRoutePinningWidgetProps {
  schoolId?: string;
  studentId?: string;
}

export default function ParentRoutePinningWidget({ schoolId, studentId }: ParentRoutePinningWidgetProps) {
  const [routes, setRoutes] = useState([]);
  const [pinnedStops, setPinnedStops] = useState<Record<string, boolean>>({
    'RT-01:1': true,
  });
  const [loading, setLoading] = useState(true);
  const [childrenLocations, setChildrenLocations] = useState<any[]>([]);
  const [showHousePinModal, setShowHousePinModal] = useState(false);
  const [selectedChildForPin, setSelectedChildForPin] = useState<any>(null);

  const loadData = async () => {
    try {
      const [routesRes, houseRes] = await Promise.all([
        fetch('/api/school-admin/routes'),
        fetch('/api/parent/house-location').catch(() => null),
      ]);

      const json = await routesRes.json();
      if (json.success && Array.isArray(json.routes)) {
        setRoutes(json.routes);
      }

      if (houseRes && houseRes.ok) {
        const houseJson = await houseRes.json();
        if (houseJson.success && Array.isArray(houseJson.children)) {
          setChildrenLocations(houseJson.children);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const togglePin = async (routeId: string, stopNumber: number, stopName: string) => {
    const key = `${routeId}:${stopNumber}`;
    const nextState = !pinnedStops[key];
    setPinnedStops((prev) => ({ ...prev, [key]: nextState }));

    try {
      await fetch('/api/school-admin/routes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'pin_route',
          pin_data: { route_id: routeId, stop_number: stopNumber },
        }),
      });
      toast.success(nextState ? `Pinned ${stopName} to your home dashboard!` : `Unpinned ${stopName}`);
    } catch (err) {
      toast.error('Failed to update pin');
    }
  };

  const activeChild = studentId
    ? childrenLocations.find((c) => c.id === studentId) || childrenLocations[0]
    : childrenLocations[0];

  if (loading) {
    return <div className="p-4 text-xs text-slate-400">Loading school transit corridors...</div>;
  }

  return (
    <div className="bg-white rounded-3xl p-5 md:p-6 border border-slate-200 shadow-xs space-y-4 font-sans">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-2xl bg-teal-100 text-teal-800 flex items-center justify-center font-black">
            <Bookmark size={18} />
          </div>
          <div>
            <h3 className="font-black text-slate-900 text-base">Pinned School Transit Corridors</h3>
            <p className="text-xs text-slate-500 font-medium">
              Pin child house location and preferred corridor stops to receive approaching-bus alerts and escort guidance.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            setSelectedChildForPin(activeChild || null);
            setShowHousePinModal(true);
          }}
          className="px-4 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-black text-xs flex items-center gap-1.5 shadow-xs transition-all self-start sm:self-auto cursor-pointer"
        >
          <Home size={14} />
          <span>{activeChild?.house_lat ? 'Edit Child House Pin' : '📍 Pin Child House Location'}</span>
        </button>
      </div>

      {/* Child House Location Banner */}
      {activeChild && (
        <div className={`p-4 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
          activeChild.house_lat && activeChild.house_lng
            ? 'bg-teal-50/70 border-teal-200 text-teal-950'
            : 'bg-amber-50/70 border-amber-200 text-amber-950'
        }`}>
          <div className="flex items-start gap-3">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
              activeChild.house_lat ? 'bg-teal-700 text-white' : 'bg-amber-600 text-white'
            }`}>
              <Home size={16} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-xs">{activeChild.first_name}&apos;s Pickup House:</span>
                {activeChild.house_lat ? (
                  <span className="px-2 py-0.5 rounded-md bg-teal-200/80 text-teal-900 font-mono font-bold text-[10px]">
                    📍 Pinned ({Number(activeChild.house_lat).toFixed(4)}, {Number(activeChild.house_lng).toFixed(4)})
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-md bg-amber-200/80 text-amber-900 font-bold text-[10px]">
                    ⚠️ Not yet pinned
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-700 mt-0.5">
                {activeChild.house_address || 'Pin your home location so it appears on the route map for school admin, city manager, and your assigned escort.'}
              </p>
              {activeChild.house_landmark && (
                <p className="text-[11px] text-slate-500 font-medium">Landmark: {activeChild.house_landmark}</p>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setSelectedChildForPin(activeChild);
              setShowHousePinModal(true);
            }}
            className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-800 hover:bg-slate-50 transition-all shrink-0 cursor-pointer shadow-2xs"
          >
            {activeChild.house_lat ? 'Change House Pin' : 'Pin Doorstep Now'}
          </button>
        </div>
      )}

      {/* Corridor Routes & Stops Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {routes.map((route) => (
          <div key={route.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-200/90 space-y-3">
            <div className="flex items-center justify-between">
              <span className="px-2 py-0.5 rounded-md bg-slate-900 text-white font-mono font-bold text-[10px]">{route.code}</span>
              <span className="text-xs font-bold text-slate-600">Bus: {route.assigned_vehicle}</span>
            </div>

            <div>
              <h4 className="font-black text-slate-900 text-sm">{route.name}</h4>
              <p className="text-xs text-slate-500 font-medium">Escort: {route.assigned_escort_name} ({route.assigned_escort_phone})</p>
            </div>

            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Pickup Stops</span>
                <span className="text-[10px] text-teal-700 font-bold">📌 {route.pinned_by_parents_count || 0} Families Pinned</span>
              </div>
              {route.stops?.map((stop) => {
                const isPinned = !!pinnedStops[`${route.id}:${stop.stop_number}`];
                return (
                  <div
                    key={stop.stop_number}
                    className={`p-2.5 rounded-xl border transition-all flex items-center justify-between gap-2 text-xs ${
                      isPinned ? 'bg-emerald-50/80 border-emerald-300' : 'bg-white border-slate-200'
                    }`}
                  >
                    <div className="space-y-0.5">
                      <p className="font-bold text-slate-900">{stop.name}</p>
                      <span className="text-[10px] text-slate-500">📍 {stop.landmark} · ⏰ {stop.eta_morning}</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => togglePin(route.id, stop.stop_number, stop.name)}
                      className={`px-2.5 py-1 rounded-lg font-bold text-[11px] flex items-center gap-1 cursor-pointer transition-all ${
                        isPinned ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      <Bookmark size={12} className={isPinned ? 'fill-current' : ''} />
                      <span>{isPinned ? 'Pinned' : 'Pin Stop'}</span>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Interactive Location Picker Modal */}
      <InteractiveLocationPickerModal
        isOpen={showHousePinModal}
        onClose={() => setShowHousePinModal(false)}
        mode="parent"
        child={selectedChildForPin ? {
          id: selectedChildForPin.id,
          name: `${selectedChildForPin.first_name} ${selectedChildForPin.last_name || ''}`.trim(),
          class_name: selectedChildForPin.class?.name,
        } : null}
        childrenList={childrenLocations.map((c) => ({
          id: c.id,
          name: `${c.first_name} ${c.last_name || ''}`.trim(),
          class_name: c.class?.name,
        }))}
        initialAddress={selectedChildForPin?.house_address}
        initialLat={selectedChildForPin?.house_lat}
        initialLng={selectedChildForPin?.house_lng}
        initialLandmark={selectedChildForPin?.house_landmark}
        initialNotes={selectedChildForPin?.house_notes}
        onLocationSaved={() => {
          loadData();
        }}
      />
    </div>
  );
}
