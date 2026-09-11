// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth/auth-server';
import { getAdminClient } from '@/lib/supabase/admin';
import { nowUtcIso } from '@/lib/utils/time';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const childId = searchParams.get('child_id');
    const supabase = getAdminClient();

    // 1. Robustly Identify Student
    let student: any = null;
    if (childId) {
      const { data } = await supabase
        .from('students')
        .select(`
          id, first_name, last_name, school_id, 
          house_address, house_lat, house_lng, house_landmark, house_notes,
          class:classes(name),
          school:schools(id, name, address, latitude, longitude)
        `)
        .eq('id', childId)
        .maybeSingle();
      student = data;
    }

    // If still null, check direct parent_id on students table
    if (!student && session.user_id) {
      const { data } = await supabase
        .from('students')
        .select(`
          id, first_name, last_name, school_id, 
          house_address, house_lat, house_lng, house_landmark, house_notes,
          class:classes(name),
          school:schools(id, name, address, latitude, longitude)
        `)
        .eq('parent_id', session.user_id)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      student = data;
    }

    // If still null, check student_parents relation
    if (!student && session.user_id) {
      const { data: parentLink } = await supabase
        .from('student_parents')
        .select(`
          student:students(
            id, first_name, last_name, school_id, 
            house_address, house_lat, house_lng, house_landmark, house_notes,
            class:classes(name),
            school:schools(id, name, address, latitude, longitude)
          )
        `)
        .eq('parent_user_id', session.user_id)
        .limit(1)
        .maybeSingle();
      student = parentLink?.student;
    }

    if (!student) {
      return NextResponse.json({
        success: true,
        hasActiveJourney: false,
        message: 'No student record found for this parent account',
        timestamp: nowUtcIso(),
      });
    }

    // 2. Query Route Assignment from database
    const { data: assignment } = await supabase
      .from('student_route_assignments')
      .select(`
        *, 
        morning_route:transport_routes(
          id, name, code, assigned_vehicle_id, assigned_escort_id, 
          departure_morning, departure_afternoon, 
          vehicle:school_vehicles(id, reg_number, make, model, capacity), 
          escort:escort_applications(id, full_name, phone, photo)
        )
      `)
      .eq('student_id', student.id)
      .maybeSingle();

    const morningRoute = assignment?.morning_route;
    const vehicle = Array.isArray(morningRoute?.vehicle) ? morningRoute.vehicle[0] : morningRoute?.vehicle;
    const escort = Array.isArray(morningRoute?.escort) ? morningRoute.escort[0] : morningRoute?.escort;

    // 3. Query Route Stops if route exists
    let stops: any[] = [];
    if (morningRoute?.id) {
      const { data: stopRows } = await supabase
        .from('transport_route_stops')
        .select('*')
        .eq('route_id', morningRoute.id)
        .order('stop_number', { ascending: true });
      stops = stopRows || [];
    }

    // 4. Query Active Live Session from `vehicle_active_sessions`
    let activeSessionQuery = supabase
      .from('vehicle_active_sessions')
      .select('*')
      .eq('status', 'in_progress');

    if (morningRoute?.id) {
      activeSessionQuery = activeSessionQuery.or(
        `route_id.eq.${morningRoute.id},vehicle_id.eq.${morningRoute.assigned_vehicle_id || '00000000-0000-0000-0000-000000000000'}`
      );
    } else if (student.school_id) {
      activeSessionQuery = activeSessionQuery.eq('school_id', student.school_id);
    }

    const { data: activeSessions } = await activeSessionQuery
      .order('started_at', { ascending: false })
      .limit(1);
    const activeSession = activeSessions?.[0] || null;

    // 5. Query today's attendance log for gate transit status
    const todayDate = new Date().toISOString().split('T')[0];
    const { data: todayAttendance } = await supabase
      .from('attendance_records')
      .select('*')
      .eq('student_id', student.id)
      .eq('date', todayDate)
      .maybeSingle();

    // Determine Journey Stage
    let journeyStage: 'scheduled' | 'pickup_in_progress' | 'at_school_gate' | 'in_class' | 'afternoon_transit' | 'delivered_home' = 'scheduled';
    if (todayAttendance?.check_out_time) {
      journeyStage = 'delivered_home';
    } else if (todayAttendance?.check_in_time) {
      journeyStage = 'in_class';
    } else if (activeSession) {
      journeyStage = 'pickup_in_progress';
    }

    // Standard school lat/lng fallback if not set
    const schoolLat = student.school?.latitude ? Number(student.school.latitude) : 6.5244;
    const schoolLng = student.school?.longitude ? Number(student.school.longitude) : 3.3792;

    const childPayload = {
      id: student.id,
      name: `${student.first_name} ${student.last_name}`.trim(),
      className: student.class?.name || 'Class',
      houseAddress: student.house_address || null,
      houseLat: student.house_lat ? Number(student.house_lat) : null,
      houseLng: student.house_lng ? Number(student.house_lng) : null,
      houseLandmark: student.house_landmark || null,
      schoolName: student.school?.name || 'School Campus',
      schoolAddress: student.school?.address || '',
      schoolLat,
      schoolLng,
    };

    // If NO active GPS stream session right now
    if (!activeSession) {
      return NextResponse.json({
        success: true,
        hasActiveJourney: false,
        journeyStage,
        child: childPayload,
        route: morningRoute
          ? {
              id: morningRoute.id,
              name: morningRoute.name,
              code: morningRoute.code,
              departureMorning: morningRoute.departure_morning || '07:00 AM',
              departureAfternoon: morningRoute.departure_afternoon || '02:30 PM',
              vehicleModel: vehicle ? `${vehicle.make || ''} ${vehicle.model || ''}`.trim() : 'Assigned Shuttle',
              licensePlate: vehicle?.reg_number || '—',
              escortName: escort?.full_name || 'Assigned Escort',
              escortPhone: escort?.phone || '',
              escortCode: escort?.id ? `ESC-${escort.id.slice(0, 5).toUpperCase()}` : 'ESC',
              stopsCount: stops.length,
              stops: stops.map((s) => ({
                id: s.id,
                stopNumber: s.stop_number,
                name: s.name,
                landmark: s.landmark,
                lat: s.gps_lat,
                lng: s.gps_lng,
                etaMorning: s.eta_morning,
              })),
            }
          : null,
        message: 'No active shuttle in transit right now. Displaying assigned route corridor.',
        timestamp: nowUtcIso(),
      });
    }

    // Active trip in progress
    return NextResponse.json({
      success: true,
      hasActiveJourney: true,
      journeyStage,
      sessionId: activeSession.id,
      child: childPayload,
      escort: {
        name: activeSession.escort_name || escort?.full_name || 'Officer Assigned',
        code: activeSession.escort_id ? `ESC-${activeSession.escort_id.slice(0, 5).toUpperCase()}` : (escort?.id ? `ESC-${escort.id.slice(0, 5).toUpperCase()}` : 'ESC-LIVE'),
        phone: escort?.phone || '+234 800 000 0000',
        photo: escort?.photo || null,
      },
      vehicle: {
        model: vehicle ? `${vehicle.make || ''} ${vehicle.model || ''}`.trim() : 'Toyota HiAce (Air-Conditioned)',
        licensePlate: vehicle?.reg_number || 'LAG-894-XA',
      },
      route: {
        id: activeSession.route_id || morningRoute?.id,
        name: morningRoute?.name || 'School Shuttle Route',
        code: morningRoute?.code || 'SHUTTLE',
        stopsCount: stops.length,
        stops: stops.map((s) => ({
          id: s.id,
          stopNumber: s.stop_number,
          name: s.name,
          landmark: s.landmark,
          lat: s.gps_lat,
          lng: s.gps_lng,
          etaMorning: s.eta_morning,
        })),
      },
      telemetry: {
        currentLat: Number(activeSession.current_lat || schoolLat),
        currentLng: Number(activeSession.current_lng || schoolLng),
        speedKmh: Number(activeSession.current_speed_kmh || 32),
        heading: Number(activeSession.current_heading || 90),
        currentStopIndex: Number(activeSession.current_stop_index || 0),
        batteryLevel: activeSession.battery_level || 95,
        lastPingAt: activeSession.last_ping_at || nowUtcIso(),
      },
      timestamp: nowUtcIso(),
    });
  } catch (err: any) {
    console.error('[parent/live-tracking GET] Error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
