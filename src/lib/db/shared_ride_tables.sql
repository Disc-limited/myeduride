-- Database Schema for Shared Ride Escort & Bookings

-- 1. Create shared_ride_escorts table
CREATE TABLE IF NOT EXISTS public.shared_ride_escorts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    escort_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    escort_name VARCHAR(255) NOT NULL,
    escort_avatar_url TEXT,
    escort_code VARCHAR(100) NOT NULL UNIQUE,
    vehicle_model VARCHAR(255) NOT NULL,
    vehicle_color VARCHAR(100) DEFAULT 'White',
    total_seats INT DEFAULT 4,
    available_seats INT DEFAULT 2,
    rating NUMERIC(3, 2) DEFAULT 4.90,
    total_reviews INT DEFAULT 128,
    is_verified BOOLEAN DEFAULT true,
    status VARCHAR(50) DEFAULT 'available', -- 'available', 'closed', 'full'
    operating_area VARCHAR(255) DEFAULT 'Idimu / Ipaja / Lekki',
    pickup_time VARCHAR(50) DEFAULT '07:00 AM',
    dropoff_time VARCHAR(50) DEFAULT '02:30 PM',
    eta_minutes INT DEFAULT 18,
    base_fare_single NUMERIC(10, 2) DEFAULT 850.00,
    base_fare_round NUMERIC(10, 2) DEFAULT 1500.00,
    service_fee NUMERIC(10, 2) DEFAULT 100.00,
    route_stops JSONB DEFAULT '[
      {"name": "Your Pickup", "address": "23, Silver Estate Road, Idimu, Lagos", "time": "7:00 AM", "type": "pickup"},
      {"name": "Command Day School", "address": "Ipaja, Lagos", "time": "7:18 AM", "type": "school"},
      {"name": "Greenfield International School", "address": "Lagos", "time": "2:30 PM", "type": "school"}
    ]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create shared_ride_bookings table
CREATE TABLE IF NOT EXISTS public.shared_ride_bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    student_id UUID REFERENCES public.students(id) ON DELETE SET NULL,
    escort_route_id UUID REFERENCES public.shared_ride_escorts(id) ON DELETE CASCADE,
    escort_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    trip_type VARCHAR(50) NOT NULL DEFAULT 'round_trip', -- 'single', 'round_trip'
    seat_type VARCHAR(50) NOT NULL DEFAULT 'shared', -- 'shared', 'exclusive'
    pickup_address TEXT NOT NULL,
    pickup_time VARCHAR(50),
    dropoff_time VARCHAR(50),
    base_fare NUMERIC(10, 2) NOT NULL DEFAULT 1500.00,
    service_fee NUMERIC(10, 2) NOT NULL DEFAULT 100.00,
    total_amount NUMERIC(10, 2) NOT NULL DEFAULT 1600.00,
    status VARCHAR(50) DEFAULT 'confirmed', -- 'confirmed', 'in_transit', 'completed', 'cancelled'
    payment_status VARCHAR(50) DEFAULT 'held_in_escrow', -- 'held_in_escrow', 'deducted', 'refunded'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_shared_ride_escorts_status ON public.shared_ride_escorts(status);
CREATE INDEX IF NOT EXISTS idx_shared_ride_bookings_parent ON public.shared_ride_bookings(parent_id);
CREATE INDEX IF NOT EXISTS idx_shared_ride_bookings_escort ON public.shared_ride_bookings(escort_route_id);
