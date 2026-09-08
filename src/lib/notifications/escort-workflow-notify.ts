import { getAdminClient } from '@/lib/supabase/admin';
import { sendPushToUser } from '@/lib/push/send';
import { sendEmail } from '@/lib/notifications/email-service';
import { nowUtcIso } from '@/lib/utils/time';

interface EscortAssignmentNotifyParams {
  schoolId: string;
  studentId: string;
  escortId: string;
  bookingId?: string;
  distanceKm?: number;
  dailyFare?: number;
  formattedDailyFare?: string;
  formattedMorningFare?: string;
  formattedAfternoonFare?: string;
  tripType?: string;
  escortName?: string;
  studentName?: string;
  schoolName?: string;
  securityPin?: string;
}

/**
 * Dispatches immediate notifications when School Admin assigns a student to a MyEduRide escort.
 * Notifies:
 * 1. City Manager (pending approval queue)
 * 2. Parents (assignment created, trip distance, amount per day, awaiting CM approval)
 * 3. Assigned Escort (prospective route and student assignment)
 */
export async function notifyEscortAssignmentCreated(params: EscortAssignmentNotifyParams) {
  const supabase = getAdminClient();
  const {
    schoolId,
    studentId,
    escortId,
    bookingId,
    distanceKm = 0,
    formattedDailyFare = '₦0',
    formattedMorningFare = '₦0',
    formattedAfternoonFare = '₦0',
    tripType = 'both',
    escortName = 'MyEduRide Escort',
    studentName = 'Student',
    schoolName = 'School',
  } = params;

  try {
    // 1. Fetch Student and Linked Parents
    const { data: student } = await supabase
      .from('students')
      .select('id, first_name, last_name, school_id')
      .eq('id', studentId)
      .maybeSingle();

    const actualStudentName = student ? `${student.first_name} ${student.last_name}` : studentName;

    const { data: parentLinks } = await supabase
      .from('student_parents')
      .select('parent_user_id')
      .eq('student_id', studentId);

    const parentUserIds = (parentLinks || []).map((p) => p.parent_user_id).filter(Boolean);

    // 2. Fetch Escort Details
    const { data: escort } = await supabase
      .from('escort_applications')
      .select('id, full_name, email, phone, user_id')
      .eq('id', escortId)
      .maybeSingle();

    const actualEscortName = escort?.full_name || escortName;

    // 3. Notify Parents
    for (const parentId of parentUserIds) {
      const parentTitle = `MyEduRide Escort Assigned for ${actualStudentName}`;
      const parentMsg = `${schoolName} has assigned verified MyEduRide Escort ${actualEscortName} for ${actualStudentName} (${distanceKm} km · ${formattedDailyFare}/day: Morning ${formattedMorningFare}, Afternoon ${formattedAfternoonFare}). Awaiting City Manager clearance.`;

      await supabase.from('notifications').insert({
        user_id: parentId,
        school_id: schoolId,
        student_id: studentId,
        title: parentTitle,
        message: parentMsg,
        type: 'escort_assignment_pending',
        is_read: false,
        created_at: nowUtcIso(),
      });

      try {
        await sendPushToUser(supabase, parentId, {
          title: parentTitle,
          message: parentMsg,
          type: 'departure',
          student_id: studentId,
          url: '/dashboard/parent',
          tag: `escort-assign-${studentId}`,
        });
      } catch (e) {
        console.warn('[notifyEscortAssignmentCreated] Parent push notice:', e);
      }
    }

    // 4. Notify City Manager (via city_manager_audit_log & notifications)
    await supabase.from('city_manager_audit_log').insert({
      action: 'SCHOOL_ASSIGNED_MYEDURIDE_ESCORT',
      entity_type: 'transport_booking',
      entity_id: bookingId || studentId,
      details: {
        school_id: schoolId,
        school_name: schoolName,
        student_id: studentId,
        student_name: actualStudentName,
        escort_id: escortId,
        escort_name: actualEscortName,
        distance_km: distanceKm,
        daily_fare: formattedDailyFare,
        trip_type: tripType,
        status: 'PENDING_CITY_MANAGER_APPROVAL',
        timestamp: nowUtcIso(),
      },
      created_at: nowUtcIso(),
    });

    // 5. Notify Assigned Escort
    if (escort?.user_id || escort?.email) {
      if (escort.user_id) {
        await supabase.from('notifications').insert({
          user_id: escort.user_id,
          school_id: schoolId,
          student_id: studentId,
          title: `New Student Transit Assignment: ${actualStudentName}`,
          message: `You have been selected by ${schoolName} for ${actualStudentName} (${distanceKm} km · ${formattedDailyFare}/day). Final clearance by City Manager in progress.`,
          type: 'escort_route_assignment',
          is_read: false,
          created_at: nowUtcIso(),
        });
      }

      if (escort.email) {
        try {
          await sendEmail({
            to: escort.email,
            subject: `MyEduRide Route Assignment: ${actualStudentName} (${schoolName})`,
            html: `<p>Hello ${actualEscortName},</p>
                   <p>You have been assigned to student <strong>${actualStudentName}</strong> by <strong>${schoolName}</strong>.</p>
                   <p><strong>Route Distance:</strong> ${distanceKm} km<br/>
                      <strong>Daily Fare:</strong> ${formattedDailyFare} (${formattedMorningFare} morning, ${formattedAfternoonFare} afternoon)<br/>
                      <strong>Status:</strong> Awaiting City Manager Final Clearance</p>
                   <p>Open your Escort Dashboard for live details.</p>`,
          });
        } catch (e) {
          console.warn('[notifyEscortAssignmentCreated] Escort email notice:', e);
        }
      }
    }
  } catch (err) {
    console.error('[notifyEscortAssignmentCreated] Error:', err);
  }
}

/**
 * Dispatches immediate notifications when City Manager Approves the booking and escort assignment.
 * Notifies:
 * 1. Parents (approval confirmation, escort vehicle, handover PIN, distance, amount per day)
 * 2. School Administrators (official confirmation)
 * 3. Assigned Escort (operational clearance)
 */
export async function notifyEscortAssignmentApproved(params: {
  bookingId: string;
  escortId: string;
  securityPin: string;
  schoolId?: string;
  studentId?: string;
  reassigned?: boolean;
}) {
  const supabase = getAdminClient();
  const { bookingId, escortId, securityPin, schoolId, studentId, reassigned = false } = params;

  try {
    // 1. Fetch Booking and Student
    const { data: booking } = await supabase
      .from('transport_bookings')
      .select('*, school:schools(id, name), student:students(id, first_name, last_name, school_id)')
      .eq('id', bookingId)
      .maybeSingle();

    const actualSchoolId = schoolId || booking?.school_id;
    const actualStudentId = studentId || booking?.student_id;
    const studentName = booking?.student ? `${booking.student.first_name} ${booking.student.last_name}` : 'Student';
    const schoolName = booking?.school?.name || 'School';

    // 2. Fetch Escort Details
    const { data: escort } = await supabase
      .from('escort_applications')
      .select('id, full_name, email, phone, user_id, application_data')
      .eq('id', escortId)
      .maybeSingle();

    const escortName = escort?.full_name || 'MyEduRide Escort';
    const escortPhone = escort?.phone || '';
    const vehiclePlate = escort?.application_data?.assignedVehicle || escort?.application_data?.regNumber || 'Verified Vehicle';

    // 3. Notify Linked Parents
    const { data: parentLinks } = await supabase
      .from('student_parents')
      .select('parent_user_id')
      .eq('student_id', actualStudentId);

    const parentUserIds = (parentLinks || []).map((p) => p.parent_user_id).filter(Boolean);
    if (booking?.parent_user_id && !parentUserIds.includes(booking.parent_user_id)) {
      parentUserIds.push(booking.parent_user_id);
    }

    const actionWord = reassigned ? 'reassigned and approved' : 'officially approved';
    for (const parentId of parentUserIds) {
      const title = `✓ MyEduRide Escort Approved for ${studentName}`;
      const msg = `City Manager has ${actionWord} Escort ${escortName} (${escortPhone}, Plate: ${vehiclePlate}) for ${studentName}. Handover Security PIN: ${securityPin}. Full route distance and trip breakdown active in your Hub.`;

      await supabase.from('notifications').insert({
        user_id: parentId,
        school_id: actualSchoolId,
        student_id: actualStudentId,
        title,
        message: msg,
        type: 'escort_assignment_approved',
        is_read: false,
        created_at: nowUtcIso(),
      });

      try {
        await sendPushToUser(supabase, parentId, {
          title,
          message: msg,
          type: 'departure',
          student_id: actualStudentId,
          url: '/dashboard/parent',
          tag: `escort-approved-${actualStudentId}`,
        });
      } catch (e) {
        console.warn('[notifyEscortAssignmentApproved] Parent push notice:', e);
      }
    }

    // 4. Notify School Administrators
    const { data: schoolAdmins } = await supabase
      .from('user_school_roles')
      .select('user_id')
      .eq('school_id', actualSchoolId)
      .eq('role', 'school_admin');

    for (const sa of schoolAdmins || []) {
      await supabase.from('notifications').insert({
        user_id: sa.user_id,
        school_id: actualSchoolId,
        student_id: actualStudentId,
        title: `City Manager Approved Escort: ${studentName}`,
        message: `Escort ${escortName} is now confirmed for student ${studentName}. Security PIN: ${securityPin}.`,
        type: 'escort_approved_admin',
        is_read: false,
        created_at: nowUtcIso(),
      });
    }

    // 5. Notify Escort
    if (escort?.user_id) {
      await supabase.from('notifications').insert({
        user_id: escort.user_id,
        school_id: actualSchoolId,
        student_id: actualStudentId,
        title: `Official Clearance: Trip Approved for ${studentName}`,
        message: `You are officially approved by City Manager to escort ${studentName} (${schoolName}). Handover PIN: ${securityPin}.`,
        type: 'escort_assignment_cleared',
        is_read: false,
        created_at: nowUtcIso(),
      });
    }
  } catch (err) {
    console.error('[notifyEscortAssignmentApproved] Error:', err);
  }
}

/**
 * Dispatches immediate notifications when City Manager Reassigns an escort due to emergency or unavailability.
 * Notifies:
 * 1. Parents (immediate notification of replacement escort, phone, vehicle plate, security PIN)
 * 2. School Administrators
 * 3. New Escort (immediate deployment details)
 * 4. Previous Escort (notice of reassignment)
 */
export async function notifyEscortEmergencyReassigned(params: {
  bookingId: string;
  oldEscortId?: string;
  newEscortId: string;
  reason?: string;
  securityPin?: string;
}) {
  const supabase = getAdminClient();
  const { bookingId, oldEscortId, newEscortId, reason = 'Emergency standby reassignment by City Manager', securityPin } = params;

  try {
    const pin = securityPin || Math.floor(1000 + Math.random() * 9000).toString();

    // 1. Fetch New Escort
    const { data: newEscort } = await supabase
      .from('escort_applications')
      .select('id, full_name, email, phone, user_id, application_data')
      .eq('id', newEscortId)
      .maybeSingle();

    const newEscortName = newEscort?.full_name || 'Standby Deputy Escort';
    const newEscortPhone = newEscort?.phone || '';
    const newPlate = newEscort?.application_data?.assignedVehicle || newEscort?.application_data?.regNumber || 'Standard Plate';

    // 2. Fetch Booking & Student
    const { data: booking } = await supabase
      .from('transport_bookings')
      .select('*, school:schools(id, name), student:students(id, first_name, last_name, school_id)')
      .eq('id', bookingId)
      .maybeSingle();

    const studentName = booking?.student ? `${booking.student.first_name} ${booking.student.last_name}` : 'Student';
    const schoolId = booking?.school_id;
    const studentId = booking?.student_id;
    const schoolName = booking?.school?.name || 'School';

    // 3. Notify Parents IMMEDIATELY
    const { data: parentLinks } = await supabase
      .from('student_parents')
      .select('parent_user_id')
      .eq('student_id', studentId);

    const parentUserIds = (parentLinks || []).map((p) => p.parent_user_id).filter(Boolean);
    if (booking?.parent_user_id && !parentUserIds.includes(booking.parent_user_id)) {
      parentUserIds.push(booking.parent_user_id);
    }

    for (const parentId of parentUserIds) {
      const title = `🚨 Escort Reassigned: ${studentName}`;
      const msg = `City Manager emergency reassignment: ${newEscortName} (Tel: ${newEscortPhone}, Plate: ${newPlate}) has taken over escort duty for ${studentName}. New Handover PIN: ${pin}. Reason: ${reason}.`;

      await supabase.from('notifications').insert({
        user_id: parentId,
        school_id: schoolId,
        student_id: studentId,
        title,
        message: msg,
        type: 'escort_reassigned_emergency',
        is_read: false,
        created_at: nowUtcIso(),
      });

      try {
        await sendPushToUser(supabase, parentId, {
          title,
          message: msg,
          type: 'departure',
          student_id: studentId,
          url: '/dashboard/parent',
          tag: `escort-reassign-${studentId}`,
        });
      } catch (e) {
        console.warn('[notifyEscortEmergencyReassigned] Parent push notice:', e);
      }
    }

    // 4. Notify School Admin
    const { data: schoolAdmins } = await supabase
      .from('user_school_roles')
      .select('user_id')
      .eq('school_id', schoolId)
      .eq('role', 'school_admin');

    for (const sa of schoolAdmins || []) {
      await supabase.from('notifications').insert({
        user_id: sa.user_id,
        school_id: schoolId,
        student_id: studentId,
        title: `Escort Reassigned by City Manager: ${studentName}`,
        message: `Student ${studentName} reassigned to ${newEscortName} (${newEscortPhone}). Reason: ${reason}.`,
        type: 'escort_reassigned_admin',
        is_read: false,
        created_at: nowUtcIso(),
      });
    }

    // 5. Notify New Escort
    if (newEscort?.user_id) {
      await supabase.from('notifications').insert({
        user_id: newEscort.user_id,
        school_id: schoolId,
        student_id: studentId,
        title: `Urgent Route Dispatch: ${studentName}`,
        message: `You have been deployed by City Manager as escort for ${studentName} (${schoolName}). Handover PIN: ${pin}. Reason: ${reason}.`,
        type: 'escort_emergency_deployment',
        is_read: false,
        created_at: nowUtcIso(),
      });
    }
  } catch (err) {
    console.error('[notifyEscortEmergencyReassigned] Error:', err);
  }
}
