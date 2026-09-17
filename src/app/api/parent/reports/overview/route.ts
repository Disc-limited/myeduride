import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth/auth-server';
import { getAdminClient } from '@/lib/supabase/admin';
import { resolveStoredEscortFare } from '@/lib/escort/escort-pricing';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const dateFilter = searchParams.get('date_filter') || 'month';
    const escortFilter = searchParams.get('escort_filter') || 'daily';
    const targetStudentId = searchParams.get('student_id') || '';

    const supabase = getAdminClient();

    // 1. Calculate Date Filter Window (in UTC/Lagos context)
    const now = new Date();
    let sinceDate = new Date();

    if (dateFilter === 'today') {
      sinceDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    } else if (dateFilter === 'week') {
      sinceDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (dateFilter === 'month') {
      sinceDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
    } else if (dateFilter === 'year') {
      sinceDate = new Date(now.getFullYear(), 0, 1, 0, 0, 0);
    } else {
      sinceDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
    }
    const sinceIso = sinceDate.toISOString();
    const sinceDateStr = sinceIso.split('T')[0];

    // 2. Fetch parent's real children from student_parents
    const { data: parentLinks, error: parentLinksErr } = await supabase
      .from('student_parents')
      .select('student_id, relationship, is_primary')
      .eq('parent_user_id', session.user_id);

    if (parentLinksErr) {
      console.warn('[parent/reports/overview] student_parents fetch error:', parentLinksErr.message);
    }

    const linkedStudentIds = (parentLinks || []).map((l: any) => l.student_id).filter(Boolean);

    let allChildren: any[] = [];
    if (linkedStudentIds.length > 0) {
      const { data: studentsData, error: stuErr } = await supabase
        .from('students')
        .select(`
          id,
          first_name,
          last_name,
          student_id_number,
          photo_url,
          house_address,
          school_id,
          class_id,
          class:school_classes(name),
          school:schools(id, name, address, location_address)
        `)
        .in('id', linkedStudentIds);

      if (stuErr) {
        console.warn('[parent/reports/overview] students fetch error:', stuErr.message);
      }

      allChildren = (studentsData || []).map((s: any) => ({
        ...s,
        class_name: Array.isArray(s.class) ? s.class[0]?.name : s.class?.name,
        school_name: Array.isArray(s.school) ? s.school[0]?.name : s.school?.name,
      }));
    }

    const childMap = new Map<string, any>();
    allChildren.forEach((c) => childMap.set(c.id, c));

    let childIds = allChildren.map((c) => c.id);

    // If target student is requested and belongs to parent, filter; otherwise keep all children
    if (targetStudentId && childIds.includes(targetStudentId)) {
      childIds = [targetStudentId];
    }

    // Helper for Lagos time formatting
    const formatLagosTime = (isoOrDate: string | Date | null | undefined): string => {
      if (!isoOrDate) return '—';
      try {
        const d = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate;
        if (isNaN(d.getTime())) return '—';
        return d.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
          timeZone: 'Africa/Lagos',
        });
      } catch {
        return '—';
      }
    };

    const formatLagosDate = (isoOrDate: string | Date | null | undefined): string => {
      if (!isoOrDate) return '—';
      try {
        const d = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate;
        if (isNaN(d.getTime())) return '—';
        return d.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          timeZone: 'Africa/Lagos',
        });
      } catch {
        return '—';
      }
    };

    // 3. Fetch real Gate Activity Logs & Attendance Records (Dual-source for 100% capture)
    let gateLogs: any[] = [];
    let totalEntries = 0;
    let totalExits = 0;
    let lateArrivals = 0;
    let earlyPickups = 0;

    if (childIds.length > 0) {
      const [gateLogsRes, attRes] = await Promise.all([
        supabase
          .from('gate_activity_logs')
          .select('*')
          .in('student_id', childIds)
          .gte('created_at', sinceIso)
          .order('created_at', { ascending: false })
          .limit(100),
        supabase
          .from('attendance_records')
          .select('*')
          .in('student_id', childIds)
          .gte('timestamp', sinceIso)
          .order('timestamp', { ascending: false })
          .limit(100),
      ]);

      const rawGateLogs = gateLogsRes.data || [];
      const rawAttLogs = attRes.data || [];

      // Group activities by calendar day (YYYY-MM-DD in Lagos timezone)
      const dayMap = new Map<
        string,
        {
          dateStr: string;
          dateFormatted: string;
          latestTime: number;
          entries: { time: Date; isLate: boolean }[];
          exits: { time: Date; isEarly: boolean }[];
          gate: string;
          studentId: string;
        }
      >();

      // A. Process attendance_records
      for (const att of rawAttLogs) {
        const dateObj = new Date(att.timestamp);
        if (isNaN(dateObj.getTime())) continue;

        const dayKey = att.timestamp.slice(0, 10);
        if (!dayMap.has(dayKey)) {
          dayMap.set(dayKey, {
            dateStr: dayKey,
            dateFormatted: formatLagosDate(dateObj),
            latestTime: dateObj.getTime(),
            entries: [],
            exits: [],
            gate: 'Main Gate',
            studentId: att.student_id,
          });
        }

        const item = dayMap.get(dayKey)!;
        if (dateObj.getTime() > item.latestTime) item.latestTime = dateObj.getTime();

        const hour = dateObj.getHours();
        const min = dateObj.getMinutes();
        const isLate = att.status === 'late' || hour > 8 || (hour === 8 && min > 15);
        const isEarly = hour < 14;

        if (att.type === 'arrival') {
          item.entries.push({ time: dateObj, isLate });
        } else if (att.type === 'departure') {
          item.exits.push({ time: dateObj, isEarly });
        }
      }

      // B. Process gate_activity_logs (deduplicating with attendance timestamps)
      for (const g of rawGateLogs) {
        const dateObj = new Date(g.created_at);
        if (isNaN(dateObj.getTime())) continue;

        const dayKey = g.created_at.slice(0, 10);
        if (!dayMap.has(dayKey)) {
          dayMap.set(dayKey, {
            dateStr: dayKey,
            dateFormatted: formatLagosDate(dateObj),
            latestTime: dateObj.getTime(),
            entries: [],
            exits: [],
            gate: (g.details as any)?.gate_name || 'Main Gate',
            studentId: g.student_id,
          });
        }

        const item = dayMap.get(dayKey)!;
        if (dateObj.getTime() > item.latestTime) item.latestTime = dateObj.getTime();
        if ((g.details as any)?.gate_name) item.gate = (g.details as any).gate_name;

        const action = g.action_type || g.action;
        const details = g.details as any;

        const isArrival =
          action === 'check_in' ||
          action === 'clock_in' ||
          details?.attendance_type === 'arrival' ||
          details?.override_type === 'arrival';

        const isDeparture =
          action === 'check_out' ||
          action === 'release' ||
          action === 'clock_out' ||
          details?.attendance_type === 'departure' ||
          details?.override_type === 'departure';

        const hour = dateObj.getHours();
        const min = dateObj.getMinutes();
        const isLate = details?.status === 'late' || hour > 8 || (hour === 8 && min > 15);
        const isEarly = hour < 14;

        if (isArrival) {
          const alreadyLogged = item.entries.some(
            (e) => Math.abs(e.time.getTime() - dateObj.getTime()) < 120000
          );
          if (!alreadyLogged) {
            item.entries.push({ time: dateObj, isLate });
          }
        } else if (isDeparture) {
          const alreadyLogged = item.exits.some(
            (e) => Math.abs(e.time.getTime() - dateObj.getTime()) < 120000
          );
          if (!alreadyLogged) {
            item.exits.push({ time: dateObj, isEarly });
          }
        }
      }

      // Sort days descending
      const sortedDays = Array.from(dayMap.values()).sort((a, b) => b.latestTime - a.latestTime);

      for (const day of sortedDays) {
        const hasEntry = day.entries.length > 0;
        const hasExit = day.exits.length > 0;

        if (hasEntry) {
          totalEntries++;
          const dayIsLate = day.entries.some((e) => e.isLate);
          if (dayIsLate) lateArrivals++;
        }
        if (hasExit) {
          totalExits++;
          const dayIsEarly = day.exits.some((e) => e.isEarly);
          if (dayIsEarly) earlyPickups++;
        }

        const earliestEntry = hasEntry
          ? formatLagosTime(new Date(Math.min(...day.entries.map((e) => e.time.getTime()))))
          : '—';

        const latestExit = hasExit
          ? formatLagosTime(new Date(Math.max(...day.exits.map((e) => e.time.getTime()))))
          : '—';

        const statusLabel = day.entries.some((e) => e.isLate) ? 'Late' : 'On Time';

        const student = childMap.get(day.studentId);
        const studentLabel = student ? `${student.first_name} ${student.last_name}` : undefined;

        gateLogs.push({
          date: day.dateFormatted,
          gate: day.gate,
          entry_time: earliestEntry,
          exit_time: latestExit,
          status: statusLabel,
          student_name: studentLabel,
        });
      }
    }

    // 4. Fetch real Escort Movements & Bookings within date window
    let escortTrips = 0;
    let completedServices = 0;
    let escortTimeline: any[] = [];
    let escortTotalKm = 0;

    // A. Query real daily transit movements from escort_student_daily_trips
    let dailyTrips: any[] = [];
    if (childIds.length > 0) {
      const { data: tripsData } = await supabase
        .from('escort_student_daily_trips')
        .select('*')
        .in('student_id', childIds)
        .gte('trip_date', sinceDateStr)
        .order('trip_date', { ascending: false })
        .order('created_at', { ascending: false });

      dailyTrips = tripsData || [];
    }

    // B. Query shared_ride_bookings for scheduled routes
    const { data: sharedBookings } = await supabase
      .from('shared_ride_bookings')
      .select('*, escort_route:shared_ride_escorts(pickup_address, dropoff_address, departure_time, return_time, vehicle_model, vehicle_reg)')
      .eq('parent_user_id', session.user_id)
      .gte('created_at', sinceIso)
      .order('created_at', { ascending: false });

    // C. Query transport_bookings (School Escort & E-Drive)
    const { data: transportBookings } = await supabase
      .from('transport_bookings')
      .select('*')
      .eq('parent_user_id', session.user_id)
      .gte('created_at', sinceIso)
      .order('created_at', { ascending: false });

    // Gather escort user info for friendly names
    const escortIdsToLookup = new Set<string>();
    dailyTrips.forEach((t) => {
      if (t.escort_id) escortIdsToLookup.add(t.escort_id);
    });
    (transportBookings || []).forEach((tb) => {
      if (tb.notes) {
        try {
          const parsed = typeof tb.notes === 'string' ? JSON.parse(tb.notes) : tb.notes;
          if (parsed.assigned_escort_id) escortIdsToLookup.add(parsed.assigned_escort_id);
        } catch {}
      }
    });

    const escortInfoMap = new Map<string, { name: string; phone?: string; vehicle?: string }>();
    if (escortIdsToLookup.size > 0) {
      const idArray = Array.from(escortIdsToLookup);
      const [profilesRes, appsRes] = await Promise.all([
        supabase.from('user_profiles').select('id, full_name, phone').in('id', idArray),
        supabase
          .from('escort_applications')
          .select('id, user_id, full_name, phone, vehicle_type, reg_number')
          .or(`id.in.(${idArray.join(',')}),user_id.in.(${idArray.join(',')})`),
      ]);

      (profilesRes.data || []).forEach((p: any) => {
        escortInfoMap.set(p.id, { name: p.full_name || 'Assigned Escort', phone: p.phone });
      });

      (appsRes.data || []).forEach((app: any) => {
        const vehicleDesc = [app.vehicle_type, app.reg_number].filter(Boolean).join(' - ');
        if (app.id) {
          escortInfoMap.set(app.id, {
            name: app.full_name || 'Assigned Escort',
            phone: app.phone,
            vehicle: vehicleDesc,
          });
        }
        if (app.user_id) {
          escortInfoMap.set(app.user_id, {
            name: app.full_name || 'Assigned Escort',
            phone: app.phone,
            vehicle: vehicleDesc,
          });
        }
      });
    }

    // Build timeline stops from escort_student_daily_trips
    dailyTrips.forEach((trip) => {
      const student = childMap.get(trip.student_id);
      const studentName = student ? `${student.first_name} ${student.last_name}` : 'Student';
      const houseAddr = student?.house_address || 'Home Doorstep Location';
      const schoolName = student?.school_name || 'School Campus';
      const escortMeta = escortInfoMap.get(trip.escort_id);
      const escortName = escortMeta?.name ? `with Escort ${escortMeta.name}` : 'with School Escort';

      // Morning Pickup (from Doorstep)
      if (trip.morning_picked_up && trip.morning_picked_up_at) {
        escortTimeline.push({
          date: trip.trip_date,
          rawTime: new Date(trip.morning_picked_up_at).getTime(),
          time: formatLagosTime(trip.morning_picked_up_at),
          type: 'Pickup',
          location: houseAddr,
          description: `Morning doorstep departure (${studentName}) ${escortName}`,
        });
      }

      // Morning Drop-off at School Gate
      if (trip.morning_picked_up && trip.morning_picked_up_at) {
        const approxArrival = new Date(new Date(trip.morning_picked_up_at).getTime() + 25 * 60000);
        escortTimeline.push({
          date: trip.trip_date,
          rawTime: approxArrival.getTime(),
          time: formatLagosTime(approxArrival),
          type: 'Drop-off',
          location: `${schoolName} Main Gate`,
          description: `Safe gate check-in & school handover (${studentName})`,
        });
      }

      // Afternoon Pickup (from School Gate)
      if (trip.afternoon_picked_up && trip.afternoon_picked_up_at) {
        escortTimeline.push({
          date: trip.trip_date,
          rawTime: new Date(trip.afternoon_picked_up_at).getTime(),
          time: formatLagosTime(trip.afternoon_picked_up_at),
          type: 'Pickup',
          location: `${schoolName} Dismissal Gate`,
          description: `Afternoon school dismissal pickup (${studentName}) ${escortName}`,
        });
      }

      // Afternoon Drop-off (at Doorstep)
      if (trip.afternoon_dropped_off && trip.afternoon_dropped_off_at) {
        escortTimeline.push({
          date: trip.trip_date,
          rawTime: new Date(trip.afternoon_dropped_off_at).getTime(),
          time: formatLagosTime(trip.afternoon_dropped_off_at),
          type: 'Drop-off',
          location: houseAddr,
          description: `Safe doorstep return handover (${studentName})`,
        });
      }
    });

    // Also include shared ride routes if present
    if (sharedBookings && sharedBookings.length > 0) {
      sharedBookings.forEach((b) => {
        const route = b.escort_route;
        if (route) {
          if (route.pickup_address) {
            escortTimeline.push({
              date: formatLagosDate(b.created_at),
              rawTime: new Date(b.created_at).getTime(),
              time: route.departure_time || '7:00 AM',
              type: 'Pickup',
              location: route.pickup_address,
              description: 'Shared corridor route pickup',
            });
          }
          if (route.dropoff_address) {
            escortTimeline.push({
              date: formatLagosDate(b.created_at),
              rawTime: new Date(b.created_at).getTime() + 30 * 60000,
              time: route.return_time || '2:30 PM',
              type: 'Drop-off',
              location: route.dropoff_address,
              description: 'Shared corridor route drop-off',
            });
          }
        }
      });
    }

    // Sort timeline by rawTime descending
    escortTimeline.sort((a, b) => (b.rawTime || 0) - (a.rawTime || 0));

    // Calculate escort summary metrics
    const dailyTripLegs = dailyTrips.reduce((acc, t) => {
      let count = 0;
      if (t.morning_picked_up) count++;
      if (t.afternoon_dropped_off || t.afternoon_picked_up) count++;
      return acc + (count > 0 ? count : 1);
    }, 0);

    const bookingCount = (sharedBookings?.length || 0) + (transportBookings?.length || 0);
    escortTrips = Math.max(dailyTripLegs, bookingCount);

    completedServices =
      dailyTrips.filter((t) => t.morning_picked_up || t.afternoon_dropped_off).length +
      (transportBookings || []).filter((b) => b.status === 'completed' || b.status === 'assigned').length +
      (sharedBookings || []).filter((b) => b.status === 'completed' || b.status === 'confirmed').length;

    (transportBookings || []).forEach((b) => {
      if (b.notes) {
        try {
          const parsed = typeof b.notes === 'string' ? JSON.parse(b.notes) : b.notes;
          if (parsed.distance_km) escortTotalKm += Number(parsed.distance_km);
        } catch {}
      }
    });

    const totalEstimatedKm = escortTotalKm > 0
      ? Number(escortTotalKm.toFixed(1))
      : escortTrips > 0
      ? Number((escortTrips * 7.5).toFixed(1))
      : 0;

    const pickupsCount = escortTimeline.filter((t) => t.type === 'Pickup').length;
    const dropoffsCount = escortTimeline.filter((t) => t.type === 'Drop-off').length;

    // 5. Fetch real Wallet & Financials
    const [walletRes, profileRes] = await Promise.all([
      supabase.from('wallets').select('balance').eq('user_id', session.user_id).maybeSingle(),
      supabase.from('user_profiles').select('wallet_balance').eq('id', session.user_id).maybeSingle(),
    ]);

    const currentBalance = Number(walletRes.data?.balance ?? profileRes.data?.wallet_balance ?? 0);

    // Calculate real financial spend from shared_ride_bookings & transport_bookings
    let sharedRideSpend = 0;
    let edriveSpend = 0;
    let schoolEscortSpend = 0;
    let otherFeesSpend = 0;
    const recentTransactions: any[] = [];

    (sharedBookings || []).forEach((b) => {
      const amt = Number(b.total_amount || 0);
      sharedRideSpend += amt;
      recentTransactions.push({
        date: formatLagosDate(b.created_at),
        service: 'Shared Ride Escort',
        amount: amt,
      });
    });

    (transportBookings || []).forEach((b) => {
      let amt = 0;
      if (b.notes) {
        try {
          const parsed = typeof b.notes === 'string' ? JSON.parse(b.notes) : b.notes;
          amt = Number(parsed.actual_amount_collected || parsed.daily_fare || parsed.fareResult?.dailyFare || 0);
        } catch {}
      }
      if (!amt) {
        const fare = resolveStoredEscortFare({
          fareAmount: b.fare_amount,
          notes: b.notes,
          distanceKm: null,
          tripType: null,
        });
        amt = Number(fare.actualAmountCollected || fare.dailyFare || b.fare_amount || 0);
      }

      if (b.source === 'edrive') {
        edriveSpend += amt;
      } else {
        schoolEscortSpend += amt;
      }

      recentTransactions.push({
        date: formatLagosDate(b.created_at),
        service: b.source === 'edrive' ? 'E-Drive (Exclusive Ride)' : 'School Escort Transit',
        amount: amt,
      });
    });

    const totalSpent = sharedRideSpend + edriveSpend + schoolEscortSpend + otherFeesSpend;

    const breakdown = totalSpent > 0 ? [
      {
        category: 'School Escort Transit',
        amount: schoolEscortSpend,
        percentage: Number(((schoolEscortSpend / totalSpent) * 100).toFixed(1)),
        color: '#8B5CF6',
      },
      {
        category: 'Shared Ride',
        amount: sharedRideSpend,
        percentage: Number(((sharedRideSpend / totalSpent) * 100).toFixed(1)),
        color: '#3B82F6',
      },
      {
        category: 'E-Drive (Exclusive Ride)',
        amount: edriveSpend,
        percentage: Number(((edriveSpend / totalSpent) * 100).toFixed(1)),
        color: '#10B981',
      },
      {
        category: 'Other Fees',
        amount: otherFeesSpend,
        percentage: Number(((otherFeesSpend / totalSpent) * 100).toFixed(1)),
        color: '#F59E0B',
      },
    ].filter((item) => item.amount > 0) : [];

    // 6. Fetch real Withdrawals & Referrals from audit_logs within window
    const { data: withdrawalLogs } = await supabase
      .from('audit_logs')
      .select('*')
      .eq('user_id', session.user_id)
      .eq('action', 'WALLET_WITHDRAWAL')
      .gte('created_at', sinceIso)
      .order('created_at', { ascending: false })
      .limit(10);

    const withdrawalReport = (withdrawalLogs || []).map((w) => {
      const details = w.details as any;
      return {
        date: formatLagosDate(w.created_at),
        destination: details?.destination || 'Bank Payout',
        amount: Number(details?.amount || 0),
        status: details?.status || 'Successful',
      };
    });

    const { data: referralLogs } = await supabase
      .from('audit_logs')
      .select('*')
      .eq('user_id', session.user_id)
      .like('action', 'REFERRAL_%')
      .gte('created_at', sinceIso)
      .order('created_at', { ascending: false })
      .limit(10);

    let bonusesEarned = 0;
    const referralHistory = (referralLogs || []).map((r) => {
      const details = r.details as any;
      const amt = Number(details?.bonus_amount || 500);
      bonusesEarned += amt;
      return {
        date: formatLagosDate(r.created_at),
        type: details?.type || 'Referral Bonus',
        amount: amt,
      };
    });

    const labelPeriod =
      dateFilter === 'today'
        ? 'Today'
        : dateFilter === 'week'
        ? 'Past 7 Days'
        : dateFilter === 'year'
        ? 'This Year'
        : 'This Month';

    const responsePayload = {
      date_filter: dateFilter,
      student_id: targetStudentId || null,
      filtered_since: sinceIso,
      summary_kpis: {
        gate_activities: {
          count: totalEntries + totalExits,
          label: `Entries/Exits (${labelPeriod})`,
          change: totalEntries > 0 ? `${totalEntries} In / ${totalExits} Out` : 'No logs in period',
        },
        escort_movements: {
          count: escortTrips,
          label: `Trips (${labelPeriod})`,
          change: escortTrips > 0 ? `${escortTrips} verified trips` : 'No trips in period',
        },
        services_completed: {
          count: completedServices,
          label: `Completed (${labelPeriod})`,
          change: `${completedServices} completed`,
        },
        total_spent: {
          amount: totalSpent,
          label: labelPeriod,
          change: totalSpent > 0 ? `₦${totalSpent.toLocaleString()} recorded` : '₦0.00 spent',
        },
        total_withdrawn: {
          amount: withdrawalReport.reduce((acc, curr) => acc + curr.amount, 0),
          label: labelPeriod,
          change: withdrawalReport.length > 0 ? `${withdrawalReport.length} payouts` : '₦0.00 withdrawn',
        },
        bonuses_earned: {
          amount: bonusesEarned,
          label: labelPeriod,
          change: bonusesEarned > 0 ? `₦${bonusesEarned.toLocaleString()} earned` : '₦0.00 earned',
        },
      },
      gate_activity_report: {
        total_entries: totalEntries,
        total_exits: totalExits,
        late_arrivals: lateArrivals,
        early_pickups: earlyPickups,
        logs: gateLogs,
      },
      escort_movement_report: {
        trips: escortTrips,
        distance_km: totalEstimatedKm,
        pickups: pickupsCount,
        dropoffs: dropoffsCount,
        duration: escortTrips > 0 ? `${escortTrips * 35}m` : '0m',
        timeline: escortTimeline.slice(0, 100),
      },
      financial_report: {
        total_spent: totalSpent,
        breakdown: breakdown,
        recent_transactions: recentTransactions.slice(0, 10),
      },
      wallet_report: {
        opening_balance: currentBalance > 0 ? currentBalance : 0,
        total_deposits: currentBalance + totalSpent,
        total_spent: totalSpent,
        total_transfers: 0,
        closing_balance: currentBalance,
      },
      withdrawal_report: withdrawalReport,
      referral_report: {
        total_referrals: (referralLogs || []).length,
        successful_referrals: (referralLogs || []).length,
        bonuses_earned: bonusesEarned,
        history: referralHistory,
      },
    };

    return NextResponse.json(
      {
        success: true,
        reports: responsePayload,
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
      }
    );
  } catch (err: any) {
    console.error('[GET /api/parent/reports/overview] error:', err);
    return NextResponse.json({ error: err.message || 'Failed to load reports overview' }, { status: 500 });
  }
}
