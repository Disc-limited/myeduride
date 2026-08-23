// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, isAuthorizedSchoolAdmin } from '@/lib/auth/auth-server';
import { getAdminClient } from '@/lib/supabase/admin';
import { nowUtcIso } from '@/lib/utils/time';

// In-Memory Cache Store with 60s TTL
interface CacheEntry {
  timestamp: number;
  data: any;
}
const routesCache: Record<string, CacheEntry> = {};
const CACHE_TTL_MS = 60_000;

// Persistent in-memory fallback store for school transport routes
const schoolRoutesStore: Record<string, any[]> = {};
const parentPinnedRoutesStore: Record<string, Set<string>> = {}; // parentUserId -> Set of routeId:stopId
const studentRouteAssignmentsStore: Record<string, any> = {}; // studentId -> { morning_route_id, morning_stop, afternoon_route_id, afternoon_stop }

function initDefaultRoutes(schoolId: string) {
  if (!schoolRoutesStore[schoolId] || schoolRoutesStore[schoolId].length === 0) {
    schoolRoutesStore[schoolId] = [
      {
        id: 'RT-01',
        school_id: schoolId,
        name: 'Route A: Victoria Island & Oniru Express',
        code: 'VI-EXP-01',
        assigned_vehicle: 'LAG-482-XA (Toyota HiAce 18-Seater)',
        assigned_escort_name: 'Babajide Adeleke',
        assigned_escort_phone: '+234 803 291 8841',
        departure_morning: '06:45 AM',
        departure_afternoon: '03:15 PM',
        status: 'active',
        directions_summary: 'Departs from 1044 Ademola Adetokunbo St -> Oniru Market -> Palace Way -> School Campus Front Gate via Ozumba Mbadiwe Ave.',
        stops: [
          {
            stop_number: 1,
            name: '1044 Ademola Adetokunbo St, Victoria Island',
            landmark: 'Opposite Zenith Bank Towers',
            eta_morning: '06:50 AM',
            eta_afternoon: '03:45 PM',
            gps_lat: 6.4281,
            gps_lng: 3.4219,
            students_assigned: 4,
          },
          {
            stop_number: 2,
            name: 'Oniru Market Roundabout',
            landmark: 'Beside Oniru Royal Palace Gate',
            eta_morning: '07:05 AM',
            eta_afternoon: '03:35 PM',
            gps_lat: 6.4342,
            gps_lng: 3.4351,
            students_assigned: 5,
          },
          {
            stop_number: 3,
            name: 'Palace Way Entrance',
            landmark: 'Near Silverbird Galleria Corridor',
            eta_morning: '07:15 AM',
            eta_afternoon: '03:25 PM',
            gps_lat: 6.4399,
            gps_lng: 3.4412,
            students_assigned: 7,
          },
          {
            stop_number: 4,
            name: 'School Campus Front Gate',
            landmark: 'Main Security Turnstile Hub',
            eta_morning: '07:35 AM',
            eta_afternoon: '03:15 PM',
            gps_lat: 6.4474,
            gps_lng: 3.4731,
            students_assigned: 0,
          },
        ],
        passenger_students: [
          { student_id: 'STU-001', name: 'Stephanie Mba', class: 'Basic 4 Gold', stop: '1044 Ademola Adetokunbo St', parent_phone: '+234 803 112 4455' },
          { student_id: 'STU-002', name: 'David James', class: 'Basic 5 Emerald', stop: 'Oniru Market Roundabout', parent_phone: '+234 802 998 1122' },
          { student_id: 'STU-003', name: 'Esther Paul', class: 'Basic 3 Sapphire', stop: 'Palace Way Entrance', parent_phone: '+234 809 443 2211' },
        ],
        pinned_by_parents_count: 12,
        created_at: '2026-01-15T08:00:00Z',
      },
      {
        id: 'RT-02',
        school_id: schoolId,
        name: 'Route B: Lekki Phase 1 & Admiralty',
        code: 'LEK-02',
        assigned_vehicle: 'IKJ-904-KT (Ford Transit 15-Seater)',
        assigned_escort_name: 'Emeka Chukwu',
        assigned_escort_phone: '+234 812 449 1022',
        departure_morning: '06:50 AM',
        departure_afternoon: '03:20 PM',
        status: 'active',
        directions_summary: 'Departs from Admiralty Way Post Office -> Fola Osibo -> Freedom Way Roundabout -> School Campus Gate.',
        stops: [
          {
            stop_number: 1,
            name: 'Admiralty Way Post Office',
            landmark: 'Near Tantalizers Lekki',
            eta_morning: '06:55 AM',
            eta_afternoon: '03:50 PM',
            gps_lat: 6.4489,
            gps_lng: 3.4721,
            students_assigned: 5,
          },
          {
            stop_number: 2,
            name: 'Fola Osibo Junction',
            landmark: 'Beside Ebeano Supermarket',
            eta_morning: '07:10 AM',
            eta_afternoon: '03:38 PM',
            gps_lat: 6.4522,
            gps_lng: 3.4811,
            students_assigned: 4,
          },
          {
            stop_number: 3,
            name: 'Freedom Way Roundabout',
            landmark: 'Opposite Dome Event Center',
            eta_morning: '07:22 AM',
            eta_afternoon: '03:30 PM',
            gps_lat: 6.4589,
            gps_lng: 3.4902,
            students_assigned: 3,
          },
          {
            stop_number: 4,
            name: 'School Campus Front Gate',
            landmark: 'Main Security Gate',
            eta_morning: '07:40 AM',
            eta_afternoon: '03:20 PM',
            gps_lat: 6.4474,
            gps_lng: 3.4731,
            students_assigned: 0,
          },
        ],
        passenger_students: [
          { student_id: 'STU-006', name: 'Sarah Yusuf', class: 'Basic 4 Silver', stop: 'Admiralty Way Post Office', parent_phone: '+234 802 884 1133' },
          { student_id: 'STU-007', name: 'Daniel Peter', class: 'Basic 5 Gold', stop: 'Fola Osibo Junction', parent_phone: '+234 803 441 5566' },
        ],
        pinned_by_parents_count: 8,
        created_at: '2026-02-01T08:00:00Z',
      },
      {
        id: 'RT-03',
        school_id: schoolId,
        name: 'Route C: Ikeja GRA, Maryland & Anthony',
        code: 'IKJ-03',
        assigned_vehicle: 'APP-118-BC (Coaster Bus 28-Seater)',
        assigned_escort_name: 'Oluwaseun Bakare',
        assigned_escort_phone: '+234 809 332 5590',
        departure_morning: '06:30 AM',
        departure_afternoon: '03:00 PM',
        status: 'active',
        directions_summary: 'Departs from Isaac John St Ikeja -> Maryland Mall Terminal -> Anthony Interchange -> School Campus Gate via Ikorodu Rd Express.',
        stops: [
          {
            stop_number: 1,
            name: 'Isaac John St, Ikeja GRA',
            landmark: 'Near Radisson Blu Ikeja',
            eta_morning: '06:35 AM',
            eta_afternoon: '04:10 PM',
            gps_lat: 6.5872,
            gps_lng: 3.3571,
            students_assigned: 8,
          },
          {
            stop_number: 2,
            name: 'Maryland Mall Terminal',
            landmark: 'Maryland BRT Station Entrance',
            eta_morning: '06:50 AM',
            eta_afternoon: '03:50 PM',
            gps_lat: 6.5712,
            gps_lng: 3.3688,
            students_assigned: 9,
          },
          {
            stop_number: 3,
            name: 'Anthony Village Interchange',
            landmark: 'Anthony Pedestrian Bridge',
            eta_morning: '07:05 AM',
            eta_afternoon: '03:35 PM',
            gps_lat: 6.5591,
            gps_lng: 3.3752,
            students_assigned: 7,
          },
          {
            stop_number: 4,
            name: 'School Campus Front Gate',
            landmark: 'Main Security Gate',
            eta_morning: '07:30 AM',
            eta_afternoon: '03:00 PM',
            gps_lat: 6.4474,
            gps_lng: 3.4731,
            students_assigned: 0,
          },
        ],
        passenger_students: [
          { student_id: 'STU-004', name: 'Michael Obi', class: 'Basic 6 Diamond', stop: 'Isaac John St, Ikeja GRA', parent_phone: '+234 803 552 1199' },
          { student_id: 'STU-005', name: 'Victory Bello', class: 'Basic 2 Ruby', stop: 'Maryland Mall Terminal', parent_phone: '+234 807 114 9900' },
        ],
        pinned_by_parents_count: 15,
        created_at: '2026-02-15T08:00:00Z',
      },
    ];
  }
}

/**
 * GET /api/school-admin/routes
 * Returns transport routes with stops, passenger manifests, directions, and parent pin statuses.
 */
export async function GET(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const primarySchoolId =
      searchParams.get('school_id') ||
      (session as any).primary_school?.id ||
      session.roles?.find((r: any) => r.school_id)?.school_id;

    if (!primarySchoolId) {
      return NextResponse.json({ error: 'school_id could not be determined' }, { status: 400 });
    }

    // Fast Cache Lookup
    const cacheKey = `routes_${primarySchoolId}`;
    const cached = routesCache[cacheKey];
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return NextResponse.json(cached.data);
    }

    initDefaultRoutes(primarySchoolId);
    const routes = schoolRoutesStore[primarySchoolId];

    const totalStops = routes.reduce((acc, r) => acc + (r.stops?.length || 0), 0);
    const totalPassengers = routes.reduce((acc, r) => acc + (r.passenger_students?.length || 0), 0);

    const payload = {
      success: true,
      timestamp: nowUtcIso(),
      school_id: primarySchoolId,
      metrics: {
        total_routes: routes.length,
        total_stops: totalStops,
        total_enrolled_passengers: totalPassengers,
        active_routes: routes.filter((r) => r.status === 'active').length,
      },
      routes,
    };

    routesCache[cacheKey] = {
      timestamp: Date.now(),
      data: payload,
    };

    return NextResponse.json(payload);
  } catch (err: any) {
    console.error('[routes GET] Error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}

/**
 * POST /api/school-admin/routes
 * Actions:
 * - create_route: Add new route
 * - update_route: Edit route parameters & stops
 * - pin_route: Parent pins route and preferred stop
 * - assign_student_route: Assign student to route & designated stop
 * - log_stop_event: Escort logs stop departure & directions
 */
export async function POST(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json();
    const { action, school_id, route_data, route_id, student_assignment, pin_data, stop_event } = body;

    const primarySchoolId =
      school_id ||
      (session as any).primary_school?.id ||
      session.roles?.find((r: any) => r.school_id)?.school_id;

    if (!primarySchoolId) {
      return NextResponse.json({ error: 'school_id required' }, { status: 400 });
    }

    initDefaultRoutes(primarySchoolId);
    const supabase = getAdminClient();

    if (action === 'create_route') {
      if (!route_data.name || !route_data.code) {
        return NextResponse.json({ error: 'Route name and route code are required' }, { status: 400 });
      }

      const newId = `RT-${Date.now().toString().slice(-4)}`;
      const newRoute = {
        id: newId,
        school_id: primarySchoolId,
        name: route_data.name,
        code: route_data.code.toUpperCase().trim(),
        assigned_vehicle: route_data.assigned_vehicle || 'Unassigned',
        assigned_escort_name: route_data.assigned_escort_name || 'Unassigned',
        assigned_escort_phone: route_data.assigned_escort_phone || '',
        departure_morning: route_data.departure_morning || '06:45 AM',
        departure_afternoon: route_data.departure_afternoon || '03:15 PM',
        status: 'active',
        directions_summary: route_data.directions_summary || 'Standard direct corridor to school front gate.',
        stops: route_data.stops || [
          { stop_number: 1, name: 'Designated First Stop Point', landmark: 'Area Landmark', eta_morning: '06:50 AM', eta_afternoon: '03:45 PM', students_assigned: 0 },
          { stop_number: 2, name: 'School Campus Main Gate', landmark: 'Campus Entry', eta_morning: '07:35 AM', eta_afternoon: '03:15 PM', students_assigned: 0 },
        ],
        passenger_students: [],
        pinned_by_parents_count: 0,
        created_at: nowUtcIso(),
      };

      schoolRoutesStore[primarySchoolId].unshift(newRoute);

      // Invalidate Cache
      delete routesCache[`routes_${primarySchoolId}`];

      // Audit Log
      await supabase.from('audit_logs').insert({
        school_id: primarySchoolId,
        user_id: session.user_id,
        action: 'CREATE_TRANSPORT_ROUTE',
        resource: 'transport_routes',
        details: { route_id: newId, code: newRoute.code, name: newRoute.name },
      });

      return NextResponse.json({
        success: true,
        message: `Transport Route ${newRoute.name} created successfully.`,
        route: newRoute,
      });
    }

    if (action === 'update_route') {
      const idx = schoolRoutesStore[primarySchoolId].findIndex((r) => r.id === route_id);
      if (idx === -1) {
        return NextResponse.json({ error: 'Route not found' }, { status: 404 });
      }

      schoolRoutesStore[primarySchoolId][idx] = {
        ...schoolRoutesStore[primarySchoolId][idx],
        ...route_data,
        updated_at: nowUtcIso(),
      };

      // Invalidate Cache
      delete routesCache[`routes_${primarySchoolId}`];

      return NextResponse.json({
        success: true,
        message: 'Transport route configuration updated successfully.',
        route: schoolRoutesStore[primarySchoolId][idx],
      });
    }

    if (action === 'pin_route') {
      const parentId = session.user_id;
      if (!parentPinnedRoutesStore[parentId]) parentPinnedRoutesStore[parentId] = new Set();

      const pinKey = `${pin_data.route_id}:${pin_data.stop_number}`;
      const isPinned = parentPinnedRoutesStore[parentId].has(pinKey);

      if (isPinned) {
        parentPinnedRoutesStore[parentId].delete(pinKey);
      } else {
        parentPinnedRoutesStore[parentId].add(pinKey);
      }

      return NextResponse.json({
        success: true,
        pinned: !isPinned,
        message: !isPinned ? 'Route and stop pinned to your Parent Dashboard.' : 'Route unpinned.',
      });
    }

    if (action === 'assign_student_route') {
      const { student_id, student_name, student_class, parent_phone, route_id, stop_name } = student_assignment;
      const targetRoute = schoolRoutesStore[primarySchoolId].find((r) => r.id === route_id);
      if (!targetRoute) {
        return NextResponse.json({ error: 'Target route not found' }, { status: 404 });
      }

      if (!targetRoute.passenger_students) targetRoute.passenger_students = [];
      const existingIdx = targetRoute.passenger_students.findIndex((s) => s.student_id === student_id);

      const passengerRecord = {
        student_id,
        name: student_name,
        class: student_class,
        stop: stop_name,
        parent_phone,
      };

      if (existingIdx >= 0) {
        targetRoute.passenger_students[existingIdx] = passengerRecord;
      } else {
        targetRoute.passenger_students.push(passengerRecord);
      }

      studentRouteAssignmentsStore[student_id] = {
        route_id,
        stop_name,
        updated_at: nowUtcIso(),
      };

      delete routesCache[`routes_${primarySchoolId}`];

      return NextResponse.json({
        success: true,
        message: `Student ${student_name} assigned to ${targetRoute.name} at stop: ${stop_name}`,
        passenger: passengerRecord,
      });
    }

    if (action === 'log_stop_event') {
      // Escort marks stop arrival and logs operational record
      await supabase.from('gate_activity_log').insert({
        school_id: primarySchoolId,
        action_type: 'ROUTE_STOP_REACHED',
        pickup_person_name: stop_event.escort_name,
        details: {
          route_id: stop_event.route_id,
          stop_number: stop_event.stop_number,
          stop_name: stop_event.stop_name,
          students_boarded: stop_event.students_boarded,
          timestamp: nowUtcIso(),
        },
      });

      return NextResponse.json({
        success: true,
        message: `Stop ${stop_event.stop_name} arrival logged successfully.`,
      });
    }

    return NextResponse.json({ error: `Unknown action '${action}'` }, { status: 400 });
  } catch (err: any) {
    console.error('[routes POST] Error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
