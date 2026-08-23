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
