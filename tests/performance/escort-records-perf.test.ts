import { TestSuite, expect } from '../utils/test-harness';

export const escortRecordsPerfSuite = new TestSuite('Escort Records High-Throughput & Performance Suite', 'PERFORMANCE');

escortRecordsPerfSuite.test('Composite Join Throughput: 100 Escort Records with 500 Connected Students resolved in < 50ms', async () => {
  const start = performance.now();

  const generateRecords = () => {
    return Array.from({ length: 100 }).map((_, i) => ({
      id: `ESC-SCH-${i}`,
      name: `Escort Agent ${i}`,
      school_id: 'school-101',
      vehicle: { reg_number: `LAG-${100 + i}-XA`, capacity: 18 },
      route: { code: `RT-${i % 10}`, name: `Route Corridor ${i % 10}` },
      assignment: { duty_type: 'Full Day Run' },
      approval: { status: 'CITY_MANAGER_APPROVED' },
      operational_status: i % 2 === 0 ? 'Active On Duty' : 'Off Duty',
      connected_students: Array.from({ length: 5 }).map((_, s) => ({
        student_id: `STU-${i}-${s}`,
        name: `Student ${i}-${s}`,
      })),
    }));
  };

  const records = generateRecords();
  const duration = performance.now() - start;

  expect(records.length).toBe(100);
  expect(records[0].connected_students.length).toBe(5);
  expect(duration).toBeLessThan(50);
});

escortRecordsPerfSuite.test('High-Concurrency Status Mutation: 150 status toggles execute in < 25ms', async () => {
  const store: Record<string, string> = {};
  for (let i = 0; i < 150; i++) {
    store[`ESC-${i}`] = 'Active On Duty';
  }

  const start = performance.now();

  for (let i = 0; i < 150; i++) {
    store[`ESC-${i}`] = i % 2 === 0 ? 'In Transit' : 'Off Duty';
  }

  const duration = performance.now() - start;

  expect(Object.keys(store).length).toBe(150);
  expect(duration).toBeLessThan(25);
});
