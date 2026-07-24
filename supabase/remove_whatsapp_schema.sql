-- CrowdCity AI - Migration Script: Complete WhatsApp Removal
-- Safely drops all WhatsApp columns from public.profiles and any related objects

ALTER TABLE public.profiles
DROP COLUMN IF EXISTS whatsapp_number,
DROP COLUMN IF EXISTS whatsapp_notifications_enabled,
DROP COLUMN IF EXISTS whatsapp_notify_complaints,
DROP COLUMN IF EXISTS whatsapp_notify_applications,
DROP COLUMN IF EXISTS whatsapp_notify_reminders,
DROP COLUMN IF EXISTS whatsapp_notify_schemes,
DROP COLUMN IF EXISTS whatsapp_notify_announcements,
DROP COLUMN IF EXISTS whatsapp_language;

DROP TABLE IF EXISTS public.whatsapp_logs CASCADE;
DROP TABLE IF EXISTS public.whatsapp_queue CASCADE;
DROP TABLE IF EXISTS public.whatsapp_sessions CASCADE;
DROP TABLE IF EXISTS public.whatsapp_templates CASCADE;
DROP TABLE IF EXISTS public.whatsapp_preferences CASCADE;
