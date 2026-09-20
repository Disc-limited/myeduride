import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { getSessionFromRequest, sessionHasRole } from '@/lib/session';
import { sendEmail } from '@/lib/notifications/email-service';
import { nowUtcIso, todayInLagos } from '@/lib/utils/time';
import {
  notifyEscortAssignmentApproved,
  notifyEscortEmergencyReassigned,
} from '@/lib/notifications/escort-workflow-notify';
import { getPlatformSchoolId } from '@/lib/auth/super-admin';
import { resolveEscortCategory } from '@/lib/escort/escort-category';
import { escortAllowsOverlappingPickup } from '@/lib/escort/escort-scheduler';
import { extractHandoverPin, ensureDailyHandoverPin } from '@/lib/escort/handover-pin';
import { calculateEscortFare } from '@/lib/escort/escort-pricing';
import { getActiveCityPricing, normalizeCityKey, toEscortFareOverrides } from '@/lib/escort/city-pricing';

export const dynamic = 'force-dynamic';

const LIVE_ASSIGNMENT_STATUSES = ['active', 'pending_confirmation', 'pending'];
const DEAD_BOOKING_STATUSES = ['cancelled', 'canceled', 'rejected', 'reassigned'];
const OPS_CACHE_TTL_MS = 12_000;
const opsGetCache = new Map<string, { at: number; payload: any }>();

function readOpsCache(key: string) {
  const hit = opsGetCache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > OPS_CACHE_TTL_MS) {
    opsGetCache.delete(key);
    return null;
  }
  return hit.payload;
}

function writeOpsCache(key: string, payload: any) {
  opsGetCache.set(key, { at: Date.now(), payload });
}

function invalidateOpsCache() {
  opsGetCache.clear();
}

const ESCORT_TABLE_COLUMNS =
  'id,full_name,email,phone,operating_area,status,availability_status,emergency_pool_enabled,last_available_at,user_id,residential_address,closest_landmark,lga,house_lat,house_lng,location_pinned_at,today_trip_status,today_trip_declined_reason,ready_for_pickup,school_id,primary_school_id,secondary_school_id,reg_number,escort_type,application_data';

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
    const view = (request.nextUrl.searchParams.get('view') || 'tables').toLowerCase();
    const rosterSchoolId = request.nextUrl.searchParams.get('school_id')?.trim() || '';
    const cityKey = normalizeCityKey(request.nextUrl.searchParams.get('city'));
    const cityPricing = await getActiveCityPricing(cityKey);
    const fareRates = toEscortFareOverrides(cityPricing);
    const cacheKey = `${view}:${query || ''}:${rosterSchoolId}:${cityKey}`;
    const cached = readOpsCache(cacheKey);
    if (cached) {
      return NextResponse.json(cached, { headers: { 'Cache-Control': 'private, max-age=8', 'X-CM-Cache': 'HIT' } });
    }

    if (view === 'schools') {
      const { data: schoolRows } = await db.from('schools').select('id, name, address').order('name');
      const platformSchoolId = getPlatformSchoolId();
      const schools = (schoolRows || []).filter((s: any) => {
        if (!s?.id || s.id === platformSchoolId) return false;
        const name = String(s.name || '').trim().toLowerCase();
        return name && name !== 'myeduride platform';
      });
      const payload = { schools };
      writeOpsCache(cacheKey, payload);
      return NextResponse.json(payload, { headers: { 'Cache-Control': 'private, max-age=8' } });
    }

    if (view === 'roster') {
      if (!rosterSchoolId) {
        return NextResponse.json({ students: [] });
      }
      const { data: rosterRows } = await db
        .from('students')
        .select('id, first_name, last_name, student_id_number, photo_url, school_id, is_active, house_address, house_lat, house_lng, house_landmark, custom_fields, class:school_classes(name)')
        .eq('school_id', rosterSchoolId)
        .order('first_name')
        .limit(400);
      const students = (rosterRows || []).map((st: any) => {
        const rawLat = st.house_lat != null && !isNaN(Number(st.house_lat)) ? Number(st.house_lat) : (st.custom_fields?.house_lat != null && !isNaN(Number(st.custom_fields.house_lat)) ? Number(st.custom_fields.house_lat) : null);
        const rawLng = st.house_lng != null && !isNaN(Number(st.house_lng)) ? Number(st.house_lng) : (st.custom_fields?.house_lng != null && !isNaN(Number(st.custom_fields.house_lng)) ? Number(st.custom_fields.house_lng) : null);
        const isHousePinned = rawLat != null && rawLng != null;
        return {
          id: st.id,
          name: `${st.first_name || ''} ${st.last_name || ''}`.trim() || 'Student',
          first_name: st.first_name,
          last_name: st.last_name,
          student_id_number: st.student_id_number || 'N/A',
          photo_url: st.photo_url || null,
          class_name: Array.isArray(st.class) ? st.class[0]?.name : (st.class?.name || 'Class N/A'),
          parent_phone: st.custom_fields?.parent_phone || st.parent_phone || '—',
          house_address: st.house_address || st.custom_fields?.address || 'Designated Home Residence',
          house_lat: rawLat,
          house_lng: rawLng,
          house_landmark: st.house_landmark || st.custom_fields?.landmark || null,
          is_house_pinned: isHousePinned,
          status: st.is_active ? 'ACTIVE' : 'ENROLLED',
        };
      });
      const payload = { students };
      writeOpsCache(cacheKey, payload);
      return NextResponse.json(payload, { headers: { 'Cache-Control': 'private, max-age=8' } });
    }

    const includeCensus = view === 'full';
    const includePins = view === 'full' || view === 'pins' || view === 'tables';
    const includeWalkHome = view === 'full';

    const empty: any[] = [];
    const [schoolsRes, escortsRes, bookingsRes, assignmentsRes, auditRes, deputisingRes, vehiclesRes, routesRes, walkHomeRes, pinnedParentsRes, gateOfficersRes, gateActivitiesRes, allSchoolStudentsRes] = await Promise.all([
      db.from('schools').select('id, name, address, gps_lat, gps_lng, location_address, location_landmark, location_pinned_at').order('name').then((r: any) => r.data || [], () => []),
      db.from('escort_applications').select(ESCORT_TABLE_COLUMNS).in('status', ['CITY_MANAGER_APPROVED', 'ACTIVE']).then((r: any) => r.data || [], () => []),
      db.from('transport_bookings').select('id, status, notes, source, student_id, school_id, parent_user_id, pickup_address, pickup_lat, pickup_lng, requested_pickup_at, created_at, school:schools(name), student:students(id,first_name,last_name,student_id_number,photo_url,class_id,house_address,house_lat,house_lng,house_landmark,house_notes,house_pinned_at,custom_fields), parent:user_profiles!parent_user_id(full_name, phone)').not('status', 'in', '(cancelled,canceled,rejected,reassigned)').order('created_at', { ascending: false }).limit(100).then((r: any) => r.data || [], () => []),
      db.from('escort_assignments').select('*, escort:escort_applications(id,full_name,phone,operating_area,status), school:schools(id,name,address,gps_lat,gps_lng), student:students(id,first_name,last_name,student_id_number,photo_url,class:school_classes(name),house_address,house_lat,house_lng,house_landmark,house_notes,house_pinned_at,custom_fields)').in('status', LIVE_ASSIGNMENT_STATUSES).order('created_at', { ascending: false }).limit(200).then((r: any) => r.data || [], () => []),
      db.from('city_manager_audit_log').select('*').order('created_at', { ascending: false }).limit(100).then((r: any) => r.data || [], () => []),
      db.from('emergency_deputising').select('*').order('created_at', { ascending: false }).limit(100).then((r: any) => r.data || [], () => []),
      db.from('school_vehicles').select('*').order('created_at', { ascending: false }).limit(100).then((r: any) => r.data || [], () => []),
      db.from('transport_routes').select('id, name, code, assigned_vehicle_id, assigned_escort_id').order('created_at', { ascending: false }).limit(100).then((r: any) => r.data || [], () => []),
      includeWalkHome
        ? db.from('attendance_records').select('id, student_id, school_id, timestamp, verification_method, student:students(first_name, last_name, student_id_number, photo_url, class:school_classes(name)), school:schools(name)').eq('type', 'departure').ilike('verification_method', '%walk_home%').order('timestamp', { ascending: false }).limit(50).then((r: any) => r.data || [], () => [])
        : Promise.resolve(empty),
      includePins
        ? db.from('students').select('id, first_name, last_name, student_id_number, photo_url, school_id, school:schools(id, name, address, gps_lat, gps_lng, location_address), class:school_classes(name), house_address, house_lat, house_lng, house_landmark, house_notes, house_pinned_at, house_pinned_by, custom_fields').not('house_lat', 'is', null).order('house_pinned_at', { ascending: false }).limit(200).then((r: any) => r.data || [], () => [])
        : Promise.resolve(empty),
      db.from('user_school_roles').select('id, user_id, school_id, role, is_active, created_at, user:user_profiles(id, full_name, email, phone, avatar_url), school:schools(id, name, address)').eq('role', 'gate_officer').then((r: any) => r.data || [], () => []),
      db.from('attendance_records').select('id, student_id, school_id, timestamp, type, verification_method, verified_by_user_id, student:students(first_name, last_name, student_id_number, photo_url, class:school_classes(name)), school:schools(name)').order('timestamp', { ascending: false }).limit(60).then((r: any) => r.data || [], () => []),
      includeCensus
        ? db.from('students').select('id, first_name, last_name, student_id_number, photo_url, school_id, is_active, custom_fields, house_address, house_lat, house_lng, house_landmark, class:school_classes(name)').order('first_name').limit(500).then((r: any) => r.data || [], () => [])
        : db.from('students').select('school_id').not('school_id', 'is', null).limit(4000).then((r: any) => r.data || [], () => []),
    ]);

    let students: any[] = [];
    if (query) {
      const pattern = `%${query}%`;
      const { data } = await db.from('students').select('id,first_name,last_name,student_id_number,school_id,school:schools(name),class:school_classes(name,grade)').or(`first_name.ilike.${pattern},last_name.ilike.${pattern},student_id_number.ilike.${pattern}`).limit(50);
      students = data || [];
    }

    // Format parent requests from database bookings
    const rawBookings = bookingsRes;
    const matchedAssignmentIds = new Set<string>();

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

      if (DEAD_BOOKING_STATUSES.includes(String(b.status || '').toLowerCase())) {
        return null;
      }

      const matchedAssignment = (assignmentsRes || []).find((a: any) =>
        LIVE_ASSIGNMENT_STATUSES.includes(String(a.status || '').toLowerCase()) &&
        ((a.booking_id && a.booking_id === b.id) ||
          (b.student_id && a.student_id === b.student_id))
      );
      if (matchedAssignment?.id) {
        matchedAssignmentIds.add(matchedAssignment.id);
      }

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
      if (!securityPin) {
        securityPin = extractHandoverPin(b.notes);
      }

      const distanceKm = meta.distance_km || 4.2;
      const tripType = meta.trip_type === 'afternoon' || meta.trip_type === 'afternoon_only'
        ? 'afternoon_only'
        : meta.trip_type === 'morning' || meta.trip_type === 'morning_only'
          ? 'morning_only'
          : 'both';
      const fareResult = calculateEscortFare(distanceKm, tripType, fareRates);
      const storedDiscount = meta?.discount || null;
      const storedDaily = Number(
        storedDiscount?.discountedFare ||
        meta?.fareResult?.dailyFare ||
        meta?.daily_fare ||
        b.fare_amount ||
        0
      );
      const standardDaily = Number(meta?.fareResult?.originalDailyFare || fareResult.dailyFare);
      const dailyFare = storedDaily > 0 ? storedDaily : fareResult.dailyFare;
      const morningFare =
        storedDaily > 0
          ? Number(
              meta?.fareResult?.morningFare ||
                meta?.morning_fare ||
                (tripType === 'afternoon_only' ? 0 : tripType === 'morning_only' ? dailyFare : Math.round(dailyFare / 2))
            )
          : fareResult.morningFare;
      const afternoonFare =
        storedDaily > 0
          ? Number(
              meta?.fareResult?.afternoonFare ||
                meta?.afternoon_fare ||
                (tripType === 'morning_only' ? 0 : dailyFare - morningFare)
            )
          : fareResult.afternoonFare;

      let discountDetails: any = storedDiscount;
      let actualCollected = dailyFare;

      const isConfirmed = b.status === 'assigned' || matchedAssignment?.status === 'active';

      const preferredEscortId = meta.assigned_escort_id || meta.escort_id || matchedAssignment?.escort_application_id || null;
      const preferredEscortName = meta.assigned_escort_name || meta.escort_name || escort?.full_name || null;
      const isPinned = Boolean(stu?.house_lat && stu?.house_lng);

      const parentProfile = Array.isArray(b.parent) ? b.parent[0] : b.parent;
      const parentName = parentProfile?.full_name || stu?.custom_fields?.parent_name || meta.parent_name || (stu ? `${(stu.first_name || '').trim()}'s Guardian`.trim() : 'Parent Guardian');
      const parentPhone = parentProfile?.phone || stu?.custom_fields?.parent_phone || meta.parent_phone || b.parent_phone || '—';

      return {
        booking_id: b.id,
        assignment_id: matchedAssignment?.id || null,
        child_id: b.student_id,
        child_name: stu ? `${(stu.first_name || '').trim()} ${(stu.last_name || '').trim()}`.trim() : 'Student',
        parent_user_id: b.parent_user_id,
        parent_name: parentName,
        parent_phone: parentPhone,
        school_id: b.school_id,
        school_name: sch?.name || 'School Campus',
        source: b.source || 'school',
        distance_km: distanceKm,
        morning_fare: morningFare,
        afternoon_fare: afternoonFare,
        daily_fare: dailyFare,
        standard_daily_fare: standardDaily,
        distance_charge: fareResult.distanceCharge,
        service_charge: fareResult.serviceCharge,
        service_charge_percent: fareResult.serviceChargePercent,
        billable_km: fareResult.billableKm,
        actual_amount_collected: actualCollected,
        discount_details: discountDetails,
        is_discounted: Boolean(discountDetails) || (standardDaily > 0 && dailyFare < standardDaily),
        accountant_approval_ref: discountDetails?.accountantApprovalRef || null,
        accountant_name: discountDetails?.accountantName || null,
        trip_type: tripType,
        escort_type: meta.escort_type || (matchedAssignment?.assignment_type === 'school_escort' ? 'school_escort' : 'myeduride_escort'),
        preferred_escort_id: preferredEscortId,
        escort_id: escort?.id || preferredEscortId || null,
        escort_name: escort?.full_name || preferredEscortName || (isConfirmed ? 'Assigned Escort' : 'Awaiting City Manager Assignment'),
        escort_phone: escort?.phone || meta.assigned_escort_phone || null,
        vehicle_plate: escort?.vehicle_plate || escort?.application_data?.assignedVehicle || null,
        operating_area: escort?.operating_area || 'Lagos Metropolis',
        pickup_date: b.requested_pickup_at ? b.requested_pickup_at.split('T')[0] : 'Today',
        pickup_time: meta.pickup_time || (b.requested_pickup_at ? b.requested_pickup_at.split('T')[1]?.slice(0, 5) : '07:00'),
        dropoff_time: meta.dropoff_time || '15:30',
        pickup_location: b.pickup_address || stu?.house_address || (stu?.custom_fields?.address ? String(stu.custom_fields.address) : 'Designated Doorstep'),
        house_address: stu?.house_address || b.pickup_address || (stu?.custom_fields?.address ? String(stu.custom_fields.address) : ''),
        house_lat: stu?.house_lat ? Number(stu.house_lat) : (b.pickup_lat ? Number(b.pickup_lat) : (stu?.custom_fields?.house_lat ? Number(stu.custom_fields.house_lat) : null)),
        house_lng: stu?.house_lng ? Number(stu.house_lng) : (b.pickup_lng ? Number(b.pickup_lng) : (stu?.custom_fields?.house_lng ? Number(stu.custom_fields.house_lng) : null)),
        house_landmark: stu?.house_landmark || stu?.custom_fields?.landmark || null,
        is_house_pinned: isPinned || Boolean(stu?.house_lat && stu?.house_lng),
        reason: meta.notes || b.notes || matchedAssignment?.notes || 'School Escort Assignment',
        security_pin: securityPin,
        stage: isConfirmed ? 5 : 2,
        stage_label: isConfirmed ? 'Escort Assigned & Dispatched' : 'Under City Manager Review',
        status: isConfirmed ? 'CONFIRMED' : 'PENDING_CM_REVIEW',
        created_at: b.created_at,
      };
    }).filter(Boolean);

    // Also include any standalone or unlinked escort assignments so nothing assigned by School Admin is dropped
    const unlinkedAssignments = (assignmentsRes || []).filter((a: any) =>
      !matchedAssignmentIds.has(a.id) &&
      LIVE_ASSIGNMENT_STATUSES.includes(String(a.status || '').toLowerCase())
    );
    for (const a of unlinkedAssignments) {
      const stu = Array.isArray(a.student) ? a.student[0] : a.student;
      const sch = Array.isArray(a.school) ? a.school[0] : a.school;
      const rawEscort = a.escort;
      const escort = Array.isArray(rawEscort) ? rawEscort[0] : rawEscort;

      const isConfirmed = a.status === 'active' || a.status === 'completed';
      const isPinned = Boolean(stu?.house_lat && stu?.house_lng);

      const fallbackFare = calculateEscortFare(4.2, 'both', fareRates);
      let assignMeta: any = {};
      try {
        if (typeof a.notes === 'string' && a.notes.trim().startsWith('{')) assignMeta = JSON.parse(a.notes);
      } catch {
        assignMeta = {};
      }
      const assignTripType = assignMeta?.trip_type === 'afternoon' || assignMeta?.trip_type === 'afternoon_only'
        ? 'afternoon_only'
        : assignMeta?.trip_type === 'morning' || assignMeta?.trip_type === 'morning_only'
          ? 'morning_only'
          : 'both';
      const storedAssignDaily = Number(assignMeta?.discount?.discountedFare || assignMeta?.fareResult?.dailyFare || assignMeta?.daily_fare || 0);
      const assignDaily = storedAssignDaily > 0 ? storedAssignDaily : fallbackFare.dailyFare;
      const assignMorning = assignTripType === 'afternoon_only'
        ? 0
        : (storedAssignDaily > 0 ? Number(assignMeta?.fareResult?.morningFare || assignMeta?.morning_fare || Math.round(assignDaily / 2)) : fallbackFare.morningFare);
      const assignAfternoon = assignTripType === 'morning_only'
        ? 0
        : (storedAssignDaily > 0 ? Number(assignMeta?.fareResult?.afternoonFare || assignMeta?.afternoon_fare || (assignDaily - assignMorning)) : fallbackFare.afternoonFare);
      parentRequests.push({
        booking_id: a.booking_id || null,
        assignment_id: a.id,
        child_id: a.student_id,
        child_name: stu ? `${(stu.first_name || '').trim()} ${(stu.last_name || '').trim()}`.trim() : 'Student',
        parent_user_id: null,
        parent_name: stu?.custom_fields?.parent_name || (stu ? `${(stu.first_name || '').trim()}'s Guardian`.trim() : 'Parent Guardian'),
        parent_phone: stu?.custom_fields?.parent_phone || '—',
        school_id: a.school_id,
        school_name: sch?.name || 'School Campus',
        source: 'school',
        distance_km: Number(assignMeta?.distance_km || assignMeta?.distance || 4.2),
        morning_fare: assignMorning,
        afternoon_fare: assignAfternoon,
        daily_fare: assignDaily,
        standard_daily_fare: fallbackFare.dailyFare,
        actual_amount_collected: assignDaily,
        discount_details: assignMeta?.discount || null,
        is_discounted: Boolean(assignMeta?.discount) || assignDaily < fallbackFare.dailyFare,
        accountant_approval_ref: assignMeta?.discount?.accountantApprovalRef || null,
        accountant_name: assignMeta?.discount?.accountantName || null,
        trip_type: assignTripType,
        escort_type: 'myeduride_escort',
        preferred_escort_id: a.escort_application_id,
        escort_id: escort?.id || a.escort_application_id || null,
        escort_name: escort?.full_name || (isConfirmed ? 'Assigned Escort' : 'Awaiting City Manager Assignment'),
        escort_phone: escort?.phone || null,
        vehicle_plate: escort?.vehicle_plate || null,
        operating_area: escort?.operating_area || 'Lagos Metropolis',
        pickup_date: 'Today',
        pickup_time: '07:00',
        dropoff_time: '15:30',
        pickup_location: stu?.house_address || (stu?.custom_fields?.address ? String(stu.custom_fields.address) : 'Designated Doorstep'),
        house_address: stu?.house_address || (stu?.custom_fields?.address ? String(stu.custom_fields.address) : ''),
        house_lat: stu?.house_lat ? Number(stu.house_lat) : (stu?.custom_fields?.house_lat ? Number(stu.custom_fields.house_lat) : null),
        house_lng: stu?.house_lng ? Number(stu.house_lng) : (stu?.custom_fields?.house_lng ? Number(stu.custom_fields.house_lng) : null),
        house_landmark: stu?.house_landmark || stu?.custom_fields?.landmark || null,
        is_house_pinned: isPinned || Boolean((stu?.house_lat || stu?.custom_fields?.house_lat) && (stu?.house_lng || stu?.custom_fields?.house_lng)),
        reason: a.notes || 'School Escort Assignment',
        security_pin: null,
        stage: isConfirmed ? 5 : 2,
        stage_label: isConfirmed ? 'Escort Assigned & Dispatched' : 'Under City Manager Review',
        status: isConfirmed ? 'CONFIRMED' : 'PENDING_CM_REVIEW',
        created_at: a.created_at,
      });
    }

    const schoolsList = schoolsRes;
    const routesList = routesRes;

    const escortsList = [...escortsRes];
    if (escortsList.length === 0) {
      const { loadFileStore } = await import('@/lib/escort/escort-db');
      const fileStore = loadFileStore();
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
            escort_type: anyFe.escortType || anyFe.escortCategory || null,
            school_id: anyFe.schoolId || anyFe.createdBySchoolId || null,
          });
        }
      }
    }
    const pendingCorrections: any[] = [];

    const dbVehiclesList = vehiclesRes;
    const combinedVehicles = [...dbVehiclesList];
    if (combinedVehicles.length === 0) {
      const { loadVehicleFileStore } = await import('@/lib/vehicle/vehicle-db');
      const fileVehicles = loadVehicleFileStore();
      const seenVehicleIds = new Set(combinedVehicles.map((v: any) => v.id));
      const seenPlates = new Set(combinedVehicles.map((v: any) => (v.reg_number || '').toUpperCase()));
      for (const fv of fileVehicles) {
        if (!seenVehicleIds.has(fv.id) && (!fv.reg_number || !seenPlates.has(fv.reg_number.toUpperCase()))) {
          seenVehicleIds.add(fv.id);
          if (fv.reg_number) seenPlates.add(fv.reg_number.toUpperCase());
          combinedVehicles.push(fv);
        }
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

    const formattedAssignments = (assignmentsRes || [])
      .filter((a: any) => LIVE_ASSIGNMENT_STATUSES.includes(String(a.status || '').toLowerCase()))
      .map((a: any) => {
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

    const uniqueAssignments: any[] = [];
    const seenAssignmentKeys = new Set<string>();
    for (const assignment of formattedAssignments) {
      const studentKey = assignment.student_id || assignment.student?.id || assignment.id;
      const escortKey = assignment.escort_application_id || assignment.escort?.id || 'none';
      const key = `${studentKey}:${escortKey}`;
      if (seenAssignmentKeys.has(key)) continue;
      seenAssignmentKeys.add(key);
      uniqueAssignments.push(assignment);
    }
    formattedAssignments.length = 0;
    formattedAssignments.push(...uniqueAssignments);

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
      const houseLat = st.house_lat != null && !isNaN(Number(st.house_lat)) ? Number(st.house_lat) : (st.custom_fields?.house_lat != null && !isNaN(Number(st.custom_fields.house_lat)) ? Number(st.custom_fields.house_lat) : null);
      const houseLng = st.house_lng != null && !isNaN(Number(st.house_lng)) ? Number(st.house_lng) : (st.custom_fields?.house_lng != null && !isNaN(Number(st.custom_fields.house_lng)) ? Number(st.custom_fields.house_lng) : null);
      const resolvedHouseAddr = st.house_address || st.custom_fields?.address || 'Designated Home Residence';

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
        house_address: resolvedHouseAddr,
        house_landmark: st.house_landmark || st.custom_fields?.landmark || null,
        house_notes: st.house_notes || st.custom_fields?.notes || null,
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
          parent_phone: a.student?.custom_fields?.parent_phone || a.student?.parent_phone || '—',
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

      // Parse application_data for multi-school allocations
      let appDataObj: any = {};
      if (e.application_data) {
        if (typeof e.application_data === 'string') {
          try {
            appDataObj = JSON.parse(e.application_data);
          } catch {}
        } else if (typeof e.application_data === 'object') {
          appDataObj = e.application_data;
        }
      }

      const allocatedSchoolIdsSet = new Set<string>();
      if (e.school_id) allocatedSchoolIdsSet.add(e.school_id);
      if (e.primary_school_id) allocatedSchoolIdsSet.add(e.primary_school_id);
      if (e.secondary_school_id) allocatedSchoolIdsSet.add(e.secondary_school_id);
      if (Array.isArray(e.allocated_school_ids)) {
        e.allocated_school_ids.forEach((sid: string) => {
          if (sid) allocatedSchoolIdsSet.add(sid);
        });
      }
      if (Array.isArray(appDataObj?.allocated_school_ids)) {
        appDataObj.allocated_school_ids.forEach((sid: string) => {
          if (sid) allocatedSchoolIdsSet.add(sid);
        });
      }
      if (Array.isArray(appDataObj?.allocatedSchoolIds)) {
        appDataObj.allocatedSchoolIds.forEach((sid: string) => {
          if (sid) allocatedSchoolIdsSet.add(sid);
        });
      }
      for (const a of activeAssignments) {
        if (a.school_id) allocatedSchoolIdsSet.add(a.school_id);
      }

      const allocatedSchoolIds = Array.from(allocatedSchoolIdsSet);
      const assignedSchools = allocatedSchoolIds.map((sid) => {
        const sch = (schoolsRes || []).find((s: any) => s.id === sid) || schoolsList.find((s: any) => s.id === sid);
        const studentCount = activeAssignments.filter((a: any) => a.school_id === sid).length;
        return {
          id: sid,
          name: sch?.name || 'School Campus',
          student_count: studentCount,
        };
      });

      const schoolDisplayName =
        assignedSchools.length > 1
          ? `${assignedSchools[0]?.name} (+${assignedSchools.length - 1} campuses)`
          : (assignedSchool?.name || e.school_name || (e.operating_area?.toLowerCase().includes('school') ? e.operating_area : null));

      return {
        ...e,
        createdBySchoolId: e.createdBySchoolId || e.school_id || e.primary_school_id || null,
        escort_type: e.escort_type || e.escortType || null,
        escort_category: resolveEscortCategory({
          ...e,
          createdBySchoolId: e.createdBySchoolId || e.school_id || e.primary_school_id || null,
        }),
        allocated_school_ids: allocatedSchoolIds,
        assigned_schools: assignedSchools,
        assigned_schools_count: assignedSchools.length,
        school_id: e.school_id || allocatedSchoolIds[0] || assignedSchool?.id || null,
        school_name: schoolDisplayName,
        assigned_school_id: e.school_id || allocatedSchoolIds[0] || assignedSchool?.id || null,
        assigned_school_name: assignedSchools[0]?.name || assignedSchool?.name || null,
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
    const schoolStudentCounts: Record<string, number> = {};
    for (const st of (allSchoolStudentsRes || [])) {
      if (!st.school_id) continue;
      schoolStudentCounts[st.school_id] = (schoolStudentCounts[st.school_id] || 0) + 1;
      if (!includeCensus || !st.id) continue;
      if (!schoolStudentsMap[st.school_id]) schoolStudentsMap[st.school_id] = [];
      schoolStudentsMap[st.school_id].push({
        id: st.id,
        name: `${st.first_name || ''} ${st.last_name || ''}`.trim() || 'Student',
        first_name: st.first_name,
        last_name: st.last_name,
        student_id_number: st.student_id_number || 'N/A',
        photo_url: st.photo_url || null,
        class_name: Array.isArray(st.class) ? st.class[0]?.name : (st.class?.name || 'Class N/A'),
        parent_phone: st.custom_fields?.parent_phone || st.parent_phone || '—',
        house_address: st.house_address || 'Designated Home Residence',
        house_lat: st.house_lat,
        house_lng: st.house_lng,
        house_landmark: st.house_landmark,
        is_house_pinned: Boolean(st.house_lat && st.house_lng),
        status: st.is_active ? 'ACTIVE' : 'ENROLLED',
      });
    }

    const platformSchoolId = getPlatformSchoolId();
    const enrichedSchoolsList = (schoolsRes || [])
      .filter((s: any) => {
        if (!s?.id || s.id === platformSchoolId) return false;
        const name = String(s.name || '').trim().toLowerCase();
        return name && name !== 'myeduride platform';
      })
      .map((s: any) => {
        const schStudents = schoolStudentsMap[s.id] || [];
        const schOfficers = (gateOfficersRes || []).filter((g: any) => g.school_id === s.id);
        return {
          ...s,
          students: includeCensus ? schStudents : [],
          studentsCount: includeCensus ? schStudents.length : (schoolStudentCounts[s.id] || 0),
          gateOfficersCount: schOfficers.length,
          escortsCount: enrichedEscortsList.filter((e: any) => e.school_id === s.id).length,
          complianceScore: 100,
          status: 'ONLINE',
        };
      });

    // Collapse accidental duplicate campus rows (same name, different ids)
    const uniqueSchoolsByName = new Map<string, any>();
    for (const s of enrichedSchoolsList) {
      const key = String(s.name || '').trim().toLowerCase();
      const existing = uniqueSchoolsByName.get(key);
      if (!existing || (s.studentsCount || 0) > (existing.studentsCount || 0)) {
        uniqueSchoolsByName.set(key, s);
      }
    }
    const uniqueSchoolsList = Array.from(uniqueSchoolsByName.values());

    // 7. Gate Officer Monitoring Deployment Roster & Live Stream (Requirement 1)
    const formattedGateOfficers = (gateOfficersRes || []).map((g: any, idx: number) => {
      const u = Array.isArray(g.user) ? g.user[0] : g.user;
      const sch = Array.isArray(g.school) ? g.school[0] : g.school;
      const officerScans = (gateActivitiesRes || []).filter((act: any) => act.verified_by_user_id === g.user_id || act.gate_officer_user_id === g.user_id || act.school_id === g.school_id);
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

    const uniqueParentRequests: any[] = [];
    const seenRequestKeys = new Set<string>();
    for (const req of parentRequests) {
      const keys = [
        req.assignment_id ? `assign:${req.assignment_id}` : '',
        req.booking_id ? `book:${req.booking_id}` : '',
        req.child_id ? `student:${req.child_id}:${req.school_id || ''}` : '',
      ].filter(Boolean);
      if (keys.some((k) => seenRequestKeys.has(k))) continue;
      keys.forEach((k) => seenRequestKeys.add(k));
      uniqueParentRequests.push(req);
    }

    const requestByAssignment = new Map<string, any>();
    const requestByBooking = new Map<string, any>();
    const requestByStudent = new Map<string, any>();
    for (const req of uniqueParentRequests) {
      if (req.assignment_id) requestByAssignment.set(req.assignment_id, req);
      if (req.booking_id) requestByBooking.set(req.booking_id, req);
      if (req.child_id) requestByStudent.set(req.child_id, req);
    }
    for (const assignment of formattedAssignments) {
      const match =
        requestByAssignment.get(assignment.id) ||
        (assignment.booking_id ? requestByBooking.get(assignment.booking_id) : null) ||
        (assignment.student_id ? requestByStudent.get(assignment.student_id) : null);
      let assignMeta: any = {};
      try {
        if (typeof assignment.notes === 'string' && assignment.notes.trim().startsWith('{')) {
          assignMeta = JSON.parse(assignment.notes);
        }
      } catch {}
      const storedDaily = Number(assignMeta?.discount?.discountedFare || assignMeta?.fareResult?.dailyFare || 0);
      const fallback = calculateEscortFare(4.2, 'both', fareRates);
      const dailyFare = Number(match?.daily_fare || storedDaily || fallback.dailyFare);
      const morningFare = Number(match?.morning_fare || assignMeta?.fareResult?.morningFare || Math.round(dailyFare / 2));
      assignment.daily_fare = dailyFare;
      assignment.standard_daily_fare = Number(match?.standard_daily_fare || assignMeta?.fareResult?.originalDailyFare || fallback.dailyFare);
      assignment.actual_amount_collected = Number(match?.actual_amount_collected || dailyFare);
      assignment.morning_fare = morningFare;
      assignment.afternoon_fare = Number(match?.afternoon_fare || assignMeta?.fareResult?.afternoonFare || dailyFare - morningFare);
      assignment.is_discounted = Boolean(match?.is_discounted || assignMeta?.discount) || (assignment.standard_daily_fare > dailyFare);
      assignment.accountant_approval_ref = match?.accountant_approval_ref || assignMeta?.discount?.accountantApprovalRef || null;
      assignment.accountant_name = match?.accountant_name || assignMeta?.discount?.accountantName || null;
      assignment.trip_type =
        match?.trip_type ||
        (assignMeta?.trip_type === 'morning_only' || assignMeta?.trip_type === 'afternoon_only'
          ? assignMeta.trip_type
          : assignMeta?.fareResult?.tripType || 'both');
    }

    const payload = {
      schools: uniqueSchoolsList,
      escorts: enrichedEscortsList,
      gate_officers: formattedGateOfficers,
      gate_activities: formattedGateActivities,
      vehicles: rawVehicles,
      bookings: [],
      parent_requests: uniqueParentRequests,
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
    };
    writeOpsCache(cacheKey, payload);
    return NextResponse.json(payload, { headers: { 'Cache-Control': 'private, max-age=8', 'X-CM-Cache': 'MISS' } });
  } catch (error: any) { return NextResponse.json({ error: error.message || 'Unable to load operations' }, { status: 500 }); }
}

export async function POST(request: NextRequest) {
  const session = canOperate(request);
  if (!session) return NextResponse.json({ error: 'City Manager access required' }, { status: 403 });
  try {
    invalidateOpsCache();
    const body = await request.json(); const db = getAdminClient();
    if (body.action === 'unassign_escort_school') {
      const escortAppId = String(body.escortApplicationId || body.appId || '').trim();
      const escortEmail = String(body.escortEmail || '').trim().toLowerCase();
      const escortName = String(body.escortName || '').trim();
      const schoolId = String(body.schoolId || '').trim();
      const schoolName = String(body.schoolName || 'MyEduRide Academy').trim();
      const nowIso = nowUtcIso();

      if (!escortAppId && !escortEmail && !escortName) {
        return NextResponse.json({ error: 'Escort application id, email, or name is required' }, { status: 400 });
      }

      let escortQuery = db
        .from('escort_applications')
        .select('id, user_id, full_name, email, school_id, primary_school_id, secondary_school_id, application_data');

      if (escortAppId) {
        escortQuery = escortQuery.or(`id.eq.${escortAppId},user_id.eq.${escortAppId}`);
      } else if (escortEmail) {
        escortQuery = escortQuery.ilike('email', escortEmail);
      } else {
        escortQuery = escortQuery.ilike('full_name', `%${escortName}%`);
      }

      const { data: escortRows, error: escortErr } = await escortQuery.limit(10);
      if (escortErr) throw escortErr;
      const escorts = escortRows || [];
      if (escorts.length === 0) {
        return NextResponse.json({ error: 'Escort not found' }, { status: 404 });
      }

      const escortIds = Array.from(new Set(escorts.flatMap((e: any) => [e.id, e.user_id].filter(Boolean))));

      let schoolIds: string[] = schoolId ? [schoolId] : [];
      if (schoolIds.length === 0 && schoolName) {
        const { data: schoolRows } = await db
          .from('schools')
          .select('id, name')
          .ilike('name', `%${schoolName}%`);
        schoolIds = (schoolRows || []).map((s: any) => s.id).filter(Boolean);
      }
      if (schoolIds.length === 0) {
        return NextResponse.json({ error: `School not found: ${schoolName}` }, { status: 404 });
      }

      const { data: assignments, error: assignLookupErr } = await db
        .from('escort_assignments')
        .select('id, status, school_id, student_id, booking_id, escort_application_id, student:students(id, first_name, last_name, school_id), school:schools(id, name)')
        .in('escort_application_id', escortIds)
        .not('status', 'in', '(cancelled,canceled,reassigned)');
      if (assignLookupErr) throw assignLookupErr;

      const matching = (assignments || []).filter((row: any) => {
        const student = Array.isArray(row.student) ? row.student[0] : row.student;
        const school = Array.isArray(row.school) ? row.school[0] : row.school;
        return (
          schoolIds.includes(row.school_id) ||
          schoolIds.includes(student?.school_id) ||
          String(school?.name || '').toLowerCase().includes(schoolName.toLowerCase())
        );
      });

      const assignmentIds = matching.map((row: any) => row.id);
      const bookingIds = matching.map((row: any) => row.booking_id).filter(Boolean);
      const releasedStudents = matching.map((row: any) => {
        const student = Array.isArray(row.student) ? row.student[0] : row.student;
        return {
          assignment_id: row.id,
          student_id: row.student_id,
          name: `${student?.first_name || ''} ${student?.last_name || ''}`.trim() || 'Student',
        };
      });

      if (assignmentIds.length > 0) {
        const { error: assignUpdateErr } = await db
          .from('escort_assignments')
          .update({
            status: 'cancelled',
            notes: `Unassigned from ${schoolName} so escort can be reassigned to another school.`,
            updated_at: nowIso,
          })
          .in('id', assignmentIds);
        if (assignUpdateErr) throw assignUpdateErr;
      }

      if (bookingIds.length > 0) {
        await db
          .from('transport_bookings')
          .update({ status: 'cancelled', updated_at: nowIso })
          .in('id', bookingIds);
      }

      const releasedStudentIds = releasedStudents.map((st: any) => st.student_id).filter(Boolean);
      const { data: leftoverBookings } = await db
        .from('transport_bookings')
        .select('id, notes, student_id, school_id, status')
        .in('school_id', schoolIds)
        .not('status', 'in', '(cancelled,canceled,rejected,reassigned)')
        .limit(300);
      const extraBookingIds = (leftoverBookings || [])
        .filter((row: any) => {
          if (bookingIds.includes(row.id)) return false;
          const notes = String(row.notes || '');
          const tiedToEscort = escortIds.some((id) => notes.includes(id)) || /ebor kingsley|eborodirikingsley/i.test(notes);
          const tiedToReleasedStudent = releasedStudentIds.includes(row.student_id);
          return tiedToEscort || tiedToReleasedStudent;
        })
        .map((row: any) => row.id);
      if (extraBookingIds.length > 0) {
        await db
          .from('transport_bookings')
          .update({ status: 'cancelled', updated_at: nowIso })
          .in('id', extraBookingIds);
      }

      const escortPatch: Record<string, any> = { updated_at: nowIso };
      for (const escort of escorts) {
        const patch: Record<string, any> = { ...escortPatch };
        if (schoolIds.includes(escort.school_id)) patch.school_id = null;
        if (schoolIds.includes(escort.primary_school_id)) patch.primary_school_id = null;
        if (schoolIds.includes(escort.secondary_school_id)) patch.secondary_school_id = null;

        let appData = escort.application_data;
        if (typeof appData === 'string') {
          try { appData = JSON.parse(appData); } catch { appData = {}; }
        }
        if (appData && typeof appData === 'object') {
          const createdSchoolId = appData.createdBySchoolId || appData.schoolId;
          if (schoolIds.includes(createdSchoolId)) {
            appData = {
              ...appData,
              createdBySchoolId: null,
              createdBySchoolName: null,
              schoolId: null,
              schoolName: null,
            };
            patch.application_data = appData;
          }
        }

        if (Object.keys(patch).length > 1) {
          await db.from('escort_applications').update(patch).eq('id', escort.id);
        }
      }

      await db
        .from('transport_routes')
        .update({ assigned_escort_id: null })
        .in('assigned_escort_id', escortIds)
        .in('school_id', schoolIds);
      await db
        .from('school_vehicles')
        .update({ assigned_escort_id: null })
        .in('assigned_escort_id', escortIds)
        .in('school_id', schoolIds);

      await audit(db, session.user_id, 'ESCORT_SCHOOL_STUDENTS_UNASSIGNED', 'escort_application', escorts[0].id, {
        school_ids: schoolIds,
        school_name: schoolName,
        released_count: releasedStudents.length,
        assignment_ids: assignmentIds,
      });

      return NextResponse.json({
        success: true,
        message: releasedStudents.length
          ? `Unassigned ${releasedStudents.length} ${schoolName} student${releasedStudents.length === 1 ? '' : 's'} from ${escorts[0].full_name}.`
          : `${escorts[0].full_name} had no active ${schoolName} students to unassign.`,
        escort: { id: escorts[0].id, full_name: escorts[0].full_name },
        school_ids: schoolIds,
        released_count: releasedStudents.length,
        released_students: releasedStudents,
      });
    }
    if (body.action === 'quick_approve_and_assign_school' || body.action === 'allocate_schools') {
      const escortAppId = body.escortApplicationId || body.appId;
      const rawSchoolIds = body.schoolIds || (body.schoolId ? [body.schoolId] : []);
      const schoolIds: string[] = Array.isArray(rawSchoolIds) ? rawSchoolIds.filter(Boolean) : [];
      const primarySchoolId = schoolIds[0] || body.schoolId;
      const notes = body.notes || 'Approved and assigned to school campus(es) by City Manager';

      if (!escortAppId || schoolIds.length === 0) {
        return NextResponse.json({ error: 'Escort Application ID and at least one School ID are required' }, { status: 400 });
      }

      // Fetch escort details to check escort category / type
      const { data: escortRec } = await db
        .from('escort_applications')
        .select('id, email, full_name, phone, escort_type, application_data, primary_school_id, secondary_school_id')
        .eq('id', escortAppId)
        .maybeSingle();

      const escortCategory = resolveEscortCategory(escortRec);
      const isMyEduRide = escortCategory === 'myeduride_escort' || escortAllowsOverlappingPickup(escortRec?.escort_type);

      if (!isMyEduRide && schoolIds.length > 2) {
        return NextResponse.json({
          error: 'School Escorts are dedicated to their internal fleet and cannot be allocated to more than 2 campuses. Reassign or convert to MyEduRide Escort.',
        }, { status: 400 });
      }

      // Find school names for display
      const { data: matchedSchools } = await db
        .from('schools')
        .select('id, name')
        .in('id', schoolIds);

      const schoolNamesMap = new Map((matchedSchools || []).map((s: any) => [s.id, s.name]));
      const schoolNames = schoolIds.map((id) => schoolNamesMap.get(id) || 'School Campus');
      const primarySchoolName = schoolNames[0] || body.schoolName || 'Designated School Campus';

      const { updateEscortApplicationStatus } = await import('@/lib/escort/escort-db');
      const updateRes = await updateEscortApplicationStatus(escortAppId, 'CITY_MANAGER_APPROVED', notes, {
        schoolId: primarySchoolId,
        schoolName: primarySchoolName,
        allocatedSchoolIds: schoolIds,
        escortCategory: isMyEduRide ? 'myeduride_escort' : 'school_escort',
      });

      // Direct update on escort_applications to ensure allocated_school_ids, primary_school_id, and secondary_school_id
      let curAppData: any = {};
      if (escortRec?.application_data) {
        try {
          curAppData = typeof escortRec.application_data === 'string'
            ? JSON.parse(escortRec.application_data)
            : escortRec.application_data;
        } catch {}
      }
      curAppData.allocated_school_ids = schoolIds;
      if (isMyEduRide) {
        curAppData.escortCategory = 'myeduride_escort';
      }

      await db
        .from('escort_applications')
        .update({
          school_id: primarySchoolId,
          primary_school_id: primarySchoolId,
          secondary_school_id: schoolIds[1] || null,
          allocated_school_ids: schoolIds,
          escort_type: isMyEduRide ? 'myeduride_escort' : 'school_escort',
          application_data: JSON.stringify(curAppData),
          updated_at: new Date().toISOString(),
        })
        .eq('id', escortAppId);

      await audit(db, session.user_id, 'ESCORT_QUICK_APPROVED_AND_ASSIGNED_SCHOOL', 'escort_application', escortAppId, {
        school_id: primarySchoolId,
        school_name: primarySchoolName,
        allocated_school_ids: schoolIds,
        school_names: schoolNames,
        escort_category: escortCategory,
        notes,
      });

      // Send email alert to escort
      try {
        if (escortRec?.email) {
          await sendEmail({
            fromName: 'MyEduRide City Operations',
            to: escortRec.email.trim().toLowerCase(),
            subject: `Account Approved & School Assignment: ${schoolNames.join(', ')}`,
            html: `
              <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto; background:#0b1c30; color:#ffffff; padding: 24px; border-radius: 16px;">
                <h2 style="color:#00A859; margin-top:0;">Account Approved & School Assigned!</h2>
                <p>Dear <strong>${escortRec.full_name || 'Escort'}</strong>,</p>
                <p style="background:#00A859; color:#ffffff; padding: 14px; border-radius: 10px; font-weight: bold;">
                  Congratulations! You have been approved by the City Manager and allocated to <strong>${schoolNames.join(', ')}</strong>.
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

      invalidateOpsCache();

      return NextResponse.json({
        success: true,
        message: `Escort approved and allocated to ${schoolNames.length} school(s): ${schoolNames.join(', ')}!`,
        allocated_school_ids: schoolIds,
        school_names: schoolNames,
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

    // 2. City Manager fare correction with optional discount
    if (body.action === 'apply_accountant_discount' || body.action === 'correct_fare') {
      const {
        bookingId,
        assignmentId,
        studentId,
        originalFare,
        discountedFare,
        correctedFare,
        accountantApprovalRef,
        accountantName,
        discountReason,
        tripType,
      } = body;

      const rawOriginal = Number(originalFare) || 0;
      const rawCorrected = Number(correctedFare ?? discountedFare);

      if (isNaN(rawCorrected) || rawCorrected <= 0) {
        return NextResponse.json({ error: 'Enter a valid corrected daily fare' }, { status: 400 });
      }

      const variance = rawOriginal > 0 ? rawOriginal - rawCorrected : 0;
      const isDiscount = variance > 0;
      const resolvedTripType = tripType === 'morning_only' || tripType === 'afternoon_only' ? tripType : 'both';
      const morningFare = resolvedTripType === 'afternoon_only' ? 0 : resolvedTripType === 'morning_only' ? rawCorrected : Math.round(rawCorrected / 2);
      const afternoonFare = resolvedTripType === 'morning_only' ? 0 : rawCorrected - morningFare;
      const discountPayload = {
        originalFare: rawOriginal || rawCorrected,
        discountedFare: rawCorrected,
        variance,
        is_correction: true,
        is_discount: isDiscount,
        accountantApprovalRef: String(accountantApprovalRef || '').trim() || null,
        accountantName: String(accountantName || '').trim() || (isDiscount ? 'City Manager Fare Correction' : 'City Manager'),
        discountReason: String(discountReason || '').trim() || (isDiscount ? 'City Manager discount correction' : 'City Manager fare correction'),
        appliedByUserId: session.user_id,
        appliedAt: new Date().toISOString(),
      };

      // Resolve real booking / assignment / student IDs (roster sometimes sends assignment id as booking_id)
      let resolvedBookingIds: string[] = [];
      let resolvedStudentId = studentId || null;
      let resolvedAssignmentIds: string[] = assignmentId ? [assignmentId] : [];

      if (bookingId) {
        const { data: bookHit } = await db.from('transport_bookings').select('id, student_id').eq('id', bookingId).maybeSingle();
        if (bookHit?.id) {
          resolvedBookingIds.push(bookHit.id);
          if (!resolvedStudentId) resolvedStudentId = bookHit.student_id;
        } else {
          // bookingId may actually be an assignment id
          const { data: asHit } = await db.from('escort_assignments').select('id, booking_id, student_id').eq('id', bookingId).maybeSingle();
          if (asHit?.id) {
            resolvedAssignmentIds.push(asHit.id);
            if (asHit.booking_id) resolvedBookingIds.push(asHit.booking_id);
            if (!resolvedStudentId) resolvedStudentId = asHit.student_id;
          }
        }
      }

      if (assignmentId) {
        const { data: asHit } = await db.from('escort_assignments').select('id, booking_id, student_id').eq('id', assignmentId).maybeSingle();
        if (asHit?.id) {
          if (!resolvedAssignmentIds.includes(asHit.id)) resolvedAssignmentIds.push(asHit.id);
          if (asHit.booking_id && !resolvedBookingIds.includes(asHit.booking_id)) resolvedBookingIds.push(asHit.booking_id);
          if (!resolvedStudentId) resolvedStudentId = asHit.student_id;
        }
      }

      if (resolvedStudentId) {
        const { data: studentBooks } = await db
          .from('transport_bookings')
          .select('id, status')
          .eq('student_id', resolvedStudentId)
          .order('created_at', { ascending: false })
          .limit(15);
        const deadStatuses = new Set(['cancelled', 'canceled', 'rejected', 'reassigned']);
        for (const b of studentBooks || []) {
          if (!b?.id || deadStatuses.has(String(b.status || '').toLowerCase())) continue;
          if (!resolvedBookingIds.includes(b.id)) resolvedBookingIds.push(b.id);
        }
        const { data: studentAssigns } = await db
          .from('escort_assignments')
          .select('id, booking_id')
          .eq('student_id', resolvedStudentId)
          .in('status', LIVE_ASSIGNMENT_STATUSES)
          .limit(10);
        for (const a of studentAssigns || []) {
          if (a?.id && !resolvedAssignmentIds.includes(a.id)) resolvedAssignmentIds.push(a.id);
          if (a?.booking_id && !resolvedBookingIds.includes(a.booking_id)) resolvedBookingIds.push(a.booking_id);
        }
      }

      let bookingsUpdated = 0;
      const bookingUpdateErrors: string[] = [];
      for (const bid of resolvedBookingIds) {
        try {
          const { data: bData } = await db.from('transport_bookings').select('id, notes, fare_amount').eq('id', bid).maybeSingle();
          if (!bData?.id) {
            bookingUpdateErrors.push(`${bid}: not found`);
            continue;
          }
          let currentNotes: any = {};
          try {
            if (bData?.notes && typeof bData.notes === 'object') currentNotes = { ...(bData.notes as object) };
            else if (bData?.notes && String(bData.notes).trim().startsWith('{')) currentNotes = JSON.parse(String(bData.notes));
          } catch {}

          currentNotes.trip_type = resolvedTripType;
          currentNotes.discount = isDiscount ? discountPayload : null;
          currentNotes.fare_correction = discountPayload;
          currentNotes.daily_fare = rawCorrected;
          currentNotes.morning_fare = morningFare;
          currentNotes.afternoon_fare = afternoonFare;
          currentNotes.actual_amount_collected = rawCorrected;
          currentNotes.fareResult = {
            ...(currentNotes.fareResult || {}),
            dailyFare: rawCorrected,
            morningFare,
            afternoonFare,
            originalDailyFare: rawOriginal || currentNotes.fareResult?.originalDailyFare || rawCorrected,
            discountVariance: variance,
            tripType: resolvedTripType,
          };

          const notesPayload = JSON.stringify(currentNotes);
          let bookErr: any = null;
          const withFare = await db
            .from('transport_bookings')
            .update({ fare_amount: rawCorrected, notes: notesPayload })
            .eq('id', bid)
            .select('id')
            .maybeSingle();
          bookErr = withFare.error;
          if (bookErr && /fare_amount|column/i.test(String(bookErr.message || ''))) {
            const notesOnly = await db
              .from('transport_bookings')
              .update({ notes: notesPayload })
              .eq('id', bid)
              .select('id')
              .maybeSingle();
            bookErr = notesOnly.error;
            if (!bookErr && notesOnly.data?.id) bookingsUpdated += 1;
          } else if (!bookErr && withFare.data?.id) {
            bookingsUpdated += 1;
          } else if (!bookErr) {
            // some drivers return no row on update; verify by re-read
            const { data: verify } = await db.from('transport_bookings').select('notes').eq('id', bid).maybeSingle();
            const verifyMeta = (() => {
              try {
                if (verify?.notes && typeof verify.notes === 'object') return verify.notes as any;
                if (verify?.notes && String(verify.notes).trim().startsWith('{')) return JSON.parse(String(verify.notes));
              } catch {}
              return {};
            })();
            if (Number(verifyMeta?.fareResult?.dailyFare || verifyMeta?.daily_fare || 0) === rawCorrected) {
              bookingsUpdated += 1;
            } else {
              bookingUpdateErrors.push(`${bid}: update produced no confirmation`);
            }
          }
          if (bookErr) {
            bookingUpdateErrors.push(`${bid}: ${bookErr.message}`);
            console.warn('[operations] correct_fare booking update:', bookErr.message);
          }
        } catch (err: any) {
          bookingUpdateErrors.push(`${bid}: ${err?.message || err}`);
          console.warn('[operations] correct_fare transport_bookings update notice:', err);
        }
      }

      let assignmentsUpdated = 0;
      try {
        let assignRows: any[] = [];
        if (resolvedAssignmentIds.length > 0) {
          const { data } = await db.from('escort_assignments').select('id, notes').in('id', resolvedAssignmentIds);
          assignRows = data || [];
        } else if (resolvedStudentId) {
          const { data } = await db
            .from('escort_assignments')
            .select('id, notes')
            .eq('student_id', resolvedStudentId)
            .in('status', LIVE_ASSIGNMENT_STATUSES)
            .limit(10);
          assignRows = data || [];
        }
        for (const row of assignRows) {
          let assignNotes: any = {};
          let keepText = '';
          try {
            if (row.notes && typeof row.notes === 'object') assignNotes = { ...(row.notes as object) };
            else if (row.notes && String(row.notes).trim().startsWith('{')) assignNotes = JSON.parse(row.notes);
            else if (row.notes) keepText = String(row.notes);
          } catch {
            keepText = String(row.notes || '');
          }
          assignNotes.fareResult = {
            dailyFare: rawCorrected,
            morningFare,
            afternoonFare,
            originalDailyFare: rawOriginal || rawCorrected,
            tripType: resolvedTripType,
          };
          assignNotes.trip_type = resolvedTripType;
          assignNotes.fare_correction = discountPayload;
          assignNotes.daily_fare = rawCorrected;
          assignNotes.morning_fare = morningFare;
          assignNotes.afternoon_fare = afternoonFare;
          if (isDiscount) assignNotes.discount = discountPayload;
          else delete assignNotes.discount;
          if (keepText) assignNotes.prior_notes = keepText;
          const { error: aErr } = await db.from('escort_assignments').update({ notes: JSON.stringify(assignNotes) }).eq('id', row.id);
          if (!aErr) assignmentsUpdated += 1;
        }
      } catch (err) {
        console.warn('[operations] correct_fare escort_assignments update notice:', err);
      }

      if (bookingsUpdated === 0 && resolvedStudentId) {
        // No live transport_bookings row — create one so parents can see the corrected charge
        try {
          const { data: stu } = await db
            .from('students')
            .select('id, school_id, house_address, house_lat, house_lng, custom_fields')
            .eq('id', resolvedStudentId)
            .maybeSingle();
          const schoolIdForBooking = stu?.school_id || null;
          if (schoolIdForBooking) {
            let parentUserId =
              stu?.custom_fields?.parent_user_id ||
              stu?.custom_fields?.parent_id ||
              null;
            if (!parentUserId) {
              const { data: parentLink } = await db
                .from('student_parents')
                .select('parent_user_id')
                .eq('student_id', resolvedStudentId)
                .limit(1)
                .maybeSingle();
              parentUserId = parentLink?.parent_user_id || null;
            }
            const notesPayload = {
              discount: isDiscount ? discountPayload : null,
              fare_correction: discountPayload,
              daily_fare: rawCorrected,
              morning_fare: morningFare,
              afternoon_fare: afternoonFare,
              actual_amount_collected: rawCorrected,
              fareResult: {
                dailyFare: rawCorrected,
                morningFare,
                afternoonFare,
                originalDailyFare: rawOriginal || rawCorrected,
                discountVariance: variance,
              },
              source: 'city_manager_fare_correction',
            };
            const insertRow: Record<string, unknown> = {
              school_id: schoolIdForBooking,
              student_id: resolvedStudentId,
              parent_user_id: parentUserId,
              source: 'school',
              status: 'assigned',
              pickup_address: stu?.house_address || null,
              pickup_lat: stu?.house_lat || null,
              pickup_lng: stu?.house_lng || null,
              fare_amount: rawCorrected,
              notes: JSON.stringify(notesPayload),
            };
            let { data: created, error: createErr } = await db
              .from('transport_bookings')
              .insert(insertRow)
              .select('id')
              .single();
            if (createErr && /fare_amount|column/i.test(String(createErr.message || ''))) {
              delete insertRow.fare_amount;
              const retry = await db.from('transport_bookings').insert(insertRow).select('id').single();
              created = retry.data;
              createErr = retry.error;
            }
            if (!createErr && created?.id) {
              bookingsUpdated += 1;
              resolvedBookingIds.push(created.id);
              // Link assignments to this booking for future corrections
              if (resolvedAssignmentIds.length > 0) {
                await db
                  .from('escort_assignments')
                  .update({ booking_id: created.id })
                  .in('id', resolvedAssignmentIds);
              } else if (resolvedStudentId) {
                await db
                  .from('escort_assignments')
                  .update({ booking_id: created.id })
                  .eq('student_id', resolvedStudentId)
                  .in('status', LIVE_ASSIGNMENT_STATUSES);
              }
            } else if (createErr) {
              bookingUpdateErrors.push(`create: ${createErr.message}`);
              console.warn('[operations] correct_fare booking create notice:', createErr.message);
            }
          }
        } catch (err: any) {
          bookingUpdateErrors.push(`create: ${err?.message || err}`);
          console.warn('[operations] correct_fare booking create notice:', err);
        }
      }

      if (bookingsUpdated === 0 && assignmentsUpdated === 0) {
        return NextResponse.json(
          { error: 'Could not find a booking or assignment to update. Open the student from the bookings queue and try again.' },
          { status: 404 }
        );
      }

      await audit(db, session.user_id, isDiscount ? 'FARE_DISCOUNT_CORRECTION' : 'FARE_CORRECTION', 'transport_booking', resolvedBookingIds[0] || resolvedAssignmentIds[0] || resolvedStudentId, {
        ...discountPayload,
        actualAmountCollected: rawCorrected,
        morningFare,
        afternoonFare,
        bookingsUpdated,
        assignmentsUpdated,
      });

      return NextResponse.json({
        success: true,
        message: isDiscount
          ? `Discount applied. Collected daily fare is now ₦${rawCorrected.toLocaleString()}.`
          : `Fare corrected to ₦${rawCorrected.toLocaleString()} per day.`,
        daily_fare: rawCorrected,
        morning_fare: morningFare,
        afternoon_fare: afternoonFare,
        actualAmountCollected: rawCorrected,
        discountVariance: variance,
        bookings_updated: bookingsUpdated,
        assignments_updated: assignmentsUpdated,
        booking_update_errors: bookingUpdateErrors.slice(0, 3),
        resolved_booking_ids: resolvedBookingIds.slice(0, 5),
        resolved_assignment_ids: resolvedAssignmentIds.slice(0, 5),
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

      // Check transport_bookings
      const { data: currentBooking } = await db
        .from('transport_bookings')
        .select('*')
        .eq('id', booking_id)
        .maybeSingle();

      const pinDay = todayInLagos();
      const ensured = ensureDailyHandoverPin(currentBooking?.notes, pinDay);
      const securityPin = ensured.pin || Math.floor(1000 + Math.random() * 9000).toString();

      let updatedBooking: any = null;
      let newAssignment: any = null;

      if (currentBooking) {
        let mergedNotes = notes ? `${ensured.notes} | CM Notes: ${notes}` : ensured.notes;
        if (currentBooking.notes && currentBooking.notes.startsWith('{')) {
          try {
            const parsed = JSON.parse(ensured.notes);
            parsed.security_pin = securityPin;
            parsed.security_pin_date = pinDay;
            parsed.approval_status = 'CITY_MANAGER_APPROVED';
            parsed.assigned_escort_id = escort_id;
            parsed.assigned_escort_name = escortName;
            if (notes) parsed.cm_notes = notes;
            mergedNotes = JSON.stringify(parsed);
          } catch {
            // Keep mergedNotes fallback
          }
        }

        const { data: uB, error: updateErr } = await db
          .from('transport_bookings')
          .update({
            status: 'assigned',
            notes: mergedNotes,
            updated_at: nowUtcIso(),
          })
          .eq('id', booking_id)
          .select()
          .single();

        if (updateErr) throw updateErr;
        updatedBooking = uB;

        // Check if existing assignment exists for booking_id or student_id
        let assignQuery = db.from('escort_assignments').select('*').eq('booking_id', booking_id);
        const { data: byBooking } = await assignQuery.maybeSingle();

        let existingAssignment = byBooking;
        if (!existingAssignment && currentBooking.student_id) {
          let byStudentQuery = db
            .from('escort_assignments')
            .select('*')
            .eq('student_id', currentBooking.student_id)
            .in('status', ['active', 'pending_confirmation', 'pending']);
          if (currentBooking.school_id) {
            byStudentQuery = byStudentQuery.eq('school_id', currentBooking.school_id);
          }
          const { data: byStudent } = await byStudentQuery
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          existingAssignment = byStudent;
        }

        if (existingAssignment) {
          const { data: updatedA } = await db
            .from('escort_assignments')
            .update({
              booking_id: booking_id,
              escort_application_id: escort_id,
              status: 'active',
              confirmed_at: nowUtcIso(),
              notes: notes || existingAssignment.notes || 'Assigned & Approved by City Manager',
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
              confirmed_at: nowUtcIso(),
              created_at: nowUtcIso(),
              updated_at: nowUtcIso(),
            })
            .select()
            .maybeSingle();
          newAssignment = createdA;
        }
      } else {
        // booking_id might be the assignment id directly
        const { data: existingA } = await db
          .from('escort_assignments')
          .select('*')
          .eq('id', booking_id)
          .maybeSingle();

        if (existingA) {
          const { data: updatedA } = await db
            .from('escort_assignments')
            .update({
              escort_application_id: escort_id,
              status: 'active',
              confirmed_at: nowUtcIso(),
              notes: notes || existingA.notes || 'Assigned & Approved by City Manager',
              updated_at: nowUtcIso(),
            })
            .eq('id', existingA.id)
            .select()
            .single();
          newAssignment = updatedA;
        }
      }

      if (newAssignment) {
        try {
          await notifyAssignment(db, newAssignment, 'assigned');
        } catch (e) {
          console.warn('[city-manager operations] notifyAssignment warning:', e);
        }
      }

      // Multi-party notification
      try {
        const studentId = updatedBooking?.student_id || newAssignment?.student_id;
        const schoolId = updatedBooking?.school_id || newAssignment?.school_id;

        await notifyEscortAssignmentApproved({
          bookingId: booking_id,
          escortId: escort_id,
          securityPin,
          schoolId: schoolId || undefined,
          studentId: studentId || undefined,
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

        let escortId = meta.assigned_escort_id || meta.escort_id;
        if (!escortId) {
          const { data: matchedA } = await db
            .from('escort_assignments')
            .select('escort_application_id')
            .or(`booking_id.eq.${b.id}${b.student_id ? `,student_id.eq.${b.student_id}` : ''}`)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          escortId = matchedA?.escort_application_id;
        }
        if (!escortId) continue;

        const pinDay = todayInLagos();
        const ensured = ensureDailyHandoverPin(b.notes, pinDay);
        const securityPin = ensured.pin || Math.floor(1000 + Math.random() * 9000).toString();

        let updatedNotes = ensured.notes;
        if (ensured.notes.trim().startsWith('{')) {
          try {
            const parsed = JSON.parse(ensured.notes);
            parsed.security_pin = securityPin;
            parsed.security_pin_date = pinDay;
            parsed.approval_status = 'CITY_MANAGER_APPROVED';
            parsed.assigned_escort_id = escortId;
            updatedNotes = JSON.stringify(parsed);
          } catch {
            // Keep fallback
          }
        }

        await db
          .from('transport_bookings')
          .update({
            status: 'assigned',
            notes: updatedNotes,
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
          .or(`booking_id.eq.${b.id}${b.student_id ? `,student_id.eq.${b.student_id}` : ''}`);

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

      // Also activate any standalone pending escort_assignments
      try {
        const { data: pendingAssignments } = await db
          .from('escort_assignments')
          .select('id, booking_id, escort_application_id, school_id, student_id')
          .eq('status', 'pending_confirmation');

        for (const pa of (pendingAssignments || [])) {
          // If already counted via booking, skip
          if (pendingBookings?.some((pb: any) => pb.id === pa.booking_id)) continue;

          await db
            .from('escort_assignments')
            .update({
              status: 'active',
              confirmed_at: nowUtcIso(),
              updated_at: nowUtcIso(),
            })
            .eq('id', pa.id);

          approvedCount++;
        }
      } catch (pErr) {
        console.warn('[batch_approve_school_assignments] pendingAssignments update notice:', pErr);
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
