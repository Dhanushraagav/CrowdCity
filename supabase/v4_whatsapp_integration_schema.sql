-- CrowdCity AI v2.3 - WhatsApp Integration (Student Project Edition) Schema Addition
-- Extends public.profiles table to store WhatsApp notifications configurations.

-- 1. Alter public.profiles table to append WhatsApp settings columns
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS whatsapp_number TEXT,
ADD COLUMN IF NOT EXISTS whatsapp_notifications_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS whatsapp_notify_complaints BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS whatsapp_notify_applications BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS whatsapp_notify_reminders BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS whatsapp_notify_schemes BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS whatsapp_notify_announcements BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS whatsapp_language VARCHAR(10) DEFAULT 'en';

-- 2. Populate basic constraints or comments for database clarity
COMMENT ON COLUMN public.profiles.whatsapp_number IS 'Registered phone number for free local WhatsApp notifications via whatsapp-web.js';
COMMENT ON COLUMN public.profiles.whatsapp_language IS 'Preferred language for WhatsApp template messages (en = English, ta = Tamil)';
