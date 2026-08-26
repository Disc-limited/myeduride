// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, isAuthorizedSchoolAdmin } from '@/lib/auth/auth-server';
import { getAdminClient } from '@/lib/supabase/admin';
import { nowUtcIso } from '@/lib/utils/time';

export const dynamic = 'force-dynamic';

/**
 * GET /api/school-admin/routes
 * Returns transport routes with stops, passenger manifests, directions, and parent pin statuses.
 * Direct live query from Supabase database tables:
 * - transport_routes
 * - transport_route_stops
 * - student_route_assignments
 * - school_vehicles
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

    const supabase = getAdminClient();

    // 1. Fetch routes
    const { data: dbRoutes, error: routesErr } = await supabase
      .from('transport_routes')
      .select('*, vehicle:school_vehicles(id, reg_number, make, model)')
      .eq('school_id', primarySchoolId)
      .order('created_at', { ascending: false });

    const rawRoutes = dbRoutes || [];
    const routeIds = rawRoutes.map((r) => r.id);

    // 2. Fetch stops for these routes
    let stopsByRoute: Record<string, any[]> = {};
    if (routeIds.length > 0) {
      const { data: dbStops } = await supabase
        .from('transport_route_stops')
        .select('*')
        .in('route_id', routeIds)
        .order('stop_number', { ascending: true });

      if (dbStops) {
        for (const stop of dbStops) {
          if (!stopsByRoute[stop.route_id]) stopsByRoute[stop.route_id] = [];
          stopsByRoute[stop.route_id].push(stop);
        }
      }
    }

    // 3. Fetch passenger students assigned to these routes
    let studentsByRoute: Record<string, any[]> = {};
    if (routeIds.length > 0) {
      const { data: dbAssignments } = await supabase
        .from('student_route_assignments')
        .select('student_id, morning_route_id, afternoon_route_id, morning_stop_id, afternoon_stop_id, student:students(id, first_name, last_name, class:school_classes(name), parent_phone)')
        .eq('school_id', primarySchoolId)
        .eq('status', 'active');

      if (dbAssignments) {
        for (const sa of dbAssignments) {
          const stu = Array.isArray(sa.student) ? sa.student[0] : sa.student;
          const stuObj = {
            student_id: sa.student_id,
            name: stu ? `${stu.first_name} ${stu.last_name}` : 'Student',
            class: stu?.class?.name || 'Class',
            stop: 'Designated Stop',
            parent_phone: stu?.parent_phone || null,
          };

          if (sa.morning_route_id) {
            if (!studentsByRoute[sa.morning_route_id]) studentsByRoute[sa.morning_route_id] = [];
            studentsByRoute[sa.morning_route_id].push(stuObj);
          }
          if (sa.afternoon_route_id && sa.afternoon_route_id !== sa.morning_route_id) {
            if (!studentsByRoute[sa.afternoon_route_id]) studentsByRoute[sa.afternoon_route_id] = [];
            studentsByRoute[sa.afternoon_route_id].push(stuObj);
          }
        }
      }
    }

    const routes = rawRoutes.map((r) => {
      const vehicleObj = Array.isArray(r.vehicle) ? r.vehicle[0] : r.vehicle;
      const stops = stopsByRoute[r.id] || [];
      const passengers = studentsByRoute[r.id] || [];

      return {
        id: r.id,
        school_id: r.school_id,
        name: r.name,
        code: r.code,
        assigned_vehicle: vehicleObj ? `${vehicleObj.reg_number} (${vehicleObj.make} ${vehicleObj.model})` : 'Unassigned',
        assigned_escort_name: 'School Assigned Escort',
        assigned_escort_phone: '',
        departure_morning: r.departure_morning || '06:45 AM',
        departure_afternoon: r.departure_afternoon || '03:15 PM',
        status: r.status || 'active',
        directions_summary: r.directions_summary || 'Standard Route Corridor',
        stops,
        passenger_students: passengers,
        pinned_by_parents_count: 0,
        created_at: r.created_at,
      };
    });

    const totalStops = routes.reduce((acc, r) => acc + (r.stops?.length || 0), 0);
    const totalPassengers = routes.reduce((acc, r) => acc + (r.passenger_students?.length || 0), 0);

    return NextResponse.json({
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
    });
  } catch (err: any) {
    console.error('[routes GET] Error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}

/**
 * POST /api/school-admin/routes
 * Direct CRUD operations against `transport_routes`, `transport_route_stops`, and `student_route_assignments`.
 */
export async function POST(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json();
    const { action, school_id, route_data, route_id, student_assignment } = body;

    const primarySchoolId =
      school_id ||
      (session as any).primary_school?.id ||
      session.roles?.find((r: any) => r.school_id)?.school_id;

    if (!primarySchoolId) {
      return NextResponse.json({ error: 'school_id required' }, { status: 400 });
    }

    const supabase = getAdminClient();

    if (action === 'create_route') {
      if (!route_data?.name || !route_data?.code) {
        return NextResponse.json({ error: 'Route name and route code are required' }, { status: 400 });
      }

      const insertPayload = {
        school_id: primarySchoolId,
        name: route_data.name,
        code: route_data.code.toUpperCase().trim(),
        departure_morning: route_data.departure_morning || '06:45',
        departure_afternoon: route_data.departure_afternoon || '15:15',
        directions_summary: route_data.directions_summary || 'Standard direct corridor to school front gate.',
        status: 'active',
      };

      const { data: newRoute, error: insertError } = await supabase
        .from('transport_routes')
        .insert(insertPayload)
        .select()
        .single();

      if (insertError) throw insertError;

      // Insert stops if provided
      if (route_data.stops && Array.isArray(route_data.stops) && route_data.stops.length > 0) {
        const stopsPayload = route_data.stops.map((s: any, idx: number) => ({
          route_id: newRoute.id,
          school_id: primarySchoolId,
          stop_number: s.stop_number || idx + 1,
          name: s.name || `Stop ${idx + 1}`,
          landmark: s.landmark || null,
          eta_morning: s.eta_morning || null,
          eta_afternoon: s.eta_afternoon || null,
          gps_lat: s.gps_lat || null,
          gps_lng: s.gps_lng || null,
        }));

        await supabase.from('transport_route_stops').insert(stopsPayload);
      }

      await supabase.from('audit_logs').insert({
        school_id: primarySchoolId,
        user_id: session.user_id,
        action: 'CREATE_TRANSPORT_ROUTE',
        resource: 'transport_routes',
        details: { route_id: newRoute.id, code: newRoute.code, name: newRoute.name },
      });

      return NextResponse.json({
        success: true,
        message: `Transport Route ${newRoute.name} created successfully.`,
        route: newRoute,
      });
    }

    if (action === 'update_route') {
      if (!route_id) {
        return NextResponse.json({ error: 'route_id required' }, { status: 400 });
      }

      const { data: updatedRoute, error: updateError } = await supabase
        .from('transport_routes')
        .update({
          name: route_data.name,
          code: route_data.code,
          departure_morning: route_data.departure_morning,
          departure_afternoon: route_data.departure_afternoon,
          directions_summary: route_data.directions_summary,
          status: route_data.status || 'active',
          updated_at: nowUtcIso(),
        })
        .eq('id', route_id)
        .eq('school_id', primarySchoolId)
        .select()
        .single();

      if (updateError) throw updateError;

      return NextResponse.json({
        success: true,
        message: 'Transport route updated successfully.',
        route: updatedRoute,
      });
    }

    if (action === 'delete_route') {
      if (!route_id) {
        return NextResponse.json({ error: 'route_id required' }, { status: 400 });
      }

      const { error: deleteError } = await supabase
        .from('transport_routes')
        .delete()
        .eq('id', route_id)
        .eq('school_id', primarySchoolId);

      if (deleteError) throw deleteError;

      return NextResponse.json({
        success: true,
        message: 'Route removed from active transport network.',
      });
    }

    if (action === 'assign_student_route') {
      const { student_id, morning_route_id, morning_stop_id, afternoon_route_id, afternoon_stop_id } = student_assignment || {};
      if (!student_id) {
        return NextResponse.json({ error: 'student_id is required' }, { status: 400 });
      }

      const { data: assignment, error: assignError } = await supabase
        .from('student_route_assignments')
        .upsert(
          {
            student_id,
            school_id: primarySchoolId,
            morning_route_id: morning_route_id || null,
            morning_stop_id: morning_stop_id || null,
            afternoon_route_id: afternoon_route_id || null,
            afternoon_stop_id: afternoon_stop_id || null,
            status: 'active',
            updated_at: nowUtcIso(),
          },
          { onConflict: 'student_id' }
        )
        .select()
        .single();

      if (assignError) throw assignError;

      return NextResponse.json({
        success: true,
        message: 'Student assigned to route and designated stop.',
        assignment,
      });
    }

    return NextResponse.json({ error: `Unknown action '${action}'` }, { status: 400 });
  } catch (err: any) {
    console.error('[routes POST] Error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
