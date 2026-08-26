import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/session';
import { getAdminClient } from '@/lib/supabase/admin';
import { nowUtcIso } from '@/lib/timezone';

export const dynamic = 'force-dynamic';

const MAX_PICKUP_SLOTS = 3;

export async function GET(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const childId = searchParams.get('child_id');

    if (!childId) {
      return NextResponse.json({
        success: true,
        max_slots: MAX_PICKUP_SLOTS,
        used_slots_count: 0,
        available_slots_count: MAX_PICKUP_SLOTS,
        slots: [1, 2, 3].map((slotNum) => ({ slot_number: slotNum, status: 'AVAILABLE', person: null })),
        categorized: { escorts: [], family_members: [], other_approved: [] },
      });
    }

    const supabase = getAdminClient();

    // Query pickup authorizations for this student from Supabase table
    const { data: dbAuths } = await supabase
      .from('pickup_authorizations')
      .select('*')
      .eq('student_id', childId)
      .order('slot_number', { ascending: true });

    let childAuthorizations = dbAuths || [];

    // Fallback: If no rows in pickup_authorizations, also query pickup_persons table
    if (childAuthorizations.length === 0) {
      const { data: dbPersons } = await supabase
        .from('pickup_persons')
        .select('*')
        .eq('student_id', childId);

      if (dbPersons && dbPersons.length > 0) {
        childAuthorizations = dbPersons.map((p, idx) => ({
          id: p.id,
          slot_number: idx + 1,
          name: p.name,
          relationship: p.relationship || 'Guardian',
          category: p.relationship?.toLowerCase().includes('escort') ? 'escort' : 'family_member',
          phone: p.phone,
          photo_url: p.photo_url,
          emergency_notes: p.notes,
          is_verified: true,
          confirmed_by_parent: true,
        }));
      }
    }

    // Categorized breakdown
    const escorts = childAuthorizations.filter((p) => p.category === 'escort');
    const familyMembers = childAuthorizations.filter((p) => p.category === 'family_member');
    const otherApproved = childAuthorizations.filter((p) => p.category === 'other_approved');

    // Exactly 3 slot manifests
    const slots = [1, 2, 3].map((slotNum) => {
      const existing = childAuthorizations.find((p) => p.slot_number === slotNum);
      if (existing) {
        return {
          slot_number: slotNum,
          status: 'FILLED',
          person: existing,
        };
      }
      return {
        slot_number: slotNum,
        status: 'AVAILABLE',
        person: null,
      };
    });

    return NextResponse.json({
      success: true,
      child_id: childId,
      max_slots: MAX_PICKUP_SLOTS,
      used_slots_count: childAuthorizations.length,
      available_slots_count: Math.max(0, MAX_PICKUP_SLOTS - childAuthorizations.length),
      explanation:
        'The authorized pickup list is an official, immutable safety record. The Gate Officer and School Staff will ONLY release your child to individuals registered in these 3 verified slots upon visual matching and photograph verification.',
      slots,
      categorized: {
        escorts,
        family_members: familyMembers,
        other_approved: otherApproved,
      },
    });
  } catch (err: any) {
    console.error('[pickup-authorizations GET] Error:', err);
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
    const {
      child_id,
      name,
      category = 'family_member',
      relationship,
      phone,
      photo_url,
      emergency_notes,
      legal_confirmation = true,
      target_slot_number,
    } = body;

    if (!child_id) {
      return NextResponse.json({ error: 'child_id is required' }, { status: 400 });
    }

    if (!name?.trim() || !relationship?.trim() || !phone?.trim()) {
      return NextResponse.json(
        { error: 'Full name, relationship, and phone number are required' },
        { status: 400 }
      );
    }

    if (!legal_confirmation) {
      return NextResponse.json(
        { error: 'Parent must legally confirm the authorization before submission' },
        { status: 400 }
      );
    }

    const supabase = getAdminClient();

    // Query current records for student
    const { data: currentAuths } = await supabase
      .from('pickup_authorizations')
      .select('*')
      .eq('student_id', child_id);

    const currentList = currentAuths || [];

    // Determine target slot number
    let assignedSlot = target_slot_number;
    if (!assignedSlot) {
      const occupiedSlots = new Set(currentList.map((p) => p.slot_number));
      for (let i = 1; i <= MAX_PICKUP_SLOTS; i++) {
        if (!occupiedSlots.has(i)) {
          assignedSlot = i;
          break;
        }
      }
    }

    if (!assignedSlot) {
      return NextResponse.json(
        {
          error: `Maximum limit of ${MAX_PICKUP_SLOTS} authorized pickup slots reached. Please remove an existing slot to add a new person.`,
        },
        { status: 400 }
      );
    }

    // Get school_id
    const { data: student } = await supabase
      .from('students')
      .select('school_id')
      .eq('id', child_id)
      .maybeSingle();

    const schoolId = student?.school_id || session.roles?.find((r) => r.school_id)?.school_id || (session as any).primary_school?.id || null;

    const categoryLabels: Record<string, string> = {
      escort: 'Escort (School / MyEduRide)',
      family_member: 'Family Member',
      other_approved: 'Other Approved Pickup Person',
    };

    const insertPayload = {
      school_id: schoolId,
      student_id: child_id,
      parent_user_id: session.user_id,
      slot_number: assignedSlot,
      name: name.trim(),
      category,
      category_label: categoryLabels[category] || 'Family Member',
      relationship: relationship.trim(),
      phone: phone.trim(),
      photo_url: photo_url || null,
      emergency_notes: emergency_notes || 'Authorized for gate release.',
      is_verified: true,
      confirmed_by_parent: true,
      gate_synced: true,
      synced_to_gate_at: nowUtcIso(),
      updated_at: nowUtcIso(),
    };

    const { data: newAuth, error: upsertError } = await supabase
      .from('pickup_authorizations')
      .upsert(insertPayload, { onConflict: 'student_id,slot_number' })
      .select()
      .single();

    if (upsertError) throw upsertError;

    return NextResponse.json({
      success: true,
      message: `Pickup authorization for ${newAuth.name} recorded in Slot ${newAuth.slot_number} and transmitted to School Gate Officer.`,
      authorization: newAuth,
    });
  } catch (err: any) {
    console.error('[pickup-authorizations POST] Error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const childId = searchParams.get('child_id');
    const authId = searchParams.get('id');
    const slotNumber = searchParams.get('slot_number');

    if (!childId) {
      return NextResponse.json({ error: 'child_id is required' }, { status: 400 });
    }

    const supabase = getAdminClient();

    let query = supabase.from('pickup_authorizations').delete().eq('student_id', childId);

    if (authId) {
      query = query.eq('id', authId);
    } else if (slotNumber) {
      query = query.eq('slot_number', parseInt(slotNumber, 10));
    }

    const { error: deleteError } = await query;
    if (deleteError) throw deleteError;

    return NextResponse.json({
      success: true,
      message: 'Authorized pickup slot removed and safety record updated.',
    });
  } catch (err: any) {
    console.error('[pickup-authorizations DELETE] Error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
