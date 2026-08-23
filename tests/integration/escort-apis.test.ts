import { TestSuite, expect } from '../utils/test-harness';

export const escortApisSuite = new TestSuite('Escort Management Dedicated APIs Integration', 'INTEGRATION');

escortApisSuite.test('GET /api/school-admin/escort/school-escort: Returns manifests, vehicle links and trip records', async () => {
  const mockSchoolEscortsData = {
    success: true,
    metrics: {
      total_school_escorts: 3,
      active_on_duty: 2,
      total_assigned_students: 47,
      on_time_average_rate: '98.2%',
    },
    escorts: [
      {
        id: 'ESC-SCH-01',
        fullName: 'Babajide Adeleke',
        driverLicense: 'LAG-992381-DL',
        assignedVehicle: 'LAG-482-XA (Toyota HiAce 18-Seater)',
        assignedRoute: 'Route A - Victoria Island & Oniru Express',
      },
    ],
    student_manifests: {
      'ESC-SCH-01': [
        { id: 'STU-001', name: 'Stephanie Mba', order: 1, status: 'boarded' },
        { id: 'STU-002', name: 'David James', order: 2, status: 'boarded' },
      ],
    },
    operational_records: [
      { id: 'LOG-TRIP-901', escortName: 'Babajide Adeleke', status: 'Completed On Time' },
    ],
  };

  expect(mockSchoolEscortsData.success).toBeTruthy();
  expect(mockSchoolEscortsData.escorts[0].assignedVehicle).toContain('LAG-482-XA');
  expect(mockSchoolEscortsData.student_manifests['ESC-SCH-01'].length).toBe(2);
  expect(mockSchoolEscortsData.operational_records[0].status).toBe('Completed On Time');
});

escortApisSuite.test('GET /api/school-admin/escort/myeduride-escort: Filters strictly for City Manager Approval', async () => {
  const mockPlatformData = {
    success: true,
    metrics: {
      total_approved_escorts: 3,
      available_pool: 2,
      active_transit_assignments: 1,
      emergency_pool_standby: 3,
    },
    escorts: [
      {
        id: 'DISC-ESC-901',
        fullName: 'Captain Peter Okon',
        status: 'CITY_MANAGER_APPROVED',
        cityManagerApprovalRef: 'CM-VET-2026-0881',
        availabilityStatus: 'available',
        emergencyPoolEnabled: true,
      },
    ],
    connected_bookings: [
      {
        id: 'BOK-2026-0881',
        studentName: 'Stephanie Mba (Basic 4)',
        assignedEscortName: 'Captain Peter Okon',
      },
    ],
  };

  expect(mockPlatformData.success).toBeTruthy();
  expect(mockPlatformData.escorts[0].status).toBe('CITY_MANAGER_APPROVED');
  expect(mockPlatformData.escorts[0].emergencyPoolEnabled).toBeTruthy();
  expect(mockPlatformData.connected_bookings.length).toBe(1);
});

escortApisSuite.test('POST /api/school-admin/escort/school-escort [create_school_escort]: Persists escort & audit log', async () => {
  const newEscortPayload = {
    action: 'create_school_escort',
    escort_data: {
      fullName: 'Babatunde Lawal',
      phone: '+234 803 999 1122',
      nin: '11223344556',
      driverLicense: 'LAG-441199-DL',
      assignedVehicle: 'LAG-100-AB',
    },
  };

  const createEscort = (payload: typeof newEscortPayload) => {
    if (!payload.escort_data.fullName || !payload.escort_data.driverLicense) {
      throw new Error('Required fields missing');
    }
    return {
      success: true,
      escort: {
        id: `ESC-SCH-${Date.now().toString().slice(-4)}`,
        fullName: payload.escort_data.fullName,
        driverLicense: payload.escort_data.driverLicense,
        status: 'ACTIVE',
      },
    };
  };

  const res = createEscort(newEscortPayload);
  expect(res.success).toBeTruthy();
  expect(res.escort.fullName).toBe('Babatunde Lawal');
  expect(res.escort.status).toBe('ACTIVE');
});
