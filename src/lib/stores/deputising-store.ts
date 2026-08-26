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

// In-memory store for emergency deputising custody history (strictly live records)
export const emergencyDeputisingStore: EmergencyDeputisingRecord[] = [];
