import { TestSuite, expect } from '../utils/test-harness';
import { photoSrc, extractStoragePath } from '../../src/lib/photo';

export const photoResolutionUnitSuite = new TestSuite('Universal Photo Resolution Unit Suite', 'UNIT');

photoResolutionUnitSuite.test('Data URI Passthrough: Renders base64 data URIs directly without mangling', () => {
  const dataUri = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD...';
  const result = photoSrc(dataUri);
  expect(result).toBe(dataUri);
});

photoResolutionUnitSuite.test('Local App Asset Passthrough: Serves static local paths directly', () => {
  const localAsset = '/images/default-avatar.png';
  const result = photoSrc(localAsset);
  expect(result).toBe(localAsset);
});

photoResolutionUnitSuite.test('External CDN Passthrough: Preserves Cloudinary, Unsplash & Google avatar URLs', () => {
  const cloudinaryUrl = 'https://res.cloudinary.com/demo/image/upload/v12345/sample.jpg';
  const googleAvatar = 'https://lh3.googleusercontent.com/a/ACg8ocK...';

  expect(photoSrc(cloudinaryUrl)).toBe(cloudinaryUrl);
  expect(photoSrc(googleAvatar)).toBe(googleAvatar);
});

photoResolutionUnitSuite.test('Supabase Storage Path Extraction: Correctly transforms storage paths and public URLs', () => {
  const relativePath = 'staff/school_101/STF-001.jpg';
  const publicUrl = 'https://xyz.supabase.co/storage/v1/object/public/photos/staff/school_101/STF-001.jpg';
  const signedUrl = 'https://xyz.supabase.co/storage/v1/object/sign/photos/staff/school_101/STF-001.jpg?token=secret123';

  expect(photoSrc(relativePath)).toBe('/api/photo?path=staff%2Fschool_101%2FSTF-001.jpg');
  expect(photoSrc(publicUrl)).toBe('/api/photo?path=staff%2Fschool_101%2FSTF-001.jpg');
  expect(photoSrc(signedUrl)).toBe('/api/photo?path=staff%2Fschool_101%2FSTF-001.jpg');
});

photoResolutionUnitSuite.test('Null & Empty Safety: Returns null for empty, undefined, or whitespace-only inputs', () => {
  expect(photoSrc(null)).toBe(null);
  expect(photoSrc(undefined)).toBe(null);
  expect(photoSrc('')).toBe(null);
  expect(photoSrc('   ')).toBe(null);
});
