'use client';

import { useState } from 'react';
import { X, Calendar, CheckCircle2, Building, User, Mail, Phone, Clock } from 'lucide-react';
import { toast } from 'sonner';

interface BookDemoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function BookDemoModal({ isOpen, onClose }: BookDemoModalProps) {
  const [loading, setLoading] = useState(false);
  const [role, setRole] = useState<'school' | 'parent' | 'transport'>('school');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    organization: '',
    preferredDate: '',
    notes: '',
  });

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    setTimeout(() => {
      setLoading(false);
      toast.success('Demo Request Submitted! 🚀', {
        description: 'Our team will contact you within 24 hours to confirm your live demo session.',
      });
      onClose();
      setFormData({
        name: '',
        email: '',
        phone: '',
        organization: '',
        preferredDate: '',
        notes: '',
      });
    }, 1000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto bg-navy-950/70 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden my-8">
        
        {/* Header Ribbon */}
        <div className="bg-gradient-to-r from-navy-900 to-navy-800 p-6 text-white relative">
          <button
            onClick={onClose}
            className="absolute top-5 right-5 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-slate-300 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-green/20 text-emerald-300 text-xs font-bold mb-2">
            <Calendar className="w-3.5 h-3.5" /> Interactive Demonstration
          </div>

          <h3 className="text-2xl font-extrabold font-poppins text-white">
            Book a Live MyEduRide Demo
          </h3>
          <p className="text-xs text-slate-300 font-medium mt-1">
            See how our gate manager & real-time tracking platform can transform your institution.
          </p>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-5">
          
          {/* Role Selector Tabs */}
          <div>
            <label className="block text-xs font-extrabold uppercase text-slate-500 mb-2">
              I am interested as a:
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setRole('school')}
                className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition-all ${
                  role === 'school'
                    ? 'bg-navy-900 text-white border-navy-900 shadow-md'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                School Admin
              </button>
              <button
                type="button"
                onClick={() => setRole('parent')}
                className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition-all ${
                  role === 'parent'
                    ? 'bg-navy-900 text-white border-navy-900 shadow-md'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                Parent / Guardian
              </button>
              <button
                type="button"
                onClick={() => setRole('transport')}
                className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition-all ${
                  role === 'transport'
                    ? 'bg-navy-900 text-white border-navy-900 shadow-md'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                Transport Provider
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Full Name */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Full Name *
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                <input
                  type="text"
                  required
                  placeholder="e.g. Dr. Jane Doe"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-brand-green/30 focus:border-brand-green outline-none"
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Work Email *
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                <input
                  type="email"
                  required
                  placeholder="name@school.edu.ng"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-brand-green/30 focus:border-brand-green outline-none"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Phone */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Phone Number *
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                <input
                  type="tel"
                  required
                  placeholder="+234 800 000 0000"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-brand-green/30 focus:border-brand-green outline-none"
                />
              </div>
            </div>

            {/* School / Organization Name */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {role === 'school' ? 'School Name *' : 'Organization Name'}
              </label>
              <div className="relative">
                <Building className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                <input
                  type="text"
                  required={role === 'school'}
                  placeholder={role === 'school' ? 'e.g. St. Saviours Academy' : 'Optional'}
                  value={formData.organization}
                  onChange={(e) => setFormData({ ...formData, organization: e.target.value })}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-brand-green/30 focus:border-brand-green outline-none"
                />
              </div>
            </div>
          </div>

          {/* Preferred Date */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Preferred Demo Date
            </label>
            <div className="relative">
              <Clock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
              <input
                type="date"
                value={formData.preferredDate}
                onChange={(e) => setFormData({ ...formData, preferredDate: e.target.value })}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-brand-green/30 focus:border-brand-green outline-none"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="pt-3 flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="w-1/3 py-3 rounded-xl border border-slate-200 text-slate-700 font-bold text-sm hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="w-2/3 py-3 rounded-xl bg-brand-green hover:bg-brand-green-dark text-white font-bold text-sm shadow-lg shadow-brand-green/25 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
              {loading ? (
                <span>Scheduling...</span>
              ) : (
                <>
                  <span>Schedule Live Demo</span>
                  <CheckCircle2 className="w-4 h-4" />
                </>
              )}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}
