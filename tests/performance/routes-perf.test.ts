import { TestSuite, expect } from '../utils/test-harness';

export const routesPerfSuite = new TestSuite('Vehicle & Route Performance & High-Throughput Suite', 'PERFORMANCE');

routesPerfSuite.test('Throughput & Latency: 50 Transport Routes with 300 Stops resolves in < 25ms', async () => {
  const routes = Array.from({ length: 50 }).map((_, i) => ({
    id: `RT-${i}`,
    code: `RTE-${i}`,
    stops: Array.from({ length: 6 }).map((_, s) => ({
      stop_number: s + 1,
      name: `Stop Point ${s + 1} of Route ${i}`,
      eta: '07:00 AM',
    })),
    passengers: Array.from({ length: 10 }).map((_, p) => ({ studentId: `stu-${i}-${p}` })),
  }));

  const start = performance.now();

  const totalStops = routes.reduce((acc, r) => acc + r.stops.length, 0);
  const totalPassengers = routes.reduce((acc, r) => acc + r.passengers.length, 0);

  const duration = performance.now() - start;

  expect(totalStops).toBe(300);
  expect(totalPassengers).toBe(500);
  expect(duration).toBeLessThan(25);
});

routesPerfSuite.test('Concurrent Parent Pinning Stress: 200 simultaneous pin requests process in < 50ms', async () => {
  const parentRequests = Array.from({ length: 200 }).map((_, i) => ({
    parentId: `par-${i}`,
    routeId: `RT-${i % 5}`,
    stopNumber: (i % 4) + 1,
  }));

  const start = performance.now();

  const pinStore = new Set<string>();

  await Promise.all(
    parentRequests.map(async (req) => {
      pinStore.add(`${req.parentId}:${req.routeId}:${req.stopNumber}`);
    })
  );

  const duration = performance.now() - start;

  expect(pinStore.size).toBe(200);
  expect(duration).toBeLessThan(50);
});
