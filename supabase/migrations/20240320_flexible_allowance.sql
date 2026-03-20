-- Add new fields to salary_profile table for flexible income tracking
ALTER TABLE salary_profile 
ADD COLUMN IF NOT EXISTS frequency TEXT DEFAULT 'bi-weekly',
ADD COLUMN IF NOT EXISTS source TEXT,
ADD COLUMN IF NOT EXISTS cutoff3_gross NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS cutoff3_deductions NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS cutoff4_gross NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS cutoff4_deductions NUMERIC DEFAULT 0;

-- Update existing records to have a default source if they don't have one
UPDATE salary_profile SET source = 'Salary' WHERE source IS NULL;
