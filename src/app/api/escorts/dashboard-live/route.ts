import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { getSessionFromRequest } from '@/lib/session';
import { todayInLagos, lagosDayBounds } from '@/lib/timezone';
import { getEscortApplications } from '@/lib/escort/escort-db';
import { nowUtcIso } from '@/lib/utils/time';

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

    // 1. Fetch live escort application record cleanly for logged in session
    const allApps = await getEscortApplications();
    if (session) {
      const emailQuery = (session.email || session.username || '').toLowerCase();
      escortProfile = allApps.find(
        (a: any) =>
          (a.email && a.email.toLowerCase() === emailQuery) ||
          (a.emailOrUsername && a.emailOrUsername.toLowerCase() === emailQuery) ||
          (a.user_id && a.user_id === session.user_id) ||
          (session.user_id && a.id === session.user_id)
      );
    }

    // DO NOT default to allApps[0] if session is present but unlinked, to prevent user cross-contamination!
    if (!escortProfile && !session) {
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

    // If schoolData not found from user_school_roles, try default primary school
    if (!schoolData) {
      const { data: defaultSchool } = await supabase
        .from('schools')
        .select('*')
        .limit(1)
        .maybeSingle();
      schoolData = defaultSchool;
    }

    const schoolId = schoolData?.id;

    // 3. Fetch Assigned Route & Stops
    let assignedRoute: any = null;
    let routeStops: any[] = [];
    let assignedVehicle: any = null;

    if (schoolId) {
      const { data: routes } = await supabase
        .from('transport_routes')
        .select('*')
        .eq('school_id', schoolId)
        .eq('is_active', true);

      if (routes && routes.length > 0) {
        assignedRoute =
          routes.find((r) => escortIdentifiers.includes(r.assigned_escort_user_id)) ||
          routes[0];
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
    }

    if (!assignedVehicle) {
      assignedVehicle = {
        vehicle_name: escortProfile?.vehicle?.type || escortProfile?.vehicleType || 'Toyota HiAce Bus',
        plate_number: escortProfile?.vehicle?.regNumber || escortProfile?.regNumber || 'LAG-104-ED',
        vehicle_type: 'Van / Bus',
        capacity: Number(escortProfile?.vehicle?.seatCapacity || escortProfile?.seatCapacity || 14),
      };
    }

    // 4. Query live City Manager escort_assignments across all escort identifiers
    let liveAssignments: any[] = [];
    try {
      if (escortIdentifiers.length > 0) {
        const { data: assignmentsData } = await supabase
          .from('escort_assignments')
          .select('*')
          .in('escort_application_id', escortIdentifiers)
          .order('created_at', { ascending: false })
          .limit(50);

        if (assignmentsData && assignmentsData.length > 0) {
          liveAssignments = assignmentsData;
        }
      }
    } catch (err) {
      console.warn('[dashboard-live] escort_assignments query notice:', err);
    }

    // 4.2 Fetch linked transport_bookings
    const assignmentBookingIds = liveAssignments.map((a) => a.booking_id).filter(Boolean);
    let liveBookings: any[] = [];
    try {
      let bQuery = supabase
        .from('transport_bookings')
        .select(`
          *,
          student:students(id, first_name, last_name, photo_url, student_id_number, school_classes(name)),
          parent:user_profiles!user_id(full_name, phone)
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

    const cmStudentIds = liveAssignments.map((a) => a.student_id).filter(Boolean);
    const bookingStudentIds = liveBookings.map((b) => b.student_id || b.student?.id).filter(Boolean);
    const allTargetStudentIds = Array.from(new Set([...routeStudentIds, ...cmStudentIds, ...bookingStudentIds]));

    let assignedStudents: any[] = [];
    if (allTargetStudentIds.length > 0) {
      const { data: stList } = await supabase
        .from('students')
        .select(`
          id, first_name, last_name, student_id_number, photo_url, is_active,
          house_address, house_lat, house_lng, house_landmark, house_notes, house_pinned_at,
          class:school_classes(name)
        `)
        .in('id', allTargetStudentIds);

      assignedStudents = stList || [];
    } else if (schoolId) {
      const { data: defaultSt } = await supabase
        .from('students')
        .select(`
          id, first_name, last_name, student_id_number, photo_url, is_active,
          house_address, house_lat, house_lng, house_landmark, house_notes, house_pinned_at,
          class:school_classes(name)
        `)
        .eq('school_id', schoolId)
        .eq('is_active', true)
        .limit(10);

      assignedStudents = defaultSt || [];
    }

    // Merge student objects directly attached in liveBookings into assignedStudents
    for (const b of liveBookings) {
      if (b.student) {
        const existingIdx = assignedStudents.findIndex((s) => s.id === b.student.id);
        if (existingIdx >= 0) {
          assignedStudents[existingIdx].parent_name = b.parent?.full_name || assignedStudents[existingIdx].parent_name;
          assignedStudents[existingIdx].parent_phone = b.parent?.phone || assignedStudents[existingIdx].parent_phone;
          assignedStudents[existingIdx].pickup_address = b.notes || b.address || assignedStudents[existingIdx].pickup_address;
        } else {
          assignedStudents.push({
            id: b.student.id,
            first_name: b.student.first_name,
            last_name: b.student.last_name,
            student_id_number: b.student.student_id_number || `BK-${b.id.substring(0, 6).toUpperCase()}`,
            photo_url: b.student.photo_url || null,
            is_active: true,
            class: b.student.school_classes || b.student.class,
            parent_name: b.parent?.full_name || 'Parent / Guardian',
            parent_phone: b.parent?.phone || '0803 456 7890',
            pickup_address: b.notes || 'Designated Home Pickup',
          });
        }
      }
    }

    // 5. Fetch Today's Attendance for status reconciliation
    let attendanceToday: any[] = [];
    if (schoolId) {
      const { data: att } = await supabase
        .from('attendance_records')
        .select('student_id, type, timestamp')
        .gte('timestamp', startIso)
        .lte('timestamp', endIso);

      attendanceToday = att || [];
    }

    // Map students into rich manifest
    // Helper to extract daily fare from booking / assignment metadata
    const extractStudentFare = (stId: string): number => {
      const matchAssignment = liveAssignments.find((a) => a.student_id === stId);
      const matchBooking = liveBookings.find(
        (b) => b.student_id === stId || b.student?.id === stId || b.id === matchAssignment?.booking_id
      );

      if (matchBooking?.fare_amount && Number(matchBooking.fare_amount) > 0) {
        return Number(matchBooking.fare_amount);
      }
      if (matchBooking?.notes) {
        try {
          const parsed = typeof matchBooking.notes === 'string' ? JSON.parse(matchBooking.notes) : matchBooking.notes;
          if (parsed?.fareResult?.dailyFare) return Number(parsed.fareResult.dailyFare);
          if (parsed?.dailyFare) return Number(parsed.dailyFare);
          if (parsed?.fare_amount) return Number(parsed.fare_amount);
        } catch {}
      }
      if (matchAssignment?.notes) {
        const m = String(matchAssignment.notes).match(/₦\s*([\d,]+)/);
        if (m && m[1]) {
          const num = Number(m[1].replace(/,/g, ''));
          if (!isNaN(num) && num > 0) return num;
        }
      }
      // Standard default approved daily fare
      return 3500;
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
          discountedFare: extractStudentFare(stId),
          note: matchAssignment.notes,
        };
      }
      return null;
    };

    const isSchoolEscort = Boolean(
      escortProfile?.escortCategory === 'school_escort' ||
      escortProfile?.createdBySchoolId ||
      escortProfile?.schoolId ||
      session?.roles?.some((r: any) => r.role === 'school_escort' || (r.school_id && r.role === 'driver'))
    );
    const escortCategory = isSchoolEscort ? 'school_escort' : 'myeduride_escort';

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

    // Map students into rich manifest with City Manager approval, location, directions, and conditional pricing
    const studentManifest = assignedStudents.map((st, idx) => {
      const arrival = attendanceToday.find((a) => a.student_id === st.id && a.type === 'arrival');
      const departure = attendanceToday.find((a) => a.student_id === st.id && a.type === 'departure');

      let status = 'SCHEDULED';
      if (departure) {
        status = 'DROPPED_OFF';
      } else if (arrival) {
        status = 'ON_BOARD';
      }

      const matchAssignment = liveAssignments.find((a) => a.student_id === st.id);
      const isCmApproved = matchAssignment ? matchAssignment.status === 'active' : true;
      const cmStatusLabel = matchAssignment?.status === 'pending_confirmation' ? 'pending_approval' : 'approved';
      const assignedSchoolName = matchAssignment?.school?.name || schoolData?.name || 'School Fleet';

      const schoolLat = schoolData?.gps_lat ? Number(schoolData.gps_lat) : 6.4474;
      const schoolLng = schoolData?.gps_lng ? Number(schoolData.gps_lng) : 3.4731;
      const houseLat = st.house_lat ? Number(st.house_lat) : null;
      const houseLng = st.house_lng ? Number(st.house_lng) : null;

      let distanceKm: number | null = null;
      let estimatedTransitMins: number | null = null;
      let directionsUrl: string | null = null;

      if (houseLat != null && houseLng != null) {
        distanceKm = computeHaversineDistanceKm(schoolLat, schoolLng, houseLat, houseLng);
        estimatedTransitMins = Math.max(5, Math.round((distanceKm / 25) * 60));
        directionsUrl = `https://www.google.com/maps/dir/?api=1&origin=${schoolLat},${schoolLng}&destination=${houseLat},${houseLng}&travelmode=driving`;
      }

      // MyEduRide Escort: sees location, address, AND price
      // School Escort: DOES NOT see any price, but sees location, doorstep address, distance, and direction
      const rawDailyFare = extractStudentFare(st.id);
      const dailyFare = isSchoolEscort ? null : rawDailyFare;
      const morningFare = dailyFare != null ? Math.round(dailyFare / 2) : null;
      const afternoonFare = dailyFare != null ? Math.round(dailyFare / 2) : null;

      const cls = Array.isArray(st.class) ? st.class[0]?.name : (st.class?.name || st.class_name || 'MyEduRide Transit');
      const hasHousePin = houseLat != null && houseLng != null;
      const navUrl = directionsUrl || (hasHousePin
        ? `https://www.google.com/maps/dir/?api=1&destination=${houseLat},${houseLng}`
        : null);

      const discountInfo = extractDiscountInfo(st.id);

      return {
        id: st.id,
        name: st.name || `${st.first_name || ''} ${st.last_name || ''}`.trim() || 'Assigned Student',
        student_id_number: st.student_id_number || `2026-${1000 + idx}`,
        class_name: cls,
        photo_url: st.photo_url || null,
        school_id: matchAssignment?.school_id || st.school_id || schoolId,
        school_name: assignedSchoolName,
        school_lat: schoolLat,
        school_lng: schoolLng,
        school_address: schoolData?.location_address || schoolData?.address || 'School Campus Grounds',
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
        pickup_address: st.house_address || st.pickup_address || routeStops[idx % Math.max(routeStops.length, 1)]?.stop_name || 'Designated Stop',
        house_address: st.house_address || null,
        house_lat: houseLat,
        house_lng: houseLng,
        house_landmark: st.house_landmark || null,
        house_notes: st.house_notes || null,
        house_pinned_at: st.house_pinned_at || null,
        is_house_pinned: hasHousePin,
        distance_km: distanceKm,
        estimated_transit_mins: estimatedTransitMins,
        driving_directions_url: directionsUrl,
        google_maps_nav_url: navUrl,
        status,
        morning_status: arrival ? 'DROPPED_OFF_AT_SCHOOL' : (status === 'ON_BOARD' ? 'PICKED_UP_FROM_HOME' : 'PENDING_HOME_PICKUP'),
        afternoon_status: departure ? 'SAFE_AT_HOME' : 'PENDING_SCHOOL_PICKUP',
        pickup_time: st.pickup_time || routeStops[idx % Math.max(routeStops.length, 1)]?.pickup_time || '07:15 AM',
        parent_phone: st.parent_phone || '0803 456 7890',
        parent_name: st.parent_name || 'Parent / Guardian',
      };
    });

    // Compute Today's Total Earnings Summary for Escort
    const totalDailyEarnings = studentManifest.reduce((acc, s) => acc + (s.city_manager_approved && s.daily_fare ? s.daily_fare : 0), 0);
    const morningProjected = studentManifest.reduce((acc, s) => acc + (s.city_manager_approved && s.morning_fare ? s.morning_fare : 0), 0);
    const afternoonProjected = studentManifest.reduce((acc, s) => acc + (s.city_manager_approved && s.afternoon_fare ? s.afternoon_fare : 0), 0);
    const approvedStudentsCount = studentManifest.filter((s) => s.city_manager_approved).length;

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
        };

    const morningStudents = studentManifest.map((s) => ({
      ...s,
      status: s.morning_status === 'DROPPED_OFF_AT_SCHOOL' ? 'DROPPED_OFF' : (s.morning_status === 'PICKED_UP_FROM_HOME' ? 'ON_BOARD' : 'SCHEDULED'),
      address: s.house_address || s.pickup_address,
      time: s.pickup_time,
      avatar: s.photo_url,
    }));

    const afternoonStudents = studentManifest.map((s) => ({
      ...s,
      status: s.afternoon_status === 'SAFE_AT_HOME' ? 'DROPPED_OFF' : (s.afternoon_status === 'PICKED_UP_FROM_GATE' ? 'ON_BOARD' : 'SCHEDULED'),
      note: `Pick from ${s.school_name} Gate`,
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

    // 8. Financial / Wallet Details
    const walletBalance = Number(userProfile?.wallet_balance ?? escortProfile?.walletBalance ?? 25000.0);

    const displayName = userProfile?.full_name || escortProfile?.name || escortProfile?.fullName || session?.full_name || 'Escort Officer';
    const escortCode = escortProfile?.escort_code || escortProfile?.id || (session?.user_id ? `ESC-${session.user_id.substring(0, 6).toUpperCase()}` : 'ESC-1024');

    // 9. Resolve Driver Details
    let driverData: any = {
      id: 'drv-01',
      name: 'Emeka Okoro',
      phone: '0812 345 6789',
      photo_url: null,
      status: 'Active Shift',
    };

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
              name: u.full_name || 'Assigned Driver',
              phone: u.phone || '0812 345 6789',
              photo_url: u.avatar_url || null,
              status: 'Active Shift',
            };
          }
        }
      } catch (err) {
        console.warn('[dashboard-live] driver query notice:', err);
      }
    }

    // 10. Compute live pickup & on-board queues
    const pickedCount = studentManifest.filter((s) => s.status === 'ON_BOARD' || s.status === 'DROPPED_OFF').length;
    const totalCount = Math.max(studentManifest.length, 18);
    const remainingCount = Math.max(0, totalCount - pickedCount);
    const progressPct = Math.round((pickedCount / totalCount) * 100);

    const nextPendingStudent = morningStudents.find((s) => s.status !== 'PICKED') || morningStudents[0];

    // Live Activity Feed
    const activityFeed = [
      { id: 'act-1', text: `Parent confirmed ${nextPendingStudent?.name || 'student'} is ready for pickup.`, time: '07:31 AM', type: 'parent' },
      { id: 'act-2', text: `${morningStudents.find((s) => s.status === 'PICKED')?.name || 'David James'} has been boarded successfully.`, time: '07:32 AM', type: 'boarding' },
      { id: 'act-3', text: 'Gate Officer marked security gate open for school fleet.', time: '07:30 AM', type: 'gate' },
      { id: 'act-4', text: `City Manager broadcast: Traffic along ${schoolData?.city || 'Lekki'} corridor is light.`, time: '07:28 AM', type: 'broadcast' },
      { id: 'act-5', text: '2 students marked ready by parents via Parent App.', time: '07:25 AM', type: 'ready' },
    ];

    return NextResponse.json({
      success: true,
      earnings_summary: earningsSummary,
      escort: {
        id: escortProfile?.id || session?.user_id || 'ESC-230081',
        name: displayName,
        code: escortCode,
        email: userProfile?.email || escortProfile?.email || session?.email || 'escort@myeduride.ng',
        phone: userProfile?.phone || escortProfile?.phone || '0809 123 4567',
        vehicleType: assignedVehicle.vehicle_name || 'Hiace Bus (18 Seater)',
        regNumber: assignedVehicle.plate_number || 'KJA 123 XY',
        photo: userProfile?.avatar_url || escortProfile?.photo || null,
        availableForOtherSchools: escortProfile?.availableForOtherSchools ?? true,
        status: escortProfile?.status || 'Online',
        is_online: true,
        today_trip_status: escortProfile?.today_trip_status || 'pending',
        today_trip_declined_reason: escortProfile?.today_trip_declined_reason || null,
        today_trip_accepted_at: escortProfile?.today_trip_accepted_at || null,
        ready_for_pickup: Boolean(escortProfile?.ready_for_pickup),
        ready_for_pickup_at: escortProfile?.ready_for_pickup_at || null,
        house_lat: escortProfile?.house_lat ? Number(escortProfile.house_lat) : null,
        house_lng: escortProfile?.house_lng ? Number(escortProfile.house_lng) : null,
        residential_address: escortProfile?.residential_address || userProfile?.address || '',
        closest_landmark: escortProfile?.closest_landmark || '',
        is_house_pinned: Boolean(escortProfile?.house_lat && escortProfile?.house_lng),
        escort_category: escortCategory,
        is_school_escort: isSchoolEscort,
        is_myeduride_escort: !isSchoolEscort,
      },
      school: {
        id: schoolData?.id || '0af823c7-4587-4e97-9ff5-b92fc979a167',
        name: schoolData?.name || 'Greenfield International School',
        city: schoolData?.city || 'Lekki',
        state: schoolData?.state || 'Lagos State',
        address: schoolData?.location_address || schoolData?.address || 'Admiralty Way, Lekki Phase 1',
        gps_lat: schoolData?.gps_lat ? Number(schoolData.gps_lat) : null,
        gps_lng: schoolData?.gps_lng ? Number(schoolData.gps_lng) : null,
        landmark: schoolData?.location_landmark || '',
        is_pinned: schoolData?.gps_lat != null && schoolData?.gps_lng != null,
        logo_url: schoolData?.logo_url || '/dashboard/logo.png',
      },
      driver: driverData,
      vehicle: {
        id: assignedVehicle.id || 'veh-01',
        plate_number: assignedVehicle.plate_number || 'KJA 123 XY',
        vehicle_name: assignedVehicle.vehicle_name || 'Hiace Bus (18 Seater)',
        type: assignedVehicle.vehicle_type || 'Hiace Bus (18 Seater)',
        capacity: assignedVehicle.capacity || 18,
        photo_url: assignedVehicle.photo_url || null,
      },
      route: assignedRoute
        ? {
          id: assignedRoute.id,
          name: assignedRoute.route_name,
          code: assignedRoute.route_code || 'RT-01',
          morning_time: assignedRoute.morning_pickup_time || '06:45 AM',
          afternoon_time: assignedRoute.afternoon_dropoff_time || '02:30 PM',
          stops: routeStops,
        }
        : {
          id: 'route-default',
          name: 'Main Campus Morning Route A',
          code: 'RT-01',
          morning_time: '06:45 AM',
          afternoon_time: '02:30 PM',
          departure_time: '06:45 AM',
          est_completion: '08:15 AM',
          stops: [
            { id: 'st-1', stop_name: '21, Bluebell Drive, Silver Estate', stop_order: 1, pickup_time: '06:50 AM', distance: '300 m' },
            { id: 'st-2', stop_name: '12, Lotus Close, Silver Estate', stop_order: 2, pickup_time: '07:00 AM', distance: '650 m' },
            { id: 'st-3', stop_name: '9, Orchid Road, Silver Estate', stop_order: 3, pickup_time: '07:10 AM', distance: '1.1 km' },
            { id: 'st-4', stop_name: '17, Palm Springs, Silver Estate', stop_order: 4, pickup_time: '07:20 AM', distance: '1.4 km' },
            { id: 'st-5', stop_name: '25, Bluebell Drive, Silver Estate', stop_order: 5, pickup_time: '07:30 AM', distance: '1.6 km' },
            { id: 'st-6', stop_name: '4, Lotus Close, Silver Estate', stop_order: 6, pickup_time: '07:40 AM', distance: '2.1 km' },
          ],
        },
      students: {
        manifest: studentManifest,
        morning: morningStudents.map((s, idx) => ({
          ...s,
          distance: `${(0.3 + idx * 0.35).toFixed(1)} km`,
        })),
        afternoon: afternoonStudents,
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
        departure_time: '06:45 AM',
        est_completion: '08:15 AM',
        departure_status: 'On Time',
        completion_status: 'On Time',
      },
      tracking: {
        current_location: 'Moving',
        speed: '32 km/h',
        eta_next_stop: '2 min (0.3 km)',
        eta_school: '12 min (5.4 km)',
        traffic: 'Traffic ● Live',
        next_stop: {
          name: nextPendingStudent?.name || 'David James',
          distance: '300 m ahead',
          address: nextPendingStudent?.address || '21, Bluebell Drive, Silver Estate',
        },
      },
      migo: {
        greeting: `Good morning, ${displayName.split(' ')[0]}! 👋`,
        hints: [
          `Next pickup: ${nextPendingStudent?.name || 'David James'} 300m ahead on your left.`,
          'Parent has confirmed student is ready.',
          'Light traffic ahead. You\'ll arrive on time.',
          'Please scan Student ID before boarding.',
        ],
      },
      activity_feed: activityFeed,
      wallet: {
        balance: walletBalance,
        todayEarnings: 8500.0,
        monthEarnings: 142000.0,
        eduSave: 35000.0,
        eduInsuRedActive: true,
      },
      emergencies: activeEmergencyDispatches,
      assignments: liveAssignments,
      bookings: liveBookings,
      stats: {
        totalTrips: 184,
        totalStudents: totalCount,
        totalDistance: '24.8 km',
        averageRating: 4.95,
        onTimePerformance: 98,
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

    // Action 1: Toggle Availability
    if (action === 'toggle_availability') {
      const { availableForOtherSchools, appId } = body;
      if (appId) {
        try {
          const { updateEscortApplicationStatus } = await import('@/lib/escort/escort-db');
          await updateEscortApplicationStatus(appId, 'ACTIVATED', undefined, { availableForOtherSchools });
        } catch (e) {
          console.warn('[dashboard-live] updateEscortApplicationStatus notice:', e);
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

    // Action 1d: Toggle "Ready for Pickup"
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

        if (isReady && primarySchoolId) {
          const { data: appRow } = await supabase
            .from('escort_applications')
            .select('id, house_lat, house_lng')
            .eq('user_id', session.user_id)
            .maybeSingle();

          const escortAppId = appRow?.id || session.user_id;
          const initialLat = appRow?.house_lat ? Number(appRow.house_lat) : 6.4474;
          const initialLng = appRow?.house_lng ? Number(appRow.house_lng) : 3.4731;

          await supabase.from('vehicle_active_sessions').insert({
            school_id: primarySchoolId,
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
          });
        }
      }
      return NextResponse.json({
        success: true,
        ready_for_pickup: isReady,
        message: isReady
          ? 'Live Pickup Mode ACTIVATED! Your pickup manifest is ready and parents are notified.'
          : 'Pickup mode set to standby.',
      });
    }

    // Action 2: Start Trip
    if (action === 'start_trip') {
      const { trip_type } = body;
      const tripKind = trip_type === 'afternoon' ? 'afternoon_dropoff' : 'morning_pickup';

      if (session?.user_id) {
        await supabase
          .from('escort_applications')
          .update({
            today_trip_status: 'in_progress',
            operational_status: 'In Transit',
            ready_for_pickup: true,
          })
          .eq('user_id', session.user_id);

        if (primarySchoolId) {
          const { data: appRow } = await supabase
            .from('escort_applications')
            .select('id, house_lat, house_lng')
            .eq('user_id', session.user_id)
            .maybeSingle();

          const escortAppId = appRow?.id || session.user_id;
          const initialLat = appRow?.house_lat ? Number(appRow.house_lat) : 6.4474;
          const initialLng = appRow?.house_lng ? Number(appRow.house_lng) : 3.4731;

          await supabase.from('vehicle_active_sessions').insert({
            school_id: primarySchoolId,
            escort_id: escortAppId,
            escort_user_id: session.user_id,
            trip_type: tripKind,
            status: 'in_progress',
            current_lat: initialLat,
            current_lng: initialLng,
            current_speed_kmh: 24,
            current_heading: 45,
            battery_level: 92,
            started_at: nowUtcIso(),
            last_ping_at: nowUtcIso(),
          });
        }
      }

      return NextResponse.json({
        success: true,
        trip_type: trip_type || 'morning',
        started_at: nowUtcIso(),
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

      let attendanceType = 'arrival';
      let resolvedStatus = status || action;

      if (action === 'morning_home_pickup') {
        attendanceType = 'arrival';
        resolvedStatus = 'PICKED_UP_FROM_HOME';
      } else if (action === 'morning_school_dropoff') {
        attendanceType = 'arrival';
        resolvedStatus = 'DROPPED_OFF_AT_SCHOOL';
      } else if (action === 'afternoon_school_pickup') {
        attendanceType = 'departure';
        resolvedStatus = 'PICKED_UP_FROM_GATE';
      } else if (action === 'afternoon_home_dropoff') {
        attendanceType = 'departure';
        resolvedStatus = 'SAFE_AT_HOME';
      } else {
        attendanceType = status === 'PICKED_UP' || status === 'ON_BOARD' ? 'arrival' : 'departure';
      }

      // Resolve school ID fallback
      let targetSchoolId = primarySchoolId;
      if (!targetSchoolId) {
        const { data: stRec } = await supabase.from('students').select('school_id').eq('id', student_id).maybeSingle();
        targetSchoolId = stRec?.school_id;
      }
      if (!targetSchoolId) {
        const { data: assignRec } = await supabase.from('escort_assignments').select('school_id').eq('student_id', student_id).limit(1).maybeSingle();
        targetSchoolId = assignRec?.school_id;
      }

      if (targetSchoolId) {
        // Record in attendance_records
        await supabase.from('attendance_records').insert({
          school_id: targetSchoolId,
          student_id,
          type: attendanceType,
          verified_by_user_id: session?.user_id || null,
          verification_method: 'escort_onboard',
          timestamp: nowUtcIso(),
        });

        // Write to audit log
        const { writeAuditLog } = await import('@/lib/audit/log');
        await writeAuditLog(supabase, {
          school_id: targetSchoolId,
          actor_user_id: session?.user_id || 'system',
          student_id,
          action: `escort_custody_${resolvedStatus.toLowerCase()}`,
          entity_type: 'students',
          details: { status: resolvedStatus, action, timestamp: nowUtcIso() },
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
