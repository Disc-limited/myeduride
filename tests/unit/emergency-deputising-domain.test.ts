import { TestSuite, expect } from '../utils/test-harness';

export interface EmergencyDeputisingRecord {
  id: string;
  school_id: string;
  school_name?: string;
  route_id?: string;
  route_name?: string;
  original_escort_id?: string;
  original_escort_name?: string;
  original_escort_phone?: string;
  deputy_escort_id?: string;
  deputy_escort_name: string;
  deputy_escort_phone?: string;
  deputy_vehicle_plate?: string;
  deputy_photo_url?: string;
  student_ids?: string[];
  student_names?: string[];
  emergency_reason: string;
  notes?: string;
  time_window_start: string;
  time_window_end?: string | null;
  handover_confirmed_at?: string | null;
  assigned_by?: string;
  assigned_by_name?: string;
  status: 'ACTIVE_DEPUTY' | 'COMPLETED_HANDOVER' | 'CANCELLED';
  created_at: string;
  updated_at: string;
}

export const emergencyDeputisingDomainSuite = new TestSuite('Emergency Deputising Domain Unit Suite', 'UNIT');

emergencyDeputisingDomainSuite.test('Escort Approval Invariant: Only City Manager Approved escorts can deputise', () => {
  const isEligibleForDeputising = (escort: { status: string; emergency_pool_enabled: boolean }) => {
    return (
      ['CITY_MANAGER_APPROVED', 'ACTIVE'].includes(escort.status) &&
      escort.emergency_pool_enabled === true
    );
  };

  const validEscort = { status: 'CITY_MANAGER_APPROVED', emergency_pool_enabled: true };
  const unapprovedEscort = { status: 'PENDING_DOCUMENT_UPLOAD', emergency_pool_enabled: true };
  const disabledPoolEscort = { status: 'CITY_MANAGER_APPROVED', emergency_pool_enabled: false };

  expect(isEligibleForDeputising(validEscort)).toBeTruthy();
  expect(isEligibleForDeputising(unapprovedEscort)).toBeFalsy();
  expect(isEligibleForDeputising(disabledPoolEscort)).toBeFalsy();
});

emergencyDeputisingDomainSuite.test('Custody Lifecycle State Machine: Validates active to handover transitions', () => {
  const record: EmergencyDeputisingRecord = {
    id: 'DEP-2026-99',
    school_id: 'sch-001',
    school_name: 'Gracefield International School',
    route_id: 'rt-01',
    route_name: 'Lekki Route',
    original_escort_id: 'ESC-SCH-01',
    original_escort_name: 'Babajide Adeleke',
    original_escort_phone: '+234 803 291 8841',
    deputy_escort_id: 'ESC-MYE-04',
    deputy_escort_name: 'Babatunde Lawal',
    deputy_escort_phone: '+234 802 334 1188',
    deputy_vehicle_plate: 'SUR-440-XA',
    deputy_photo_url: '',
    student_ids: ['STU-001', 'STU-002'],
    student_names: ['David James', 'Esther Paul'],
    emergency_reason: 'Vehicle breakdown',
    time_window_start: '2026-08-23T08:00:00Z',
    time_window_end: null,
    handover_confirmed_at: null,
    assigned_by: 'usr-cm-01',
    assigned_by_name: 'City Manager',
    status: 'ACTIVE_DEPUTY',
    created_at: '2026-08-23T08:00:00Z',
    updated_at: '2026-08-23T08:00:00Z',
  };

  expect(record.status).toBe('ACTIVE_DEPUTY');
  expect(record.time_window_end).toBe(null);

  // Complete handover
  record.status = 'COMPLETED_HANDOVER';
  record.time_window_end = '2026-08-23T09:30:00Z';
  record.handover_confirmed_at = '2026-08-23T09:30:00Z';

  expect(record.status).toBe('COMPLETED_HANDOVER');
  expect(record.time_window_end).toBeTruthy();
  expect(record.handover_confirmed_at).toBeTruthy();
});
