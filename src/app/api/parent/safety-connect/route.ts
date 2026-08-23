import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth/auth-server';
import { getAdminClient } from '@/lib/supabase/admin';
import { nowUtcIso } from '@/lib/utils/time';
import { parentBookingsStore } from '@/lib/stores/parent-bookings-store';

interface CacheEntry {
  timestamp: number;
  data: any;
}
const safetyCache: Record<string, CacheEntry> = {};
const CACHE_TTL_MS = 30_000;

export async function GET(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const childId = searchParams.get('child_id') || 'STU-001';
    const cacheKey = `safety_${session.user_id}_${childId}`;

    const cached = safetyCache[cacheKey];
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return NextResponse.json(cached.data);
    }

    // 1. Pillar 1: School Escort Data
    const schoolEscort = {
      id: 'ESC-SCH-01',
      full_name: 'Babajide Adeleke',
      phone: '+234 803 291 8841',
      email: 'b.adeleke@gmail.com',
      avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
      driver_license: 'LAG-992381-DL',
      nin_verified: true,
      escort_type: 'School Escort',
      school_name: 'Gracefield International School',
      operational_status: 'Active On Duty - In Transit',
      
      vehicle: {
        id: 'VH-01',
        reg_number: 'LAG-482-XA',
        make_model: 'Toyota HiAce 2022',
        capacity: 18,
        roadworthiness_expiry: '2027-04-15',
        insurance_status: 'Gold Shield Active',
      },

      route: {
        code: 'VI-EXP-01',
        name: 'Victoria Island & Oniru Express Corridor',
        departure_morning: '06:45 AM',
        departure_afternoon: '03:15 PM',
        child_designated_stop: 'Stop 1: 1044 Ademola Adetokunbo St',
        total_stops: 4,
      },

      approval: {
        status: 'CITY_MANAGER_APPROVED',
        badge: 'Verified School Staff Escort',
      },
    };

    // 2. Pillar 2: MyEduRide Available Backup Escorts
    const myedurideEscorts = [
      {
        id: 'ESC-MYE-04',
        full_name: 'Babatunde Lawal',
        phone: '+234 802 334 1188',
        avatar_url: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150',
        rating: 4.95,
        total_trips: 342,
        operating_area: 'Victoria Island / Oniru / Lekki',
        vehicle: 'Toyota Sienna 2022 (SUR-440-XA)',
        status: 'Available for Immediate Booking',
        approval_badge: 'City Manager Vetted & Certified',
      },
      {
        id: 'ESC-MYE-05',
        full_name: 'Chioma Okonkwo',
        phone: '+234 803 771 2299',
        avatar_url: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150',
        rating: 4.98,
        total_trips: 512,
        operating_area: 'Ikeja / Maryland / GRA',
        vehicle: 'Honda Odyssey 2023 (IKJ-110-LA)',
        status: 'Available for Immediate Booking',
        approval_badge: 'City Manager Vetted & Certified',
      },
    ];

    // 3. Pillar 3: E-Drive Live Transit Telemetry
    const edriveTelemetry = {
      is_in_transit: true,
      trip_id: 'TRIP-LAG-8891',
      transit_status: 'EN_ROUTE_TO_SCHOOL',
      current_speed_kmh: 38,
      speed_limit_kmh: 50,
      safety_score: 99,
      eta_minutes: 8,
      estimated_arrival_time: '07:22 AM',
      current_location: {
        address: 'Approaching Oniru Junction, Victoria Island',
        latitude: 6.4281,
        longitude: 3.4412,
      },
      child_boarding_event: {
        student_id: childId,
        boarded_at: '07:04 AM',
        boarded_stop: '1044 Ademola Adetokunbo St',
        scanned_by: 'Babajide Adeleke (Escort)',
        verification_method: 'Digital Student QR Pass',
      },
      corridor_waypoints: [
        { seq: 1, name: 'Ademola Adetokunbo St', status: 'COMPLETED', time: '07:04 AM' },
        { seq: 2, name: 'Oniru Market Roundabout', status: 'IN_PROGRESS', time: '07:14 AM' },
        { seq: 3, name: 'Palace Way Junction', status: 'PENDING', time: '07:18 AM' },
        { seq: 4, name: 'School Main Gate', status: 'PENDING', time: '07:22 AM' },
      ],
    };

    const activeChildBookings = parentBookingsStore.filter(
      (b) => b.child_id === childId || b.child_id === 'STU-001'
    );

    const payload = {
      success: true,
      timestamp: nowUtcIso(),
      child_id: childId,
      safety_connect: {
        school_escort: schoolEscort,
        myeduride_escorts: myedurideEscorts,
        active_bookings: activeChildBookings,
        edrive: edriveTelemetry,
      },
    };

    safetyCache[cacheKey] = {
      timestamp: Date.now(),
      data: payload,
    };

    return NextResponse.json(payload);
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

    // Stage 1: Parent Booking Submission
    if (action === 'request_myeduride_ride' || action === 'book_myeduride_escort') {
      if (!child_id || !pickup_date || !pickup_time) {
        return NextResponse.json(
          { error: 'child_id, pickup_date, and pickup_time are required' },
          { status: 400 }
        );
      }

      const bookingId = `BK-MYE-${Date.now().toString().slice(-4)}`;
      const newBooking = {
        booking_id: bookingId,
        child_id,
        child_name: child_name || 'David James',
        parent_user_id: session.user_id,
        parent_name: session.full_name || 'Parent',
        parent_phone: session.phone || '+234 803 112 4455',
        school_id: 'sch-001',
        school_name: 'Gracefield International School',
        preferred_escort_id: preferred_escort_id || null,
        escort_id: null,
        escort_name: 'Awaiting City Manager Assignment',
        escort_phone: null,
        vehicle_plate: null,
        operating_area: operating_area || 'Victoria Island / Oniru / Lekki',
        pickup_date,
        pickup_time,
        pickup_location: pickup_location || 'Designated School Corridor Stop',
        reason: reason || 'School Escort Unavailable',
        security_pin: null,
        stage: 2, // Stage 2: City Manager Review
        stage_label: 'Under City Manager Review — Matching Available Escort in Area',
        status: 'PENDING_CM_REVIEW',
        created_at: nowUtcIso(),
      };

      parentBookingsStore.unshift(newBooking);

      // Invalidate cache
      delete safetyCache[`safety_${session.user_id}_${child_id}`];

      return NextResponse.json({
        success: true,
        message: 'Ride request submitted to City Manager for area escort assignment and approval.',
        booking: newBooking,
      });
    }

    return NextResponse.json({ error: `Unknown action '${action}'` }, { status: 400 });
  } catch (err: any) {
    console.error('[safety-connect POST] Error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
