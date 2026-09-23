/**
 * Trip Cancellation & Real-Time Notification Domain Types
 */

export type CancellationReason =
  | 'illness'
  | 'family_travel'
  | 'medical_appointment'
  | 'personal'
  | 'school_event'
  | 'other';

export interface TripCancellationPayload {
  child_id: string;
  reason: CancellationReason | string;
  notes?: string;
  trip_type?: 'both' | 'morning_only' | 'afternoon_only';
}

export interface TripCancellationEvent {
  event: 'student_trip_canceled';
  student_id: string;
  student_name: string;
  school_id: string;
  school_name?: string;
  escort_id?: string;
  escort_name?: string;
  reason: string;
  notes?: string;
  canceled_at: string;
  date: string;
}

export interface ProximityAlertEvent {
  event: 'escort_proximity_5min';
  student_id: string;
  student_name: string;
  escort_id: string;
  escort_name: string;
  distance_meters: number;
  eta_minutes: number;
  trip_phase: 'morning_pickup' | 'afternoon_dropoff';
  timestamp: string;
}
