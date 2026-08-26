import { TestSuite, expect } from '../utils/test-harness';
import { photoSrc } from '../../src/lib/photo';

export const photoPerfSuite = new TestSuite('Photo Resolution & High-Throughput Performance Suite', 'PERFORMANCE');

photoPerfSuite.test('Throughput & Latency: 500 Mixed Photo URLs resolved in < 30ms', async () => {
  const photoInputs = [
    'data:image/jpeg;base64,9j4AAQSkZJRg...',
    '/images/default-avatar.png',
    'https://res.cloudinary.com/demo/image/upload/v12345/avatar.jpg',
    'https://xyz.supabase.co/storage/v1/object/public/photos/staff/school_1/STF-01.jpg',
    'staff/school_1/STF-02.jpg',
    'students/STU-100.jpg',
    null,
    '',
  ];

  const start = performance.now();

  let resolvedCount = 0;
  for (let i = 0; i < 500; i++) {
    const input = photoInputs[i % photoInputs.length];
    const src = photoSrc(input);
    if (src !== undefined) resolvedCount++;
  }

  const duration = performance.now() - start;

  expect(resolvedCount).toBe(500);
  expect(duration).toBeLessThan(30);
});

photoPerfSuite.test('Concurrent Avatar Rendering: 200 concurrent avatar lookups process in < 20ms', async () => {
  const avatarList = Array.from({ length: 200 }).map((_, i) => ({
    id: `user-${i}`,
    photoUrl: i % 2 === 0 ? `staff/sch_1/STF-${i}.jpg` : `https://res.cloudinary.com/demo/avatar-${i}.jpg`,
  }));

  const start = performance.now();

  const renderedList = await Promise.all(
    avatarList.map(async (a) => ({
      id: a.id,
      src: photoSrc(a.photoUrl),
    }))
  );

  const duration = performance.now() - start;

  expect(renderedList.length).toBe(200);
  expect(renderedList.every((r) => !!r.src)).toBeTruthy();
  expect(duration).toBeLessThan(20);
});
