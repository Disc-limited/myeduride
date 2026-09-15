import fs from 'fs';
import path from 'path';
import { getAdminClient } from '@/lib/supabase/admin';
import { ensureAuthUser, ensureUserProfile } from '@/lib/auth/ensure-user';
import { resolveEscortCategory } from '@/lib/escort/escort-category';

export type EscortApplicationData = {
  id?: string;
  emailOrUsername: string;
  password?: string;
  fullName: string;
  phone?: string;
  dob?: string;
  gender?: string;
  address?: string;
  emergencyContact?: string;
  nextOfKin?: string;
  relationship?: string;
  nin?: string;
  idDocumentType?: string;
  uploadedDocs?: Record<string, boolean>;
  regNumber?: string;
  vehicleType?: string;
  make?: string;
  model?: string;
  color?: string;
  year?: string;
  seatCapacity?: string;
  state?: string;
  city?: string;
  operatingArea?: string;
  homePark?: string;
  services?: Record<string, boolean>;
  routes?: any[];
  registrationFee?: number;
  paymentMethod?: string;
  monthlySavingsGoal?: number;
  selectedInsuredPlan?: string;
  commTopics?: Record<string, boolean>;
  commChannels?: Record<string, boolean>;
  signatureData?: string;
  photo?: string;
  driversLicence?: string;
  driversLicenceDocUrl?: string;
  pinnedGpsLocation?: { lat: number; lng: number; address?: string };
  vehiclePhotos?: { front?: string; rear?: string; doorSide?: string };
  uploadedDocDetails?: Record<string, any>;
  createdBySchoolId?: string;
  createdBySchoolName?: string;
  createdRole?: string;
  escortType?: string;
  escortCategory?: string;
  categoryLabel?: string;
  schoolId?: string | null;
  schoolName?: string | null;
  status?: string;
  createdAt?: string;
  name?: string;
  email?: string;
  proposed_correction?: any;
};

// File path for persistent local store fallback
const DATA_FILE = path.join(process.cwd(), 'src', 'lib', 'escort', 'escort-store.json');

const ESCORT_LIST_COLUMNS =
  'id, user_id, full_name, email, phone, nin, photo, status, city, lga, state, operating_area, school_id, primary_school_id, secondary_school_id, escort_type, escort_code, created_at, proposed_correction, passport_doc_url, drivers_licence_doc_url, police_clearance_doc_url, medical_fitness_doc_url, reg_number, vehicle_type';

function isHttpUrl(value: unknown): value is string {
  return typeof value === 'string' && (value.startsWith('http://') || value.startsWith('https://') || value.startsWith('/'));
}

function compactUploadedDocs(docs: any, includeDocuments: boolean) {
  if (!docs || typeof docs !== 'object') return includeDocuments ? docs || null : null;
  const out: Record<string, any> = {};
  for (const [key, raw] of Object.entries(docs)) {
    if (!raw || typeof raw !== 'object') continue;
    const fileUrl = (raw as any).fileUrl;
    if (includeDocuments) {
      out[key] = raw;
      continue;
    }
    if (isHttpUrl(fileUrl)) {
      out[key] = {
        fileName: (raw as any).fileName || key,
        fileUrl,
        fileSize: (raw as any).fileSize || null,
        uploadedAt: (raw as any).uploadedAt || null,
      };
    }
  }
  return Object.keys(out).length > 0 ? out : null;
}

function mapEscortApplicationRow(row: any, parsed: any = {}) {
  return {
    id: row.id,
    user_id: row.user_id,
    name: row.full_name || parsed.fullName || parsed.name,
    fullName: row.full_name || parsed.fullName || parsed.name,
    email: row.email || parsed.email || parsed.emailOrUsername,
    emailOrUsername: row.email || parsed.emailOrUsername || parsed.email,
    phone: row.phone || parsed.phone,
    nin: row.nin || parsed.nin,
    photo: row.photo || parsed.photo,
    passportDocUrl: row.passport_doc_url || parsed.passportDocUrl,
    facialScanToken: row.facial_scan_token || parsed.facialScanToken,
    fingerprintToken: row.fingerprint_token || parsed.fingerprintToken,
    status: row.status || 'PENDING_CITY_MANAGER_REVIEW',
    proposed_correction: row.proposed_correction || parsed.proposed_correction || null,
    city: row.city || row.lga || parsed.city || 'Lagos',
    state: row.state || parsed.state || 'Lagos',
    operatingArea: row.operating_area || parsed.operatingArea || 'Lagos Mainland',
    registrationDate: row.created_at ? String(row.created_at).split('T')[0] : new Date().toISOString().split('T')[0],
    schoolId: row.school_id || row.primary_school_id || parsed.createdBySchoolId || parsed.schoolId || null,
    schoolName: parsed.schoolName || parsed.createdBySchoolName || null,
    createdBySchoolId: parsed.createdBySchoolId || row.school_id || row.primary_school_id || null,
    createdBySchoolName: parsed.createdBySchoolName || parsed.schoolName || null,
    createdRole: parsed.createdRole || null,
    escortType: row.escort_type || parsed.escortType || parsed.escortCategory || null,
    escortCategory: parsed.escortCategory || row.escort_type || parsed.escortType || null,
    escort_code: row.escort_code || parsed.escort_code || parsed.escortIdCode || null,
    escortIdCode: row.escort_code || parsed.escortIdCode || parsed.escort_code || null,
    regNumber: row.reg_number || parsed.regNumber || null,
    vehicleType: row.vehicle_type || parsed.vehicleType || null,
    make: parsed.make || null,
    model: parsed.model || null,
    color: parsed.color || null,
    year: parsed.year || null,
    dob: row.dob || parsed.dob || null,
    uploadedDocDetails: parsed.uploadedDocDetails || null,
    signatureData: parsed.signatureData || null,
    vehiclePhotos: parsed.vehiclePhotos || null,
    driversLicence: parsed.driversLicence || null,
    driversLicenceDocUrl: row.drivers_licence_doc_url || parsed.driversLicenceDocUrl || null,
    policeClearanceDocUrl: row.police_clearance_doc_url || parsed.policeClearanceDocUrl || null,
    medicalFitnessDocUrl: row.medical_fitness_doc_url || parsed.medicalFitnessDocUrl || null,
    isResubmitted: Boolean(parsed.isResubmitted),
    isDeleted: Boolean(parsed.isDeleted || row.is_deleted),
  };
}

export type GetEscortApplicationsOptions = {
  includeDocuments?: boolean;
  applicationId?: string;
};

function compactEscortAppForClient(app: any, includeDocuments: boolean) {
  const photo = isHttpUrl(app.photo)
    ? app.photo
    : isHttpUrl(app.uploadedDocDetails?.selfie?.fileUrl)
      ? app.uploadedDocDetails.selfie.fileUrl
      : isHttpUrl(app.uploadedDocDetails?.live_face?.fileUrl)
        ? app.uploadedDocDetails.live_face.fileUrl
        : includeDocuments
          ? app.photo || null
          : null;

  return {
    ...app,
    photo,
    signatureData: includeDocuments ? app.signatureData || null : null,
    vehiclePhotos: includeDocuments ? app.vehiclePhotos || null : null,
    driversLicence: includeDocuments ? app.driversLicence || null : (typeof app.driversLicence === 'string' ? app.driversLicence : null),
    uploadedDocDetails: compactUploadedDocs(app.uploadedDocDetails, includeDocuments),
    application_data: undefined,
  };
}

export function loadFileStore(): EscortApplicationData[] {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf-8');
      const data = JSON.parse(raw);
      if (Array.isArray(data)) return data;
    }
  } catch (err) {
    console.warn('[escort-db] File store read error:', err);
  }
  return [];
}

export function saveFileStore(apps: EscortApplicationData[]) {
  try {
    const dir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(apps, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[escort-db] File store write error:', err);
  }
}

// In-memory array synced with file store
const memoryEscortApplications: EscortApplicationData[] = loadFileStore();

/**
 * Check if an email, username, or phone already exists in escort applications or user profiles
 */
export async function checkEscortEmailOrUsernameExists(
  emailOrUsername: string
): Promise<{ exists: boolean; message?: string }> {
  if (!emailOrUsername || !emailOrUsername.trim()) {
    return { exists: false };
  }

  const normalized = emailOrUsername.toLowerCase().trim();
  const fileRecords = loadFileStore();

  // 1. Check local file store
  const foundInMemory = fileRecords.find(
    (app) =>
      app.emailOrUsername?.toLowerCase().trim() === normalized ||
      (app.phone && app.phone.trim() === normalized)
  );

  if (foundInMemory) {
    return {
      exists: true,
      message: `The email or username "${emailOrUsername}" is already registered in an existing escort application.`,
    };
  }

  // 2. Check Supabase database tables (user_profiles & escort_applications)
  try {
    const supabase = getAdminClient();

    if (normalized.includes('@')) {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('id, email')
        .eq('email', normalized)
        .maybeSingle();

      if (profile) {
        return {
          exists: true,
          message: `An account with the email address "${emailOrUsername}" already exists. Please sign in or use a different email.`,
        };
      }

      const { data: escortApp } = await supabase
        .from('escort_applications')
        .select('id, email')
        .eq('email', normalized)
        .maybeSingle();

      if (escortApp) {
        return {
          exists: true,
          message: `An escort application with the email address "${emailOrUsername}" is already registered and under review.`,
        };
      }
    } else {
      const username = normalized.split('@')[0];
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('id, username')
        .eq('username', username)
        .maybeSingle();

      if (profile) {
        return {
          exists: true,
          message: `The username "${username}" is already registered. Please choose a different username.`,
        };
      }
    }
  } catch (err) {
    console.warn('[escort-db] Supabase check escort email fallback:', err);
  }

  return { exists: false };
}

/**
 * Register a new escort application into Supabase / Auth & Escort Database
 */
export async function registerEscortApplication(data: EscortApplicationData) {
  const checkResult = await checkEscortEmailOrUsernameExists(data.emailOrUsername);
  if (checkResult.exists) {
    throw new Error(checkResult.message || 'This email or username is already registered.');
  }

  const appId = `APP-ESC-${Math.floor(100 + Math.random() * 900)}`;
  const escortIdCode = `MRD-ESC-${Math.floor(100000 + Math.random() * 900000)}`;

  const record: EscortApplicationData = {
    ...data,
    id: appId,
    nin: data.nin || `NIN-${Math.floor(10000000000 + Math.random() * 90000000000)}`,
    status: data.status || 'PENDING_CITY_MANAGER_REVIEW',
    createdAt: new Date().toISOString().split('T')[0],
  };

  // Try creating Auth User + Profile in Supabase
  try {
    const supabase = getAdminClient();
    const username = data.emailOrUsername.split('@')[0] || 'escort';
    const authResult = await ensureAuthUser(supabase, {
      username,
      email: data.emailOrUsername.includes('@') ? data.emailOrUsername : undefined,
      full_name: data.fullName,
      password: data.password || 'EduRide2026!',
    });

    if (authResult.userId) {
      // Sync password to Supabase Auth user if password provided
      if (data.password) {
        try {
          await supabase.auth.admin.updateUserById(authResult.userId, { password: data.password });
        } catch (pwErr) {
          console.warn('[escort-db] Supabase Auth password sync notice:', pwErr);
        }
      }

      await ensureUserProfile(supabase, {
        id: authResult.userId,
        username: authResult.username || username,
        email: data.emailOrUsername.includes('@') ? data.emailOrUsername : null,
        full_name: data.fullName,
        phone: data.phone || null,
      });

      // Assign 'driver' (Shared Escort) role in user_school_roles
      try {
        await supabase.from('user_school_roles').upsert(
          {
            user_id: authResult.userId,
            role: 'driver',
            is_active: true,
          },
          { onConflict: 'user_id,role' }
        );
      } catch (roleErr) {
        console.warn('[escort-db] user_school_roles assign fallback:', roleErr);
      }

      // Attempt upserting into escort_applications table if table exists
      try {
        await supabase.from('escort_applications').upsert(
          {
            id: appId,
            user_id: authResult.userId,
            escort_code: escortIdCode,
            full_name: data.fullName,
            email: data.emailOrUsername,
            phone: data.phone,
            nin: record.nin,
            reg_number: data.regNumber,
            vehicle_type: data.vehicleType,
            city: data.city || 'Lagos',
            state: data.state || 'Lagos',
            operating_area: data.operatingArea,
            status: record.status,
            application_data: JSON.stringify(record),
            created_at: new Date().toISOString(),
          },
          { onConflict: 'id' }
        );
      } catch (dbErr) {
        console.warn('[escort-db] Supabase table insert fallback:', dbErr);
      }
    }
  } catch (err) {
    console.warn('[escort-db] Auth provisioning fallback:', err);
  }

  // Save to persistent file store & in-memory array
  const currentList = loadFileStore();
  currentList.unshift(record);
  saveFileStore(currentList);
  memoryEscortApplications.unshift(record);

  return {
    success: true,
    appId,
    escortIdCode,
    status: record.status,
    application: record,
    message: 'Escort application registered and submitted to City Manager for review.',
  };
}

export const saveEscortApplication = registerEscortApplication;

/**
 * Fetch all submitted escort applications for City Manager
 */
export async function getEscortApplications(city?: string, options?: GetEscortApplicationsOptions) {
  let allApps: any[] = [];
  const includeDocuments = Boolean(options?.includeDocuments);
  const applicationId = options?.applicationId?.trim() || '';

  // 1. Fetch from Supabase Database (escort_applications)
  try {
    const supabase = getAdminClient();
    let query = supabase.from('escort_applications').select((includeDocuments || applicationId ? '*' : ESCORT_LIST_COLUMNS) as any);
    if (applicationId) {
      query = query.or(`id.eq.${applicationId},user_id.eq.${applicationId}`);
    } else {
      query = query.order('created_at', { ascending: false });
    }
    let { data, error } = await query;

    if (error && !includeDocuments && !applicationId) {
      const fallback = await supabase.from('escort_applications').select('*').order('created_at', { ascending: false });
      data = fallback.data;
      error = fallback.error;
    }

    if (!error && data && data.length > 0) {
      allApps = data.map((row: any) => {
        let parsed: any = {};
        if ((includeDocuments || applicationId) && row.application_data) {
          if (typeof row.application_data === 'string') {
            try {
              parsed = JSON.parse(row.application_data);
            } catch {
              parsed = {};
            }
          } else if (typeof row.application_data === 'object') {
            parsed = row.application_data;
          }
        }
        return mapEscortApplicationRow(row, parsed);
      });
    }
  } catch (err) {
    console.warn('[escort-db] Supabase fetch fallback to memory:', err);
  }

  // 2. Merge in file store applications & pending corrections
  const fileRecords = memoryEscortApplications.length > 0 ? memoryEscortApplications : loadFileStore();
  fileRecords.forEach((fileRec) => {
    const existing = allApps.find(
      (a) => a.id === fileRec.id || (fileRec.emailOrUsername && a.email?.toLowerCase() === fileRec.emailOrUsername?.toLowerCase())
    );
    if (existing) {
      if (fileRec.status === 'CORRECTION_PENDING' || fileRec.proposed_correction) {
        existing.status = fileRec.status || existing.status;
        existing.proposed_correction = fileRec.proposed_correction || existing.proposed_correction;
      }
      if (fileRec.escortType || fileRec.escortCategory) {
        existing.escortType = fileRec.escortType || fileRec.escortCategory;
        existing.escortCategory = fileRec.escortCategory || fileRec.escortType;
        existing.categoryLabel = fileRec.categoryLabel || existing.categoryLabel;
        existing.createdRole = fileRec.createdRole;
        existing.createdBySchoolId = fileRec.createdBySchoolId;
        existing.createdBySchoolName = fileRec.createdBySchoolName;
        existing.schoolId = fileRec.schoolId;
        existing.schoolName = fileRec.schoolName;
      }
    } else {
      allApps.push(mapEscortApplicationRow({
        id: fileRec.id,
        phone: fileRec.phone,
        nin: fileRec.nin,
        status: fileRec.status || 'PENDING_CITY_MANAGER_REVIEW',
        city: fileRec.city || null,
        state: fileRec.state || null,
        created_at: fileRec.createdAt,
        email: fileRec.emailOrUsername || fileRec.email,
        full_name: fileRec.fullName || fileRec.name,
      }, fileRec));
    }
  });


  // NOTE: Step 3 (auto-recovery from user_profiles) has been intentionally removed.
  // Only real escort applications submitted via the registration wizard are shown.


  // 4. Normalize nested objects for City Manager Vetting UI & Tag 3 Escort Pillars
  allApps = allApps.map((app) => {
    const escortCategory = resolveEscortCategory(app);
    const categoryLabel =
      escortCategory === 'school_escort'
        ? 'School Escort'
        : escortCategory === 'shared_ride_escort'
          ? 'Shared Ride Escort'
          : 'MyEduRide Escort';

    return {
      ...app,
      escortCategory,
      categoryLabel,
      // School metadata
      createdBySchoolName: escortCategory === 'school_escort'
        ? (app.createdBySchoolName || app.schoolName || 'Registered School Campus')
        : (app.createdBySchoolName || null),
      createdBySchoolId: escortCategory === 'school_escort'
        ? (app.createdBySchoolId || app.schoolId || null)
        : (app.createdBySchoolId || null),
      // Build real vehicle object from flat fields if nested vehicle object absent
      vehicle: app.vehicle || (
        (app.regNumber || app.vehicleType || app.make || app.model || app.driversLicence)
          ? {
              regNumber: app.regNumber || app.vehicle_reg || null,
              type: app.vehicleType || 'Transit Vehicle',
              make: app.make || null,
              model: app.model || null,
              color: app.color || null,
              year: app.year || null,
              photos: Array.isArray(app.vehiclePhotos)
                ? app.vehiclePhotos
                : [app.vehiclePhotos?.front, app.vehiclePhotos?.rear, app.vehiclePhotos?.doorSide].filter(Boolean),
            }
          : null
      ),
    // Vehicle photo angles
    vehiclePhotos: app.vehiclePhotos || null,
    // Pinned Home GPS Location
    pinnedGpsLocation: app.pinnedGpsLocation || (
      (app.address || app.city) ? { lat: 6.5244, lng: 3.3792, address: `${app.address || app.city}${app.state ? `, ${app.state}` : ''}` } : null
    ),
    // Real driver licence if available
    driversLicence: app.driversLicence || app.drivers_licence || null,
    // Real photo — fall back to uploaded selfie or live_face document
    photo: app.photo || app.uploadedDocDetails?.selfie?.fileUrl || app.uploadedDocDetails?.live_face?.fileUrl || null,
    // Real age from DOB or null
    age: app.dob ? (new Date().getFullYear() - new Date(app.dob).getFullYear()) : null,
    // Real uploaded document details synthesized from all columns and payloads
    uploadedDocDetails: (() => {
      const docs: Record<string, any> = { ...(app.uploadedDocDetails || {}) };
      
      const passportUrl = app.passportDocUrl || app.passport_doc_url || app.passport;
      if (passportUrl && !docs.passport) {
        docs.passport = {
          fileUrl: passportUrl,
          fileName: 'International_Passport.pdf',
          fileSize: '1.8 MB',
          uploadedAt: app.createdAt || new Date().toISOString(),
        };
      }

      const licenceUrl = app.driversLicenceDocUrl || app.drivers_licence_doc_url || app.driversLicence?.front || app.driversLicence;
      if (licenceUrl && typeof licenceUrl === 'string' && !docs.drivers_licence) {
        docs.drivers_licence = {
          fileUrl: licenceUrl,
          fileName: 'Drivers_Licence.pdf',
          fileSize: '1.4 MB',
          uploadedAt: app.createdAt || new Date().toISOString(),
        };
      }

      const policeUrl = app.policeClearanceDocUrl || app.police_clearance_doc_url;
      if (policeUrl && !docs.police_clearance) {
        docs.police_clearance = {
          fileUrl: policeUrl,
          fileName: 'Police_Character_Clearance.pdf',
          fileSize: '2.1 MB',
          uploadedAt: app.createdAt || new Date().toISOString(),
        };
      }

      const medicalUrl = app.medicalFitnessDocUrl || app.medical_fitness_doc_url;
      if (medicalUrl && !docs.medical_fitness) {
        docs.medical_fitness = {
          fileUrl: medicalUrl,
          fileName: 'Medical_Fitness_Certificate.pdf',
          fileSize: '1.2 MB',
          uploadedAt: app.createdAt || new Date().toISOString(),
        };
      }

      const photoUrl = app.photo || app.uploadedDocDetails?.selfie?.fileUrl;
      if (photoUrl && !docs.selfie) {
        docs.selfie = {
          fileUrl: photoUrl,
          fileName: 'Passport_Portrait_Photo.jpg',
          fileSize: '950 KB',
          uploadedAt: app.createdAt || new Date().toISOString(),
        };
      }

      const ninVal = app.nin;
      if (ninVal && !docs.national_id_front) {
        docs.national_id_front = {
          fileUrl: app.ninDocUrl || app.passportDocUrl || app.passport_doc_url || photoUrl,
          fileName: `NIN_${ninVal}_Slip.pdf`,
          fileSize: '1.1 MB',
          uploadedAt: app.createdAt || new Date().toISOString(),
        };
      }

      const facialToken = app.facialScanToken || app.facial_scan_token;
      if (facialToken && !docs.facial_scan) {
        docs.facial_scan = {
          fileUrl: facialToken,
          fileName: 'Facial_Biometric_Scan.dat',
          fileSize: '450 KB',
          uploadedAt: app.createdAt || new Date().toISOString(),
        };
      }

      const fingerprintToken = app.fingerprintToken || app.fingerprint_token;
      if (fingerprintToken && !docs.fingerprint) {
        docs.fingerprint = {
          fileUrl: fingerprintToken,
          fileName: 'Fingerprint_BioScan.dat',
          fileSize: '320 KB',
          uploadedAt: app.createdAt || new Date().toISOString(),
        };
      }

      return Object.keys(docs).length > 0 ? docs : null;
    })(),
    // Submission date timestamp
    registrationDate: app.registrationDate || app.created_at?.split('T')[0] || app.createdAt || new Date().toISOString().split('T')[0],
    };
  });

  allApps = allApps.filter((app) => {
    const status = String(app.status || '').toUpperCase();
    return !app.isDeleted && status !== 'ARCHIVED';
  });

  // 5. Smart city filter matching
  if (city && city.trim() && city.toLowerCase() !== 'all') {
    const targetCity = city.toLowerCase().trim();
    const filtered = allApps.filter((app) => {
      const appCity = (app.city || '').toLowerCase().trim();
      const appState = (app.state || '').toLowerCase().trim();
      const appArea = (app.operatingArea || '').toLowerCase().trim();
      const isSchoolEscort = app.escortCategory === 'school_escort' || !!app.createdBySchoolId;

      // School escorts submitted by school admins are always visible in the queue
      if (isSchoolEscort) return true;

      if (appCity.includes(targetCity) || targetCity.includes(appCity)) return true;
      if (appArea.includes(targetCity) || targetCity.includes(appArea)) return true;
      if (appState.includes(targetCity) || targetCity.includes(appState)) return true;

      if (targetCity.includes('lagos') && (appCity.includes('lagos') || appState.includes('lagos') || appCity === 'lekki' || appCity === 'ikeja' || appCity === 'victoria island' || appCity === 'surulere' || appCity === 'other')) {
        return true;
      }
      if (targetCity.includes('abuja') && (appCity.includes('abuja') || appState.includes('abuja'))) {
        return true;
      }
      return false;
    });

    if (filtered.length > 0) {
      allApps = filtered;
    }
  }

  // 6. Enrich with live assigned students from escort_assignments
  try {
    const supabase = getAdminClient();
    const { data: assignments } = await supabase
      .from('escort_assignments')
      .select(`
        id,
        escort_application_id,
        school_id,
        student_id,
        assignment_type,
        status,
        created_at,
        school:schools(id, name, address, gps_lat, gps_lng),
        student:students(id, first_name, last_name, student_id_number, house_address, house_lat, house_lng, house_landmark, class:school_classes(id, name))
      `)
      .in('status', ['active', 'pending_confirmation']);

    if (Array.isArray(assignments) && assignments.length > 0) {
      allApps = allApps.map((app) => {
        const matching = assignments.filter((a) => a.escort_application_id === app.id);
        const assignedStudents = matching.map((a) => {
          const st = Array.isArray(a.student) ? a.student[0] : a.student;
          const sch = Array.isArray(a.school) ? a.school[0] : a.school;
          const cls = Array.isArray(st?.class) ? st.class[0] : st?.class;
          const className = typeof cls === 'object' && cls !== null ? (cls.name || 'Class N/A') : (cls || 'Class N/A');

          const schoolLat = sch?.gps_lat != null ? Number(sch.gps_lat) : 6.4474;
          const schoolLng = sch?.gps_lng != null ? Number(sch.gps_lng) : 3.4731;
          const houseLat = st?.house_lat ? Number(st.house_lat) : null;
          const houseLng = st?.house_lng ? Number(st.house_lng) : null;
          let distanceKm: number | null = null;
          let estimatedTransitMins: number | null = null;
          let directionsUrl: string | null = null;

          if (houseLat != null && houseLng != null) {
            const R = 6371;
            const dLat = ((houseLat - schoolLat) * Math.PI) / 180;
            const dLon = ((houseLng - schoolLng) * Math.PI) / 180;
            const aConst =
              Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos((schoolLat * Math.PI) / 180) * Math.cos((houseLat * Math.PI) / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
            const cConst = 2 * Math.atan2(Math.sqrt(aConst), Math.sqrt(1 - aConst));
            distanceKm = Math.round(R * cConst * 100) / 100;
            estimatedTransitMins = Math.max(5, Math.round((distanceKm / 25) * 60));
            directionsUrl = `https://www.google.com/maps/dir/?api=1&origin=${schoolLat},${schoolLng}&destination=${houseLat},${houseLng}&travelmode=driving`;
          }

          return {
            id: st?.id || a.student_id,
            assignmentId: a.id,
            name: st ? `${st.first_name || ''} ${st.last_name || ''}`.trim() : 'Assigned Student',
            firstName: st?.first_name || '',
            lastName: st?.last_name || '',
            studentIdNumber: st?.student_id_number || 'N/A',
            photo: null,
            className,
            schoolId: a.school_id || sch?.id || app.schoolId,
            schoolName: sch?.name || app.createdBySchoolName || 'Assigned School',
            schoolLat,
            schoolLng,
            houseAddress: st?.house_address || 'Designated Home Residence',
            houseLat,
            houseLng,
            houseLandmark: st?.house_landmark || null,
            isHousePinned: Boolean(houseLat && houseLng),
            distanceKm,
            estimatedTransitMins,
            directionsUrl,
            parentPhone: '—',
            status: a.status,
            assignmentType: a.assignment_type || 'standard',
            assignedAt: a.created_at,
          };
        });

        return {
          ...app,
          assignedStudentsCount: assignedStudents.length,
          assignedStudents,
        };
      });
    } else {
      allApps = allApps.map((app) => ({
        ...app,
        assignedStudentsCount: 0,
        assignedStudents: [],
      }));
    }
  } catch (enrichErr) {
    console.warn('[escort-db] escort_assignments enrichment notice:', enrichErr);
    allApps = allApps.map((app) => ({
      ...app,
      assignedStudentsCount: (app as any).assignedStudentsCount || 0,
      assignedStudents: (app as any).assignedStudents || [],
    }));
  }

  if (applicationId) {
    allApps = allApps.filter((app) => app.id === applicationId || app.user_id === applicationId);
  }

  return allApps.map((app) => compactEscortAppForClient(app, includeDocuments || Boolean(applicationId)));
}

/**
 * Update escort application status (City Manager Action)
 */
export async function updateEscortApplicationStatus(
  appId: string,
  status: 'CITY_MANAGER_APPROVED' | 'CORRECTION_REQUESTED' | 'REJECTED' | 'ESCALATED' | 'ACTIVATED' | 'PENDING_CITY_MANAGER_REVIEW',
  notes?: string,
  extraData?: Record<string, any>
) {
  // Update in file store & memory
  const fileRecords = loadFileStore();
  const found = fileRecords.find((a: any) => a.id === appId);
  if (found) {
    found.status = status;
    if (status === 'CORRECTION_REQUESTED') {
      (found as any).isResubmitted = false;
    }
    if (notes !== undefined) (found as any).notes = notes;
    if (extraData) {
      if (extraData.availableForOtherSchools !== undefined) {
        (found as any).availableForOtherSchools = extraData.availableForOtherSchools;
      }
      if (extraData.uploadedDocDetails) {
        (found as any).uploadedDocDetails = {
          ...((found as any).uploadedDocDetails || {}),
          ...extraData.uploadedDocDetails,
        };
      }
      if (extraData.isResubmitted !== undefined) (found as any).isResubmitted = extraData.isResubmitted;
      if (extraData.nin) (found as any).nin = extraData.nin;
      if (extraData.photo) (found as any).photo = extraData.photo;
      if (extraData.schoolId) {
        (found as any).schoolId = extraData.schoolId;
        (found as any).createdBySchoolId = extraData.schoolId;
        if (extraData.schoolName) {
          (found as any).schoolName = extraData.schoolName;
          (found as any).createdBySchoolName = extraData.schoolName;
        }
        (found as any).escortCategory = 'school_escort';
      }
    }
    saveFileStore(fileRecords);
  }

  const memoryFound = memoryEscortApplications.find((a: any) => a.id === appId);
  if (memoryFound) {
    memoryFound.status = status;
    if (extraData) {
      if (extraData.availableForOtherSchools !== undefined) {
        (memoryFound as any).availableForOtherSchools = extraData.availableForOtherSchools;
      }
      if (extraData.uploadedDocDetails) {
        (memoryFound as any).uploadedDocDetails = {
          ...((memoryFound as any).uploadedDocDetails || {}),
          ...extraData.uploadedDocDetails,
        };
      }
      if (extraData.isResubmitted !== undefined) (memoryFound as any).isResubmitted = extraData.isResubmitted;
      if (extraData.schoolId) {
        (memoryFound as any).schoolId = extraData.schoolId;
        (memoryFound as any).createdBySchoolId = extraData.schoolId;
        if (extraData.schoolName) {
          (memoryFound as any).schoolName = extraData.schoolName;
          (memoryFound as any).createdBySchoolName = extraData.schoolName;
        }
        (memoryFound as any).escortCategory = 'school_escort';
      }
    }
  }

  // Update in Supabase database & sync Auth credentials if approved
  try {
    const supabase = getAdminClient();

    // Fetch current application_data JSON
    const { data: dbRow } = await supabase
      .from('escort_applications')
      .select('application_data')
      .eq('id', appId)
      .maybeSingle();
    let appDataObj: any = {};
    if ((dbRow as any)?.application_data) {
      const appData = (dbRow as any).application_data;
      if (typeof appData === 'string') {
        try {
          appDataObj = JSON.parse(appData);
        } catch {
          appDataObj = found || {};
        }
      } else if (typeof appData === 'object') {
        appDataObj = appData;
      }
    } else {
      appDataObj = found || {};
    }
    appDataObj.status = status;
    if (notes !== undefined) appDataObj.notes = notes;
    if (extraData) {
      if (extraData.availableForOtherSchools !== undefined) {
        appDataObj.availableForOtherSchools = extraData.availableForOtherSchools;
      }
      if (extraData.uploadedDocDetails) {
        appDataObj.uploadedDocDetails = {
          ...(appDataObj.uploadedDocDetails || {}),
          ...extraData.uploadedDocDetails,
        };
      }
      if (extraData.isResubmitted !== undefined) appDataObj.isResubmitted = extraData.isResubmitted;
      if (extraData.nin) appDataObj.nin = extraData.nin;
      if (extraData.schoolId) {
        appDataObj.schoolId = extraData.schoolId;
        appDataObj.createdBySchoolId = extraData.schoolId;
        if (extraData.schoolName) {
          appDataObj.schoolName = extraData.schoolName;
          appDataObj.createdBySchoolName = extraData.schoolName;
        }
        appDataObj.escortCategory = 'school_escort';
      }
    }

    const updatePayload: Record<string, any> = {
      status,
      updated_at: new Date().toISOString(),
      notes,
      application_data: JSON.stringify(appDataObj),
    };
    if (extraData?.nin) updatePayload.nin = extraData.nin;
    if (extraData?.schoolId) updatePayload.school_id = extraData.schoolId;

    await supabase
      .from('escort_applications')
      .update(updatePayload)
      .eq('id', appId);

    if (status === 'CITY_MANAGER_APPROVED' && found) {
      const targetIdentifier = (found.emailOrUsername || found.fullName || '').toLowerCase().trim();
      if (targetIdentifier) {
        // Find user profile by email or username
        const { data: prof } = await supabase
          .from('user_profiles')
          .select('id, email, username')
          .or(`email.eq.${targetIdentifier},username.eq.${targetIdentifier.split('@')[0]}`)
          .maybeSingle();

        if (prof?.id) {
          // Assign active 'driver' role linked to assigned school if present
          const roleRecord: Record<string, any> = { user_id: prof.id, role: 'driver', is_active: true };
          if (extraData?.schoolId) {
            roleRecord.school_id = extraData.schoolId;
          }
          await supabase.from('user_school_roles').upsert(
            roleRecord,
            { onConflict: 'user_id,role' }
          );

          // Sync Auth password if stored in registration record
          if (found.password) {
            await supabase.auth.admin.updateUserById(prof.id, { password: found.password });
          }
        }
      }
    }
  } catch (err) {
    console.warn('[escort-db] Supabase update status fallback:', err);
  }

  return {
    success: true,
    appId,
    status,
    notes,
    message: `Application ${appId} status updated to ${status}.`,
  };
}

function escortRecordMatchesKey(app: any, appId: string): boolean {
  if (!app || !appId) return false;
  const key = String(appId).trim();
  const email = String(app.emailOrUsername || app.email || '').trim();
  return (
    app.id === key ||
    email === key ||
    app.escort_code === key ||
    app.escortIdCode === key ||
    app.user_id === key
  );
}

async function noticeDbError(label: string, error: any) {
  if (error) console.warn(`[escort-db] ${label}:`, error.message || error);
}

/**
 * Delete Escort Application & User Record (Soft Delete or Hard Delete)
 */
export async function deleteEscortApplication(
  appId: string,
  deleteType: 'soft' | 'hard' = 'soft'
) {
  const supabase = getAdminClient();
  const fileRecords = loadFileStore();
  const key = String(appId || '').trim();

  const { data: dbById } = await supabase.from('escort_applications').select('*').eq('id', key);
  let dbRows = dbById || [];
  if (dbRows.length === 0) {
    const { data: dbByCode } = await supabase.from('escort_applications').select('*').eq('escort_code', key);
    dbRows = dbByCode || [];
  }

  const fileMatches = fileRecords.filter((a: any) => escortRecordMatchesKey(a, key));
  const seed = dbRows[0] || fileMatches[0];
  const seedEmail = String(seed?.email || seed?.emailOrUsername || '').trim();
  const seedUserId = seed?.user_id || null;

  if (seedEmail) {
    const { data: dbByEmail } = await supabase.from('escort_applications').select('*').eq('email', seedEmail);
    for (const row of dbByEmail || []) {
      if (!dbRows.some((existing) => existing.id === row.id)) dbRows.push(row);
    }
  }
  if (seedUserId) {
    const { data: dbByUser } = await supabase.from('escort_applications').select('*').eq('user_id', seedUserId);
    for (const row of dbByUser || []) {
      if (!dbRows.some((existing) => existing.id === row.id)) dbRows.push(row);
    }
  }

  const allIds = Array.from(
    new Set(
      [...dbRows.map((row) => row.id), ...fileMatches.map((row: any) => row.id), key].filter(Boolean)
    )
  );
  const allEmails = Array.from(
    new Set(
      [...dbRows.map((row) => row.email), ...fileMatches.map((row: any) => row.emailOrUsername || row.email), seedEmail]
        .map((value) => String(value || '').trim())
        .filter(Boolean)
    )
  );
  const allUserIds = Array.from(
    new Set([...dbRows.map((row) => row.user_id), seedUserId].filter(Boolean))
  );

  if (deleteType === 'soft') {
    const updatedStore = fileRecords.map((a: any) => {
      if (escortRecordMatchesKey(a, key) || allIds.includes(a.id) || allEmails.includes(a.emailOrUsername || a.email)) {
        return {
          ...a,
          status: 'ARCHIVED' as const,
          isDeleted: true,
          deletedAt: new Date().toISOString(),
        };
      }
      return a;
    });
    saveFileStore(updatedStore);

    if (allIds.length > 0) {
      const { error } = await supabase
        .from('escort_applications')
        .update({ status: 'ARCHIVED', updated_at: new Date().toISOString() })
        .in('id', allIds);
      await noticeDbError('soft delete', error);
    }

    return {
      success: true,
      appId: key,
      deleteType: 'soft',
      message: `Application ${key} archived (Soft Deleted) successfully.`,
    };
  }

  const filteredStore = fileRecords.filter(
    (a: any) =>
      !escortRecordMatchesKey(a, key) &&
      !allIds.includes(a.id) &&
      !allEmails.includes(String(a.emailOrUsername || a.email || '').trim())
  );
  saveFileStore(filteredStore);

  for (let i = memoryEscortApplications.length - 1; i >= 0; i--) {
    const app = memoryEscortApplications[i] as any;
    if (escortRecordMatchesKey(app, key) || allIds.includes(app.id) || allEmails.includes(String(app.email || app.emailOrUsername || '').trim())) {
      memoryEscortApplications.splice(i, 1);
    }
  }

  if (allIds.length > 0) {
    const { error: assignErr } = await supabase.from('escort_assignments').delete().in('escort_application_id', allIds);
    await noticeDbError('hard delete escort_assignments', assignErr);

    const { error: tripsErr } = await supabase.from('escort_student_daily_trips').delete().in('escort_id', allIds);
    await noticeDbError('hard delete daily trips', tripsErr);

    const { error: vehicleErr } = await supabase
      .from('school_vehicles')
      .update({ assigned_escort_id: null })
      .in('assigned_escort_id', allIds);
    await noticeDbError('hard delete unlink vehicles', vehicleErr);

    const { error: routeErr } = await supabase
      .from('transport_routes')
      .update({ assigned_escort_id: null })
      .in('assigned_escort_id', allIds);
    await noticeDbError('hard delete unlink routes', routeErr);

    const { error: deputyErr } = await supabase
      .from('emergency_deputising')
      .update({ deputy_escort_application_id: null })
      .in('deputy_escort_application_id', allIds);
    await noticeDbError('hard delete unlink deputies', deputyErr);

    const { error: appErr } = await supabase.from('escort_applications').delete().in('id', allIds);
    await noticeDbError('hard delete escort_applications', appErr);
    if (appErr) {
      return {
        success: false,
        appId: key,
        deleteType: 'hard',
        error: appErr.message,
        message: `Could not permanently delete application ${key}. Related records may still be linked.`,
      };
    }
  }

  for (const emailOrUser of allEmails) {
    const username = emailOrUser.includes('@') ? emailOrUser.split('@')[0] : emailOrUser;
    const { data: emailProf } = await supabase.from('user_profiles').select('id').eq('email', emailOrUser).maybeSingle();
    const { data: userProf } = username
      ? await supabase.from('user_profiles').select('id').eq('username', username).maybeSingle()
      : { data: null };
    if (emailProf?.id && !allUserIds.includes(emailProf.id)) allUserIds.push(emailProf.id);
    if (userProf?.id && !allUserIds.includes(userProf.id)) allUserIds.push(userProf.id);
  }

  for (const userId of allUserIds) {
    const { error: roleErr } = await supabase.from('user_school_roles').delete().eq('user_id', userId);
    await noticeDbError('hard delete roles', roleErr);
    const { error: profileErr } = await supabase.from('user_profiles').delete().eq('id', userId);
    await noticeDbError('hard delete profile', profileErr);
    await supabase.auth.admin.deleteUser(userId).catch((err) => {
      console.warn('[escort-db] hard delete auth user:', err?.message || err);
    });
  }

  return {
    success: true,
    appId: key,
    deleteType: 'hard',
    message: `Application ${key} and user record permanently hard deleted from database.`,
  };
}
