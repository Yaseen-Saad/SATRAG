-- Add missing columns that the app requires but were not in the original schema.
-- Run this in the Supabase SQL Editor if you get errors about missing columns.

-- Grade level for students
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_name = 'public_profiles' AND column_name = 'grade'
  ) THEN
    ALTER TABLE public_profiles ADD COLUMN grade TEXT;
  END IF;
END $$;

-- Monthly generation tracking (for free-tier limits)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_name = 'public_profiles' AND column_name = 'monthly_gen_count'
  ) THEN
    ALTER TABLE public_profiles ADD COLUMN monthly_gen_count INT DEFAULT 0;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_name = 'public_profiles' AND column_name = 'monthly_gen_month'
  ) THEN
    ALTER TABLE public_profiles ADD COLUMN monthly_gen_month TEXT;
  END IF;
END $$;
