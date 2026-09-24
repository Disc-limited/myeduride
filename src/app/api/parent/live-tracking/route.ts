// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth/auth-server';
import { getAdminClient } from '@/lib/supabase/admin';
import { nowUtcIso } from '@/lib/utils/time';

export const dynamic = 'force-dynamic';

/** Match City Manager / Safety Connect live assignment statuses */
const LIVE_ASSIGNMENT_STATUSES = [
  'active',
  'pending_confirmation',
  'pending',
  'confirmed',
  'approved',
  'city_manager_approved',
];

const ESCORT_APP_SELECT =
  'id, user_id, full_name, phone, email, photo, passport_doc_url, escort_code, operating_area, application_data, status, reg_number, vehicle_type, school_id, primary_school_id';

const STUDENT_SELECT = `
  id, first_name, last_name, school_id,
  house_address, house_lat, house_lng, house_landmark, house_notes,
  class:school_classes(name),
  school:schools(id, name, address, location_address, gps_lat, gps_lng)
`;

function unwrapRel(value: any) {
  if (Array.isArray(value)) return value[0] || null;
  return value || null;
}

function parseAppData(raw: any) {
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }
  return {};
}

function formatEscortCode(escort: any) {
  const code = escort?.escort_code || escort?.escortIdCode || escort?.escort_id_code;
  if (code) return String(code).toUpperCase();
  if (escort?.id) return `ESC-${String(escort.id).slice(0, 8).toUpperCase()}`;
  return null;
}

function resolveEscortTypeLabel(escort: any, appData: any) {
  const raw =
    escort?.escort_type ||
    appData.escort_type ||
    appData.escortType ||
    appData.createdRole ||
    null;
  const text = String(raw || '').toLowerCase();
  if (text.includes('school')) return { key: 'school_escort', label: 'School Escort' };
  // School-created escorts often have school_id / primary_school_id and no myeduride flag
  if (appData.createdBySchoolId || appData.created_by_school) {
    return { key: 'school_escort', label: 'School Escort' };
  }
  return { key: 'myeduride_escort', label: 'MyEduRide Escort' };
}

function buildVehicleFromEscort(escort: any, fleetVehicle?: any) {
  const appData = parseAppData(escort?.application_data);
  const modelFromFleet = fleetVehicle
    ? `${fleetVehicle.make || ''} ${fleetVehicle.model || ''}`.trim()
    : '';
  const plateFromFleet = fleetVehicle?.reg_number || null;

  const model =
    modelFromFleet ||
    appData.vehicleMakeModel ||
    appData.vehicle ||
    appData.makeModel ||
    [appData.make, appData.model].filter(Boolean).join(' ').trim() ||
    escort?.vehicle_type ||
    null;

  const licensePlate =
    plateFromFleet ||
    escort?.reg_number ||
    appData.assignedVehicle ||
    appData.regNumber ||
    appData.vehicle_plate ||
    appData.plate_number ||
    null;

  return {
    model: model || null,
    licensePlate: licensePlate || null,
    capacity: fleetVehicle?.capacity || appData.capacity || null,
  };
}

function buildEscortPayload(escort: any, assignedRow?: any) {
  if (!escort) return null;
  const appData = parseAppData(escort.application_data);
  const photo =
    escort.photo ||
    escort.passport_doc_url ||
    appData.photo ||
    appData.passport_photograph ||
    null;
  const typeInfo = resolveEscortTypeLabel(escort, appData);

  return {
    id: escort.id || null,
    userId: escort.user_id || null,
    name: escort.full_name || escort.name || null,
    code: formatEscortCode(escort),
    phone: escort.phone || appData.phone || null,
    email: escort.email || null,
    photo,
    escortType: typeInfo.key,
    escortTypeLabel: typeInfo.label,
    operatingArea: escort.operating_area || appData.operating_area || null,
    assignmentStatus: assignedRow?.status || null,
    approvalBadge:
      assignedRow?.status === 'active'
        ? 'Verified Assigned Escort'
        : assignedRow
          ? 'Assigned — Awaiting Clearance'
          : 'Assigned Escort',
  };
}

async function fetchEscortApplication(supabase: any, escortApplicationId: string) {
  if (!escortApplicationId) return null;
  const { data, error } = await supabase
    .from('escort_applications')
    .select(ESCORT_APP_SELECT)
    .eq('id', escortApplicationId)
    .maybeSingle();
  if (error) {
    console.warn('[parent/live-tracking] escort fetch notice:', error.message);
    return null;
  }
  return data;
}

export async function GET(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const childId = searchParams.get('child_id') || searchParams.get('studentId') || searchParams.get('student_id');
    const supabase = getAdminClient();

    // 1. Identify student (use school_classes — not classes; schools use gps_lat/gps_lng only)
    let student: any = null;

    const loadStudentById = async (id: string) => {
      const primary = await supabase.from('students').select(STUDENT_SELECT).eq('id', id).maybeSingle();
      if (!primary.error && primary.data) return primary.data;
      if (primary.error) {
        console.warn('[parent/live-tracking] student embed notice:', primary.error.message);
        // Bare student row — still enough to resolve escort assignment
        const bare = await supabase
          .from('students')
          .select('id, first_name, last_name, school_id, house_address, house_lat, house_lng, house_landmark, house_notes')
          .eq('id', id)
          .maybeSingle();
        if (bare.data) {
          if (bare.data.school_id) {
            const { data: sch } = await supabase
              .from('schools')
              .select('id, name, address, location_address, gps_lat, gps_lng')
              .eq('id', bare.data.school_id)
              .maybeSingle();
            return { ...bare.data, school: sch, class: null };
          }
          return bare.data;
        }
      }
      return null;
    };

    if (childId) {
      student = await loadStudentById(childId);
    }

    // Via student_parents (students.parent_id may not exist in this schema)
    if (!student && session.user_id) {
      const { data: parentLink, error } = await supabase
        .from('student_parents')
        .select('student_id')
        .eq('parent_user_id', session.user_id)
        .limit(1)
        .maybeSingle();
      if (error) console.warn('[parent/live-tracking] student_parents notice:', error.message);
      if (parentLink?.student_id) {
        student = await loadStudentById(parentLink.student_id);
      }
    }

    if (!student) {
      return NextResponse.json({
        success: true,
        hasActiveJourney: false,
        message: 'No student record found for this parent account',
        timestamp: nowUtcIso(),
      });
    }

    const school = unwrapRel(student.school);
    const studentClass = unwrapRel(student.class);

    // 2. Resolve assignment — plain query first (avoids embed column mismatches), then hydrate escort
    let assignedRow: any = null;
    let assignedEscort: any = null;

    const { data: liveAssignRows, error: assignErr } = await supabase
      .from('escort_assignments')
      .select('id, status, escort_application_id, school_id, notes, updated_at, created_at, booking_id')
      .eq('student_id', student.id)
      .in('status', LIVE_ASSIGNMENT_STATUSES)
      .order('updated_at', { ascending: false })
      .limit(8);

    if (assignErr) {
      console.warn('[parent/live-tracking] assignment query notice:', assignErr.message);
    } else {
      assignedRow =
        (liveAssignRows || []).find((a: any) => a.status === 'active') ||
        (liveAssignRows || [])[0] ||
        null;
    }

    // Booking-linked assignments sometimes omit student_id — recover via transport_bookings
    if (!assignedRow) {
      const { data: bookingRows } = await supabase
        .from('transport_bookings')
        .select('id')
        .eq('student_id', student.id)
        .limit(20);
      const bookingIds = (bookingRows || []).map((b: any) => b.id).filter(Boolean);
      if (bookingIds.length > 0) {
        const { data: byBooking } = await supabase
          .from('escort_assignments')
          .select('id, status, escort_application_id, school_id, notes, updated_at, created_at, booking_id, student_id')
          .in('booking_id', bookingIds)
          .in('status', LIVE_ASSIGNMENT_STATUSES)
          .order('updated_at', { ascending: false })
          .limit(8);
        assignedRow =
          (byBooking || []).find((a: any) => a.status === 'active') ||
          (byBooking || [])[0] ||
          null;
      }
    }

    if (assignedRow?.escort_application_id) {
      assignedEscort = await fetchEscortApplication(supabase, assignedRow.escort_application_id);
    }

    // 3. Fallback: legacy student_route_assignments
    const { data: assignment } = await supabase
      .from('student_route_assignments')
      .select(`
        *,
        morning_route:transport_routes(
          id, name, code, assigned_vehicle_id, assigned_escort_id,
          departure_morning, departure_afternoon,
          vehicle:school_vehicles(id, reg_number, make, model, capacity)
        )
      `)
      .eq('student_id', student.id)
      .maybeSingle();

    const morningRoute = assignment?.morning_route;
    const fleetVehicle = Array.isArray(morningRoute?.vehicle)
      ? morningRoute.vehicle[0]
      : morningRoute?.vehicle;

    let hydratedRouteEscort: any = null;
    if (!assignedEscort && morningRoute?.assigned_escort_id) {
      hydratedRouteEscort = await fetchEscortApplication(supabase, morningRoute.assigned_escort_id);
    }

    const escortRow = assignedEscort || hydratedRouteEscort || null;
    const escortPayload = buildEscortPayload(escortRow, assignedRow);
    const vehiclePayload = buildVehicleFromEscort(escortRow, fleetVehicle);

    // 4. Route stops
    let stops: any[] = [];
    if (morningRoute?.id) {
      const { data: stopRows } = await supabase
        .from('transport_route_stops')
        .select('*')
        .eq('route_id', morningRoute.id)
        .order('stop_number', { ascending: true });
      stops = stopRows || [];
    }

    // 5. Active live session matched to assigned escort
    let activeSession: any = null;
    const escortAppId = escortRow?.id || assignedRow?.escort_application_id || null;
    const escortUserId = escortRow?.user_id || null;

    const sessionOr: string[] = [];
    if (escortAppId) sessionOr.push(`escort_id.eq.${escortAppId}`);
    if (escortUserId) sessionOr.push(`escort_user_id.eq.${escortUserId}`);
    if (morningRoute?.id) sessionOr.push(`route_id.eq.${morningRoute.id}`);
    if (morningRoute?.assigned_vehicle_id) {
      sessionOr.push(`vehicle_id.eq.${morningRoute.assigned_vehicle_id}`);
    }

    if (sessionOr.length > 0) {
      const { data: activeSessions } = await supabase
        .from('vehicle_active_sessions')
        .select('*')
        .eq('status', 'in_progress')
        .or(sessionOr.join(','))
        .order('started_at', { ascending: false })
        .limit(1);
      activeSession = activeSessions?.[0] || null;
    }

    if (!activeSession && student.school_id && escortAppId) {
      const { data: schoolSessions } = await supabase
        .from('vehicle_active_sessions')
        .select('*')
        .eq('status', 'in_progress')
        .eq('school_id', student.school_id)
        .or(
          `escort_id.eq.${escortAppId}${escortUserId ? `,escort_user_id.eq.${escortUserId}` : ''}`
        )
        .order('started_at', { ascending: false })
        .limit(1);
      activeSession = schoolSessions?.[0] || null;
    }

    // 5b. Stale session auto-expiration guard (sessions older than 45 minutes without ping are discarded)
    if (activeSession) {
      const lastPingEpoch = activeSession.last_ping_at
        ? new Date(activeSession.last_ping_at).getTime()
        : activeSession.started_at
          ? new Date(activeSession.started_at).getTime()
          : 0;
      const isStale = Date.now() - lastPingEpoch > 45 * 60 * 1000;
      if (isStale) {
        // Auto-close stale session in database so it no longer lingers as in_progress
        supabase
          .from('vehicle_active_sessions')
          .update({ status: 'completed', completed_at: nowUtcIso() })
          .eq('id', activeSession.id)
          .then(() => {})
          .catch(() => {});
        activeSession = null;
      }
    }

    // 6. Attendance & Trip status → accurate journey stage
    const todayDate = new Date().toISOString().split('T')[0];
    const [
      { data: todayAttendance },
      { data: departureRecord },
      { data: todayTrip },
      { data: dismissalReq },
    ] = await Promise.all([
      supabase
        .from('attendance_records')
        .select('*')
        .eq('student_id', student.id)
        .eq('date', todayDate)
        .maybeSingle(),
      supabase
        .from('attendance_records')
        .select('*')
        .eq('student_id', student.id)
        .eq('type', 'departure')
        .gte('timestamp', `${todayDate}T00:00:00`)
        .order('timestamp', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('escort_student_daily_trips')
        .select('*')
        .eq('student_id', student.id)
        .eq('trip_date', todayDate)
        .maybeSingle(),
      supabase
        .from('dismissal_requests')
        .select('*')
        .eq('student_id', student.id)
        .eq('dismissal_date', todayDate)
        .maybeSingle(),
    ]);

    let journeyStage:
      | 'scheduled'
      | 'pickup_in_progress'
      | 'at_school_gate'
      | 'in_class'
      | 'afternoon_transit'
      | 'delivered_home' = 'scheduled';

    const isDeliveredHome = Boolean(
      todayTrip?.afternoon_dropped_off ||
      todayAttendance?.check_out_time ||
      dismissalReq?.status === 'completed' ||
      (departureRecord && !todayTrip?.afternoon_picked_up && activeSession?.trip_type !== 'afternoon_dropoff')
    );

    const isSafeAtHome = isDeliveredHome;

    const isReturningHome = Boolean(
      !isDeliveredHome &&
      (todayTrip?.afternoon_picked_up || activeSession?.trip_type === 'afternoon_dropoff')
    );

    if (isDeliveredHome) {
      journeyStage = 'delivered_home';
    } else if (isReturningHome) {
      journeyStage = 'afternoon_transit';
    } else if (todayAttendance?.check_in_time || todayTrip?.morning_dropped_off) {
      journeyStage = 'in_class';
    } else if (todayTrip?.morning_picked_up || activeSession) {
      journeyStage = 'pickup_in_progress';
    }

    const studentHouseLat =
      student.house_lat != null && !isNaN(Number(student.house_lat)) ? Number(student.house_lat) : null;
    const studentHouseLng =
      student.house_lng != null && !isNaN(Number(student.house_lng)) ? Number(student.house_lng) : null;

    const schoolLat =
      school?.gps_lat != null && !isNaN(Number(school.gps_lat))
        ? Number(school.gps_lat)
        : studentHouseLat;
    const schoolLng =
      school?.gps_lng != null && !isNaN(Number(school.gps_lng))
        ? Number(school.gps_lng)
        : studentHouseLng;

    const childPayload = {
      id: student.id,
      name: `${student.first_name || ''} ${student.last_name || ''}`.trim(),
      className: studentClass?.name || 'Class',
      schoolId: school?.id || student.school_id || null,
      houseAddress: student.house_address || null,
      houseLat: studentHouseLat,
      houseLng: studentHouseLng,
      houseLandmark: student.house_landmark || null,
      schoolName: school?.name || 'School Campus',
      schoolAddress: school?.location_address || school?.address || '',
      schoolLat,
      schoolLng,
    };

    // Ground stops list in real student doorstep & school location
    let routeStops = stops.map((s) => ({
      id: s.id,
      stopNumber: s.stop_number,
      name: s.name,
      landmark: s.landmark,
      lat: s.gps_lat != null ? Number(s.gps_lat) : null,
      lng: s.gps_lng != null ? Number(s.gps_lng) : null,
      etaMorning: s.eta_morning,
    }));

    if (routeStops.length === 0) {
      routeStops = [
        {
          id: 'doorstep-pickup',
          stopNumber: 1,
          name: `${student.first_name || 'Student'}'s Doorstep`,
          landmark: student.house_address || student.house_landmark || 'Residence Doorstep',
          lat: studentHouseLat,
          lng: studentHouseLng,
          etaMorning: '07:05 AM',
        },
        {
          id: 'school-gate',
          stopNumber: 2,
          name: school?.name || 'School Campus',
          landmark: school?.location_address || school?.address || 'Campus Main Reception',
          lat: schoolLat,
          lng: schoolLng,
          etaMorning: '07:35 AM',
        },
      ];
    }

    let targetStop = {
      name: `${student.first_name || 'Student'}'s Doorstep`,
      landmark: student.house_address || student.house_landmark || 'Residence Doorstep',
      lat: studentHouseLat,
      lng: studentHouseLng,
    };

    if (
      journeyStage === 'in_class' ||
      journeyStage === 'at_school_gate' ||
      (journeyStage === 'pickup_in_progress' && todayTrip?.morning_picked_up)
    ) {
      targetStop = {
        name: school?.name || 'School Campus',
        landmark: school?.location_address || school?.address || 'Campus Main Reception',
        lat: schoolLat,
        lng: schoolLng,
      };
    }

    const appData = parseAppData(escortRow?.application_data);
    const routePayload = morningRoute
      ? {
          id: morningRoute.id,
          name: morningRoute.name,
          code: morningRoute.code,
          departureMorning: morningRoute.departure_morning || '07:00 AM',
          departureAfternoon: morningRoute.departure_afternoon || '02:30 PM',
          vehicleModel: vehiclePayload.model,
          licensePlate: vehiclePayload.licensePlate,
          escortName: escortPayload?.name || null,
          escortPhone: escortPayload?.phone || null,
          escortCode: escortPayload?.code || null,
          stopsCount: routeStops.length,
          stops: routeStops,
        }
      : escortPayload
        ? {
            id: null,
            name: escortPayload.operatingArea || appData.operating_area || 'Assigned Corridor',
            code: appData.routeCode || 'SHUTTLE',
            departureMorning: '07:00 AM',
            departureAfternoon: '02:30 PM',
            vehicleModel: vehiclePayload.model,
            licensePlate: vehiclePayload.licensePlate,
            escortName: escortPayload.name,
            escortPhone: escortPayload.phone,
            escortCode: escortPayload.code,
            stopsCount: routeStops.length,
            stops: routeStops,
          }
        : {
            id: null,
            name: `${school?.name || 'School'} Transit Corridor`,
            code: 'CORRIDOR',
            departureMorning: '07:00 AM',
            departureAfternoon: '02:30 PM',
            vehicleModel: vehiclePayload.model,
            licensePlate: vehiclePayload.licensePlate,
            escortName: null,
            escortPhone: null,
            escortCode: null,
            stopsCount: routeStops.length,
            stops: routeStops,
          };

    const hasRealCoords =
      activeSession?.current_lat != null &&
      activeSession?.current_lng != null &&
      Number.isFinite(Number(activeSession.current_lat)) &&
      Number.isFinite(Number(activeSession.current_lng));

    const base = {
      success: true,
      journeyStage,
      isSafeAtHome,
      todayTrip: todayTrip || null,
      child: childPayload,
      escort: escortPayload,
      vehicle: vehiclePayload,
      route: routePayload,
      targetStop,
      timestamp: nowUtcIso(),
    };

    if (!activeSession) {
      return NextResponse.json({
        ...base,
        hasActiveJourney: false,
        sessionId: null,
        telemetry: null,
        message: escortPayload
          ? 'Assigned escort loaded. No active GPS trip right now.'
          : 'No escort assigned yet for this child.',
      });
    }

    return NextResponse.json({
      ...base,
      hasActiveJourney: true,
      sessionId: activeSession.id,
      telemetry: {
        currentLat: hasRealCoords ? Number(activeSession.current_lat) : null,
        currentLng: hasRealCoords ? Number(activeSession.current_lng) : null,
        speedKmh: Number(activeSession.current_speed_kmh || 0),
        heading: Number(activeSession.current_heading || 0),
        currentStopIndex: Number(activeSession.current_stop_index || 0),
        batteryLevel: activeSession.battery_level ?? null,
        lastPingAt: activeSession.last_ping_at || nowUtcIso(),
        gpsAccuracyMeters:
          activeSession.gps_accuracy_meters != null
            ? Number(activeSession.gps_accuracy_meters)
            : null,
      },
    });
  } catch (err: any) {
    console.error('[parent/live-tracking GET] Error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
