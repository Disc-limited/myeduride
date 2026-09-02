// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth/auth-server';
import { getAdminClient } from '@/lib/supabase/admin';
import { ensureAuthUser, ensureUserProfile } from '@/lib/auth/ensure-user';
import { nowUtcIso } from '@/lib/utils/time';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request);
    const body = await request.json();

    const schoolId =
      body?.schoolId ||
      body?.sessionUser?.schoolId ||
      session?.primary_school_id ||
      session?.primary_school?.id ||
      session?.roles?.find((r: any) => r.school_id)?.school_id ||
      session?.school_id ||
      '00000000-0000-0000-0000-000000000001';

    const {
      fullName,
      nationality = 'Nigerian',
      dob,
      religion,
      phone,
      bloodGroup,
      email,
      closestLandmark,
      residentialAddress,
      lga,
      state = 'Lagos',
      emergencyContactName,
      emergencyContactPhone,
      maritalStatus,
      childrenCount,
      photo,
      passportDocUrl,
      facialScanToken,
      fingerprintToken,
      qualification,
      languages,
      experienceYears,
      previousEmployment,
      // Step 2: IDs & Legal
      nin,
      driversLicence,
      driversLicenceDocUrl,
      policeClearanceDocUrl,
      medicalFitnessDocUrl,
      // Step 3: Employment & Assignments
      employmentType = 'Full-Time',
      assignedVehicleId,
      assignedRouteId,
      // Login Credentials (NEW)
      username,
      password,
      requirePasswordChange = true,
      sendCredentials = true,
    } = body;

    if (!fullName || !phone) {
      return NextResponse.json({ error: 'Full name and phone number are required' }, { status: 400 });
    }

    const supabase = getAdminClient();

    // Fetch school name from database
    let schoolName = session?.primary_school?.name || (session as any)?.school_name || null;
    if (!schoolName && schoolId) {
      try {
        const { data: schoolRow } = await supabase.from('schools').select('name').eq('id', schoolId).maybeSingle();
        if (schoolRow?.name) schoolName = schoolRow.name;
      } catch {
        // fallback
      }
    }
    if (!schoolName) schoolName = 'Registered School Campus';

    // 1. Create or link Auth User & User Profile
    const finalUsername = (username || `escort.${fullName.toLowerCase().replace(/[^a-z0-9]/g, '')}`).slice(0, 30);
    const finalPassword = password || `EduRide#${Math.floor(1000 + Math.random() * 9000)}`;

    const authResult = await ensureAuthUser(supabase, {
      username: finalUsername,
      email: email || null,
      full_name: fullName,
      password: finalPassword,
    });

    if (authResult.error || !authResult.userId) {
      return NextResponse.json({ error: authResult.error || 'Failed to create escort login account' }, { status: 400 });
    }

    const userId = authResult.userId;

    // 2. Ensure user profile exists
    await ensureUserProfile(supabase, {
      id: userId,
      username: authResult.username || finalUsername,
      full_name: fullName,
      email: email || `${finalUsername}@myeduride.internal`,
      phone: phone || null,
    });

    try {
      await supabase.from('user_profiles').update({
        avatar_url: photo || null,
        role: 'escort',
        primary_school_id: schoolId,
        must_change_password: requirePasswordChange,
        status: 'active',
        updated_at: nowUtcIso(),
      }).eq('id', userId);
    } catch {
      // non-blocking
    }

    try {
      await supabase.from('user_school_roles').upsert(
        {
          user_id: userId,
          school_id: schoolId,
          role: 'staff',
          is_active: true,
        },
        { onConflict: 'user_id,school_id,role' }
      );
    } catch {
      // non-blocking
    }

    // 3. Insert or update escort_applications
    const escortCode = `ESC-${Math.floor(1000 + Math.random() * 9000)}`;
    const appPayload = {
      id: userId,
      appId: userId,
      escortIdCode: escortCode,
      escort_code: escortCode,
      fullName,
      name: fullName,
      email: email || `${finalUsername}@myeduride.internal`,
      emailOrUsername: email || finalUsername,
      phone,
      dob,
      nationality,
      religion,
      bloodGroup,
      closestLandmark,
      residentialAddress,
      lga,
      state: state || 'Lagos',
      city: lga || state || 'Lagos',
      operatingArea: lga ? `${lga}, Lagos` : 'Lagos Mainland',
      operating_area: lga ? `${lga}, Lagos` : 'Lagos Mainland',
      emergencyContactName,
      emergencyContactPhone,
      maritalStatus,
      childrenCount,
      photo,
      passportDocUrl,
      facialScanToken,
      fingerprintToken,
      qualification,
      languages,
      experienceYears,
      previousEmployment,
      nin,
      driversLicence,
      driversLicenceDocUrl,
      policeClearanceDocUrl,
      medicalFitnessDocUrl,
      employmentType,
      assignedVehicleId,
      assignedRouteId,
      createdBySchoolId: schoolId,
      schoolId,
      createdBySchoolName: schoolName,
      schoolName,
      createdRole: 'school_admin',
      escortCategory: 'school_escort',
      categoryLabel: 'School Escort',
      status: 'PENDING_CITY_MANAGER_REVIEW',
      createdAt: nowUtcIso(),
      registrationDate: new Date().toISOString().split('T')[0],
    };

    const { data: escortRecord, error: escortError } = await supabase
      .from('escort_applications')
      .upsert(
        {
          id: userId,
          user_id: userId,
          escort_code: escortCode,
          full_name: fullName,
          nationality,
          dob: dob || null,
          religion: religion || null,
          phone,
          blood_group: bloodGroup || null,
          email: email || `${finalUsername}@myeduride.internal`,
          closest_landmark: closestLandmark || null,
          residential_address: residentialAddress || null,
          lga: lga || null,
          state: state || 'Lagos',
          city: lga || state || 'Lagos',
          operating_area: lga ? `${lga}, Lagos` : 'Lagos Mainland',
          emergency_contact_name: emergencyContactName || null,
          emergency_contact_phone: emergencyContactPhone || null,
          marital_status: maritalStatus || null,
          number_of_children: childrenCount ? Number(childrenCount) : 0,
          photo: photo || null,
          passport_doc_url: passportDocUrl || null,
          facial_scan_token: facialScanToken || null,
          fingerprint_token: fingerprintToken || null,
          highest_qualification: qualification || null,
          languages_spoken: languages || null,
          years_of_experience: experienceYears ? Number(experienceYears) : 0,
          previous_employment: previousEmployment || null,
          nin: nin || null,
          drivers_licence_number: driversLicence || null,
          drivers_licence_doc_url: driversLicenceDocUrl || null,
          police_clearance_doc_url: policeClearanceDocUrl || null,
          medical_fitness_doc_url: medicalFitnessDocUrl || null,
          employment_type: employmentType,
          vehicle_id: assignedVehicleId || null,
          primary_route_id: assignedRouteId || null,
          school_id: schoolId,
          primary_school_id: schoolId,
          status: 'PENDING_CITY_MANAGER_REVIEW',
          availability_status: 'available',
          application_data: JSON.stringify(appPayload),
          created_at: nowUtcIso(),
          updated_at: nowUtcIso(),
        },
        { onConflict: 'id' }
      )
      .select()
      .maybeSingle();

    if (escortError) {
      console.error('[escorts/create] escort_applications error:', escortError);
    }

    // Sync to file store fallback
    try {
      const fs = await import('fs');
      const path = await import('path');
      const storePath = path.join(process.cwd(), 'src', 'lib', 'escort', 'escort-store.json');
      let currentList: any[] = [];
      if (fs.existsSync(storePath)) {
        currentList = JSON.parse(fs.readFileSync(storePath, 'utf-8'));
      }
      currentList = currentList.filter((a) => a.id !== userId && a.emailOrUsername !== (email || finalUsername));
      currentList.unshift(appPayload);
      fs.writeFileSync(storePath, JSON.stringify(currentList, null, 2), 'utf-8');
    } catch (storeErr) {
      console.warn('[escorts/create] store save notice:', storeErr);
    }

    // 4. Also register escort into Staff list (`teacher_profiles` / `staff`)
    try {
      await supabase.from('teacher_profiles').upsert(
        {
          user_id: userId,
          school_id: schoolId,
          teacher_responsibility: 'School Transit Escort Officer',
          status: 'active',
          updated_at: nowUtcIso(),
        },
        { onConflict: 'user_id' }
      );
    } catch (staffErr) {
      console.warn('[escorts/create] staff linkage notice:', staffErr);
    }

    // 5. If route was assigned, link escort to route in transport_routes
    if (assignedRouteId) {
      try {
        await supabase
          .from('transport_routes')
          .update({
            assigned_escort_id: userId,
            assigned_vehicle_id: assignedVehicleId || undefined,
            updated_at: nowUtcIso(),
          })
          .eq('id', assignedRouteId);
      } catch (routeErr) {
        console.warn('[escorts/create] route update notice:', routeErr);
      }
    }

    // 6. Return response with generated credentials and escort ID
    return NextResponse.json({
      success: true,
      message: 'Escort created and onboarded successfully!',
      escortId: userId,
      escort: {
        id: userId,
        fullName,
        username: authResult.username || finalUsername,
        temporaryPassword: finalPassword,
        phone,
        email,
        role: 'escort',
        schoolId,
        status: 'approved',
      },
      credentials: {
        username: authResult.username || finalUsername,
        temporaryPassword: finalPassword,
        loginUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'https://myeduride.com'}/login`,
      },
      timestamp: nowUtcIso(),
    });
  } catch (err: any) {
    console.error('[escorts/create POST] Error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
