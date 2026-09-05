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
  Clock,
  Camera,
  MapPin,
  Image as ImageIcon,
  Check
} from 'lucide-react';
import { toast } from 'sonner';

export default function SchoolVehiclesPage() {
  const [vehicles, setVehicles] = useState([]);
  const [escorts, setEscorts] = useState([]);
  const [routes, setRoutes] = useState([]);
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

  const initialForm = {
    reg_number: '',
    type: 'School Bus (HiAce)',
    make: 'Toyota',
    model: '',
    color: 'Yellow / Green',
    capacity: '18',
    photo_url: '',
    photo_front: '',
    photo_side: '',
    photo_plate: '',
    assigned_escort_id: '',
    assigned_escort_name: '',
    assigned_escort_phone: '',
    assigned_route_id: '',
    assigned_route_name: '',
    assigned_driver_name: '',
    assigned_driver_phone: '',
    assigned_driver_license: '',
    roadworthiness_expiry: '',
    insurance_status: 'Active (Verified)',
    status: 'active',
  };

  const [form, setForm] = useState(initialForm);

  const loadVehicles = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/school-admin/vehicles');
      const json = await res.json();
      if (json.success) {
        setVehicles(json.vehicles || []);
        setEscorts(json.escorts || []);
        setRoutes(json.routes || []);
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

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>, photoKey: 'front' | 'side' | 'plate') => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = reader.result as string;
        if (photoKey === 'front') {
          setForm((prev) => ({ ...prev, photo_front: dataUrl, photo_url: dataUrl }));
        } else if (photoKey === 'side') {
          setForm((prev) => ({ ...prev, photo_side: dataUrl }));
        } else if (photoKey === 'plate') {
          setForm((prev) => ({ ...prev, photo_plate: dataUrl }));
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.reg_number || !form.make) {
      toast.error('Registration plate number and make are required');
      return;
    }
    setSubmitting(true);
    try {
      const { photo_front, photo_side, photo_plate, ...cleanForm } = form;
      const vehiclePayload = {
        ...cleanForm,
        photo_url: form.photo_front || form.photo_url || null,
        vehicle_photos: {
          front: form.photo_front || form.photo_url || null,
          side: form.photo_side || null,
          plate: form.photo_plate || null,
        },
      };

      const res = await fetch('/api/school-admin/vehicles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: editingVehicle ? 'update_vehicle' : 'create_vehicle',
          vehicle_id: editingVehicle?.id,
          vehicle_data: vehiclePayload,
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(json.message || 'Vehicle operational record updated');
        setModalOpen(false);
        setEditingVehicle(null);
        setForm(initialForm);
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

  const openCreateModal = () => {
    setEditingVehicle(null);
    setForm(initialForm);
    setModalOpen(true);
  };

  const openEditModal = (v: any) => {
    setEditingVehicle(v);
    const photos = typeof v.vehicle_photos === 'object' && v.vehicle_photos ? v.vehicle_photos : {};
    setForm({
      reg_number: v.reg_number || '',
      type: v.type || 'School Bus (HiAce)',
      make: v.make || '',
      model: v.model || '',
      color: v.color || 'Yellow / Green',
      capacity: String(v.capacity || 18),
      photo_url: v.photo_url || photos.front || '',
      photo_front: photos.front || v.photo_url || '',
      photo_side: photos.side || '',
      photo_plate: photos.plate || '',
      assigned_escort_id: v.assigned_escort_id || '',
      assigned_escort_name: v.assigned_escort_name || '',
      assigned_escort_phone: v.assigned_escort_phone || '',
      assigned_route_id: v.assigned_route_id || '',
      assigned_route_name: v.assigned_route_name || '',
      assigned_driver_name: v.assigned_driver_name || '',
      assigned_driver_phone: v.assigned_driver_phone || '',
      assigned_driver_license: v.assigned_driver_license || '',
      roadworthiness_expiry: v.roadworthiness_expiry || '',
      insurance_status: v.insurance_status || 'Active (Verified)',
      status: v.status || 'active',
    });
    setModalOpen(true);
  };

  const filtered = vehicles.filter(
    (v) =>
      (v.reg_number || '').toLowerCase().includes(search.toLowerCase()) ||
      (v.make || '').toLowerCase().includes(search.toLowerCase()) ||
      (v.assigned_driver_name || '').toLowerCase().includes(search.toLowerCase()) ||
      (v.assigned_escort_name || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 font-sans text-slate-800 p-4 md:p-6 max-w-7xl mx-auto">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-[#07132B] via-[#0B1E36] to-[#0A1633] rounded-3xl p-6 text-white shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-5 border border-slate-800">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 font-black text-[11px] border border-emerald-400/30 uppercase tracking-wider flex items-center gap-1.5">
              <Car size={13} /> Official School Fleet & Escort Registry
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">
            Vehicle Creation & Escort Allocation
          </h1>
          <p className="text-slate-300 text-xs md:text-sm max-w-2xl font-medium">
            Snap your school vehicles, allocate School Escorts to buses, assign transport routes (parent pinned or school created), and sync with the City Manager Dashboard.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={openCreateModal}
            className="px-5 py-3 rounded-2xl bg-[#00A859] hover:bg-emerald-600 text-white font-extrabold text-xs transition-all shadow-lg shadow-emerald-600/30 flex items-center gap-2 cursor-pointer shrink-0"
          >
            <Plus size={16} />
            <span>Register & Snap Vehicle</span>
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
          <span className="text-xs text-teal-600 font-bold">City Manager Verified</span>
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
            placeholder="Search plate number, make, escort, or driver..."
            className="w-full pl-10 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
          />
        </div>
        <span className="text-xs font-bold text-slate-500">{filtered.length} Vehicles Listed</span>
      </div>

      {/* Vehicles Grid / Operational Record */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filtered.map((v) => {
          const photos = typeof v.vehicle_photos === 'object' && v.vehicle_photos ? v.vehicle_photos : {};
          const mainImg = v.photo_url || photos.front || null;

          return (
            <div key={v.id} className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs space-y-4 hover:shadow-md transition-all flex flex-col justify-between">
              <div className="space-y-3">
                {/* Vehicle Header & Photo Thumbnail */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    {mainImg ? (
                      <img
                        src={mainImg}
                        alt={v.reg_number}
                        className="w-14 h-14 rounded-2xl object-cover border border-slate-200 shadow-xs"
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-black">
                        <Car size={26} />
                      </div>
                    )}
                    <div>
                      <h3 className="font-black text-slate-900 text-base">{v.reg_number}</h3>
                      <p className="text-xs text-slate-500 font-medium">{v.make} {v.model} ({v.type})</p>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-extrabold text-[10px] uppercase shrink-0">
                    {v.status}
                  </span>
                </div>

                {/* Snapped Photos Preview Badges */}
                {(photos.front || photos.side || photos.plate || v.photo_url) && (
                  <div className="flex items-center gap-2 pt-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Vehicle Snaps:</span>
                    <div className="flex items-center gap-1.5">
                      {(photos.front || v.photo_url) && (
                        <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 text-[10px] font-bold border border-blue-200 flex items-center gap-1">
                          <Camera size={10} /> Front
                        </span>
                      )}
                      {photos.side && (
                        <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200 flex items-center gap-1">
                          <Camera size={10} /> Door/Side
                        </span>
                      )}
                      {photos.plate && (
                        <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 text-[10px] font-bold border border-amber-200 flex items-center gap-1">
                          <Camera size={10} /> Plate
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Operational Details Card */}
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-medium">Allocated Escort:</span>
                    <span className="font-bold text-emerald-700 flex items-center gap-1">
                      <ShieldCheck size={12} />
                      {v.assigned_escort_name || (v.assigned_escort_id ? 'School Escort' : 'Unassigned')}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-medium">Assigned Route:</span>
                    <span className="font-bold text-slate-900 flex items-center gap-1 truncate max-w-[180px]">
                      <MapPin size={12} className="text-indigo-600 shrink-0" />
                      <span className="truncate">{v.assigned_route_name || 'Unassigned Route'}</span>
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Capacity & Color:</span>
                    <span className="font-bold text-slate-900">{v.capacity} Seats ({v.color || 'Yellow'})</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Assigned Driver:</span>
                    <span className="font-bold text-slate-800">{v.assigned_driver_name || 'Unassigned'}</span>
                  </div>
                  {v.assigned_driver_license && (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Driver License:</span>
                      <span className="font-mono font-bold text-slate-800">{v.assigned_driver_license}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Roadworthiness:</span>
                    <span className="font-mono text-emerald-700 font-bold">{v.roadworthiness_expiry || 'Verified 2027'}</span>
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => openEditModal(v)}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-1 cursor-pointer"
                >
                  <Pencil size={13} />
                  <span>Edit & Reallocate</span>
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
          );
        })}
      </div>

      {/* Add / Edit Vehicle Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-slate-950/70 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-black">
                  <Car size={18} />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-base">
                    {editingVehicle ? 'Edit Vehicle & Escort Allocation' : 'Register Vehicle & Snap Photos'}
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">Snap bus photos, allocate School Escort & assign transport route.</p>
                </div>
              </div>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveVehicle} className="space-y-4 text-xs">
              {/* Photo Snapping Section */}
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider flex items-center gap-1.5">
                    <Camera size={13} className="text-emerald-600" /> Snap Vehicle Photos (Front, Door Side, License Plate)
                  </span>
                  <span className="text-[10px] text-slate-400">Click icon to upload / capture</span>
                </div>

                <div className="grid grid-cols-3 gap-2.5">
                  {/* Front View Photo */}
                  <div className="relative border-2 border-dashed border-slate-300 rounded-2xl p-2 text-center bg-white hover:border-emerald-500 transition-all">
                    {form.photo_front || form.photo_url ? (
                      <div className="relative group">
                        <img
                          src={form.photo_front || form.photo_url}
                          alt="Front"
                          className="w-full h-20 object-cover rounded-xl"
                        />
                        <div className="absolute inset-0 bg-black/40 rounded-xl opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all">
                          <label className="text-white text-[10px] font-bold cursor-pointer">
                            Change
                            <input
                              type="file"
                              accept="image/*"
                              capture="environment"
                              onChange={(e) => handlePhotoUpload(e, 'front')}
                              className="hidden"
                            />
                          </label>
                        </div>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center h-20 cursor-pointer text-slate-400 hover:text-emerald-600">
                        <Camera size={20} className="mb-1" />
                        <span className="text-[10px] font-bold">Front View</span>
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          onChange={(e) => handlePhotoUpload(e, 'front')}
                          className="hidden"
                        />
                      </label>
                    )}
                  </div>

                  {/* Door/Side View Photo */}
                  <div className="relative border-2 border-dashed border-slate-300 rounded-2xl p-2 text-center bg-white hover:border-emerald-500 transition-all">
                    {form.photo_side ? (
                      <div className="relative group">
                        <img src={form.photo_side} alt="Side" className="w-full h-20 object-cover rounded-xl" />
                        <div className="absolute inset-0 bg-black/40 rounded-xl opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all">
                          <label className="text-white text-[10px] font-bold cursor-pointer">
                            Change
                            <input
                              type="file"
                              accept="image/*"
                              capture="environment"
                              onChange={(e) => handlePhotoUpload(e, 'side')}
                              className="hidden"
                            />
                          </label>
                        </div>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center h-20 cursor-pointer text-slate-400 hover:text-emerald-600">
                        <Camera size={20} className="mb-1" />
                        <span className="text-[10px] font-bold">Door Side</span>
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          onChange={(e) => handlePhotoUpload(e, 'side')}
                          className="hidden"
                        />
                      </label>
                    )}
                  </div>

                  {/* License Plate / Rear Photo */}
                  <div className="relative border-2 border-dashed border-slate-300 rounded-2xl p-2 text-center bg-white hover:border-emerald-500 transition-all">
                    {form.photo_plate ? (
                      <div className="relative group">
                        <img src={form.photo_plate} alt="Plate" className="w-full h-20 object-cover rounded-xl" />
                        <div className="absolute inset-0 bg-black/40 rounded-xl opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all">
                          <label className="text-white text-[10px] font-bold cursor-pointer">
                            Change
                            <input
                              type="file"
                              accept="image/*"
                              capture="environment"
                              onChange={(e) => handlePhotoUpload(e, 'plate')}
                              className="hidden"
                            />
                          </label>
                        </div>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center h-20 cursor-pointer text-slate-400 hover:text-emerald-600">
                        <Camera size={20} className="mb-1" />
                        <span className="text-[10px] font-bold">Plate / Rear</span>
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          onChange={(e) => handlePhotoUpload(e, 'plate')}
                          className="hidden"
                        />
                      </label>
                    )}
                  </div>
                </div>
              </div>

              {/* Plate & Basic Info */}
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
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold"
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

              {/* Escort Allocation Dropdown */}
              <div className="p-3.5 rounded-2xl bg-emerald-50/60 border border-emerald-200 space-y-2">
                <label className="font-black text-emerald-900 flex items-center gap-1.5 uppercase text-[10px] tracking-wider">
                  <ShieldCheck size={14} className="text-emerald-600" /> Allocate School Escort to Bus
                </label>
                <select
                  value={form.assigned_escort_id}
                  onChange={(e) => {
                    const escId = e.target.value;
                    const found = escorts.find((esc) => esc.id === escId);
                    setForm({
                      ...form,
                      assigned_escort_id: escId,
                      assigned_escort_name: found ? found.name : '',
                      assigned_escort_phone: found ? found.phone : '',
                    });
                  }}
                  className="w-full px-3.5 py-2.5 bg-white border border-emerald-300 rounded-xl font-bold text-slate-800"
                >
                  <option value="">-- Select Registered School Escort --</option>
                  {escorts.map((esc) => (
                    <option key={esc.id} value={esc.id}>
                      {esc.name} ({esc.phone || 'Escort'})
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-emerald-800 font-medium">
                  Allocated school escort will be assigned to this bus and automatically reflect under the City Manager Dashboard.
                </p>
              </div>

              {/* Transport Route Assignment Dropdown */}
              <div className="p-3.5 rounded-2xl bg-indigo-50/60 border border-indigo-200 space-y-2">
                <label className="font-black text-indigo-900 flex items-center gap-1.5 uppercase text-[10px] tracking-wider">
                  <MapPin size={14} className="text-indigo-600" /> Assign Transport Route (Parent Pinned / School Route)
                </label>
                <select
                  value={form.assigned_route_id}
                  onChange={(e) => {
                    const rId = e.target.value;
                    const found = routes.find((r) => r.id === rId);
                    setForm({
                      ...form,
                      assigned_route_id: rId,
                      assigned_route_name: found ? `${found.name} (${found.code})` : '',
                    });
                  }}
                  className="w-full px-3.5 py-2.5 bg-white border border-indigo-300 rounded-xl font-bold text-slate-800"
                >
                  <option value="">-- Select Transport Route --</option>
                  {routes.map((rt) => (
                    <option key={rt.id} value={rt.id}>
                      {rt.name} [{rt.code}] - {rt.directions_summary || 'Active Route Corridor'}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-indigo-800 font-medium">
                  Assigning a route links parent pinned pick-up points and route stops directly to this vehicle.
                </p>
              </div>

              {/* Driver Details Section */}
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 space-y-2.5">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">Assigned Driver Information</span>
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
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black shadow-md shadow-emerald-600/20 cursor-pointer flex items-center gap-1.5"
                >
                  <Check size={16} />
                  <span>{submitting ? 'Saving Fleet Record...' : editingVehicle ? 'Update Vehicle Record' : 'Save & Allocate Vehicle'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
