// @ts-nocheck
'use client';

import { useState } from 'react';
import {
  UserCheck,
  Plus,
  Search,
  Phone,
  Mail,
  ShieldCheck,
  Car,
  CheckCircle2,
  AlertCircle,
  FileBadge,
  X
} from 'lucide-react';
import { toast } from 'sonner';

export default function SchoolDriversPage() {
  const [drivers, setDrivers] = useState([
    {
      id: '1',
      fullName: 'Babajide Adeleke',
      phone: '+234 803 291 8841',
      email: 'b.adeleke@school.edu.ng',
      licenseNumber: 'LAG-992381-DL',
      licenseExpiry: '2028-09-12',
      assignedVehicle: 'LAG-482-XA (HiAce 18-Seater)',
      experienceYears: '8 Years',
      rating: 4.9,
      status: 'active',
      backgroundCheck: 'Verified & Cleared',
    },
    {
      id: '2',
      fullName: 'Emeka Chukwu',
      phone: '+234 812 449 1022',
      email: 'e.chukwu@school.edu.ng',
      licenseNumber: 'IKJ-771822-DL',
      licenseExpiry: '2027-05-18',
      assignedVehicle: 'IKJ-904-KT (Ford Transit 15-Seater)',
      experienceYears: '6 Years',
      rating: 4.8,
      status: 'active',
      backgroundCheck: 'Verified & Cleared',
    },
    {
      id: '3',
      fullName: 'Oluwaseun Bakare',
      phone: '+234 809 332 5590',
      email: 'o.bakare@school.edu.ng',
      licenseNumber: 'APP-449102-DL',
      licenseExpiry: '2029-01-30',
      assignedVehicle: 'APP-118-BC (Coaster Bus)',
      experienceYears: '11 Years',
      rating: 5.0,
      status: 'active',
      backgroundCheck: 'Verified & Cleared',
    },
  ]);

  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({
    fullName: '',
    phone: '',
    email: '',
    licenseNumber: '',
    licenseExpiry: '',
    assignedVehicle: '',
    experienceYears: '5 Years',
  });

  const handleAddDriver = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.fullName || !form.phone || !form.licenseNumber) {
      toast.error('Driver name, phone, and driver license number are required');
      return;
    }
    const newD = {
      id: String(Date.now()),
      fullName: form.fullName,
      phone: form.phone,
      email: form.email || `${form.fullName.toLowerCase().replace(/\s+/g, '.')}@school.edu.ng`,
      licenseNumber: form.licenseNumber.toUpperCase(),
      licenseExpiry: form.licenseExpiry || '2028-12-31',
      assignedVehicle: form.assignedVehicle || 'Unassigned',
      experienceYears: form.experienceYears,
      rating: 5.0,
      status: 'active',
      backgroundCheck: 'Verified & Cleared',
    };
    setDrivers([newD, ...drivers]);
    toast.success(`Driver ${newD.fullName} registered successfully!`);
    setModalOpen(false);
    setForm({
      fullName: '',
      phone: '',
      email: '',
      licenseNumber: '',
      licenseExpiry: '',
      assignedVehicle: '',
      experienceYears: '5 Years',
    });
  };

  const filtered = drivers.filter(
    (d) =>
      d.fullName.toLowerCase().includes(search.toLowerCase()) ||
      d.phone.includes(search) ||
      d.licenseNumber.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 font-sans text-slate-800 p-4 md:p-6 max-w-7xl mx-auto">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-[#07132B] via-[#0B1E36] to-[#0A1633] rounded-3xl p-6 text-white shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border border-slate-800">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 font-black text-[11px] border border-emerald-400/30 uppercase tracking-wider flex items-center gap-1.5">
              <UserCheck size={13} /> Transport Personnel
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">
            School Transport Drivers Directory
          </h1>
          <p className="text-slate-300 text-xs md:text-sm max-w-2xl font-medium">
            Manage school drivers, professional licensing verification, background check clearances, and assigned fleet vehicles.
          </p>
        </div>

        <button
          onClick={() => setModalOpen(true)}
          className="px-5 py-3 rounded-2xl bg-[#00A859] hover:bg-emerald-600 text-white font-extrabold text-xs transition-all shadow-lg shadow-emerald-600/30 flex items-center gap-2 cursor-pointer shrink-0"
        >
          <Plus size={16} />
          <span>Add New Driver</span>
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search driver name, phone number, or driver license ID..."
            className="w-full pl-10 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
          />
        </div>
        <span className="text-xs font-bold text-slate-500">{filtered.length} Drivers Active</span>
      </div>

      {/* Drivers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filtered.map((d) => (
          <div key={d.id} className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs space-y-4 hover:shadow-md transition-all">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-teal-100 text-teal-800 flex items-center justify-center font-black text-base">
                  {d.fullName.charAt(0)}
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-base">{d.fullName}</h3>
                  <p className="text-xs text-slate-500 font-mono">📞 {d.phone}</p>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-extrabold text-[10px] uppercase">
                {d.status}
              </span>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">License No:</span>
                <span className="font-mono font-bold text-slate-900">{d.licenseNumber}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">License Expiry:</span>
                <span className="font-bold text-slate-800">{d.licenseExpiry}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Assigned Bus:</span>
                <span className="font-bold text-slate-800 truncate max-w-[170px]">{d.assignedVehicle}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Security Clearance:</span>
                <span className="font-extrabold text-emerald-700">{d.backgroundCheck}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Add Driver Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-slate-950/70 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-black text-slate-900 text-base">Add School Transport Driver</h3>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddDriver} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Driver Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Babatunde Lawal"
                  value={form.fullName}
                  onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Phone Number *</label>
                  <input
                    type="text"
                    required
                    placeholder="+234..."
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Email Address</label>
                  <input
                    type="email"
                    placeholder="driver@school.edu.ng"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Driver's License No *</label>
                  <input
                    type="text"
                    required
                    placeholder="LAG-000000-DL"
                    value={form.licenseNumber}
                    onChange={(e) => setForm({ ...form, licenseNumber: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl uppercase font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Assigned Vehicle</label>
                  <input
                    type="text"
                    placeholder="e.g. LAG-482-XA"
                    value={form.assignedVehicle}
                    onChange={(e) => setForm({ ...form, assignedVehicle: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 font-bold text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black shadow-md shadow-emerald-600/20"
                >
                  Save Driver Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
