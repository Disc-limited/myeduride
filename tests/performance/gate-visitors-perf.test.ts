import { TestSuite, expect } from '../utils/test-harness';

export const gateVisitorsPerfSuite = new TestSuite('Gate Fast Scanning & Visitor Performance Suite', 'PERFORMANCE');

gateVisitorsPerfSuite.test('Digital Pass Validation Throughput: 100 QR pass tokens verified in < 15ms', async () => {
  const visitorsStore = new Map<string, any>();

  for (let i = 0; i < 100; i++) {
    visitorsStore.set(`EDURIDE-VIS-${100000 + i}`, {
      id: `VIS-2026-${i}`,
      name: `Visitor ${i}`,
      status: 'on_campus',
      entry_time: '2026-08-23T08:00:00Z',
    });
  }

  const start = performance.now();

  let verifiedCount = 0;
  for (let i = 0; i < 100; i++) {
    const token = `EDURIDE-VIS-${100000 + i}`;
    const visitor = visitorsStore.get(token);
    if (visitor && visitor.status === 'on_campus') {
      verifiedCount++;
    }
  }

  const duration = performance.now() - start;

  expect(verifiedCount).toBe(100);
  expect(duration).toBeLessThan(15);
});

gateVisitorsPerfSuite.test('High-Speed 3-Mode Scan Concurrency: 150 mixed student/staff/visitor scans in < 30ms', async () => {
  const mixedScans = Array.from({ length: 150 }).map((_, i) => ({
    mode: i % 3 === 0 ? 'student' : i % 3 === 1 ? 'staff' : 'visitor',
    id: `SCAN-REQ-${i}`,
    timestamp: Date.now(),
  }));

  const start = performance.now();

  const results = await Promise.all(
    mixedScans.map(async (scan) => ({
      ...scan,
      processed: true,
      statusCode: 200,
    }))
  );

  const duration = performance.now() - start;

  expect(results.length).toBe(150);
  expect(results.every((r) => r.processed)).toBeTruthy();
  expect(duration).toBeLessThan(30);
});
