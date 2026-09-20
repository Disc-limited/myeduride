import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { getSessionFromRequest } from '@/lib/session';
import { todayInLagos, lagosDayBounds } from '@/lib/timezone';
import { getEscortApplications } from '@/lib/escort/escort-db';
import { findEscortApplicationForSession, resolveEscortCategory } from '@/lib/escort/escort-category';
import { nowUtcIso } from '@/lib/utils/time';
import { checkSchoolTimingClash } from '@/lib/escort/escort-scheduler';
import { calculateEscortFare } from '@/lib/escort/escort-pricing';
import {
  getActiveCityPricing,
  toEscortFareOverrides,
  resolveCityKeyFromContext,
  cityLabelForKey,
} from '@/lib/escort/city-pricing';
import { ensureAutoReadyForPickup, isDismissalWindowOpen } from '@/lib/gate/auto-ready-pickup';

export const dynamic = 'force-dynamic';

/**
 * GET /api/escorts/dashboard-live
 * Returns comprehensive, real live database data for the logged-in Escort user.
 */
export async function GET(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request);
    const supabase = getAdminClient();
    const today = todayInLagos();
    const { startIso, endIso } = lagosDayBounds();

    let escortProfile: any = null;
    let userProfile: any = null;
    let schoolData: any = null;

    // 1. Resolve ONLY the logged-in escort (avoid loading all applications)
    if (session?.user_id) {
      escortProfile = (await getEscortApplications(undefined, { applicationId: session.user_id }))[0] || null;
    }
    if (!escortProfile && session?.email) {
      try {
        const { data: byEmail } = await supabase
          .from('escort_applications')
          .select('id, user_id, email, full_name, escort_code, status, phone, photo, school_id, primary_school_id, secondary_school_id, ready_for_pickup, ready_for_pickup_at, today_trip_status, today_trip_declined_reason, today_trip_accepted_at, house_lat, house_lng, residential_address, closest_landmark, available_for_other_schools, escort_type, application_data, created_at')
          .ilike('email', session.email)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (byEmail) {
          escortProfile = (await getEscortApplications(undefined, { applicationId: byEmail.id }))[0] || byEmail;
        }
      } catch (err) {
        console.warn('[dashboard-live] email escort lookup notice:', err);
      }
    }

    // Username / fuzzy session match — needed when escort_applications.user_id is unset or id ≠ auth user
    if (!escortProfile && session) {
      try {
        const username = String(session.username || '').trim();
        if (username) {
          const { data: byUsernameProfile } = await supabase
            .from('user_profiles')
            .select('id, email')
            .eq('username', username)
            .maybeSingle();
          if (byUsernameProfile?.id) {
            escortProfile =
              (await getEscortApplications(undefined, { applicationId: byUsernameProfile.id }))[0] || null;
          }
        }

        if (!escortProfile) {
          const orFilters: string[] = [];
          if (session.user_id) {
            orFilters.push(`id.eq.${session.user_id}`, `user_id.eq.${session.user_id}`);
          }
          if (session.email) {
            orFilters.push(`email.ilike.${session.email}`);
          }
          if (username) {
            orFilters.push(`email.ilike.${username}@myeduride.local`, `escort_code.ilike.${username}`);
          }

          if (orFilters.length > 0) {
            const { data: candidates } = await supabase
              .from('escort_applications')
              .select('id')
              .or(orFilters.join(','))
              .order('created_at', { ascending: false })
              .limit(8);

            for (const row of candidates || []) {
              const hydrated =
                (await getEscortApplications(undefined, { applicationId: row.id }))[0] || null;
              if (hydrated) {
                escortProfile = hydrated;
                break;
              }
            }
          }
        }

        if (!escortProfile) {
          const allApps = await getEscortApplications(undefined, { includeDocuments: false });
          escortProfile = findEscortApplicationForSession(allApps, session);
        }
      } catch (err) {
        console.warn('[dashboard-live] session escort fallback notice:', err);
      }
    }

    // Dev-only fallback when no session
    if (!escortProfile && !session) {
      const allApps = await getEscortApplications();
      if (allApps.length > 0) escortProfile = allApps[0];
    }

    // Collect all unique identity tokens for this escort
    const escortIdentifiers = Array.from(
      new Set(
        [
          escortProfile?.id,
          escortProfile?.user_id,
          escortProfile?.escort_code,
          session?.user_id,
          session?.email,
        ].filter(Boolean)
      )
    );

    // 2. Fetch live user profile from user_profiles table
    if (session?.user_id) {
      try {
        const { data: prof } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('id', session.user_id)
          .maybeSingle();

        if (prof) {
          userProfile = prof;
        }
      } catch (err) {
        console.warn('[dashboard-live] user_profiles fetch notice:', err);
      }

      // Fetch linked school details via user_school_roles
      try {
        const { data: roleRow } = await supabase
          .from('user_school_roles')
          .select('school_id, schools(*)')
          .eq('user_id', session.user_id)
          .eq('is_active', true)
          .maybeSingle();

        if (roleRow?.schools) {
          schoolData = Array.isArray(roleRow.schools) ? roleRow.schools[0] : roleRow.schools;
        }
      } catch (err) {
        console.warn('[dashboard-live] user_school_roles fetch notice:', err);
      }
    }

    // If schoolData not found from user_school_roles, leave it empty.
    // Never pick an arbitrary platform school — that labels every student with the wrong campus.

    const schoolId = schoolData?.id;

    // 3. Fetch Assigned Route & Stops — only routes actually assigned to this escort
    let assignedRoute: any = null;
    let routeStops: any[] = [];
    let assignedVehicle: any = null;

    if (escortIdentifiers.length > 0) {
      const uuidIds = escortIdentifiers.filter((id) =>
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(id))
      );
      if (uuidIds.length > 0) {
        const { data: escortRoutes } = await supabase
          .from('transport_routes')
          .select('*')
          .eq('is_active', true)
          .or(
            [
              `assigned_escort_id.in.(${uuidIds.join(',')})`,
              `assigned_escort_user_id.in.(${uuidIds.join(',')})`,
            ].join(',')
          );

        if (escortRoutes && escortRoutes.length > 0) {
          assignedRoute =
            (schoolId && escortRoutes.find((r) => r.school_id === schoolId)) ||
            escortRoutes[0];
        }
      }
    }

    if (!assignedRoute && schoolId) {
      const { data: routes } = await supabase
        .from('transport_routes')
        .select('*')
        .eq('school_id', schoolId)
        .eq('is_active', true);

      if (routes && routes.length > 0) {
        assignedRoute =
          routes.find((r) =>
            escortIdentifiers.includes(r.assigned_escort_user_id) ||
            escortIdentifiers.includes(r.assigned_escort_id)
          ) || null;
      }
    }

    if (assignedRoute) {
      const { data: stops } = await supabase
        .from('transport_route_stops')
        .select('*')
        .eq('route_id', assignedRoute.id)
        .order('stop_order', { ascending: true });

      routeStops = stops || [];

      if (assignedRoute.assigned_vehicle_id) {
        const { data: vehicle } = await supabase
          .from('school_vehicles')
          .select('*')
          .eq('id', assignedRoute.assigned_vehicle_id)
          .maybeSingle();
        assignedVehicle = vehicle;
      }
    }

    if (!assignedVehicle) {
      const registeredName = escortProfile?.vehicle?.type || escortProfile?.vehicleType || escortProfile?.vehicle_type || null;
      const registeredPlate = escortProfile?.vehicle?.regNumber || escortProfile?.regNumber || escortProfile?.reg_number || null;
      const registeredCapacity = escortProfile?.vehicle?.seatCapacity || escortProfile?.seatCapacity || escortProfile?.seat_capacity || null;
      if (registeredName || registeredPlate) {
        assignedVehicle = {
          vehicle_name: registeredName,
          plate_number: registeredPlate,
          vehicle_type: registeredName,
          capacity: registeredCapacity != null ? Number(registeredCapacity) : null,
        };
      }
    }

    // 4. Query live City Manager escort_assignments across all escort identifiers
    let liveAssignments: any[] = [];
    try {
      if (escortIdentifiers.length > 0) {
        const { data: assignmentsData } = await supabase
          .from('escort_assignments')
          .select('*, school:schools(id, name, address, gps_lat, gps_lng, location_address)')
          .in('escort_application_id', escortIdentifiers)
          .in('status', ['active', 'pending_confirmation', 'pending'])
          .order('created_at', { ascending: false })
          .limit(50);

        if (assignmentsData && assignmentsData.length > 0) {
          liveAssignments = assignmentsData;
        }
      }
    } catch (err) {
      console.warn('[dashboard-live] escort_assignments query notice:', err);
    }

    // 4.1 Resolve assigned schools from live assignments first (the student's real campus)
    const unwrapRel = (rel: any) => (Array.isArray(rel) ? rel[0] : rel);
    const distinctSchoolIds = new Set<string>();
    for (const a of liveAssignments) {
      if (a.school_id) distinctSchoolIds.add(a.school_id);
    }
    if (escortProfile?.primary_school_id) distinctSchoolIds.add(escortProfile.primary_school_id);
    if (escortProfile?.secondary_school_id) distinctSchoolIds.add(escortProfile.secondary_school_id);
    if (escortProfile?.school_id) distinctSchoolIds.add(escortProfile.school_id);
    if (schoolId) distinctSchoolIds.add(schoolId);

    let assignedSchools: any[] = [];
    let dualSchoolSchedule: any = null;
    if (distinctSchoolIds.size > 0) {
      try {
        const { data: sList } = await supabase
          .from('schools')
          .select('id, name, address, gps_lat, gps_lng, student_gate_start, school_start_time, student_gate_end, dismissal_start_time, dismissal_end_time')
          .in('id', Array.from(distinctSchoolIds));
        if (sList && sList.length > 0) {
          assignedSchools = sList;
          const assignmentSchoolIds = liveAssignments.map((a) => a.school_id).filter(Boolean);
          const preferredSchool =
            sList.find((s: any) => assignmentSchoolIds.includes(s.id)) || sList[0];
          if (!schoolData?.id || (assignmentSchoolIds.length > 0 && !assignmentSchoolIds.includes(schoolData.id))) {
            schoolData = preferredSchool;
          }
        }

        if (assignedSchools.length >= 2) {
          const clash = checkSchoolTimingClash(assignedSchools[0], assignedSchools[1], 45);
          dualSchoolSchedule = {
            is_dual_school: true,
            school_a: assignedSchools[0],
            school_b: assignedSchools[1],
            clash_detected: clash.hasClash,
            clash_reason: clash.reason || null,
            morning_gap_mins: clash.morningGapMins,
            afternoon_gap_mins: clash.afternoonGapMins,
            school_a_times: clash.schoolATimes,
            school_b_times: clash.schoolBTimes,
            status_label: !clash.hasClash ? 'Dual-School Non-Clashing Schedule' : 'Schedule Clashing Alert',
          };
        }
      } catch (sErr) {
        console.warn('[dashboard-live] assigned schools query notice:', sErr);
      }
    }

    const assignmentSchoolIds = Array.from(
      new Set(liveAssignments.map((a) => a.school_id).filter(Boolean))
    );
    for (const assignedSchoolId of assignmentSchoolIds) {
      await ensureAutoReadyForPickup(supabase, assignedSchoolId);
    }
    if (escortProfile?.id && assignmentSchoolIds.length > 0) {
      try {
        const { data: refreshedReady } = await supabase
          .from('escort_applications')
          .select('ready_for_pickup, ready_for_pickup_at, operational_status')
          .eq('id', escortProfile.id)
          .maybeSingle();
        if (refreshedReady) {
          escortProfile.ready_for_pickup = refreshedReady.ready_for_pickup;
          escortProfile.ready_for_pickup_at = refreshedReady.ready_for_pickup_at;
          escortProfile.operational_status = refreshedReady.operational_status;
        }
      } catch (readyErr) {
        console.warn('[dashboard-live] auto-ready refresh notice:', readyErr);
      }
    }

    // 4.2 Fetch linked transport_bookings
    const assignmentBookingIds = liveAssignments.map((a) => a.booking_id).filter(Boolean);
    let liveBookings: any[] = [];
    try {
      let bQuery = supabase
        .from('transport_bookings')
        .select(`
          *,
          student:students(id, first_name, last_name, photo_url, student_id_number, house_address, house_lat, house_lng, house_landmark, house_notes, custom_fields, school_classes(name)),
          parent:user_profiles!parent_user_id(full_name, phone)
        `);

      if (assignmentBookingIds.length > 0) {
        const { data: bData } = await bQuery.in('id', assignmentBookingIds);
        if (bData) liveBookings = bData;
      }
    } catch (err) {
      console.warn('[dashboard-live] transport_bookings query notice:', err);
    }

    // 4.3 Aggregate all student IDs from routes, assignments, and bookings
    let routeStudentIds: string[] = [];
    if (assignedRoute) {
      const { data: rAssignments } = await supabase
        .from('student_route_assignments')
        .select('student_id')
        .eq('route_id', assignedRoute.id)
        .eq('is_active', true);

      if (rAssignments && rAssignments.length > 0) {
        routeStudentIds = rAssignments.map((a) => a.student_id);
      }
    }

    const approvedAssignments = liveAssignments.filter((a) => a.status === 'active' || a.status === 'completed');
    const cmStudentIds = approvedAssignments.map((a) => a.student_id).filter(Boolean);
    const bookingStudentIds = liveBookings.map((b) => b.student_id || b.student?.id).filter(Boolean);
    const allTargetStudentIds = Array.from(new Set([...routeStudentIds, ...cmStudentIds, ...bookingStudentIds]));

    let assignedStudents: any[] = [];
    if (allTargetStudentIds.length > 0) {
      const { data: stList } = await supabase
        .from('students')
        .select(`
          id, first_name, last_name, student_id_number, photo_url, is_active, school_id,
          house_address, house_lat, house_lng, house_landmark, house_notes, house_pinned_at, custom_fields,
          class:school_classes(name),
          school:schools(id, name, address, gps_lat, gps_lng, location_address)
        `)
        .in('id', allTargetStudentIds);

      assignedStudents = stList || [];
    }

    // Merge student objects directly attached in liveBookings into assignedStudents
    for (const b of liveBookings) {
      if (b.student) {
        const existingIdx = assignedStudents.findIndex((s) => s.id === b.student.id);
        const pickupAddr = b.pickup_address || b.student?.house_address || null;
        if (existingIdx >= 0) {
          assignedStudents[existingIdx].parent_name = b.parent?.full_name || assignedStudents[existingIdx].parent_name;
          assignedStudents[existingIdx].parent_phone = b.parent?.phone || assignedStudents[existingIdx].parent_phone;
          if (pickupAddr) {
            assignedStudents[existingIdx].pickup_address = pickupAddr;
          }
          if (assignedStudents[existingIdx].house_lat == null && b.pickup_lat != null) {
            assignedStudents[existingIdx].house_lat = b.pickup_lat;
          }
          if (assignedStudents[existingIdx].house_lng == null && b.pickup_lng != null) {
            assignedStudents[existingIdx].house_lng = b.pickup_lng;
          }
        } else {
          assignedStudents.push({
            id: b.student.id,
            first_name: b.student.first_name,
            last_name: b.student.last_name,
            student_id_number: b.student.student_id_number || null,
            photo_url: b.student.photo_url || null,
            is_active: true,
            class: b.student.school_classes || b.student.class,
            parent_name: b.parent?.full_name || null,
            parent_phone: b.parent?.phone || null,
            pickup_address: pickupAddr,
            house_address: b.student.house_address || pickupAddr,
            house_lat: b.student.house_lat ?? b.pickup_lat ?? null,
            house_lng: b.student.house_lng ?? b.pickup_lng ?? null,
            house_landmark: b.student.house_landmark || null,
            house_notes: b.student.house_notes || null,
            custom_fields: b.student.custom_fields || null,
          });
        }
      }
    }

    // 5. Fetch Today's Attendance for status reconciliation across all assigned schools
    let attendanceToday: any[] = [];
    if (allTargetStudentIds.length > 0) {
      const { data: att } = await supabase
        .from('attendance_records')
        .select('student_id, type, timestamp, school_id')
        .in('student_id', allTargetStudentIds)
        .gte('timestamp', startIso)
        .lte('timestamp', endIso);

      attendanceToday = att || [];
    }

    // Map students into rich manifest
    // Dynamically resolve City Manager agreed rates for the route corridor & operating territory
    const resolvedCityKey = resolveCityKeyFromContext([
      assignedRoute?.directions_summary,
      assignedRoute?.name,
      escortProfile?.operating_area,
      (escortProfile as any)?.operatingArea,
      escortProfile?.city,
      schoolData?.location_address,
      schoolData?.address,
      schoolData?.name,
      ...(assignedSchools || []).flatMap((s: any) => [s.location_address, s.address, s.name]),
    ]);
    const cityPricing = await getActiveCityPricing(resolvedCityKey);
    const fareRates = toEscortFareOverrides(cityPricing);

    const extractStoredFare = (stId: string): number | null => {
      const matchAssignment = liveAssignments.find((a) => a.student_id === stId);
      const matchBooking = liveBookings.find(
        (b) => b.student_id === stId || b.student?.id === stId || b.id === matchAssignment?.booking_id
      );

      if (matchAssignment?.daily_fare && Number(matchAssignment.daily_fare) > 0) {
        return Number(matchAssignment.daily_fare);
      }
      if (matchAssignment?.fare_amount && Number(matchAssignment.fare_amount) > 0) {
        return Number(matchAssignment.fare_amount);
      }
      if (matchBooking?.fare_amount && Number(matchBooking.fare_amount) > 0) {
        return Number(matchBooking.fare_amount);
      }
      if (matchBooking?.notes) {
        try {
          const parsed = typeof matchBooking.notes === 'string' ? JSON.parse(matchBooking.notes) : matchBooking.notes;
          if (parsed?.fareResult?.dailyFare) return Number(parsed.fareResult.dailyFare);
          if (parsed?.dailyFare) return Number(parsed.dailyFare);
          if (parsed?.daily_fare) return Number(parsed.daily_fare);
          if (parsed?.fare_amount) return Number(parsed.fare_amount);
          if (parsed?.distance_km != null) {
            return calculateEscortFare(
              Number(parsed.distance_km),
              parsed.trip_type === 'morning_only' || parsed.trip_type === 'afternoon_only' ? parsed.trip_type : 'both',
              fareRates
            ).dailyFare;
          }
        } catch {}
      }
      if (matchAssignment?.notes) {
        try {
          const parsed = typeof matchAssignment.notes === 'string' ? JSON.parse(matchAssignment.notes) : matchAssignment.notes;
          if (parsed?.fareResult?.dailyFare) return Number(parsed.fareResult.dailyFare);
          if (parsed?.dailyFare) return Number(parsed.dailyFare);
        } catch {
          const m = String(matchAssignment.notes).match(/₦\s*([\d,]+)/);
          if (m && m[1]) {
            const num = Number(m[1].replace(/,/g, ''));
            if (!isNaN(num) && num > 0) return num;
          }
        }
      }
      return null;
    };

    const extractDiscountInfo = (stId: string): any => {
      const matchAssignment = liveAssignments.find((a) => a.student_id === stId);
      const matchBooking = liveBookings.find(
        (b) => b.student_id === stId || b.student?.id === stId || b.id === matchAssignment?.booking_id
      );
      if (matchBooking?.notes) {
        try {
          const parsed = typeof matchBooking.notes === 'string' ? JSON.parse(matchBooking.notes) : matchBooking.notes;
          if (parsed?.discount) return parsed.discount;
        } catch {}
      }
      if (matchAssignment?.notes && String(matchAssignment.notes).includes('Accountant Discounted Fare')) {
        return {
          discountedFare: extractStoredFare(stId),
          note: matchAssignment.notes,
        };
      }
      return null;
    };

    const resolvedCategory = resolveEscortCategory(escortProfile);
    const isSchoolEscort = Boolean(
      escortProfile
        ? resolvedCategory === 'school_escort'
        : session?.roles?.some((r: any) => r.role === 'school_escort')
    );
    const escortCategory = isSchoolEscort ? 'school_escort' : 'myeduride_escort';
    if (dualSchoolSchedule) {
      dualSchoolSchedule.same_time_pickup_allowed = !isSchoolEscort;
      dualSchoolSchedule.status_label = !isSchoolEscort
        ? dualSchoolSchedule.clash_detected
          ? 'Dual-school same-time pickup'
          : 'Dual-school coverage'
        : dualSchoolSchedule.status_label;
    }

    const computeHaversineDistanceKm = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
      const R = 6371;
      const dLat = ((lat2 - lat1) * Math.PI) / 180;
      const dLon = ((lon2 - lon1) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return Math.round(R * c * 100) / 100;
    };

    // Query today's doorstep pickup & dropoff status for this escort
    let todayDailyTrips: any[] = [];
    try {
      if (escortIdentifiers.length > 0) {
        const { data: dTrips } = await supabase
          .from('escort_student_daily_trips')
          .select('*')
          .eq('trip_date', today)
          .in('escort_id', escortIdentifiers);

        if (dTrips) todayDailyTrips = dTrips;
      }
    } catch (err) {
      console.warn('[dashboard-live] daily trips fetch notice:', err);
    }

    // Map students into rich manifest with City Manager approval, location, directions, and conditional pricing
    const studentManifest = assignedStudents.map((st) => {
      const arrival = attendanceToday.find((a) => a.student_id === st.id && a.type === 'arrival');
      const departure = attendanceToday.find((a) => a.student_id === st.id && a.type === 'departure');
      const trip = todayDailyTrips.find((t) => t.student_id === st.id);

      // Morning status lifecycle:
      // 1. PENDING_HOME_PICKUP (Scheduled for pickup at home)
      // 2. PICKED_UP_FROM_HOME (Escort confirmed home doorstep pickup -> ON_BOARD)
      // 3. DROPPED_OFF_AT_SCHOOL (Gate officer signed arrival -> DROPPED_OFF at school)
      let morning_status = 'PENDING_HOME_PICKUP';
      if (arrival) {
        morning_status = 'DROPPED_OFF_AT_SCHOOL';
      } else if (trip?.morning_picked_up) {
        morning_status = 'PICKED_UP_FROM_HOME';
      }

      // Afternoon status lifecycle:
      // 1. PENDING_SCHOOL_PICKUP (Waiting for gate release)
      // 2. PICKED_UP_FROM_GATE (Gate officer signed departure or released -> ON_BOARD Picked Up)
      // 3. SAFE_AT_HOME (Escort completed home dropoff -> DROPPED_OFF)
      let afternoon_status = 'PENDING_SCHOOL_PICKUP';
      if (trip?.afternoon_dropped_off) {
        afternoon_status = 'SAFE_AT_HOME';
      } else if (departure || trip?.afternoon_picked_up) {
        afternoon_status = 'PICKED_UP_FROM_GATE';
      }

      let status = 'SCHEDULED';
      if (morning_status === 'DROPPED_OFF_AT_SCHOOL') {
        status = 'DROPPED_OFF';
      } else if (morning_status === 'PICKED_UP_FROM_HOME') {
        status = 'ON_BOARD';
      }

      const matchAssignment = liveAssignments.find((a) => a.student_id === st.id);
      const isCmApproved = matchAssignment ? matchAssignment.status === 'active' : true;
      const cmStatusLabel = matchAssignment?.status === 'pending_confirmation' ? 'pending_approval' : 'approved';
      const assignmentSchool = unwrapRel(matchAssignment?.school);
      const studentSchool = unwrapRel(st.school);
      const rowSchool =
        assignmentSchool ||
        studentSchool ||
        assignedSchools.find((s: any) => s.id === (matchAssignment?.school_id || st.school_id)) ||
        null;
      const assignedSchoolName = rowSchool?.name || 'Assigned School';

      const schoolLat = rowSchool?.gps_lat != null ? Number(rowSchool.gps_lat) : (schoolData?.gps_lat ? Number(schoolData.gps_lat) : null);
      const schoolLng = rowSchool?.gps_lng != null ? Number(rowSchool.gps_lng) : (schoolData?.gps_lng ? Number(schoolData.gps_lng) : null);
      const rawHouseLat = st.house_lat != null && !isNaN(Number(st.house_lat)) ? Number(st.house_lat) : (st.custom_fields?.house_lat != null && !isNaN(Number(st.custom_fields.house_lat)) ? Number(st.custom_fields.house_lat) : null);
      const rawHouseLng = st.house_lng != null && !isNaN(Number(st.house_lng)) ? Number(st.house_lng) : (st.custom_fields?.house_lng != null && !isNaN(Number(st.custom_fields.house_lng)) ? Number(st.custom_fields.house_lng) : null);
      const houseLat = rawHouseLat;
      const houseLng = rawHouseLng;

      let distanceKm: number | null = null;
      let estimatedTransitMins: number | null = null;
      let directionsUrl: string | null = null;

      if (houseLat != null && houseLng != null && schoolLat != null && schoolLng != null) {
        distanceKm = computeHaversineDistanceKm(schoolLat, schoolLng, houseLat, houseLng);
        estimatedTransitMins = Math.max(5, Math.round((distanceKm / 25) * 60));
        directionsUrl = `https://www.google.com/maps/dir/?api=1&origin=${schoolLat},${schoolLng}&destination=${houseLat},${houseLng}&travelmode=driving`;
      }

      const matchBooking = liveBookings.find(
        (b) => b.student_id === st.id || b.student?.id === st.id || b.id === matchAssignment?.booking_id
      );

      let tripType = 'both';
      if (matchBooking?.notes) {
        try {
          const pb = typeof matchBooking.notes === 'string' ? JSON.parse(matchBooking.notes) : matchBooking.notes;
          if (pb?.trip_type) tripType = pb.trip_type;
        } catch {}
      }
      if (matchAssignment?.notes && tripType === 'both') {
        try {
          const pa = typeof matchAssignment.notes === 'string' ? JSON.parse(matchAssignment.notes) : matchAssignment.notes;
          if (pa?.trip_type) tripType = pa.trip_type;
        } catch {}
      }

      // MyEduRide Escort: sees location, address, AND price
      // School Escort: DOES NOT see any price, but sees location, doorstep address, distance, and direction
      const storedFare = extractStoredFare(st.id);
      const gpsFare = !isSchoolEscort && storedFare == null && distanceKm != null
        ? calculateEscortFare(distanceKm, tripType === 'afternoon_only' || tripType === 'morning_only' ? tripType : 'both', fareRates).dailyFare
        : null;
      const rawDailyFare = storedFare != null ? storedFare : gpsFare;
      const dailyFare = isSchoolEscort ? null : rawDailyFare;
      const morningFare = dailyFare != null
        ? (tripType === 'afternoon_only' ? 0 : tripType === 'morning_only' ? dailyFare : Math.round(dailyFare / 2))
        : null;
      const afternoonFare = dailyFare != null
        ? (tripType === 'morning_only' ? 0 : tripType === 'afternoon_only' ? dailyFare : dailyFare - (morningFare || 0))
        : null;

      const cls = Array.isArray(st.class) ? st.class[0]?.name : (st.class?.name || st.class_name || 'MyEduRide Transit');
      const hasHousePin = houseLat != null && houseLng != null;
      const navUrl = directionsUrl || (hasHousePin
        ? `https://www.google.com/maps/dir/?api=1&destination=${houseLat},${houseLng}`
        : null);

      const discountInfo = extractDiscountInfo(st.id);
      const resolvedHouseAddr = st.house_address || (st.custom_fields?.address ? String(st.custom_fields.address) : null) || st.pickup_address || null;

      return {
        id: st.id,
        name: st.name || `${st.first_name || ''} ${st.last_name || ''}`.trim() || 'Assigned Student',
        student_id_number: st.student_id_number || null,
        class_name: cls,
        photo_url: st.photo_url || null,
        trip_type: tripType,
        school_id: matchAssignment?.school_id || st.school_id || rowSchool?.id || null,
        school_name: assignedSchoolName,
        school_lat: schoolLat,
        school_lng: schoolLng,
        school_address: rowSchool?.location_address || rowSchool?.address || schoolData?.location_address || schoolData?.address || null,
        city_manager_status: cmStatusLabel,
        city_manager_approved: isCmApproved,
        show_price: !isSchoolEscort,
        daily_fare: dailyFare,
        formatted_daily_fare: dailyFare != null ? `₦${dailyFare.toLocaleString()}` : null,
        morning_fare: morningFare,
        afternoon_fare: afternoonFare,
        formatted_morning_fare: morningFare != null ? `₦${morningFare.toLocaleString()}` : null,
        formatted_afternoon_fare: afternoonFare != null ? `₦${afternoonFare.toLocaleString()}` : null,
        discount_applied: Boolean(discountInfo),
        discount_amount: discountInfo?.variance || null,
        accountant_ref: discountInfo?.accountantApprovalRef || null,
        discount_note: discountInfo ? (discountInfo.discountReason || `Accountant Approved Concession (Ref: ${discountInfo.accountantApprovalRef || 'ACC'})`) : null,
        pickup_address: resolvedHouseAddr,
        house_address: resolvedHouseAddr,
        house_lat: houseLat,
        house_lng: houseLng,
        house_landmark: st.house_landmark || st.custom_fields?.landmark || null,
        house_notes: st.house_notes || st.custom_fields?.notes || null,
        house_pinned_at: st.house_pinned_at || null,
        is_house_pinned: hasHousePin,
        distance_km: distanceKm,
        estimated_transit_mins: estimatedTransitMins,
        driving_directions_url: directionsUrl,
        google_maps_nav_url: navUrl,
        status,
        morning_status,
        afternoon_status,
        morning_picked_up_at: trip?.morning_picked_up_at || null,
        afternoon_picked_up_at: trip?.afternoon_picked_up_at || null,
        afternoon_dropped_off_at: trip?.afternoon_dropped_off_at || null,
        morning_proximity_notified_at: trip?.morning_proximity_notified_at || null,
        afternoon_proximity_notified_at: trip?.afternoon_proximity_notified_at || null,
        is_morning_proximity_notified: Boolean(trip?.morning_proximity_notified_at),
        is_afternoon_proximity_notified: Boolean(trip?.afternoon_proximity_notified_at),
        pickup_time: st.pickup_time || routeStops.find((r: any) => r.student_id === st.id)?.pickup_time || null,
        parent_phone: st.parent_phone || null,
        parent_name: st.parent_name || null,
        billable_km: distanceKm != null ? Math.max(1, Math.ceil(distanceKm)) : null,
        agreed_rate_per_km: fareRates.rate_per_km,
        route_name: assignedRoute?.name || null,
        operating_city: resolvedCityKey,
        operating_city_label: cityPricing.city_label || cityLabelForKey(resolvedCityKey),
      };
    });

    // Compute Today's Total Earnings Summary for Escort
    const approvedStudentsCount = studentManifest.filter((s) => s.city_manager_approved).length;
    const totalDailyEarnings = studentManifest.reduce((acc, s) => acc + (s.city_manager_approved && s.daily_fare ? s.daily_fare : 0), 0);
    const morningProjected = studentManifest.reduce((acc, s) => acc + (s.city_manager_approved && s.trip_type !== 'afternoon_only' && s.morning_fare ? s.morning_fare : 0), 0);
    const afternoonProjected = studentManifest.reduce((acc, s) => acc + (s.city_manager_approved && s.trip_type !== 'morning_only' && s.afternoon_fare ? s.afternoon_fare : 0), 0);

    const earningsSummary = isSchoolEscort
      ? {
          is_school_salaried: true,
          total_daily_earnings: null,
          formatted_total_daily_earnings: null,
          morning_projected: null,
          formatted_morning_projected: null,
          afternoon_projected: null,
          formatted_afternoon_projected: null,
          total_students: studentManifest.length,
          approved_students_count: approvedStudentsCount,
          pending_students_count: studentManifest.length - approvedStudentsCount,
        }
      : {
          is_school_salaried: false,
          total_daily_earnings: totalDailyEarnings,
          formatted_total_daily_earnings: `₦${totalDailyEarnings.toLocaleString()}`,
          morning_projected: morningProjected,
          formatted_morning_projected: `₦${morningProjected.toLocaleString()}`,
          afternoon_projected: afternoonProjected,
          formatted_afternoon_projected: `₦${afternoonProjected.toLocaleString()}`,
          total_students: studentManifest.length,
          approved_students_count: approvedStudentsCount,
          pending_students_count: studentManifest.length - approvedStudentsCount,
          agreed_rate_per_km: fareRates.rate_per_km,
          operating_city: resolvedCityKey,
          operating_city_label: cityPricing.city_label || cityLabelForKey(resolvedCityKey),
          route_name: assignedRoute?.name || null,
        };

    const operationalManifest = studentManifest.filter((s) => s.city_manager_approved);
    const morningStudents = operationalManifest
      .filter((s) => s.trip_type !== 'afternoon_only')
      .map((s) => ({
        ...s,
        status: s.morning_status === 'DROPPED_OFF_AT_SCHOOL' ? 'DROPPED_OFF' : (s.morning_status === 'PICKED_UP_FROM_HOME' ? 'ON_BOARD' : 'SCHEDULED'),
        picked: s.morning_status === 'PICKED_UP_FROM_HOME' || s.morning_status === 'DROPPED_OFF_AT_SCHOOL',
        dropped: s.morning_status === 'DROPPED_OFF_AT_SCHOOL',
        address: s.house_address || s.pickup_address,
        time: s.pickup_time,
        avatar: s.photo_url,
        distance: s.distance_km != null ? `${s.distance_km} km` : null,
      }));

    const afternoonStudents = operationalManifest
      .filter((s) => s.trip_type !== 'morning_only')
      .map((s) => ({
        ...s,
        status: s.afternoon_status === 'SAFE_AT_HOME' ? 'DROPPED_OFF' : (s.afternoon_status === 'PICKED_UP_FROM_GATE' ? 'ON_BOARD' : 'SCHEDULED'),
        picked: s.afternoon_status === 'PICKED_UP_FROM_GATE' || s.afternoon_status === 'SAFE_AT_HOME',
        dropped: s.afternoon_status === 'SAFE_AT_HOME',
        note: s.school_name ? `Pick from ${s.school_name} Gate` : 'Pick from school gate',
        address: s.house_address || s.pickup_address,
        avatar: s.photo_url,
      }));

    // 6. Fetch Emergency Deputising Dispatches
    let activeEmergencyDispatches: any[] = [];
    if (session?.user_id) {
      const { data: emergencies } = await supabase
        .from('emergency_deputising')
        .select('*')
        .or(`original_escort_user_id.eq.${session.user_id},deputy_escort_user_id.eq.${session.user_id}`)
        .order('created_at', { ascending: false })
        .limit(5);

      activeEmergencyDispatches = emergencies || [];
    }

    // 7. Live Notifications
    let unreadNotifCount = 0;
    let liveNotifications: any[] = [];
    if (session?.user_id) {
      const { data: notifs, count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact' })
        .eq('user_id', session.user_id)
        .order('created_at', { ascending: false })
        .limit(10);

      liveNotifications = notifs || [];
      unreadNotifCount = count || 0;
    }

    let announcements: any[] = [];
    const noticeSchoolIds = Array.from(distinctSchoolIds);
    if (noticeSchoolIds.length > 0) {
      try {
        const { data: notices } = await supabase
          .from('school_notices')
          .select('*')
          .in('school_id', noticeSchoolIds)
          .order('created_at', { ascending: false })
          .limit(8);
        announcements = (notices || []).map((n: any) => ({
          id: n.id,
          title: n.title || n.heading || n.category || 'School Notice',
          body: n.body || n.message || n.content || '',
          created_at: n.created_at,
        }));
      } catch (err) {
        console.warn('[dashboard-live] school_notices fetch notice:', err);
      }
    }

    // 8. Financial / Wallet Details — wallets table first, then user_profiles. Never invent a balance.
    let walletRow: any = null;
    if (session?.user_id) {
      try {
        const { data: w } = await supabase
          .from('wallets')
          .select('*')
          .eq('user_id', session.user_id)
          .maybeSingle();
        walletRow = w;
      } catch (err) {
        console.warn('[dashboard-live] wallets fetch notice:', err);
      }
    }

    const walletBalance = Number(
      walletRow?.balance ?? userProfile?.wallet_balance ?? escortProfile?.walletBalance ?? 0
    );
    const eduSaveBalance = Number(
      walletRow?.edu_save ?? walletRow?.edusave ?? walletRow?.savings_balance ?? escortProfile?.eduSaveBalance ?? 0
    );
    const eduInsuRedActive = Boolean(
      escortProfile?.selectedInsuredPlan || escortProfile?.eduInsuRedActive || walletRow?.edu_insured_active
    );

    const displayName = userProfile?.full_name || escortProfile?.name || escortProfile?.fullName || session?.full_name || 'Escort Officer';
    const escortCode = escortProfile?.escort_code || escortProfile?.escortIdCode || escortProfile?.id || null;

    // 9. Resolve Driver Details only from a real school driver role
    let driverData: any = null;
    if (schoolId) {
      try {
        const { data: driverRole } = await supabase
          .from('user_school_roles')
          .select('user_id, user:user_profiles(id, full_name, phone, avatar_url)')
          .eq('school_id', schoolId)
          .eq('role', 'driver')
          .eq('is_active', true)
          .limit(1)
          .maybeSingle();

        if (driverRole?.user) {
          const u = Array.isArray(driverRole.user) ? driverRole.user[0] : driverRole.user;
          if (u) {
            driverData = {
              id: u.id,
              name: u.full_name || null,
              phone: u.phone || null,
              photo_url: u.avatar_url || null,
              status: 'Active Shift',
            };
          }
        }
      } catch (err) {
        console.warn('[dashboard-live] driver query notice:', err);
      }
    }

    // 10. Compute live pickup & on-board queues from the real roster only
    const pickedCount = studentManifest.filter((s) => s.status === 'ON_BOARD' || s.status === 'DROPPED_OFF').length;
    const totalCount = studentManifest.length;
    const remainingCount = Math.max(0, totalCount - pickedCount);
    const progressPct = totalCount > 0 ? Math.round((pickedCount / totalCount) * 100) : 0;

    const nextPendingStudent = morningStudents.find((s) => !s.picked) || null;
    const morningPickedCount = morningStudents.filter((s) => s.picked).length;
    const morningDroppedCount = morningStudents.filter((s) => s.dropped).length;
    const afternoonReleasedCount = afternoonStudents.filter((s) => s.picked).length;
    const afternoonHomeCount = afternoonStudents.filter((s) => s.dropped).length;

    const activityFeed = liveNotifications.map((n: any) => ({
      id: n.id,
      text: n.message || n.title || n.body || 'Notification',
      time: n.created_at
        ? new Date(n.created_at).toLocaleTimeString('en-NG', { timeZone: 'Africa/Lagos', hour: '2-digit', minute: '2-digit' })
        : null,
      type: n.type || n.category || 'system',
    }));

    const todayEarnings = isSchoolEscort
      ? 0
      : studentManifest.reduce((acc, s) => {
          if (!s.city_manager_approved) return acc;
          if (s.morning_status === 'PICKED_UP_FROM_HOME' || s.morning_status === 'DROPPED_OFF_AT_SCHOOL') {
            acc += Number(s.morning_fare || 0);
          }
          if (s.afternoon_status === 'SAFE_AT_HOME') {
            acc += Number(s.afternoon_fare || 0);
          }
          return acc;
        }, 0);

    let monthEarnings = todayEarnings;
    const monthStart = `${today.slice(0, 7)}-01`;
    try {
      if (escortIdentifiers.length > 0) {
        const { data: monthTrips } = await supabase
          .from('escort_student_daily_trips')
          .select('student_id, trip_date, morning_picked_up, afternoon_dropped_off')
          .in('escort_id', escortIdentifiers)
          .gte('trip_date', monthStart)
          .lte('trip_date', today);

        const fareByStudent = new Map(studentManifest.map((s) => [s.id, { morning: Number(s.morning_fare || 0), afternoon: Number(s.afternoon_fare || 0) }]));
        monthEarnings = (monthTrips || []).reduce((acc: number, trip: any) => {
          const fares = fareByStudent.get(trip.student_id);
          if (!fares) return acc;
          if (trip.morning_picked_up) acc += fares.morning;
          if (trip.afternoon_dropped_off) acc += fares.afternoon;
          return acc;
        }, 0);
      }
    } catch (err) {
      console.warn('[dashboard-live] month trips fetch notice:', err);
    }

    const oneWayKm = studentManifest.reduce((acc, s) => acc + (Number(s.distance_km) || 0), 0);
    const plannedTrips = (morningStudents.length > 0 ? 1 : 0) + (afternoonStudents.length > 0 ? 1 : 0);
    const completedTripLegs =
      (morningDroppedCount === morningStudents.length && morningStudents.length > 0 ? 1 : 0) +
      (afternoonHomeCount === afternoonStudents.length && afternoonStudents.length > 0 ? 1 : 0);
    const totalDistanceKm = Math.round(oneWayKm * 10) / 10;

    let walletTransactions: any[] = [];
    if (session?.user_id) {
      try {
        const { data: txs } = await supabase
          .from('wallet_transactions')
          .select('id, title, description, amount, type, status, created_at')
          .eq('user_id', session.user_id)
          .order('created_at', { ascending: false })
          .limit(12);
        walletTransactions = txs || [];
      } catch {
        walletTransactions = [];
      }
    }

    const vehicleSafe = assignedVehicle || {};
    const firstName = displayName.split(' ')[0];
    const migoHints = [
      nextPendingStudent
        ? `Next pickup: ${nextPendingStudent.name}${nextPendingStudent.address ? ` at ${nextPendingStudent.address}` : ''}.`
        : (morningStudents.length > 0 ? 'All morning pickups on this roster are complete.' : 'No students are assigned to you yet.'),
      'Scan the student ID card or enter the parent phone code before boarding.',
      'Board up to 9 students, drop them at school, then pick the next batch. Max 18 trips to and fro today.',
      'Keep communication professional with parents, school, and City Manager.',
    ];

    const { getEscortBatchStatus } = await import('@/lib/escort/batch-capacity');
    const escortBatchIds = [escortProfile?.id, escortProfile?.user_id, session?.user_id].filter(Boolean);
    const hour = new Date().getHours();
    const batchPhase = hour < 12 ? 'morning' : 'afternoon';
    const batch = await getEscortBatchStatus(supabase, escortBatchIds as string[], batchPhase);

    // Active live GPS session for this escort (if any)
    let activeSession: any = null;
    try {
      const sessionOrFilters: string[] = [];
      if (escortProfile?.id) sessionOrFilters.push(`escort_id.eq.${escortProfile.id}`);
      if (escortProfile?.user_id) sessionOrFilters.push(`escort_user_id.eq.${escortProfile.user_id}`);
      if (session?.user_id) sessionOrFilters.push(`escort_user_id.eq.${session.user_id}`);
      if (sessionOrFilters.length > 0) {
        const { data: sessionRows } = await supabase
          .from('vehicle_active_sessions')
          .select('id, school_id, escort_id, escort_user_id, trip_type, status, current_lat, current_lng, current_speed_kmh, current_heading, battery_level, started_at, last_ping_at')
          .eq('status', 'in_progress')
          .or(sessionOrFilters.join(','))
          .order('started_at', { ascending: false })
          .limit(1);
        activeSession = sessionRows?.[0] || null;
      }
    } catch (sessionErr) {
      console.warn('[dashboard-live] active session lookup notice:', sessionErr);
    }

    return NextResponse.json({
      success: true,
      last_sync: nowUtcIso(),
      earnings_summary: earningsSummary,
      batch,
      activeSession: activeSession
        ? {
            id: activeSession.id,
            school_id: activeSession.school_id,
            escort_id: activeSession.escort_id,
            escort_user_id: activeSession.escort_user_id,
            trip_type: activeSession.trip_type,
            status: activeSession.status,
            current_lat: activeSession.current_lat != null ? Number(activeSession.current_lat) : null,
            current_lng: activeSession.current_lng != null ? Number(activeSession.current_lng) : null,
            current_speed_kmh: activeSession.current_speed_kmh != null ? Number(activeSession.current_speed_kmh) : 0,
            current_heading: activeSession.current_heading != null ? Number(activeSession.current_heading) : 0,
            battery_level: activeSession.battery_level ?? null,
            started_at: activeSession.started_at,
            last_ping_at: activeSession.last_ping_at,
          }
        : null,
      escort: {
        id: escortProfile?.id || session?.user_id || null,
        name: displayName,
        code: escortCode,
        email: userProfile?.email || escortProfile?.email || session?.email || null,
        phone: userProfile?.phone || escortProfile?.phone || null,
        vehicleType: vehicleSafe.vehicle_name || null,
        regNumber: vehicleSafe.plate_number || null,
        photo: userProfile?.avatar_url || escortProfile?.photo || null,
        availableForOtherSchools: Boolean(escortProfile?.availableForOtherSchools),
        status: escortProfile?.status || null,
        is_online: Boolean(escortProfile?.ready_for_pickup || escortProfile?.today_trip_status === 'accepted' || escortProfile?.today_trip_status === 'in_progress'),
        today_trip_status: escortProfile?.today_trip_status || 'pending',
        today_trip_declined_reason: escortProfile?.today_trip_declined_reason || null,
        today_trip_accepted_at: escortProfile?.today_trip_accepted_at || null,
        ready_for_pickup: Boolean(escortProfile?.ready_for_pickup),
        ready_for_pickup_at: escortProfile?.ready_for_pickup_at || null,
        auto_ready_from_gate: Boolean(
          escortProfile?.ready_for_pickup &&
          escortProfile?.today_trip_status !== 'declined' &&
          assignedSchools.some((s: any) => isDismissalWindowOpen(s))
        ),
        house_lat: escortProfile?.house_lat ? Number(escortProfile.house_lat) : null,
        house_lng: escortProfile?.house_lng ? Number(escortProfile.house_lng) : null,
        residential_address: escortProfile?.residential_address || userProfile?.address || '',
        closest_landmark: escortProfile?.closest_landmark || '',
        is_house_pinned: Boolean(escortProfile?.house_lat && escortProfile?.house_lng),
        escort_category: escortCategory,
        is_school_escort: isSchoolEscort,
        is_myeduride_escort: !isSchoolEscort,
        primary_school_id: escortProfile?.primary_school_id || schoolData?.id || null,
        school_id: escortProfile?.school_id || escortProfile?.primary_school_id || schoolData?.id || null,
      },
      school: schoolData
        ? {
            id: schoolData.id,
            name: schoolData.name,
            city: schoolData.city || '',
            state: schoolData.state || '',
            address: schoolData.location_address || schoolData.address || '',
            gps_lat: schoolData.gps_lat != null ? Number(schoolData.gps_lat) : null,
            gps_lng: schoolData.gps_lng != null ? Number(schoolData.gps_lng) : null,
            landmark: schoolData.location_landmark || '',
            is_pinned: schoolData.gps_lat != null && schoolData.gps_lng != null,
            logo_url: schoolData.logo_url || null,
            student_gate_start: schoolData.student_gate_start || schoolData.school_start_time || null,
            dismissal_start_time: schoolData.dismissal_start_time || schoolData.student_gate_end || null,
            dismissal_end_time: schoolData.dismissal_end_time || null,
          }
        : null,
      assigned_schools: assignedSchools,
      dual_school_schedule: dualSchoolSchedule,
      driver: driverData,
      vehicle: assignedVehicle
        ? {
            id: assignedVehicle.id || null,
            plate_number: assignedVehicle.plate_number || null,
            vehicle_name: assignedVehicle.vehicle_name || null,
            type: assignedVehicle.vehicle_type || assignedVehicle.vehicle_name || null,
            capacity: assignedVehicle.capacity || null,
            photo_url: assignedVehicle.photo_url || null,
          }
        : null,
      route: assignedRoute
        ? {
            id: assignedRoute.id,
            name: assignedRoute.route_name,
            code: assignedRoute.route_code || null,
            morning_time: assignedRoute.morning_pickup_time || null,
            afternoon_time: assignedRoute.afternoon_dropoff_time || null,
            stops: routeStops,
          }
        : null,
      students: {
        manifest: studentManifest,
        morning: morningStudents,
        afternoon: afternoonStudents,
        dropped_off: morningStudents.filter((s) => s.dropped),
        total: totalCount,
        picked: pickedCount,
        remaining: remainingCount,
        progressPct,
      },
      metrics: {
        assigned_students: totalCount,
        picked_up: pickedCount,
        remaining: remainingCount,
        progress_pct: progressPct,
        morning_picked: morningPickedCount,
        morning_dropped: morningDroppedCount,
        afternoon_released: afternoonReleasedCount,
        afternoon_home: afternoonHomeCount,
        departure_time: assignedRoute?.morning_pickup_time || schoolData?.student_gate_start || null,
        est_completion: schoolData?.school_start_time || null,
      },
      tracking: {
        current_location: escortProfile?.today_trip_status === 'in_progress' ? 'In transit' : 'Standby',
        next_stop: nextPendingStudent
          ? {
              name: nextPendingStudent.name,
              address: nextPendingStudent.address || null,
              distance: nextPendingStudent.distance || (nextPendingStudent.distance_km != null ? `${nextPendingStudent.distance_km} km` : null),
            }
          : null,
        eta_school: nextPendingStudent?.estimated_transit_mins != null
          ? `${nextPendingStudent.estimated_transit_mins} min`
          : null,
      },
      migo: {
        greeting: `Good morning, ${firstName}!`,
        first_name: firstName,
        trip_count: plannedTrips,
        hints: migoHints,
      },
      activity_feed: activityFeed,
      announcements,
      wallet: {
        balance: walletBalance,
        todayEarnings,
        monthEarnings,
        eduSave: eduSaveBalance,
        eduInsuRedActive,
        eduInsuRedPlan: escortProfile?.selectedInsuredPlan || null,
        transactions: walletTransactions,
      },
      emergencies: activeEmergencyDispatches,
      assignments: liveAssignments,
      bookings: liveBookings,
      stats: {
        totalTrips: plannedTrips,
        tripsCompletedToday: completedTripLegs,
        totalStudents: totalCount,
        totalDistance: totalDistanceKm > 0 ? `${totalDistanceKm} km` : '0 km',
        totalDistanceKm,
        averageRating: null,
        onTimePerformance: null,
      },
      notifications: {
        unreadCount: unreadNotifCount,
        list: liveNotifications,
      },
    });
  } catch (err: any) {
    console.error('[dashboard-live] GET error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/escorts/dashboard-live
 * Handles live escort actions (start trip, complete trip, update student status, wallet, emergency).
 */
export async function POST(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request);
    const body = await request.json();
    const { action, student_id, status, amount, reason, incident_type, school_id } = body;

    const supabase = getAdminClient();
    const primarySchoolId = school_id || session?.roles?.find((r: any) => r.school_id)?.school_id;

    // Action 1: Toggle Availability (do not change CM/application status)
    if (action === 'toggle_availability') {
      const availableForOtherSchools = Boolean(body.availableForOtherSchools);
      const appId = body.appId;
      if (session?.user_id || appId) {
        try {
          let target = appId
            ? await supabase.from('escort_applications').select('id, status, application_data').eq('id', appId).maybeSingle()
            : await supabase.from('escort_applications').select('id, status, application_data').eq('user_id', session?.user_id).maybeSingle();

          if (!target.data && session?.user_id) {
            target = await supabase.from('escort_applications').select('id, status, application_data').eq('user_id', session.user_id).maybeSingle();
          }

          if (target.data?.id) {
            let appDataObj: any = {};
            const raw = target.data.application_data;
            if (typeof raw === 'string') {
              try { appDataObj = JSON.parse(raw); } catch { appDataObj = {}; }
            } else if (raw && typeof raw === 'object') {
              appDataObj = raw;
            }
            appDataObj.availableForOtherSchools = availableForOtherSchools;
            await supabase
              .from('escort_applications')
              .update({
                application_data: JSON.stringify(appDataObj),
                updated_at: nowUtcIso(),
              })
              .eq('id', target.data.id);

            const { updateEscortApplicationStatus } = await import('@/lib/escort/escort-db');
            const currentStatus = (target.data.status || 'CITY_MANAGER_APPROVED') as any;
            await updateEscortApplicationStatus(target.data.id, currentStatus, undefined, { availableForOtherSchools });
          }
        } catch (e) {
          console.warn('[dashboard-live] toggle_availability notice:', e);
        }
      }
      return NextResponse.json({
        success: true,
        availableForOtherSchools,
        message: `Availability status updated: ${availableForOtherSchools ? 'Available for other schools' : 'Primary school only'}`,
      });
    }

    // Action 1b: Accept Today's Scheduled Trips
    if (action === 'accept_today_trips') {
      if (session?.user_id) {
        await supabase
          .from('escort_applications')
          .update({
            today_trip_status: 'accepted',
            today_trip_accepted_at: nowUtcIso(),
            availability_status: 'available',
          })
          .eq('user_id', session.user_id);
      }
      return NextResponse.json({
        success: true,
        today_trip_status: 'accepted',
        message: "You have committed to today's trips! City Manager and schools informed.",
      });
    }

    // Action 1c: Decline Today's Trips & Request Emergency Deputy
    if (action === 'decline_today_trips') {
      const reason = body.reason || 'Escort reported unable to cover route today';
      if (session?.user_id) {
        await supabase
          .from('escort_applications')
          .update({
            today_trip_status: 'declined',
            today_trip_declined_reason: reason,
            availability_status: 'offline',
          })
          .eq('user_id', session.user_id);

        // Resolve active school ID for emergency
        let emergencySchoolId = primarySchoolId;
        if (!emergencySchoolId) {
          const { data: assign } = await supabase
            .from('escort_assignments')
            .select('school_id')
            .eq('escort_id', session.user_id)
            .limit(1)
            .maybeSingle();
          emergencySchoolId = assign?.school_id;
        }
        if (!emergencySchoolId) {
          const { data: firstSchool } = await supabase.from('schools').select('id').limit(1).maybeSingle();
          emergencySchoolId = firstSchool?.id || '00000000-0000-0000-0000-000000000001';
        }

        // Immediately create emergency deputising request for City Manager
        await supabase.from('emergency_deputising').insert({
          school_id: emergencySchoolId,
          original_escort_id: session.user_id,
          original_escort_name: session.full_name || 'Assigned Escort',
          deputy_escort_name: 'Pending City Manager Dispatch',
          emergency_reason: reason,
          notes: `Escort declined today's route via morning commitment check: "${reason}". Immediate emergency deputy dispatch required.`,
          status: 'PENDING_DEPUTY_ASSIGNMENT',
          created_at: nowUtcIso(),
        });
      }
      return NextResponse.json({
        success: true,
        today_trip_status: 'declined',
        message: "Trip decline recorded. City Manager has been urgently alerted to dispatch an emergency pool escort.",
      });
    }

    // Action 1d: Toggle "I am Ready for Pickup" — shows assigned roster for house pickups (max 9 per batch)
    if (action === 'toggle_ready_for_pickup') {
      const isReady = Boolean(body.ready);
      if (session?.user_id) {
        await supabase
          .from('escort_applications')
          .update({
            ready_for_pickup: isReady,
            ready_for_pickup_at: nowUtcIso(),
            operational_status: isReady ? 'Active On Duty' : 'Standby',
          })
          .eq('user_id', session.user_id);

        const { data: appRow } = await supabase
          .from('escort_applications')
          .select('id, full_name, phone, house_lat, house_lng, school_id, primary_school_id')
          .eq('user_id', session.user_id)
          .maybeSingle();

        const escortAppId = appRow?.id || session.user_id;
        const schoolForSession =
          primarySchoolId || appRow?.primary_school_id || appRow?.school_id || null;

        if (isReady && schoolForSession) {
          const initialLat = appRow?.house_lat ? Number(appRow.house_lat) : 6.4474;
          const initialLng = appRow?.house_lng ? Number(appRow.house_lng) : 3.4731;

          // Close prior live sessions before opening a new ready session
          await supabase
            .from('vehicle_active_sessions')
            .update({ status: 'completed', completed_at: nowUtcIso() })
            .eq('escort_user_id', session.user_id)
            .eq('status', 'in_progress');

          const { data: insertedReady } = await supabase
            .from('vehicle_active_sessions')
            .insert({
              school_id: schoolForSession,
              escort_id: escortAppId,
              escort_user_id: session.user_id,
              trip_type: 'morning_pickup',
              status: 'in_progress',
              current_lat: initialLat,
              current_lng: initialLng,
              current_speed_kmh: 0,
              current_heading: 0,
              battery_level: 95,
              started_at: nowUtcIso(),
              last_ping_at: nowUtcIso(),
            })
            .select('id')
            .single();

          const { getEscortBatchStatus } = await import('@/lib/escort/batch-capacity');
          const batch = await getEscortBatchStatus(supabase, [escortAppId, session.user_id], 'morning');

          return NextResponse.json({
            success: true,
            ready_for_pickup: isReady,
            sessionId: insertedReady?.id || null,
            batch,
            message: `Ready for Pickup active. Show your assigned students and board up to ${batch.max_batch} before school drop-off (${batch.message}).`,
          });
        }

        const { getEscortBatchStatus } = await import('@/lib/escort/batch-capacity');
        const batch = await getEscortBatchStatus(supabase, [escortAppId, session.user_id], 'morning');

        return NextResponse.json({
          success: true,
          ready_for_pickup: isReady,
          batch,
          message: isReady
            ? `Ready for Pickup active. Show your assigned students and board up to ${batch.max_batch} before school drop-off (${batch.message}).`
            : 'Pickup mode set to standby.',
        });
      }
      return NextResponse.json({
        success: true,
        ready_for_pickup: isReady,
        message: isReady
          ? 'Ready for Pickup active. Your assigned student list is ready.'
          : 'Pickup mode set to standby.',
      });
    }

    // Action 2: Start Trip
    if (action === 'start_trip') {
      const { trip_type } = body;
      const tripKind = trip_type === 'afternoon' ? 'afternoon_dropoff' : 'morning_pickup';
      let createdSessionId: string | null = null;
      let createdSchoolId: string | null = null;

      if (session?.user_id) {
        await supabase
          .from('escort_applications')
          .update({
            today_trip_status: 'in_progress',
            operational_status: 'In Transit',
            ready_for_pickup: true,
          })
          .eq('user_id', session.user_id);

        const { data: appRow } = await supabase
          .from('escort_applications')
          .select('id, house_lat, house_lng, school_id, primary_school_id')
          .eq('user_id', session.user_id)
          .maybeSingle();

        const escortAppId = appRow?.id || session.user_id;
        const schoolForSession =
          primarySchoolId || appRow?.primary_school_id || appRow?.school_id || null;
        createdSchoolId = schoolForSession;

        // Close any prior in-progress sessions for this escort
        await supabase
          .from('vehicle_active_sessions')
          .update({
            status: 'completed',
            completed_at: nowUtcIso(),
          })
          .eq('escort_user_id', session.user_id)
          .eq('status', 'in_progress');

        if (appRow?.id) {
          await supabase
            .from('vehicle_active_sessions')
            .update({
              status: 'completed',
              completed_at: nowUtcIso(),
            })
            .eq('escort_id', appRow.id)
            .eq('status', 'in_progress');
        }

        if (schoolForSession) {
          const initialLat = appRow?.house_lat != null ? Number(appRow.house_lat) : null;
          const initialLng = appRow?.house_lng != null ? Number(appRow.house_lng) : null;

          const { data: insertedSession, error: insertErr } = await supabase
            .from('vehicle_active_sessions')
            .insert({
              school_id: schoolForSession,
              escort_id: escortAppId,
              escort_user_id: session.user_id,
              trip_type: tripKind,
              status: 'in_progress',
              current_lat: initialLat,
              current_lng: initialLng,
              current_speed_kmh: 0,
              current_heading: 0,
              started_at: nowUtcIso(),
              last_ping_at: nowUtcIso(),
            })
            .select('id')
            .single();

          if (insertErr) {
            console.warn('[dashboard-live] start_trip session insert notice:', insertErr);
          } else {
            createdSessionId = insertedSession?.id || null;
          }
        }
      }

      return NextResponse.json({
        success: true,
        trip_type: trip_type || 'morning',
        started_at: nowUtcIso(),
        sessionId: createdSessionId,
        activeSession: createdSessionId
          ? { id: createdSessionId, school_id: createdSchoolId, trip_type: tripKind, status: 'in_progress' }
          : null,
        message: `${trip_type === 'afternoon' ? 'Afternoon drop-off' : 'Morning pickup'} trip started successfully. Live tracking enabled.`,
      });
    }

    // Action 3: Complete Trip
    if (action === 'complete_trip') {
      const { trip_type } = body;

      if (session?.user_id) {
        await supabase
          .from('escort_applications')
          .update({
            today_trip_status: 'completed',
            operational_status: 'Standby',
            ready_for_pickup: false,
          })
          .eq('user_id', session.user_id);

        if (primarySchoolId) {
          await supabase
            .from('vehicle_active_sessions')
            .update({
              status: 'completed',
              completed_at: nowUtcIso(),
            })
            .eq('escort_user_id', session.user_id)
            .eq('status', 'in_progress');
        }
      }

      return NextResponse.json({
        success: true,
        trip_type: trip_type || 'morning',
        completed_at: nowUtcIso(),
        message: 'Trip completed successfully. Summary recorded.',
      });
    }

    // Action 4: Specific Morning & Afternoon Custody Transitions
    if (
      action === 'morning_home_pickup' ||
      action === 'morning_school_dropoff' ||
      action === 'afternoon_school_pickup' ||
      action === 'afternoon_home_dropoff' ||
      action === 'update_student_status'
    ) {
      if (!student_id) {
        return NextResponse.json({ error: 'student_id required' }, { status: 400 });
      }

      let resolvedStatus = status || action;

      if (action === 'morning_home_pickup' || action === 'update_student_status') {
        resolvedStatus = 'PICKED_UP_FROM_HOME';
      } else if (action === 'afternoon_home_dropoff') {
        resolvedStatus = 'SAFE_AT_HOME';
      } else if (action === 'morning_school_dropoff' || action === 'afternoon_school_pickup') {
        return NextResponse.json({
          error: 'School sign-in and sign-out are completed by the Gate Officer after scanning the escort ID card.',
        }, { status: 400 });
      } else {
        resolvedStatus = status || action;
      }

      let targetSchoolId = primarySchoolId;
      if (!targetSchoolId) {
        const { data: stRec } = await supabase.from('students').select('school_id').eq('id', student_id).maybeSingle();
        targetSchoolId = stRec?.school_id;
      }
      if (!targetSchoolId) {
        const { data: assignRec } = await supabase.from('escort_assignments').select('school_id').eq('student_id', student_id).limit(1).maybeSingle();
        targetSchoolId = assignRec?.school_id;
      }

      const { data: escortApp } = session?.user_id
        ? await supabase.from('escort_applications').select('id, user_id').eq('user_id', session.user_id).maybeSingle()
        : { data: null };
      const escortTripId = escortApp?.id || session?.user_id;
      const todayDate = todayInLagos();
      const stamp = nowUtcIso();
      const { data: existingTrip } = await supabase
        .from('escort_student_daily_trips')
        .select('id')
        .eq('trip_date', todayDate)
        .eq('student_id', student_id)
        .in('escort_id', [escortTripId, escortApp?.user_id, session?.user_id].filter(Boolean))
        .maybeSingle();

      const tripPatch = action === 'afternoon_home_dropoff'
        ? { afternoon_dropped_off: true, afternoon_dropped_off_at: stamp, afternoon_picked_up: true, updated_at: stamp }
        : { morning_picked_up: true, morning_picked_up_at: stamp, updated_at: stamp };

      if (existingTrip) {
        await supabase.from('escort_student_daily_trips').update(tripPatch).eq('id', existingTrip.id);
      } else if (targetSchoolId && escortTripId) {
        await supabase.from('escort_student_daily_trips').insert({
          trip_date: todayDate,
          escort_id: escortTripId,
          student_id,
          school_id: targetSchoolId,
          ...tripPatch,
        });
      }

      return NextResponse.json({
        success: true,
        student_id,
        status: resolvedStatus,
        message: `Student custody recorded: ${resolvedStatus.replace(/_/g, ' ')}.`,
      });
    }

    // Action 5: Fund Wallet
    if (action === 'fund_wallet') {
      if (session?.user_id && amount) {
        const { data: prof } = await supabase
          .from('user_profiles')
          .select('wallet_balance')
          .eq('id', session.user_id)
          .maybeSingle();

        const currentBal = Number(prof?.wallet_balance || 0);
        const newBal = currentBal + Number(amount);

        await supabase
          .from('user_profiles')
          .update({ wallet_balance: newBal })
          .eq('id', session.user_id);

        try {
          const { data: w } = await supabase.from('wallets').select('id').eq('user_id', session.user_id).maybeSingle();
          if (w?.id) {
            await supabase.from('wallets').update({ balance: newBal }).eq('id', w.id);
          }
        } catch (err) {
          console.warn('[dashboard-live] wallets fund sync notice:', err);
        }

        return NextResponse.json({
          success: true,
          newBalance: newBal,
          message: `₦${Number(amount).toLocaleString()} funded successfully to wallet.`,
        });
      }
    }

    // Action 6: Request Withdrawal
    if (action === 'withdraw_wallet') {
      if (session?.user_id && amount) {
        const { data: prof } = await supabase
          .from('user_profiles')
          .select('wallet_balance')
          .eq('id', session.user_id)
          .maybeSingle();

        const currentBal = Number(prof?.wallet_balance || 0);
        if (currentBal < Number(amount)) {
          return NextResponse.json({ error: 'Insufficient wallet balance.' }, { status: 400 });
        }

        const newBal = currentBal - Number(amount);
        await supabase
          .from('user_profiles')
          .update({ wallet_balance: newBal })
          .eq('id', session.user_id);

        try {
          const { data: w } = await supabase.from('wallets').select('id').eq('user_id', session.user_id).maybeSingle();
          if (w?.id) {
            await supabase.from('wallets').update({ balance: newBal }).eq('id', w.id);
          }
        } catch (err) {
          console.warn('[dashboard-live] wallets withdraw sync notice:', err);
        }

        return NextResponse.json({
          success: true,
          newBalance: newBal,
          message: `Payout request for ₦${Number(amount).toLocaleString()} submitted to City Manager.`,
        });
      }
    }

    // Action 7: Report Emergency / Breakdown
    if (action === 'report_emergency') {
      if (primarySchoolId) {
        await supabase.from('emergency_deputising').insert({
          school_id: primarySchoolId,
          original_escort_user_id: session?.user_id || null,
          incident_type: incident_type || 'Vehicle Breakdown',
          reason: reason || 'Escort reported transit emergency',
          status: 'PENDING_DEPUTY_ASSIGNMENT',
          created_at: nowUtcIso(),
        });
      }

      return NextResponse.json({
        success: true,
        message: 'Emergency reported! City Manager dispatch team alerted for immediate assistance.',
      });
    }

    return NextResponse.json({ success: true, message: 'Action processed successfully.' });
  } catch (err: any) {
    console.error('[dashboard-live POST] error:', err);
    return NextResponse.json({ error: err.message || 'Action failed' }, { status: 500 });
  }
}
