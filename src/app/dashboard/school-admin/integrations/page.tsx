// @ts-nocheck
'use client';

import { useState } from 'react';
import { Layers, ShieldCheck, CheckCircle2, Zap, Radio, MessageSquare, Key, ToggleLeft, ToggleRight } from 'lucide-react';
import { toast } from 'sonner';

export default function SchoolIntegrationsPage() {
  const [integrations, setIntegrations] = useState([
    {
      id: 'sms',
      name: 'Direct SMS Gateway (Termii / Twilio)',
      desc: 'Broadcast instant departure and gate scan SMS alerts to parents in real-time.',
      status: true,
      category: 'Messaging',
    },
    {
      id: 'gps',
      name: 'Onboard GPS Telemetry Trackers',
      desc: 'Sync hardware GPS vehicle trackers with the Live Fleet Tracking map module.',
      status: true,
      category: 'Telemetry',
    },
    {
      id: 'turnstile',
      name: 'RFID Turnstile & NFC Gate Terminal',
      desc: 'Automatic student and staff card scanning hardware integration at primary gate.',
      status: true,
      category: 'Access Control',
    },
    {
      id: 'sis',
      name: 'School Information System (SIS / PowerSchool)',
      desc: 'Automated bi-directional sync of student rosters, guardian records, and class enrollments.',
      status: false,
      category: 'Academic Sync',
    },
  ]);

  const toggleStatus = (id: string) => {
    setIntegrations((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const next = !item.status;
          toast.success(`${item.name} is now ${next ? 'Active' : 'Disabled'}`);
          return { ...item, status: next };
        }
        return item;
      })
    );
  };

  return (
    <div className="space-y-6 font-sans text-slate-800 p-4 md:p-6 max-w-7xl mx-auto">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-[#07132B] via-[#0B1E36] to-[#0A1633] rounded-3xl p-6 text-white shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border border-slate-800">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 font-black text-[11px] border border-emerald-400/30 uppercase tracking-wider flex items-center gap-1.5">
              <Layers size={13} /> Hardware & Services
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">
            School System & Hardware Integrations
          </h1>
          <p className="text-slate-300 text-xs md:text-sm max-w-2xl font-medium">
            Connect gate barcode scanners, SMS parent notification gateways, vehicle GPS telematics, and student information systems.
          </p>
        </div>
      </div>

      {/* Integrations Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {integrations.map((item) => (
          <div key={item.id} className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="px-2.5 py-0.5 rounded-md bg-slate-100 font-extrabold text-[10px] uppercase text-slate-600">
                  {item.category}
                </span>
                <span
                  className={`px-2.5 py-0.5 rounded-full font-extrabold text-[10px] uppercase ${
                    item.status ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {item.status ? 'Connected' : 'Offline'}
                </span>
              </div>
              <h3 className="font-black text-slate-900 text-base">{item.name}</h3>
              <p className="text-xs text-slate-500 leading-relaxed font-medium">{item.desc}</p>
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700">Integration Status</span>
              <button
                type="button"
                onClick={() => toggleStatus(item.id)}
                className={`px-4 py-1.5 rounded-xl font-black text-xs cursor-pointer transition-all ${
                  item.status ? 'bg-emerald-600 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {item.status ? 'Active' : 'Enable'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
