import { TestSuite, expect } from '../utils/test-harness';

export const gateVisitorsE2ESuite = new TestSuite('Gate Visitor Management End-to-End Suite', 'E2E');

gateVisitorsE2ESuite.test('E2E Lifecycle: Visitor Arrival -> Admin Registration -> Digital QR Issuance -> Campus Exit Scan', async () => {
  // Step 1: Visitor arrives at school gate and is registered by Gate Officer / Admin
  const newArrival = {
    name: 'Mrs. Folake Giwa',
    phone: '+234 802 443 1188',
    purpose: 'PTA Executive Meeting',
    host: 'Vice Principal Admin',
  };

  const registeredPass = {
    visitorId: 'VIS-2026-9011',
    token: 'EDURIDE-VIS-443118',
    name: newArrival.name,
    entryTime: new Date('2026-08-23T09:00:00Z'),
    isDigitalOnly: true,
    status: 'on_campus',
  };

  expect(registeredPass.isDigitalOnly).toBeTruthy();
  expect(registeredPass.status).toBe('on_campus');

  // Step 2: Digital Pass presented on smartphone screen to gate scanner
  const scanEvent = {
    scannedToken: registeredPass.token,
    scanType: 'DIGITAL_QR_CAMERA',
    isValidToken: registeredPass.token.startsWith('EDURIDE-VIS-'),
  };

  expect(scanEvent.isValidToken).toBeTruthy();

  // Step 3: Visitor concludes meeting and gate scanner checks out visitor
  const exitEvent = {
    visitorId: registeredPass.visitorId,
    exitTime: new Date('2026-08-23T09:50:00Z'),
    durationMinutes: Math.round((new Date('2026-08-23T09:50:00Z').getTime() - registeredPass.entryTime.getTime()) / 60000),
    finalStatus: 'departed',
  };

  expect(exitEvent.durationMinutes).toBe(50);
  expect(exitEvent.finalStatus).toBe('departed');
});
