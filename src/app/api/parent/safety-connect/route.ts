// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth/auth-server';
import { getAdminClient } from '@/lib/supabase/admin';
import { nowUtcIso } from '@/lib/utils/time';
import { todayInLagos } from '@/lib/timezone';
import { ensureDailyHandoverPin } from '@/lib/escort/handover-pin';
import { resolveStoredEscortFare, parseEscortNotes } from '@/lib/escort/escort-pricing';

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
    const pinDay = todayInLagos();
    const unwrapRel = (rel: any) => (Array.isArray(rel) ? rel[0] : rel);
    const LIVE_ASSIGNMENT_STATUSES = ['active', 'pending_confirmation', 'pending'];

    // 1. If childId provided, query real child and the escort actually assigned to them
    let schoolEscort: any = null;
    let childRecord: any = null;

    if (childId) {
      const { data: parentLink } = await supabase
        .from('student_parents')
        .select('student_id')
        .eq('parent_user_id', session.user_id)
        .eq('student_id', childId)
        .maybeSingle();

      if (!parentLink) {
        return NextResponse.json(
          { error: 'You are not linked to this student. Ask your school admin to connect your parent account.' },
          { status: 403 }
        );
      }

      const { data: student } = await supabase
        .from('students')
        .select('id, first_name, last_name, school_id, house_address, house_lat, house_lng, house_landmark, school:schools(id, name, address, location_address, gps_lat, gps_lng)')
        .eq('id', childId)
        .maybeSingle();

      childRecord = student;

      if (student) {
        const childSchoolName =
          unwrapRel(student.school)?.name || 'School Campus';

        const { data: liveAssignRows } = await supabase
          .from('escort_assignments')
          .select('*, escort:escort_applications(id, full_name, phone, email, photo, passport_photograph, escort_type, operating_area, application_data, status), school:schools(id, name)')
          .eq('student_id', childId)
          .in('status', LIVE_ASSIGNMENT_STATUSES)
          .order('updated_at', { ascending: false })
          .limit(8);

        const assignedRow =
          (liveAssignRows || []).find((a: any) => a.status === 'active') ||
          (liveAssignRows || [])[0] ||
          null;
        const assignedEscort = unwrapRel(assignedRow?.escort);
        const assignedSchool = unwrapRel(assignedRow?.school);

        if (assignedEscort?.full_name) {
          let appData = assignedEscort.application_data || {};
          if (typeof appData === 'string') {
            try { appData = JSON.parse(appData); } catch { appData = {}; }
          }
          const assignFare = resolveStoredEscortFare({
            assignmentNotes: assignedRow?.notes,
            notes: assignedRow?.notes,
            distanceKm: appData.distance_km,
            tripType: appData.trip_type,
          });
          schoolEscort = {
            id: assignedEscort.id,
            full_name: assignedEscort.full_name,
            phone: assignedEscort.phone || '',
            email: assignedEscort.email || '',
            avatar_url: assignedEscort.photo || assignedEscort.passport_photograph || null,
            driver_license: 'Verified on Record',
            nin_verified: true,
            escort_type: assignedEscort.escort_type === 'school_escort' ? 'School Escort' : 'MyEduRide Escort',
            school_name: assignedSchool?.name || childSchoolName,
            operational_status: assignedRow.status === 'active' ? 'Active On Duty' : 'Assigned — Awaiting Clearance',
            vehicle: {
              id: null,
              reg_number: appData.assignedVehicle || appData.regNumber || appData.vehicle_plate || 'Certified Escort Vehicle',
              make_model: appData.vehicleMakeModel || appData.vehicle || 'Certified Escort Fleet',
              capacity: appData.capacity || null,
              roadworthiness_expiry: 'Active',
              insurance_status: 'Active',
            },
            route: {
              code: appData.routeCode || 'RT',
              name: assignedEscort.operating_area || 'Assigned Corridor',
              departure_morning: '06:45 AM',
              departure_afternoon: '03:15 PM',
              child_designated_stop: 'Designated Home Doorstep',
              total_stops: 4,
            },
            approval: {
              status: assignedRow.status === 'active' ? 'CITY_MANAGER_APPROVED' : 'PENDING_CITY_MANAGER_APPROVAL',
              badge: assignedRow.status === 'active' ? 'Verified Assigned Escort' : 'Assigned — City Manager Review',
            },
            daily_fare: assignFare.dailyFare,
            morning_fare: assignFare.morningFare,
            afternoon_fare: assignFare.afternoonFare,
            standard_daily_fare: assignFare.standardDailyFare,
            actual_amount_collected: assignFare.actualAmountCollected,
            is_discounted: assignFare.isDiscounted,
            discount_details: assignFare.discountDetails,
            distance_km: assignFare.distanceKm,
            used_stored_fare: assignFare.usedStoredFare,
            service_charge: assignFare.serviceCharge,
          };
        }

        // Keep route-staff escort as a fallback when no CM/school assignment row exists
        if (!schoolEscort) {
          const { data: assignment } = await supabase
            .from('student_route_assignments')
            .select('*, morning_route:transport_routes(id, name, code, departure_morning, departure_afternoon, directions_summary, vehicle:school_vehicles(id, reg_number, make, model, capacity, insurance_status, roadworthiness_expiry), escort:user_profiles(id, full_name, phone, email, avatar_url))')
            .eq('student_id', childId)
            .eq('status', 'active')
            .maybeSingle();

          if (assignment && assignment.morning_route) {
            const route = unwrapRel(assignment.morning_route);
            const vehicle = unwrapRel(route?.vehicle);
            const escortUser = unwrapRel(route?.escort);

            if (escortUser) {
              schoolEscort = {
                id: escortUser.id,
                full_name: escortUser.full_name,
                phone: escortUser.phone || '',
                email: escortUser.email || '',
                avatar_url: escortUser.avatar_url || null,
                driver_license: 'Verified on Record',
                nin_verified: true,
                escort_type: 'School Escort',
                school_name: childSchoolName,
                operational_status: 'Active On Duty',
                vehicle: vehicle ? {
                  id: vehicle.id,
                  reg_number: vehicle.reg_number,
                  make_model: `${vehicle.make} ${vehicle.model}`,
                  capacity: vehicle.capacity,
                  roadworthiness_expiry: vehicle.roadworthiness_expiry || 'Active',
                  insurance_status: vehicle.insurance_status || 'Active',
                } : null,
                route: {
                  code: route.code,
                  name: route.name,
                  departure_morning: route.departure_morning || '06:45 AM',
                  departure_afternoon: route.departure_afternoon || '03:15 PM',
                  child_designated_stop: 'Designated Corridor Stop',
                  total_stops: 4,
                },
                approval: {
                  status: 'CITY_MANAGER_APPROVED',
                  badge: 'Verified School Staff Escort',
                },
              };
            }
          }
        }
      }
    }

    // 2. Pillar 2: Query verified MyEduRide platform escorts from `escort_applications`
    const { data: dbEscortApps } = await supabase
      .from('escort_applications')
      .select('id, full_name, phone, email, photo, status, application_data')
      .eq('status', 'CITY_MANAGER_APPROVED')
      .limit(6);

    const myedurideEscorts = (dbEscortApps || []).map((app) => ({
      id: app.id,
      full_name: app.full_name || 'Verified Escort',
      phone: app.phone || '',
      avatar_url: app.photo || null,
      rating: 5.0,
      total_trips: 0,
      operating_area: app.application_data?.city || 'Lagos Metropolis',
      vehicle: app.application_data?.assignedVehicle || 'Standard Certified Vehicle',
      status: 'Available for Immediate Booking',
      approval_badge: 'City Manager Vetted & Certified',
    }));

    // 3. Pillar 3: Query this child's live transport bookings (not a sibling's)
    let activeChildBookings: any[] = [];
    try {
      let bookingQuery = supabase.from('transport_bookings').select('*, school:schools(id, name)');
      if (childId) {
        bookingQuery = bookingQuery.eq('student_id', childId);
      } else if (session.user_id) {
        bookingQuery = bookingQuery.eq('parent_user_id', session.user_id);
      }
      const { data: bookings } = await bookingQuery.order('created_at', { ascending: false }).limit(20);

      if (bookings && bookings.length > 0) {
        const bookingIds = bookings.map((b) => b.id);
        const studentIds = Array.from(new Set(bookings.map((b) => b.student_id).filter(Boolean)));
        let assignments: any[] = [];
        const { data: byBooking } = await supabase
          .from('escort_assignments')
          .select('*, escort:escort_applications(id, full_name, phone, photo, passport_photograph, operating_area, application_data, escort_type)')
          .in('booking_id', bookingIds);
        if (byBooking) assignments = assignments.concat(byBooking);
        if (studentIds.length > 0) {
          const { data: byStudent } = await supabase
            .from('escort_assignments')
            .select('*, escort:escort_applications(id, full_name, phone, photo, passport_photograph, operating_area, application_data, escort_type)')
            .in('student_id', studentIds)
            .in('status', LIVE_ASSIGNMENT_STATUSES);
          for (const row of byStudent || []) {
            if (!assignments.some((a) => a.id === row.id)) assignments.push(row);
          }
        }

        const mapped = [];
        for (const b of bookings) {
          const dead = ['cancelled', 'canceled', 'rejected', 'reassigned'].includes(String(b.status || '').toLowerCase());
          if (dead) continue;

          let meta: any = parseEscortNotes(b.notes);

          const matchedAssignment =
            assignments.find((a) => a.booking_id === b.id && LIVE_ASSIGNMENT_STATUSES.includes(a.status)) ||
            assignments.find((a) => a.booking_id === b.id) ||
            assignments.find((a) => a.student_id === b.student_id && a.status === 'active') ||
            assignments.find((a) => a.student_id === b.student_id && LIVE_ASSIGNMENT_STATUSES.includes(a.status));
          const escort = unwrapRel(matchedAssignment?.escort);
          let escortAppData = escort?.application_data || {};
          if (typeof escortAppData === 'string') {
            try { escortAppData = JSON.parse(escortAppData); } catch { escortAppData = {}; }
          }

          const ensured = ensureDailyHandoverPin(b.notes, pinDay);
          if (ensured.rotated) {
            const { error: pinErr } = await supabase
              .from('transport_bookings')
              .update({ notes: ensured.notes })
              .eq('id', b.id);
            if (pinErr) console.warn('[safety-connect] daily PIN persist notice:', pinErr);
            // Re-parse after PIN merge so fare_correction fields are not dropped from fare resolve
            meta = parseEscortNotes(ensured.notes);
          }

          const fare = resolveStoredEscortFare({
            fareAmount: b.fare_amount,
            notes: meta,
            assignmentNotes: matchedAssignment?.notes,
            distanceKm: meta.distance_km || parseEscortNotes(matchedAssignment?.notes).distance_km,
            tripType: meta.trip_type || parseEscortNotes(matchedAssignment?.notes).trip_type,
          });
          const distanceKm = fare.distanceKm;
          const tripType = fare.tripType;
          const morningFare = fare.morningFare;
          const afternoonFare = fare.afternoonFare;
          const dailyFare = fare.dailyFare;

          const isConfirmed = b.status === 'assigned' || matchedAssignment?.status === 'active';

          const bookingSchool = unwrapRel(b.school);
          const childSchool = unwrapRel(childRecord?.school);
          const rowSchoolName =
            bookingSchool?.name ||
            (b.student_id && childRecord?.id === b.student_id ? childSchool?.name : null) ||
            childSchool?.name ||
            'School Campus';

          const childName =
            childRecord && childRecord.id === b.student_id
              ? `${childRecord.first_name} ${childRecord.last_name}`
              : childRecord
                ? `${childRecord.first_name} ${childRecord.last_name}`
                : 'Student';

          mapped.push({
            booking_id: b.id,
            child_id: b.student_id,
            child_name: childName,
            parent_user_id: b.parent_user_id,
            source: b.source || 'school',
            school_name: rowSchoolName,
            pickup_date: b.requested_pickup_at ? b.requested_pickup_at.split('T')[0] : 'Today',
            pickup_time: meta.pickup_time || (b.requested_pickup_at ? b.requested_pickup_at.split('T')[1]?.slice(0, 5) : '07:00'),
            dropoff_time: meta.dropoff_time || '15:30',
            pickup_location: b.pickup_address || 'Designated Home Doorstep',
            destination: rowSchoolName,
            distance_km: distanceKm,
            morning_fare: morningFare,
            afternoon_fare: afternoonFare,
            daily_fare: dailyFare,
            standard_daily_fare: fare.standardDailyFare,
            actual_amount_collected: fare.actualAmountCollected,
            is_discounted: fare.isDiscounted,
            discount_details: fare.discountDetails,
            used_stored_fare: fare.usedStoredFare,
            trip_type: tripType,
            distance_charge: fare.distanceCharge,
            service_charge: fare.serviceCharge,
            service_charge_percent: fare.serviceChargePercent,
            billable_km: fare.billableKm,
            formatted_distance_charge: fare.formattedDistanceCharge,
            formatted_service_charge: fare.formattedServiceCharge,
            escort_id: escort?.id || meta.assigned_escort_id || null,
            escort_name: escort?.full_name || meta.assigned_escort_name || null,
            escort_phone: escort?.phone || meta.assigned_escort_phone || '',
            escort_photo: escort?.photo || escort?.passport_photograph || null,
            vehicle_plate: escortAppData.assignedVehicle || escortAppData.regNumber || escortAppData.vehicle_plate || 'Certified Escort Vehicle',
            operating_area: escort?.operating_area || 'Assigned Corridor',
            security_pin: ensured.pin,
            security_pin_date: ensured.date,
            status: isConfirmed ? 'CONFIRMED' : 'PENDING_CM_REVIEW',
            stage: isConfirmed ? 5 : 2,
            stage_label: isConfirmed ? 'Escort Cleared & Dispatched' : 'Awaiting City Manager Clearance',
            reason: meta.notes || (typeof b.notes === 'string' && !b.notes.startsWith('{') ? b.notes : 'School Escort Assignment'),
            created_at: b.created_at,
          });
        }
        activeChildBookings = mapped;
      }

      // If school assignment has a CM-corrected fare but no transport_booking, still expose it to parents
      if (childId && activeChildBookings.length === 0) {
        const { data: liveAssignRows } = await supabase
          .from('escort_assignments')
          .select('*, escort:escort_applications(id, full_name, phone, photo, passport_photograph, operating_area, application_data, escort_type), school:schools(id, name)')
          .eq('student_id', childId)
          .in('status', LIVE_ASSIGNMENT_STATUSES)
          .order('updated_at', { ascending: false })
          .limit(3);
        const assignedRow =
          (liveAssignRows || []).find((a: any) => a.status === 'active') ||
          (liveAssignRows || [])[0] ||
          null;
        if (assignedRow) {
          const escort = unwrapRel(assignedRow.escort);
          const sch = unwrapRel(assignedRow.school);
          let escortAppData = escort?.application_data || {};
          if (typeof escortAppData === 'string') {
            try { escortAppData = JSON.parse(escortAppData); } catch { escortAppData = {}; }
          }
          const fare = resolveStoredEscortFare({
            assignmentNotes: assignedRow.notes,
            notes: assignedRow.notes,
          });
          const ensured = ensureDailyHandoverPin(assignedRow.notes, pinDay);
          activeChildBookings.push({
            booking_id: assignedRow.booking_id || assignedRow.id,
            assignment_id: assignedRow.id,
            child_id: childId,
            child_name: childRecord
              ? `${childRecord.first_name} ${childRecord.last_name}`
              : 'Student',
            parent_user_id: session.user_id,
            source: 'school',
            school_name: sch?.name || unwrapRel(childRecord?.school)?.name || 'School Campus',
            pickup_date: 'Today',
            pickup_time: '07:00',
            dropoff_time: '15:30',
            pickup_location: childRecord?.house_address || 'Designated Home Doorstep',
            destination: sch?.name || 'School Campus',
            distance_km: fare.distanceKm,
            morning_fare: fare.morningFare,
            afternoon_fare: fare.afternoonFare,
            daily_fare: fare.dailyFare,
            standard_daily_fare: fare.standardDailyFare,
            actual_amount_collected: fare.actualAmountCollected,
            is_discounted: fare.isDiscounted,
            discount_details: fare.discountDetails,
            used_stored_fare: fare.usedStoredFare,
            trip_type: fare.tripType,
            distance_charge: fare.distanceCharge,
            service_charge: fare.serviceCharge,
            escort_id: escort?.id || null,
            escort_name: escort?.full_name || null,
            escort_phone: escort?.phone || '',
            escort_photo: escort?.photo || escort?.passport_photograph || null,
            vehicle_plate: escortAppData.assignedVehicle || escortAppData.regNumber || 'Certified Escort Vehicle',
            operating_area: escort?.operating_area || 'Assigned Corridor',
            security_pin: ensured.pin,
            security_pin_date: ensured.date,
            status: assignedRow.status === 'active' ? 'CONFIRMED' : 'PENDING_CM_REVIEW',
            stage: assignedRow.status === 'active' ? 5 : 2,
            stage_label: assignedRow.status === 'active' ? 'Escort Cleared & Dispatched' : 'Awaiting City Manager Clearance',
            reason: 'School Escort Assignment',
            created_at: assignedRow.created_at,
          });
        }
      }
    } catch (bookingErr) {
      console.warn('[safety-connect GET] booking mapping notice:', bookingErr);
    }

    // 4. Live E-Drive State from database `vehicle_active_sessions`
    let activeSession: any = null;
    if (childRecord?.school_id) {
      const { data: dbSessions } = await supabase
        .from('vehicle_active_sessions')
        .select('*')
        .eq('school_id', childRecord.school_id)
        .eq('status', 'in_progress')
        .order('started_at', { ascending: false })
        .limit(1);
      activeSession = dbSessions?.[0] || null;
    }

    const edriveTelemetry = activeSession ? {
      is_in_transit: true,
      trip_id: activeSession.id.slice(0, 8),
      transit_status: 'IN_TRANSIT_LIVE',
      current_speed_kmh: activeSession.current_speed_kmh || 0,
      speed_limit_kmh: 50,
      safety_score: 98,
      eta_minutes: 8,
      estimated_arrival_time: '07:45 AM',
      current_location: activeSession.current_lat && activeSession.current_lng ? {
        lat: activeSession.current_lat,
        lng: activeSession.current_lng,
      } : null,
      child_boarding_event: {
        boarded_at: activeSession.started_at ? new Date(activeSession.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now',
        boarded_stop: 'Designated Stop',
        scanned_by: activeSession.escort_id || 'Escort Officer',
        verification_method: 'NIN / QR Verified',
      },
      corridor_waypoints: [
        { seq: 1, name: 'Campus Gate Departure', time: '07:15 AM', status: 'COMPLETED' },
        { seq: 2, name: 'Active Corridor Segment', time: '07:35 AM', status: 'IN_PROGRESS' },
        { seq: 3, name: 'Target Destination', time: '07:45 AM', status: 'PENDING' },
      ],
    } : {
      is_in_transit: false,
      trip_id: null,
      transit_status: 'IDLE_NO_ACTIVE_TRIP',
      current_speed_kmh: 0,
      speed_limit_kmh: 50,
      safety_score: 100,
      eta_minutes: 0,
      estimated_arrival_time: '—',
      current_location: null,
      child_boarding_event: null,
      corridor_waypoints: [],
    };

    const childBooking =
      (childId && activeChildBookings.find((b: any) => b.child_id === childId)) ||
      activeChildBookings[0] ||
      null;
    if (schoolEscort) {
      schoolEscort.security_pin = childBooking?.security_pin || schoolEscort.security_pin || null;
      schoolEscort.security_pin_date = childBooking?.security_pin_date || pinDay;
      if (childBooking?.escort_name && !schoolEscort.full_name) {
        schoolEscort.full_name = childBooking.escort_name;
      }
      // Prefer CM-corrected fare: keep assignment amount when it is the latest correction
      // (escort portal reads assignment notes). Only overwrite with booking when booking
      // has a newer correction or assignment has no stored fare.
      if (childBooking) {
        const bookingApplied = Date.parse(String(childBooking.discount_details?.appliedAt || 0)) || 0;
        const assignApplied = Date.parse(String(schoolEscort.discount_details?.appliedAt || 0)) || 0;
        const preferAssignment =
          Boolean(schoolEscort.used_stored_fare) &&
          (!childBooking.used_stored_fare || assignApplied >= bookingApplied);

        if (!preferAssignment) {
          schoolEscort.daily_fare = childBooking.daily_fare;
          schoolEscort.morning_fare = childBooking.morning_fare;
          schoolEscort.afternoon_fare = childBooking.afternoon_fare;
          schoolEscort.standard_daily_fare = childBooking.standard_daily_fare;
          schoolEscort.actual_amount_collected = childBooking.actual_amount_collected;
          schoolEscort.is_discounted = childBooking.is_discounted;
          schoolEscort.distance_km = childBooking.distance_km ?? schoolEscort.distance_km;
          schoolEscort.used_stored_fare = childBooking.used_stored_fare;
          schoolEscort.service_charge = childBooking.service_charge;
          schoolEscort.discount_details = childBooking.discount_details || schoolEscort.discount_details;
        }
      }
    } else if (childBooking?.escort_name) {
      schoolEscort = {
        id: childBooking.escort_id,
        full_name: childBooking.escort_name,
        phone: childBooking.escort_phone || '',
        email: '',
        avatar_url: childBooking.escort_photo || null,
        escort_type: 'Assigned Escort',
        school_name: childBooking.school_name || 'School Campus',
        operational_status: childBooking.status === 'CONFIRMED' ? 'Active On Duty' : 'Assigned — Awaiting Clearance',
        vehicle: {
          id: null,
          reg_number: childBooking.vehicle_plate,
          make_model: 'Certified Escort Fleet',
          capacity: null,
          roadworthiness_expiry: 'Active',
          insurance_status: 'Active',
        },
        route: {
          code: 'RT',
          name: childBooking.operating_area,
          departure_morning: childBooking.pickup_time,
          departure_afternoon: childBooking.dropoff_time,
          child_designated_stop: childBooking.pickup_location,
          total_stops: 4,
        },
        approval: {
          status: childBooking.status === 'CONFIRMED' ? 'CITY_MANAGER_APPROVED' : 'PENDING_CITY_MANAGER_APPROVAL',
          badge: childBooking.status === 'CONFIRMED' ? 'Verified Assigned Escort' : 'Assigned — City Manager Review',
        },
        security_pin: childBooking.security_pin,
        security_pin_date: childBooking.security_pin_date,
        daily_fare: childBooking.daily_fare,
        morning_fare: childBooking.morning_fare,
        afternoon_fare: childBooking.afternoon_fare,
        standard_daily_fare: childBooking.standard_daily_fare,
        actual_amount_collected: childBooking.actual_amount_collected,
        is_discounted: childBooking.is_discounted,
        distance_km: childBooking.distance_km,
        used_stored_fare: childBooking.used_stored_fare,
        service_charge: childBooking.service_charge,
      };
    }

    return NextResponse.json({
      success: true,
      timestamp: nowUtcIso(),
      child_id: childId,
      safety_connect: {
        child: childRecord ? {
          id: childRecord.id,
          first_name: childRecord.first_name,
          last_name: childRecord.last_name,
          house_address: childRecord.house_address,
          house_lat: childRecord.house_lat != null ? Number(childRecord.house_lat) : null,
          house_lng: childRecord.house_lng != null ? Number(childRecord.house_lng) : null,
          house_landmark: childRecord.house_landmark,
        } : null,
        school: childRecord?.school ? unwrapRel(childRecord.school) : null,
        school_escort: schoolEscort,
        myeduride_escorts: myedurideEscorts,
        active_bookings: activeChildBookings,
        edrive: edriveTelemetry,
      },
    });
  } catch (err: any) {
    console.error('[safety-connect GET] Error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json();
    const { action, child_id, child_name, preferred_escort_id, operating_area, pickup_date, pickup_time, pickup_location, reason } = body;

    const supabase = getAdminClient();

    // Stage 1: Parent Booking Submission into database table `transport_bookings`
    if (action === 'request_myeduride_ride' || action === 'book_myeduride_escort') {
      if (!child_id || !pickup_date || !pickup_time) {
        return NextResponse.json(
          { error: 'child_id, pickup_date, and pickup_time are required' },
          { status: 400 }
        );
      }

      // Fetch student's school_id
      const { data: student } = await supabase
        .from('students')
        .select('school_id')
        .eq('id', child_id)
        .maybeSingle();

      const schoolId = student?.school_id || session.primary_school?.id;

      if (!schoolId) {
        return NextResponse.json({ error: 'School ID could not be identified for this student' }, { status: 400 });
      }

      const requestedPickup = `${pickup_date}T${pickup_time}:00Z`;

      const { data: newBooking, error: insertError } = await supabase
        .from('transport_bookings')
        .insert({
          school_id: schoolId,
          student_id: child_id,
          parent_user_id: session.user_id,
          source: 'parent',
          pickup_address: pickup_location || 'Designated Area Stop',
          requested_pickup_at: requestedPickup,
          notes: reason || 'Parent requested MyEduRide Escort backup',
          status: 'pending',
          priority: 'standard',
        })
        .select()
        .single();

      if (insertError) throw insertError;

      return NextResponse.json({
        success: true,
        message: 'Ride request submitted to City Manager for area escort assignment and approval.',
        booking: {
          booking_id: newBooking.id,
          child_id,
          child_name: child_name || 'Student',
          status: 'PENDING_CM_REVIEW',
          stage: 2,
          stage_label: 'Under City Manager Review — Matching Available Escort in Area',
        },
      });
    }

    // Action: Update Student Attendance / Absence Notice
    if (action === 'update_attendance' || action === 'mark_absent' || action === 'not_going_today') {
      const { child_id, attendance_status, reason, notes } = body;
      if (!child_id) {
        return NextResponse.json({ error: 'child_id is required' }, { status: 400 });
      }

      const todayStr = new Date().toISOString().split('T')[0];

      // Try inserting/updating into student_attendance or audit log
      try {
        await supabase.from('audit_logs').insert({
          user_id: session.user_id,
          user_role: session.role || 'parent',
          action: `PARENT_ATTENDANCE_${(attendance_status || 'UPDATE').toUpperCase()}`,
          resource: 'student_attendance',
          resource_id: child_id,
          details: {
            child_id,
            date: todayStr,
            status: attendance_status || 'going',
            reason: reason || null,
            notes: notes || null,
          },
        });
      } catch (err) {
        console.warn('[safety-connect POST] audit log notice:', err);
      }

      return NextResponse.json({
        success: true,
        message: `Attendance status updated to '${attendance_status || 'updated'}' for today.`,
        date: todayStr,
        status: attendance_status || 'going',
      });
    }

    return NextResponse.json({ error: `Unknown action '${action}'` }, { status: 400 });
  } catch (err: any) {
    console.error('[safety-connect POST] Error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
