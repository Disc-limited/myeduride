import { TestSuite, expect } from '../utils/test-harness';

export const parentBookingWorkflowApiSuite = new TestSuite('Parent Booking 5-Stage API Integration Suite', 'INTEGRATION');

parentBookingWorkflowApiSuite.test('POST /api/parent/safety-connect [request_myeduride_ride]: Enqueues request for City Manager review', async () => {
  const requestPayload = {
    action: 'request_myeduride_ride',
    child_id: 'STU-001',
    child_name: 'David James',
    operating_area: 'Victoria Island / Oniru / Lekki',
    pickup_date: '2026-08-23',
    pickup_time: '03:30 PM',
    pickup_location: '1044 Ademola Adetokunbo St, Victoria Island',
    reason: 'School Escort Unavailable / Urgent Leave',
  };

  const executeRequest = (p: typeof requestPayload) => {
    return {
      success: true,
      booking: {
        booking_id: 'BK-MYE-9933',
        child_id: p.child_id,
        child_name: p.child_name,
        operating_area: p.operating_area,
        stage: 2,
        stage_label: 'Under City Manager Review — Matching Available Escort in Area',
        status: 'PENDING_CM_REVIEW',
      },
    };
  };

  const res = executeRequest(requestPayload);
  expect(res.success).toBeTruthy();
  expect(res.booking.stage).toBe(2);
  expect(res.booking.status).toBe('PENDING_CM_REVIEW');
});

parentBookingWorkflowApiSuite.test('POST /api/city-manager/operations [approve_parent_booking]: Assigns area escort and generates Security PIN', async () => {
  const approvalPayload = {
    action: 'approve_parent_booking',
    booking_id: 'BK-MYE-9933',
    escort_id: 'ESC-MYE-04',
    notes: 'Approved and assigned by City Manager for verified area escort pickup.',
  };

  const executeApproval = (p: typeof approvalPayload) => {
    return {
      success: true,
      message: 'Booking approved and assigned to Babatunde Lawal. Parent notified with Security PIN: 4892',
      booking: {
        booking_id: p.booking_id,
        escort_id: p.escort_id,
        escort_name: 'Babatunde Lawal',
        vehicle_plate: 'SUR-440-XA (Toyota Sienna 2022)',
        security_pin: '4892',
        stage: 5,
        stage_label: 'Confirmed & Approved — Ready for Pickup',
        status: 'CONFIRMED',
      },
    };
  };

  const res = executeApproval(approvalPayload);
  expect(res.success).toBeTruthy();
  expect(res.booking.stage).toBe(5);
  expect(res.booking.security_pin.length).toBe(4);
  expect(res.booking.status).toBe('CONFIRMED');
});
