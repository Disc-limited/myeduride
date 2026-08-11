// @ts-nocheck
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { fetchData } from '@/lib/api';
import { toast } from 'sonner';
import { ArrowLeft, CheckCircle } from 'lucide-react';
import Link from 'next/link';
import FaceCapture from '@/components/shared/FaceCapture';
import { InitialPasswordFields } from '@/components/shared/InitialPasswordFields';
import { ExistingUsernameBanner } from '@/components/shared/ExistingUsernameBanner';
import { validatePasswordPair } from '@/lib/auth/password-policy';
import { useUsernameLookup, clearUsernameLookupCache } from '@/hooks/useUsernameLookup';
import ParentSelectAutocomplete from '@/components/school-admin/ParentSelectAutocomplete';
import { ParentUser, clearParentSearchCache } from '@/hooks/useParentSearch';
import { navigateBack } from '@/lib/navigation/smart-back';

export default function AddStudentPage() {
  const [classes, setClasses] = useState([]);
  const [schoolId, setSchoolId] = useState('');
  const [form, setForm] = useState({
    first_name: '', last_name: '', address: '',
    parent_username: '', parent_name: '', parent_phone: '', parent_email: '', class_id: '',
  });
  const [faceData, setFaceData] = useState({ photos: [], face_descriptor: null });
  const [parentPassword, setParentPassword] = useState('');
  const [parentConfirmPassword, setParentConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const router = useRouter();

  // Parent Search & Selection State
  const [selectedParentUser, setSelectedParentUser] = useState<ParentUser | null>(null);
  const [parentSearchQuery, setParentSearchQuery] = useState('');

  const { existingUser: existingParent, taken: parentUsernameTaken, checking: checkingParent } =
    useUsernameLookup(form.parent_username, {
      schoolId: schoolId || undefined,
      scope: 'parent',
    });

  // Effective parent reference (either selected from autocomplete or resolved by username lookup)
  const activeExistingParent = selectedParentUser || existingParent;

  const handleSelectParent = (parent: ParentUser | null) => {
    setSelectedParentUser(parent);
    if (parent) {
      setForm((f) => ({
        ...f,
        parent_username: parent.username || '',
        parent_name: parent.full_name || f.parent_name,
        parent_phone: parent.phone || f.parent_phone,
        parent_email: parent.email || f.parent_email,
      }));
    } else {
      setForm((f) => ({
        ...f,
        parent_username: '',
        parent_name: '',
        parent_phone: '',
        parent_email: '',
      }));
    }
  };

  useEffect(() => {
    clearParentSearchCache();
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const searchParams = new URLSearchParams(window.location.search);
      const urlClassId = searchParams.get('class_id');
      const schoolData = await fetchData('get_school_admin_data', { role: 'school_admin' });
      if (!schoolData.school_id) { setPageLoading(false); return; }
      setSchoolId(schoolData.school_id);
      const { classes: classData } = await fetchData('get_classes', { school_id: schoolData.school_id });
      setClasses(classData || []);
      if (urlClassId && (classData || []).some((c: any) => c.id === urlClassId)) {
        setForm((f) => ({ ...f, class_id: urlClassId }));
      } else if (classData?.length > 0) {
        setForm((f) => ({ ...f, class_id: f.class_id || classData[0].id }));
      }
    } catch (err) { console.error(err); }
    setPageLoading(false);
  };

  const handleSubmit = async () => {
    if (!form.first_name || !form.last_name) { toast.error('Name is required'); return; }
    if (faceData.photos.length > 0 && faceData.photos.length < 3) {
      toast.error('Take all 3 face photos of the student or clear photos to skip for now');
      return;
    }

    setLoading(true);

    let parentToUse = activeExistingParent;
    let isTaken = parentUsernameTaken && !selectedParentUser;
    const hasParent = form.parent_username?.trim() || form.parent_name?.trim() || form.parent_email?.trim();

    // Guard against race conditions when lookup is in-flight or not completed
    if (hasParent && form.parent_username?.trim() && !parentToUse && (checkingParent || (!existingParent && !parentUsernameTaken))) {
      try {
        const normalized = form.parent_username.toLowerCase().replace(/\s/g, '');
        const params = new URLSearchParams({ username: normalized });
        if (schoolId) params.set('school_id', schoolId);
        params.set('scope', 'parent');
        
        const res = await fetch(`/api/users/lookup-by-username?${params.toString()}`);
        if (res.ok) {
          const data = await res.json();
          parentToUse = data.found ? data.user : null;
          isTaken = !!data.taken;
        }
      } catch (err) {
        console.error('[SUBMIT LOOKUP] Race condition check failed:', err);
      }
    }

    if (hasParent && !parentToUse) {
      const pwErr = validatePasswordPair(parentPassword, parentConfirmPassword);
      if (pwErr) {
        toast.error(`Parent password: ${pwErr}`);
        setLoading(false);
        return;
      }
    }
    if (hasParent && isTaken) {
      toast.error('This parent username is already in use. Choose a different username or select the existing parent from search.');
      setLoading(false);
      return;
    }
    if (hasParent && !form.parent_username?.trim() && !form.parent_name?.trim()) {
      toast.error('Enter parent username or name');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/students/create', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          school_id: schoolId,
          class_id: form.class_id || null,
          first_name: form.first_name,
          last_name: form.last_name,
          photo_base64: faceData.photos[0] || null,
          face_descriptor: faceData.face_descriptor,
          custom_fields: {
            address: form.address,
            parent_username: form.parent_username,
            parent_name: form.parent_name,
            parent_phone: form.parent_phone,
            parent_email: form.parent_email,
          },
          parent_initial_password: hasParent && !parentToUse ? parentPassword : undefined,
          parent_confirm_password: hasParent && !parentToUse ? parentConfirmPassword : undefined,
        }),
      });

      const result = await res.json();
      if (result.success) {
        clearParentSearchCache();
        clearUsernameLookupCache();
        const id = result.student?.student_id_number || 'assigned';
        const hasPhoto = !!result.student?.photo_url;
        const linkedMsg = result.parent?.linked
          ? ` Linked to existing parent @${result.parent.username}.`
          : result.parent?.created
            ? ` Parent login: ${result.parent.username}.`
            : '';
        const warnMsg = result.parent?.warning ? ` Parent note: ${result.parent.warning}` : '';
        toast.success(
          hasPhoto
            ? `Student added with photo! ID: ${id}.${linkedMsg}${warnMsg}`
            : `Student added (ID: ${id}) — photo was not saved.${linkedMsg}${warnMsg}`
        );
        if (result.parent?.warning) {
          toast.error(result.parent.warning, { duration: 8000 });
        }
        router.push('/dashboard/school-admin/students');
      }
      else toast.error(result.error || 'Failed');
    } catch { toast.error('Failed'); }
    setLoading(false);
  };

  if (pageLoading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-pulse text-primary-600">Loading...</div></div>;

  return (
    <div className="p-6 min-h-screen">
      <div className="max-w-2xl mx-auto">
        <button
          type="button"
          onClick={() => navigateBack(router, '/dashboard/school-admin/students')}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-4 cursor-pointer"
        >
          <ArrowLeft size={16} /> Back
        </button>
        <h1 className="text-2xl font-bold mb-6">Add Student</h1>

        <div className="space-y-5">
          {/* Student Info */}
          <div className="card">
            <h2 className="font-semibold mb-3">Student Information</h2>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-xs font-medium text-gray-600 mb-1">First Name *</label><input type="text" value={form.first_name} onChange={e => setForm({...form, first_name: e.target.value})} className="input" /></div>
              <div><label className="block text-xs font-medium text-gray-600 mb-1">Last Name *</label><input type="text" value={form.last_name} onChange={e => setForm({...form, last_name: e.target.value})} className="input" /></div>
              <div className="col-span-2"><label className="block text-xs font-medium text-gray-600 mb-1">Address</label><input type="text" value={form.address} onChange={e => setForm({...form, address: e.target.value})} className="input" placeholder="Home address" /></div>
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">Classroom Arm *</label>
                {classes.length > 0 ? (
                  <select value={form.class_id} onChange={e => setForm({...form, class_id: e.target.value})} className="input text-xs">
                    <option value="">Select classroom arm...</option>
                    {classes.map(c => {
                      const tName = c.assigned_teacher?.user?.full_name || Array.isArray(c.assigned_teacher?.user) ? c.assigned_teacher?.user?.[0]?.full_name : null;
                      return (
                        <option key={c.id} value={c.id}>
                          {c.name}{c.section ? ` · Arm ${c.section}` : ''} {tName ? ` (Homeroom: ${tName})` : ' (No teacher attached)'}
                        </option>
                      );
                    })}
                  </select>
                ) : (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-center justify-between">
                    <span>No active classroom arms found.</span>
                    <Link href="/dashboard/school-admin/classes" className="font-bold underline text-amber-700 hover:text-amber-900">
                      Create Classroom
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Parent Info */}
          <div className="card">
            <h2 className="font-semibold mb-3">Parent / Guardian</h2>
            <p className="text-xs text-gray-500 mb-4">
              Search and auto-suggest existing parents by <strong>Name</strong>, <strong>Contact ID / Username</strong>, <strong>Phone Number</strong>, or <strong>Email Address</strong>. Selecting an existing parent links them without creating a duplicate account.
            </p>

            <div className="space-y-4">
              <ParentSelectAutocomplete
                schoolId={schoolId}
                selectedParent={selectedParentUser}
                onSelectParent={handleSelectParent}
                onQueryChange={setParentSearchQuery}
                queryValue={parentSearchQuery}
              />

              {!selectedParentUser && (
                <div className="border-t border-gray-100 pt-4 mt-2">
                  <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-3">
                    Parent Details (New or Manual)
                  </h3>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <label className="block text-xs font-medium text-gray-600 mb-1">Parent username *</label>
                      <input
                        type="text"
                        value={form.parent_username}
                        onChange={(e) => setForm({ ...form, parent_username: e.target.value.toLowerCase().replace(/\s/g, '') })}
                        className="input"
                        placeholder="e.g. jdoe"
                      />
                      <ExistingUsernameBanner
                        user={existingParent}
                        checking={checkingParent}
                        taken={parentUsernameTaken}
                        roleHint="parent"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs font-medium text-gray-600 mb-1">Parent name *</label>
                      <input type="text" value={form.parent_name} onChange={e => setForm({...form, parent_name: e.target.value})} className="input" placeholder="e.g. John Doe" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Parent phone</label>
                      <input type="tel" value={form.parent_phone} onChange={e => setForm({...form, parent_phone: e.target.value})} className="input" placeholder="+234..." />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Parent email</label>
                      <input type="email" value={form.parent_email} onChange={e => setForm({...form, parent_email: e.target.value})} className="input" placeholder="parent@example.com" />
                    </div>
                  </div>

                  {(form.parent_username?.trim() || form.parent_name?.trim() || form.parent_email?.trim()) && !activeExistingParent && (
                    <div className="mt-4">
                      <InitialPasswordFields
                        password={parentPassword}
                        confirmPassword={parentConfirmPassword}
                        onPasswordChange={setParentPassword}
                        onConfirmChange={setParentConfirmPassword}
                        label="Parent default password"
                        hint="Send username and password to the parent. They should change it after first login."
                      />
                    </div>
                  )}
                </div>
              )}

              {activeExistingParent && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800">
                  This student will be linked to existing parent <strong>@{activeExistingParent.username}</strong> ({activeExistingParent.full_name}). No new parent login or password is created.
                </div>
              )}
            </div>
          </div>

          {/* Student Face Capture */}
          <div className="card">
            <FaceCapture
              label="Student face & ID photo (Optional)"
              minPhotos={3}
              maxPhotos={3}
              onChange={setFaceData}
            />
            <p className="text-xs text-gray-500 mt-2">
              You can skip this step to onboard students faster and add photos later.
            </p>
          </div>

          <button onClick={handleSubmit} disabled={loading || !form.first_name || !form.last_name || (faceData.photos.length > 0 && faceData.photos.length < 3)}
            className="btn-primary w-full py-3 flex items-center justify-center gap-2">
            {loading ? 'Adding...' : 'Add Student'} <CheckCircle size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
