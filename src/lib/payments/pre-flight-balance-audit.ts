/**
 * PRE-FLIGHT BALANCE AUDIT ENGINE (PHASE 5)
 * 
 * Executes the daily 6:00 PM Night-Before Pre-Flight Balance Audit:
 * 1. Identifies tomorrow's operational school day (skipping weekends to Monday).
 * 2. Queries active student transport bookings for the operational date.
 * 3. Computes total required transport fee across all children belonging to each parent.
 * 4. Evaluates parent available wallet balance vs required daily fare.
 * 5. Dispatches dual-channel alerts:
 *    - Branch A (Credibility Confirmed): In-app notification + reassuring email.
 *    - Branch B (Low Balance Top-Up Advisory): Urgent in-app notification + top-up action email.
 */

import { getAdminClient } from '@/lib/supabase/admin';
import { TripFareEngine } from '@/lib/payments/trip-fare-engine';
import { formatKoboToNgn } from '@/lib/escort/escort-wallet';
import { sendPreFlightAuditEmail } from '@/lib/notifications/email-templates/pre-flight-balance-audit';
import { APP_TIMEZONE, todayInLagos } from '@/lib/timezone';

export interface NextSchoolDayInfo {
  dateStr: string; // YYYY-MM-DD
  dayOfWeek: number; // 0 = Sun, 1 = Mon ...
  dayName: string; // e.g. "Monday"
  isTomorrow: boolean;
  daysAhead: number;
  formattedDisplay: string; // e.g. "Monday, 19 October 2026"
}

export interface AuditedChild {
  studentId: string;
  studentName: string;
  schoolId: string;
  schoolName: string;
  fareKobo: number;
  fareNgn: number;
  escortType?: string;
}

export interface ParentAuditResult {
  parentUserId: string;
  parentName: string;
  parentEmail: string;
  parentPhone?: string;
  walletId?: string;
  children: AuditedChild[];
  childrenNames: string;
  totalRequiredFareKobo: number;
  totalRequiredFareNgn: number;
  availableBalanceKobo: number;
  availableBalanceNgn: number;
  isConfirmed: boolean;
  shortfallKobo: number;
  shortfallNgn: number;
  status: 'CONFIRMED' | 'TOPUP_REQUIRED';
  notificationTitle: string;
  notificationMessage: string;
  emailDispatched: boolean;
  notificationRecorded: boolean;
  actionUrl?: string;
}

export interface PreFlightAuditSummary {
  success: boolean;
  dryRun: boolean;
  auditTimestamp: string;
  targetDate: string;
  targetDayName: string;
  isTomorrow: boolean;
  totalParentsAudited: number;
  totalChildrenScheduled: number;
  confirmedCount: number;
  topupRequiredCount: number;
  totalProjectedFareKobo: number;
  totalProjectedFareNgn: number;
  totalAvailableBalanceKobo: number;
  totalShortfallKobo: number;
  results: ParentAuditResult[];
  error?: string;
}

export class PreFlightBalanceAuditEngine {
  /**
   * Resolves the next operational school day (Monday - Friday) relative to a reference date.
   * If today is Friday, next school day is Monday (+3 days).
   * If today is Saturday, next school day is Monday (+2 days).
   * If today is Sunday, next school day is Monday (+1 day, tomorrow).
   * If today is Monday-Thursday, next school day is tomorrow (+1 day).
   */
  public static resolveNextOperationalSchoolDay(referenceDateStr?: string): NextSchoolDayInfo {
    const baseDateStr = referenceDateStr || todayInLagos();
    const parts = baseDateStr.split('-').map(Number);
    // Construct local midnight date
    const d = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2], 12, 0, 0));

    // Day of week: 0 = Sun, 1 = Mon, 2 = Tue, 3 = Wed, 4 = Thu, 5 = Fri, 6 = Sat
    const dayOfWeek = d.getUTCDay();

    let daysAhead = 1;
    if (dayOfWeek === 5) {
      // Friday -> Monday
      daysAhead = 3;
    } else if (dayOfWeek === 6) {
      // Saturday -> Monday
      daysAhead = 2;
    } else {
      // Sunday, Mon, Tue, Wed, Thu -> Next calendar day
      daysAhead = 1;
    }

    const targetDate = new Date(d.getTime() + daysAhead * 24 * 60 * 60 * 1000);
    const targetDateStr = targetDate.toISOString().slice(0, 10);
    const targetDayOfWeek = targetDate.getUTCDay();

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const targetDayName = dayNames[targetDayOfWeek];

    const formattedDisplay = targetDate.toLocaleDateString('en-NG', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    });

    return {
      dateStr: targetDateStr,
      dayOfWeek: targetDayOfWeek,
      dayName: targetDayName,
      isTomorrow: daysAhead === 1,
      daysAhead,
      formattedDisplay,
    };
  }

  /**
   * Helper to format a list of children's first or full names into grammatically correct string:
   * e.g. "Emeka", "Emeka and Chidinma", "Emeka, Chidinma and Zainab"
   */
  public static formatChildrenNames(children: Array<{ studentName: string }>): string {
    if (!children.length) return 'your children';
    const names = children.map((c) => c.studentName.trim());
    if (names.length === 1) return names[0];
    if (names.length === 2) return `${names[0]} and ${names[1]}`;
    return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
  }

  /**
   * Evaluates wallet balance against required fare and constructs notification copy
   * matching regulatory specifications in Phase 5.3.
   */
  public static evaluateCredibility({
    availableBalanceKobo,
    totalRequiredFareKobo,
    childrenNames,
    isTomorrow,
    dayName,
  }: {
    availableBalanceKobo: number;
    totalRequiredFareKobo: number;
    childrenNames: string;
    isTomorrow: boolean;
    dayName: string;
  }): {
    isConfirmed: boolean;
    status: 'CONFIRMED' | 'TOPUP_REQUIRED';
    shortfallKobo: number;
    shortfallNgn: number;
    title: string;
    message: string;
    actionUrl?: string;
  } {
    const isConfirmed = availableBalanceKobo >= totalRequiredFareKobo;
    const shortfallKobo = isConfirmed ? 0 : totalRequiredFareKobo - availableBalanceKobo;
    const shortfallNgn = Math.ceil(shortfallKobo / 100);

    const formattedBalance = formatKoboToNgn(availableBalanceKobo);
    const formattedFare = formatKoboToNgn(totalRequiredFareKobo);
    const timeRef = isTomorrow ? "tomorrow's" : `${dayName}'s`;

    if (isConfirmed) {
      return {
        isConfirmed: true,
        status: 'CONFIRMED',
        shortfallKobo: 0,
        shortfallNgn: 0,
        title: '✅ Escort Credibility Confirmed for Tomorrow',
        message: `Your wallet balance of ${formattedBalance} is sufficient for ${timeRef} scheduled school transport for ${childrenNames}. Your escort pickup is fully confirmed.`,
      };
    } else {
      return {
        isConfirmed: false,
        status: 'TOPUP_REQUIRED',
        shortfallKobo,
        shortfallNgn,
        title: '⚠️ Top-Up Required: Fund Wallet for Tomorrow\'s Ride',
        message: `Your MyEduRide balance is ${formattedBalance}, which is below ${timeRef} required fare of ${formattedFare}. MyEduRide operates on daily funding—please top up your wallet tonight to avoid morning pickup disruption.`,
        actionUrl: `/parent/wallet?action=fund&shortfall=${shortfallNgn}`,
      };
    }
  }

  /**
   * Primary entry point: Queries tomorrow's transport requirements and audits all parent balances.
   */
  public static async executePreFlightBalanceAudit(options?: {
    targetDate?: string;
    dryRun?: boolean;
    forceSend?: boolean;
    appUrl?: string;
  }): Promise<PreFlightAuditSummary> {
    const supabase = getAdminClient();
    const dryRun = options?.dryRun ?? false;
    const forceSend = options?.forceSend ?? false;
    const nowIso = new Date().toISOString();

    const schoolDay = this.resolveNextOperationalSchoolDay(options?.targetDate);
    const targetDateStr = schoolDay.dateStr;

    console.log(
      `[PreFlight Audit] Initiating 6:00 PM audit for ${schoolDay.formattedDisplay} (target: ${targetDateStr}, dryRun: ${dryRun})...`
    );

    try {
      // 1. Fetch active transport bookings and active assigned students
      const { data: bookings, error: bookingsErr } = await supabase
        .from('transport_bookings')
        .select(`
          id,
          student_id,
          parent_user_id,
          school_id,
          status,
          notes,
          student:students(id, first_name, last_name, is_active, school_id),
          school:schools(id, name)
        `)
        .in('status', ['active', 'assigned', 'pending']);

      if (bookingsErr) {
        console.warn('[PreFlight Audit] Warning querying transport_bookings:', bookingsErr);
      }

      // Also fetch all active students with assigned escorts directly
      const { data: activeStudents, error: stuErr } = await supabase
        .from('students')
        .select(`
          id,
          first_name,
          last_name,
          school_id,
          is_active,
          school:schools(id, name)
        `)
        .eq('is_active', true)
        .limit(200);

      if (stuErr) {
        console.warn('[PreFlight Audit] Warning querying students:', stuErr);
      }

      // 2. Fetch student-parent links
      const studentIds = new Set<string>();
      for (const b of bookings || []) {
        if (b.student_id) studentIds.add(b.student_id);
      }
      for (const s of activeStudents || []) {
        studentIds.add(s.id);
      }

      const { data: parentLinks } = await supabase
        .from('student_parents')
        .select('student_id, parent_user_id, is_primary')
        .in('student_id', Array.from(studentIds));

      // 3. Map parent to their scheduled children
      interface ParentAccumulator {
        parentUserId: string;
        childrenMap: Map<string, AuditedChild>;
      }
      const parentAccMap = new Map<string, ParentAccumulator>();

      // Process transport bookings
      for (const b of bookings || []) {
        const student = Array.isArray(b.student) ? b.student[0] : b.student;
        if (!student || student.is_active === false) continue;

        let parentId = b.parent_user_id;
        if (!parentId) {
          const link = (parentLinks || []).find((l) => l.student_id === student.id && l.is_primary)
            || (parentLinks || []).find((l) => l.student_id === student.id);
          parentId = link?.parent_user_id;
        }
        if (!parentId) continue;

        if (!parentAccMap.has(parentId)) {
          parentAccMap.set(parentId, { parentUserId: parentId, childrenMap: new Map() });
        }

        // Determine fare
        let fareKobo = TripFareEngine.DEFAULT_DAILY_FEE_KOBO;
        if (b.notes) {
          try {
            const parsedNotes = typeof b.notes === 'string' ? JSON.parse(b.notes) : b.notes;
            if (parsedNotes.daily_fare && !isNaN(Number(parsedNotes.daily_fare))) {
              fareKobo = Math.round(Number(parsedNotes.daily_fare) * 100);
            } else if (parsedNotes.fare_amount && !isNaN(Number(parsedNotes.fare_amount))) {
              fareKobo = Math.round(Number(parsedNotes.fare_amount) * 100);
            }
          } catch {
            // Keep default
          }
        }

        const school = Array.isArray(b.school) ? b.school[0] : b.school;
        const studentName = `${student.first_name || ''} ${student.last_name || ''}`.trim();

        parentAccMap.get(parentId)!.childrenMap.set(student.id, {
          studentId: student.id,
          studentName,
          schoolId: b.school_id || student.school_id,
          schoolName: school?.name || 'School Campus',
          fareKobo,
          fareNgn: fareKobo / 100,
        });
      }

      // If no bookings returned, fallback to student links for active demo/test parents
      if (parentAccMap.size === 0 && parentLinks && parentLinks.length > 0) {
        for (const link of parentLinks) {
          if (!link.parent_user_id) continue;
          const stu = (activeStudents || []).find((s) => s.id === link.student_id);
          if (!stu) continue;

          if (!parentAccMap.has(link.parent_user_id)) {
            parentAccMap.set(link.parent_user_id, { parentUserId: link.parent_user_id, childrenMap: new Map() });
          }

          const school = Array.isArray(stu.school) ? stu.school[0] : stu.school;
          const studentName = `${stu.first_name || ''} ${stu.last_name || ''}`.trim();

          parentAccMap.get(link.parent_user_id)!.childrenMap.set(stu.id, {
            studentId: stu.id,
            studentName,
            schoolId: stu.school_id,
            schoolName: school?.name || 'School Campus',
            fareKobo: TripFareEngine.DEFAULT_DAILY_FEE_KOBO,
            fareNgn: TripFareEngine.DEFAULT_DAILY_FEE_KOBO / 100,
          });
        }
      }

      const parentUserIds = Array.from(parentAccMap.keys());
      if (parentUserIds.length === 0) {
        return {
          success: true,
          dryRun,
          auditTimestamp: nowIso,
          targetDate: targetDateStr,
          targetDayName: schoolDay.dayName,
          isTomorrow: schoolDay.isTomorrow,
          totalParentsAudited: 0,
          totalChildrenScheduled: 0,
          confirmedCount: 0,
          topupRequiredCount: 0,
          totalProjectedFareKobo: 0,
          totalProjectedFareNgn: 0,
          totalAvailableBalanceKobo: 0,
          totalShortfallKobo: 0,
          results: [],
        };
      }

      // 4. Fetch parent profiles
      const { data: profiles } = await supabase
        .from('user_profiles')
        .select('id, full_name, email, phone')
        .in('id', parentUserIds);

      const profileMap = new Map<string, any>();
      for (const p of profiles || []) {
        profileMap.set(p.id, p);
      }

      // 5. Fetch parent wallets
      const { data: wallets } = await supabase
        .from('wallets')
        .select('id, user_id, entity_type, available_balance_kobo')
        .in('user_id', parentUserIds);

      const walletMap = new Map<string, any>();
      for (const w of wallets || []) {
        if (w.entity_type === 'parent' || !walletMap.has(w.user_id)) {
          walletMap.set(w.user_id, w);
        }
      }

      // Check existing audit notifications sent in last 12 hours for targetDateStr to avoid spamming
      const { data: recentNotifs } = await supabase
        .from('notifications')
        .select('id, user_id, metadata')
        .in('type', ['escort_credibility_confirmed', 'wallet_topup_required'])
        .gte('created_at', new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString());

      const alreadyNotifiedParents = new Set<string>();
      for (const rn of recentNotifs || []) {
        const meta = typeof rn.metadata === 'string' ? JSON.parse(rn.metadata) : rn.metadata;
        if (meta?.target_date === targetDateStr) {
          alreadyNotifiedParents.add(rn.user_id);
        }
      }

      // 6. Evaluate each parent
      const results: ParentAuditResult[] = [];
      let totalProjectedFareKobo = 0;
      let totalAvailableBalanceKobo = 0;
      let totalShortfallKobo = 0;
      let confirmedCount = 0;
      let topupRequiredCount = 0;
      let totalChildrenScheduled = 0;

      for (const [parentId, acc] of parentAccMap.entries()) {
        const children = Array.from(acc.childrenMap.values());
        if (!children.length) continue;

        totalChildrenScheduled += children.length;
        const totalRequiredFareKobo = children.reduce((sum, c) => sum + c.fareKobo, 0);
        const totalRequiredFareNgn = totalRequiredFareKobo / 100;

        const profile = profileMap.get(parentId);
        const wallet = walletMap.get(parentId);

        const availableBalanceKobo = wallet?.available_balance_kobo != null ? Number(wallet.available_balance_kobo) : 0;
        const availableBalanceNgn = availableBalanceKobo / 100;

        const evalResult = this.evaluateCredibility({
          availableBalanceKobo,
          totalRequiredFareKobo,
          childrenNames: this.formatChildrenNames(children),
          isTomorrow: schoolDay.isTomorrow,
          dayName: schoolDay.dayName,
        });

        totalProjectedFareKobo += totalRequiredFareKobo;
        totalAvailableBalanceKobo += availableBalanceKobo;
        totalShortfallKobo += evalResult.shortfallKobo;

        if (evalResult.isConfirmed) {
          confirmedCount++;
        } else {
          topupRequiredCount++;
        }

        const parentEmail = profile?.email || '';
        const parentName = profile?.full_name || 'MyEduRide Parent';
        const childrenNames = this.formatChildrenNames(children);

        let emailDispatched = false;
        let notificationRecorded = false;

        const shouldNotify = forceSend || !alreadyNotifiedParents.has(parentId);

        if (!dryRun && shouldNotify) {
          // A. Insert in-app notification
          try {
            await supabase.from('notifications').insert({
              user_id: parentId,
              title: evalResult.title,
              message: evalResult.message,
              type: evalResult.isConfirmed ? 'escort_credibility_confirmed' : 'wallet_topup_required',
              is_read: false,
              metadata: {
                target_date: targetDateStr,
                day_name: schoolDay.dayName,
                is_tomorrow: schoolDay.isTomorrow,
                children_count: children.length,
                children_names: childrenNames,
                required_fare_kobo: totalRequiredFareKobo,
                available_balance_kobo: availableBalanceKobo,
                shortfall_kobo: evalResult.shortfallKobo,
                action_url: evalResult.actionUrl,
                audited_at: nowIso,
              },
            });
            notificationRecorded = true;
          } catch (notifErr) {
            console.error(`[PreFlight Audit] Failed to record in-app notification for ${parentId}:`, notifErr);
          }

          // B. Dispatch rich HTML email
          if (parentEmail && parentEmail.includes('@')) {
            try {
              const emailRes = await sendPreFlightAuditEmail({
                parentName,
                parentEmail,
                targetDateFormatted: schoolDay.formattedDisplay,
                dayLabel: schoolDay.isTomorrow ? 'Tomorrow' : schoolDay.dayName,
                childrenNames,
                childrenList: children.map((c) => ({
                  name: c.studentName,
                  schoolName: c.schoolName,
                  fareNgn: c.fareNgn,
                })),
                availableBalanceNgn,
                totalRequiredFareNgn,
                shortfallNgn: evalResult.shortfallNgn,
                isConfirmed: evalResult.isConfirmed,
                appUrl: options?.appUrl,
              });
              emailDispatched = emailRes.success;
            } catch (mailErr) {
              console.error(`[PreFlight Audit] Failed to send email to ${parentEmail}:`, mailErr);
            }
          }
        }

        results.push({
          parentUserId: parentId,
          parentName,
          parentEmail,
          parentPhone: profile?.phone,
          walletId: wallet?.id,
          children,
          childrenNames,
          totalRequiredFareKobo,
          totalRequiredFareNgn,
          availableBalanceKobo,
          availableBalanceNgn,
          isConfirmed: evalResult.isConfirmed,
          shortfallKobo: evalResult.shortfallKobo,
          shortfallNgn: evalResult.shortfallNgn,
          status: evalResult.status,
          notificationTitle: evalResult.title,
          notificationMessage: evalResult.message,
          emailDispatched,
          notificationRecorded,
          actionUrl: evalResult.actionUrl,
        });
      }

      console.log(
        `[PreFlight Audit] Completed audit: ${results.length} parents (${confirmedCount} confirmed, ${topupRequiredCount} topup required). Projected fare: ₦${(
          totalProjectedFareKobo / 100
        ).toLocaleString()}`
      );

      return {
        success: true,
        dryRun,
        auditTimestamp: nowIso,
        targetDate: targetDateStr,
        targetDayName: schoolDay.dayName,
        isTomorrow: schoolDay.isTomorrow,
        totalParentsAudited: results.length,
        totalChildrenScheduled,
        confirmedCount,
        topupRequiredCount,
        totalProjectedFareKobo,
        totalProjectedFareNgn: totalProjectedFareKobo / 100,
        totalAvailableBalanceKobo,
        totalShortfallKobo,
        results,
      };
    } catch (err: any) {
      console.error('[PreFlight Audit] Critical error during audit execution:', err);
      return {
        success: false,
        dryRun,
        auditTimestamp: nowIso,
        targetDate: targetDateStr,
        targetDayName: schoolDay.dayName,
        isTomorrow: schoolDay.isTomorrow,
        totalParentsAudited: 0,
        totalChildrenScheduled: 0,
        confirmedCount: 0,
        topupRequiredCount: 0,
        totalProjectedFareKobo: 0,
        totalProjectedFareNgn: 0,
        totalAvailableBalanceKobo: 0,
        totalShortfallKobo: 0,
        results: [],
        error: err.message || String(err),
      };
    }
  }
}
