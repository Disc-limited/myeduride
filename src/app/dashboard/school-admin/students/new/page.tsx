// @ts-nocheck
'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { fetchData } from '@/lib/api';
import { toast } from 'sonner';
import { ArrowLeft, CheckCircle } from 'lucide-react';
import Link from 'next/link';
import FaceCapture from '@/components/shared/FaceCapture';
import { InitialPasswordFields } from '@/components/shared/InitialPasswordFields';
import { ExistingUsernameBanner } from '@/components/shared/ExistingUsernameBanner';
import { validatePasswordPair } from '@/lib/auth/password-policy';
import { useUsernameLookup } from '@/hooks/useUsernameLookup';

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
  const { existingUser: existingParent, taken: parentUsernameTaken, checking: checkingParent } =
    useUsernameLookup(form.parent_username, {
      schoolId: schoolId || undefined,
      scope: 'parent',
    });

  // ── Parent pre-load & search ────────────────────────────────────────────────
  const [allParents, setAllParents] = useState<any[]>([]);
  const [loadingParents, setLoadingParents] = useState(false);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Derived: client-side filtered list shown in the dropdown
  const filteredParents = (() => {
    const q = form.parent_username.trim().toLowerCase();
    if (!q) return allParents;
    return allParents.filter(
      (p) =>
        (p.username || '').toLowerCase().includes(q) ||
        (p.full_name || '').toLowerCase().includes(q)
    );
  })();

  // Pre-load all parents for this school as soon as schoolId is available
  useEffect(() => {
    if (!schoolId) return;
    let cancelled = false;
    setLoadingParents(true);
    fetch(`/api/school-admin/parents/search?school_id=${schoolId}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setAllParents(data.parents || []);
      })
      .catch((err) => console.error('[PARENT PRELOAD]', err))
      .finally(() => { if (!cancelled) setLoadingParents(false); });
    return () => { cancelled = true; };
  }, [schoolId]);

  // Close dropdown when a valid parent is resolved
  useEffect(() => {
    if (existingParent && !parentUsernameTaken) {
      setShowSearchDropdown(false);
    }
  }, [existingParent, parentUsernameTaken]);

  // Click outside to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowSearchDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectParent = (parent: any) => {
    setForm((f) => ({
      ...f,
      parent_username: parent.username || '',
      parent_name: parent.full_name || f.parent_name,
      parent_phone: parent.phone || f.parent_phone,
      parent_email: parent.email || f.parent_email,
    }));
    setShowSearchDropdown(false);
  };

  useEffect(() => {
    if (!existingParent || parentUsernameTaken) return;
    setForm((f) => ({
      ...f,
      parent_username: existingParent.username,
      parent_name: existingParent.full_name || f.parent_name,
      parent_phone: existingParent.phone || f.parent_phone,
      parent_email: existingParent.email || f.parent_email,
    }));
  }, [existingParent, parentUsernameTaken]);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const schoolData = await fetchData('get_school_admin_data', { role: 'school_admin' });
      if (!schoolData.school_id) { setPageLoading(false); return; }
      setSchoolId(schoolData.school_id);
      const { classes: classData } = await fetchData('get_classes', { school_id: schoolData.school_id });
      setClasses(classData || []);
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

    let parentToUse = existingParent;
    let isTaken = parentUsernameTaken;
    const hasParent = form.parent_username?.trim() || form.parent_name?.trim() || form.parent_email?.trim();

    // Guard against race conditions when lookup is in-flight or not completed
    if (hasParent && form.parent_username?.trim() && (checkingParent || (!existingParent && !parentUsernameTaken))) {
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
      toast.error('This parent username is already in use. Choose a different username.');
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
          parent_initial_password: hasParent && !existingParent ? parentPassword : undefined,
          parent_confirm_password: hasParent && !existingParent ? parentConfirmPassword : undefined,
        }),
      });
      const result = await res.json();
      if (result.success) {
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

  const handleCSVUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    const text = await file.text();
    const rows = text.split('\n').map(r => r.split(',').map(c => c.trim()));
    const headers = rows[0].map(h => h.toLowerCase().replace(/\s+/g, '_'));
    const dataRows = rows.slice(1).filter(r => r.length >= 2 && r[0]);
    let imported = 0;
    for (const row of dataRows) {
      const record = {};
      headers.forEach((h, i) => { record[h] = row[i] || ''; });
      const res = await fetch('/api/students/create', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ school_id: schoolId, class_id: form.class_id || null, first_name: record.first_name || '', last_name: record.last_name || '', custom_fields: record }),
      });
      if (res.ok) imported++;
    }
    toast.success(`Imported ${imported} students`);
    setLoading(false);
    router.push('/dashboard/school-admin/students');
  };

  if (pageLoading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-pulse text-primary-600">Loading...</div></div>;

  return (
    <div className="p-6 min-h-screen">
      <div className="max-w-2xl mx-auto">
        <Link href="/dashboard/school-admin/students" className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-4"><ArrowLeft size={16} /> Back</Link>
        <h1 className="text-2xl font-bold mb-6">Add Student</h1>

          <div className="space-y-5">
            {/* Student Info */}
            <div className="card">
              <h2 className="font-semibold mb-3">Student Information</h2>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-medium text-gray-600 mb-1">First Name *</label><input type="text" value={form.first_name} onChange={e => setForm({...form, first_name: e.target.value})} className="input" /></div>
                <div><label className="block text-xs font-medium text-gray-600 mb-1">Last Name *</label><input type="text" value={form.last_name} onChange={e => setForm({...form, last_name: e.target.value})} className="input" /></div>
                <div className="col-span-2"><label className="block text-xs font-medium text-gray-600 mb-1">Address</label><input type="text" value={form.address} onChange={e => setForm({...form, address: e.target.value})} className="input" placeholder="Home address" /></div>
                {classes.length > 0 && (
                  <div className="col-span-2"><label className="block text-xs font-medium text-gray-600 mb-1">Class</label>
                    <select value={form.class_id} onChange={e => setForm({...form, class_id: e.target.value})} className="input">
                      <option value="">Select class...</option>
                      {classes.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.name}{c.section ? ` · Arm ${c.section}` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>

            {/* Parent Info */}
            <div className="card">
              <h2 className="font-semibold mb-3">Parent / Guardian</h2>
              <p className="text-xs text-gray-500 mb-3">
                Click the field to browse existing parents, or type to search by name or username. Select one to auto-fill — no duplicate account created.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 relative" ref={dropdownRef}>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Parent username *
                    {allParents.length > 0 && (
                      <span className="ml-2 text-[10px] font-normal text-gray-400">
                        {allParents.length} existing parent{allParents.length !== 1 ? 's' : ''} in this school
                      </span>
                    )}
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={form.parent_username}
                      onChange={(e) => {
                        setForm({ ...form, parent_username: e.target.value.toLowerCase().replace(/\s/g, '') });
                        setShowSearchDropdown(true);
                      }}
                      onFocus={() => setShowSearchDropdown(true)}
                      className="input w-full pr-8"
                      placeholder={loadingParents ? 'Loading parents…' : allParents.length > 0 ? 'Click to browse or type to search…' : 'e.g. jsmith'}
                      autoComplete="off"
                    />
                    {loadingParents && (
                      <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-300 border-t-primary-600" />
                      </div>
                    )}
                  </div>

                  {/* Dropdown: shows all parents on click, filters as user types */}
                  {showSearchDropdown && !existingParent && filteredParents.length > 0 && (
                    <div className="absolute z-10 w-full bg-white border border-gray-200 rounded-md shadow-lg mt-1 max-h-64 overflow-y-auto">
                      {form.parent_username.trim() === '' && (
                        <div className="px-4 py-2 text-[11px] text-gray-400 border-b border-gray-100 bg-gray-50 font-medium uppercase tracking-wide">
                          Existing parents — click to select
                        </div>
                      )}
                      {filteredParents.map((parent: any) => (
                        <button
                          key={parent.id}
                          type="button"
                          onMouseDown={(e) => e.preventDefault()} // keep focus in input
                          onClick={() => handleSelectParent(parent)}
                          className="w-full text-left px-4 py-2.5 hover:bg-primary-50 flex items-start justify-between gap-3 border-b border-gray-100 last:border-0 transition-colors group"
                        >
                          <div className="flex flex-col min-w-0">
                            <span className="font-semibold text-sm text-gray-900 group-hover:text-primary-700 truncate">
                              {parent.full_name || '—'}
                            </span>
                            <span className="text-[11px] text-primary-600 font-mono">@{parent.username}</span>
                            {(parent.email || parent.phone) && (
                              <span className="text-[10px] text-gray-400 mt-0.5">
                                {[parent.phone, parent.email].filter(Boolean).join('  ·  ')}
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-primary-500 opacity-0 group-hover:opacity-100 shrink-0 pt-1 transition-opacity">
                            Select ↵
                          </span>
                        </button>
                      ))}
                    </div>
                  )}

                  {showSearchDropdown && form.parent_username.trim().length >= 2 && filteredParents.length === 0 && !existingParent && !loadingParents && (
                    <div className="absolute z-10 w-full bg-white border border-gray-200 rounded-md shadow mt-1 px-4 py-3 text-sm text-gray-500">
                      No existing parent matches &ldquo;{form.parent_username}&rdquo; — a new account will be created.
                    </div>
                  )}

                  <ExistingUsernameBanner
                    user={existingParent}
                    checking={checkingParent}
                    taken={parentUsernameTaken}
                    roleHint="parent"
                  />
                </div>
                <div className="col-span-2"><label className="block text-xs font-medium text-gray-600 mb-1">Parent name</label><input type="text" value={form.parent_name} onChange={e => setForm({...form, parent_name: e.target.value})} className="input" /></div>
                <div><label className="block text-xs font-medium text-gray-600 mb-1">Parent phone</label><input type="tel" value={form.parent_phone} onChange={e => setForm({...form, parent_phone: e.target.value})} className="input" /></div>
                <div><label className="block text-xs font-medium text-gray-600 mb-1">Parent email</label><input type="email" value={form.parent_email} onChange={e => setForm({...form, parent_email: e.target.value})} className="input" /></div>
              </div>
              {(form.parent_username?.trim() || form.parent_name?.trim() || form.parent_email?.trim()) && !existingParent && (
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
              {existingParent && (
                <p className="text-xs text-gray-500 mt-3">
                  This student will be linked to the existing parent login. No new password is needed.
                </p>
              )}
            </div>

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
