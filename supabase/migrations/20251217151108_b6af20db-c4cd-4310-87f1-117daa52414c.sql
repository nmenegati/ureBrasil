-- Add avatar_url column to student_profiles
ALTER TABLE public.student_profiles 
ADD COLUMN IF NOT EXISTS avatar_url TEXT;