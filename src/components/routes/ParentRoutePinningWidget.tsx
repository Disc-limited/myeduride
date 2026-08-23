// @ts-nocheck
'use client';

import { useState, useEffect } from 'react';
import { Bookmark, MapPin, Bus, Clock, Check, Phone, ShieldCheck, Compass } from 'lucide-react';
import { toast } from 'sonner';

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

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/school-admin/routes');
        const json = await res.json();
        if (json.success && Array.isArray(json.routes)) {
          setRoutes(json.routes);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    })();
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

  if (loading) {
    return <div className="p-4 text-xs text-slate-400">Loading school transit corridors...</div>;
  }

  return (
    <div className="bg-white rounded-3xl p-5 md:p-6 border border-slate-200 shadow-xs space-y-4 font-sans">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-2xl bg-teal-100 text-teal-800 flex items-center justify-center font-black">
            <Bookmark size={18} />
          </div>
          <div>
            <h3 className="font-black text-slate-900 text-base">Pinned School Transit Corridors</h3>
            <p className="text-xs text-slate-500 font-medium">Pin preferred stops to receive approaching-bus alerts and direct driver contact.</p>
          </div>
        </div>
      </div>

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
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">Pickup Stops</span>
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
    </div>
  );
}
