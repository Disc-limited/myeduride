// @ts-nocheck
'use client';

import { useState, useEffect } from 'react';
import CentralPickupControl from '@/components/school-admin/CentralPickupControl';
import PickupPersonsManager from '@/components/pickup/PickupPersonsManager';
import PickupRequestsPanel from '@/components/admin/PickupRequestsPanel';
import { fetchData } from '@/lib/api';
import { Sliders, Users, Car, ChevronDown, ChevronUp } from 'lucide-react';

export default function AdminPickupPersonsPage() {
  const [schoolId, setSchoolId] = useState('');
  const [students, setStudents] = useState([]);
  const [showStaticManager, setShowStaticManager] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const schoolData = await fetchData('get_school_admin_data', { role: 'school_admin' });
        if (!schoolData.school_id) return;
        setSchoolId(schoolData.school_id);
        const { students: studs } = await fetchData('get_students', { school_id: schoolData.school_id });
        setStudents(studs || []);
      } catch (e) {
        console.error(e);
      }
    })();
  }, []);

  return (
    <div className="w-full max-w-full space-y-8">
      {/* Central Control Interface */}
      <CentralPickupControl />

      {/* Expandable Static Authorised Persons Registry Manager */}
      <div className="max-w-7xl mx-auto px-4 md:px-6">
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs overflow-hidden">
          <button
            type="button"
            onClick={() => setShowStaticManager(!showStaticManager)}
            className="w-full p-5 flex items-center justify-between hover:bg-slate-50 transition-colors text-left cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-slate-100 text-slate-700 flex items-center justify-center font-bold">
                <Sliders size={18} />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900">
                  Manage Static Authorised Pickup Persons Registry
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  Add permanent registered pickup contacts with photos or view parent emergency pickup notices.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
              <span>{showStaticManager ? 'Hide Registry Manager' : 'Expand Registry Manager'}</span>
              {showStaticManager ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </div>
          </button>

          {showStaticManager && (
            <div className="p-5 border-t border-slate-100 space-y-6 bg-slate-50/50">
              <div className="card-elevated p-5 bg-white">
                <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider mb-3">
                  Parent Pickup Requests & Emergency Notices
                </h4>
                <PickupRequestsPanel schoolId={schoolId} />
              </div>
              <div className="card-elevated p-5 bg-white">
                <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider mb-3">
                  Registered Authorised Pickup Persons
                </h4>
                <PickupPersonsManager schoolId={schoolId} mode="admin" students={students} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
