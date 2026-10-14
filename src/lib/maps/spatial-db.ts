import { SupabaseClient } from '@supabase/supabase-js';
import { calculateHaversineDistance } from '@/lib/platform/geofence';

export interface PostGISGeofenceResult {
  is_inside: boolean;
  actual_distance_meters: number;
  school_lat: number | null;
  school_lng: number | null;
  method: 'postgis_gist' | 'haversine_fallback';
}

export interface NearbyStudentResult {
  student_id: string;
  first_name: string;
  last_name: string;
  house_address: string | null;
  house_lat: number;
  house_lng: number;
  distance_meters: number;
}

/**
 * High-performance school boundary geofence check using native PostGIS GiST spatial indexing.
 * Automatically falls back to Haversine mathematics if PostGIS extension is temporarily unavailable.
 */
export async function verifySchoolGeofenceWithPostGIS(
  supabase: SupabaseClient,
  schoolId: string,
  userLat: number,
  userLng: number,
  allowedRadiusMeters: number = 150.0
): Promise<PostGISGeofenceResult> {
  try {
    const { data, error } = await supabase.rpc('verify_school_geofence', {
      p_school_id: schoolId,
      p_user_lng: userLng,
      p_user_lat: userLat,
      p_allowed_radius_meters: allowedRadiusMeters,
    });

    if (!error && Array.isArray(data) && data.length > 0) {
      const row = data[0];
      return {
        is_inside: Boolean(row.is_inside),
        actual_distance_meters: Number(row.actual_distance_meters),
        school_lat: row.school_lat != null ? Number(row.school_lat) : null,
        school_lng: row.school_lng != null ? Number(row.school_lng) : null,
        method: 'postgis_gist',
      };
    }
  } catch (rpcErr) {
    console.warn('[spatial-db] PostGIS verify_school_geofence RPC notice:', rpcErr);
  }

  // Graceful fallback to Haversine calculation
  const { data: school } = await supabase
    .from('schools')
    .select('gps_lat, gps_lng')
    .eq('id', schoolId)
    .maybeSingle();

  if (!school?.gps_lat || !school?.gps_lng) {
    return {
      is_inside: false,
      actual_distance_meters: -1,
      school_lat: null,
      school_lng: null,
      method: 'haversine_fallback',
    };
  }

  const sLat = Number(school.gps_lat);
  const sLng = Number(school.gps_lng);
  const dist = Math.round(calculateHaversineDistance(userLat, userLng, sLat, sLng));

  return {
    is_inside: dist <= allowedRadiusMeters,
    actual_distance_meters: dist,
    school_lat: sLat,
    school_lng: sLng,
    method: 'haversine_fallback',
  };
}

/**
 * Sub-millisecond proximity detection to retrieve all students within radius meters (e.g. 1200m)
 * of an escort or shuttle vehicle using PostGIS R-Tree GiST spatial indexing.
 */
export async function getStudentsWithinProximityWithPostGIS(
  supabase: SupabaseClient,
  schoolId: string,
  vehicleLat: number,
  vehicleLng: number,
  radiusMeters: number = 1200.0
): Promise<NearbyStudentResult[]> {
  try {
    const { data, error } = await supabase.rpc('get_students_within_proximity', {
      p_school_id: schoolId,
      p_vehicle_lng: vehicleLng,
      p_vehicle_lat: vehicleLat,
      p_radius_meters: radiusMeters,
    });

    if (!error && Array.isArray(data)) {
      return data.map((row: any) => ({
        student_id: row.student_id,
        first_name: row.first_name,
        last_name: row.last_name,
        house_address: row.house_address || '',
        house_lat: Number(row.house_lat),
        house_lng: Number(row.house_lng),
        distance_meters: Number(row.distance_meters),
      }));
    }
  } catch (rpcErr) {
    console.warn('[spatial-db] PostGIS get_students_within_proximity RPC notice:', rpcErr);
  }

  // Graceful fallback query
  const { data: students } = await supabase
    .from('students')
    .select('id, first_name, last_name, house_address, house_lat, house_lng')
    .eq('school_id', schoolId)
    .not('house_lat', 'is', null)
    .not('house_lng', 'is', null);

  if (!students || students.length === 0) return [];

  const results: NearbyStudentResult[] = [];
  for (const stu of students) {
    const lat = Number(stu.house_lat);
    const lng = Number(stu.house_lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

    const dist = calculateHaversineDistance(vehicleLat, vehicleLng, lat, lng);
    if (dist <= radiusMeters) {
      results.push({
        student_id: stu.id,
        first_name: stu.first_name,
        last_name: stu.last_name,
        house_address: stu.house_address || '',
        house_lat: lat,
        house_lng: lng,
        distance_meters: Math.round(dist),
      });
    }
  }

  return results.sort((a, b) => a.distance_meters - b.distance_meters);
}
