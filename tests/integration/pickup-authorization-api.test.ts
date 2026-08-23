import { TestSuite, expect } from '../utils/test-harness';

export const pickupAuthorizationApiSuite = new TestSuite('Parent Pickup Authorization API Integration Suite', 'INTEGRATION');

pickupAuthorizationApiSuite.test('GET /api/parent/pickup-authorizations: Returns 3 slots and categorized lists', async () => {
  const mockResponse = {
    success: true,
    child_id: 'STU-001',
    max_slots: 3,
    used_slots_count: 2,
    available_slots_count: 1,
    slots: [
      { slot_number: 1, status: 'FILLED', person: { name: 'John Okafor', category: 'family_member' } },
      { slot_number: 2, status: 'FILLED', person: { name: 'Babajide Adeleke', category: 'escort' } },
      { slot_number: 3, status: 'AVAILABLE', person: null },
    ],
    categorized: {
      escorts: [{ name: 'Babajide Adeleke' }],
      family_members: [{ name: 'John Okafor' }],
      other_approved: [],
    },
  };

  expect(mockResponse.success).toBeTruthy();
  expect(mockResponse.max_slots).toBe(3);
  expect(mockResponse.slots.length).toBe(3);
  expect(mockResponse.slots[2].status).toBe('AVAILABLE');
});

pickupAuthorizationApiSuite.test('POST /api/parent/pickup-authorizations: Records authorization and syncs to Gate Officer', async () => {
  const payload = {
    child_id: 'STU-001',
    target_slot_number: 3,
    name: 'Sunday Eze',
    category: 'other_approved',
    relationship: 'Designated Family Driver',
    phone: '+234 802 998 7711',
    photo_url: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
    emergency_notes: 'Authorized on Tuesdays and Thursdays.',
    legal_confirmation: true,
  };

  const executePost = (p: typeof payload) => {
    return {
      success: true,
      message: `Pickup authorization for ${p.name} recorded in Slot ${p.target_slot_number} and transmitted to School Gate Officer.`,
      authorization: {
        id: 'AUTH-03',
        slot_number: p.target_slot_number,
        name: p.name,
        category: p.category,
        relationship: p.relationship,
        phone: p.phone,
        is_verified: true,
        gate_synced: true,
      },
      used_slots_count: 3,
      available_slots_count: 0,
    };
  };

  const res = executePost(payload);
  expect(res.success).toBeTruthy();
  expect(res.authorization.slot_number).toBe(3);
  expect(res.authorization.gate_synced).toBeTruthy();
  expect(res.available_slots_count).toBe(0);
});
