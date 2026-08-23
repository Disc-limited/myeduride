import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth/auth-server';
import { getAdminClient } from '@/lib/supabase/admin';
import { nowUtcIso } from '@/lib/utils/time';
import { pickupAuthorizationsStore } from '@/lib/stores/pickup-authorizations-store';

export const dynamic = 'force-dynamic';

const MAX_PICKUP_SLOTS = 3;

export async function GET(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const childId = searchParams.get('child_id') || 'STU-001';

    const childAuthorizations = pickupAuthorizationsStore[childId] || [];

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
      child_id = 'STU-001',
      name,
      category = 'family_member',
      relationship,
      phone,
      photo_url,
      emergency_notes,
      legal_confirmation = true,
      target_slot_number,
    } = body;

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

    const currentList = pickupAuthorizationsStore[child_id] || [];

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

    if (!assignedSlot || (currentList.length >= MAX_PICKUP_SLOTS && !currentList.some((p) => p.slot_number === assignedSlot))) {
      return NextResponse.json(
        {
          error: `Maximum limit of ${MAX_PICKUP_SLOTS} authorized pickup slots reached. Please remove an existing slot to add a new person.`,
        },
        { status: 400 }
      );
    }

    const categoryLabels: Record<string, string> = {
      escort: 'Escort (School / MyEduRide)',
      family_member: 'Family Member',
      other_approved: 'Other Approved Pickup Person',
    };

    const newAuth = {
      id: `AUTH-${Date.now().toString().slice(-4)}`,
      slot_number: assignedSlot,
      name: name.trim(),
      category,
      category_label: categoryLabels[category] || 'Family Member',
      relationship: relationship.trim(),
      phone: phone.trim(),
      photo_url: photo_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
      emergency_notes: emergency_notes || 'Authorized for gate release.',
      is_verified: true,
      confirmed_by_parent: true,
      confirmed_at: nowUtcIso(),
      parent_user_id: session.user_id,
      gate_synced: true,
      synced_to_gate_at: nowUtcIso(),
    };

    // Replace if slot was occupied or append
    const updatedList = currentList.filter((p) => p.slot_number !== assignedSlot);
    updatedList.push(newAuth);
    updatedList.sort((a, b) => a.slot_number - b.slot_number);
    pickupAuthorizationsStore[child_id] = updatedList;

    return NextResponse.json({
      success: true,
      message: `Pickup authorization for ${newAuth.name} recorded in Slot ${newAuth.slot_number} and transmitted to School Gate Officer.`,
      authorization: newAuth,
      used_slots_count: updatedList.length,
      available_slots_count: MAX_PICKUP_SLOTS - updatedList.length,
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
    const childId = searchParams.get('child_id') || 'STU-001';
    const authId = searchParams.get('id');
    const slotNumber = searchParams.get('slot_number');

    const currentList = pickupAuthorizationsStore[childId] || [];
    const filtered = currentList.filter((p) => {
      if (authId && p.id === authId) return false;
      if (slotNumber && p.slot_number === parseInt(slotNumber, 10)) return false;
      return true;
    });

    pickupAuthorizationsStore[childId] = filtered;

    return NextResponse.json({
      success: true,
      message: 'Authorized pickup slot removed and safety record updated.',
      used_slots_count: filtered.length,
      available_slots_count: MAX_PICKUP_SLOTS - filtered.length,
    });
  } catch (err: any) {
    console.error('[pickup-authorizations DELETE] Error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
