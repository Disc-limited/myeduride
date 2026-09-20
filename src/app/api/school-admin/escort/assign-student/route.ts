// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, isAuthorizedSchoolAdmin } from '@/lib/auth/auth-server';
import { getAdminClient } from '@/lib/supabase/admin';
import { getEscortApplications } from '@/lib/escort/escort-db';
import { nowUtcIso, todayInLagos } from '@/lib/utils/time';
import { calculateSchoolToHomeDistance, calculateEscortFare } from '@/lib/escort/escort-pricing';
import { getActiveCityPricing, toEscortFareOverrides, resolveCityKeyFromContext } from '@/lib/escort/city-pricing';
import { normalizeEscortTripType } from '@/lib/escort/normalize-trip-type';
import { notifyEscortAssignmentCreated } from '@/lib/notifications/escort-workflow-notify';
import { checkSchoolTimingClash, escortAllowsOverlappingPickup, validateEscortSchoolLimit } from '@/lib/escort/escort-scheduler';
import { isApprovedMyEduRideEscort, resolveEscortCategory } from '@/lib/escort/escort-category';
import { generateHandoverPin } from '@/lib/escort/handover-pin';

export const dynamic = 'force-dynamic';

/**
 * GET /api/school-admin/escort/assign-student
 * Returns:
 * 1. School details (including campus gate GPS for distance calculations)
 * 2. Students categorized into pinned (eligible) and unpinned (ineligible with warning)
 * 3. Available School Escorts (internal route personnel)
 * 4. Available MyEduRide Escorts (City Manager approved platform escorts)
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

    // 1. Fetch School Details
    const { data: school } = await supabase
      .from('schools')
      .select('id, name, address, gps_lat, gps_lng')
      .eq('id', primarySchoolId)
      .maybeSingle();

    // 2. Fetch all school students with their pinned home locations
    const { data: studentsData, error: stuErr } = await supabase
      .from('students')
      .select(`
        id,
        first_name,
        last_name,
        student_id_number,
        photo_url,
        house_address,
        house_lat,
        house_lng,
        house_landmark,
        house_notes,
        house_pinned_at,
        custom_fields,
        class:school_classes(id, name)
      `)
      .eq('school_id', primarySchoolId)
      .eq('is_active', true)
      .order('first_name');

    if (stuErr) throw stuErr;

    const formattedStudents = (studentsData || []).map((s: any) => {
      const cls = Array.isArray(s.class) ? s.class[0] : s.class;
      const resolvedAddress = (s.house_address && s.house_address.trim()) || (s.custom_fields?.address && String(s.custom_fields.address).trim()) || '';
      const rawLat = s.house_lat != null && !isNaN(Number(s.house_lat)) ? Number(s.house_lat) : (s.custom_fields?.house_lat != null && !isNaN(Number(s.custom_fields.house_lat)) ? Number(s.custom_fields.house_lat) : null);
      const rawLng = s.house_lng != null && !isNaN(Number(s.house_lng)) ? Number(s.house_lng) : (s.custom_fields?.house_lng != null && !isNaN(Number(s.custom_fields.house_lng)) ? Number(s.custom_fields.house_lng) : null);

      const isPinned =
        rawLat != null &&
        rawLng != null &&
        Boolean(resolvedAddress);

      const distance = isPinned
        ? calculateSchoolToHomeDistance(
            { gps_lat: school?.gps_lat, gps_lng: school?.gps_lng, address: school?.address },
            { house_lat: rawLat, house_lng: rawLng, house_address: resolvedAddress }
          )
        : null;

      return {
        id: s.id,
        name: `${s.first_name} ${s.last_name}`.trim(),
        first_name: s.first_name,
        last_name: s.last_name,
        student_id_number: s.student_id_number || '',
        photo_url: s.photo_url || null,
        class_name: cls?.name || 'Class N/A',
        house_address: resolvedAddress,
        house_lat: isPinned ? rawLat : null,
        house_lng: isPinned ? rawLng : null,
        house_landmark: s.house_landmark || s.custom_fields?.landmark || '',
        house_notes: s.house_notes || s.custom_fields?.notes || '',
        house_pinned_at: s.house_pinned_at || null,
        is_house_pinned: isPinned,
        estimated_distance_km: distance?.distanceKm ?? null,
      };
    });

    const pinnedStudents = formattedStudents.filter((s) => s.is_house_pinned);
    const unpinnedStudents = formattedStudents.filter((s) => !s.is_house_pinned);

    // 3. Fetch Escort Applications
    const allApps = await getEscortApplications().catch(() => []);

    // A. School Escorts (internal)
    const schoolEscorts = (allApps || [])
      .filter((e) => {
        if (resolveEscortCategory(e) !== 'school_escort') return false;
        const createdBySchool = e.createdBySchoolId === primarySchoolId || e.schoolId === primarySchoolId;
        return createdBySchool || !e.createdBySchoolId;
      })
      .map((e) => ({
        id: e.id,
        fullName: e.fullName || e.name || 'School Escort',
        full_name: e.fullName || e.name || 'School Escort',
        name: e.fullName || e.name || 'School Escort',
        phone: e.phone || '',
        escort_type: 'school_escort',
        operatingArea: e.operatingArea || 'School Bus Route',
        operating_area: e.operatingArea || 'School Bus Route',
        assignedVehicle: e.regNumber || e.assignedVehicle || 'School Fleet Bus',
        vehicle_plate: e.regNumber || e.assignedVehicle || 'School Fleet Bus',
        status: e.status || 'ACTIVE',
      }));

    // B. MyEduRide Escorts (platform vetted)
    const myedurideEscorts = (allApps || [])
      .filter((e) => isApprovedMyEduRideEscort(e))
      .map((e) => ({
        id: e.id,
        fullName: e.fullName || e.name || 'MyEduRide Escort',
        full_name: e.fullName || e.name || 'MyEduRide Escort',
        name: e.fullName || e.name || 'MyEduRide Escort',
        phone: e.phone || '',
        escort_type: 'myeduride_escort',
        operatingArea: e.operatingArea || e.city || 'Lagos Metropolis',
        operating_area: e.operatingArea || e.city || 'Lagos Metropolis',
        assignedVehicle: e.regNumber || 'Verified Vehicle',
        vehicle_plate: e.regNumber || 'Verified Vehicle',
        rating: e.rating || '4.8',
        status: e.status,
      }));

    // Fetch school routes
    const { data: dbRoutes } = await supabase
      .from('transport_routes')
      .select('id, code, name, assigned_escort_id, assigned_vehicle_id')
      .eq('school_id', primarySchoolId);

    return NextResponse.json({
      success: true,
      timestamp: nowUtcIso(),
      school: {
        id: school?.id || primarySchoolId,
        name: school?.name || 'School Campus',
        address: school?.address || '',
        gps_lat: school?.gps_lat ? Number(school.gps_lat) : null,
        gps_lng: school?.gps_lng ? Number(school.gps_lng) : null,
      },
      pinned_students: pinnedStudents,
      unpinned_students: unpinnedStudents,
      total_students_count: formattedStudents.length,
      pinned_count: pinnedStudents.length,
      unpinned_count: unpinnedStudents.length,
      school_escorts: schoolEscorts,
      myeduride_escorts: myedurideEscorts,
      routes: dbRoutes || [],
    });
  } catch (err: any) {
    console.error('[assign-student GET] Error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}

/**
 * POST /api/school-admin/escort/assign-student
 * Assigns a student with a verified PINNED address to an escort (School Escort or MyEduRide Escort).
 * Creates booking & assignment, informs City Manager, Parent, and Escort immediately.
 */
export async function POST(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json();
    const {
      escort_id,
      escort_type = 'myeduride_escort',
      school_id,
      pickup_time = '07:00',
      dropoff_time = '15:30',
      start_date,
      notes = '',
    } = body;
    const trip_type = normalizeEscortTripType(body.trip_type);
    const studentIds: string[] = Array.isArray(body.student_ids) && body.student_ids.length
      ? body.student_ids.filter(Boolean)
      : body.student_id
        ? [body.student_id]
        : [];
    const student_id = studentIds[0];

    const primarySchoolId =
      school_id ||
      (session as any).primary_school?.id ||
      session.roles?.find((r: any) => r.school_id)?.school_id;

    if (!primarySchoolId) {
      return NextResponse.json({ error: 'school_id could not be determined' }, { status: 400 });
    }

    if (!isAuthorizedSchoolAdmin(session, primarySchoolId)) {
      return NextResponse.json({ error: 'Access denied: School Admin role required' }, { status: 403 });
    }

    if (!studentIds.length || !escort_id) {
      return NextResponse.json({ error: 'Please select at least one pinned student and an escort' }, { status: 400 });
    }

    const supabase = getAdminClient();

    // 1. Fetch Student & School Details
    const [studentRes, schoolRes, escortRes, parentLinksRes] = await Promise.all([
      supabase
        .from('students')
        .select('id, first_name, last_name, student_id_number, photo_url, house_address, house_lat, house_lng, house_landmark, school_id')
        .eq('id', student_id)
        .maybeSingle(),
      supabase
        .from('schools')
        .select('id, name, address, gps_lat, gps_lng, student_gate_start, school_start_time, student_gate_end, dismissal_start_time')
        .eq('id', primarySchoolId)
        .maybeSingle(),
      supabase
        .from('escort_applications')
        .select('id, full_name, phone, email, status, escort_type, primary_school_id, secondary_school_id, application_data')
        .eq('id', escort_id)
        .maybeSingle(),
      supabase
        .from('student_parents')
        .select('parent_user_id')
        .eq('student_id', student_id),
    ]);

    const student = studentRes.data;
    let school = schoolRes.data;
    const escort = escortRes.data;

    if (!school && schoolRes.error) {
      const fallbackSchool = await supabase
        .from('schools')
        .select('id, name, address, gps_lat, gps_lng')
        .eq('id', primarySchoolId)
        .maybeSingle();
      school = fallbackSchool.data;
    }

    if (!student || student.school_id !== primarySchoolId) {
      return NextResponse.json({ error: 'Student not found or does not belong to your school' }, { status: 404 });
    }

    // STRICT PREREQUISITE CHECK: Student address MUST be pinned by parents!
    const isPinned =
      student.house_lat != null &&
      student.house_lng != null &&
      !isNaN(Number(student.house_lat)) &&
      !isNaN(Number(student.house_lng)) &&
      Boolean(student.house_address && student.house_address.trim());

    if (!isPinned) {
      console.warn('[assign-student] 400 unpinned', student.id);
      return NextResponse.json(
        {
          error:
            `Cannot assign ${student.first_name} ${student.last_name}: Address has not been pinned by parent yet. Only students with a confirmed pinned house address and coordinates can be assigned to an escort.`,
          unpinned: true,
        },
        { status: 400 }
      );
    }

    const { data: existingAssignment } = await supabase
      .from('escort_assignments')
      .select('id, status, escort_application_id')
      .eq('school_id', primarySchoolId)
      .eq('student_id', student.id)
      .in('status', ['active', 'pending_confirmation', 'pending'])
      .limit(1)
      .maybeSingle();

    if (existingAssignment) {
      if (existingAssignment.escort_application_id === escort_id) {
        return NextResponse.json({
          success: true,
          already_assigned: true,
          message: `${student.first_name} ${student.last_name} is already assigned to this escort.`,
          assignment: existingAssignment,
        });
      }
      console.warn('[assign-student] 400 already assigned to another escort', student.id);
      return NextResponse.json(
        {
          error: `${student.first_name} ${student.last_name} is already assigned to another escort. Unassign that student first.`,
          already_assigned: true,
        },
        { status: 400 }
      );
    }

    // 1.5 School Assignment & Timing Clash Verification
    const resolvedEscortType =
      (escort ? resolveEscortCategory(escort) : null) || escort_type || 'myeduride_escort';
    const isMyEduRide = resolvedEscortType === 'myeduride_escort';

    const limitCheck = await validateEscortSchoolLimit(supabase, escort_id, primarySchoolId, {
      isMyEduRide,
      escortType: resolvedEscortType,
    });
    if (!limitCheck.allowed) {
      console.warn('[assign-student] 400 school limit', limitCheck.error);
      return NextResponse.json({ error: limitCheck.error }, { status: 400 });
    }

    const allowsSameTimePickup = escortAllowsOverlappingPickup(resolvedEscortType) || escortAllowsOverlappingPickup(escort_type);

    // Second school: school escorts still need a travel buffer. MyEduRide escorts may pick both at the same time.
    const otherSchoolId = limitCheck.currentSchoolIds.find((id) => id !== primarySchoolId);
    let dualSchoolClash: ReturnType<typeof checkSchoolTimingClash> | null = null;
    if (otherSchoolId) {
      const { data: otherSchool } = await supabase
        .from('schools')
        .select('id, name, student_gate_start, school_start_time, student_gate_end, dismissal_start_time')
        .eq('id', otherSchoolId)
        .maybeSingle();

      if (otherSchool && school) {
        const clashResult = checkSchoolTimingClash(school, otherSchool, 45);
        if (clashResult.hasClash) {
          if (!allowsSameTimePickup) {
            return NextResponse.json(
              {
                error: `Dual-school timing clash detected: ${clashResult.reason}`,
                timing_clash: true,
                clash_details: clashResult,
              },
              { status: 400 }
            );
          }
          dualSchoolClash = clashResult;
        }
      }
    }

    const escortName = escort?.full_name || 'Assigned Escort';
    const escortPhone = escort?.phone || '';

    // 2. Compute Distance & Fares automatically
    const distanceResult = calculateSchoolToHomeDistance(
      { gps_lat: school?.gps_lat, gps_lng: school?.gps_lng, address: school?.address },
      { house_lat: student.house_lat, house_lng: student.house_lng, house_address: student.house_address }
    );

    const resolvedCityKey = resolveCityKeyFromContext([
      school?.location_address,
      school?.address,
      school?.name,
      escort?.operating_area,
      escort?.city,
      student.house_address,
    ]);
    const cityPricing = await getActiveCityPricing(resolvedCityKey);
    const fareResult = calculateEscortFare(
      distanceResult.distanceKm,
      trip_type,
      toEscortFareOverrides(cityPricing)
    );

    const parentUserIds = (parentLinksRes.data || []).map((p) => p.parent_user_id).filter(Boolean);
    const primaryParentId = parentUserIds[0] || null;

    const today = todayInLagos();
    const nowIso = nowUtcIso();
    const pickupDate = /^\d{4}-\d{2}-\d{2}$/.test(String(start_date || '')) ? start_date : today;
    const requestedPickupIso = `${pickupDate}T${pickup_time.includes(':') ? pickup_time.slice(0, 5) : '07:00'}:00Z`;

    // 3. Booking Metadata structure
    const bookingMetadata = {
      source: 'school',
      assigned_by_user_id: session.user_id,
      escort_type,
      trip_type,
      pickup_time,
      dropoff_time,
      distance_km: distanceResult.distanceKm,
      distance_meters: distanceResult.distanceMeters,
      is_exact_coordinate: true,
      morning_fare: fareResult.morningFare,
      afternoon_fare: fareResult.afternoonFare,
      daily_fare: fareResult.dailyFare,
      formatted_morning_fare: fareResult.formattedMorningFare,
      formatted_afternoon_fare: fareResult.formattedAfternoonFare,
      formatted_daily_fare: fareResult.formattedDailyFare,
      distance_charge: fareResult.distanceCharge,
      service_charge: fareResult.serviceCharge,
      service_charge_percent: fareResult.serviceChargePercent,
      billable_km: fareResult.billableKm,
      rate_per_km: fareResult.ratePerKm,
      rate_per_half_km: fareResult.ratePerKm,
      agreed_rate_per_km: fareResult.ratePerKm,
      operating_city: resolvedCityKey,
      rate_per_tenth_km: 0,
      one_way_fare: fareResult.oneWayFare,
      assigned_escort_id: escort_id,
      assigned_escort_name: escortName,
      assigned_escort_phone: escortPhone,
      security_pin: generateHandoverPin(),
      security_pin_date: today,
      school_notes: notes || '',
      start_date: pickupDate,
      approval_status: 'PENDING_CITY_MANAGER_APPROVAL',
      created_at: nowIso,
    };

    // 4. Create Transport Booking Record
    const { data: newBooking, error: bookingErr } = await supabase
      .from('transport_bookings')
      .insert({
        school_id: primarySchoolId,
        student_id: student.id,
        parent_user_id: primaryParentId,
        source: 'school',
        pickup_address: student.house_address,
        pickup_lat: student.house_lat,
        pickup_lng: student.house_lng,
        requested_pickup_at: requestedPickupIso,
        notes: JSON.stringify(bookingMetadata),
        status: 'pending',
        priority: 'standard',
      })
      .select()
      .single();

    if (bookingErr) throw bookingErr;

    // 5. Create Escort Assignment Record
    const { data: newAssignment, error: assignErr } = await supabase
      .from('escort_assignments')
      .insert({
        booking_id: newBooking.id,
        escort_application_id: escort_id,
        school_id: primarySchoolId,
        student_id: student.id,
        assignment_type: 'standard',
        status: 'pending_confirmation',
        assigned_by: session.user_id,
        notes: `School Admin assigned ${escort_type === 'school_escort' ? 'School Escort' : 'MyEduRide Escort'} ${escortName} (${distanceResult.distanceKm} km). Awaiting City Manager immediate clearance.`,
        created_at: nowIso,
        updated_at: nowIso,
      })
      .select()
      .single();

    if (assignErr) throw assignErr;

    // 5.5 Link school on escort application & application_data.allocated_school_ids
    try {
      let curAppData: any = {};
      if (escort?.application_data) {
        try {
          curAppData = typeof escort.application_data === 'string'
            ? JSON.parse(escort.application_data)
            : escort.application_data;
        } catch {}
      }
      const curAllocated: string[] = Array.isArray(curAppData.allocated_school_ids)
        ? [...curAppData.allocated_school_ids]
        : [escort?.primary_school_id, escort?.secondary_school_id].filter(Boolean);
      if (!curAllocated.includes(primarySchoolId)) {
        curAllocated.push(primarySchoolId);
      }
      curAppData.allocated_school_ids = curAllocated;

      const appUpdates: Record<string, any> = {
        application_data: JSON.stringify(curAppData),
        updated_at: nowIso,
      };
      if (escort?.primary_school_id && escort.primary_school_id !== primarySchoolId && !escort?.secondary_school_id) {
        appUpdates.secondary_school_id = primarySchoolId;
      } else if (!escort?.primary_school_id) {
        appUpdates.primary_school_id = primarySchoolId;
      }
      await supabase
        .from('escort_applications')
        .update(appUpdates)
        .eq('id', escort_id);
    } catch (eErr) {
      console.warn('[assign-student] escort school link note:', eErr);
    }

    // 6. If School Escort, link to student route if route exists
    if (escort_type === 'school_escort') {
      try {
        const { data: route } = await supabase
          .from('transport_routes')
          .select('id')
          .eq('school_id', primarySchoolId)
          .eq('assigned_escort_id', escort_id)
          .maybeSingle();

        if (route) {
          await supabase.from('student_route_assignments').upsert({
            school_id: primarySchoolId,
            student_id: student.id,
            morning_route_id: route.id,
            afternoon_route_id: route.id,
            status: 'active',
            updated_at: nowIso,
          });
        }
      } catch (rtErr) {
        console.warn('[assign-student] Route linkage note:', rtErr);
      }
    }

    // 7. Audit Log
    try {
      await supabase.from('audit_logs').insert({
        school_id: primarySchoolId,
        user_id: session.user_id,
        action: 'ASSIGN_STUDENT_TO_ESCORT',
        resource: 'escort_assignments',
        details: {
          student_id: student.id,
          student_name: `${student.first_name} ${student.last_name}`,
          escort_id,
          escort_name: escortName,
          escort_type,
          distance_km: distanceResult.distanceKm,
          booking_id: newBooking.id,
          pinned_address: student.house_address,
          coordinates: { lat: student.house_lat, lng: student.house_lng },
        },
      });
    } catch (auditErr) {
      console.warn('[assign-student] Audit notice:', auditErr);
    }

    // 8. Immediately Inform City Manager, Parent, and Escort
    try {
      await notifyEscortAssignmentCreated({
        schoolId: primarySchoolId,
        studentId: student.id,
        escortId: escort_id,
        bookingId: newBooking.id,
        distanceKm: distanceResult.distanceKm,
        dailyFare: fareResult.dailyFare,
        formattedDailyFare: fareResult.formattedDailyFare,
        formattedMorningFare: fareResult.formattedMorningFare,
        formattedAfternoonFare: fareResult.formattedAfternoonFare,
        tripType: trip_type,
        escortName,
        studentName: `${student.first_name} ${student.last_name}`,
        schoolName: school?.name || 'School Campus',
      });
    } catch (notifyErr) {
      console.warn('[assign-student] Notification notice:', notifyErr);
    }

    return NextResponse.json({
      success: true,
      message: `Successfully assigned ${student.first_name} ${student.last_name} to ${escortName}! The City Manager has been notified to review and approve the assignment immediately.`,
      booking: newBooking,
      assignment: newAssignment,
      distance_km: distanceResult.distanceKm,
      fare: fareResult,
      pinned_address: student.house_address,
      dual_school: Boolean(otherSchoolId),
      same_time_pickup: Boolean(otherSchoolId) && allowsSameTimePickup,
      timing_notice: dualSchoolClash,
    });
  } catch (err: any) {
    console.error('[assign-student POST] Error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
