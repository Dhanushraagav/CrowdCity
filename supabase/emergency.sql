-- CrowdCity Schema Migration: Add Emergency Issue Reporting Support
-- Execute this SQL script in the Supabase SQL editor

ALTER TABLE public.issues ADD COLUMN IF NOT EXISTS is_emergency boolean DEFAULT false NOT NULL;
