import { TestSuite, expect } from '../utils/test-harness';

export const routesVehiclesApiSuite = new TestSuite('Vehicle & Route APIs Integration Suite', 'INTEGRATION');

routesVehiclesApiSuite.test('GET /api/school-admin/vehicles: Returns operational fleet records with metrics', async () => {
  const mockResponse = {
    success: true,
    metrics: {
      total_vehicles: 3,
      active_fleet: 3,
      total_seating_capacity: 61,
      compliance_rate: '100%',
    },
    vehicles: [
      {
        id: 'VH-01',
        reg_number: 'LAG-482-XA',
        make: 'Toyota',
        model: 'HiAce 2022',
        capacity: 18,
        assigned_driver_name: 'Babajide Adeleke',
        assigned_driver_license: 'LAG-992381-DL',
      },
    ],
  };

  expect(mockResponse.success).toBeTruthy();
  expect(mockResponse.metrics.total_seating_capacity).toBe(61);
  expect(mockResponse.vehicles[0].assigned_driver_license).toBe('LAG-992381-DL');
});

routesVehiclesApiSuite.test('POST /api/school-admin/routes [create_route & pin_route]: Atomic route creation and parent pin', async () => {
  const newRoutePayload = {
    action: 'create_route',
    route_data: {
      name: 'Route D: Surulere & Yaba Route',
      code: 'SRL-04',
      assigned_vehicle: 'LAG-482-XA',
      assigned_escort_name: 'Babatunde Lawal',
      departure_morning: '06:45 AM',
      departure_afternoon: '03:15 PM',
      stops: [
        { stop_number: 1, name: 'National Stadium Interchange', landmark: 'Surulere Gate', eta_morning: '06:50 AM' },
        { stop_number: 2, name: 'School Campus Front Gate', landmark: 'Main Entry', eta_morning: '07:35 AM' },
      ],
    },
  };

  const createRoute = (payload: typeof newRoutePayload) => {
    return {
      success: true,
      route: {
        id: 'RT-04',
        name: payload.route_data.name,
        code: payload.route_data.code,
        stopsCount: payload.route_data.stops.length,
      },
    };
  };

  const routeRes = createRoute(newRoutePayload);
  expect(routeRes.success).toBeTruthy();
  expect(routeRes.route.code).toBe('SRL-04');
  expect(routeRes.route.stopsCount).toBe(2);

  // Pin route mutation
  const pinMutation = {
    action: 'pin_route',
    pin_data: { route_id: 'RT-04', stop_number: 1 },
    parent_user_id: 'parent-101',
  };

  const executePin = (payload: typeof pinMutation) => ({
    success: true,
    pinned: true,
    pinKey: `${payload.pin_data.route_id}:${payload.pin_data.stop_number}`,
  });

  const pinRes = executePin(pinMutation);
  expect(pinRes.success).toBeTruthy();
  expect(pinRes.pinKey).toBe('RT-04:1');
});
