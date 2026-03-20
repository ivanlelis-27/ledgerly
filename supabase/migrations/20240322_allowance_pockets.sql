-- Create pockets column for student budget allocations
ALTER TABLE salary_profile
ADD COLUMN IF NOT EXISTS pockets JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS target_savings NUMERIC DEFAULT 0;

-- Optional: Add constraint to ensure it's an array of objects
-- ALTER TABLE salary_profile ADD CONSTRAINT check_pockets_is_array CHECK (jsonb_typeof(pockets) = 'array');
