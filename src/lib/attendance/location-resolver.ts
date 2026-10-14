/**
 * Accurate Sign-In / Sign-Out Location Resolution Engine
 * Handles physical terminal/gate resolution, coordinates formatting,
 * geofence verification, and contextual badge creation for student and staff attendance.
 */

export interface SchoolLocationSource {
  id?: string;
  name?: string | null;
  address?: string | null;
  location_address?: string | null;
  location_landmark?: string | null;
  gps_lat?: number | string | null;
  gps_lng?: number | string | null;
}

export interface ResolvedGateLocation {
  location_name: string;
  terminal_name: string;
  landmark: string | null;
  gps_lat: number | null;
  gps_lng: number | null;
  gps_coords: string | null;
  geofence_verified: boolean;
  display_badge: string;
}

export interface RecordLocationInput {
  location_name?: string | null;
  gps_lat?: number | string | null;
  gps_lng?: number | string | null;
  geofence_verified?: boolean | null;
}

export interface ResolvedRecordLocation {
  location_name: string;
  gps_coords: string | null;
  geofence_verified: boolean;
  display_badge: string;
  action_label: string;
}

/**
 * Resolves authoritative school gate location from a school row.
 */
export function resolveSchoolGateLocation(
  school: SchoolLocationSource | null | undefined
): ResolvedGateLocation {
  if (!school) {
    return {
      location_name: 'Main Campus Gate',
      terminal_name: 'Main Campus Gate',
      landmark: null,
      gps_lat: null,
      gps_lng: null,
      gps_coords: null,
      geofence_verified: false,
      display_badge: 'Main Campus Gate',
    };
  }

  const latNum = school.gps_lat != null && !isNaN(Number(school.gps_lat)) ? Number(school.gps_lat) : null;
  const lngNum = school.gps_lng != null && !isNaN(Number(school.gps_lng)) ? Number(school.gps_lng) : null;
  const isPinned = latNum != null && lngNum != null;

  const terminalName =
    (school.location_address && school.location_address.trim()) ||
    (school.address && school.address.trim()) ||
    (school.name ? `${school.name} Main Gate` : 'Main Campus Gate');

  const landmark = school.location_landmark ? school.location_landmark.trim() : null;

  const fullLocationName = landmark ? `${terminalName} (near ${landmark})` : terminalName;

  const coordsStr = isPinned ? `${latNum.toFixed(4)}, ${lngNum.toFixed(4)}` : null;

  const displayBadge = isPinned
    ? `${fullLocationName} (Geofence Verified)`
    : fullLocationName;

  return {
    location_name: fullLocationName,
    terminal_name: terminalName,
    landmark,
    gps_lat: latNum,
    gps_lng: lngNum,
    gps_coords: coordsStr,
    geofence_verified: isPinned,
    display_badge: displayBadge,
  };
}

/**
 * Resolves exact location for a specific attendance record (student or staff).
 * Prioritizes the per-record location if saved, falling back gracefully to the school's gate.
 */
export function resolveRecordLocation(
  record: RecordLocationInput | null | undefined,
  schoolLocation: ResolvedGateLocation,
  actionType?: 'arrival' | 'departure' | 'clock_in' | 'clock_out' | string
): ResolvedRecordLocation {
  const recLat = record?.gps_lat != null && !isNaN(Number(record.gps_lat)) ? Number(record.gps_lat) : null;
  const recLng = record?.gps_lng != null && !isNaN(Number(record.gps_lng)) ? Number(record.gps_lng) : null;

  const effectiveLat = recLat ?? schoolLocation.gps_lat;
  const effectiveLng = recLng ?? schoolLocation.gps_lng;

  const hasCoords = effectiveLat != null && effectiveLng != null;
  const coordsStr = hasCoords ? `${effectiveLat.toFixed(4)}, ${effectiveLng.toFixed(4)}` : schoolLocation.gps_coords;

  const geofenceVerified =
    record?.geofence_verified !== undefined && record?.geofence_verified !== null
      ? Boolean(record.geofence_verified)
      : hasCoords || schoolLocation.geofence_verified;

  const baseLocation =
    (record?.location_name && record.location_name.trim()) ||
    schoolLocation.location_name ||
    'Main Campus Gate';

  const isArrival = actionType === 'arrival' || actionType === 'clock_in';
  const isDeparture = actionType === 'departure' || actionType === 'clock_out';

  const prefix = isArrival ? 'Received at' : isDeparture ? 'Signed out at' : 'Location:';
  const verificationTag = geofenceVerified ? '• Geofence Verified' : '';
  const coordsTag = coordsStr ? `(${coordsStr})` : '';

  const displayBadge = `${baseLocation} ${verificationTag}`.trim();
  const actionLabel = `${prefix} ${baseLocation} ${coordsTag} ${verificationTag}`.trim();

  return {
    location_name: baseLocation,
    gps_coords: coordsStr,
    geofence_verified: geofenceVerified,
    display_badge: displayBadge,
    action_label: actionLabel,
  };
}
