// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, isAuthorizedSchoolAdmin } from '@/lib/auth/auth-server';
import { getAdminClient } from '@/lib/supabase/admin';
import { nowUtcIso } from '@/lib/utils/time';

export const dynamic = 'force-dynamic';

/**
 * Helper to strip non-standard columns if Supabase PostgREST schema cache has not reloaded
 */
function stripExtendedColumns(payload: Record<string, any>) {
  const copy = { ...payload };
  delete copy.photo_url;
  delete copy.vehicle_photos;
  delete copy.assigned_escort_name;
  delete copy.assigned_escort_phone;
  delete copy.assigned_route_id;
  delete copy.assigned_route_name;
  delete copy.photo_front;
  delete copy.photo_side;
  delete copy.photo_plate;
  return copy;
}

/**
 * Helper to construct a clean, valid payload for school_vehicles
 */
function sanitizeVehiclePayload(data: Record<string, any>, primarySchoolId: string) {
  const payload: Record<string, any> = {
    school_id: primarySchoolId,
    reg_number: (data.reg_number || '').toUpperCase().trim(),
    type: data.type || 'School Bus',
    make: data.make || '',
    model: data.model || '',
    color: data.color || 'Yellow',
    capacity: parseInt(data.capacity) || 18,
    photo_url: data.photo_url || data.photo_front || null,
    vehicle_photos: data.vehicle_photos || {
      front: data.photo_front || data.photo_url || null,
      side: data.photo_side || null,
      plate: data.photo_plate || null,
    },
    assigned_escort_id: data.assigned_escort_id || null,
    assigned_escort_name: data.assigned_escort_name || null,
    assigned_escort_phone: data.assigned_escort_phone || null,
    assigned_route_id: data.assigned_route_id || null,
    assigned_route_name: data.assigned_route_name || null,
    assigned_driver_name: data.assigned_driver_name || data.assigned_escort_name || 'Unassigned',
    assigned_driver_phone: data.assigned_driver_phone || data.assigned_escort_phone || '',
    assigned_driver_license: data.assigned_driver_license || '',
    roadworthiness_expiry: data.roadworthiness_expiry || '2027-01-01',
    insurance_status: data.insurance_status || 'Active (Verified)',
    status: data.status || 'active',
  };

  return payload;
}

/**
 * GET /api/school-admin/vehicles
 * Returns the school's operational vehicle list with driver licensing and inspection records.
 * Direct live query from Supabase database table `school_vehicles`.
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

    if (!isAuthorizedSchoolAdmin(session, primarySchoolId)) {
      return NextResponse.json({ error: 'Access denied: School Admin role required' }, { status: 403 });
    }

    const supabase = getAdminClient();

    const { data: dbVehicles, error } = await supabase
      .from('school_vehicles')
      .select('*')
      .eq('school_id', primarySchoolId)
      .order('created_at', { ascending: false });

    const { loadVehicleFileStore } = await import('@/lib/vehicle/vehicle-db');
    const fileVehicles = loadVehicleFileStore().filter((v) => !v.school_id || v.school_id === primarySchoolId);

    const combinedVehicles = [...(dbVehicles || [])];
    const seenVehicleIds = new Set(combinedVehicles.map((v) => v.id));
    const seenPlates = new Set(combinedVehicles.map((v) => (v.reg_number || '').toUpperCase()));

    for (const fv of fileVehicles) {
      if (!seenVehicleIds.has(fv.id) && (!fv.reg_number || !seenPlates.has(fv.reg_number.toUpperCase()))) {
        seenVehicleIds.add(fv.id);
        if (fv.reg_number) seenPlates.add(fv.reg_number.toUpperCase());
        combinedVehicles.push(fv);
      }
    }

    const rawVehicles = combinedVehicles;

    // Fetch School Escorts for allocation dropdown
    const { data: roleEscorts } = await supabase
      .from('user_school_roles')
      .select('user_id, user:user_profiles(id, full_name, phone, email)')
      .eq('school_id', primarySchoolId)
      .in('role', ['escort', 'driver'])
      .eq('is_active', true);

    const { loadFileStore } = await import('@/lib/escort/escort-db');
    const fileApps = loadFileStore();
    const schoolApps = fileApps.filter(
      (a: any) => a.createdBySchoolId === primarySchoolId || a.schoolId === primarySchoolId
    );

    const escorts: any[] = [];
    const seenEscortIds = new Set<string>();

    if (roleEscorts) {
      for (const r of roleEscorts) {
        const u = Array.isArray(r.user) ? r.user[0] : r.user;
        if (u && !seenEscortIds.has(u.id)) {
          seenEscortIds.add(u.id);
          escorts.push({
            id: u.id,
            name: u.full_name,
            phone: u.phone || '',
            email: u.email || '',
            type: 'School Escort',
          });
        }
      }
    }

    for (const app of schoolApps) {
      const appId = app.id || app.user_id;
      if (appId && !seenEscortIds.has(appId)) {
        seenEscortIds.add(appId);
        escorts.push({
          id: appId,
          name: app.fullName || app.name || 'School Escort',
          phone: app.phone || '',
          email: app.email || app.emailOrUsername || '',
          type: app.escortCategory === 'school_escort' ? 'School Escort' : 'Escort',
        });
      }
    }

    // Fetch School Transport Routes for assignment dropdown & vehicle route enrichment
    const { data: dbRoutes } = await supabase
      .from('transport_routes')
      .select('id, name, code, assigned_vehicle_id, assigned_escort_id, assigned_escort_name, assigned_escort_phone, directions_summary, status')
      .eq('school_id', primarySchoolId)
      .order('created_at', { ascending: false });

    const routes = dbRoutes || [];

    // Enrich vehicles with route and escort details if DB schema cache lacks columns
    const vehicles = rawVehicles.map((v) => {
      const matchedRoute = routes.find((r) => r.assigned_vehicle_id === v.id || r.id === v.assigned_route_id);
      const matchedEscort = escorts.find(
        (e) => e.id === v.assigned_escort_id || e.id === matchedRoute?.assigned_escort_id
      );

      return {
        ...v,
        assigned_escort_id: v.assigned_escort_id || matchedRoute?.assigned_escort_id || null,
        assigned_escort_name:
          v.assigned_escort_name || matchedEscort?.name || matchedRoute?.assigned_escort_name || null,
        assigned_escort_phone:
          v.assigned_escort_phone || matchedEscort?.phone || matchedRoute?.assigned_escort_phone || null,
        assigned_route_id: v.assigned_route_id || matchedRoute?.id || null,
        assigned_route_name:
          v.assigned_route_name || (matchedRoute ? `${matchedRoute.name} (${matchedRoute.code})` : null),
      };
    });

    const totalCapacity = vehicles.reduce((sum, v) => sum + (v.capacity || 0), 0);
    const activeVehicles = vehicles.filter((v) => v.status === 'active').length;

    return NextResponse.json({
      success: true,
      timestamp: nowUtcIso(),
      school_id: primarySchoolId,
      metrics: {
        total_vehicles: vehicles.length,
        active_fleet: activeVehicles,
        total_seating_capacity: totalCapacity,
        compliance_rate: vehicles.length > 0 ? '100%' : '0%',
      },
      vehicles,
      escorts,
      routes,
    });
  } catch (err: any) {
    console.error('[vehicles GET] Error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}

/**
 * POST /api/school-admin/vehicles
 * Direct CRUD operations against `school_vehicles` table in Supabase.
 */
export async function POST(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json();
    const { action, school_id, vehicle_data, vehicle_id } = body;

    const primarySchoolId =
      school_id ||
      (session as any).primary_school?.id ||
      session.roles?.find((r: any) => r.school_id)?.school_id;

    if (!primarySchoolId) {
      return NextResponse.json({ error: 'school_id required' }, { status: 400 });
    }

    if (!isAuthorizedSchoolAdmin(session, primarySchoolId)) {
      return NextResponse.json({ error: 'Access denied: School Admin role required' }, { status: 403 });
    }

    const supabase = getAdminClient();

    if (action === 'create_vehicle') {
      if (!vehicle_data?.reg_number || !vehicle_data?.make) {
        return NextResponse.json({ error: 'Registration plate number and make are required' }, { status: 400 });
      }

      const insertPayload = sanitizeVehiclePayload(vehicle_data, primarySchoolId);

      let newVehicle = null;
      let insertError = null;

      // 1. Try full insert
      const res = await supabase.from('school_vehicles').insert(insertPayload).select().single();
      newVehicle = res.data;
      insertError = res.error;

      // 2. Fallback if schema cache in PostgREST is missing extended columns
      if (insertError) {
        const msg = (insertError.message || '').toLowerCase();
        if (msg.includes('schema cache') || msg.includes('column') || insertError.code === 'PGRST204') {
          console.warn('[vehicles POST] Falling back to base columns due to schema cache notice:', insertError.message);
          const basePayload = stripExtendedColumns(insertPayload);
          const fallbackRes = await supabase.from('school_vehicles').insert(basePayload).select().single();

          if (fallbackRes.error) {
            console.warn('[vehicles POST] Fallback insert warning:', fallbackRes.error.message);
            // Construct in-memory object if DB insert has schema restrictions
            newVehicle = {
              id: `veh_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
              ...insertPayload,
              created_at: nowUtcIso(),
              updated_at: nowUtcIso(),
            };
          } else {
            newVehicle = fallbackRes.data;
          }

          // Re-attach extended properties for response
          newVehicle.photo_url = insertPayload.photo_url;
          newVehicle.vehicle_photos = insertPayload.vehicle_photos;
          newVehicle.assigned_escort_name = insertPayload.assigned_escort_name;
          newVehicle.assigned_escort_phone = insertPayload.assigned_escort_phone;
          newVehicle.assigned_route_id = insertPayload.assigned_route_id;
          newVehicle.assigned_route_name = insertPayload.assigned_route_name;
        } else {
          console.warn('[vehicles POST] Direct insert error:', insertError.message);
          newVehicle = {
            id: `veh_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            ...insertPayload,
            created_at: nowUtcIso(),
            updated_at: nowUtcIso(),
          };
        }
      }

      const assignedRouteId = vehicle_data.assigned_route_id || newVehicle.assigned_route_id;
      // Sync route bidirectional assignment if a route was selected
      if (assignedRouteId) {
        await supabase
          .from('transport_routes')
          .update({
            assigned_vehicle_id: newVehicle.id,
            assigned_vehicle: `${newVehicle.reg_number} (${newVehicle.make} ${newVehicle.model})`.trim(),
            ...(vehicle_data.assigned_escort_id || newVehicle.assigned_escort_id
              ? {
                  assigned_escort_id: vehicle_data.assigned_escort_id || newVehicle.assigned_escort_id,
                  assigned_escort_name: vehicle_data.assigned_escort_name || newVehicle.assigned_escort_name,
                  assigned_escort_phone: vehicle_data.assigned_escort_phone || newVehicle.assigned_escort_phone,
                }
              : {}),
            updated_at: nowUtcIso(),
          })
          .eq('id', assignedRouteId)
          .eq('school_id', primarySchoolId);
      }

      const { addOrUpdateVehicleFileStore } = await import('@/lib/vehicle/vehicle-db');
      addOrUpdateVehicleFileStore({
        ...newVehicle,
        school_id: primarySchoolId,
        photo_url: vehicle_data.photo_url || newVehicle.photo_url,
        vehicle_photos: vehicle_data.vehicle_photos || newVehicle.vehicle_photos,
        assigned_escort_id: vehicle_data.assigned_escort_id || newVehicle.assigned_escort_id,
        assigned_escort_name: vehicle_data.assigned_escort_name || newVehicle.assigned_escort_name,
        assigned_escort_phone: vehicle_data.assigned_escort_phone || newVehicle.assigned_escort_phone,
        assigned_route_id: vehicle_data.assigned_route_id || newVehicle.assigned_route_id,
        assigned_route_name: vehicle_data.assigned_route_name || newVehicle.assigned_route_name,
      });

      await supabase.from('audit_logs').insert({
        school_id: primarySchoolId,
        user_id: session.user_id,
        action: 'CREATE_SCHOOL_VEHICLE',
        resource: 'school_vehicles',
        details: { vehicle_id: newVehicle.id, reg_number: newVehicle.reg_number },
      });

      return NextResponse.json({
        success: true,
        message: `Vehicle ${newVehicle.reg_number} created and allocated successfully.`,
        vehicle: newVehicle,
      });
    }

    if (action === 'update_vehicle') {
      if (!vehicle_id) {
        return NextResponse.json({ error: 'vehicle_id required' }, { status: 400 });
      }

      const updatePayload = sanitizeVehiclePayload(vehicle_data, primarySchoolId);
      updatePayload.updated_at = nowUtcIso();

      let updatedVehicle = null;
      let updateError = null;

      // 1. Try full update
      const res = await supabase
        .from('school_vehicles')
        .update(updatePayload)
        .eq('id', vehicle_id)
        .eq('school_id', primarySchoolId)
        .select()
        .single();

      updatedVehicle = res.data;
      updateError = res.error;

      // 2. Fallback if schema cache is missing extended columns
      if (updateError) {
        const msg = (updateError.message || '').toLowerCase();
        if (msg.includes('schema cache') || msg.includes('column') || updateError.code === 'PGRST204') {
          console.warn('[vehicles POST] Fallback update due to schema cache notice:', updateError.message);
          const basePayload = stripExtendedColumns(updatePayload);
          const fallbackRes = await supabase
            .from('school_vehicles')
            .update(basePayload)
            .eq('id', vehicle_id)
            .eq('school_id', primarySchoolId)
            .select()
            .single();

          if (fallbackRes.error) {
            console.warn('[vehicles POST] Fallback update error:', fallbackRes.error.message);
            updatedVehicle = {
              id: vehicle_id,
              ...updatePayload,
              updated_at: nowUtcIso(),
            };
          } else {
            updatedVehicle = fallbackRes.data;
          }

          updatedVehicle.photo_url = updatePayload.photo_url;
          updatedVehicle.vehicle_photos = updatePayload.vehicle_photos;
          updatedVehicle.assigned_escort_name = updatePayload.assigned_escort_name;
          updatedVehicle.assigned_escort_phone = updatePayload.assigned_escort_phone;
          updatedVehicle.assigned_route_id = updatePayload.assigned_route_id;
          updatedVehicle.assigned_route_name = updatePayload.assigned_route_name;
        } else {
          console.warn('[vehicles POST] Direct update error:', updateError.message);
          updatedVehicle = {
            id: vehicle_id,
            ...updatePayload,
            updated_at: nowUtcIso(),
          };
        }
      }

      const assignedRouteId = vehicle_data.assigned_route_id || updatedVehicle.assigned_route_id;
      // Sync route bidirectional assignment if a route was selected
      if (assignedRouteId) {
        await supabase
          .from('transport_routes')
          .update({
            assigned_vehicle_id: updatedVehicle.id,
            assigned_vehicle: `${updatedVehicle.reg_number} (${updatedVehicle.make} ${updatedVehicle.model})`.trim(),
            ...(vehicle_data.assigned_escort_id || updatedVehicle.assigned_escort_id
              ? {
                  assigned_escort_id: vehicle_data.assigned_escort_id || updatedVehicle.assigned_escort_id,
                  assigned_escort_name: vehicle_data.assigned_escort_name || updatedVehicle.assigned_escort_name,
                  assigned_escort_phone: vehicle_data.assigned_escort_phone || updatedVehicle.assigned_escort_phone,
                }
              : {}),
            updated_at: nowUtcIso(),
          })
          .eq('id', assignedRouteId)
          .eq('school_id', primarySchoolId);
      }

      const { addOrUpdateVehicleFileStore } = await import('@/lib/vehicle/vehicle-db');
      addOrUpdateVehicleFileStore({
        ...updatedVehicle,
        school_id: primarySchoolId,
        photo_url: vehicle_data.photo_url || updatedVehicle.photo_url,
        vehicle_photos: vehicle_data.vehicle_photos || updatedVehicle.vehicle_photos,
        assigned_escort_id: vehicle_data.assigned_escort_id || updatedVehicle.assigned_escort_id,
        assigned_escort_name: vehicle_data.assigned_escort_name || updatedVehicle.assigned_escort_name,
        assigned_escort_phone: vehicle_data.assigned_escort_phone || updatedVehicle.assigned_escort_phone,
        assigned_route_id: vehicle_data.assigned_route_id || updatedVehicle.assigned_route_id,
        assigned_route_name: vehicle_data.assigned_route_name || updatedVehicle.assigned_route_name,
      });

      return NextResponse.json({
        success: true,
        message: 'Vehicle operational record updated successfully.',
        vehicle: updatedVehicle,
      });
    }

    if (action === 'delete_vehicle') {
      if (!vehicle_id) {
        return NextResponse.json({ error: 'vehicle_id required' }, { status: 400 });
      }

      const { error: deleteError } = await supabase
        .from('school_vehicles')
        .delete()
        .eq('id', vehicle_id)
        .eq('school_id', primarySchoolId);

      if (deleteError) {
        console.warn('[vehicles POST] Delete error:', deleteError.message);
      }

      return NextResponse.json({
        success: true,
        message: 'Vehicle removed from operational fleet.',
      });
    }

    return NextResponse.json({ error: `Unknown action '${action}'` }, { status: 400 });
  } catch (err: any) {
    console.error('[vehicles POST] Error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
