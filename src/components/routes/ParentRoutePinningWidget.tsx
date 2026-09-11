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

  const [selectedChildIdState, setSelectedChildIdState] = useState<string>('');
  const [houseAddressInput, setHouseAddressInput] = useState('');
  const [houseLandmarkInput, setHouseLandmarkInput] = useState('');
  const [houseNotesInput, setHouseNotesInput] = useState('');
  const [applyToAllState, setApplyToAllState] = useState(false);
  const [savingAddress, setSavingAddress] = useState(false);

  const activeChild = studentId
    ? childrenLocations.find((c) => c.id === (selectedChildIdState || studentId)) || childrenLocations[0]
    : childrenLocations.find((c) => c.id === selectedChildIdState) || childrenLocations[0];

  // Sync inputs when active child changes
  useEffect(() => {
    if (activeChild) {
      setHouseAddressInput(activeChild.house_address || '');
      setHouseLandmarkInput(activeChild.house_landmark || '');
      setHouseNotesInput(activeChild.house_notes || '');
      if (!selectedChildIdState) setSelectedChildIdState(activeChild.id);
    }
  }, [activeChild?.id, activeChild?.house_address, activeChild?.house_landmark, activeChild?.house_notes]);

  const handleSaveDirectAddress = async () => {
    if (!houseAddressInput.trim()) {
      toast.error('Please enter a house number and street address');
      return;
    }
    setSavingAddress(true);
    try {
      const payload = {
        student_id: activeChild?.id,
        apply_to_all_children: applyToAllState,
        house_address: houseAddressInput.trim(),
        house_lat: activeChild?.house_lat || null,
        house_lng: activeChild?.house_lng || null,
        house_landmark: houseLandmarkInput.trim() || null,
        house_notes: houseNotesInput.trim() || null,
      };

      const res = await fetch('/api/parent/house-location', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Failed to save address');

      toast.success(data.message || 'House address saved successfully!');
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save house address');
    } finally {
      setSavingAddress(false);
    }
  };

  if (loading) {
    return <div className="p-4 text-xs text-slate-400">Loading school transit corridors...</div>;
  }

  return (
    <div className="bg-white rounded-3xl p-5 md:p-6 border border-slate-200 shadow-xs space-y-5 font-sans">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-2xl bg-teal-100 text-teal-800 flex items-center justify-center font-black">
            <Bookmark size={18} />
          </div>
          <div>
            <h3 className="font-black text-slate-900 text-base">Child Home Address &amp; Corridor Pinning</h3>
            <p className="text-xs text-slate-500 font-medium">
              Type your exact house number and address, pin your doorstep on the map, and select corridor stops for bus and escort guidance.
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
          <span>{activeChild?.house_lat ? 'Adjust House Pin on Map' : '📍 Drop House Pin on Map'}</span>
        </button>
      </div>

      {/* Child House Address & Pinning Card (Mirrors School Settings Experience) */}
      {activeChild && (
        <div className="p-4 sm:p-5 rounded-3xl bg-teal-50/50 border border-teal-200/90 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-teal-100 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-teal-700 text-white flex items-center justify-center font-black">
                <Home size={16} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-xs sm:text-sm font-black text-slate-900">
                    {activeChild.first_name}&apos;s Pickup &amp; Doorstep Address
                  </h4>
                  {activeChild.house_lat && activeChild.house_lng ? (
                    <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-mono font-black text-[10px]">
                      📍 Pinned ({Number(activeChild.house_lat).toFixed(4)}, {Number(activeChild.house_lng).toFixed(4)})
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-md bg-amber-200 text-amber-900 font-black text-[10px]">
                      ⚠️ Doorstep Unpinned
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 font-medium">
                  This address and coordinates are synced to school transport coordinators, escorts, and city manager route maps.
                </p>
              </div>
            </div>

            {/* Child Selector Tabs (if multiple children) */}
            {childrenLocations.length > 1 && (
              <div className="flex flex-wrap items-center gap-1.5 pt-1 sm:pt-0">
                {childrenLocations.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setSelectedChildIdState(c.id);
                      setSelectedChildForPin(c);
                    }}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      activeChild.id === c.id
                        ? 'bg-teal-700 text-white shadow-2xs'
                        : 'bg-white text-teal-900 border border-teal-200 hover:bg-teal-100'
                    }`}
                  >
                    {c.first_name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Form Fields: House Address & Landmark */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            <div className="space-y-1.5 md:col-span-2">
              <label className="block text-xs font-black text-slate-800">
                House / Flat Number &amp; Street Address <span className="text-rose-600">*</span>
              </label>
              <input
                type="text"
                value={houseAddressInput}
                onChange={(e) => setHouseAddressInput(e.target.value)}
                placeholder="e.g. Plot 12B, Flat 3, Road 4, Silver Estate, Lekki Phase 1, Lagos"
                className="w-full px-3.5 py-2.5 bg-white border border-teal-300 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-600 shadow-2xs"
              />
              <p className="text-[10px] text-slate-500 font-medium">
                Type your exact house or apartment number. If your house number is not on map directories, typing it here ensures drivers and escorts arrive at the right door.
              </p>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700">Nearest Landmark / Junction</label>
              <input
                type="text"
                value={houseLandmarkInput}
                onChange={(e) => setHouseLandmarkInput(e.target.value)}
                placeholder="e.g. Opposite Central Mosque, black gate"
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700">Driver / Escort Arrival Notes</label>
              <input
                type="text"
                value={houseNotesInput}
                onChange={(e) => setHouseNotesInput(e.target.value)}
                placeholder="e.g. Call parent 5 mins before bus arrives"
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
              />
            </div>
          </div>

          {/* Action Row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1 border-t border-teal-100">
            {childrenLocations.length > 1 ? (
              <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-teal-900">
                <input
                  type="checkbox"
                  checked={applyToAllState}
                  onChange={(e) => setApplyToAllState(e.target.checked)}
                  className="rounded text-teal-600 focus:ring-teal-500 w-4 h-4 cursor-pointer"
                />
                <span>Apply this address &amp; pin to all my {childrenLocations.length} children</span>
              </label>
            ) : <div />}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSaveDirectAddress}
                disabled={savingAddress || !houseAddressInput.trim()}
                className="px-4 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-black text-xs flex items-center gap-1.5 shadow-xs disabled:opacity-50 cursor-pointer transition-all"
              >
                <Check size={14} />
                <span>{savingAddress ? 'Saving Address…' : 'Save Address'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setSelectedChildForPin(activeChild);
                  setShowHousePinModal(true);
                }}
                className="px-4 py-2 rounded-xl bg-white border border-teal-300 text-teal-850 hover:bg-teal-100/70 font-black text-xs flex items-center gap-1.5 shadow-2xs cursor-pointer transition-all"
              >
                <MapPin size={14} />
                <span>{activeChild.house_lat ? '📍 Adjust Pin on Map' : '📍 Drop Pin on Map'}</span>
              </button>
            </div>
          </div>
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
