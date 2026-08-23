export interface EmergencyDeputisingRecord {
  id: string;
  school_id: string;
  school_name: string;
  route_id: string;
  route_name: string;
  original_escort_id: string;
  original_escort_name: string;
  original_escort_phone: string;
  deputy_escort_id: string;
  deputy_escort_name: string;
  deputy_escort_phone: string;
  deputy_vehicle_plate: string;
  deputy_photo_url: string;
  student_ids: string[];
  student_names: string[];
  emergency_reason: string;
  notes?: string;
  time_window_start: string;
  time_window_end: string | null;
  handover_confirmed_at: string | null;
  assigned_by: string;
  assigned_by_name: string;
  status: 'ACTIVE_DEPUTY' | 'COMPLETED_HANDOVER' | 'CANCELLED';
  created_at: string;
  updated_at: string;
}

// In-memory store for emergency deputising custody history
export const emergencyDeputisingStore: EmergencyDeputisingRecord[] = [
  {
    id: 'DEP-2026-001',
    school_id: 'sch-001',
    school_name: 'Gracefield International School',
    route_id: 'rt-lekki-01',
    route_name: 'Lekki Phase 1 / Oniru Express Route',
    original_escort_id: 'ESC-SCH-01',
    original_escort_name: 'Babajide Adeleke',
    original_escort_phone: '+234 803 291 8841',
    deputy_escort_id: 'ESC-MYE-04',
    deputy_escort_name: 'Babatunde Lawal (MyEduRide Certified)',
    deputy_escort_phone: '+234 802 334 1188',
    deputy_vehicle_plate: 'SUR-440-XA (Toyota Sienna 2022)',
    deputy_photo_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
    student_ids: ['STU-001', 'STU-002', 'STU-003', 'STU-004'],
    student_names: ['David James', 'Esther Paul', 'Michael Obi', 'Sarah Yusuf'],
    emergency_reason: 'School bus mechanical delay — immediate standby deputising',
    notes: 'City Manager dispatched certified backup escort to ensure zero student delay.',
    time_window_start: '2026-08-23T07:15:00Z',
    time_window_end: null,
    handover_confirmed_at: null,
    assigned_by: 'usr-cm-lagos',
    assigned_by_name: 'City Manager Lagos Central',
    status: 'ACTIVE_DEPUTY',
    created_at: '2026-08-23T07:15:00Z',
    updated_at: '2026-08-23T07:15:00Z',
  },
  {
    id: 'DEP-2026-002',
    school_id: 'sch-001',
    school_name: 'Gracefield International School',
    route_id: 'rt-vi-02',
    route_name: 'Victoria Island Coastal Corridor',
    original_escort_id: 'ESC-SCH-02',
    original_escort_name: 'Emeka Nwosu',
    original_escort_phone: '+234 802 991 3322',
    deputy_escort_id: 'ESC-MYE-05',
    deputy_escort_name: 'Chioma Okonkwo (MyEduRide Certified)',
    deputy_escort_phone: '+234 803 771 2299',
    deputy_vehicle_plate: 'IKJ-110-LA (Honda Odyssey 2023)',
    deputy_photo_url: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150',
    student_ids: ['STU-005', 'STU-006'],
    student_names: ['Daniel Peter', 'Victory Bello'],
    emergency_reason: 'Escort medical emergency (hospital triage)',
    notes: 'Deputised for afternoon dismissal run. Successfully handed over to parents with 100% security PIN matches.',
    time_window_start: '2026-08-22T14:30:00Z',
    time_window_end: '2026-08-22T16:45:00Z',
    handover_confirmed_at: '2026-08-22T16:45:00Z',
    assigned_by: 'usr-cm-lagos',
    assigned_by_name: 'City Manager Lagos Central',
    status: 'COMPLETED_HANDOVER',
    created_at: '2026-08-22T14:30:00Z',
    updated_at: '2026-08-22T16:45:00Z',
  },
];
