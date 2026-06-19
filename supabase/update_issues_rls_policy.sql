-- Supabase SQL Migration: Fix Issues Update RLS Policy for Self-Assignment
-- Execute this script in the Supabase SQL Editor (Dashboard > SQL Editor > New Query)

-- 1. Drop the existing update policy on issues
DROP POLICY IF EXISTS "Reporter, assigned authority, or admins can update issue records" ON public.issues;
DROP POLICY IF EXISTS "Reporter, Authority, or Admins can update their issues" ON public.issues;

-- 2. Create the corrected policy with split USING and WITH CHECK clauses
CREATE POLICY "Reporter, assigned authority, or admins can update issue records" ON public.issues
  FOR UPDATE 
  USING (
    -- Allow the citizen reporter to update their own issue
    auth.uid() = reporter_id OR 
    
    -- Allow the currently assigned authority to update their issue
    auth.uid() = assigned_to OR
    
    -- Allow verified authority users to select the issue for update if it is unassigned or already assigned to them
    (
      EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid() 
          AND profiles.role = 'authority' 
          AND profiles.is_verified_authority = true
      )
      AND (
        assigned_to IS NULL OR
        assigned_to = auth.uid()
      )
    ) OR
    
    -- Allow administrators full access
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    -- Post-update constraints: ensures authorities can only save if they assigned it to themselves
    auth.uid() = reporter_id OR 
    auth.uid() = assigned_to OR
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

COMMENT ON POLICY "Reporter, assigned authority, or admins can update issue records" ON public.issues 
  IS 'Allows verified inspectors to self-assign unassigned complaints, reporters to update their details, and admins full control.';
