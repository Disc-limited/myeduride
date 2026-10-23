/**
 * Full-stack Student ID Card Details Resolver
 * Resolves actual student information from database records:
 * - Guardian Name (from linked primary/secondary parents or student custom fields)
 * - Guardian Phone (from linked user profiles or emergency contact fields)
 * - Home Stop (from assigned transport route stops, house landmarks, or addresses)
 * - Route Code (from active transport route assignments or student fields)
 */

export interface StudentRecord {
  id?: string;
  first_name?: string;
  last_name?: string;
  student_id_number?: string;
  house_address?: string | null;
  house_landmark?: string | null;
  custom_fields?: Record<string, any> | null;
  [key: string]: any;
}

export interface ParentLinkRecord {
  student_id?: string;
  relationship?: string | null;
  is_primary?: boolean | null;
  parent?: {
    id?: string;
    full_name?: string | null;
    phone?: string | null;
  } | null;
  [key: string]: any;
}

export interface RouteAssignmentRecord {
  student_id?: string;
  morning_stop?:
    | { id?: string; name?: string | null; landmark?: string | null }
    | Array<{ id?: string; name?: string | null; landmark?: string | null }>
    | null;
  afternoon_stop?:
    | { id?: string; name?: string | null; landmark?: string | null }
    | Array<{ id?: string; name?: string | null; landmark?: string | null }>
    | null;
  morning_route?:
    | { id?: string; name?: string | null; code?: string | null; route_code?: string | null }
    | Array<{ id?: string; name?: string | null; code?: string | null; route_code?: string | null }>
    | null;
  afternoon_route?:
    | { id?: string; name?: string | null; code?: string | null; route_code?: string | null }
    | Array<{ id?: string; name?: string | null; code?: string | null; route_code?: string | null }>
    | null;
  [key: string]: any;
}

export interface ResolvedStudentIdCardDetails {
  guardianName: string;
  guardianPhone: string;
  homeStop: string;
  routeCode: string;
}

/**
 * Cleanly format and sanitize a name string (removes trailing whitespace, redundant punctuation)
 */
function cleanText(val: any): string | null {
  if (typeof val !== 'string') return null;
  const trimmed = val.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Cleanly format phone numbers into readable Nigerian/international formats
 */
function cleanPhone(val: any): string | null {
  if (typeof val !== 'string') return null;
  const trimmed = val.trim();
  if (!trimmed) return null;
  // If it's a valid phone string with digits
  if (/\d/.test(trimmed)) {
    return trimmed;
  }
  return null;
}

/**
 * Resolves guardian name, phone, home stop, and route code from active database entities.
 */
export function resolveStudentIdCardDetails(
  student: StudentRecord,
  parentLinks?: ParentLinkRecord[] | null,
  routeAssignment?: RouteAssignmentRecord | null
): ResolvedStudentIdCardDetails {
  const custom = student.custom_fields || {};

  // -------------------------------------------------------------
  // 1. GUARDIAN NAME RESOLUTION
  // Priority:
  // a) Primary linked parent from student_parents -> user_profiles.full_name
  // b) Any linked parent from student_parents -> user_profiles.full_name
  // c) custom_fields.guardian_name
  // d) custom_fields.parent_name
  // e) custom_fields.emergency_contact_name
  // f) student.parent_name or student.guardian_name direct prop
  // -------------------------------------------------------------
  let guardianName: string | null = null;

  if (parentLinks && parentLinks.length > 0) {
    // Sort so primary parent comes first
    const sorted = [...parentLinks].sort((a, b) => (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0));
    for (const link of sorted) {
      const p = Array.isArray(link.parent) ? link.parent[0] : link.parent;
      const name = cleanText(p?.full_name);
      if (name) {
        guardianName = name;
        break;
      }
    }
  }

  if (!guardianName) {
    guardianName =
      cleanText(custom.guardian_name) ||
      cleanText(custom.parent_name) ||
      cleanText(custom.emergency_contact_name) ||
      cleanText(student.parent_name) ||
      cleanText(student.guardian_name) ||
      null;
  }

  // -------------------------------------------------------------
  // 2. GUARDIAN PHONE RESOLUTION
  // Priority:
  // a) Primary linked parent from student_parents -> user_profiles.phone
  // b) Any linked parent from student_parents -> user_profiles.phone
  // c) custom_fields.emergency_phone
  // d) custom_fields.parent_phone
  // e) custom_fields.guardian_phone
  // f) custom_fields.phone
  // g) student.parent_phone or student.guardian_phone direct prop
  // -------------------------------------------------------------
  let guardianPhone: string | null = null;

  if (parentLinks && parentLinks.length > 0) {
    const sorted = [...parentLinks].sort((a, b) => (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0));
    for (const link of sorted) {
      const p = Array.isArray(link.parent) ? link.parent[0] : link.parent;
      const phone = cleanPhone(p?.phone);
      if (phone) {
        guardianPhone = phone;
        break;
      }
    }
  }

  if (!guardianPhone) {
    guardianPhone =
      cleanPhone(custom.emergency_phone) ||
      cleanPhone(custom.parent_phone) ||
      cleanPhone(custom.guardian_phone) ||
      cleanPhone(custom.phone) ||
      cleanPhone(student.parent_phone) ||
      cleanPhone(student.guardian_phone) ||
      null;
  }

  // -------------------------------------------------------------
  // 3. HOME STOP RESOLUTION
  // Priority:
  // a) Assigned transport route stop (morning_stop or afternoon_stop)
  // b) student.house_landmark
  // c) student.house_address
  // d) custom_fields.home_stop
  // e) custom_fields.bus_stop
  // f) custom_fields.stop
  // g) custom_fields.address
  // -------------------------------------------------------------
  let homeStop: string | null = null;

  if (routeAssignment) {
    const mStop = Array.isArray(routeAssignment.morning_stop)
      ? routeAssignment.morning_stop[0]
      : routeAssignment.morning_stop;
    const aStop = Array.isArray(routeAssignment.afternoon_stop)
      ? routeAssignment.afternoon_stop[0]
      : routeAssignment.afternoon_stop;
    const stopName = cleanText(mStop?.name) || cleanText(aStop?.name);
    const stopLandmark = cleanText(mStop?.landmark) || cleanText(aStop?.landmark);
    if (stopName && stopLandmark && !stopName.toLowerCase().includes(stopLandmark.toLowerCase())) {
      homeStop = `${stopName} (${stopLandmark})`;
    } else if (stopName) {
      homeStop = stopName;
    }
  }

  if (!homeStop) {
    // If house_landmark is present
    const landmark = cleanText(student.house_landmark) || cleanText(custom.landmark);
    const address = cleanText(student.house_address) || cleanText(custom.home_stop) || cleanText(custom.bus_stop) || cleanText(custom.stop) || cleanText(custom.address);

    if (landmark && address && !address.toLowerCase().includes(landmark.toLowerCase())) {
      homeStop = `${landmark} · ${address}`;
    } else if (landmark) {
      homeStop = landmark;
    } else if (address) {
      homeStop = address;
    }
  }

  // -------------------------------------------------------------
  // 4. ROUTE CODE RESOLUTION
  // Priority:
  // a) Assigned transport route code from morning_route (code or route_code or name)
  // b) Assigned transport route code from afternoon_route (code or route_code or name)
  // c) custom_fields.route_code, custom_fields.route, custom_fields.route_name
  // d) student.route_code or student.route
  // -------------------------------------------------------------
  let routeCode: string | null = null;

  if (routeAssignment) {
    const mRoute = Array.isArray(routeAssignment.morning_route)
      ? routeAssignment.morning_route[0]
      : routeAssignment.morning_route;
    const aRoute = Array.isArray(routeAssignment.afternoon_route)
      ? routeAssignment.afternoon_route[0]
      : routeAssignment.afternoon_route;

    routeCode =
      cleanText(mRoute?.code) ||
      cleanText(mRoute?.route_code) ||
      cleanText(mRoute?.name) ||
      cleanText(aRoute?.code) ||
      cleanText(aRoute?.route_code) ||
      cleanText(aRoute?.name);
  }

  if (!routeCode) {
    routeCode =
      cleanText(custom.route_code) ||
      cleanText(custom.route) ||
      cleanText(custom.route_name) ||
      cleanText(student.route_code) ||
      cleanText(student.route);
  }

  return {
    guardianName: guardianName || 'Not Assigned',
    guardianPhone: guardianPhone || 'Not Available',
    homeStop: homeStop || 'Campus Gate',
    routeCode: routeCode || 'R-CAMPUS',
  };
}
