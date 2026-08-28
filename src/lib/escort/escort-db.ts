import fs from 'fs';
import path from 'path';
import { getAdminClient } from '@/lib/supabase/admin';
import { ensureAuthUser, ensureUserProfile } from '@/lib/auth/ensure-user';

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
  status?: string;
  createdAt?: string;
};

// File path for persistent local store fallback
const DATA_FILE = path.join(process.cwd(), 'src', 'lib', 'escort', 'escort-store.json');

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

function saveFileStore(apps: EscortApplicationData[]) {
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
export async function getEscortApplications(city?: string) {
  let allApps: any[] = [];

  // 1. Fetch from Supabase Database (escort_applications)
  try {
    const supabase = getAdminClient();
    const { data, error } = await supabase
      .from('escort_applications')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data && data.length > 0) {
      allApps = data.map((row) => {
        const parsed = row.application_data ? JSON.parse(row.application_data) : {};
        return {
          id: row.id,
          name: row.full_name || parsed.fullName,
          email: row.email || parsed.emailOrUsername,
          phone: row.phone || parsed.phone,
          nin: row.nin || parsed.nin,
          status: row.status,
          city: row.city || parsed.city || null,
          state: row.state || parsed.state || null,
          registrationDate: row.created_at ? row.created_at.split('T')[0] : new Date().toISOString().split('T')[0],
          ...parsed,
        };
      });
    }
  } catch (err) {
    console.warn('[escort-db] Supabase fetch fallback to memory:', err);
  }

  // 2. Merge in file store applications
  const fileRecords = loadFileStore();
  fileRecords.forEach((fileRec) => {
    if (!allApps.some((a) => a.id === fileRec.id || (fileRec.emailOrUsername && a.email === fileRec.emailOrUsername))) {
      allApps.push({
        id: fileRec.id,
        name: fileRec.fullName,
        email: fileRec.emailOrUsername,
        phone: fileRec.phone,
        nin: fileRec.nin,
        status: fileRec.status || 'PENDING_CITY_MANAGER_REVIEW',
        city: fileRec.city || null,
        state: fileRec.state || null,
        registrationDate: fileRec.createdAt || new Date().toISOString().split('T')[0],
        ...fileRec,
      });
    }
  });


  // NOTE: Step 3 (auto-recovery from user_profiles) has been intentionally removed.
  // Only real escort applications submitted via the registration wizard are shown.


  // 4. Normalize nested objects for City Manager Vetting UI
  allApps = allApps.map((app) => ({
    ...app,
    // School metadata
    createdBySchoolName: app.createdBySchoolName || app.schoolName || null,
    createdBySchoolId: app.createdBySchoolId || app.schoolId || null,
    // Build real vehicle object from flat fields if nested vehicle object absent
    vehicle: app.vehicle || (
      (app.regNumber || app.vehicleType || app.make || app.model)
        ? {
            regNumber: app.regNumber || null,
            type: app.vehicleType || null,
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
    // Real uploaded document details only — null if not submitted
    uploadedDocDetails: app.uploadedDocDetails || null,
    // Submission date timestamp
    registrationDate: app.registrationDate || app.created_at?.split('T')[0] || app.createdAt || new Date().toISOString().split('T')[0],
  }));

  // 5. Smart city filter matching
  if (city && city.trim() && city.toLowerCase() !== 'all') {
    const targetCity = city.toLowerCase().trim();
    const filtered = allApps.filter((app) => {
      const appCity = (app.city || '').toLowerCase().trim();
      const appState = (app.state || '').toLowerCase().trim();
      const appArea = (app.operatingArea || '').toLowerCase().trim();

      if (appCity.includes(targetCity) || targetCity.includes(appCity)) return true;
      if (appArea.includes(targetCity) || targetCity.includes(appArea)) return true;

      if (targetCity.includes('lagos') && (appCity.includes('lagos') || appState.includes('lagos') || appCity === 'lekki' || appCity === 'ikeja' || appCity === 'victoria island' || appCity === 'surulere')) {
        return true;
      }
      if (targetCity.includes('abuja') && (appCity.includes('abuja') || appState.includes('abuja'))) {
        return true;
      }
      return false;
    });

    if (filtered.length > 0) return filtered;
  }

  return allApps;
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
      if (extraData.uploadedDocDetails) {
        (found as any).uploadedDocDetails = {
          ...((found as any).uploadedDocDetails || {}),
          ...extraData.uploadedDocDetails,
        };
      }
      if (extraData.isResubmitted !== undefined) (found as any).isResubmitted = extraData.isResubmitted;
      if (extraData.nin) (found as any).nin = extraData.nin;
      if (extraData.photo) (found as any).photo = extraData.photo;
    }
    saveFileStore(fileRecords);
  }

  const memoryFound = memoryEscortApplications.find((a: any) => a.id === appId);
  if (memoryFound) {
    memoryFound.status = status;
    if (extraData) {
      if (extraData.uploadedDocDetails) {
        (memoryFound as any).uploadedDocDetails = {
          ...((memoryFound as any).uploadedDocDetails || {}),
          ...extraData.uploadedDocDetails,
        };
      }
      if (extraData.isResubmitted !== undefined) (memoryFound as any).isResubmitted = extraData.isResubmitted;
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

    let appDataObj: any = dbRow?.application_data ? JSON.parse(dbRow.application_data) : (found || {});
    appDataObj.status = status;
    if (notes !== undefined) appDataObj.notes = notes;
    if (extraData) {
      if (extraData.uploadedDocDetails) {
        appDataObj.uploadedDocDetails = {
          ...(appDataObj.uploadedDocDetails || {}),
          ...extraData.uploadedDocDetails,
        };
      }
      if (extraData.isResubmitted !== undefined) appDataObj.isResubmitted = extraData.isResubmitted;
      if (extraData.nin) appDataObj.nin = extraData.nin;
    }

    const updatePayload: Record<string, any> = {
      status,
      updated_at: new Date().toISOString(),
      notes,
      application_data: JSON.stringify(appDataObj),
    };
    if (extraData?.nin) updatePayload.nin = extraData.nin;

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
          // Assign active 'driver' role
          await supabase.from('user_school_roles').upsert(
            { user_id: prof.id, role: 'driver', is_active: true },
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

/**
 * Delete Escort Application & User Record (Soft Delete or Hard Delete)
 */
export async function deleteEscortApplication(
  appId: string,
  deleteType: 'soft' | 'hard' = 'soft'
) {
  const supabase = getAdminClient();
  const fileRecords = loadFileStore();
  const targetApp = fileRecords.find((a: any) => a.id === appId || a.emailOrUsername === appId || a.email === appId);

  if (deleteType === 'soft') {
    // SOFT DELETE: Mark status as ARCHIVED & add deletedAt timestamp
    const updatedStore = fileRecords.map((a: any) => {
      if (a.id === appId || a.emailOrUsername === appId || a.email === appId) {
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

    // Update in Supabase escort_applications
    try {
      await supabase
        .from('escort_applications')
        .update({ status: 'ARCHIVED', updated_at: new Date().toISOString() })
        .eq('id', appId);
    } catch (err) {
      console.warn('[escort-db] Supabase soft delete notice:', err);
    }

    return {
      success: true,
      appId,
      deleteType: 'soft',
      message: `Application ${appId} archived (Soft Deleted) successfully.`,
    };
  }

  // HARD DELETE: Completely purge application & profile from store & DB
  const filteredStore = fileRecords.filter(
    (a: any) => a.id !== appId && a.emailOrUsername !== appId && a.email !== appId
  );
  saveFileStore(filteredStore);

  // Clear memory cache
  const memIndex = memoryEscortApplications.findIndex((a: any) => a.id === appId);
  if (memIndex !== -1) {
    memoryEscortApplications.splice(memIndex, 1);
  }

  // Hard delete from Supabase DB tables
  try {
    // Delete from escort_applications
    await supabase.from('escort_applications').delete().eq('id', appId);

    if (targetApp) {
      const emailOrUser = targetApp.emailOrUsername || (targetApp as any).email;
      if (emailOrUser) {
        // Find profile
        const { data: prof } = await supabase
          .from('user_profiles')
          .select('id')
          .or(`email.eq.${emailOrUser},username.eq.${emailOrUser.split('@')[0]}`)
          .maybeSingle();

        if (prof?.id) {
          // Delete user_school_roles
          await supabase.from('user_school_roles').delete().eq('user_id', prof.id);
          // Delete user_profiles
          await supabase.from('user_profiles').delete().eq('id', prof.id);
          // Delete Auth user
          await supabase.auth.admin.deleteUser(prof.id).catch(() => {});
        }
      }
    }
  } catch (dbErr) {
    console.warn('[escort-db] Supabase hard delete DB purge notice:', dbErr);
  }

  return {
    success: true,
    appId,
    deleteType: 'hard',
    message: `Application ${appId} and user record permanently hard deleted from database.`,
  };
}
