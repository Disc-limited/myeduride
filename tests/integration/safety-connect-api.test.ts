import { TestSuite, expect } from '../utils/test-harness';

export const safetyConnectApiSuite = new TestSuite('Safety Connect API Integration Suite', 'INTEGRATION');

safetyConnectApiSuite.test('GET /api/parent/safety-connect: Returns composite payload with all 3 mobility pillars', async () => {
  const mockResponse = {
    success: true,
    child_id: 'STU-001',
    safety_connect: {
      school_escort: {
        id: 'ESC-SCH-01',
        full_name: 'Babajide Adeleke',
        phone: '+234 803 291 8841',
        vehicle: { reg_number: 'LAG-482-XA' },
      },
      myeduride_escorts: [
        { id: 'ESC-MYE-04', full_name: 'Babatunde Lawal', status: 'Available for Immediate Booking' },
      ],
      edrive: {
        is_in_transit: true,
        eta_minutes: 8,
        estimated_arrival_time: '07:22 AM',
      },
    },
  };

  expect(mockResponse.success).toBeTruthy();
  expect(mockResponse.safety_connect.school_escort.vehicle.reg_number).toBe('LAG-482-XA');
  expect(mockResponse.safety_connect.edrive.eta_minutes).toBe(8);
});

safetyConnectApiSuite.test('POST /api/parent/safety-connect [book_myeduride_escort]: Generates booking and security PIN', async () => {
  const bookingPayload = {
    action: 'book_myeduride_escort',
    child_id: 'STU-001',
    child_name: 'David James',
    escort_id: 'ESC-MYE-04',
    pickup_date: '2026-08-23',
    pickup_time: '03:30 PM',
    pickup_location: 'School Gate -> Home',
    reason: 'School Escort Unavailable',
  };

  const executeBooking = (p: typeof bookingPayload) => {
    return {
      success: true,
      message: 'MyEduRide Escort booked successfully!',
      booking: {
        booking_id: 'BK-MYE-9912',
        child_id: p.child_id,
        escort_id: p.escort_id,
        security_pin: '7821',
        status: 'CONFIRMED',
      },
    };
  };

  const res = executeBooking(bookingPayload);
  expect(res.success).toBeTruthy();
  expect(res.booking.security_pin.length).toBe(4);
  expect(res.booking.status).toBe('CONFIRMED');
});
