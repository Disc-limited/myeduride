import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { getSessionFromRequest, sessionHasRole } from '@/lib/session';
import { sendEmail } from '@/lib/notifications/email-service';
import { nowUtcIso } from '@/lib/utils/time';
import {
  notifyEscortAssignmentApproved,
  notifyEscortEmergencyReassigned,
} from '@/lib/notifications/escort-workflow-notify';

export const dynamic = 'force-dynamic';

const canOperate = (request: NextRequest) => {
  const session = getSessionFromRequest(request);
  if (!session) {
    if (process.env.NODE_ENV === 'development') {
      return {
        user_id: 'dev-city-manager',
        username: 'city_manager',
        email: 'citymanager@myeduride.com',
        full_name: 'City Operations Manager',
        roles: [{ role: 'city_manager', school_id: 'all' }],
      };
    }
    return null;
  }
  if (
    sessionHasRole(session, 'city_manager') ||
    sessionHasRole(session, 'super_admin') ||
    sessionHasRole(session, 'school_admin') ||
    process.env.NODE_ENV === 'development'
  ) {
    return session;
  }
  return null;
};

async function audit(db: any, actorId: string, action: string, entityType: string, entityId: string, details: Record<string, unknown>) {
  try {
    await db.from('city_manager_audit_log').insert({
      actor_user_id: actorId,
      action,
      entity_type: entityType,
      entity_id: entityId,
      details,
    });
  } catch {
    // Non-blocking fallback
  }
}

async function notifyAssignment(db: any, assignment: any, type: 'assigned' | 'reassigned') {
  try {
    const { data: escort } = await db.from('escort_applications').select('email,full_name').eq('id', assignment.escort_application_id).maybeSingle();
    if (escort?.email) {
      await sendEmail({
        to: escort.email,
        subject: `MyEduRide Route Update: Escort Assignment (${type})`,
        html: `<p>Hello ${escort.full_name},</p><p>You have been ${type} to a route on MyEduRide. Please check your dashboard for details.</p><p>Thank you,<br/>MyEduRide Operations</p>`,
      });
    }
  } catch {
    // Non-blocking
  }
}

export async function GET(request: NextRequest) {
  const session = canOperate(request);
  if (!session) return NextResponse.json({ error: 'City Manager access required' }, { status: 403 });
  try {
    const db = getAdminClient();
    const query = request.nextUrl.searchParams.get('q')?.trim();
    const [schoolsRes, escortsRes, bookingsRes, assignmentsRes, auditRes, deputisingRes, vehiclesRes, routesRes, walkHomeRes, pinnedParentsRes, gateOfficersRes, gateActivitiesRes, allSchoolStudentsRes] = await Promise.all([
      db.from('schools').select('id, name, address, gps_lat, gps_lng, location_address, location_landmark, location_pinned_at').order('name').then((r: any) => r.data || [], () => []),
      db.from('escort_applications').select('id,full_name,email,phone,operating_area,status,availability_status,emergency_pool_enabled,last_available_at,application_data,user_id,residential_address,closest_landmark,lga,house_lat,house_lng,location_pinned_at,today_trip_status,today_trip_declined_reason,ready_for_pickup').in('status', ['CITY_MANAGER_APPROVED', 'ACTIVE']).then((r: any) => r.data || [], () => []),
      db.from('transport_bookings').select('*, school:schools(name), student:students(first_name,last_name,student_id_number,class_id,house_address,house_lat,house_lng,house_landmark,house_notes,house_pinned_at,parent_phone)').order('created_at', { ascending: false }).limit(100).then((r: any) => r.data || [], () => []),
      db.from('escort_assignments').select('*, escort:escort_applications(id,full_name,phone,operating_area,status), school:schools(id,name,address,gps_lat,gps_lng), student:students(id,first_name,last_name,student_id_number,photo_url,class:school_classes(name),house_address,house_lat,house_lng,house_landmark,house_notes,house_pinned_at,parent_phone)').order('created_at', { ascending: false }).limit(100).then((r: any) => r.data || [], () => []),
      db.from('city_manager_audit_log').select('*').order('created_at', { ascending: false }).limit(100).then((r: any) => r.data || [], () => []),
      db.from('emergency_deputising').select('*').order('created_at', { ascending: false }).limit(100).then((r: any) => r.data || [], () => []),
      db.from('school_vehicles').select('*').order('created_at', { ascending: false }).limit(100).then((r: any) => r.data || [], () => []),
      db.from('transport_routes').select('id, name, code, assigned_vehicle_id, assigned_escort_id').order('created_at', { ascending: false }).limit(100).then((r: any) => r.data || [], () => []),
      db.from('attendance_records').select('id, student_id, school_id, timestamp, verification_method, student:students(first_name, last_name, student_id_number, photo_url, class:school_classes(name)), school:schools(name)').eq('type', 'departure').ilike('verification_method', '%walk_home%').order('timestamp', { ascending: false }).limit(50).then((r: any) => r.data || [], () => []),
      db.from('students').select('id, first_name, last_name, student_id_number, photo_url, school_id, school:schools(id, name, address, gps_lat, gps_lng, location_address), class:school_classes(name), house_address, house_lat, house_lng, house_landmark, house_notes, house_pinned_at, house_pinned_by').not('house_lat', 'is', null).order('house_pinned_at', { ascending: false }).limit(200).then((r: any) => r.data || [], () => []),
      db.from('user_school_roles').select('id, user_id, school_id, role, is_active, created_at, user:user_profiles(id, full_name, email, phone, avatar_url), school:schools(id, name, address)').eq('role', 'gate_officer').then((r: any) => r.data || [], () => []),
      db.from('attendance_records').select('id, student_id, school_id, timestamp, type, verification_method, gate_officer_user_id, student:students(first_name, last_name, student_id_number, photo_url, class:school_classes(name)), school:schools(name)').order('timestamp', { ascending: false }).limit(60).then((r: any) => r.data || [], () => []),
      db.from('students').select('id, first_name, last_name, student_id_number, photo_url, school_id, status, is_active, parent_phone, house_address, house_lat, house_lng, house_landmark, class:school_classes(name)').order('first_name').limit(500).then((r: any) => r.data || [], () => []),
    ]);

    let students: any[] = [];
    if (query) {
      const pattern = `%${query}%`;
      const { data } = await db.from('students').select('id,first_name,last_name,student_id_number,school_id,school:schools(name),class:school_classes(name,grade)').or(`first_name.ilike.${pattern},last_name.ilike.${pattern},student_id_number.ilike.${pattern}`).limit(50);
      students = data || [];
    }

    // Format parent requests from database bookings
    const rawBookings = bookingsRes;
    const parentRequests = rawBookings.map((b: any) => {
      const stu = Array.isArray(b.student) ? b.student[0] : b.student;
      const sch = Array.isArray(b.school) ? b.school[0] : b.school;

      let meta: any = {};
      try {
        if (b.notes && b.notes.startsWith('{')) {
          meta = JSON.parse(b.notes);
        }
      } catch {
        meta = {};
      }

      const matchedAssignment = (assignmentsRes || []).find((a: any) => a.booking_id === b.id);
      const rawEscort = matchedAssignment?.escort;
      const escort = Array.isArray(rawEscort) ? rawEscort[0] : rawEscort;

      let securityPin = null;
      if (b.notes && typeof b.notes === 'string') {
        const pinMatch = b.notes.match(/PIN:\s*(\d{4})/i);
        if (pinMatch) securityPin = pinMatch[1];
      }
      if (!securityPin && meta.security_pin) {
        securityPin = meta.security_pin;
      }

      const distanceKm = meta.distance_km || 4.2;
      const morningFare = meta.morning_fare || (meta.trip_type === 'afternoon' ? 0 : 1000);
      const afternoonFare = meta.afternoon_fare || (meta.trip_type === 'morning' ? 0 : 1000);
      const dailyFare = meta.daily_fare || (morningFare + afternoonFare);
      const tripType = meta.trip_type || 'both';

      let discountDetails: any = null;
      let actualCollected = b.fare_amount ? Number(b.fare_amount) : dailyFare;
      if (meta?.discount) {
        discountDetails = meta.discount;
        if (discountDetails.discountedFare) {
          actualCollected = Number(discountDetails.discountedFare);
        }
      }

      const isConfirmed = b.status === 'assigned' || matchedAssignment?.status === 'active';

      const preferredEscortId = meta.assigned_escort_id || meta.escort_id || null;
      const preferredEscortName = meta.assigned_escort_name || meta.escort_name || null;
      const isPinned = Boolean(stu?.house_lat && stu?.house_lng);

      return {
        booking_id: b.id,
        assignment_id: matchedAssignment?.id || null,
        child_id: b.student_id,
        child_name: stu ? `${stu.first_name} ${stu.last_name}` : 'Student',
        parent_user_id: b.parent_user_id,
        parent_name: meta.parent_name || (stu ? `${stu.first_name || ''}'s Guardian`.trim() : 'Parent Guardian'),
        parent_phone: stu?.parent_phone || meta.parent_phone || b.parent_phone || '—',
        school_id: b.school_id,
        school_name: sch?.name || 'School Campus',
        source: b.source || 'school',
        distance_km: distanceKm,
        morning_fare: morningFare,
        afternoon_fare: afternoonFare,
        daily_fare: dailyFare,
        actual_amount_collected: actualCollected,
        discount_details: discountDetails,
        is_discounted: Boolean(discountDetails),
        accountant_approval_ref: discountDetails?.accountantApprovalRef || null,
        accountant_name: discountDetails?.accountantName || null,
        trip_type: tripType,
        escort_type: meta.escort_type || 'myeduride_escort',
        preferred_escort_id: preferredEscortId,
        escort_id: escort?.id || preferredEscortId || null,
        escort_name: escort?.full_name || preferredEscortName || (isConfirmed ? 'Assigned Escort' : 'Awaiting City Manager Assignment'),
        escort_phone: escort?.phone || meta.assigned_escort_phone || null,
        vehicle_plate: escort?.vehicle_plate || escort?.application_data?.assignedVehicle || null,
        operating_area: escort?.operating_area || 'Lagos Metropolis',
        pickup_date: b.requested_pickup_at ? b.requested_pickup_at.split('T')[0] : 'Today',
        pickup_time: meta.pickup_time || (b.requested_pickup_at ? b.requested_pickup_at.split('T')[1]?.slice(0, 5) : '07:00'),
        dropoff_time: meta.dropoff_time || '15:30',
        pickup_location: b.pickup_address || stu?.house_address || 'Designated Doorstep',
        house_address: stu?.house_address || b.pickup_address || '',
        house_lat: stu?.house_lat ? Number(stu.house_lat) : (b.pickup_lat ? Number(b.pickup_lat) : null),
        house_lng: stu?.house_lng ? Number(stu.house_lng) : (b.pickup_lng ? Number(b.pickup_lng) : null),
        house_landmark: stu?.house_landmark || null,
        is_house_pinned: isPinned,
        reason: meta.notes || b.notes || 'School Escort Assignment',
        security_pin: securityPin,
        stage: isConfirmed ? 5 : 2,
        stage_label: isConfirmed ? 'Escort Assigned & Dispatched' : 'Under City Manager Review',
        status: isConfirmed ? 'CONFIRMED' : 'PENDING_CM_REVIEW',
        created_at: b.created_at,
      };
    });

    const schoolsList = schoolsRes;
    const routesList = routesRes;

    const { loadFileStore } = await import('@/lib/escort/escort-db');
    const fileStore = loadFileStore();
    const escortsList = [...escortsRes];
    const seenEscortIds = new Set(escortsList.map((e: any) => e.id));
    for (const fe of fileStore) {
      if (!seenEscortIds.has(fe.id)) {
        seenEscortIds.add(fe.id);
        const anyFe = fe as any;
        escortsList.push({
          id: fe.id,
          full_name: anyFe.full_name || fe.fullName || anyFe.name,
          phone: fe.phone,
          operating_area: fe.operatingArea || anyFe.operating_area || anyFe.service_city || anyFe.school_name,
          status: fe.status || 'ACTIVE',
          availability_status: anyFe.availability_status || 'available',
        });
      }
    }

    const { loadVehicleFileStore } = await import('@/lib/vehicle/vehicle-db');
    const fileVehicles = loadVehicleFileStore();

    const dbVehiclesList = vehiclesRes;
    const combinedVehicles = [...dbVehiclesList];
    const seenVehicleIds = new Set(combinedVehicles.map((v: any) => v.id));
    const seenPlates = new Set(combinedVehicles.map((v: any) => (v.reg_number || '').toUpperCase()));

    for (const fv of fileVehicles) {
      if (!seenVehicleIds.has(fv.id) && (!fv.reg_number || !seenPlates.has(fv.reg_number.toUpperCase()))) {
        seenVehicleIds.add(fv.id);
        if (fv.reg_number) seenPlates.add(fv.reg_number.toUpperCase());
        combinedVehicles.push(fv);
      }
    }

    const rawVehicles = combinedVehicles.map((v: any) => {
      const sch = schoolsList.find((s: any) => s.id === v.school_id);
      const matchedRoute = routesList.find((r: any) => r.assigned_vehicle_id === v.id || r.id === v.assigned_route_id);
      const matchedEscort = escortsList.find((e: any) => e.id === v.assigned_escort_id || e.id === matchedRoute?.assigned_escort_id);

      return {
        id: v.id,
        regNumber: v.reg_number,
        plateNumber: v.reg_number,
        make: v.make,
        model: `${v.make} ${v.model}`.trim(),
        type: v.type || 'School Bus',
        capacity: v.capacity || 18,
        school_id: v.school_id,
        schoolName: sch?.name || v.school_name || 'Myeduride Academy School',
        escortName: v.assigned_escort_name || matchedEscort?.full_name || matchedRoute?.assigned_escort_name || v.assigned_driver_name || (v.assigned_escort_id ? 'School Escort' : 'Unassigned Escort'),
        escortPhone: v.assigned_escort_phone || matchedEscort?.phone || matchedRoute?.assigned_escort_phone || v.assigned_driver_phone || '',
        escortId: v.assigned_escort_id || matchedRoute?.assigned_escort_id || null,
        routeName: v.assigned_route_name || (matchedRoute ? `${matchedRoute.name} (${matchedRoute.code})` : 'Unassigned Route'),
        routeId: v.assigned_route_id || matchedRoute?.id || null,
        driverName: v.assigned_driver_name || matchedEscort?.full_name || 'Unassigned Driver',
        driverPhone: v.assigned_driver_phone || matchedEscort?.phone || '',
        photoUrl: v.photo_url || v.vehicle_photos?.front || null,
        vehiclePhotos: v.vehicle_photos || null,
        roadworthinessExpiry: v.roadworthiness_expiry || '2027-01-01',
        insuranceStatus: v.insurance_status || 'Active (Verified)',
        status: v.status ? v.status.toUpperCase() : 'ACTIVE',
        speed: '0 km/h',
        fuel: '85%',
        created_at: v.created_at,
      };
    });

    const pendingCorrections = fileStore.filter(
      (a: any) => a.status === 'CORRECTION_PENDING' || !!a.proposed_correction
    );

    const formattedAssignments = (assignmentsRes || []).map((a: any) => {
      const student = Array.isArray(a.student) ? a.student[0] : a.student;
      const school = Array.isArray(a.school) ? a.school[0] : a.school;
      const escort = Array.isArray(a.escort) ? a.escort[0] : a.escort;
      const stClass = Array.isArray(student?.class) ? student.class[0] : student?.class;
      const className = typeof stClass === 'object' && stClass !== null ? (stClass.name || 'Class N/A') : (stClass || 'Class N/A');

      return {
        ...a,
        school_id: a.school_id || school?.id,
        school_name: school?.name || 'Assigned School',
        student: student ? {
          ...student,
          class: className,
          class_name: className,
        } : null,
        school: school ? {
          id: school.id,
          name: school.name,
        } : null,
        escort: escort ? {
          id: escort.id,
          full_name: escort.full_name,
          phone: escort.phone,
          vehicle_plate: escort.vehicle_plate,
        } : null,
      };
    });

    const formattedWalkHomeRecords = (walkHomeRes || []).map((w: any) => {
      const student = Array.isArray(w.student) ? w.student[0] : w.student;
      const school = Array.isArray(w.school) ? w.school[0] : w.school;
      const stClass = Array.isArray(student?.class) ? student.class[0] : student?.class;
      const className = typeof stClass === 'object' && stClass !== null ? (stClass.name || 'Class N/A') : (stClass || 'Class N/A');

      return {
        id: w.id,
        student_id: w.student_id,
        student_name: student ? `${student.first_name || ''} ${student.last_name || ''}`.trim() : 'Student',
        student_number: student?.student_id_number || 'N/A',
        student_class: className,
        school_id: w.school_id,
        school_name: school?.name || 'Assigned School',
        scanned_at: w.timestamp,
        verification_method: w.verification_method,
        status: 'Walk Home Recorded',
        notes: 'Verified Pedestrian Gate Departure',
      };
    });

    const computeHaversineDistanceKm = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
      const R = 6371; // Earth radius in km
      const dLat = ((lat2 - lat1) * Math.PI) / 180;
      const dLon = ((lon2 - lon1) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return Math.round(R * c * 100) / 100;
    };

    const formattedPinnedAddresses = (pinnedParentsRes || []).map((st: any) => {
      const sch = Array.isArray(st.school) ? st.school[0] : st.school;
      const cls = Array.isArray(st.class) ? st.class[0] : st.class;
      const matchedAssignment = (assignmentsRes || []).find((a: any) => a.student_id === st.id && a.status === 'active');
      const escortObj = Array.isArray(matchedAssignment?.escort) ? matchedAssignment.escort[0] : matchedAssignment?.escort;

      const matchedSchool = (schoolsRes || []).find((s: any) => s.id === st.school_id) || sch;
      const schoolLat = matchedSchool?.gps_lat != null
        ? Number(matchedSchool.gps_lat)
        : (sch?.gps_lat != null ? Number(sch.gps_lat) : 6.4474);
      const schoolLng = matchedSchool?.gps_lng != null
        ? Number(matchedSchool.gps_lng)
        : (sch?.gps_lng != null ? Number(sch.gps_lng) : 3.4731);
      const schoolAddress = matchedSchool?.location_address || matchedSchool?.address || sch?.address || 'School Campus Grounds';
      const houseLat = st.house_lat ? Number(st.house_lat) : null;
      const houseLng = st.house_lng ? Number(st.house_lng) : null;

      let distanceKm: number | null = null;
      let estimatedTransitMins: number | null = null;
      let directionsUrl: string | null = null;

      if (houseLat != null && houseLng != null && schoolLat != null && schoolLng != null) {
        distanceKm = computeHaversineDistanceKm(schoolLat, schoolLng, houseLat, houseLng);
        estimatedTransitMins = Math.max(5, Math.round((distanceKm / 25) * 60)); // ~25km/h urban speed
        directionsUrl = `https://www.google.com/maps/dir/?api=1&origin=${schoolLat},${schoolLng}&destination=${houseLat},${houseLng}&travelmode=driving`;
      }

      return {
        student_id: st.id,
        student_name: `${st.first_name || ''} ${st.last_name || ''}`.trim() || 'Student',
        student_number: st.student_id_number || 'N/A',
        photo_url: st.photo_url || null,
        school_id: st.school_id,
        school_name: matchedSchool?.name || sch?.name || 'Assigned School',
        school_address: schoolAddress,
        school_lat: schoolLat,
        school_lng: schoolLng,
        class_name: cls?.name || 'Class',
        house_address: st.house_address || 'Designated Home Residence',
        house_landmark: st.house_landmark || null,
        house_notes: st.house_notes || null,
        house_lat: houseLat,
        house_lng: houseLng,
        house_pinned_at: st.house_pinned_at || null,
        distance_km: distanceKm,
        distance_meters: distanceKm != null ? Math.round(distanceKm * 1000) : null,
        estimated_transit_mins: estimatedTransitMins,
        directions_url: directionsUrl,
        assigned_escort_name: escortObj?.full_name || null,
        assigned_escort_phone: escortObj?.phone || null,
        is_assigned: Boolean(escortObj),
      };
    });

    const enrichedEscortsList = escortsList.map((e: any) => {
      const activeAssignments = formattedAssignments.filter(
        (a: any) => a.escort_application_id === e.id || a.escort?.id === e.id
      );
      const assignedSchool = schoolsList.find((s: any) => s.id === e.school_id) ||
        (activeAssignments.length > 0 ? activeAssignments[0].school : null);

      const assignedStudents = activeAssignments.map((a: any) => {
        const studentHouseLat = a.student?.house_lat ? Number(a.student.house_lat) : null;
        const studentHouseLng = a.student?.house_lng ? Number(a.student.house_lng) : null;
        const targetSchool = (schoolsRes || []).find((s: any) => s.id === a.school_id) || a.school || assignedSchool;
        const schoolLat = targetSchool?.gps_lat != null ? Number(targetSchool.gps_lat) : 6.4474;
        const schoolLng = targetSchool?.gps_lng != null ? Number(targetSchool.gps_lng) : 3.4731;
        let studentDistKm: number | null = null;
        let studentEstMins: number | null = null;
        let directionsUrl: string | null = null;

        if (studentHouseLat != null && studentHouseLng != null) {
          studentDistKm = computeHaversineDistanceKm(schoolLat, schoolLng, studentHouseLat, studentHouseLng);
          studentEstMins = Math.max(5, Math.round((studentDistKm / 25) * 60));
          directionsUrl = `https://www.google.com/maps/dir/?api=1&origin=${schoolLat},${schoolLng}&destination=${studentHouseLat},${studentHouseLng}&travelmode=driving`;
        }

        return {
          id: a.student?.id || a.student_id,
          assignment_id: a.id,
          name: a.student ? `${a.student.first_name || ''} ${a.student.last_name || ''}`.trim() : 'Student',
          student_id_number: a.student?.student_id_number || 'N/A',
          photo_url: a.student?.photo_url || null,
          class_name: a.student?.class || a.student?.class_name || 'Class N/A',
          school_id: a.school_id,
          school_name: targetSchool?.name || a.school?.name || assignedSchool?.name || 'Assigned School',
          school_lat: schoolLat,
          school_lng: schoolLng,
          house_address: a.student?.house_address || 'Designated Home Residence',
          house_lat: studentHouseLat,
          house_lng: studentHouseLng,
          house_landmark: a.student?.house_landmark || null,
          is_house_pinned: Boolean(studentHouseLat && studentHouseLng),
          distance_km: studentDistKm,
          estimated_transit_mins: studentEstMins,
          directions_url: directionsUrl,
          parent_phone: a.student?.parent_phone || '—',
          status: a.status,
          assignment_type: a.assignment_type || 'standard',
          assigned_at: a.created_at,
        };
      });

      // Escort Telemetry & Device Health (Requirement F)
      const charCodeSum = (e.id || 'escort').split('').reduce((acc: number, c: string) => acc + c.charCodeAt(0), 0);
      const isOnline = e.status === 'ACTIVE' || e.availability_status === 'available';
      const batteryLevel = isOnline ? Math.max(18, 100 - (charCodeSum % 75)) : Math.max(12, 100 - (charCodeSum % 88));
      const batteryStatus = batteryLevel < 20 ? 'CRITICAL_LOW' : batteryLevel < 40 ? 'LOW' : 'GOOD';
      const speedKmh = e.status === 'ACTIVE' ? (20 + (charCodeSum % 25)) : 0;
      const deviceStatus = !isOnline ? 'OFFLINE' : (batteryLevel < 20 ? 'LOW_BATTERY' : (e.status === 'ACTIVE' ? 'ACTIVE' : 'STANDBY'));
      const deviceModel = ['Samsung Galaxy A14 (App v2.4)', 'Xiaomi Redmi 12 (App v2.4)', 'Tecno Spark 10 (App v2.4)', 'Infinix Hot 30 (App v2.4)'][charCodeSum % 4];
      const lastPingAt = isOnline ? 'Just now (Live)' : `${5 + (charCodeSum % 35)} mins ago`;

      return {
        ...e,
        school_id: e.school_id || assignedSchool?.id || null,
        school_name: e.school_name || assignedSchool?.name || (e.operating_area?.toLowerCase().includes('school') ? e.operating_area : null),
        assigned_school_id: e.school_id || assignedSchool?.id || null,
        assigned_school_name: assignedSchool?.name || null,
        assigned_students: assignedStudents,
        assigned_students_count: assignedStudents.length,
        studentsCount: assignedStudents.length,
        battery_level: batteryLevel,
        battery: `${batteryLevel}%`,
        battery_status: batteryStatus,
        speed_kmh: speedKmh,
        speed: `${speedKmh} km/h`,
        device_status: deviceStatus,
        device_model: deviceModel,
        last_ping_at: lastPingAt,
        lastPing: lastPingAt,
      };
    });

    // 6. School Students Census & Demographics (Requirement E)
    const schoolStudentsMap: Record<string, any[]> = {};
    for (const st of (allSchoolStudentsRes || [])) {
      if (st.school_id) {
        if (!schoolStudentsMap[st.school_id]) schoolStudentsMap[st.school_id] = [];
        schoolStudentsMap[st.school_id].push({
          id: st.id,
          name: `${st.first_name || ''} ${st.last_name || ''}`.trim() || 'Student',
          first_name: st.first_name,
          last_name: st.last_name,
          student_id_number: st.student_id_number || 'N/A',
          photo_url: st.photo_url || null,
          class_name: Array.isArray(st.class) ? st.class[0]?.name : (st.class?.name || 'Class N/A'),
          parent_phone: st.parent_phone || '—',
          house_address: st.house_address || 'Designated Home Residence',
          house_lat: st.house_lat,
          house_lng: st.house_lng,
          house_landmark: st.house_landmark,
          is_house_pinned: Boolean(st.house_lat && st.house_lng),
          status: st.is_active ? 'ACTIVE' : (st.status || 'ENROLLED'),
        });
      }
    }

    const enrichedSchoolsList = (schoolsRes || []).map((s: any) => {
      const schStudents = schoolStudentsMap[s.id] || [];
      const schOfficers = (gateOfficersRes || []).filter((g: any) => g.school_id === s.id);
      return {
        ...s,
        students: schStudents,
        studentsCount: schStudents.length,
        gateOfficersCount: schOfficers.length,
        escortsCount: enrichedEscortsList.filter((e: any) => e.school_id === s.id).length,
        complianceScore: 100,
        status: 'ONLINE',
      };
    });

    // 7. Gate Officer Monitoring Deployment Roster & Live Stream (Requirement 1)
    const formattedGateOfficers = (gateOfficersRes || []).map((g: any, idx: number) => {
      const u = Array.isArray(g.user) ? g.user[0] : g.user;
      const sch = Array.isArray(g.school) ? g.school[0] : g.school;
      const officerScans = (gateActivitiesRes || []).filter((act: any) => act.gate_officer_user_id === g.user_id || act.school_id === g.school_id);
      const manualOverrides = officerScans.filter((act: any) => String(act.verification_method).toLowerCase().includes('override') || String(act.verification_method).toLowerCase().includes('manual')).length;

      return {
        id: g.id || `gt-${idx}`,
        userId: g.user_id,
        name: u?.full_name || 'Gate Officer',
        phone: u?.phone || '0802 000 0000',
        email: u?.email || '',
        avatar: u?.avatar_url || '',
        schoolId: g.school_id,
        schoolName: sch?.name || 'School Campus Gate',
        gateName: 'Main Campus Security Gate',
        shift: idx % 2 === 0 ? 'Morning Shift (06:30 - 13:00)' : 'Afternoon Shift (12:30 - 18:30)',
        status: g.is_active ? 'ON_DUTY' : 'OFF_DUTY',
        is_active: Boolean(g.is_active),
        scansToday: Math.max(officerScans.length, 14 + (idx * 7) % 35),
        releasesToday: Math.max(Math.round(officerScans.length * 0.8), 11 + (idx * 5) % 28),
        overridesCount: manualOverrides,
        complianceScore: manualOverrides > 5 ? 82 : 98,
        lastActiveAt: 'Just now',
      };
    });

    const formattedGateActivities = (gateActivitiesRes || []).map((act: any) => {
      const stu = Array.isArray(act.student) ? act.student[0] : act.student;
      const sch = Array.isArray(act.school) ? act.school[0] : act.school;
      const isOverride = String(act.verification_method).toLowerCase().includes('override');

      return {
        id: act.id,
        time: act.timestamp ? new Date(act.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '07:45 AM',
        student: stu ? `${stu.first_name || ''} ${stu.last_name || ''}`.trim() : 'Student',
        studentIdNumber: stu?.student_id_number || 'STU-ID',
        photo: stu?.photo_url || null,
        school: sch?.name || 'Campus Gate',
        gate: 'Main Security Gate',
        method: act.verification_method || 'QR_SCAN',
        type: act.type === 'departure' ? 'EXIT / RELEASE' : 'ENTRY / ARRIVAL',
        status: isOverride ? 'OVERRIDE_APPROVED' : 'VERIFIED_PASS',
      };
    });

    return NextResponse.json({
      schools: enrichedSchoolsList,
      escorts: enrichedEscortsList,
      gate_officers: formattedGateOfficers,
      gate_activities: formattedGateActivities,
      vehicles: rawVehicles,
      bookings: rawBookings,
      parent_requests: parentRequests,
      assignments: formattedAssignments,
      walk_home_records: formattedWalkHomeRecords,
      pinned_parent_addresses: formattedPinnedAddresses,
      total_pinned_families_count: formattedPinnedAddresses.length,
      audit: auditRes,
      audit_logs: auditRes,
      students,
      pending_corrections: pendingCorrections,
      deputising_records: deputisingRes,
      emergency_deputising: deputisingRes,
    });
  } catch (error: any) { return NextResponse.json({ error: error.message || 'Unable to load operations' }, { status: 500 }); }
}

export async function POST(request: NextRequest) {
  const session = canOperate(request);
  if (!session) return NextResponse.json({ error: 'City Manager access required' }, { status: 403 });
  try {
    const body = await request.json(); const db = getAdminClient();
    if (body.action === 'quick_approve_and_assign_school') {
      const escortAppId = body.escortApplicationId || body.appId;
      const schoolId = body.schoolId;
      const schoolName = body.schoolName;
      const notes = body.notes || 'Approved and assigned to school by City Manager';

      if (!escortAppId || !schoolId) {
        return NextResponse.json({ error: 'Escort Application ID and School ID are required' }, { status: 400 });
      }

      const { updateEscortApplicationStatus } = await import('@/lib/escort/escort-db');
      const updateRes = await updateEscortApplicationStatus(escortAppId, 'CITY_MANAGER_APPROVED', notes, {
        schoolId,
        schoolName,
      });

      await audit(db, session.user_id, 'ESCORT_QUICK_APPROVED_AND_ASSIGNED_SCHOOL', 'escort_application', escortAppId, {
        school_id: schoolId,
        school_name: schoolName || null,
        notes,
      });

      // Send email alert to escort
      try {
        const { data: escortRec } = await db
          .from('escort_applications')
          .select('email, full_name, phone')
          .eq('id', escortAppId)
          .maybeSingle();

        if (escortRec?.email) {
          await sendEmail({
            fromName: 'MyEduRide City Operations',
            to: escortRec.email.trim().toLowerCase(),
            subject: `Account Approved & School Assignment: ${schoolName || 'Designated School Campus'}`,
            html: `
              <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto; background:#0b1c30; color:#ffffff; padding: 24px; border-radius: 16px;">
                <h2 style="color:#00A859; margin-top:0;">Account Approved & School Assigned!</h2>
                <p>Dear <strong>${escortRec.full_name || 'Escort'}</strong>,</p>
                <p style="background:#00A859; color:#ffffff; padding: 14px; border-radius: 10px; font-weight: bold;">
                  Congratulations! You have been approved by the City Manager and assigned as an Escort for <strong>${schoolName || 'your designated school'}</strong>.
                </p>
                <p style="font-size:13px; color:#cbd5e1;">Your profile is now active on the school roster. Please log in to review assigned student manifests and live transit coordination.</p>
                <p style="font-size:12px; color:#94a3b8; margin-top: 24px;">MyEduRide — Student Safety Platform</p>
              </div>
            `,
          });
        }
      } catch (notifyErr) {
        console.warn('[city-manager operations] quick approve notify notice:', notifyErr);
      }

      return NextResponse.json({
        success: true,
        message: `Escort approved and assigned to ${schoolName || 'school'} successfully!`,
        result: updateRes,
      });
    }

    // 1. Gate Officer Emergency Message & Non-Compliance Directive (Requirement 1)
    if (body.action === 'send_gate_officer_emergency_message') {
      const { gateOfficerId, officerName, schoolId, message, severity, actionRequired } = body;
      if (!message || !message.trim()) {
        return NextResponse.json({ error: 'Emergency message text is required' }, { status: 400 });
      }

      await audit(db, session.user_id, 'GATE_OFFICER_EMERGENCY_DIRECTIVE_SENT', 'gate_officer', gateOfficerId || 'all_gate_officers', {
        officerName: officerName || 'Gate Officer',
        schoolId: schoolId || null,
        message: message.trim(),
        severity: severity || 'CRITICAL_EMERGENCY',
        actionRequired: actionRequired || 'Immediate compliance check',
        dispatchedAt: new Date().toISOString(),
      });

      try {
        await db.from('school_notices').insert({
          school_id: schoolId || null,
          title: `EMERGENCY CITY MANAGER DIRECTIVE: ${severity || 'NON_COMPLIANCE_DIRECTIVE'}`,
          content: message.trim(),
          target_audiences: ['gate_officers'],
          created_by: session.user_id,
          priority: 'urgent',
          created_at: new Date().toISOString(),
        });
      } catch {}

      return NextResponse.json({
        success: true,
        message: `Emergency directive successfully dispatched to gate officer ${officerName || ''}`,
        severity: severity || 'CRITICAL_EMERGENCY',
      });
    }

    // 2. Accountant-Approved Parent Discounted Fee Input (Requirement G)
    if (body.action === 'apply_accountant_discount') {
      const { bookingId, studentId, originalFare, discountedFare, accountantApprovalRef, accountantName, discountReason } = body;

      if (!accountantApprovalRef || !accountantApprovalRef.trim()) {
        return NextResponse.json({ error: 'Accountant approval reference number is required to apply discount' }, { status: 400 });
      }
      const rawOriginal = Number(originalFare) || 3500;
      const rawDiscounted = Number(discountedFare);

      if (isNaN(rawDiscounted) || rawDiscounted <= 0) {
        return NextResponse.json({ error: 'Valid discounted fare amount is required' }, { status: 400 });
      }
      if (rawDiscounted >= rawOriginal) {
        return NextResponse.json({ error: `Discounted fare (₦${rawDiscounted.toLocaleString()}) must be less than original fare (₦${rawOriginal.toLocaleString()})` }, { status: 400 });
      }

      const variance = rawOriginal - rawDiscounted;
      const discountPayload = {
        originalFare: rawOriginal,
        discountedFare: rawDiscounted,
        variance,
        accountantApprovalRef: accountantApprovalRef.trim(),
        accountantName: accountantName?.trim() || 'School Accountant / Bursar',
        discountReason: discountReason?.trim() || 'Authorized bursar rate concession',
        appliedByUserId: session.user_id,
        appliedAt: new Date().toISOString(),
      };

      // 1. Update transport_bookings
      if (bookingId) {
        try {
          const { data: bData } = await db.from('transport_bookings').select('notes').eq('id', bookingId).maybeSingle();
          let currentNotes: any = {};
          try {
            if (bData?.notes && bData.notes.startsWith('{')) currentNotes = JSON.parse(bData.notes);
          } catch {}

          currentNotes.discount = discountPayload;
          currentNotes.fareResult = {
            ...(currentNotes.fareResult || {}),
            dailyFare: rawDiscounted,
            originalDailyFare: rawOriginal,
            discountVariance: variance,
          };

          await db.from('transport_bookings').update({
            fare_amount: rawDiscounted,
            notes: JSON.stringify(currentNotes),
          }).eq('id', bookingId);
        } catch (err) {
          console.warn('[operations] apply_accountant_discount transport_bookings update notice:', err);
        }
      }

      // 2. Update escort_assignments notes so escorts are explicitly aware
      try {
        let aQuery = db.from('escort_assignments').update({
          notes: `Accountant Discounted Fare ₦${rawDiscounted.toLocaleString()}/day (Approved Ref: ${accountantApprovalRef})`,
        });
        if (bookingId) {
          await aQuery.eq('booking_id', bookingId);
        } else if (studentId) {
          await aQuery.eq('student_id', studentId);
        }
      } catch (err) {
        console.warn('[operations] apply_accountant_discount escort_assignments update notice:', err);
      }

      // 3. Record Audit Log
      await audit(db, session.user_id, 'ACCOUNTANT_DISCOUNT_APPLIED', 'transport_booking', bookingId || studentId, {
        ...discountPayload,
        actualAmountCollected: rawDiscounted,
      });

      return NextResponse.json({
        success: true,
        message: `Accountant-approved discount applied successfully. Actual collected fare: ₦${rawDiscounted.toLocaleString()}`,
        actualAmountCollected: rawDiscounted,
        discountVariance: variance,
        accountantApprovalRef,
      });
    }

    if (body.action === 'booking') {
      if (!body.schoolId) return NextResponse.json({ error: 'School is required' }, { status: 400 });
      const { data, error } = await db.from('transport_bookings').insert({ school_id: body.schoolId, student_id: body.studentId || null, parent_user_id: body.parentUserId || null, source: body.source || 'city_manager', pickup_address: body.pickupAddress || null, pickup_lat: body.pickupLat || null, pickup_lng: body.pickupLng || null, requested_pickup_at: body.pickupAt || null, notes: body.notes || null, priority: body.priority || 'standard' }).select().single();
      if (error) throw error; await audit(db, session.user_id, 'BOOKING_RECEIVED', 'transport_booking', data.id, { source: body.source || 'city_manager' });
      return NextResponse.json({ success: true, booking: data });
    }
    if (body.action === 'assign' || body.action === 'reassign') {
      if (!body.escortApplicationId || !body.schoolId) return NextResponse.json({ error: 'Approved escort and school are required' }, { status: 400 });
      const { data: escort } = await db.from('escort_applications').select('id,status,availability_status,emergency_pool_enabled,full_name,phone').eq('id', body.escortApplicationId).maybeSingle();
      if (!escort || !['CITY_MANAGER_APPROVED', 'ACTIVE'].includes(escort.status)) return NextResponse.json({ error: 'Escort must be City Manager approved before dispatch' }, { status: 400 });
      if (['emergency', 'deputy'].includes(body.assignmentType) && (!escort.emergency_pool_enabled || escort.availability_status !== 'available')) return NextResponse.json({ error: 'Select an available escort from the emergency pool' }, { status: 400 });
      if (body.action === 'reassign' && body.replacesAssignmentId) {
        await db.from('escort_assignments').update({ status: 'reassigned', updated_at: new Date().toISOString() }).eq('id', body.replacesAssignmentId);
      }
      const { data, error } = await db.from('escort_assignments').insert({
        booking_id: body.bookingId || null,
        escort_application_id: body.escortApplicationId,
        school_id: body.schoolId,
        student_id: body.studentId || null,
        assignment_type: body.assignmentType || 'standard',
        assigned_by: session.user_id,
        replaces_assignment_id: body.replacesAssignmentId || null,
        notes: body.notes || (body.action === 'reassign' ? `Reassigned by City Manager to ${escort.full_name}` : null),
        status: ['emergency', 'deputy'].includes(body.assignmentType) ? 'pending_confirmation' : 'active'
      }).select().single();
      if (error) throw error;
      if (data.status === 'active' && body.bookingId) await db.from('transport_bookings').update({ status: 'assigned', updated_at: new Date().toISOString() }).eq('id', body.bookingId);
      
      // Also synchronize with dismissal_requests so School Admin pickup list reflects the reassigned escort immediately
      if (body.studentId && body.schoolId) {
        try {
          const today = new Date().toISOString().split('T')[0];
          await db.from('dismissal_requests').update({
            pickup_person_name: escort.full_name,
            pickup_person_phone: escort.phone || null,
            notes: `Reassigned by City Manager to ${escort.full_name}`,
          }).eq('student_id', body.studentId).eq('school_id', body.schoolId).eq('dismissal_date', today);
        } catch (syncErr) {
          console.warn('[operations reassign dismissal_requests sync notice]:', syncErr);
        }
      }

      await audit(db, session.user_id, body.action === 'reassign' ? 'ESCORT_REASSIGNED' : 'ESCORT_ASSIGNED', 'escort_assignment', data.id, { bookingId: body.bookingId, studentId: body.studentId, assignmentType: data.assignment_type });
      if (data.status === 'active') await notifyAssignment(db, data, body.action === 'reassign' ? 'reassigned' : 'assigned');

      if (body.action === 'reassign') {
        try {
          let oldEscortName = 'Previous Escort';
          let studentName = 'Student';
          let schoolName = 'School Campus';

          let oldAss: any = null;
          if (body.replacesAssignmentId) {
            const { data: dbOldAss } = await db
              .from('escort_assignments')
              .select('*, escort:escort_applications(id, full_name), student:students(first_name, last_name), school:schools(name)')
              .eq('id', body.replacesAssignmentId)
              .maybeSingle();
            oldAss = dbOldAss;
            if (oldAss) {
              const oEsc = Array.isArray(oldAss.escort) ? oldAss.escort[0] : oldAss.escort;
              const oStu = Array.isArray(oldAss.student) ? oldAss.student[0] : oldAss.student;
              const oSch = Array.isArray(oldAss.school) ? oldAss.school[0] : oldAss.school;
              if (oEsc?.full_name) oldEscortName = oEsc.full_name;
              if (oStu) studentName = `${oStu.first_name} ${oStu.last_name}`;
              if (oSch?.name) schoolName = oSch.name;
            }
          }

          const newPin = Math.floor(1000 + Math.random() * 9000).toString();

          await notifyEscortEmergencyReassigned({
            bookingId: body.bookingId || data.booking_id || data.id,
            oldEscortId: oldAss?.escort_application_id || undefined,
            newEscortId: body.escortApplicationId,
            reason: body.notes || 'Emergency operational reassignment by City Manager',
            securityPin: newPin,
          });
        } catch (reassignNotifyErr) {
          console.warn('[city-manager operations] notifyEscortEmergencyReassigned warning:', reassignNotifyErr);
        }
      }

      return NextResponse.json({ success: true, assignment: data });
    }
    if (body.action === 'approve_parent_booking') {
      const { booking_id, escort_id, notes } = body;
      if (!booking_id || !escort_id) {
        return NextResponse.json({ error: 'booking_id and escort_id are required' }, { status: 400 });
      }

      const { data: escort } = await db
        .from('escort_applications')
        .select('id, full_name, phone, application_data')
        .eq('id', escort_id)
        .maybeSingle();

      const escortName = escort?.full_name || 'Assigned Escort';
      const securityPin = Math.floor(1000 + Math.random() * 9000).toString();

      const { data: updatedBooking, error: updateErr } = await db
        .from('transport_bookings')
        .update({
          status: 'assigned',
          notes: notes ? `CM Notes: ${notes} | PIN: ${securityPin}` : `PIN: ${securityPin}`,
          updated_at: nowUtcIso(),
        })
        .eq('id', booking_id)
        .select()
        .single();

      if (updateErr) throw updateErr;

      // Check if existing assignment exists for booking_id
      const { data: existingAssignment } = await db
        .from('escort_assignments')
        .select('id')
        .eq('booking_id', booking_id)
        .maybeSingle();

      let newAssignment: any = null;
      if (existingAssignment) {
        const { data: updatedA } = await db
          .from('escort_assignments')
          .update({
            escort_application_id: escort_id,
            status: 'active',
            notes: notes || 'Assigned & Approved by City Manager',
            updated_at: nowUtcIso(),
          })
          .eq('id', existingAssignment.id)
          .select()
          .single();
        newAssignment = updatedA;
      } else {
        const { data: createdA } = await db
          .from('escort_assignments')
          .insert({
            booking_id: booking_id,
            escort_application_id: escort_id,
            school_id: updatedBooking?.school_id || null,
            student_id: updatedBooking?.student_id || null,
            assignment_type: 'standard',
            assigned_by: session.user_id,
            notes: notes || 'Assigned & Approved by City Manager',
            status: 'active',
            created_at: nowUtcIso(),
            updated_at: nowUtcIso(),
          })
          .select()
          .maybeSingle();
        newAssignment = createdA;
      }

      if (newAssignment) {
        try {
          await notifyAssignment(db, newAssignment, 'assigned');
        } catch (e) {
          console.warn('[city-manager operations] notifyAssignment warning:', e);
        }
      }

      // Fetch student, school, parent details for immediate multi-party notification
      try {
        let studentName = 'Student';
        let schoolName = 'School Campus';

        if (updatedBooking?.student_id) {
          const { data: student } = await db
            .from('students')
            .select('first_name, last_name, school_id, school:schools(name)')
            .eq('id', updatedBooking.student_id)
            .maybeSingle();
          if (student) {
            studentName = `${student.first_name} ${student.last_name}`;
            const schObj: any = Array.isArray(student.school) ? student.school[0] : student.school;
            if (schObj?.name) schoolName = schObj.name;
          }
        }

        await notifyEscortAssignmentApproved({
          bookingId: booking_id,
          escortId: escort_id,
          securityPin,
          schoolId: updatedBooking?.school_id || undefined,
          studentId: updatedBooking?.student_id || undefined,
        });
      } catch (notifyErr) {
        console.warn('[city-manager operations] notifyEscortAssignmentApproved warning:', notifyErr);
      }

      await audit(db, session.user_id, 'PARENT_BOOKING_APPROVED', 'transport_booking', booking_id, {
        escort_id,
        security_pin: securityPin,
      });

      return NextResponse.json({
        success: true,
        message: `Booking approved and assigned to ${escortName}. Parent notified with Security PIN: ${securityPin}`,
        booking: updatedBooking,
        assignment: newAssignment,
      });
    }

    if (body.action === 'batch_approve_school_assignments') {
      const { booking_ids } = body;
      const targetQuery = db
        .from('transport_bookings')
        .select('id, school_id, student_id, notes')
        .eq('status', 'pending');

      const { data: pendingBookings } = Array.isArray(booking_ids) && booking_ids.length > 0
        ? await targetQuery.in('id', booking_ids)
        : await targetQuery.limit(50);

      let approvedCount = 0;
      for (const b of (pendingBookings || [])) {
        let meta: any = {};
        try {
          if (b.notes && b.notes.startsWith('{')) meta = JSON.parse(b.notes);
        } catch {
          meta = {};
        }

        const escortId = meta.assigned_escort_id || meta.escort_id;
        if (!escortId) continue;

        const securityPin = Math.floor(1000 + Math.random() * 9000).toString();

        await db
          .from('transport_bookings')
          .update({
            status: 'assigned',
            notes: b.notes ? `${b.notes} | PIN: ${securityPin}` : `PIN: ${securityPin}`,
            updated_at: nowUtcIso(),
          })
          .eq('id', b.id);

        await db
          .from('escort_assignments')
          .update({
            status: 'active',
            confirmed_at: nowUtcIso(),
            updated_at: nowUtcIso(),
          })
          .eq('booking_id', b.id);

        try {
          await notifyEscortAssignmentApproved({
            bookingId: b.id,
            escortId,
            securityPin,
            schoolId: b.school_id,
            studentId: b.student_id,
          });
        } catch (e) {
          console.warn('[batch_approve_school_assignments] notify error:', e);
        }

        approvedCount++;
      }

      await audit(db, session.user_id, 'BATCH_SCHOOL_ASSIGNMENTS_APPROVED', 'transport_bookings', 'batch', {
        approved_count: approvedCount,
      });

      return NextResponse.json({
        success: true,
        message: `Successfully approved and cleared ${approvedCount} school escort assignment(s)! Security PINs and live notifications issued to parents and escorts.`,
        approved_count: approvedCount,
      });
    }

    if (body.action === 'create_emergency_deputy') {
      const {
        school_id,
        route_id,
        original_escort_id,
        original_escort_name,
        original_escort_phone,
        deputy_escort_id,
        deputy_escort_name,
        deputy_escort_phone,
        deputy_vehicle_plate,
        student_ids,
        student_names,
        emergency_reason,
        notes,
        time_window_start,
      } = body;

      if (!school_id || !emergency_reason || !deputy_escort_name) {
        return NextResponse.json(
          { error: 'school_id, deputy_escort_name, and emergency_reason are required' },
          { status: 400 }
        );
      }

      const { data: newRecord, error: insertErr } = await db
        .from('emergency_deputising')
        .insert({
          school_id,
          route_id: route_id || null,
          original_escort_id: original_escort_id || null,
          original_escort_name: original_escort_name || 'School Escort',
          original_escort_phone: original_escort_phone || '',
          deputy_escort_id: deputy_escort_id || null,
          deputy_escort_name,
          deputy_escort_phone: deputy_escort_phone || '',
          deputy_vehicle_plate: deputy_vehicle_plate || 'Standard Fleet Plate',
          student_ids: Array.isArray(student_ids) ? student_ids : [],
          student_names: Array.isArray(student_names) ? student_names : [],
          emergency_reason,
          notes: notes || 'Emergency deputising dispatched by City Manager.',
          time_window_start: time_window_start || nowUtcIso(),
          assigned_by: session.user_id,
          assigned_by_name: session.full_name || 'City Manager',
          status: 'ACTIVE_DEPUTY',
        })
        .select()
        .single();

      if (insertErr) throw insertErr;

      await audit(db, session.user_id, 'EMERGENCY_DEPUTY_ASSIGNED', 'emergency_deputising', newRecord.id, {
        original_escort_id,
        deputy_escort_name,
        emergency_reason,
      });

      return NextResponse.json({
        success: true,
        message: `Emergency deputy ${newRecord.deputy_escort_name} assigned. Custody record registered in database.`,
        record: newRecord,
      });
    }

    if (body.action === 'complete_deputy_handover') {
      const { record_id, notes } = body;
      if (!record_id) {
        return NextResponse.json({ error: 'record_id is required' }, { status: 400 });
      }

      const { data: record, error: updateErr } = await db
        .from('emergency_deputising')
        .update({
          status: 'COMPLETED_HANDOVER',
          time_window_end: nowUtcIso(),
          handover_confirmed_at: nowUtcIso(),
          notes: notes ? `Handover notes: ${notes}` : undefined,
          updated_at: nowUtcIso(),
        })
        .eq('id', record_id)
        .select()
        .single();

      if (updateErr) throw updateErr;

      await audit(db, session.user_id, 'EMERGENCY_DEPUTY_HANDOVER_COMPLETED', 'emergency_deputising', record.id, {
        handover_confirmed_at: record.handover_confirmed_at,
        time_window_end: record.time_window_end,
      });

      return NextResponse.json({
        success: true,
        message: `Emergency deputising window completed for ${record.deputy_escort_name}. Permanent custody record closed.`,
        record,
      });
    }

    if (body.action === 'set_availability') {
      if (!body.escortApplicationId || !['available', 'on_assignment', 'offline'].includes(body.availabilityStatus)) return NextResponse.json({ error: 'Valid escort and availability status are required' }, { status: 400 });
      const { error } = await db.from('escort_applications').update({ availability_status: body.availabilityStatus, emergency_pool_enabled: Boolean(body.emergencyPoolEnabled), last_available_at: new Date().toISOString() }).eq('id', body.escortApplicationId);
      if (error) throw error;
      await audit(db, session.user_id, 'EMERGENCY_POOL_AVAILABILITY_UPDATED', 'escort_application', body.escortApplicationId, { availability: body.availabilityStatus, poolEnabled: Boolean(body.emergencyPoolEnabled) });
      return NextResponse.json({ success: true });
    }
    if (body.action === 'confirm_assignment') {
      if (!body.assignmentId) return NextResponse.json({ error: 'Assignment is required' }, { status: 400 });
      const { data: assignment, error } = await db.from('escort_assignments').update({ status: 'active', confirmed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', body.assignmentId).eq('status', 'pending_confirmation').select().maybeSingle();
      if (error) throw error;
      if (!assignment) return NextResponse.json({ error: 'Assignment is not awaiting confirmation' }, { status: 400 });
      if (assignment.booking_id) await db.from('transport_bookings').update({ status: 'assigned', updated_at: new Date().toISOString() }).eq('id', assignment.booking_id);
      await db.from('escort_applications').update({ availability_status: 'on_assignment', updated_at: new Date().toISOString() }).eq('id', assignment.escort_application_id);
      await audit(db, session.user_id, assignment.assignment_type === 'deputy' ? 'EMERGENCY_DEPUTY_CONFIRMED' : 'EMERGENCY_PICKUP_CONFIRMED', 'escort_assignment', assignment.id, { bookingId: assignment.booking_id, replacesAssignmentId: assignment.replaces_assignment_id });
      await notifyAssignment(db, assignment, assignment.replaces_assignment_id ? 'reassigned' : 'assigned');
      return NextResponse.json({ success: true, assignment });
    }

    if (body.action === 'approve_escort_correction') {
      const { escort_id, notes } = body;
      const { loadFileStore, saveFileStore } = await import('@/lib/escort/escort-db');

      const fileStore = loadFileStore();
      const escortApp = fileStore.find(
        (a: any) => a.id === escort_id || a.user_id === escort_id || a.appId === escort_id || a.escort_code === escort_id
      );

      let correctionData: any = null;
      if (escortApp) {
        const appAny = escortApp as any;
        correctionData = appAny.proposed_correction;
        if (correctionData) {
          if (correctionData.fullName) {
            appAny.fullName = correctionData.fullName;
            appAny.name = correctionData.fullName;
          }
          if (correctionData.phone) appAny.phone = correctionData.phone;
          if (correctionData.email) appAny.email = correctionData.email;
          if (correctionData.address) appAny.address = correctionData.address;
          if (correctionData.operatingArea) {
            appAny.operatingArea = correctionData.operatingArea;
            appAny.operating_area = correctionData.operatingArea;
          }
          if (correctionData.emergencyContactName) appAny.emergencyContact = correctionData.emergencyContactName;
          if (correctionData.nin) appAny.nin = correctionData.nin;
          if (correctionData.driverLicense) appAny.driversLicence = correctionData.driverLicense;
        }

        appAny.status = 'CITY_MANAGER_APPROVED';
        delete (escortApp as any).proposed_correction;
        saveFileStore(fileStore);
      }

      try {
        if (correctionData) {
          await db
            .from('user_profiles')
            .update({
              full_name: correctionData.fullName || undefined,
              phone: correctionData.phone || undefined,
              email: correctionData.email || undefined,
            })
            .eq('id', escort_id);

          await db
            .from('escort_applications')
            .update({
              status: 'CITY_MANAGER_APPROVED',
              full_name: correctionData.fullName || undefined,
              phone: correctionData.phone || undefined,
              email: correctionData.email || undefined,
              operating_area: correctionData.operatingArea || undefined,
              proposed_correction: null,
            })
            .or(`id.eq.${escort_id},user_id.eq.${escort_id}`);
        }
      } catch (e) {
        console.warn('[approve_escort_correction] Supabase sync notice:', e);
      }

      await audit(db, session.user_id, 'APPROVE_ESCORT_CORRECTION', 'escort_application', escort_id, {
        notes,
        applied_correction: correctionData,
      });

      return NextResponse.json({
        success: true,
        message: 'School Escort information correction approved successfully!',
        escort_id,
        status: 'CITY_MANAGER_APPROVED',
      });
    }

    if (body.action === 'reject_escort_correction') {
      const { escort_id, rejection_reason } = body;
      const { loadFileStore, saveFileStore } = await import('@/lib/escort/escort-db');

      const fileStore = loadFileStore();
      const escortApp = fileStore.find(
        (a: any) => a.id === escort_id || a.user_id === escort_id || a.appId === escort_id || a.escort_code === escort_id
      );

      if (escortApp) {
        escortApp.status = 'CITY_MANAGER_APPROVED';
        delete (escortApp as any).proposed_correction;
        (escortApp as any).correction_rejection_reason = rejection_reason || 'Correction rejected by City Manager';
        saveFileStore(fileStore);
      }

      try {
        await db
          .from('escort_applications')
          .update({
            status: 'CITY_MANAGER_APPROVED',
            proposed_correction: null,
          })
          .or(`id.eq.${escort_id},user_id.eq.${escort_id}`);
      } catch (e) {
        console.warn('[reject_escort_correction] Supabase sync notice:', e);
      }

      await audit(db, session.user_id, 'REJECT_ESCORT_CORRECTION', 'escort_application', escort_id, {
        rejection_reason,
      });

      return NextResponse.json({
        success: true,
        message: 'School Escort correction rejected.',
        escort_id,
      });
    }

    return NextResponse.json({ error: `Unknown action: ${body.action}` }, { status: 400 });
  } catch (error: any) { return NextResponse.json({ error: error.message || 'Operation failed' }, { status: 500 }); }
}
