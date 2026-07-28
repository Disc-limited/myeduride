// @ts-nocheck
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { navigateBack } from '@/lib/navigation/smart-back';
import { fetchData } from '@/lib/api';
import { ArrowLeft } from 'lucide-react';
import AddStaffForm from '@/components/school-admin/AddStaffForm';

export default function AddStaffPage() {
  const router = useRouter();
  const [schoolId, setSchoolId] = useState('');
  const [customRoles, setCustomRoles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const schoolData = await fetchData('get_school_admin_data', { role: 'school_admin' });
        if (!schoolData.school_id) {
          setLoading(false);
          return;
        }
        setSchoolId(schoolData.school_id);
        const roleRes = await fetch(`/api/school-admin/staff-roles?school_id=${schoolData.school_id}`);
        if (roleRes.ok) {
          const roleData = await roleRes.json();
          setCustomRoles(roleData.roles || []);
        }
      } catch (e) {
        console.error(e);
      }
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen md:ml-56 pt-14 md:pt-6 p-6 flex items-center justify-center">
        <div className="animate-pulse text-primary-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="p-6 min-h-screen md:ml-56 pt-14 md:pt-6 max-w-lg">
      <button
        type="button"
        onClick={() => navigateBack(router, '/dashboard/school-admin/staff')}
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-primary-700 mb-4 cursor-pointer"
      >
        <ArrowLeft size={16} /> Back to staff list
      </button>
      <h1 className="text-2xl font-bold text-slate-900 mb-1">Add staff</h1>
      <p className="text-sm text-slate-500 mb-6">Create a new staff member. Job roles are managed on the staff list page.</p>
      <AddStaffForm
        schoolId={schoolId}
        customRoles={customRoles}
        onCancel={() => window.history.back()}
      />
    </div>
  );
}
