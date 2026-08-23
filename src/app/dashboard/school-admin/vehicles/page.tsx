// @ts-nocheck
'use client';

import { useState, useEffect } from 'react';
import {
  Car,
  Plus,
  Search,
  Filter,
  ShieldCheck,
  Calendar,
  Users,
  CheckCircle2,
  AlertCircle,
  FileText,
  Trash2,
  Pencil,
  X,
  RefreshCw,
  Phone,
  Shield,
  Clock
} from 'lucide-react';
import { toast } from 'sonner';

export default function SchoolVehiclesPage() {
  const [vehicles, setVehicles] = useState([]);
  const [metrics, setMetrics] = useState({
    total_vehicles: 0,
    active_fleet: 0,
    total_seating_capacity: 0,
    compliance_rate: '100%',
  });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    reg_number: '',
    type: 'School Bus (HiAce)',
    make: 'Toyota',
    model: '',
    color: 'Yellow / Green',
    capacity: '18',
    assigned_driver_name: '',
    assigned_driver_phone: '',
    assigned_driver_license: '',
    roadworthiness_expiry: '',
    insurance_status: 'Active (Verified)',
  });

  const loadVehicles = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/school-admin/vehicles');
      const json = await res.json();
      if (json.success) {
        setVehicles(json.vehicles || []);
        setMetrics(json.metrics || {});
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load fleet vehicles');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVehicles();
  }, []);

  const handleSaveVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.reg_number || !form.make) {
      toast.error('Registration plate number and make are required');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/school-admin/vehicles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: editingVehicle ? 'update_vehicle' : 'create_vehicle',
          vehicle_id: editingVehicle?.id,
          vehicle_data: form,
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(json.message || 'Vehicle operational record updated');
        setModalOpen(false);
        setEditingVehicle(null);
        setForm({
          reg_number: '',
          type: 'School Bus (HiAce)',
          make: 'Toyota',
          model: '',
          color: 'Yellow / Green',
          capacity: '18',
          assigned_driver_name: '',
          assigned_driver_phone: '',
          assigned_driver_license: '',
          roadworthiness_expiry: '',
          insurance_status: 'Active (Verified)',
        });
        loadVehicles();
      } else {
        toast.error(json.error || 'Failed to save vehicle');
      }
    } catch (err: any) {
      toast.error(err.message || 'Error processing request');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteVehicle = async (vehicleId: string, regNumber: string) => {
    if (!confirm(`Are you sure you want to remove vehicle ${regNumber} from the operational fleet?`)) return;
    try {
      const res = await fetch('/api/school-admin/vehicles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete_vehicle',
          vehicle_id: vehicleId,
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(`Vehicle ${regNumber} removed`);
        loadVehicles();
      }
    } catch (err) {
      toast.error('Failed to remove vehicle');
    }
  };

  const filtered = vehicles.filter(
    (v) =>
      (v.reg_number || '').toLowerCase().includes(search.toLowerCase()) ||
      (v.make || '').toLowerCase().includes(search.toLowerCase()) ||
      (v.assigned_driver_name || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 font-sans text-slate-800 p-4 md:p-6 max-w-7xl mx-auto">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-[#07132B] via-[#0B1E36] to-[#0A1633] rounded-3xl p-6 text-white shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-5 border border-slate-800">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 font-black text-[11px] border border-emerald-400/30 uppercase tracking-wider flex items-center gap-1.5">
              <Car size={13} /> Official School Fleet Registry
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">
            Vehicle List & Fleet Operational Records
          </h1>
          <p className="text-slate-300 text-xs md:text-sm max-w-2xl font-medium">
            Permanent operational record of school-registered transport vehicles, seating capacities, assigned escort-driver credentials, and regulatory roadworthiness inspections.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setEditingVehicle(null);
              setForm({
                reg_number: '',
                type: 'School Bus (HiAce)',
                make: 'Toyota',
                model: '',
                color: 'Yellow / Green',
                capacity: '18',
                assigned_driver_name: '',
                assigned_driver_phone: '',
                assigned_driver_license: '',
                roadworthiness_expiry: '',
                insurance_status: 'Active (Verified)',
              });
              setModalOpen(true);
            }}
            className="px-5 py-3 rounded-2xl bg-[#00A859] hover:bg-emerald-600 text-white font-extrabold text-xs transition-all shadow-lg shadow-emerald-600/30 flex items-center gap-2 cursor-pointer shrink-0"
          >
            <Plus size={16} />
            <span>Register New Vehicle</span>
          </button>
        </div>
      </div>

      {/* Fleet KPI Metric Ribbon */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs space-y-1">
          <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Registered Vehicles</span>
          <p className="text-2xl font-black text-slate-900">{metrics.total_vehicles || vehicles.length}</p>
          <span className="text-xs text-slate-500 font-medium">School Fleet Units</span>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs space-y-1">
          <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Active On Duty</span>
          <p className="text-2xl font-black text-emerald-700">{metrics.active_fleet || vehicles.length}</p>
          <span className="text-xs text-emerald-600 font-bold">Operational Shifts</span>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs space-y-1">
          <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Total Fleet Seating</span>
          <p className="text-2xl font-black text-slate-900">{metrics.total_seating_capacity || 61} Seats</p>
          <span className="text-xs text-slate-500 font-medium">Passenger Capacity</span>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs space-y-1">
          <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Inspection Compliance</span>
          <p className="text-2xl font-black text-teal-700">{metrics.compliance_rate || '100%'}</p>
          <span className="text-xs text-teal-600 font-bold">VIO & MOT Certified</span>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative flex-1 w-full max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search vehicle plate number, make, model, or driver..."
            className="w-full pl-10 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
          />
        </div>
        <span className="text-xs font-bold text-slate-500">{filtered.length} Vehicles Listed</span>
      </div>

      {/* Vehicles Grid / Operational Record */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filtered.map((v) => (
          <div key={v.id} className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs space-y-4 hover:shadow-md transition-all flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-black">
                    <Car size={22} />
                  </div>
                  <div>
                    <h3 className="font-black text-slate-900 text-base">{v.reg_number}</h3>
                    <p className="text-xs text-slate-500 font-medium">{v.make} {v.model} ({v.type})</p>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-extrabold text-[10px] uppercase">
                  {v.status}
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Seating Capacity:</span>
                  <span className="font-black text-slate-900">{v.capacity} Seats</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Assigned Driver / Escort:</span>
                  <span className="font-bold text-slate-900">{v.assigned_driver_name}</span>
                </div>
                {v.assigned_driver_license && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Driver License:</span>
                    <span className="font-mono font-bold text-slate-800">{v.assigned_driver_license}</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Roadworthiness Expiry:</span>
                  <span className="font-mono text-emerald-700 font-bold">{v.roadworthiness_expiry}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Insurance Status:</span>
                  <span className="font-bold text-slate-800">{v.insurance_status}</span>
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setEditingVehicle(v);
                  setForm({
                    reg_number: v.reg_number,
                    type: v.type,
                    make: v.make,
                    model: v.model,
                    color: v.color,
                    capacity: String(v.capacity),
                    assigned_driver_name: v.assigned_driver_name,
                    assigned_driver_phone: v.assigned_driver_phone,
                    assigned_driver_license: v.assigned_driver_license,
                    roadworthiness_expiry: v.roadworthiness_expiry,
                    insurance_status: v.insurance_status,
                  });
                  setModalOpen(true);
                }}
                className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-1 cursor-pointer"
              >
                <Pencil size={13} />
                <span>Edit Record</span>
              </button>

              <button
                type="button"
                onClick={() => handleDeleteVehicle(v.id, v.reg_number)}
                className="p-1.5 rounded-xl text-rose-500 hover:bg-rose-50 cursor-pointer"
              >
                <Trash2 size={15} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Add / Edit Vehicle Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-slate-950/70 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-black">
                  <Car size={18} />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-base">
                    {editingVehicle ? 'Edit Vehicle Operational Record' : 'Register School Fleet Vehicle'}
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">Record bus specifications, driver credentials & safety dates.</p>
                </div>
              </div>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveVehicle} className="space-y-3.5 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Registration / Plate Number *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. LAG-582-XA"
                  value={form.reg_number}
                  onChange={(e) => setForm({ ...form, reg_number: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl uppercase font-mono font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Make *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Toyota"
                    value={form.make}
                    onChange={(e) => setForm({ ...form, make: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Model & Year</label>
                  <input
                    type="text"
                    placeholder="e.g. HiAce 2023"
                    value={form.model}
                    onChange={(e) => setForm({ ...form, model: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Seating Capacity</label>
                  <input
                    type="number"
                    value={form.capacity}
                    onChange={(e) => setForm({ ...form, capacity: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Vehicle Color</label>
                  <input
                    type="text"
                    value={form.color}
                    onChange={(e) => setForm({ ...form, color: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 space-y-2.5">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">Assigned Driver / Escort Linkage</span>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="Driver Full Name"
                    value={form.assigned_driver_name}
                    onChange={(e) => setForm({ ...form, assigned_driver_name: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-bold"
                  />
                  <input
                    type="text"
                    placeholder="Driver Phone No"
                    value={form.assigned_driver_phone}
                    onChange={(e) => setForm({ ...form, assigned_driver_phone: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-mono"
                  />
                </div>
                <input
                  type="text"
                  placeholder="Driver's License No (e.g. LAG-992381-DL)"
                  value={form.assigned_driver_license}
                  onChange={(e) => setForm({ ...form, assigned_driver_license: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl uppercase font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Roadworthiness Expiry</label>
                  <input
                    type="date"
                    value={form.roadworthiness_expiry}
                    onChange={(e) => setForm({ ...form, roadworthiness_expiry: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Insurance Certificate</label>
                  <input
                    type="text"
                    value={form.insurance_status}
                    onChange={(e) => setForm({ ...form, insurance_status: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 font-bold text-slate-600 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black shadow-md shadow-emerald-600/20 cursor-pointer"
                >
                  {submitting ? 'Saving...' : editingVehicle ? 'Update Vehicle Record' : 'Save Vehicle Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
