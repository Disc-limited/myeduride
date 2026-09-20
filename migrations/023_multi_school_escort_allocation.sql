-- ==============================================================================
-- Migration: 023_multi_school_escort_allocation.sql
-- Description: Adds allocated_school_ids array and escort_type column to escort_applications.
-- Enables City Manager to allocate 3+ schools to MyEduRide escorts with native SQL indexing.
-- ==============================================================================

-- 1. Ensure escort_applications has allocated_school_ids array and escort_type column
ALTER TABLE escort_applications
  ADD COLUMN IF NOT EXISTS allocated_school_ids TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS escort_type TEXT DEFAULT 'myeduride_escort';

-- 2. Indexes for fast multi-school filtering and escort category lookups
CREATE INDEX IF NOT EXISTS idx_escort_applications_allocated_schools
  ON escort_applications USING GIN (allocated_school_ids);

CREATE INDEX IF NOT EXISTS idx_escort_applications_escort_type
  ON escort_applications (escort_type);

-- 3. Backfill allocated_school_ids from existing application_data, primary_school_id, and secondary_school_id
DO $$
DECLARE
  rec RECORD;
  extracted_schools TEXT[];
  app_data_json JSONB;
BEGIN
  FOR rec IN SELECT id, application_data, primary_school_id, secondary_school_id, school_id FROM escort_applications LOOP
    extracted_schools := ARRAY[]::TEXT[];
    
    -- Extract from application_data JSONB if present
    IF rec.application_data IS NOT NULL THEN
      BEGIN
        IF jsonb_typeof(rec.application_data) = 'object' THEN
          app_data_json := rec.application_data;
        ELSIF jsonb_typeof(rec.application_data) = 'string' THEN
          app_data_json := (rec.application_data #>> '{}')::jsonb;
        ELSE
          app_data_json := rec.application_data::jsonb;
        END IF;

        IF app_data_json ? 'allocated_school_ids' AND jsonb_typeof(app_data_json->'allocated_school_ids') = 'array' THEN
          SELECT ARRAY_AGG(DISTINCT val) INTO extracted_schools
          FROM jsonb_array_elements_text(app_data_json->'allocated_school_ids') AS val
          WHERE val IS NOT NULL AND val <> '';
        END IF;
      EXCEPTION WHEN OTHERS THEN
        -- ignore json parse error
      END;
    END IF;

    -- Add primary_school_id if not in array
    IF rec.primary_school_id IS NOT NULL AND NOT (rec.primary_school_id::TEXT = ANY(COALESCE(extracted_schools, ARRAY[]::TEXT[]))) THEN
      extracted_schools := array_append(COALESCE(extracted_schools, ARRAY[]::TEXT[]), rec.primary_school_id::TEXT);
    END IF;

    -- Add secondary_school_id if not in array
    IF rec.secondary_school_id IS NOT NULL AND NOT (rec.secondary_school_id::TEXT = ANY(COALESCE(extracted_schools, ARRAY[]::TEXT[]))) THEN
      extracted_schools := array_append(COALESCE(extracted_schools, ARRAY[]::TEXT[]), rec.secondary_school_id::TEXT);
    END IF;

    -- Add school_id if not in array
    IF rec.school_id IS NOT NULL AND NOT (rec.school_id::TEXT = ANY(COALESCE(extracted_schools, ARRAY[]::TEXT[]))) THEN
      extracted_schools := array_append(COALESCE(extracted_schools, ARRAY[]::TEXT[]), rec.school_id::TEXT);
    END IF;

    -- Update row if schools were found
    IF extracted_schools IS NOT NULL AND array_length(extracted_schools, 1) > 0 THEN
      UPDATE escort_applications
      SET allocated_school_ids = extracted_schools
      WHERE id = rec.id;
    END IF;
  END LOOP;
END $$;

-- 4. Reload PostgREST schema cache so API queries immediately reflect new columns
NOTIFY pgrst, 'reload schema';
