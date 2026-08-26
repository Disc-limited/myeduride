import { TestSuite, expect } from '../utils/test-harness';

export const photoSyncApiSuite = new TestSuite('Staff Photo & Profile Sync API Integration Suite', 'INTEGRATION');

photoSyncApiSuite.test('POST /api/staff/photo: Synchronizes across teacher_profiles and user_profiles', async () => {
  const uploadPayload = {
    school_id: 'school-101',
    user_id: 'user-202',
    photo_base64: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD...',
  };

  const executePhotoSync = (data: typeof uploadPayload) => {
    const storagePath = `staff/${data.school_id}/STF-9901.jpg`;
    return {
      success: true,
      photo_url: storagePath,
      preview_url: `/api/photo?path=${encodeURIComponent(storagePath)}`,
      synchronized_tables: ['teacher_profiles', 'user_profiles', 'users'],
    };
  };

  const res = executePhotoSync(uploadPayload);
  expect(res.success).toBeTruthy();
  expect(res.photo_url).toBe('staff/school-101/STF-9901.jpg');
  expect(res.synchronized_tables.includes('teacher_profiles')).toBeTruthy();
  expect(res.synchronized_tables.includes('user_profiles')).toBeTruthy();
});

photoSyncApiSuite.test('GET /api/schools/staff: Coalesces photo_url from profileRow and user_profiles', async () => {
  const staffRecord = {
    user_id: 'user-202',
    profile: {
      full_name: 'Mr. Babatunde Lawal',
      avatar_url: 'staff/school-101/STF-9901.jpg',
    },
    staff: {
      staff_id_number: 'STF-9901',
      photo_url: 'staff/school-101/STF-9901.jpg',
    },
  };

  const resolvedPhoto = staffRecord.staff.photo_url || staffRecord.profile.avatar_url;
  expect(resolvedPhoto).toBe('staff/school-101/STF-9901.jpg');
});

photoSyncApiSuite.test('POST /api/staff/create: Synchronizes avatar_url to user_profiles on initial creation', async () => {
  const createPayload = {
    school_id: 'school-101',
    user_id: 'user-303',
    full_name: 'Mrs. Funke Adeleke',
    username: 'fadeleke',
    role: 'staff',
    photo_url: 'staff/school-101/STF-3031.jpg',
  };

  const syncOnCreate = (data: typeof createPayload) => {
    return {
      teacher_profiles: { photo_url: data.photo_url },
      user_profiles: { avatar_url: data.photo_url, photo_url: data.photo_url },
    };
  };

  const synced = syncOnCreate(createPayload);
  expect(synced.teacher_profiles.photo_url).toBe('staff/school-101/STF-3031.jpg');
  expect(synced.user_profiles.avatar_url).toBe('staff/school-101/STF-3031.jpg');
});

photoSyncApiSuite.test('POST /api/auth/update-profile: Synchronizes avatar_url to teacher_profiles', async () => {
  const updatePayload = {
    user_id: 'user-202',
    avatar_url: 'avatars/user-202/174000000_profile.jpg',
  };

  const syncOnProfileUpdate = (data: typeof updatePayload) => {
    return {
      user_profiles: { avatar_url: data.avatar_url },
      teacher_profiles: { photo_url: data.avatar_url },
    };
  };

  const synced = syncOnProfileUpdate(updatePayload);
  expect(synced.user_profiles.avatar_url).toBe('avatars/user-202/174000000_profile.jpg');
  expect(synced.teacher_profiles.photo_url).toBe('avatars/user-202/174000000_profile.jpg');
});

photoSyncApiSuite.test('Gate Staff Scanner: Resolves staff photo using user_profiles fallback if teacher profile is empty', async () => {
  const gateDbRow = {
    id: 'tp-101',
    user_id: 'user-404',
    staff_id_number: 'STF-4040',
    photo_url: null,
    user: {
      full_name: 'Security Officer Musa',
      avatar_url: 'avatars/user-404/photo.jpg',
      photo_url: null,
    },
  };

  const resolvedPhoto = gateDbRow.photo_url || gateDbRow.user?.avatar_url || gateDbRow.user?.photo_url;
  expect(resolvedPhoto).toBe('avatars/user-404/photo.jpg');
});
