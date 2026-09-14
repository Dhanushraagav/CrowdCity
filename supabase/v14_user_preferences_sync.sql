-- Migration Version: v14_user_preferences_sync.sql
-- Description: Add language and theme preferences to public.profiles and synchronize new user creation

-- 1. Add language preference column to public.profiles
-- Allowed values: 'ta' (Tamil), 'en' (English)
-- Default for new users: 'ta'
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS language text DEFAULT 'ta' CHECK (language IN ('ta', 'en'));

-- 2. Add theme preference column to public.profiles
-- Allowed values: 'light' (Light Theme), 'dark' (Dark / AMOLED Theme)
-- Default for new users: 'light'
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS theme text DEFAULT 'light' CHECK (theme IN ('light', 'dark'));

-- 3. Ensure any existing rows without preferences are backfilled with system defaults
UPDATE public.profiles 
  SET language = 'ta' 
  WHERE language IS NULL;

UPDATE public.profiles 
  SET theme = 'light' 
  WHERE theme IS NULL;

-- 4. Update the handle_new_user() trigger function
-- When a user is created via Supabase Auth (Email, OTP, Google OAuth),
-- extract any explicit preferences from user_metadata or apply default values ('ta', 'light').
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (
    id, 
    full_name, 
    avatar_url, 
    role,
    language,
    theme
  )
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', 'Citizen'),
    COALESCE(new.raw_user_meta_data->>'avatar_url', ''),
    'citizen',
    COALESCE(new.raw_user_meta_data->>'language', 'ta'),
    COALESCE(new.raw_user_meta_data->>'theme', 'light')
  )
  ON CONFLICT (id) DO UPDATE SET
    language = COALESCE(public.profiles.language, EXCLUDED.language),
    theme = COALESCE(public.profiles.theme, EXCLUDED.theme);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
