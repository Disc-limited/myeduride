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

    // 1. Identify student
    let student: any = null;
    if (childId) {
      const { data } = await supabase
        .from('students')
        .select('id, first_name, last_name, school_id, school:schools(id, name)')
        .eq('id', childId)
        .maybeSingle();
      student = data;
    } else if (session.user_id) {
      // Find first linked child for parent
      const { data: parentLink } = await supabase
        .from('student_parents')
        .select('student:students(id, first_name, last_name, school_id, school:schools(id, name))')
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
      .select('*, morning_route:transport_routes(id, name, code, assigned_vehicle_id, assigned_escort_id, departure_morning, departure_afternoon, vehicle:school_vehicles(id, reg_number, make, model, capacity), escort:escort_applications(id, full_name, phone, photo))')
      .eq('student_id', student.id)
      .maybeSingle();

    const morningRoute = assignment?.morning_route;
    const vehicle = Array.isArray(morningRoute?.vehicle) ? morningRoute.vehicle[0] : morningRoute?.vehicle;
    const escort = Array.isArray(morningRoute?.escort) ? morningRoute.escort[0] : morningRoute?.escort;

    // 3. Query Active Live Session from `vehicle_active_sessions`
    let activeSessionQuery = supabase
      .from('vehicle_active_sessions')
      .select('*')
      .eq('status', 'in_progress');

    if (morningRoute?.id) {
      activeSessionQuery = activeSessionQuery.or(`route_id.eq.${morningRoute.id},vehicle_id.eq.${morningRoute.assigned_vehicle_id || '00000000-0000-0000-0000-000000000000'}`);
    } else if (student.school_id) {
      activeSessionQuery = activeSessionQuery.eq('school_id', student.school_id);
    }

    const { data: activeSessions } = await activeSessionQuery.order('started_at', { ascending: false }).limit(1);
    const activeSession = activeSessions?.[0] || null;

    // 4. Query Route Stops if route exists
    let stops: any[] = [];
    if (morningRoute?.id) {
      const { data: stopRows } = await supabase
        .from('transport_route_stops')
        .select('*')
        .eq('route_id', morningRoute.id)
        .order('stop_number', { ascending: true });
      stops = stopRows || [];
    }

    // 5. If NO active trip in DB, return inactive state
    if (!activeSession) {
      return NextResponse.json({
        success: true,
        hasActiveJourney: false,
        child: {
          id: student.id,
          name: `${student.first_name} ${student.last_name}`,
        },
        route: morningRoute ? {
          id: morningRoute.id,
          name: morningRoute.name,
          code: morningRoute.code,
          vehicleModel: vehicle ? `${vehicle.make} ${vehicle.model}` : 'Assigned School Bus',
          licensePlate: vehicle?.reg_number || '—',
          escortName: escort?.full_name || 'Assigned Escort',
          escortPhone: escort?.phone || '',
          escortCode: escort?.id || 'ESC',
          stopsCount: stops.length,
        } : null,
        message: 'No active journey in progress for this student right now.',
        timestamp: nowUtcIso(),
      });
    }

    // 6. Active Trip Found in PostgreSQL DB: return live database fields
    return NextResponse.json({
      success: true,
      hasActiveJourney: true,
      sessionId: activeSession.id,
      child: {
        id: student.id,
        name: `${student.first_name} ${student.last_name}`,
      },
      escort: {
        name: activeSession.escort_id || escort?.full_name || 'Assigned Escort',
        code: activeSession.escort_id || escort?.id || 'ESC-ID',
        phone: escort?.phone || '',
      },
      vehicle: {
        model: vehicle ? `${vehicle.make} ${vehicle.model}` : 'School Bus',
        licensePlate: vehicle?.reg_number || '—',
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
        currentLat: activeSession.current_lat,
        currentLng: activeSession.current_lng,
        speedKmh: activeSession.current_speed_kmh || 0,
        heading: activeSession.current_heading || 0,
        currentStopIndex: activeSession.current_stop_index || 0,
        batteryLevel: activeSession.battery_level,
        lastPingAt: activeSession.last_ping_at,
      },
      timestamp: nowUtcIso(),
    });
  } catch (err: any) {
    console.error('[parent/live-tracking GET] Error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
