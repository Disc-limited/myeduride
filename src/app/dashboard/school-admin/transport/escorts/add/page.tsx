// @ts-nocheck
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ShieldCheck,
  User,
  Mail,
  Phone,
  Calendar,
  FileText,
  MapPin,
  Car,
  Camera,
  Upload,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Compass,
  Check
} from 'lucide-react';
import { toast } from 'sonner';

export default function AddSchoolEscortPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    // Step 1: Personal Information
    fullName: '',
    emailOrUsername: '',
    phone: '',
    dob: '',
    gender: 'Male',
    photo: '',

    // Step 2: Verification Credentials
    nin: '',
    driversLicence: '',
    driversLicenceDocUrl: '',
    idDocumentType: 'NIN Slip',

    // Step 3: Address & Pinned GPS
    address: '',
    city: 'Lagos',
    state: 'Lagos',
    pinnedGpsLocation: {
      lat: 6.5244,
      lng: 3.3792,
      address: '',
    },

    // Step 4: Vehicle Details
    hasVehicle: true,
    vehicleType: 'Hiace Bus (18 Seater)',
    make: 'Toyota',
    model: 'Hiace',
    color: 'White',
    year: '2020',
    regNumber: '',
    seatCapacity: '18',

    // Step 5: Vehicle Photographs
    vehiclePhotos: {
      front: '',
      rear: '',
      doorSide: '',
    },
  });

  // Handle Field Updates
  const handleChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleVehiclePhotoChange = (key: 'front' | 'rear' | 'doorSide', url: string) => {
    setFormData((prev) => ({
      ...prev,
      vehiclePhotos: { ...prev.vehiclePhotos, [key]: url },
    }));
  };

  // Browser GPS Location Pinning Handler
  const handlePinGpsLocation = () => {
    if ('geolocation' in navigator) {
      toast.loading('Acquiring current GPS location...');
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          toast.dismiss();
          const lat = parseFloat(pos.coords.latitude.toFixed(6));
          const lng = parseFloat(pos.coords.longitude.toFixed(6));
          const resolvedAddr = `${lat}, ${lng} (Pinned GPS Location)`;
          setFormData((prev) => ({
            ...prev,
            pinnedGpsLocation: { lat, lng, address: resolvedAddr },
          }));
          toast.success(`Home GPS Location Pinned: ${lat}, ${lng}`);
        },
        (err) => {
          toast.dismiss();
          if (err.code === 1) {
            toast.error('Location permission denied. Please allow location access in your browser settings.');
          } else {
            toast.error(`GPS acquisition failed: ${err.message}. Using default city coordinates.`);
          }
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    } else {
      toast.error('Geolocation is not supported by your browser.');
    }
  };

  // Fake Photo Uploader Helper (Creates Data URI or mock URL)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, targetField: string, isVehiclePhoto = false) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      if (isVehiclePhoto) {
        handleVehiclePhotoChange(targetField as any, result);
      } else {
        handleChange(targetField, result);
      }
      toast.success('Document photograph uploaded successfully.');
    };
    reader.readAsDataURL(file);
  };

  // Form Submit Handler
  const handleSubmit = async () => {
    if (!formData.fullName.trim()) {
      toast.error('Please enter Escort Full Name.');
      setCurrentStep(1);
      return;
    }
    if (!formData.emailOrUsername.trim()) {
      toast.error('Please enter Escort Contact Email or Username.');
      setCurrentStep(1);
      return;
    }
    if (!formData.phone.trim()) {
      toast.error('Please enter Escort Phone Number.');
      setCurrentStep(1);
      return;
    }

    setSubmitting(true);
    toast.loading('Initiating School Escort record & routing to City Manager...');

    try {
      const res = await fetch('/api/school-admin/escorts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      toast.dismiss();

      if (res.ok && data.success) {
        toast.success('School Escort created! Application routed to City Manager for vetting.');
        router.push('/dashboard/school-admin/transport/escorts');
      } else {
        toast.error(data.error || 'Failed to create School Escort');
      }
    } catch (err: any) {
      toast.dismiss();
      toast.error('Network error creating School Escort record.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 font-sans text-slate-800 p-4 md:p-6 max-w-5xl mx-auto">
      {/* Back Link & Header */}
      <div className="flex items-center justify-between">
        <Link
          href="/dashboard/school-admin/transport/escorts"
          className="text-xs font-extrabold text-slate-600 hover:text-slate-900 flex items-center gap-1.5 transition-all"
        >
          <ArrowLeft size={16} /> Back to Escorts Directory
        </Link>
        <span className="px-3 py-1 rounded-full bg-amber-100 text-amber-900 text-[11px] font-extrabold border border-amber-300">
          Vetting: City Manager Approval Required
        </span>
      </div>

      <div className="bg-white p-6 rounded-3xl border border-slate-200/90 shadow-sm space-y-6">
        <div>
          <h1 className="text-xl md:text-2xl font-black text-slate-900">
            Add School Escort — Initiated by School
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Fill in the escort credentials. Upon creation, the profile is automatically routed to the responsible <strong>City Manager for vetting</strong>.
          </p>
        </div>

        {/* Wizard Stepper Progress Bar */}
        <div className="grid grid-cols-5 gap-2 text-center text-xs font-bold border-b border-slate-100 pb-4">
          {[
            { step: 1, label: '1. Personal Info' },
            { step: 2, label: '2. Credentials' },
            { step: 3, label: '3. Address & GPS' },
            { step: 4, label: '4. Vehicle Specs' },
            { step: 5, label: '5. Vehicle Photos' },
          ].map((item) => (
            <button
              key={item.step}
              onClick={() => setCurrentStep(item.step)}
              className={`py-2 px-1 rounded-xl transition-all ${
                currentStep === item.step
                  ? 'bg-[#00A859] text-white shadow-md'
                  : currentStep > item.step
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-slate-100 text-slate-400'
              }`}
            >
              <span className="truncate block">{item.label}</span>
            </button>
          ))}
        </div>

        {/* STEP 1: Personal Details */}
        {currentStep === 1 && (
          <div className="space-y-5">
            <h3 className="font-extrabold text-slate-900 text-sm uppercase tracking-wider border-b border-slate-100 pb-2">
              Step 1: Escort Personal Details & Photo
            </h3>

            {/* Profile Photo Uploader */}
            <div className="flex flex-col sm:flex-row items-center gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <img
                src={formData.photo || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'}
                alt="Escort Preview"
                className="w-20 h-20 rounded-2xl object-cover border-2 border-emerald-500 shadow-md shrink-0"
              />
              <div className="space-y-1 text-center sm:text-left">
                <h4 className="font-extrabold text-slate-900 text-xs">Escort Profile Photograph</h4>
                <p className="text-[11px] text-slate-500">Upload a clear front-facing passport photograph or selfie.</p>
                <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-600 text-white font-extrabold text-xs cursor-pointer hover:bg-emerald-700 transition-all mt-1">
                  <Camera size={14} /> Upload Photograph
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileUpload(e, 'photo')} />
                </label>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-extrabold text-slate-700 block mb-1">Full Name *</label>
                <input
                  type="text"
                  value={formData.fullName}
                  onChange={(e) => handleChange('fullName', e.target.value)}
                  placeholder="e.g. Babatunde Ogunleye"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-xs font-extrabold text-slate-700 block mb-1">Contact Email / Username *</label>
                <input
                  type="email"
                  value={formData.emailOrUsername}
                  onChange={(e) => handleChange('emailOrUsername', e.target.value)}
                  placeholder="e.g. escort.babatunde@school.com"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-xs font-extrabold text-slate-700 block mb-1">Phone Number *</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => handleChange('phone', e.target.value)}
                  placeholder="e.g. 08031234567"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-xs font-extrabold text-slate-700 block mb-1">Date of Birth</label>
                <input
                  type="date"
                  value={formData.dob}
                  onChange={(e) => handleChange('dob', e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-xs font-extrabold text-slate-700 block mb-1">Gender</label>
                <select
                  value={formData.gender}
                  onChange={(e) => handleChange('gender', e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium focus:outline-none focus:border-emerald-500"
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: Verification Credentials */}
        {currentStep === 2 && (
          <div className="space-y-5">
            <h3 className="font-extrabold text-slate-900 text-sm uppercase tracking-wider border-b border-slate-100 pb-2">
              Step 2: Verification Credentials & NIN
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-extrabold text-slate-700 block mb-1">National Identity Number (NIN)</label>
                <input
                  type="text"
                  value={formData.nin}
                  onChange={(e) => handleChange('nin', e.target.value)}
                  placeholder="e.g. 12345678901"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-xs font-extrabold text-slate-700 block mb-1">Driver's Licence Number</label>
                <input
                  type="text"
                  value={formData.driversLicence}
                  onChange={(e) => handleChange('driversLicence', e.target.value)}
                  placeholder="e.g. KJA987654321"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            {/* Document File Uploader */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
              <h4 className="font-extrabold text-slate-900 text-xs">Driver's Licence / NIN Document Upload</h4>
              <p className="text-[11px] text-slate-500">Upload a scan or clear photo of the Driver's Licence or NIN Card.</p>
              <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800 text-white font-extrabold text-xs cursor-pointer hover:bg-slate-900 transition-all">
                <Upload size={14} /> Upload Licence Document
                <input type="file" accept="image/*,.pdf" className="hidden" onChange={(e) => handleFileUpload(e, 'driversLicenceDocUrl')} />
              </label>
              {formData.driversLicenceDocUrl && (
                <span className="text-[11px] text-emerald-600 font-extrabold block">✓ Document Attached</span>
              )}
            </div>
          </div>
        )}

        {/* STEP 3: Address & Pinned Home GPS */}
        {currentStep === 3 && (
          <div className="space-y-5">
            <h3 className="font-extrabold text-slate-900 text-sm uppercase tracking-wider border-b border-slate-100 pb-2">
              Step 3: Home Address & Pinned GPS Location
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-3">
                <label className="text-xs font-extrabold text-slate-700 block mb-1">Home Address</label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => handleChange('address', e.target.value)}
                  placeholder="e.g. 14 Greenfield Estate, Ikeja, Lagos"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-xs font-extrabold text-slate-700 block mb-1">City</label>
                <input
                  type="text"
                  value={formData.city}
                  onChange={(e) => handleChange('city', e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-xs font-extrabold text-slate-700 block mb-1">State</label>
                <input
                  type="text"
                  value={formData.state}
                  onChange={(e) => handleChange('state', e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            {/* Interactive GPS Pin Card */}
            <div className="bg-emerald-50/80 p-4 rounded-2xl border border-emerald-200 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MapPin className="text-emerald-600" size={20} />
                  <div>
                    <h4 className="font-extrabold text-emerald-950 text-xs">Pinned Home GPS Location</h4>
                    <p className="text-[11px] text-emerald-800">Pin exact home GPS coordinates for transport route optimization.</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handlePinGpsLocation}
                  className="px-3.5 py-2 rounded-xl bg-[#00A859] hover:bg-emerald-600 text-white font-extrabold text-xs transition-all shadow-md flex items-center gap-1.5 cursor-pointer shrink-0"
                >
                  <Compass size={14} /> Pin Current GPS
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs bg-white p-3 rounded-xl border border-emerald-100">
                <div>
                  <span className="text-slate-400 text-[10px] font-bold uppercase block">Latitude</span>
                  <span className="font-mono font-bold text-slate-800">{formData.pinnedGpsLocation.lat}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] font-bold uppercase block">Longitude</span>
                  <span className="font-mono font-bold text-slate-800">{formData.pinnedGpsLocation.lng}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 4: Vehicle Details */}
        {currentStep === 4 && (
          <div className="space-y-5">
            <h3 className="font-extrabold text-slate-900 text-sm uppercase tracking-wider border-b border-slate-100 pb-2">
              Step 4: Vehicle Information (Where Applicable)
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-extrabold text-slate-700 block mb-1">Vehicle Type</label>
                <select
                  value={formData.vehicleType}
                  onChange={(e) => handleChange('vehicleType', e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium focus:outline-none focus:border-emerald-500"
                >
                  <option value="Hiace Bus (18 Seater)">Hiace Bus (18 Seater)</option>
                  <option value="Coaster Bus (30 Seater)">Coaster Bus (30 Seater)</option>
                  <option value="Mini-Van (7 Seater)">Mini-Van (7 Seater)</option>
                  <option value="Sedan Car">Sedan Car</option>
                  <option value="Tricycle">Tricycle</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-extrabold text-slate-700 block mb-1">Registration Plate Number (e.g. KJA 123 XY)</label>
                <input
                  type="text"
                  value={formData.regNumber}
                  onChange={(e) => handleChange('regNumber', e.target.value)}
                  placeholder="e.g. KJA 123 XY"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium focus:outline-none focus:border-emerald-500 uppercase font-mono font-bold"
                />
              </div>

              <div>
                <label className="text-xs font-extrabold text-slate-700 block mb-1">Vehicle Make</label>
                <input
                  type="text"
                  value={formData.make}
                  onChange={(e) => handleChange('make', e.target.value)}
                  placeholder="Toyota"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-xs font-extrabold text-slate-700 block mb-1">Vehicle Model</label>
                <input
                  type="text"
                  value={formData.model}
                  onChange={(e) => handleChange('model', e.target.value)}
                  placeholder="Hiace"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-xs font-extrabold text-slate-700 block mb-1">Vehicle Color</label>
                <input
                  type="text"
                  value={formData.color}
                  onChange={(e) => handleChange('color', e.target.value)}
                  placeholder="White"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-xs font-extrabold text-slate-700 block mb-1">Seat Capacity</label>
                <input
                  type="number"
                  value={formData.seatCapacity}
                  onChange={(e) => handleChange('seatCapacity', e.target.value)}
                  placeholder="18"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>
          </div>
        )}

        {/* STEP 5: Vehicle Photographs */}
        {currentStep === 5 && (
          <div className="space-y-5">
            <h3 className="font-extrabold text-slate-900 text-sm uppercase tracking-wider border-b border-slate-100 pb-2">
              Step 5: Vehicle Photographs (Front, Rear, Door-Side)
            </h3>

            <p className="text-xs text-slate-500">
              Upload clear photographs of the vehicle from front, rear, and door-side angles for verification by the City Manager.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Front Photo */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3 text-center">
                <span className="font-extrabold text-slate-800 text-xs block">1. Front Photograph</span>
                {formData.vehiclePhotos.front ? (
                  <img src={formData.vehiclePhotos.front} alt="Front Vehicle" className="w-full h-32 rounded-xl object-cover border" />
                ) : (
                  <div className="w-full h-32 rounded-xl bg-slate-100 flex flex-col items-center justify-center text-slate-400 border border-dashed border-slate-300">
                    <Car size={28} />
                    <span className="text-[10px] mt-1 font-semibold">Front View</span>
                  </div>
                )}
                <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 text-white font-extrabold text-xs cursor-pointer hover:bg-slate-900 transition-all">
                  <Camera size={14} /> Upload Front
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileUpload(e, 'front', true)} />
                </label>
              </div>

              {/* Rear Photo */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3 text-center">
                <span className="font-extrabold text-slate-800 text-xs block">2. Rear Photograph</span>
                {formData.vehiclePhotos.rear ? (
                  <img src={formData.vehiclePhotos.rear} alt="Rear Vehicle" className="w-full h-32 rounded-xl object-cover border" />
                ) : (
                  <div className="w-full h-32 rounded-xl bg-slate-100 flex flex-col items-center justify-center text-slate-400 border border-dashed border-slate-300">
                    <Car size={28} />
                    <span className="text-[10px] mt-1 font-semibold">Rear View</span>
                  </div>
                )}
                <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 text-white font-extrabold text-xs cursor-pointer hover:bg-slate-900 transition-all">
                  <Camera size={14} /> Upload Rear
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileUpload(e, 'rear', true)} />
                </label>
              </div>

              {/* Door Side Photo */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3 text-center">
                <span className="font-extrabold text-slate-800 text-xs block">3. Door-Side Photograph</span>
                {formData.vehiclePhotos.doorSide ? (
                  <img src={formData.vehiclePhotos.doorSide} alt="Door Side Vehicle" className="w-full h-32 rounded-xl object-cover border" />
                ) : (
                  <div className="w-full h-32 rounded-xl bg-slate-100 flex flex-col items-center justify-center text-slate-400 border border-dashed border-slate-300">
                    <Car size={28} />
                    <span className="text-[10px] mt-1 font-semibold">Door Side View</span>
                  </div>
                )}
                <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 text-white font-extrabold text-xs cursor-pointer hover:bg-slate-900 transition-all">
                  <Camera size={14} /> Upload Door Side
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileUpload(e, 'doorSide', true)} />
                </label>
              </div>
            </div>
          </div>
        )}

        {/* Wizard Footer Controls */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-100">
          {currentStep > 1 ? (
            <button
              type="button"
              onClick={() => setCurrentStep((prev) => prev - 1)}
              className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <ArrowLeft size={16} /> Previous
            </button>
          ) : <div />}

          {currentStep < 5 ? (
            <button
              type="button"
              onClick={() => setCurrentStep((prev) => prev + 1)}
              className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-black text-white font-extrabold text-xs transition-all flex items-center gap-1.5 cursor-pointer"
            >
              Next Step <ArrowRight size={16} />
            </button>
          ) : (
            <button
              type="button"
              disabled={submitting}
              onClick={handleSubmit}
              className="px-6 py-3 rounded-2xl bg-[#00A859] hover:bg-emerald-600 text-white font-black text-xs transition-all shadow-lg shadow-emerald-600/30 flex items-center gap-2 cursor-pointer"
            >
              <CheckCircle2 size={18} />
              <span>Submit for City Manager Vetting</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
